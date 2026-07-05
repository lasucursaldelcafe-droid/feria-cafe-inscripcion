#!/usr/bin/env python3
"""
Punto de entrada unificado para el ecosistema Google de Feria Café.

Orquesta Sheets, Apps Script, secretos CI y Firebase Hosting según el escenario.

Uso:
  py tools/automatizar_google.py inicial          # Primera vez (SA + hoja + Apps Script)
  py tools/automatizar_google.py mantenimiento    # Release: Apps Script + CI + Firebase
  py tools/automatizar_google.py apps-script      # Solo subir Code.gs y redeploy Web App
  py tools/automatizar_google.py sheets           # Solo crear/verificar hoja
  py tools/automatizar_google.py ci               # Secretos GitHub Actions
  py tools/automatizar_google.py verificar        # Health checks completos
  py tools/automatizar_google.py sin-sa           # Sin cuenta de servicio GCP
  py tools/automatizar_google.py urls             # Abrir consolas útiles
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from _util import PROJECT_ROOT, TOOLS_DIR, error, info, ok

SCRIPTS: dict[str, list[str]] = {
    "inicial": ["automatizar_todo.py", "--todo"],
    "mantenimiento": ["automatizar_manual.py", "--todo"],
    "apps-script": ["automatizar_manual.py", "--apps-script"],
    "sheets": ["automatizar_todo.py", "--solo-sheets"],
    "ci": ["automatizar_manual.py", "--ci"],
    "deploy": ["automatizar_manual.py", "--deploy"],
    "release": ["agent_release.py", "release"],
    "verificar": ["automatizar_manual.py", "--verificar"],
    "sin-sa": ["automatizar_todo.py", "--sin-cuenta-servicio"],
    "urls": ["automatizar_manual.py", "--abrir-urls"],
}

DOCS = TOOLS_DIR / "GOOGLE-ECOSISTEMA.md"


def run_mode(mode: str, extra: list[str]) -> int:
    script_args = SCRIPTS[mode]
    cmd = [sys.executable, f"tools/{script_args[0]}", *script_args[1:], *extra]
    info("Ejecutando: " + " ".join(cmd))
    return subprocess.run(cmd, cwd=str(PROJECT_ROOT)).returncode


def print_help_table() -> None:
    print()
    info("Comandos disponibles:")
    rows = [
        ("inicial", "Primera configuración: SA + hoja + Apps Script + (opc.) Firebase"),
        ("mantenimiento", "Antes de un release: Apps Script + sheets-config + CI + Firebase"),
        ("apps-script", "Subir Code.gs y redeploy Web App"),
        ("sheets", "Crear o actualizar hoja de inscripciones"),
        ("ci", "Sincronizar secretos GitHub Actions"),
        ("deploy", "Solo Firebase Hosting"),
        ("release", "Agente Cloud: merge PR + deploy + verify (pasa args tras --)"),
        ("verificar", "Comprobar endpoints y configuración"),
        ("sin-sa", "Configurar sin JSON de cuenta de servicio GCP"),
        ("urls", "Abrir consolas Google/Firebase/GitHub en el navegador"),
    ]
    for name, desc in rows:
        print(f"  {name:<16} {desc}")
    print()
    info(f"Documentación: {DOCS}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Orquestador unificado del ecosistema Google (Sheets + Apps Script + CI).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ejemplos:\n"
            "  py tools/automatizar_google.py mantenimiento\n"
            "  py tools/automatizar_google.py apps-script\n"
            "  py tools/automatizar_google.py ci -- --run-workflow\n"
        ),
    )
    parser.add_argument(
        "modo",
        nargs="?",
        choices=[*SCRIPTS.keys(), "help"],
        help="Escenario a ejecutar (omitir para ver la tabla).",
    )
    parser.add_argument(
        "extra",
        nargs=argparse.REMAINDER,
        help="Argumentos extra pasados al script subyacente (tras --).",
    )
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()
    extra = [a for a in args.extra if a != "--"]

    print("=== automatizar_google.py — Ecosistema Google ===\n")

    if not args.modo or args.modo == "help":
        print_help_table()
        return 0

    rc = run_mode(args.modo, extra)
    if rc == 0:
        ok(f"Modo «{args.modo}» completado.")
    else:
        error(f"Modo «{args.modo}» terminó con código {rc}.")
        info(f"Consulta {DOCS} o ejecuta: py tools/automatizar_google.py verificar")
    return rc


if __name__ == "__main__":
    sys.exit(main())
