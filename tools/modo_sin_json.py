#!/usr/bin/env python3
"""
Configura Google Sheets + Apps Script sin cuenta de servicio (sin JSON de GCP).

Para usuarios con política organizacional que bloquea iam.disableServiceAccountKeyCreation.

Uso:
  py tools/modo_sin_json.py
  py tools/modo_sin_json.py --solo-encabezados
  py tools/modo_sin_json.py --url "https://script.google.com/macros/s/.../exec"
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import webbrowser
from pathlib import Path

from _util import (
    CODE_GS_PATH,
    HEADERS_COMPETENCIA,
    HEADERS_FERIA,
    PROJECT_ROOT,
    SHEET_COMPETENCIA,
    SHEET_FERIA,
    SPREADSHEET_TITLE,
    error,
    info,
    load_dotenv,
    ok,
    warn,
    write_sheets_config,
)

PLANTILLA_PATH = Path(__file__).resolve().parent / "PLANTILLA-ENCABEZADOS.json"
SHEETS_NEW = "https://sheets.new"


def prompt_input(message: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    try:
        raw = input(f"{message}{suffix}: ").strip()
    except EOFError:
        raw = ""
    return raw or default


def print_banner(title: str) -> None:
    print()
    print("=" * 60)
    print(title)
    print("=" * 60)


def headers_as_tsv(headers: list[str]) -> str:
    return "\t".join(headers)


def step_open_sheet() -> None:
    print_banner("Paso 1 — Crear la hoja de cálculo")
    info("No se usa cuenta de servicio: crearás la hoja con tu cuenta de Google.")
    print()
    print(f"  1. Abre {SHEETS_NEW} (se abrirá en el navegador).")
    print(f"  2. Renombra el libro a: {SPREADSHEET_TITLE}")
    print(f"  3. Renombra la primera pestaña a: {SHEET_FERIA}")
    print(f"  4. Añade una pestaña nueva llamada: {SHEET_COMPETENCIA}")
    print()
    info(f"Referencia de encabezados: {PLANTILLA_PATH}")
    webbrowser.open(SHEETS_NEW)
    prompt_input("Pulsa Enter cuando hayas creado las dos pestañas", "")


def step_paste_headers() -> None:
    print_banner("Paso 2 — Pegar encabezados (fila 1)")
    print()
    info(f"Pestaña {SHEET_FERIA} — selecciona celda A1 y pega esta fila:")
    print()
    print(headers_as_tsv(HEADERS_FERIA))
    print()
    print(f"  ({len(HEADERS_FERIA)} columnas)")
    print()
    info(f"Pestaña {SHEET_COMPETENCIA} — selecciona celda A1 y pega esta fila:")
    print()
    print(headers_as_tsv(HEADERS_COMPETENCIA))
    print()
    print(f"  ({len(HEADERS_COMPETENCIA)} columnas)")
    print()
    warn("Tip: copia la línea completa de arriba; Sheets separará en columnas automáticamente.")
    prompt_input("Pulsa Enter cuando hayas pegado ambas filas de encabezados", "")


def step_apps_script() -> None:
    print_banner("Paso 3 — Desplegar Apps Script")
    print()
    print("  1. En tu hoja: Extensiones → Apps Script")
    print("  2. Borra el contenido por defecto del editor")
    print(f"  3. Abre y copia TODO el archivo:\n     {CODE_GS_PATH}")
    print("  4. Pégalo en el editor de Apps Script y guarda (Ctrl+S)")
    print("  5. Implementar → Nueva implementación")
    print("     • Tipo: Aplicación web")
    print("     • Descripción: Switch Championship inscripciones")
    print("     • Ejecutar como: Yo")
    print("     • Acceso: Cualquier persona")
    print("  6. Implementar → Autoriza permisos (hoja + Drive para comprobantes)")
    print("  7. Copia la URL que termina en /exec")
    print()
    info("Manifiesto opcional (timeZone, webapp): tools/credentials/apps-script-manifest.json")
    print()
    open_editor = prompt_input("¿Abrir la carpeta del Code.gs en el explorador? (s/n)", "n")
    if open_editor.lower().startswith("s"):
        import os

        os.startfile(CODE_GS_PATH.parent)  # noqa: S606 — Windows


def step_configure_url(url: str | None = None) -> str:
    print_banner("Paso 4 — Configurar WEB_APP_URL")
    print()
    entered = (url or "").strip()
    if not entered:
        entered = prompt_input("Pega la URL /exec de Apps Script", "")
    if not entered:
        error("No se indicó URL. Ejecuta de nuevo o usa:")
        info('  py tools/conectar_sheets.py --configurar-url "https://script.google.com/.../exec"')
        return ""

    if "/exec" not in entered:
        warn("La URL debería contener /exec (Web App de Apps Script).")

    config_path = write_sheets_config(entered.strip())
    ok(f"Escrito {config_path}")
    return entered.strip()


def step_verify() -> int:
    print_banner("Paso 5 — Verificar conexión")
    print()
    info("Ejecutando conectar_sheets.py --verificar …")
    result = subprocess.run(
        [sys.executable, "tools/conectar_sheets.py", "--verificar"],
        cwd=str(PROJECT_ROOT),
        check=False,
    )
    if result.returncode == 0:
        ok("Verificación completada.")
        info("Opcional: py tools/conectar_sheets.py --probar-envio")
    else:
        warn("Verificación falló. Revisa permisos de Apps Script y que la URL termine en /exec.")
    return result.returncode


def cmd_solo_encabezados() -> int:
    print_banner("Encabezados — copiar y pegar")
    print()
    info(f"Hoja sugerida: {SPREADSHEET_TITLE}")
    print()
    print(f"## {SHEET_FERIA}")
    print(headers_as_tsv(HEADERS_FERIA))
    print()
    print(f"## {SHEET_COMPETENCIA}")
    print(headers_as_tsv(HEADERS_COMPETENCIA))
    print()
    info(f"JSON de referencia: {PLANTILLA_PATH}")
    return 0


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(
        description="Configura Sheets + Apps Script sin JSON de cuenta de servicio.",
    )
    parser.add_argument(
        "--solo-encabezados",
        action="store_true",
        help="Solo imprime encabezados para copiar (sin guía interactiva).",
    )
    parser.add_argument(
        "--url",
        metavar="URL",
        help="URL /exec de Apps Script (omite el prompt del paso 4).",
    )
    parser.add_argument(
        "--sin-verificar",
        action="store_true",
        help="No ejecuta conectar_sheets.py --verificar al final.",
    )
    args = parser.parse_args()
    load_dotenv()

    if args.solo_encabezados:
        return cmd_solo_encabezados()

    print()
    ok("Modo sin JSON — no se requiere cuenta de servicio de Google Cloud.")
    info("Solo necesitas tu cuenta de Google (Gmail) y acceso a Google Sheets.")
    print()

    step_open_sheet()
    step_paste_headers()
    step_apps_script()
    web_url = step_configure_url(args.url)
    if not web_url:
        return 1

    if args.sin_verificar:
        ok("Configuración guardada. Verifica cuando quieras:")
        info("  py tools/conectar_sheets.py --verificar")
        return 0

    return step_verify()


if __name__ == "__main__":
    sys.exit(main())
