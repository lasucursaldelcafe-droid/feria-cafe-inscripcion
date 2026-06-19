#!/usr/bin/env python3
"""
Orquestador completo: Google Cloud SA → Sheets → Apps Script → sitio → Firebase.

Uso:
  py tools/automatizar_todo.py --todo
  py tools/automatizar_todo.py --solo-sheets
  py tools/automatizar_todo.py --solo-apps-script
  py tools/automatizar_todo.py --verificar
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
import webbrowser
from datetime import datetime, timezone
from pathlib import Path

from _util import (
    CODE_GS_PATH,
    DEFAULT_FIREBASE_PROJECT,
    PROJECT_ROOT,
    SHEETS_CONFIG_PATH,
    TOOLS_DIR,
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

LOG_PATH = TOOLS_DIR / "automatizar.log"
ENV_PATH = TOOLS_DIR / ".env"
ENV_EXAMPLE = TOOLS_DIR / ".env.example"
CREDENTIALS_DIR = TOOLS_DIR / "credentials"
DEFAULT_SA_PATH = CREDENTIALS_DIR / "feria-sheets-sa.json"
GAS_DIR = TOOLS_DIR / "google-apps-script"
CLASP_RC = Path.home() / ".clasprc.json"

POLL_TIMEOUT_SEC = 120
POLL_INTERVAL_SEC = 2

logger: logging.Logger | None = None


def setup_logging() -> logging.Logger:
    global logger
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log = logging.getLogger("automatizar_todo")
    log.setLevel(logging.DEBUG)
    log.handlers.clear()

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    fh = logging.FileHandler(LOG_PATH, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    log.addHandler(fh)

    sh = logging.StreamHandler(sys.stdout)
    sh.setLevel(logging.INFO)
    sh.setFormatter(fmt)
    log.addHandler(sh)

    logger = log
    return log


def log_step(n: int, title: str) -> None:
    banner = f"{'=' * 60}\nPaso {n} — {title}\n{'=' * 60}"
    print(banner)
    if logger:
        logger.info(banner)


def log_ok(msg: str) -> None:
    ok(msg)
    if logger:
        logger.info("[OK] %s", msg)


def log_info(msg: str) -> None:
    info(msg)
    if logger:
        logger.info("[INFO] %s", msg)


def log_warn(msg: str) -> None:
    warn(msg)
    if logger:
        logger.warning("[AVISO] %s", msg)


def log_error(msg: str) -> None:
    error(msg)
    if logger:
        logger.error("[ERROR] %s", msg)


def ensure_env_file() -> None:
    if ENV_PATH.is_file():
        return
    if ENV_EXAMPLE.is_file():
        shutil.copy(ENV_EXAMPLE, ENV_PATH)
        log_ok(f"Creado {ENV_PATH} desde plantilla.")
    else:
        ENV_PATH.write_text(
            "\n".join(
                [
                    "# NO subir al repositorio",
                    f"GOOGLE_SERVICE_ACCOUNT_JSON={DEFAULT_SA_PATH}",
                    "GOOGLE_SHEET_ID=",
                    "SHARE_SHEET_WITH=",
                    "SHEETS_WEB_APP_URL=",
                    "APPS_SCRIPT_URL=",
                    f"FIREBASE_PROJECT={DEFAULT_FIREBASE_PROJECT}",
                    "FIREBASE_TOKEN=",
                    "FIREBASE_SERVICE_ACCOUNT_JSON=",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        log_ok(f"Creado {ENV_PATH} básico.")


def read_env_dict() -> dict[str, str]:
    result: dict[str, str] = {}
    if not ENV_PATH.is_file():
        return result
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def update_env_var(key: str, value: str) -> None:
    ensure_env_file()
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
    found = False
    new_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(f"{key}="):
            new_lines.append(f"{key}={value}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    os.environ[key] = value
    log_ok(f"Actualizado tools/.env → {key}")
    if logger:
        logger.debug("ENV %s=%s", key, value[:80] + ("..." if len(value) > 80 else ""))


def prompt_input(message: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    try:
        raw = input(f"{message}{suffix}: ").strip()
    except EOFError:
        raw = ""
    return raw or default


def run_py(args: list[str], *, check: bool = True, capture: bool = False) -> subprocess.CompletedProcess[str]:
    cmd = [sys.executable, *args]
    display = " ".join(cmd)
    log_info(f"Ejecutando: {display}")
    if logger:
        logger.debug("CMD %s", display)
    return subprocess.run(
        cmd,
        cwd=str(PROJECT_ROOT),
        check=check,
        capture_output=capture,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def run_shell(args: list[str], *, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    display = " ".join(args)
    log_info(f"Ejecutando: {display}")
    if logger:
        logger.debug("SHELL %s", display)
    return subprocess.run(
        args,
        cwd=str(cwd or PROJECT_ROOT),
        check=check,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def open_url(url: str, label: str = "") -> None:
    log_info(f"Abriendo navegador: {label or url}")
    webbrowser.open(url)


# ── Paso 1: Prerrequisitos ──────────────────────────────────────────────────


def step1_prerequisites(*, skip_node: bool = False) -> bool:
    log_step(1, "Comprobación de prerrequisitos")

    py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    log_ok(f"Python {py_version}")

    ensure_env_file()
    load_dotenv()

    log_info("Instalando dependencias Python…")
    try:
        run_py(["-m", "pip", "install", "-r", str(TOOLS_DIR / "requirements.txt"), "-q"], check=True)
        log_ok("Dependencias Python instaladas.")
    except subprocess.CalledProcessError:
        log_error("No se pudieron instalar dependencias. Ejecuta manualmente:")
        log_info("  py -3 -m pip install -r tools/requirements.txt")
        return False

    if skip_node:
        log_warn("Comprobación de Node omitida (--solo-sheets).")
        return True

    node = shutil.which("node")
    npx = shutil.which("npx")
    if node:
        try:
            ver = subprocess.run([node, "--version"], capture_output=True, text=True, check=True)
            log_ok(f"Node.js {ver.stdout.strip()}")
        except subprocess.CalledProcessError:
            log_warn("Node.js detectado pero no responde correctamente.")
    else:
        log_warn("Node.js no instalado (opcional para clasp/Firebase).")
        open_url("https://nodejs.org/", "Instalar Node.js")

    if npx:
        log_ok("npx disponible.")
    elif not skip_node:
        log_warn("npx no disponible — clasp y Firebase requerirán pasos manuales.")

    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    log_ok(f"Carpeta credentials lista: {CREDENTIALS_DIR}")
    return True


# ── Paso 2: Cuenta de servicio ──────────────────────────────────────────────


def print_sa_manual_instructions() -> None:
    print()
    log_info("Instrucciones manuales — crear cuenta de servicio (click a click):")
    print("  1. Abre Google Cloud Console → https://console.cloud.google.com/")
    print("  2. Selecciona tu proyecto (o crea uno nuevo).")
    print("  3. Menú ☰ → APIs y servicios → Biblioteca")
    print("     • Busca y habilita: Google Sheets API")
    print("     • Busca y habilita: Google Drive API")
    print("  4. Menú ☰ → IAM y administración → Cuentas de servicio")
    print("  5. + CREAR CUENTA DE SERVICIO")
    print("     • Nombre: feria-sheets")
    print("     • Crear y continuar → Finalizar")
    print("  6. En la fila de la cuenta → ⋮ → Administrar claves")
    print("  7. AGREGAR CLAVE → Crear clave nueva → JSON → CREAR")
    print(f"  8. Mueve el JSON descargado a:\n     {DEFAULT_SA_PATH}")
    print()
    open_url("https://console.cloud.google.com/iam-admin/serviceaccounts", "Google Cloud — Cuentas de servicio")


def search_downloads_for_sa_json() -> Path | None:
    downloads = Path.home() / "Downloads"
    if not downloads.is_dir():
        return None

    candidates: list[tuple[float, Path]] = []
    patterns = ("*.json", "*service*account*.json", "*feria*.json")
    seen: set[Path] = set()
    for pattern in patterns:
        for path in downloads.glob(pattern):
            if path in seen or not path.is_file():
                continue
            seen.add(path)
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if data.get("type") == "service_account" and data.get("client_email"):
                candidates.append((path.stat().st_mtime, path))

    if not candidates:
        log_info(f"No se encontraron JSON de cuenta de servicio en {downloads}")
        return None

    candidates.sort(reverse=True)
    newest = candidates[0][1]
    log_ok(f"JSON de cuenta de servicio encontrado en Descargas: {newest.name}")
    return newest


def copy_sa_json(source: Path) -> Path:
    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    if source.resolve() == DEFAULT_SA_PATH.resolve():
        return DEFAULT_SA_PATH
    shutil.copy2(source, DEFAULT_SA_PATH)
    log_ok(f"Copiado a {DEFAULT_SA_PATH}")
    return DEFAULT_SA_PATH


def try_gcloud_create_sa() -> bool:
    gcloud = shutil.which("gcloud")
    if not gcloud:
        log_info("gcloud CLI no instalado — omitiendo creación automática.")
        return False

    project = os.environ.get("GCP_PROJECT", "").strip()
    if not project:
        project = prompt_input("ID del proyecto Google Cloud (GCP_PROJECT)", "")

    if not project:
        log_warn("Sin ID de proyecto — no se puede usar gcloud.")
        return False

    log_info(f"Intentando crear cuenta de servicio con gcloud (proyecto: {project})…")
    sa_email = f"feria-sheets@{project}.iam.gserviceaccount.com"
    try:
        run_shell(
            [gcloud, "services", "enable", "sheets.googleapis.com", "drive.googleapis.com", f"--project={project}"],
            check=False,
        )
        run_shell(
            [
                gcloud,
                "iam",
                "service-accounts",
                "create",
                "feria-sheets",
                "--display-name=feria-sheets",
                f"--project={project}",
            ],
            check=False,
        )
        result = run_shell(
            [
                gcloud,
                "iam",
                "service-accounts",
                "keys",
                "create",
                str(DEFAULT_SA_PATH),
                f"--iam-account={sa_email}",
                f"--project={project}",
            ],
            check=False,
        )
        if result.returncode == 0 and DEFAULT_SA_PATH.is_file():
            log_ok(f"Cuenta de servicio creada vía gcloud: {DEFAULT_SA_PATH}")
            update_env_var("GOOGLE_SERVICE_ACCOUNT_JSON", str(DEFAULT_SA_PATH))
            return True
        if result.stderr:
            log_warn(result.stderr.strip()[:400])
    except Exception as exc:  # noqa: BLE001
        log_warn(f"gcloud falló: {exc}")
    return False


def poll_for_credentials(timeout: int = POLL_TIMEOUT_SEC) -> Path | None:
    log_info(f"Esperando JSON en {DEFAULT_SA_PATH} (máx. {timeout}s)…")
    deadline = time.time() + timeout
    while time.time() < deadline:
        if DEFAULT_SA_PATH.is_file():
            log_ok(f"Detectado: {DEFAULT_SA_PATH}")
            return DEFAULT_SA_PATH
        found = search_downloads_for_sa_json()
        if found:
            return copy_sa_json(found)
        time.sleep(POLL_INTERVAL_SEC)
    return None


def resolve_or_obtain_credentials() -> Path | None:
    env = read_env_dict()
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", env.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")).strip()
    if raw:
        path = Path(raw).expanduser()
        if path.is_file():
            log_ok(f"Credenciales existentes: {path}")
            return path.resolve()
        log_warn(f"Ruta en .env no existe: {path}")

    if DEFAULT_SA_PATH.is_file():
        update_env_var("GOOGLE_SERVICE_ACCOUNT_JSON", str(DEFAULT_SA_PATH))
        return DEFAULT_SA_PATH

    found = search_downloads_for_sa_json()
    if found:
        path = copy_sa_json(found)
        update_env_var("GOOGLE_SERVICE_ACCOUNT_JSON", str(path))
        return path

    print_sa_manual_instructions()

    if shutil.which("gcloud"):
        if prompt_input("¿Intentar crear SA con gcloud? (s/n)", "s").lower().startswith("s"):
            if try_gcloud_create_sa():
                return DEFAULT_SA_PATH

    log_info("Completa la descarga manual y el script esperará el archivo…")
    polled = poll_for_credentials()
    if polled:
        update_env_var("GOOGLE_SERVICE_ACCOUNT_JSON", str(polled))
        return polled

    log_error("No se encontró JSON de cuenta de servicio.")
    log_info(f"Coloca el archivo en: {DEFAULT_SA_PATH}")
    log_info("Luego ejecuta de nuevo: py tools/automatizar_todo.py --todo")
    return None


def step2_credentials() -> Path | None:
    log_step(2, "Google Cloud / cuenta de servicio")
    return resolve_or_obtain_credentials()


# ── Paso 3: Crear hoja ───────────────────────────────────────────────────────


def step3_create_spreadsheet(credentials_path: Path) -> str | None:
    log_step(3, "Crear hoja de cálculo")

    share = os.environ.get("SHARE_SHEET_WITH", "").strip()
    if not share or share == "tu-gmail@gmail.com" or share == "tu-correo@gmail.com":
        share = prompt_input("Correo Gmail para compartir la hoja (SHARE_SHEET_WITH)", share)
        if share:
            update_env_var("SHARE_SHEET_WITH", share)

    existing_id = os.environ.get("GOOGLE_SHEET_ID", "").strip()
    args = ["tools/conectar_sheets.py", "--crear-hoja"]
    if credentials_path:
        args.extend(["--credentials", str(credentials_path)])
    if share:
        args.extend(["--share-with", share])
    if existing_id:
        args.extend(["--sheet-id", existing_id])

    try:
        result = run_py(args, check=True, capture=True)
        output = (result.stdout or "") + (result.stderr or "")
        if logger:
            logger.debug("conectar_sheets output:\n%s", output)

        sheet_id = existing_id
        match = re.search(r"ID de la hoja[^:]*:\s*([a-zA-Z0-9_-]+)", output)
        if match:
            sheet_id = match.group(1)
        if not sheet_id:
            url_match = re.search(r"spreadsheets/d/([a-zA-Z0-9_-]+)", output)
            if url_match:
                sheet_id = url_match.group(1)

        if sheet_id:
            update_env_var("GOOGLE_SHEET_ID", sheet_id)
            url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit"
            log_ok(f"Hoja: {url}")
            return sheet_id

        log_error("No se pudo obtener GOOGLE_SHEET_ID de la salida.")
        return None
    except subprocess.CalledProcessError as exc:
        log_error(f"Falló crear hoja (código {exc.returncode}).")
        if exc.stdout:
            print(exc.stdout)
        if exc.stderr:
            print(exc.stderr, file=sys.stderr)
        return None


# ── Paso 4: Apps Script ───────────────────────────────────────────────────────


def clasp_available() -> bool:
    if not shutil.which("node") or not shutil.which("npx"):
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


def clasp_login() -> bool:
    if CLASP_RC.is_file():
        log_ok("clasp ya autenticado (.clasprc.json).")
        return True

    log_info("Iniciando login de clasp (se abrirá el navegador)…")
    open_url("https://script.google.com/home/start", "Apps Script — login")
    try:
        run_shell(["npx", "-y", "@google/clasp", "login"], cwd=GAS_DIR, check=True)
        if CLASP_RC.is_file():
            log_ok("Login clasp completado.")
            return True
    except subprocess.CalledProcessError as exc:
        log_warn(f"clasp login falló: {exc.stderr[:300] if exc.stderr else exc}")

    log_warn("Login clasp no completado.")
    log_info("Ejecuta manualmente: npx -y @google/clasp login")
    return False


def parse_web_app_url_from_deploy_output(text: str) -> str:
    for line in text.splitlines():
        if "script.google.com/macros/s/" in line and "/exec" in line:
            match = re.search(r"(https://script\.google\.com/macros/s/[^/\s]+/exec)", line)
            if match:
                return match.group(1)
    match = re.search(r"https://script\.google\.com/macros/s/([a-zA-Z0-9_-]+)/exec", text)
    if match:
        return match.group(0)
    deploy_match = re.search(r"Deployed.*?@([a-zA-Z0-9_-]+)", text)
    if deploy_match:
        return f"https://script.google.com/macros/s/{deploy_match.group(1)}/exec"
    return ""


def deploy_apps_script_clasp(sheet_id: str) -> str:
    log_info("Desplegando Apps Script con clasp…")
    args = ["tools/desplegar_apps_script.py", "--sheet-id", sheet_id]
    try:
        result = run_py(args, check=False, capture=True)
        output = (result.stdout or "") + (result.stderr or "")
        if logger:
            logger.debug("desplegar_apps_script:\n%s", output)
        url = parse_web_app_url_from_deploy_output(output)
        if url:
            log_ok(f"WEB_APP_URL: {url}")
            return url
        if result.returncode != 0:
            log_warn(f"desplegar_apps_script.py terminó con código {result.returncode}")
    except Exception as exc:  # noqa: BLE001
        log_warn(f"Error en despliegue clasp: {exc}")
    return ""


def manual_apps_script_flow(sheet_id: str) -> str:
    log_warn("Modo manual — Apps Script")
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit"
    open_url(url, "Hoja de cálculo")
    print_apps_script_instructions(sheet_id)

    env_url = os.environ.get("SHEETS_WEB_APP_URL", "") or os.environ.get("APPS_SCRIPT_URL", "")
    existing = read_web_app_url() or env_url
    if existing and "/exec" in existing:
        log_ok(f"URL existente: {existing}")
        return existing

    log_info("Pega la URL /exec cuando la tengas (Enter para omitir y continuar después).")
    entered = prompt_input("URL Web App (/exec)", env_url)
    if entered and "/exec" in entered:
        return entered.strip()

    log_info("Esperando URL en tools/.env (APPS_SCRIPT_URL o SHEETS_WEB_APP_URL)…")
    deadline = time.time() + POLL_TIMEOUT_SEC
    while time.time() < deadline:
        load_dotenv()
        for key in ("APPS_SCRIPT_URL", "SHEETS_WEB_APP_URL"):
            val = os.environ.get(key, "").strip()
            if val and "/exec" in val:
                log_ok(f"Detectada {key} en .env")
                return val
        entered = read_env_dict().get("APPS_SCRIPT_URL") or read_env_dict().get("SHEETS_WEB_APP_URL", "")
        if entered and "/exec" in entered:
            return entered
        time.sleep(POLL_INTERVAL_SEC)

    return ""


def step4_apps_script(sheet_id: str) -> str:
    log_step(4, "Desplegar Apps Script")

    if not CODE_GS_PATH.is_file():
        log_error(f"No existe {CODE_GS_PATH}")
        return ""

    web_url = ""

    if clasp_available():
        if clasp_login():
            web_url = deploy_apps_script_clasp(sheet_id)
    else:
        log_warn("clasp no disponible — se usará flujo manual.")

    if not web_url:
        web_url = manual_apps_script_flow(sheet_id)

    if web_url:
        update_env_var("SHEETS_WEB_APP_URL", web_url)
        update_env_var("APPS_SCRIPT_URL", web_url)
    else:
        log_warn("WEB_APP_URL no configurada — continúa manualmente cuando la tengas.")

    return web_url


# ── Paso 5: Configurar proyecto ─────────────────────────────────────────────


def step5_configure(web_url: str | None = None) -> bool:
    log_step(5, "Configurar proyecto y verificar")

    url = (web_url or "").strip()
    if not url:
        url = read_web_app_url()
    if not url:
        url = os.environ.get("SHEETS_WEB_APP_URL", "") or os.environ.get("APPS_SCRIPT_URL", "")

    if not url or "TU_ID_DE_DEPLOYMENT" in url:
        log_error("No hay WEB_APP_URL. Configúrala con --solo-apps-script o manualmente.")
        return False

    write_sheets_config(url)
    log_ok(f"Escrito {SHEETS_CONFIG_PATH}")

    ok_verify = True
    try:
        run_py(["tools/conectar_sheets.py", "--verificar"], check=False)
    except subprocess.CalledProcessError:
        ok_verify = False

    try:
        run_py(["tools/conectar_sheets.py", "--probar-envio"], check=False)
    except subprocess.CalledProcessError:
        ok_verify = False

    return ok_verify


# ── Paso 6: Firebase (opcional) ───────────────────────────────────────────────


def step6_firebase(*, skip: bool = False) -> bool:
    log_step(6, "Firebase Hosting (opcional)")

    if skip:
        log_info("Omitido por el usuario.")
        return True

    if not shutil.which("node"):
        log_warn("Node.js requerido para Firebase — omitiendo.")
        return True

    project = os.environ.get("FIREBASE_PROJECT", DEFAULT_FIREBASE_PROJECT)
    token = os.environ.get("FIREBASE_TOKEN", "").strip()

    if not token:
        log_info("Intentando firebase login (puede abrir navegador)…")
        open_url("https://console.firebase.google.com/", "Firebase Console")
        try:
            run_shell(
                ["npx", "-y", "firebase-tools@latest", "login", "--no-localhost"],
                check=False,
            )
        except Exception as exc:  # noqa: BLE001
            log_warn(f"firebase login: {exc}")

    try:
        result = run_py(["tools/deploy_firebase.py", "--project", project], check=False, capture=True)
        if result.returncode == 0:
            log_ok(f"Firebase desplegado: https://{project}.web.app")
            return True
        log_warn("Firebase no desplegado — puedes hacerlo después con:")
        log_info(f"  py tools/deploy_firebase.py --project {project}")
    except Exception as exc:  # noqa: BLE001
        log_warn(f"Firebase omitido: {exc}")

    return True


# ── CLI ──────────────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automatiza Google Sheets + Apps Script + configuración del sitio.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ejemplos:\n"
            "  py tools/automatizar_todo.py --todo\n"
            "  py tools/automatizar_todo.py --solo-sheets\n"
            "  py tools/automatizar_todo.py --solo-apps-script\n"
            "  py tools/automatizar_todo.py --verificar\n"
            "  py tools/automatizar_todo.py --sin-cuenta-servicio\n"
        ),
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--todo", action="store_true", help="Pipeline completo (pasos 1–6).")
    group.add_argument("--solo-sheets", action="store_true", help="Solo prerrequisitos + SA + hoja.")
    group.add_argument("--solo-apps-script", action="store_true", help="Solo Apps Script + configurar URL.")
    group.add_argument("--verificar", action="store_true", help="Solo verificar URL y prueba POST.")
    group.add_argument(
        "--sin-cuenta-servicio",
        action="store_true",
        help="Modo sin JSON: hoja manual + Apps Script (política org bloquea claves SA).",
    )
    parser.add_argument("--sin-firebase", action="store_true", help="Omitir paso 6 (Firebase).")
    parser.add_argument("--share-with", help="Correo para compartir la hoja.")
    return parser.parse_args()


def cmd_sin_cuenta_servicio() -> int:
    """Delega al flujo interactivo sin JSON de cuenta de servicio."""
    log_info("Modo sin cuenta de servicio — delegando a tools/modo_sin_json.py")
    try:
        result = run_py(["tools/modo_sin_json.py"], check=False)
        return result.returncode
    except Exception as exc:  # noqa: BLE001
        log_error(str(exc))
        return 1


def cmd_verificar() -> int:
    load_dotenv()
    url = read_web_app_url()
    if url:
        log_ok(f"WEB_APP_URL en sheets-config.js: {url}")
    else:
        log_warn("WEB_APP_URL no configurada en js/sheets-config.js")
    try:
        result = run_py(["tools/conectar_sheets.py", "--verificar"], check=False, capture=True)
        return result.returncode
    except Exception as exc:  # noqa: BLE001
        log_error(str(exc))
        return 1


def cmd_solo_sheets(args: argparse.Namespace) -> int:
    if args.share_with:
        update_env_var("SHARE_SHEET_WITH", args.share_with)
    if not step1_prerequisites(skip_node=True):
        return 2
    creds = step2_credentials()
    if not creds:
        return 3
    load_dotenv()
    sheet_id = step3_create_spreadsheet(creds)
    return 0 if sheet_id else 4


def cmd_solo_apps_script() -> int:
    load_dotenv()
    if not step1_prerequisites():
        return 2
    sheet_id = os.environ.get("GOOGLE_SHEET_ID", "").strip()
    if not sheet_id:
        sheet_id = prompt_input("GOOGLE_SHEET_ID", "")
        if sheet_id:
            update_env_var("GOOGLE_SHEET_ID", sheet_id)
    if not sheet_id:
        log_error("Indica GOOGLE_SHEET_ID en tools/.env")
        return 3
    web_url = step4_apps_script(sheet_id)
    if web_url:
        step5_configure(web_url)
    return 0 if web_url else 5


def cmd_todo(args: argparse.Namespace) -> int:
    if args.share_with:
        update_env_var("SHARE_SHEET_WITH", args.share_with)

    log_info(f"Inicio automatización — {datetime.now(timezone.utc).isoformat()}")
    log_info(f"Log: {LOG_PATH}")

    if not step1_prerequisites():
        return 2

    creds = step2_credentials()
    if not creds:
        return 3

    load_dotenv()
    sheet_id = step3_create_spreadsheet(creds)
    if not sheet_id:
        return 4

    web_url = step4_apps_script(sheet_id)
    if web_url:
        step5_configure(web_url)
    else:
        log_warn("Pipeline pausado: falta URL /exec de Apps Script.")

    step6_firebase(skip=args.sin_firebase)

    print()
    log_ok("Automatización finalizada.")
    log_info(f"Revisa el log: {LOG_PATH}")
    if sheet_id:
        log_info(f"Hoja: https://docs.google.com/spreadsheets/d/{sheet_id}/edit")
    final_url = read_web_app_url() or web_url
    if final_url:
        log_ok(f"WEB_APP_URL: {final_url}")
    else:
        log_warn("WEB_APP_URL pendiente — completa Apps Script manualmente.")

    return 0


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    setup_logging()
    args = parse_args()

    try:
        if args.verificar:
            return cmd_verificar()
        if args.sin_cuenta_servicio:
            return cmd_sin_cuenta_servicio()
        if args.solo_sheets:
            return cmd_solo_sheets(args)
        if args.solo_apps_script:
            return cmd_solo_apps_script()
        if args.todo:
            return cmd_todo(args)
    except KeyboardInterrupt:
        log_warn("Interrumpido por el usuario.")
        return 130

    return 1


if __name__ == "__main__":
    sys.exit(main())
