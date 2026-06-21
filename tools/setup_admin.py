#!/usr/bin/env python3
"""
Despliega Code.gs (admin Firebase + analytics) y verifica endpoints.

Un comando (OAuth en navegador la primera vez):
  py tools/setup_admin.py
  py tools/setup_admin.py --script-id TU_SCRIPT_ID

Variables en tools/.env (gitignored): APPS_SCRIPT_ID, GOOGLE_SHEET_ID, SHEETS_WEB_APP_URL
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from _util import (
    CODE_GS_PATH,
    PROJECT_ROOT,
    TOOLS_DIR,
    error,
    info,
    load_dotenv,
    ok,
    read_web_app_url,
    warn,
    write_sheets_config,
)

ENV_PATH = TOOLS_DIR / ".env"
GAS_DIR = TOOLS_DIR / "google-apps-script"
MANIFEST_PATH = GAS_DIR / "appsscript.json"
CLASP_JSON = GAS_DIR / ".clasp.json"
OAUTH_TOKEN_PATH = TOOLS_DIR / "credentials" / ".oauth-script-token.json"
DEFAULT_ADMIN_EMAIL = "lasucursaldelcafe@gmail.com"

CLASP_OAUTH_CLIENT = {
    "installed": {
        "client_id": "1072944905490-md52bltq6fm6389bc6de2k88lots9o3a.apps.googleusercontent.com",
        "client_secret": "v_pV0sNpT8XK7wP1SRHEFF_V",
        "redirect_uris": ["http://localhost"],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
}

SCRIPT_SCOPES = [
    "https://www.googleapis.com/auth/script.projects",
    "https://www.googleapis.com/auth/script.deployments",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/drive.readonly",
]


def read_env() -> dict[str, str]:
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
    lines: list[str] = []
    found = False
    if ENV_PATH.is_file():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith(f"{key}="):
                lines.append(f"{key}={value}")
                found = True
            else:
                lines.append(line)
    if not found:
        lines.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def sync_clasp_rc(creds) -> None:
    rc = {
        "token": {
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "scope": " ".join(SCRIPT_SCOPES),
            "token_type": "Bearer",
            "expiry_date": int(creds.expiry.timestamp() * 1000) if creds.expiry else None,
        },
        "oauth2ClientSettings": {
            "clientId": CLASP_OAUTH_CLIENT["installed"]["client_id"],
            "clientSecret": CLASP_OAUTH_CLIENT["installed"]["client_secret"],
            "redirectUri": "http://localhost",
        },
        "isLocalCreds": False,
    }
    (Path.home() / ".clasprc.json").write_text(json.dumps(rc, indent=2) + "\n", encoding="utf-8")


def get_oauth_credentials():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow

    OAUTH_TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    creds = None
    if OAUTH_TOKEN_PATH.is_file():
        creds = Credentials.from_authorized_user_file(str(OAUTH_TOKEN_PATH), SCRIPT_SCOPES)
        if creds and creds.valid:
            sync_clasp_rc(creds)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            warn("OAuth requerido — se abrirá el navegador (una sola vez).")
            flow = InstalledAppFlow.from_client_config(CLASP_OAUTH_CLIENT, SCRIPT_SCOPES)
            creds = flow.run_local_server(port=0, open_browser=True)
        OAUTH_TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
        sync_clasp_rc(creds)
        ok("Token OAuth guardado.")
    return creds


def build_script_service(creds):
    from googleapiclient.discovery import build

    return build("script", "v1", credentials=creds, cache_discovery=False)


def deployment_id_from_url(url: str) -> str:
    match = re.search(r"/macros/s/([a-zA-Z0-9_-]+)/exec", url)
    return match.group(1) if match else ""


def read_script_id() -> str:
    env = read_env()
    script_id = env.get("APPS_SCRIPT_ID", "").strip()
    if script_id:
        return script_id
    if CLASP_JSON.is_file():
        return str(json.loads(CLASP_JSON.read_text(encoding="utf-8")).get("scriptId", "")).strip()
    return ""


def run_npx_clasp(args: list[str]) -> subprocess.CompletedProcess[str]:
    cmd = ["npx", "-y", "@google/clasp", *args]
    if sys.platform == "win32":
        return subprocess.run(subprocess.list2cmdline(cmd), cwd=str(GAS_DIR), capture_output=True, text=True, shell=True)
    return subprocess.run(cmd, cwd=str(GAS_DIR), capture_output=True, text=True)


def discover_script_id_clasp() -> str:
    result = run_npx_clasp(["list"])
    output = (result.stdout or "") + (result.stderr or "")
    candidates: list[tuple[str, str]] = []
    for line in output.splitlines():
        match = re.search(r"→\s*([a-zA-Z0-9_-]{20,})", line)
        if match:
            candidates.append((line.split("→")[0].strip(" -"), match.group(1)))
    preferred = ("inscripc", "switch", "feria", "sucursal", "cafe", "café")
    for name, sid in candidates:
        if any(p in name.lower() for p in preferred):
            ok(f"Script detectado: {name} → {sid}")
            return sid
    if len(candidates) == 1:
        ok(f"Script detectado: {candidates[0][0]} → {candidates[0][1]}")
        return candidates[0][1]
    return ""


def push_content_api(service, script_id: str) -> None:
    body = {
        "files": [
            {"name": "Code", "type": "SERVER_JS", "source": CODE_GS_PATH.read_text(encoding="utf-8")},
            {"name": "appsscript", "type": "JSON", "source": MANIFEST_PATH.read_text(encoding="utf-8")},
        ]
    }
    service.projects().updateContent(scriptId=script_id, body=body).execute()
    ok("Code.gs subido (Firebase admin + analytics).")


def redeploy_web_app(service, script_id: str, deployment_id: str) -> str:
    version = service.projects().versions().create(
        scriptId=script_id, body={"description": "Admin Firebase + analytics"}
    ).execute()
    version_number = version.get("versionNumber")
    if not version_number:
        raise RuntimeError("No se creó versión del script.")

    deployments = service.projects().deployments().list(scriptId=script_id).execute()
    target = None
    for dep in deployments.get("deployments", []):
        if dep.get("deploymentId") == deployment_id:
            target = dep
            break
    if not target and deployments.get("deployments"):
        target = deployments["deployments"][0]

    if not target:
        created = service.projects().deployments().create(
            scriptId=script_id,
            body={
                "versionNumber": version_number,
                "description": "Web App inscripciones + admin",
                "manifestFileName": "appsscript",
            },
        ).execute()
        dep_id = created.get("deploymentId", "")
        return f"https://script.google.com/macros/s/{dep_id}/exec"

    dep_id = target["deploymentId"]
    service.projects().deployments().update(
        scriptId=script_id,
        deploymentId=dep_id,
        body={"deploymentConfig": {"versionNumber": version_number, "description": "Web App + admin Firebase"}},
    ).execute()
    return f"https://script.google.com/macros/s/{dep_id}/exec"


def configure_admin_email_api(service, script_id: str, email: str) -> None:
    try:
        service.scripts().run(
            scriptId=script_id,
            body={"function": "configurarAdminEmail", "parameters": [email]},
        ).execute()
        ok(f"Correo admin configurado: {email}")
    except Exception as exc:  # noqa: BLE001
        warn(f"configurarAdminEmail omitido (valor por defecto en código): {exc}")


def http_json(url: str, method: str = "GET", payload: dict | None = None) -> tuple[int, dict]:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "text/plain;charset=utf-8"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(body)
        except json.JSONDecodeError:
            return exc.code, {"raw": body}


def verify_web_app(url: str) -> bool:
    info("Verificando Apps Script desplegado…")
    status, health = http_json(url, "GET")
    if status != 200 or not health.get("ok"):
        error(f"Health check falló: {status} {health}")
        return False
    ok(f"GET OK — forms: {health.get('forms', [])}")

    _, dash = http_json(url + ("&" if "?" in url else "?") + "action=admin_dashboard", "GET")
    if dash.get("stats"):
        ok(f"admin_dashboard OK — feria={dash.get('stats', {}).get('feriaRegistrations', '?')}")
    elif dash.get("ok") and dash.get("message"):
        error("admin_dashboard NO implementado en el deploy (respuesta genérica). Redeploy Code.gs.")
        return False
    elif dash.get("ok"):
        warn("Dashboard accesible sin token — revisa seguridad.")
    else:
        ok("Dashboard protegido (requiere Firebase ID token).")

    _, pv = http_json(url, "POST", {"action": "pageview", "path": "/setup-test", "title": "Setup"})
    if pv.get("ok"):
        ok("Pageview tracking OK.")
    elif pv.get("error") == "formType inválido.":
        error("Pageview NO implementado en el deploy. Redeploy Code.gs.")
        return False
    else:
        warn(f"Pageview: {pv}")
    return True


def deploy_firebase() -> bool:
    result = subprocess.run([sys.executable, "tools/deploy_firebase.py"], cwd=str(PROJECT_ROOT), check=False)
    return result.returncode == 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Despliega admin Firebase + analytics en Apps Script.")
    parser.add_argument("--script-id", help="ID del proyecto Apps Script")
    parser.add_argument("--solo-verificar", action="store_true")
    parser.add_argument("--sin-firebase", action="store_true")
    parser.add_argument("--sin-deploy", action="store_true")
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    load_dotenv()
    args = parse_args()
    env = read_env()
    admin_email = env.get("ALLOWED_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL).strip()
    url = read_web_app_url() or env.get("SHEETS_WEB_APP_URL", "").strip()
    deployment_id = deployment_id_from_url(url)

    if args.solo_verificar:
        if not url:
            error("No hay WEB_APP_URL.")
            return 1
        return 0 if verify_web_app(url) else 2

    if not url:
        error("No hay WEB_APP_URL en js/sheets-config.js")
        return 1

    try:
        creds = get_oauth_credentials()
        service = build_script_service(creds)
    except ImportError:
        error("Instala dependencias: py -3 -m pip install -r tools/requirements.txt")
        return 1
    except Exception as exc:  # noqa: BLE001
        error(f"OAuth falló: {exc}")
        return 3

    script_id = (args.script_id or read_script_id() or discover_script_id_clasp()).strip()
    if not script_id:
        sheet_id = env.get("GOOGLE_SHEET_ID", "").strip()
        if sheet_id:
            try:
                from _find_script_id import find_script_id_for_sheet

                info("Buscando Apps Script vinculado a la hoja…")
                script_id = find_script_id_for_sheet(sheet_id).strip()
                if script_id:
                    ok(f"Script detectado vía Drive API: {script_id}")
            except Exception as exc:  # noqa: BLE001
                warn(f"No se pudo auto-detectar script: {exc}")
    if not script_id:
        error("Falta APPS_SCRIPT_ID.")
        info("Hoja → Extensiones → Apps Script → ⚙ → ID del script")
        info(f"https://docs.google.com/spreadsheets/d/{env.get('GOOGLE_SHEET_ID', '')}/edit")
        info("Luego: py tools/setup_admin.py --script-id TU_ID")
        return 4

    update_env_var("APPS_SCRIPT_ID", script_id)
    CLASP_JSON.write_text(json.dumps({"scriptId": script_id, "rootDir": "."}, indent=2) + "\n", encoding="utf-8")

    web_url = url
    if not args.sin_deploy:
        try:
            push_content_api(service, script_id)
            web_url = redeploy_web_app(service, script_id, deployment_id)
            write_sheets_config(web_url)
            update_env_var("SHEETS_WEB_APP_URL", web_url)
            update_env_var("APPS_SCRIPT_URL", web_url)
            ok("sheets-config.js actualizado.")
        except Exception as exc:  # noqa: BLE001
            error(f"Deploy falló: {exc}")
            return 5

    configure_admin_email_api(service, script_id, admin_email)

    if not verify_web_app(web_url):
        return 6

    if not args.sin_firebase:
        if deploy_firebase():
            ok("Firebase Hosting desplegado.")
        else:
            warn("Firebase omitido — py tools/deploy_firebase.py")

    print()
    ok("Apps Script admin + analytics operativo.")
    info("Panel: https://la-sucursal-del-cafe.web.app/admin")
    info("Modo: panel abierto sin login (no compartir URL)")
    info(f"Apps Script: https://script.google.com/home/projects/{script_id}/edit")
    return 0


if __name__ == "__main__":
    sys.exit(main())
