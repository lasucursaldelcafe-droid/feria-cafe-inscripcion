#!/usr/bin/env python3
"""
Configuración automática del ecosistema Feria Café para agentes Cloud y PC local.

Detecta credenciales en tools/credentials/, genera tools/.env, sincroniza
secretos GitHub (si gh tiene permiso) y ejecuta el pipeline de mantenimiento.

Uso:
  python3 tools/agent_setup_completo.py              # Auditoría + lo que se pueda aplicar
  python3 tools/agent_setup_completo.py --aplicar    # Bootstrap .env + CI + verificar
  python3 tools/agent_setup_completo.py --solo-env   # Solo crear/actualizar tools/.env
  python3 tools/agent_setup_completo.py --solo-ci    # Solo secretos GitHub Actions
  python3 tools/agent_setup_completo.py --cloud      # Sin archivos locales: dispara CI

Coloca credenciales (no versionar) en tools/credentials/:
  firebase-hosting-sa.json      → deploy Firebase + secretos CI
  feria-sheets-sa.json          → crear/verificar hoja Sheets
  .oauth-script-token.json      → deploy Apps Script desde CI
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from _util import (
    DEFAULT_FIREBASE_PROJECT,
    PROJECT_ROOT,
    SHEETS_CONFIG_PATH,
    TOOLS_DIR,
    error,
    info,
    load_dotenv,
    ok,
    read_web_app_url,
    warn,
    write_sheets_config,
)

CREDENTIALS_DIR = TOOLS_DIR / "credentials"
ENV_PATH = TOOLS_DIR / ".env"
ENV_EXAMPLE = TOOLS_DIR / ".env.example"
CANONICAL_URL = TOOLS_DIR / "CANONICAL_SHEETS_URL.txt"

KNOWN_CREDENTIALS = {
    "firebase-hosting-sa.json": "FIREBASE_SERVICE_ACCOUNT_JSON",
    "feria-sheets-sa.json": "GOOGLE_SERVICE_ACCOUNT_JSON",
    ".oauth-script-token.json": "OAUTH_SCRIPT_TOKEN_PATH",
}


def read_canonical_url() -> str:
    if CANONICAL_URL.is_file():
        return CANONICAL_URL.read_text(encoding="utf-8").strip()
    return ""


def read_env_lines() -> dict[str, str]:
    if not ENV_PATH.is_file():
        return {}
    out: dict[str, str] = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def write_env(updates: dict[str, str]) -> None:
    current = read_env_lines()
    current.update({k: v for k, v in updates.items() if v})

    if not ENV_PATH.is_file() and ENV_EXAMPLE.is_file():
        base = ENV_EXAMPLE.read_text(encoding="utf-8")
    else:
        base = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.is_file() else ""

    lines: list[str] = []
    seen: set[str] = set()
    for line in base.splitlines():
        stripped = line.strip()
        if stripped.startswith("#") or "=" not in stripped:
            lines.append(line)
            continue
        key = stripped.partition("=")[0].strip()
        if key in current:
            lines.append(f"{key}={current[key]}")
            seen.add(key)
        else:
            lines.append(line)

    for key, value in current.items():
        if key not in seen:
            lines.append(f"{key}={value}")

    ENV_PATH.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    ok(f"Actualizado {ENV_PATH}")


def audit_credentials() -> dict[str, bool]:
    report: dict[str, bool] = {}
    for filename in KNOWN_CREDENTIALS:
        path = CREDENTIALS_DIR / filename
        report[filename] = path.is_file() and path.stat().st_size > 10
    report["tools/.env"] = ENV_PATH.is_file()
    report["js/sheets-config.js"] = SHEETS_CONFIG_PATH.is_file()
    return report


def print_audit(report: dict[str, bool]) -> None:
    print("\n=== Auditoría de credenciales ===")
    for name, present in report.items():
        mark = "OK" if present else "FALTA"
        print(f"  [{mark}] {name}")
    url = read_canonical_url() or read_web_app_url()
    if url:
        print(f"  [OK] URL Apps Script: {url[:55]}…")
    else:
        print("  [FALTA] URL Apps Script (/exec)")


def bootstrap_env() -> bool:
    updates: dict[str, str] = {
        "FIREBASE_PROJECT": DEFAULT_FIREBASE_PROJECT,
        "ALLOWED_ADMIN_EMAIL": "lasucursaldelcafe@gmail.com",
        "GOOGLE_WALLET_ISSUER_ID": "3388000000023162431",
    }

    url = read_canonical_url() or read_web_app_url()
    if url:
        updates["SHEETS_WEB_APP_URL"] = url
        updates["APPS_SCRIPT_URL"] = url

    firebase_sa = CREDENTIALS_DIR / "firebase-hosting-sa.json"
    if firebase_sa.is_file():
        updates["FIREBASE_SERVICE_ACCOUNT_JSON"] = str(firebase_sa.resolve())

    sheets_sa = CREDENTIALS_DIR / "feria-sheets-sa.json"
    if sheets_sa.is_file():
        updates["GOOGLE_SERVICE_ACCOUNT_JSON"] = str(sheets_sa.resolve())

    existing = read_env_lines()
    for key in ("GOOGLE_SHEET_ID", "APPS_SCRIPT_ID"):
        if existing.get(key):
            updates[key] = existing[key]

    write_env(updates)

    if url:
        write_sheets_config(url)
        ok(f"sheets-config.js ← {url[:50]}…")

    return True


def run_script(script: str, args: list[str] | None = None, *, required: bool = False) -> int:
    cmd = [sys.executable, f"tools/{script}", *(args or [])]
    info("→ " + " ".join(cmd))
    rc = subprocess.run(cmd, cwd=str(PROJECT_ROOT)).returncode
    if rc != 0 and required:
        error(f"{script} falló ({rc})")
    return rc


def trigger_cloud_workflows() -> None:
    if not shutil_which("gh"):
        warn("Sin gh CLI — omite disparo de workflows.")
        return

    workflows = [
        "Actualizar todo",
        "Verificar sitio",
    ]
    for name in workflows:
        info(f"Disparando workflow «{name}»…")
        result = subprocess.run(
            ["gh", "workflow", "run", name],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            warn(f"No se pudo lanzar «{name}» (¿permisos del token?).")
            if result.stderr:
                info(result.stderr.strip()[:200])
        else:
            ok(f"Workflow «{name}» lanzado.")


def shutil_which(cmd: str) -> str | None:
    from shutil import which

    return which(cmd)


def apply_pipeline(*, cloud: bool = False) -> int:
    bootstrap_env()

    if cloud:
        trigger_cloud_workflows()
        run_script("verificar_todo.py", ["--solo-web"])
        run_script("verify_admin.py")
        return 0

    failed = False

    if (CREDENTIALS_DIR / "firebase-hosting-sa.json").is_file():
        if run_script("setup_github_ci.py") != 0:
            warn("Secretos GitHub no sincronizados (¿gh sin permiso admin?).")
            failed = True
    else:
        warn("Sin firebase-hosting-sa.json — secretos CI no actualizados desde local.")

    oauth = CREDENTIALS_DIR / ".oauth-script-token.json"
    if oauth.is_file():
        run_script("setup_github_ci.py", ["--apps-script"])
    else:
        warn("Sin .oauth-script-token.json — deploy Apps Script en CI seguirá omitido.")
        info("  Genera el token: python3 tools/setup_admin.py --sin-firebase (requiere navegador).")

    run_script("conectar_sheets.py", ["--verificar"], required=False)
    run_script("verify_admin.py", required=False)
    run_script("verificar_todo.py", required=False)

    if (CREDENTIALS_DIR / "firebase-hosting-sa.json").is_file():
        run_script("deploy_firebase.py", required=False)

    return 1 if failed else 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Setup automático credenciales + CI Feria Café.")
    parser.add_argument("--aplicar", action="store_true", help="Bootstrap .env y ejecutar pipeline.")
    parser.add_argument("--solo-env", action="store_true", help="Solo generar tools/.env.")
    parser.add_argument("--solo-ci", action="store_true", help="Solo setup_github_ci.py.")
    parser.add_argument("--cloud", action="store_true", help="Modo cloud: sin SA local, dispara GitHub Actions.")
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    load_dotenv()
    args = parse_args()

    print("=== agent_setup_completo.py — Feria Café ===\n")
    report = audit_credentials()
    print_audit(report)

    if args.solo_env:
        bootstrap_env()
        return 0

    if args.solo_ci:
        return run_script("setup_github_ci.py", ["--run-workflow"])

    if args.aplicar or args.cloud:
        return apply_pipeline(cloud=args.cloud)

    print()
    info("Modo auditoría. Para aplicar:")
    print("  python3 tools/agent_setup_completo.py --aplicar")
    print("  python3 tools/agent_setup_completo.py --cloud   # solo CI remoto")
    print()
    info("Coloca JSON en tools/credentials/ y vuelve a ejecutar --aplicar.")
    info("Guía: docs/CREDENCIALES-AGENTE.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
