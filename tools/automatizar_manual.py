#!/usr/bin/env python3
"""
Automatiza los pasos manuales de mantenimiento y despliegue.

Orquesta: secretos CI, Apps Script, sheets-config, Firebase deploy y verificación.

Uso:
  py tools/automatizar_manual.py --todo
  py tools/automatizar_manual.py --ci
  py tools/automatizar_manual.py --apps-script
  py tools/automatizar_manual.py --deploy
  py tools/automatizar_manual.py --verificar
  py tools/automatizar_manual.py --abrir-urls
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import webbrowser
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
    read_web_app_url,
    warn,
    write_sheets_config,
)

ENV_PATH = TOOLS_DIR / ".env"
OAUTH_TOKEN = TOOLS_DIR / "credentials" / ".oauth-script-token.json"
FIREBASE_HOSTING_SA = TOOLS_DIR / "credentials" / "firebase-hosting-sa.json"

USEFUL_URLS: dict[str, str] = {
    "Firebase Console": f"https://console.firebase.google.com/project/{DEFAULT_FIREBASE_PROJECT}",
    "Firebase Hosting": f"https://console.firebase.google.com/project/{DEFAULT_FIREBASE_PROJECT}/hosting",
    "Firebase Service accounts": (
        f"https://console.firebase.google.com/project/{DEFAULT_FIREBASE_PROJECT}"
        "/settings/serviceaccounts/adminsdk"
    ),
    "GitHub Actions": "",  # filled at runtime
    "Apps Script (editor)": "",  # filled from APPS_SCRIPT_ID
    "Panel admin": f"https://{DEFAULT_FIREBASE_PROJECT}.web.app/admin",
    "Sitio producción": f"https://{DEFAULT_FIREBASE_PROJECT}.web.app",
}


def read_env_var(key: str) -> str:
    if not ENV_PATH.is_file():
        return ""
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, _, value = line.partition("=")
        if k.strip() == key:
            return value.strip().strip('"').strip("'")
    return ""


def run_script(script: str, extra: list[str] | None = None, *, required: bool = True) -> int:
    cmd = [sys.executable, f"tools/{script}", *(extra or [])]
    info("Ejecutando: " + " ".join(cmd))
    rc = subprocess.run(cmd, cwd=str(PROJECT_ROOT)).returncode
    if rc != 0 and required:
        error(f"{script} terminó con código {rc}")
    return rc


def detect_github_repo_url() -> str:
    result = subprocess.run(
        ["gh", "repo", "view", "--json", "url"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode == 0 and result.stdout.strip():
        try:
            return json.loads(result.stdout).get("url", "") + "/actions"
        except json.JSONDecodeError:
            pass
    return "https://github.com (abre tu repo → Actions)"


def open_useful_urls(*, include_github: bool = True) -> None:
    load_dotenv()
    urls = dict(USEFUL_URLS)
    if include_github and shutil.which("gh"):
        urls["GitHub Actions"] = detect_github_repo_url()

    script_id = read_env_var("APPS_SCRIPT_ID")
    if script_id:
        urls["Apps Script (editor)"] = f"https://script.google.com/home/projects/{script_id}/edit"

    sheet_id = read_env_var("GOOGLE_SHEET_ID")
    if sheet_id:
        urls["Google Sheet"] = f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit"

    for label, url in urls.items():
        if not url:
            continue
        info(f"Abriendo: {label}")
        webbrowser.open(url)


def print_sincronizar_encabezados_reminder() -> None:
    print()
    warn("Recordatorio tras cambios en Code.gs:")
    print("  Ejecuta sincronizarEncabezados() una vez en el editor de Apps Script:")
    script_id = read_env_var("APPS_SCRIPT_ID")
    if script_id:
        print(f"  1. Abre https://script.google.com/home/projects/{script_id}/edit")
    else:
        print("  1. Abre tu proyecto Apps Script (Extensiones → Apps Script desde la hoja)")
    print("  2. Selecciona la función sincronizarEncabezados en el desplegable")
    print("  3. Clic en Ejecutar (▶)")
    print("  4. Autoriza permisos si lo pide")
    print()
    info("Alternativa: redeploy con py tools/setup_admin.py (sube Code.gs actualizado).")
    info(f"Código: {CODE_GS_PATH}")


def check_env_basics() -> bool:
    ok_flag = True
    if not ENV_PATH.is_file():
        warn(f"Falta {ENV_PATH} — copia tools/.env.example")
        ok_flag = False
    else:
        ok(f"{ENV_PATH} presente.")

    web_url = read_web_app_url()
    env_url = read_env_var("SHEETS_WEB_APP_URL")
    if web_url:
        ok(f"sheets-config.js → {web_url[:55]}…")
    elif env_url:
        warn("SHEETS_WEB_APP_URL en .env pero falta js/sheets-config.js — se sincronizará.")
    else:
        warn("Sin WEB_APP_URL — necesario para formularios y CI.")

    if OAUTH_TOKEN.is_file():
        ok("Token OAuth Apps Script presente.")
    else:
        warn("Sin token OAuth — setup_admin.py abrirá el navegador la primera vez.")

    return ok_flag


def step_sheets_config() -> bool:
    print("\n--- sheets-config.js ---\n")
    load_dotenv()
    url = read_web_app_url()
    env_url = read_env_var("SHEETS_WEB_APP_URL") or read_env_var("APPS_SCRIPT_URL")

    if not url and env_url and "/exec" in env_url:
        write_sheets_config(env_url)
        ok(f"Generado {SHEETS_CONFIG_PATH} desde tools/.env")
        url = env_url

    if not url:
        error("No hay URL /exec. Ejecuta --apps-script o configura tools/.env")
        info('  py tools/conectar_sheets.py --configurar-url "https://script.google.com/.../exec"')
        return False

    rc = run_script("conectar_sheets.py", ["--verificar"], required=False)
    return rc == 0


def step_ci(*, wait_sa: bool = False, run_workflow: bool = False) -> bool:
    print("\n--- GitHub CI secrets ---\n")
    args = ["tools/setup_github_ci.py"]
    if wait_sa or not FIREBASE_HOSTING_SA.is_file():
        args.append("--wait-sa")
    if run_workflow:
        args.append("--run-workflow")

    rc = subprocess.run([sys.executable, *args], cwd=str(PROJECT_ROOT)).returncode
    if rc != 0:
        info("Diagnóstico: py tools/validate_ci_secrets.py")
        return False

    run_script("validate_ci_secrets.py", required=False)
    return rc == 0


def step_apps_script(*, sin_firebase: bool = True) -> bool:
    print("\n--- Apps Script (Code.gs + redeploy) ---\n")

    if not CODE_GS_PATH.is_file():
        error(f"No existe {CODE_GS_PATH}")
        return False

    extra = ["--sin-firebase"] if sin_firebase else []
    rc = run_script("setup_admin.py", extra, required=False)
    if rc != 0:
        if not OAUTH_TOKEN.is_file():
            info("OAuth requerido — vuelve a ejecutar tras autorizar en el navegador:")
            info("  py tools/setup_admin.py --sin-firebase")
        return False

    print_sincronizar_encabezados_reminder()
    step_sheets_config()
    return True


def step_deploy() -> bool:
    print("\n--- Firebase Hosting ---\n")
    rc = run_script("deploy_firebase.py", required=False)
    if rc != 0:
        info("Alternativas de autenticación:")
        print("  npx -y firebase-tools@latest login")
        print(f"  py tools/deploy_firebase.py --service-account {FIREBASE_HOSTING_SA}")
        return False
    ok(f"Sitio: https://{DEFAULT_FIREBASE_PROJECT}.web.app")
    return True


def step_verify(*, sin_panel: bool = False) -> bool:
    print("\n--- Verificación completa ---\n")
    extra = ["--sin-panel"] if sin_panel else []
    rc = run_script("verify_admin.py", extra, required=False)
    return rc == 0


def print_summary(results: dict[str, bool]) -> None:
    print("\n=== Resumen automatizar_manual.py ===")
    for name, passed in results.items():
        status = "OK" if passed else "PENDIENTE/FAIL"
        print(f"  [{status}] {name}")

    failed = [k for k, v in results.items() if not v]
    if failed:
        print()
        error(f"Pasos incompletos: {', '.join(failed)}")
        info("Comandos útiles:")
        if "ci" in failed:
            print("  py tools/automatizar_manual.py --ci")
        if "apps_script" in failed:
            print("  py tools/automatizar_manual.py --apps-script")
        if "sheets_config" in failed:
            print("  py tools/automatizar_manual.py --sheets-config")
        if "deploy" in failed:
            print("  py tools/automatizar_manual.py --deploy")
        if "verificar" in failed:
            print("  py tools/automatizar_manual.py --verificar")
    else:
        ok("Todos los pasos completados.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automatiza pasos manuales de CI, Apps Script, deploy y verificación.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Flujo recomendado tras cambiar Code.gs o antes de un release:\n"
            "  py tools/automatizar_manual.py --todo\n"
        ),
    )
    parser.add_argument("--todo", action="store_true", help="Pipeline completo en orden.")
    parser.add_argument("--ci", action="store_true", help="Secretos GitHub Actions.")
    parser.add_argument("--apps-script", action="store_true", help="Subir Code.gs y redeploy Web App.")
    parser.add_argument("--sheets-config", action="store_true", help="Sincronizar y verificar sheets-config.js.")
    parser.add_argument("--deploy", action="store_true", help="Firebase Hosting (deploy_firebase.py).")
    parser.add_argument("--verificar", action="store_true", help="verify_admin.py completo.")
    parser.add_argument("--abrir-urls", action="store_true", help="Abrir consolas útiles en el navegador.")
    parser.add_argument("--run-workflow", action="store_true", help="Con --ci: lanzar GitHub Actions y esperar.")
    parser.add_argument("--sin-firebase-en-apps-script", action="store_true", help="setup_admin.py también despliega Firebase.")
    parser.add_argument("--sin-panel", action="store_true", help="verify_admin sin comprobar /admin en hosting.")
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    load_dotenv()
    args = parse_args()

    flags = [args.todo, args.ci, args.apps_script, args.sheets_config, args.deploy, args.verificar, args.abrir_urls]
    if sum(1 for f in flags if f) == 0:
        error("Indica al menos una acción: --todo, --ci, --apps-script, --deploy, --verificar, …")
        info("Ejecuta con -h para ver opciones.")
        return 1

    print("=== automatizar_manual.py — La Sucursal del Café ===\n")

    if args.abrir_urls:
        open_useful_urls()
        if not args.todo and sum(1 for f in flags if f) == 1:
            return 0

    results: dict[str, bool] = {}

    if args.todo or args.ci or args.apps_script or args.sheets_config or args.deploy or args.verificar:
        check_env_basics()

    do_todo = args.todo

    sin_fb = not args.sin_firebase_en_apps_script

    if args.sheets_config and not do_todo:
        results["sheets_config"] = step_sheets_config()

    if do_todo or args.apps_script:
        results["apps_script"] = step_apps_script(sin_firebase=sin_fb)

    if do_todo or args.sheets_config:
        results["sheets_config"] = step_sheets_config()

    if do_todo or args.ci:
        results["ci"] = step_ci(wait_sa=do_todo, run_workflow=args.run_workflow)

    if do_todo or args.deploy:
        if (do_todo or args.apps_script) and not sin_fb and results.get("apps_script"):
            info("Deploy Firebase ya ejecutado vía setup_admin.py")
            results["deploy"] = True
        else:
            results["deploy"] = step_deploy()

    if do_todo or args.verificar:
        results["verificar"] = step_verify(sin_panel=args.sin_panel)

    if results:
        print_summary(results)

    if results and not all(results.values()):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
