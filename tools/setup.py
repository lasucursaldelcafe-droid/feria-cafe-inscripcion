#!/usr/bin/env python3
"""
Orquestador: Google Sheets + Firebase Hosting.

Ejemplos (PowerShell):
  py tools/setup.py --all
  py tools/setup.py --sheets-only --share-with tu@gmail.com
  py tools/setup.py --firebase-only --token TU_TOKEN
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parent

ENV_EXAMPLE = """# Copia este archivo como tools/.env y completa los valores.
# NO subas tools/.env al repositorio.

# Google Sheets (cuenta de servicio)
GOOGLE_SERVICE_ACCOUNT_JSON=C:\\ruta\\a\\service-account.json
GOOGLE_SHEET_ID=
SHARE_SHEET_WITH=tu-correo@gmail.com

# URL de Apps Script Web App (termina en /exec)
SHEETS_WEB_APP_URL=

# Firebase Hosting
FIREBASE_PROJECT=la-sucursal-del-cafe
FIREBASE_TOKEN=
FIREBASE_SERVICE_ACCOUNT_JSON=
"""


def find_python() -> list[str]:
    """Devuelve el ejecutable de Python a usar (python, py -3, python3)."""
    for candidate in (["python"], ["py", "-3"], ["python3"]):
        try:
            subprocess.run(
                candidate + ["--version"],
                capture_output=True,
                check=True,
            )
            return candidate
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    return []


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def write_env_example() -> Path:
    target = TOOLS_DIR / ".env.example"
    target.write_text(ENV_EXAMPLE, encoding="utf-8")
    return target


def run_script(python: list[str], script: str, extra_args: list[str]) -> int:
    cmd = python + [str(TOOLS_DIR / script)] + extra_args
    print(f"\n>>> {' '.join(cmd)}\n")
    result = subprocess.run(cmd, cwd=str(PROJECT_ROOT))
    return result.returncode


def build_sheets_args(args: argparse.Namespace) -> list[str]:
    out: list[str] = []
    creds = args.credentials or os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if creds:
        out += ["--credentials", creds]
    sheet_id = args.sheet_id or os.environ.get("GOOGLE_SHEET_ID")
    if sheet_id:
        out += ["--sheet-id", sheet_id]
    share = args.share_with or os.environ.get("SHARE_SHEET_WITH")
    if share:
        out += ["--share-with", share]
    web_url = args.web_app_url or os.environ.get("SHEETS_WEB_APP_URL")
    if web_url:
        out += ["--web-app-url", web_url]
    if args.dry_run:
        out.append("--dry-run")
    return out


def build_firebase_args(args: argparse.Namespace) -> list[str]:
    out: list[str] = []
    project = args.project or os.environ.get("FIREBASE_PROJECT", "la-sucursal-del-cafe")
    out += ["--project", project]
    token = args.token or os.environ.get("FIREBASE_TOKEN")
    if token:
        out += ["--token", token]
    sa = args.service_account or os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa:
        out += ["--service-account", sa]
    if args.dry_run:
        out.append("--dry-run")
    return out


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Automatización Feria-Cafe-Inscripcion.")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--all", action="store_true", help="Sheets + Firebase en secuencia")
    mode.add_argument("--sheets-only", action="store_true", help="Solo Google Sheets")
    mode.add_argument("--firebase-only", action="store_true", help="Solo Firebase Hosting")
    mode.add_argument("--init", action="store_true", help="Genera tools/.env.example")

    parser.add_argument("--credentials", help="JSON cuenta de servicio Google Sheets")
    parser.add_argument("--sheet-id", help="ID de hoja existente")
    parser.add_argument("--share-with", help="Correo para compartir la hoja")
    parser.add_argument("--web-app-url", help="URL /exec de Apps Script")
    parser.add_argument("--project", default="la-sucursal-del-cafe")
    parser.add_argument("--token", help="Token firebase login:ci")
    parser.add_argument("--service-account", help="JSON cuenta de servicio Firebase")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    example_path = write_env_example()
    print(f"[OK] Plantilla generada: {example_path}")

    load_dotenv(TOOLS_DIR / ".env")

    if args.init and not (args.all or args.sheets_only or args.firebase_only):
        print("[INFO] Copia tools/.env.example a tools/.env y completa los valores.")
        return 0

    if not (args.all or args.sheets_only or args.firebase_only):
        print("[ERROR] Indica --all, --sheets-only, --firebase-only o --init")
        return 1

    python = find_python()
    if not python:
        print(
            "[ERROR] Python no encontrado.\n"
            "  Instala desde https://www.python.org/downloads/\n"
            "  O ejecuta: py -3 tools/setup.py --all"
        )
        return 127

    print(f"[INFO] Usando: {' '.join(python)}")

    exit_code = 0

    if args.all or args.sheets_only:
        code = run_script(python, "setup_google_sheets.py", build_sheets_args(args))
        if code != 0:
            return code
        exit_code = code
        if args.all:
            print("\n[INFO] Sheets listo. Continuando con Firebase...\n")

    if args.all or args.firebase_only:
        code = run_script(python, "deploy_firebase.py", build_firebase_args(args))
        if code != 0:
            return code
        exit_code = code

    if exit_code == 0:
        print("\n[OK] Automatización completada.")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
