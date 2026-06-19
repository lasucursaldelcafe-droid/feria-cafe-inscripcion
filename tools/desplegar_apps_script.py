#!/usr/bin/env python3
"""
Despliega Code.gs con clasp (requiere: npx @google/clasp + clasp login).

Uso:
  py tools/desplegar_apps_script.py --sheet-id ID_DE_LA_HOJA
  py tools/desplegar_apps_script.py --script-id ID_SCRIPT_EXISTENTE
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from _util import CODE_GS_PATH, TOOLS_DIR, error, info, load_dotenv, ok, warn

GAS_DIR = TOOLS_DIR / "google-apps-script"
CLASP_JSON = GAS_DIR / ".clasp.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Despliega Apps Script con clasp.")
    parser.add_argument("--sheet-id", help="ID de la hoja (crea script vinculado si no hay .clasp.json)")
    parser.add_argument("--script-id", help="ID de proyecto Apps Script existente")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def clasp_available() -> bool:
    if not shutil.which("node"):
        return False
    try:
        subprocess.run(
            ["npx", "-y", "@google/clasp", "--version"],
            capture_output=True,
            check=True,
            timeout=120,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


def clasp_logged_in() -> bool:
    return (Path.home() / ".clasprc.json").is_file()


def run_clasp(args: list[str], *, dry_run: bool = False) -> None:
    cmd = ["npx", "-y", "@google/clasp", *args]
    display = " ".join(cmd)
    if dry_run:
        info(f"[dry-run] {display}")
        return
    info(f"Ejecutando: {display}")
    subprocess.run(cmd, cwd=str(GAS_DIR), check=True)


def write_clasp_json(script_id: str) -> None:
    CLASP_JSON.write_text(
        json.dumps({"scriptId": script_id, "rootDir": "."}, indent=2) + "\n",
        encoding="utf-8",
    )


def ensure_code_gs() -> None:
    if not CODE_GS_PATH.is_file():
        raise FileNotFoundError(f"No existe {CODE_GS_PATH}")


def cmd_deploy(args: argparse.Namespace) -> int:
    if not shutil.which("node"):
        error("Node.js no esta instalado. Descarga desde https://nodejs.org/")
        return 2

    if not clasp_available():
        error("No se pudo ejecutar clasp via npx.")
        return 2

    if not clasp_logged_in():
        error("clasp no esta autenticado.")
        info("Ejecuta una vez: npx -y @google/clasp login")
        info("Luego repite este script.")
        return 3

    ensure_code_gs()
    load_dotenv()

    sheet_id = (args.sheet_id or os.environ.get("GOOGLE_SHEET_ID", "")).strip()
    script_id = (args.script_id or "").strip()

    if CLASP_JSON.is_file() and not script_id:
        data = json.loads(CLASP_JSON.read_text(encoding="utf-8"))
        script_id = data.get("scriptId", "")

    if args.dry_run:
        ok("Modo dry-run.")
        info(f"Directorio Apps Script: {GAS_DIR}")
        if script_id:
            info(f"Usaria scriptId: {script_id}")
        elif sheet_id:
            info(f"Crearia script vinculado a hoja: {sheet_id}")
        else:
            warn("Indica --sheet-id o --script-id")
        return 0

    if not script_id:
        if not sheet_id:
            error("Indica --sheet-id (desde tools/.env GOOGLE_SHEET_ID) o --script-id.")
            return 1
        info("Creando proyecto Apps Script vinculado a la hoja...")
        run_clasp(["create", "--type", "sheets", "--title", "Inscripciones API", "--parentId", sheet_id])
        if not CLASP_JSON.is_file():
            error("clasp create no genero .clasp.json")
            return 4
        script_id = json.loads(CLASP_JSON.read_text(encoding="utf-8")).get("scriptId", "")
    else:
        write_clasp_json(script_id)

    info("Subiendo Code.gs...")
    run_clasp(["push", "--force"])

    info("Creando implementacion...")
    result = subprocess.run(
        ["npx", "-y", "@google/clasp", "deploy", "--description", "Web App inscripciones"],
        cwd=str(GAS_DIR),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        warn("clasp deploy fallo; despliega manualmente en script.google.com")
        if result.stderr:
            info(result.stderr[:500])
        info(f"Editor: https://script.google.com/home/projects/{script_id}/edit")
        info("Implementar > Nueva implementacion > Aplicacion web > Cualquier persona")
        return 5

    deployment_id = ""
    for line in (result.stdout or "").splitlines():
        if "Deployed" in line and "@" in line:
            deployment_id = line.split("@")[-1].strip()
            break

    if deployment_id:
        web_url = f"https://script.google.com/macros/s/{deployment_id}/exec"
        ok(f"URL Web App: {web_url}")
        info(f'Configura: py tools/conectar_sheets.py --configurar-url "{web_url}"')
    else:
        warn("Implementacion creada pero no se detecto deployment ID en la salida.")
        info(f"Abre https://script.google.com/home/projects/{script_id}/edit y copia la URL /exec")

    return 0


def main() -> int:
    return cmd_deploy(parse_args())


if __name__ == "__main__":
    sys.exit(main())
