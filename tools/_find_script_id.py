#!/usr/bin/env python3
"""Descubre APPS_SCRIPT_ID vinculado a GOOGLE_SHEET_ID (Drive API + OAuth clasp)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

from setup_admin import (  # noqa: E402
    ENV_PATH,
    get_oauth_credentials,
    read_env,
    update_env_var,
)


def find_script_id_for_sheet(sheet_id: str) -> str:
    from googleapiclient.discovery import build

    creds = get_oauth_credentials()
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    q = (
        f"'{sheet_id}' in parents and "
        "mimeType='application/vnd.google-apps.script'"
    )
    resp = drive.files().list(q=q, fields="files(id,name)", pageSize=10).execute()
    files = resp.get("files", [])
    if not files:
        resp = drive.files().list(
            q="mimeType='application/vnd.google-apps.script'",
            fields="files(id,name,parents)",
            pageSize=50,
        ).execute()
        for f in resp.get("files", []):
            if sheet_id in json.dumps(f):
                return f["id"]
        return ""
    if len(files) == 1:
        return files[0]["id"]
    preferred = ("inscripc", "switch", "feria", "sucursal", "cafe")
    for f in files:
        if any(p in f.get("name", "").lower() for p in preferred):
            return f["id"]
    return files[0]["id"]


def main() -> int:
    env = read_env()
    sheet_id = env.get("GOOGLE_SHEET_ID", "").strip()
    if not sheet_id:
        print("[ERROR] Falta GOOGLE_SHEET_ID en tools/.env", file=sys.stderr)
        return 1
    script_id = find_script_id_for_sheet(sheet_id)
    if not script_id:
        print("[ERROR] No se encontró script vinculado a la hoja.", file=sys.stderr)
        print(f"Hoja: https://docs.google.com/spreadsheets/d/{sheet_id}/edit", file=sys.stderr)
        return 2
    update_env_var("APPS_SCRIPT_ID", script_id)
    print(script_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
