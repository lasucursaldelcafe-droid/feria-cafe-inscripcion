#!/usr/bin/env python3
"""
Script maestro: verifica credenciales, despliega Apps Script + Firebase Hosting,
y comprueba panel admin y endpoints.

Preferir para mantenimiento completo (CI + recordatorios):
  py tools/automatizar_manual.py --todo

Uso:
  py tools/fix_all.py
  py tools/fix_all.py --solo-verificar
"""

from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

from _util import PROJECT_ROOT, TOOLS_DIR, error, info, load_dotenv, ok, read_web_app_url, warn

ENV_PATH = TOOLS_DIR / ".env"
OAUTH_TOKEN = TOOLS_DIR / "credentials" / ".oauth-script-token.json"
SA_JSON = TOOLS_DIR / "credentials" / "feria-sheets-sa.json"
ADMIN_URL = "https://la-sucursal-del-cafe.web.app/admin"
SITE_URL = "https://la-sucursal-del-cafe.web.app"


def check_env() -> bool:
    ok_flag = True
    if not ENV_PATH.is_file():
        error("Falta tools/.env")
        return False
    text = ENV_PATH.read_text(encoding="utf-8")
    for key in ("GOOGLE_SHEET_ID", "SHEETS_WEB_APP_URL"):
        if f"{key}=" not in text or f"{key}=\n" in text:
            warn(f"tools/.env: revisa {key}")
            ok_flag = False
    if OAUTH_TOKEN.is_file():
        ok("Token OAuth Apps Script presente.")
    else:
        warn("Sin token OAuth — setup_admin.py abrirá el navegador la primera vez.")
    if SA_JSON.is_file():
        ok("Cuenta de servicio Google presente.")
    else:
        warn("Sin feria-sheets-sa.json (Sheets API local).")
    web_url = read_web_app_url()
    if web_url:
        ok(f"sheets-config.js → {web_url[:60]}…")
    else:
        error("js/sheets-config.js sin WEB_APP_URL válida.")
        ok_flag = False
    return ok_flag


def http_get(url: str, timeout: int = 45) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "fix-all/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def verify_admin_endpoint(web_url: str) -> bool:
    dash_url = web_url + ("&" if "?" in web_url else "?") + "action=admin_dashboard"
    info("Verificando admin_dashboard…")
    status, body = http_get(dash_url)
    if status != 200:
        error(f"admin_dashboard HTTP {status}")
        return False
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        error("admin_dashboard: respuesta no JSON.")
        return False
    if data.get("stats"):
        ok(f"admin_dashboard OK — feria={data['stats'].get('feriaRegistrations', '?')}")
        return True
    if data.get("ok") and data.get("message"):
        error("Apps Script desactualizado (falta admin_dashboard). Ejecuta setup_admin.py.")
        return False
    error(f"admin_dashboard falló: {data.get('error', data)}")
    return False


def verify_admin_page() -> bool:
    info(f"Verificando {ADMIN_URL}…")
    status, html = http_get(ADMIN_URL)
    if status != 200:
        error(f"/admin HTTP {status}")
        return False
    lower = html.lower()
    blocked = ["firebase-auth", "signinwithpopup", "googleauthprovider", "firebase-config.js", "gapi"]
    found = [t for t in blocked if t in lower]
    if found:
        error(f"/admin contiene referencias OAuth/Firebase: {', '.join(found)}")
        return False
    if "admin-dashboard.js" not in html:
        warn("/admin no carga admin-dashboard.js")
    ok("/admin sin Firebase Auth en el HTML.")
    return True


def verify_public_links() -> bool:
    info("Verificando rutas públicas…")
    paths = ["/", "/inscripcion", "/competencia", "/el-evento", "/qr"]
    failed = []
    for path in paths:
        st, _ = http_get(SITE_URL + path)
        if st != 200:
            failed.append(f"{path} → {st}")
    if failed:
        error("Rutas con error: " + ", ".join(failed))
        return False
    ok(f"{len(paths)} rutas públicas responden 200.")
    return True


def run_script(script: str, extra: list[str] | None = None) -> int:
    cmd = [sys.executable, f"tools/{script}", *(extra or [])]
    info("Ejecutando: " + " ".join(cmd))
    return subprocess.run(cmd, cwd=str(PROJECT_ROOT)).returncode


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    load_dotenv()
    solo = "--solo-verificar" in sys.argv

    print("=== fix_all.py — La Sucursal del Café ===\n")
    results: dict[str, bool] = {}

    results["env"] = check_env()
    web_url = read_web_app_url()

    if solo:
        rc = run_script("verify_admin.py")
        results["verify_admin"] = rc == 0
        results["admin_page"] = verify_admin_page()
        results["public_links"] = verify_public_links()
    else:
        if results["env"]:
            rc = run_script("setup_admin.py", ["--sin-firebase"])
            results["setup_admin"] = rc == 0
            web_url = read_web_app_url() or web_url
        else:
            results["setup_admin"] = False

        results["admin_endpoint"] = verify_admin_endpoint(web_url) if web_url else False

        rc_verify = run_script("verify_admin.py", ["--sin-panel"])
        results["verify_admin"] = rc_verify == 0

        rc_fb = run_script("deploy_firebase.py")
        results["firebase_deploy"] = rc_fb == 0

        results["admin_page"] = verify_admin_page()
        results["public_links"] = verify_public_links()

    print("\n=== Resumen ===")
    for name, passed in results.items():
        print(f"  [{'OK' if passed else 'FAIL'}] {name}")

    all_ok = all(results.values())
    if all_ok:
        ok("Todo verificado.")
        info(f"Panel: {ADMIN_URL}")
        info(f"Apps Script: {web_url or '(sin URL)'}")
        return 0
    error("Hay fallos — revisa el resumen arriba.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
