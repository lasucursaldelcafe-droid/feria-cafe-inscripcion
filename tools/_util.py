"""Utilidades compartidas para scripts de automatización (Windows-friendly)."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
TOOLS_DIR = Path(__file__).resolve().parent

SPREADSHEET_TITLE = "Switch Championship — Inscripciones"
SHEET_FERIA = "Feria"
SHEET_COMPETENCIA = "Competencia"

SHEET_LISTA_ESPERA = "Lista de espera"

HEADERS_LISTA_ESPERA = [
    "Fecha registro",
    "ID",
    "Formulario",
    "Nombre",
    "Documento",
    "Correo",
    "Celular",
    "Motivo",
    "Notas admin",
]

HEADERS_FERIA = [
    "Fecha registro",
    "ID",
    "Nombre",
    "Edad",
    "Celular",
    "Correo",
    "Intereses",
    "Acepta voluntaria",
    "Acepta pertenencias",
    "Acepta datos",
    "Acepta imagen",
    "Estado registro",
    "Notas admin",
]

HEADERS_COMPETENCIA = [
    "Fecha registro",
    "ID",
    "Evento",
    "Valor inscripción",
    "Nombre",
    "Documento",
    "Edad",
    "Ciudad",
    "Celular",
    "Correo",
    "Foto participante nombre",
    "Foto participante tipo",
    "Foto participante enlace Drive",
    "Representa",
    "Rol",
    "Experiencia café",
    "Experiencia Switch",
    "Torneos previos",
    "Equipo Switch",
    "Equipo gramera",
    "Equipo tetera",
    "Dirección envío",
    "Ciudad envío",
    "Departamento",
    "Código postal",
    "Receptor",
    "Instrucciones envío",
    "Método pago",
    "Referencia pago",
    "Tiene comprobante",
    "Comprobante nombre",
    "Comprobante tipo",
    "Comprobante enlace Drive",
    "Comprobante base64 (preview)",
    "Acepta voluntaria",
    "Acepta pertenencias",
    "Acepta datos",
    "Acepta no reembolso",
    "Acepta descalificación",
    "Acepta reglas",
    "Acepta disponibilidad",
    "Acepta imagen",
    "Observaciones",
    "Estado pago",
    "Cupo confirmado",
    "Notas admin",
]

CODE_GS_PATH = TOOLS_DIR / "google-apps-script" / "Code.gs"
SHEETS_CONFIG_PATH = PROJECT_ROOT / "js" / "sheets-config.js"
SHEETS_CONFIG_EXAMPLE_PATH = PROJECT_ROOT / "js" / "sheets-config.example.js"

DEFAULT_FIREBASE_PROJECT = "la-sucursal-del-cafe"


def ok(msg: str) -> None:
    print(f"[OK] {msg}")


def info(msg: str) -> None:
    print(f"[INFO] {msg}")


def warn(msg: str) -> None:
    print(f"[AVISO] {msg}")


def error(msg: str) -> None:
    print(f"[ERROR] {msg}", file=sys.stderr)


def resolve_credentials(cli_path: str | None, env_var: str = "GOOGLE_SERVICE_ACCOUNT_JSON") -> Path:
    """Resuelve la ruta al JSON de cuenta de servicio."""
    raw = cli_path or os.environ.get(env_var, "").strip()
    if not raw:
        raise FileNotFoundError(
            "No se encontró credencial de Google.\n"
            f"  - Define la variable de entorno {env_var}\n"
            "  - O pasa --credentials ruta/al/archivo.json"
        )
    path = Path(raw).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(f"No existe el archivo de credenciales: {path}")
    return path


def load_service_account_email(credentials_path: Path) -> str:
    import json

    with credentials_path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    email = data.get("client_email", "")
    if not email:
        raise ValueError("El JSON no contiene client_email.")
    return email


def load_dotenv(path: Path | None = None) -> None:
    """Carga variables desde tools/.env sin sobrescribir las ya definidas."""
    env_path = path or (TOOLS_DIR / ".env")
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def read_web_app_url(config_path: Path | None = None) -> str:
    """Lee WEB_APP_URL desde js/sheets-config.js."""
    import re

    target = config_path or SHEETS_CONFIG_PATH
    if not target.is_file():
        return ""
    text = target.read_text(encoding="utf-8")
    match = re.search(r"WEB_APP_URL:\s*['\"]([^'\"]*)['\"]", text)
    if not match:
        return ""
    url = match.group(1).strip()
    if not url or "TU_ID_DE_DEPLOYMENT" in url:
        return ""
    return url


def write_sheets_config(web_app_url: str) -> Path:
    """Escribe js/sheets-config.js en la raíz del proyecto."""
    target = SHEETS_CONFIG_PATH
    content = (
        "/**\n"
        " * Configuración generada por tools/conectar_sheets.py\n"
        " * Ver tools/INSTRUCCIONES-SHEETS.md\n"
        " */\n"
        "window.SHEETS_CONFIG = {\n"
        f"  WEB_APP_URL: '{web_app_url}'\n"
        "};\n"
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return target


def print_apps_script_instructions(spreadsheet_id: str | None = None) -> None:
    """Muestra pasos manuales para desplegar Code.gs."""
    info("Pasos manuales — Apps Script (obligatorio):")
    print("  1. Abre la hoja con tu cuenta de Google (acceso de editor).")
    if spreadsheet_id:
        print(f"     https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")
    print("  2. Extensiones > Apps Script.")
    print(f"  3. Pega el código de: {CODE_GS_PATH}")
    print("  4. Implementar > Nueva implementacion > Aplicacion web")
    print("     Ejecutar como: Yo | Acceso: Cualquier persona")
    print("  5. Copia la URL /exec y ejecuta:")
    print('     py tools/conectar_sheets.py --configurar-url "https://script.google.com/.../exec"')
    print("  6. Verifica la conexión:")
    print("     py tools/conectar_sheets.py --verificar")
    print()
    info(f"Archivo Apps Script: {CODE_GS_PATH}")


def check_command(name: str) -> str | None:
    return shutil.which(name)


def require_node() -> None:
    if not check_command("node"):
        raise RuntimeError(
            "Node.js no está instalado o no está en el PATH.\n"
            "  Descarga: https://nodejs.org/\n"
            "  Reinicia PowerShell después de instalar."
        )
    if not check_command("npx"):
        raise RuntimeError(
            "npx no está disponible. Instala Node.js 18+ desde https://nodejs.org/"
        )


def run_command(args: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    """Ejecuta un comando y propaga errores con salida en español."""
    display = " ".join(args)
    info(f"Ejecutando: {display}")
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    try:
        subprocess.run(
            args,
            cwd=str(cwd or PROJECT_ROOT),
            env=merged_env,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"El comando falló (código {exc.returncode}): {display}") from exc


def python_launcher_hint() -> str:
    return (
        "Python no está en el PATH.\n"
        "  1. Instala Python 3.11+ desde https://www.python.org/downloads/\n"
        "     (marca «Add python.exe to PATH» durante la instalación)\n"
        "  2. O usa el launcher de Windows: py -3 tools/setup.py --all"
    )
