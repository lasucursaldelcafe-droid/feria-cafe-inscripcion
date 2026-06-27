#!/usr/bin/env python3
"""
Conecta los formularios Feria y Competencia con Google Sheets.

Ejemplos (PowerShell):
  py tools/conectar_sheets.py --crear-hoja --share-with tu@gmail.com
  py tools/conectar_sheets.py --configurar-url "https://script.google.com/macros/s/.../exec"
  py tools/conectar_sheets.py --verificar
  py tools/conectar_sheets.py --probar-envio
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

from _util import (
    SHEETS_CONFIG_PATH,
    error,
    info,
    load_dotenv,
    ok,
    print_apps_script_instructions,
    read_web_app_url,
    resolve_credentials,
    warn,
    write_sheets_config,
)
from setup_google_sheets import (
    build_services,
    create_spreadsheet,
    ensure_sheet_tab,
    share_spreadsheet,
    write_headers,
)
from setup_google_sheets import HEADERS_COMPETENCIA, HEADERS_FERIA  # noqa: F401 — re-export
from setup_google_sheets import SHEET_COMPETENCIA, SHEET_FERIA, SPREADSHEET_TITLE
from setup_google_sheets import load_service_account_email


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Conecta formularios web (Feria + Competencia) con Google Sheets.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Flujo recomendado:\n"
            "  1. py tools/conectar_sheets.py --crear-hoja --share-with tu@gmail.com\n"
            "  2. Despliega Apps Script (copia Code.gs) — ver salida del paso 1\n"
            '  3. py tools/conectar_sheets.py --configurar-url "URL/exec"\n'
            "  4. py tools/conectar_sheets.py --verificar\n"
            "  5. py tools/conectar_sheets.py --probar-envio\n"
        ),
    )
    parser.add_argument(
        "--crear-hoja",
        action="store_true",
        help="Crea o actualiza la hoja con pestañas Feria y Competencia y encabezados.",
    )
    parser.add_argument(
        "--verificar",
        action="store_true",
        help="Comprueba js/sheets-config.js y prueba GET/OPTIONS contra la Web App.",
    )
    parser.add_argument(
        "--configurar-url",
        metavar="URL",
        help="Escribe js/sheets-config.js con la URL /exec de Apps Script.",
    )
    parser.add_argument(
        "--probar-envio",
        action="store_true",
        help="Envía filas de prueba a Feria y Competencia vía POST.",
    )
    parser.add_argument(
        "--credentials",
        help="Ruta al JSON de cuenta de servicio (alternativa: GOOGLE_SERVICE_ACCOUNT_JSON).",
    )
    parser.add_argument(
        "--sheet-id",
        help="ID de hoja existente. Si se omite, se crea una nueva.",
    )
    parser.add_argument(
        "--share-with",
        help="Correo de Google para compartir la hoja como editor.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo muestra lo que haría (--crear-hoja), sin llamar a la API.",
    )
    return parser.parse_args()


def http_request(url: str, method: str = "GET", body: dict | None = None) -> tuple[int, str]:
    """Realiza una petición HTTP y devuelve (status, body_text)."""
    data = None
    headers: dict[str, str] = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "text/plain;charset=utf-8"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def cmd_crear_hoja(args: argparse.Namespace) -> int:
    if args.dry_run:
        ok("Modo dry-run: no se contactará la API de Google.")
        if args.sheet_id:
            info(f"Se usaría la hoja existente: {args.sheet_id}")
        else:
            info(f"Se crearía: {SPREADSHEET_TITLE}")
        info(f"Pestañas: {SHEET_FERIA}, {SHEET_COMPETENCIA}")
        info(f"Encabezados Feria ({len(HEADERS_FERIA)}): {', '.join(HEADERS_FERIA)}")
        info(f"Encabezados Competencia ({len(HEADERS_COMPETENCIA)}): {', '.join(HEADERS_COMPETENCIA)}")
        print()
        print_apps_script_instructions(args.sheet_id)
        return 0

    credentials_path = resolve_credentials(args.credentials)
    service_email = load_service_account_email(credentials_path)
    info(f"Credenciales: {credentials_path}")
    info(f"Cuenta de servicio: {service_email}")

    sheets, drive = build_services(credentials_path)

    sheet_id = (args.sheet_id or "").strip() or os.environ.get("GOOGLE_SHEET_ID", "").strip() or None

    if sheet_id:
        info(f"Usando hoja existente: {sheet_id}")
    else:
        info(f"Creando hoja: {SPREADSHEET_TITLE}")
        sheet_id = create_spreadsheet(sheets, SPREADSHEET_TITLE)
        ok("Hoja creada.")

    ensure_sheet_tab(sheets, sheet_id, SHEET_FERIA)
    ensure_sheet_tab(sheets, sheet_id, SHEET_COMPETENCIA)

    write_headers(sheets, sheet_id, SHEET_FERIA, HEADERS_FERIA)
    write_headers(sheets, sheet_id, SHEET_COMPETENCIA, HEADERS_COMPETENCIA)
    ok("Encabezados configurados en Feria y Competencia.")

    share_email = (args.share_with or "").strip() or os.environ.get("SHARE_SHEET_WITH", "").strip()
    if share_email:
        share_spreadsheet(drive, sheet_id, share_email)
        ok(f"Hoja compartida con: {share_email}")

    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit"
    ok(f"Hoja lista: {url}")
    info(f"ID de la hoja (guárdalo en tools/.env como GOOGLE_SHEET_ID): {sheet_id}")
    print()
    print_apps_script_instructions(sheet_id)
    print()
    warn(
        "La hoja creada por la cuenta de servicio solo es visible para cuentas "
        "con las que se compartió. Usa --share-with tu-correo@gmail.com"
    )
    return 0


def cmd_configurar_url(url: str) -> int:
    cleaned = url.strip()
    if not cleaned:
        error("Debes indicar una URL válida.")
        return 1
    if not cleaned.endswith("/exec"):
        warn("La URL debería terminar en /exec (Apps Script Web App).")
    config_path = write_sheets_config(cleaned)
    ok(f"Configuración escrita en: {config_path}")
    info("Siguiente paso: py tools/conectar_sheets.py --verificar")
    return 0


def cmd_verificar() -> int:
    url = read_web_app_url()
    if not url:
        error(f"No hay WEB_APP_URL configurada en {SHEETS_CONFIG_PATH}")
        info('Ejecuta: py tools/conectar_sheets.py --configurar-url "https://script.google.com/.../exec"')
        return 1

    ok(f"URL configurada: {url}")
    info("Probando GET (health check)…")
    status, body = http_request(url, "GET")
    if status != 200:
        error(f"GET falló con HTTP {status}")
        info(body[:500])
        return 2

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        error("La respuesta GET no es JSON válido.")
        info(body[:500])
        return 2

    if not payload.get("ok"):
        error(f"Respuesta inesperada: {payload}")
        return 2
    ok(f"GET OK — formularios soportados: {payload.get('forms', [])}")

    info("Probando GET cupo (contador competencia)…")
    cupo_status, cupo_body = http_request(url + ("&" if "?" in url else "?") + "action=cupo", "GET")
    if cupo_status == 200:
        try:
            cupo_payload = json.loads(cupo_body)
            if cupo_payload.get("ok") and "count" in cupo_payload:
                ok(
                    f"Cupo OK — {cupo_payload.get('count')} de {cupo_payload.get('max')} "
                    f"({cupo_payload.get('disponibles')} disponibles)"
                )
            else:
                warn("GET ?action=cupo no devolvió contador; actualiza Apps Script (Code.gs) y redepliega.")
        except json.JSONDecodeError:
            warn("GET ?action=cupo no devolvió JSON válido; redepliega Apps Script.")
    else:
        warn(f"GET ?action=cupo respondió HTTP {cupo_status}; redepliega Apps Script con la versión nueva.")

    info("Probando OPTIONS (preflight)…")
    opt_status, opt_body = http_request(url, "OPTIONS")
    if opt_status == 200:
        ok("OPTIONS OK")
    else:
        warn(f"OPTIONS respondió HTTP {opt_status} (no crítico si GET y POST funcionan).")
        if opt_body:
            info(opt_body[:300])

    info("Probando POST en seco (formType inválido, no escribe filas)…")
    post_status, post_body = http_request(
        url,
        "POST",
        {"formType": "test-cli", "data": {}},
    )
    if post_status == 400:
        ok("POST alcanzable — rechazó formType de prueba como se esperaba.")
    elif post_status == 200:
        warn("POST respondió 200 con formType de prueba; revisa la implementación.")
    else:
        error(f"POST falló con HTTP {post_status}")
        info(post_body[:500])
        return 3

    print()
    ok("Verificación completada. Ejecuta --probar-envio para insertar filas de prueba.")
    info("Comprobando versión de Code.gs (perfiles de marca)…")
    probe_status, probe_body = http_request(
        url + ("&" if "?" in url else "?") + "action=participante_publico&id=__verificar__",
        "GET",
    )
    code_gs_ok = False
    if probe_status == 200:
        try:
            probe_payload = json.loads(probe_body)
            if probe_payload.get("formType") == "participante_publico":
                code_gs_ok = True
            elif probe_payload.get("error") and "no encontrada" in str(probe_payload.get("error")).lower():
                code_gs_ok = True
        except json.JSONDecodeError:
            pass
    if code_gs_ok:
        ok("Code.gs actualizado — participante_publico disponible.")
    else:
        warn(
            "Code.gs desactualizado en Apps Script: falta action=participante_publico y admin_create_stand."
        )
        info("Pega tools/google-apps-script/Code.gs en el editor, redepliega Web App y ejecuta sincronizarEncabezados().")

    post_probe_status, post_probe_body = http_request(
        url,
        "POST",
        {"action": "admin_create_stand", "marca": "", "correo": ""},
    )
    if post_probe_status == 200:
        try:
            post_probe = json.loads(post_probe_body)
            if post_probe.get("error") and "formType" not in str(post_probe.get("error")):
                ok("admin_create_stand reconocido por doPost.")
            elif "formType inválido" in str(post_probe.get("error", "")):
                warn("doPost sin admin_create_stand — redepliega Code.gs desde el repo.")
        except json.JSONDecodeError:
            pass

    pasaporte_status, pasaporte_body = http_request(
        url + ("&" if "?" in url else "?") + "action=pasaporte_list&limit=1",
        "GET",
    )
    if pasaporte_status == 200:
        try:
            pas_payload = json.loads(pasaporte_body)
            if pas_payload.get("ok") and isinstance(pas_payload.get("clientes"), list):
                ok("Backend Pasaportes (Sheets) disponible en Apps Script.")
            elif pas_payload.get("ok") and pas_payload.get("forms"):
                warn("pasaporte_list no implementado — health check genérico. Redepliega Code.gs.")
            else:
                warn("pasaporte_list respondió sin clientes — redepliega Code.gs.")
        except json.JSONDecodeError:
            warn("pasaporte_list no devolvió JSON — Code.gs desactualizado.")
    else:
        warn("Falta pasaporte_list en Apps Script — redepliega Code.gs para pasaportes.")

    return 0


def sample_feria_payload() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "formType": "feria",
        "data": {
            "id": f"TEST-F-{int(datetime.now().timestamp())}",
            "fecha": now,
            "nombre": "Prueba CLI Feria",
            "edad": 28,
            "celular": "3001234567",
            "correo": "prueba-feria@example.com",
            "intereses": ["Aprendizaje, cursos, talleres"],
            "aceptacionesLegales": {
                "aceptaVoluntaria": True,
                "aceptaPertenencias": True,
                "aceptaDatos": True,
                "aceptaImagen": True,
            },
        },
    }


def sample_competencia_payload() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "formType": "competencia",
        "data": {
            "id": f"TEST-SC-{int(datetime.now().timestamp())}",
            "fecha": now,
            "evento": "Switch Championship",
            "valorInscripcion": 90000,
            "nombre": "Prueba CLI Competencia",
            "documento": "1234567890",
            "edad": 25,
            "ciudad": "Bogotá",
            "celular": "3009876543",
            "correo": "prueba-competencia@example.com",
            "representa": "Café de prueba",
            "rol": "Barista",
            "experiencia": "1-3 años",
            "experienciaSwitch": "Sí, en casa",
            "torneosPrevios": "No",
            "equipoPropio": {"harioSwitch": True, "gramera": True, "tetera": True},
            "envio": {
                "direccion": "Calle 123 #45-67",
                "ciudad": "Bogotá",
                "departamento": "Cundinamarca",
                "codigoPostal": "110111",
                "receptor": "Prueba CLI",
                "instrucciones": "Envío de prueba — eliminar fila",
            },
            "metodoPago": "Transferencia",
            "comprobanteReferencia": "REF-CLI-TEST",
            "comprobanteArchivo": {
                "tieneComprobante": False,
                "nombreArchivo": None,
                "tipoArchivo": None,
                "base64": None,
            },
            "fotoParticipante": {
                "nombreArchivo": "prueba.png",
                "tipoArchivo": "image/png",
                "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            },
            "aceptacionesLegales": {
                "aceptaVoluntaria": True,
                "aceptaPertenencias": True,
                "aceptaDatos": True,
                "aceptaNoReembolso": True,
                "aceptaDescalificacion": True,
                "aceptaReglas": True,
                "aceptaDisponibilidad": True,
                "aceptaImagen": True,
            },
            "observaciones": "Fila de prueba generada por conectar_sheets.py — puedes borrarla.",
        },
    }


def cmd_probar_envio() -> int:
    url = read_web_app_url()
    if not url:
        error(f"No hay WEB_APP_URL configurada en {SHEETS_CONFIG_PATH}")
        return 1

    tests = [
        ("Feria", sample_feria_payload()),
        ("Competencia", sample_competencia_payload()),
    ]

    for label, payload in tests:
        info(f"Enviando prueba — {label}…")
        status, body = http_request(url, "POST", payload)
        if status != 200:
            error(f"POST {label} falló con HTTP {status}")
            info(body[:800])
            return 2
        try:
            result = json.loads(body)
        except json.JSONDecodeError:
            error(f"Respuesta POST {label} no es JSON.")
            info(body[:500])
            return 2
        if not result.get("ok"):
            error(f"POST {label} rechazado: {result}")
            return 2
        ok(f"POST {label} OK — formType: {result.get('formType', payload['formType'])}")

    print()
    ok("Filas de prueba enviadas. Revisa las pestañas Feria y Competencia en la hoja.")
    warn("Elimina las filas TEST-* si no las necesitas.")
    return 0


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()
    load_dotenv()

    actions = [
        args.crear_hoja,
        bool(args.configurar_url),
        args.verificar,
        args.probar_envio,
    ]
    if sum(1 for a in actions if a) == 0:
        error("Indica al menos una acción: --crear-hoja, --configurar-url, --verificar o --probar-envio")
        info("Ejecuta con -h para ver ejemplos.")
        return 1

    exit_code = 0

    if args.crear_hoja:
        try:
            code = cmd_crear_hoja(args)
            if code != 0:
                return code
        except FileNotFoundError as exc:
            error(str(exc))
            info("Copia tools/.env.example a tools/.env y define GOOGLE_SERVICE_ACCOUNT_JSON.")
            return 2
        except Exception as exc:  # noqa: BLE001
            return _handle_api_error(exc)

    if args.configurar_url:
        code = cmd_configurar_url(args.configurar_url)
        if code != 0:
            return code

    if args.verificar:
        code = cmd_verificar()
        if code != 0:
            exit_code = code

    if args.probar_envio:
        code = cmd_probar_envio()
        if code != 0:
            exit_code = code

    return exit_code


def _handle_api_error(exc: Exception) -> int:
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
