#!/usr/bin/env python3
"""
Valida requisitos de CI (local + GitHub) con salida accionable.

Uso:
  py tools/validate_ci_secrets.py
  py tools/validate_ci_secrets.py --fix-hint
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
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

FIREBASE_HOSTING_SA = TOOLS_DIR / "credentials" / "firebase-hosting-sa.json"
OAUTH_TOKEN_PATH = TOOLS_DIR / "credentials" / ".oauth-script-token.json"
ENV_PATH = TOOLS_DIR / ".env"


PLACEHOLDER_MARKERS = ("necesitamos", "placeholder", "pega aqu", "todo el json")


def looks_like_placeholder(raw: str) -> bool:
    lower = raw.lower()
    return any(marker in lower for marker in PLACEHOLDER_MARKERS)


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


def check_gh() -> tuple[bool, str]:
    if not shutil.which("gh"):
        return False, "Instala GitHub CLI: https://cli.github.com/"
    result = subprocess.run(
        ["gh", "auth", "status"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        return False, "Ejecuta: gh auth login"
    return True, "gh autenticado"


def check_local_firebase_sa() -> tuple[bool, str]:
    path = FIREBASE_HOSTING_SA
    raw_env = read_env_var("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw_env:
        alt = Path(raw_env).expanduser()
        if alt.is_file():
            path = alt.resolve()

    if not path.is_file():
        return False, f"Falta {FIREBASE_HOSTING_SA} (descarga desde Firebase Console)"

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False, f"JSON inválido en {path}"

    missing = [k for k in ("client_email", "private_key", "project_id") if k not in data]
    if missing:
        return False, f"Faltan campos en SA: {', '.join(missing)}"

    if data.get("project_id") != DEFAULT_FIREBASE_PROJECT:
        return False, f"project_id={data.get('project_id')} (esperado {DEFAULT_FIREBASE_PROJECT})"

    return True, str(path)


def check_sheets_url() -> tuple[bool, str]:
    url = read_web_app_url() or read_env_var("SHEETS_WEB_APP_URL") or read_env_var("APPS_SCRIPT_URL")
    if not url or "/exec" not in url:
        return False, "Define SHEETS_WEB_APP_URL en tools/.env o js/sheets-config.js"
    return True, url[:70] + ("…" if len(url) > 70 else "")


def check_github_secrets() -> tuple[bool, str]:
    if not shutil.which("gh"):
        return False, "gh no disponible"

    auth = subprocess.run(["gh", "auth", "status"], cwd=str(PROJECT_ROOT), capture_output=True)
    if auth.returncode != 0:
        return False, "gh auth login requerido"

    result = subprocess.run(
        ["gh", "secret", "list"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        return False, "No se pudo listar secretos (¿repo correcto?)"

    names = {line.split()[0] for line in result.stdout.splitlines() if line.strip()}
    missing = []
    if "FIREBASE_SERVICE_ACCOUNT" not in names:
        missing.append("FIREBASE_SERVICE_ACCOUNT")
    if "SHEETS_WEB_APP_URL" not in names:
        missing.append("SHEETS_WEB_APP_URL (opcional)")

    if "FIREBASE_SERVICE_ACCOUNT" not in names:
        return False, "Falta FIREBASE_SERVICE_ACCOUNT en GitHub → py tools/setup_github_ci.py"

    if missing == ["SHEETS_WEB_APP_URL (opcional)"]:
        return True, "FIREBASE_SERVICE_ACCOUNT OK; SHEETS_WEB_APP_URL opcional ausente"

    return True, "Secretos FIREBASE_SERVICE_ACCOUNT y SHEETS_WEB_APP_URL presentes"


def print_fix_hints(failures: list[str]) -> None:
    print()
    info("Corrección recomendada (un solo comando):")
    print("  py tools/automatizar_manual.py --ci")
    print()
    if any("FIREBASE" in f or "firebase-hosting" in f for f in failures):
        info("Solo secretos GitHub:")
        print("  py tools/setup_github_ci.py --wait-sa")
    if any("SHEETS" in f for f in failures):
        info("URL Apps Script:")
        print("  py tools/setup_admin.py --sin-firebase")
        print('  py tools/conectar_sheets.py --configurar-url "https://script.google.com/.../exec"')


def validate_firebase_sa_json(raw: str) -> tuple[bool, str]:
    raw = raw.strip()
    if not raw:
        return False, "Falta FIREBASE_SERVICE_ACCOUNT."
    if looks_like_placeholder(raw):
        return False, "FIREBASE_SERVICE_ACCOUNT parece texto de ejemplo (p. ej. necesitamos...), no JSON."
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        return False, f"FIREBASE_SERVICE_ACCOUNT no es JSON valido: {exc}"
    missing = [k for k in ("client_email", "private_key", "project_id") if k not in data]
    if missing:
        return False, f"Faltan campos en FIREBASE_SERVICE_ACCOUNT: {', '.join(missing)}"
    if data.get("project_id") != DEFAULT_FIREBASE_PROJECT:
        return False, f"project_id={data.get('project_id')} (esperado {DEFAULT_FIREBASE_PROJECT})"
    return True, data.get("client_email", "cuenta de servicio")


def check_ci_env_secrets() -> tuple[bool, str]:
    import os

    ok_sa, msg_sa = validate_firebase_sa_json(os.environ.get("FIREBASE_SERVICE_ACCOUNT", ""))
    if not ok_sa:
        return False, msg_sa

    sheets = os.environ.get("SHEETS_WEB_APP_URL", "").strip()
    if sheets and "/exec" not in sheets:
        return False, "SHEETS_WEB_APP_URL debe terminar en /exec"

    if sheets:
        return True, "FIREBASE_SERVICE_ACCOUNT OK; SHEETS_WEB_APP_URL presente"
    return True, "FIREBASE_SERVICE_ACCOUNT OK; SHEETS_WEB_APP_URL opcional ausente"


def validate_oauth_token_json(raw: str) -> tuple[bool, str]:
    raw = raw.strip()
    if not raw:
        return False, "Falta APPS_SCRIPT_OAUTH_TOKEN."
    if looks_like_placeholder(raw):
        return False, "APPS_SCRIPT_OAUTH_TOKEN parece texto de ejemplo, no JSON OAuth."
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        return False, f"APPS_SCRIPT_OAUTH_TOKEN no es JSON valido: {exc}"
    for key in ("token", "refresh_token", "client_id"):
        if key not in data:
            return False, f"Falta campo '{key}' en APPS_SCRIPT_OAUTH_TOKEN."
    return True, "token OAuth válido"


def check_ci_apps_script_secrets() -> tuple[bool, str]:
    import os

    ok_oauth, msg_oauth = validate_oauth_token_json(os.environ.get("APPS_SCRIPT_OAUTH_TOKEN", ""))
    if not ok_oauth:
        return False, msg_oauth

    script_id = os.environ.get("APPS_SCRIPT_ID", "").strip()
    if not script_id:
        return False, "Falta APPS_SCRIPT_ID."

    sheets = os.environ.get("SHEETS_WEB_APP_URL", "").strip()
    if not sheets or "/exec" not in sheets:
        return False, "Falta SHEETS_WEB_APP_URL (debe terminar en /exec)."

    return True, f"Apps Script CI OK — script {script_id[:12]}…"




def print_gh_secret_commands() -> None:
    sa = FIREBASE_HOSTING_SA
    url = read_web_app_url() or read_env_var("SHEETS_WEB_APP_URL")
    print()
    info("Comandos manuales (PowerShell):")
    print(f"  Get-Content -Raw -Encoding UTF8 '{sa}' | gh secret set FIREBASE_SERVICE_ACCOUNT")
    if url:
        print(f"  gh secret set SHEETS_WEB_APP_URL --body '{url}'")
    else:
        print("  # Opcional: gh secret set SHEETS_WEB_APP_URL --body 'https://script.google.com/.../exec'")
    print('  gh workflow run "Deploy Firebase Hosting"')
    print()

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Valida secretos y requisitos de CI.")
    parser.add_argument("--fix-hint", action="store_true", help="Mostrar comandos de corrección al final.")
    parser.add_argument(
        "--print-commands",
        action="store_true",
        help="Muestra comandos gh secret set (modo local).",
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="Modo GitHub Actions: valida secretos Firebase desde variables de entorno.",
    )
    parser.add_argument(
        "--ci-apps-script",
        action="store_true",
        help="Modo GitHub Actions: valida secretos Apps Script (OAuth + script ID + URL).",
    )
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    load_dotenv()
    args = parse_args()

    if args.print_commands and not args.ci:
        print_gh_secret_commands()

    if args.ci:
        print("=== validate_ci_secrets.py (CI Firebase) ===\n")
        ok_ci, detail = check_ci_env_secrets()
        if ok_ci:
            ok(detail)
            return 0
        error(detail)
        print()
        info("Regenera la clave en Firebase Console y ejecuta:")
        print("  py tools/setup_github_ci.py")
        return 1

    if args.ci_apps_script:
        print("=== validate_ci_secrets.py (CI Apps Script) ===\n")
        ok_ci, detail = check_ci_apps_script_secrets()
        if ok_ci:
            ok(detail)
            return 0
        error(detail)
        print()
        info("Configura secretos con:")
        print("  py tools/setup_github_ci.py --apps-script")
        return 1

    print("=== validate_ci_secrets.py ===\n")

    checks: list[tuple[str, bool, str]] = []

    ok_gh, msg_gh = check_gh()
    checks.append(("GitHub CLI", ok_gh, msg_gh))

    ok_sa, msg_sa = check_local_firebase_sa()
    checks.append(("SA Firebase local", ok_sa, msg_sa))

    ok_url, msg_url = check_sheets_url()
    checks.append(("SHEETS_WEB_APP_URL (opcional)", ok_url, msg_url))

    ok_remote, msg_remote = check_github_secrets()
    checks.append(("Secretos en GitHub", ok_remote, msg_remote))

    failures: list[str] = []
    warnings: list[str] = []
    for name, passed, detail in checks:
        optional = "(opcional)" in name
        if passed:
            status = "OK"
        elif optional:
            status = "AVISO"
        else:
            status = "FAIL"
        print(f"  [{status}] {name}")
        print(f"         {detail}")
        if not passed:
            if optional:
                warnings.append(f"{name}: {detail}")
            else:
                failures.append(f"{name}: {detail}")

    print()
    for w in warnings:
        warn(w)

    if failures:
        error(f"{len(failures)} comprobación(es) fallaron.")
        print_fix_hints(failures)
        return 1

    ok("CI listo — FIREBASE_SERVICE_ACCOUNT configurado.")
    if warnings:
        info("Opcional: configura SHEETS_WEB_APP_URL para formularios en producción vía CI.")
    info("Relanzar deploy: gh workflow run \"Deploy Firebase Hosting\"")
    return 0


if __name__ == "__main__":
    sys.exit(main())
