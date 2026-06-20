#!/usr/bin/env python3
"""Registra la URL o ID de una hoja de Google Sheets en tools/.env."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / ".env"
SHEET_ID_RE = re.compile(r"/spreadsheets/d/([a-zA-Z0-9_-]+)")


def extract_sheet_id(value: str) -> str:
    value = value.strip()
    match = SHEET_ID_RE.search(value)
    if match:
        return match.group(1)
    if re.fullmatch(r"[a-zA-Z0-9_-]{20,}", value):
        return value
    raise ValueError(f"No se pudo extraer ID de hoja: {value}")


def update_env(key: str, value: str) -> None:
    lines: list[str] = []
    found = False
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = f"{key}={value}"
            found = True
            break
    if not found:
        lines.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Registra GOOGLE_SHEET_ID en tools/.env")
    parser.add_argument("url_o_id", help="URL de Google Sheets o ID directo")
    args = parser.parse_args()
    try:
        sheet_id = extract_sheet_id(args.url_o_id)
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1
    update_env("GOOGLE_SHEET_ID", sheet_id)
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit"
    print(f"[OK] GOOGLE_SHEET_ID={sheet_id}")
    print(f"[OK] Hoja: {url}")
    print()
    print("Siguiente paso: desplegar Apps Script en esa hoja y configurar la URL /exec:")
    print('  py tools/conectar_sheets.py --configurar-url "https://script.google.com/macros/s/.../exec"')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
