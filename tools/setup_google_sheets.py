#!/usr/bin/env python3
"""
Configura Google Sheets para inscripciones Feria / Competencia.

Requiere cuenta de servicio con APIs de Sheets y Drive habilitadas.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from _util import (
    DEFAULT_FIREBASE_PROJECT,
    HEADERS_COMPETENCIA,
    HEADERS_FERIA,
    PROJECT_ROOT,
    SHEET_COMPETENCIA,
    SHEET_FERIA,
    SPREADSHEET_TITLE,
    error,
    info,
    load_service_account_email,
    ok,
    resolve_credentials,
    warn,
    write_sheets_config,
)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crea o actualiza la hoja de inscripciones en Google Sheets."
    )
    parser.add_argument(
        "--credentials",
        help="Ruta al JSON de cuenta de servicio (alternativa: GOOGLE_SERVICE_ACCOUNT_JSON)",
    )
    parser.add_argument(
        "--sheet-id",
        help="ID de hoja existente. Si se omite, se crea una nueva.",
    )
    parser.add_argument(
        "--share-with",
        help="Correo de Google (ej. tu cuenta) para compartir la hoja como editor.",
    )
    parser.add_argument(
        "--web-app-url",
        help="URL /exec de Apps Script para escribir js/sheets-config.js",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo muestra lo que haría, sin llamar a la API.",
    )
    return parser.parse_args()


def build_services(credentials_path: Path):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_file(
        str(credentials_path),
        scopes=SCOPES,
    )
    sheets = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    drive = build("drive", "v3", credentials=credentials, cache_discovery=False)
    return sheets, drive


def create_spreadsheet(sheets, title: str) -> str:
    body = {
        "properties": {"title": title},
        "sheets": [
            {"properties": {"title": SHEET_FERIA}},
            {"properties": {"title": SHEET_COMPETENCIA}},
        ],
    }
    result = sheets.spreadsheets().create(body=body).execute()
    return result["spreadsheetId"]


def ensure_sheet_tab(sheets, spreadsheet_id: str, title: str) -> None:
    meta = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    names = {s["properties"]["title"] for s in meta.get("sheets", [])}
    if title in names:
        return
    sheets.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": [{"addSheet": {"properties": {"title": title}}}]},
    ).execute()


def write_headers(sheets, spreadsheet_id: str, tab: str, headers: list[str]) -> None:
    sheets.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f"'{tab}'!A1",
        valueInputOption="RAW",
        body={"values": [headers]},
    ).execute()

    meta = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_id = None
    for sheet in meta.get("sheets", []):
        if sheet["properties"]["title"] == tab:
            sheet_id = sheet["properties"]["sheetId"]
            break
    if sheet_id is None:
        return

    sheets.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={
            "requests": [
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": sheet_id,
                            "startRowIndex": 0,
                            "endRowIndex": 1,
                        },
                        "cell": {
                            "userEnteredFormat": {"textFormat": {"bold": True}}
                        },
                        "fields": "userEnteredFormat.textFormat.bold",
                    }
                },
                {
                    "updateSheetProperties": {
                        "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
                        "fields": "gridProperties.frozenRowCount",
                    }
                },
            ]
        },
    ).execute()


def share_spreadsheet(drive, spreadsheet_id: str, email: str) -> None:
    drive.permissions().create(
        fileId=spreadsheet_id,
        body={"type": "user", "role": "writer", "emailAddress": email},
        sendNotificationEmail=False,
    ).execute()


def print_next_steps(service_email: str, spreadsheet_id: str, web_app_url: str | None) -> None:
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"
    ok(f"Hoja lista: {url}")
    info(f"ID de la hoja: {spreadsheet_id}")
    print()
    info("Pasos manuales restantes (Apps Script):")
    print("  1. Abre la hoja con tu cuenta de Google (debe tener acceso de editor).")
    print("  2. Extensiones → Apps Script.")
    print(f"  3. Pega el código de: {PROJECT_ROOT / 'tools' / 'google-apps-script' / 'Code.gs'}")
    print("  4. Implementar → Nueva implementación → Aplicación web")
    print("     Ejecutar como: Yo | Acceso: Cualquier persona")
    print("  5. Copia la URL /exec y vuelve a ejecutar este script con --web-app-url")
    print("     o edita js/sheets-config.js manualmente.")
    print()
    info(f"Cuenta de servicio usada: {service_email}")
    warn(
        "La hoja creada por la cuenta de servicio solo es visible para cuentas "
        "con las que se compartió. Usa --share-with tu-correo@gmail.com"
    )
    if not web_app_url:
        warn("WEB_APP_URL no configurada aún. Los formularios usarán localStorage como respaldo.")
    print()
    info(f"Proyecto Firebase asociado al sitio: {DEFAULT_FIREBASE_PROJECT}")


def main() -> int:
    args = parse_args()

    try:
        if args.dry_run:
            ok("Modo dry-run: no se contactará la API de Google.")
            if args.sheet_id:
                info(f"Se usaría la hoja existente: {args.sheet_id}")
            else:
                info(f"Se crearía: {SPREADSHEET_TITLE}")
            info(f"Pestañas: {SHEET_FERIA}, {SHEET_COMPETENCIA}")
            return 0

        credentials_path = resolve_credentials(args.credentials)
        service_email = load_service_account_email(credentials_path)
        info(f"Credenciales: {credentials_path}")
        info(f"Cuenta de servicio: {service_email}")

        sheets, drive = build_services(credentials_path)

        if args.sheet_id:
            spreadsheet_id = args.sheet_id.strip()
            info(f"Usando hoja existente: {spreadsheet_id}")
        else:
            info(f"Creando hoja: {SPREADSHEET_TITLE}")
            spreadsheet_id = create_spreadsheet(sheets, SPREADSHEET_TITLE)
            ok("Hoja creada.")

        ensure_sheet_tab(sheets, spreadsheet_id, SHEET_FERIA)
        ensure_sheet_tab(sheets, spreadsheet_id, SHEET_COMPETENCIA)

        write_headers(sheets, spreadsheet_id, SHEET_FERIA, HEADERS_FERIA)
        write_headers(sheets, spreadsheet_id, SHEET_COMPETENCIA, HEADERS_COMPETENCIA)
        ok("Encabezados configurados en Feria y Competencia.")

        if args.share_with:
            share_spreadsheet(drive, spreadsheet_id, args.share_with.strip())
            ok(f"Hoja compartida con: {args.share_with.strip()}")

        if args.web_app_url:
            url = args.web_app_url.strip()
            if not url.endswith("/exec"):
                warn("La URL debería terminar en /exec (Apps Script Web App).")
            config_path = write_sheets_config(url)
            ok(f"Configuración escrita en: {config_path}")

        print_next_steps(service_email, spreadsheet_id, args.web_app_url)
        return 0

    except FileNotFoundError as exc:
        error(str(exc))
        return 2
    except Exception as exc:  # noqa: BLE001 — script CLI
        name = exc.__class__.__name__
        if name == "ModuleNotFoundError":
            error(str(exc))
            info("Instala dependencias: py -3 -m pip install -r tools/requirements.txt")
            return 4
        if name == "HttpError":
            error(f"Error de Google API: {exc}")
            info("Verifica que Sheets API y Drive API estén habilitadas en Google Cloud.")
            return 3
        error(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
