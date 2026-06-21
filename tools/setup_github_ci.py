#!/usr/bin/env python3
"""
Sincroniza secretos de GitHub Actions (Firebase Hosting + Sheets).

Equivalente cross-platform de tools/sync_github_secrets.ps1.

Uso:
  py tools/setup_github_ci.py
  py tools/setup_github_ci.py --wait-sa
  py tools/setup_github_ci.py --run-workflow
  py tools/setup_github_ci.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

from _util import (
    DEFAULT_FIREBASE_PROJECT,
    PROJECT_ROOT,
    TOOLS_DIR,
    error,
    info,
    load_dotenv,
    ok,
    read_web_app_url,
    warn,
)

CREDENTIALS_DIR = TOOLS_DIR / "credentials"
FIREBASE_HOSTING_SA = CREDENTIALS_DIR / "firebase-hosting-sa.json"
ENV_PATH = TOOLS_DIR / ".env"
WORKFLOW_FILE = "deploy-firebase.yml"
WORKFLOW_NAME = "Deploy Firebase Hosting"

FIREBASE_CONSOLE_SA = (
    f"https://console.firebase.google.com/project/{DEFAULT_FIREBASE_PROJECT}"
    "/settings/serviceaccounts/adminsdk"
)

POLL_TIMEOUT_SEC = 180
POLL_INTERVAL_SEC = 2


def read_env_var(key: str) -> str:
    if not ENV_PATH.is_file():
        return ""
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, _, value = line.partition("=")
        if k.strip() == key:
            return value.strip().strip('"').strip("'")
    return ""


def resolve_sheets_url() -> str:
    load_dotenv()
    for source in (
        read_web_app_url(),
        read_env_var("SHEETS_WEB_APP_URL"),
        read_env_var("APPS_SCRIPT_URL"),
    ):
        if source and "/exec" in source:
            return source
    return ""


def require_gh() -> bool:
    if not shutil.which("gh"):
        error("No se encontró gh (GitHub CLI).")
        info("Instala: https://cli.github.com/ y ejecuta: gh auth login")
        return False
    result = subprocess.run(
        ["gh", "auth", "status"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        error("gh no está autenticado.")
        info("Ejecuta: gh auth login")
        if result.stderr:
            info(result.stderr.strip()[:300])
        return False
    ok("GitHub CLI autenticado.")
    return True


def validate_sa_json(path: Path) -> bool:
    if not path.is_file():
        error(f"No existe: {path}")
        return False
    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError as exc:
        error(f"JSON inválido: {exc}")
        return False
    for key in ("client_email", "private_key", "project_id", "type"):
        if key not in data:
            error(f"Falta campo '{key}' en la cuenta de servicio.")
            return False
    if data.get("type") != "service_account":
        error("El archivo no es una cuenta de servicio (type != service_account).")
        return False
    project_id = data.get("project_id", "")
    if project_id != DEFAULT_FIREBASE_PROJECT:
        warn(f"project_id es '{project_id}'; se esperaba '{DEFAULT_FIREBASE_PROJECT}'.")
    ok(f"JSON válido — {data.get('client_email', '?')}")
    return True


def validate_sa_via_deploy(path: Path) -> bool:
    info("Validando JSON con deploy_firebase.py --dry-run…")
    result = subprocess.run(
        [sys.executable, "tools/deploy_firebase.py", "--service-account", str(path), "--dry-run"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.stdout:
        print(result.stdout.rstrip())
    if result.returncode != 0:
        if result.stderr:
            error(result.stderr.strip()[:500])
        error("El JSON no pasó la validación de deploy_firebase.py.")
        return False
    ok("Validación deploy_firebase OK.")
    return True


def print_sa_instructions() -> None:
    print()
    info("Pasos — cuenta de servicio Firebase Hosting:")
    print(f"  1. Abre Firebase Console → {DEFAULT_FIREBASE_PROJECT} → Project settings")
    print("  2. Pestaña Service accounts → Generate new private key")
    print(f"  3. Guarda el JSON como:\n     {FIREBASE_HOSTING_SA}")
    print("  4. Vuelve a ejecutar: py tools/setup_github_ci.py")
    print()
    info(f"Ver también: {TOOLS_DIR / 'CONFIGURAR-FIREBASE-NUEVO.md'}")


def search_downloads_for_firebase_sa() -> Path | None:
    downloads = Path.home() / "Downloads"
    if not downloads.is_dir():
        return None
    candidates: list[tuple[float, Path]] = []
    for path in downloads.glob("*.json"):
        if not path.is_file():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if data.get("type") != "service_account":
            continue
        if data.get("project_id") == DEFAULT_FIREBASE_PROJECT or "firebase" in path.name.lower():
            candidates.append((path.stat().st_mtime, path))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]


def copy_sa_to_credentials(source: Path) -> Path:
    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    if source.resolve() != FIREBASE_HOSTING_SA.resolve():
        shutil.copy2(source, FIREBASE_HOSTING_SA)
        ok(f"Copiado a {FIREBASE_HOSTING_SA}")
    return FIREBASE_HOSTING_SA


def wait_for_sa_json(*, open_browser: bool = True, timeout: int = POLL_TIMEOUT_SEC) -> Path | None:
    if FIREBASE_HOSTING_SA.is_file():
        return FIREBASE_HOSTING_SA

    if open_browser:
        info("Abriendo Firebase Console (Service accounts)…")
        webbrowser.open(FIREBASE_CONSOLE_SA)

    print_sa_instructions()
    info(f"Esperando {FIREBASE_HOSTING_SA.name} (máx. {timeout}s)…")

    deadline = time.time() + timeout
    while time.time() < deadline:
        if FIREBASE_HOSTING_SA.is_file():
            ok(f"Detectado: {FIREBASE_HOSTING_SA}")
            return FIREBASE_HOSTING_SA
        found = search_downloads_for_firebase_sa()
        if found:
            return copy_sa_to_credentials(found)
        time.sleep(POLL_INTERVAL_SEC)

    error("Tiempo agotado esperando firebase-hosting-sa.json.")
    return None


def resolve_sa_path(*, wait: bool = False) -> Path | None:
    raw = read_env_var("FIREBASE_SERVICE_ACCOUNT_JSON").strip()
    if raw:
        path = Path(raw).expanduser()
        if path.is_file():
            return path.resolve()

    if FIREBASE_HOSTING_SA.is_file():
        return FIREBASE_HOSTING_SA

    found = search_downloads_for_firebase_sa()
    if found:
        return copy_sa_to_credentials(found)

    if wait:
        return wait_for_sa_json()

    print_sa_instructions()
    return None


def gh_secret_set(name: str, value: str) -> bool:
    info(f"Subiendo secreto {name}…")
    result = subprocess.run(
        ["gh", "secret", "set", name],
        input=value,
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        error(f"No se pudo subir {name}.")
        if result.stderr:
            error(result.stderr.strip()[:400])
        info("¿Estás autenticado? → gh auth login")
        return False
    ok(f"Secreto {name} actualizado.")
    return True


def sync_secrets(*, dry_run: bool = False) -> bool:
    sa_path = resolve_sa_path(wait=False)
    if not sa_path:
        return False

    if not validate_sa_json(sa_path):
        return False
    if not validate_sa_via_deploy(sa_path):
        return False

    sheets_url = resolve_sheets_url()
    if sheets_url:
        ok(f"SHEETS_WEB_APP_URL: {sheets_url[:60]}…")
    else:
        warn("Sin SHEETS_WEB_APP_URL — se omitirá (opcional para CI).")

    if dry_run:
        ok("Modo dry-run: secretos no subidos.")
        return True

    if not require_gh():
        return False

    sa_text = sa_path.read_text(encoding="utf-8")
    if not gh_secret_set("FIREBASE_SERVICE_ACCOUNT", sa_text):
        return False

    if sheets_url:
        if not gh_secret_set("SHEETS_WEB_APP_URL", sheets_url):
            return False

    ok("Secretos sincronizados en GitHub.")
    return True


def run_workflow_and_poll(*, timeout: int = 900) -> bool:
    if not require_gh():
        return False

    info(f"Lanzando workflow «{WORKFLOW_NAME}»…")
    result = subprocess.run(
        ["gh", "workflow", "run", WORKFLOW_NAME],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        error("No se pudo lanzar el workflow.")
        if result.stderr:
            error(result.stderr.strip()[:400])
        info(f"Manual: gh workflow run \"{WORKFLOW_NAME}\"")
        return False

    time.sleep(4)
    list_result = subprocess.run(
        [
            "gh",
            "run",
            "list",
            "--workflow",
            WORKFLOW_FILE,
            "--limit",
            "1",
            "--json",
            "databaseId,status,conclusion,url",
        ],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if list_result.returncode != 0 or not list_result.stdout.strip():
        warn("Workflow lanzado — no se pudo obtener el run ID.")
        info(f"Comprueba: gh run list --workflow {WORKFLOW_FILE} --limit 3")
        return True

    runs = json.loads(list_result.stdout)
    if not runs:
        warn("Sin runs recientes.")
        return True

    run = runs[0]
    run_id = str(run.get("databaseId", ""))
    url = run.get("url", "")
    if url:
        info(f"Run: {url}")

    if not run_id:
        warn("Run ID desconocido — comprueba manualmente en GitHub Actions.")
        return True

    info("Esperando finalización del workflow…")
    watch = subprocess.run(
        ["gh", "run", "watch", run_id, "--exit-status"],
        cwd=str(PROJECT_ROOT),
        timeout=timeout,
    )
    if watch.returncode == 0:
        ok("Workflow completado con éxito.")
        return True

    error("Workflow falló o fue cancelado.")
    info(f"Logs: gh run view {run_id} --log-failed")
    return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sincroniza secretos GitHub Actions (Firebase + Sheets).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ejemplos:\n"
            "  py tools/setup_github_ci.py\n"
            "  py tools/setup_github_ci.py --wait-sa --run-workflow\n"
            "  py tools/setup_github_ci.py --dry-run\n"
        ),
    )
    parser.add_argument("--wait-sa", action="store_true", help="Esperar firebase-hosting-sa.json (abre consola).")
    parser.add_argument("--run-workflow", action="store_true", help="Lanzar Deploy Firebase Hosting y esperar.")
    parser.add_argument("--dry-run", action="store_true", help="Solo validar, no subir secretos.")
    parser.add_argument("--no-browser", action="store_true", help="No abrir Firebase Console al esperar SA.")
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    load_dotenv()
    args = parse_args()

    print("=== setup_github_ci.py — secretos GitHub Actions ===\n")

    if args.wait_sa:
        sa = wait_for_sa_json(open_browser=not args.no_browser)
        if not sa:
            return 1

    if not sync_secrets(dry_run=args.dry_run):
        return 2

    if args.run_workflow and not args.dry_run:
        if not run_workflow_and_poll():
            return 3

    if not args.run_workflow and not args.dry_run:
        print()
        info("Para relanzar el deploy en GitHub Actions:")
        print(f'  gh workflow run "{WORKFLOW_NAME}"')
        print(f"  gh run list --workflow {WORKFLOW_FILE} --limit 3")

    return 0


if __name__ == "__main__":
    sys.exit(main())
