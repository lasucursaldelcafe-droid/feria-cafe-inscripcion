#!/usr/bin/env python3
"""
Asistente de configuración Google Wallet para fidelización.

Uso:
  py tools/setup_google_wallet.py
  py tools/setup_google_wallet.py --sin-json --configurar-firebase   # sin descargar JSON
  py tools/setup_google_wallet.py --configurar-firebase              # con JSON local
  py tools/setup_google_wallet.py --deploy
  py tools/setup_google_wallet.py --verificar
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import webbrowser
from pathlib import Path

from _util import DEFAULT_FIREBASE_PROJECT, PROJECT_ROOT, TOOLS_DIR, error, info, ok, warn

WALLET_SA = TOOLS_DIR / "credentials" / "google-wallet-sa.json"
ENV_PATH = TOOLS_DIR / ".env"
FUNCTIONS_DIR = PROJECT_ROOT / "functions"
DEFAULT_WALLET_SA_EMAIL = f"{DEFAULT_FIREBASE_PROJECT}@appspot.gserviceaccount.com"

WALLET_CONSOLE = "https://pay.google.com/business/console"
GCP_APIS = "https://console.cloud.google.com/apis/library/wallet.googleapis.com?project=la-sucursal-del-cafe"
GCP_IAM_CRED = (
    "https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com"
    f"?project={DEFAULT_FIREBASE_PROJECT}"
)
GCP_SA = "https://console.cloud.google.com/iam-admin/serviceaccounts?project=la-sucursal-del-cafe"


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
    ok(f"tools/.env → {key}")


def run_cmd(cmd: list[str], *, cwd: Path | None = None) -> int:
    info("Ejecutando: " + " ".join(cmd))
    return subprocess.run(cmd, cwd=str(cwd or PROJECT_ROOT)).returncode


def validate_wallet_sa(path: Path) -> bool:
    if not path.is_file():
        error(f"No existe {path}")
        info("Descarga el JSON desde Google Cloud → Service accounts → Keys")
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        error(f"JSON inválido: {exc}")
        return False
    for field in ("client_email", "private_key", "project_id"):
        if field not in data:
            error(f"Falta campo '{field}' en el JSON")
            return False
    ok(f"Cuenta de servicio: {data['client_email']}")
    return True


def print_checklist() -> None:
    print()
    info("Checklist Google Wallet (sin JSON — recomendado si no puedes descargar clave):")
    print("  1. Issuer ID →", WALLET_CONSOLE)
    print("  2. Habilitar Wallet API + IAM Credentials API")
    print(f"  3. Invitar en Wallet Console: {DEFAULT_WALLET_SA_EMAIL}")
    print("  4. py tools/setup_google_wallet.py --sin-json --configurar-firebase")
    print("  5. py tools/setup_google_wallet.py --deploy")
    print()
    info("Alternativa con JSON local (si tu proyecto lo permite):")
    print(f"  - JSON en {WALLET_SA}")
    print("  - py tools/setup_google_wallet.py --configurar-firebase")
    print()
    info("Guía completa: GOOGLE-WALLET-SETUP.md")


def cmd_configurar_firebase_iam(issuer_id: str, service_account_email: str) -> int:
    iid = issuer_id or read_env_var("GOOGLE_WALLET_ISSUER_ID")
    if not iid:
        error("Falta Issuer ID.")
        info("Usa --issuer-id 3388000000023162431 o GOOGLE_WALLET_ISSUER_ID en tools/.env")
        webbrowser.open(WALLET_CONSOLE)
        return 2

    email = (service_account_email or read_env_var("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL") or DEFAULT_WALLET_SA_EMAIL).strip()
    if not email.endswith(".iam.gserviceaccount.com") and not email.endswith("@appspot.gserviceaccount.com"):
        warn(f"Email inusual para SA: {email}")

    if not shutil.which("firebase"):
        firebase = ["npx", "-y", "firebase-tools@latest"]
    else:
        firebase = ["firebase"]

    rc = run_cmd(
        [
            *firebase,
            "functions:config:set",
            f"wallet.issuer_id={iid}",
            f"wallet.service_account_email={email}",
            "wallet.class_suffix=la_sucursal_fidelizacion",
            f"--project={DEFAULT_FIREBASE_PROJECT}",
        ]
    )
    if rc != 0:
        error("No se pudo guardar config. ¿firebase login con lasucursaldelcafe@gmail.com?")
        return rc

    update_env_var("GOOGLE_WALLET_ISSUER_ID", iid)
    update_env_var("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL", email)
    ok("Firebase Functions configurado (modo IAM signJwt, sin JSON).")
    info(f"Invita en Wallet Console: {email}")
    info("APIs: Wallet + IAM Credentials deben estar habilitadas.")
    return 0


def cmd_configurar_firebase(issuer_id: str) -> int:
    if not validate_wallet_sa(WALLET_SA):
        return 1

    iid = issuer_id or read_env_var("GOOGLE_WALLET_ISSUER_ID")
    if not iid:
        error("Falta Issuer ID.")
        info("Añade GOOGLE_WALLET_ISSUER_ID en tools/.env o usa --issuer-id")
        webbrowser.open(WALLET_CONSOLE)
        return 2

    if not shutil.which("firebase"):
        warn("Firebase CLI no encontrado — usa npx:")
        firebase = ["npx", "-y", "firebase-tools@latest"]
    else:
        firebase = ["firebase"]

    sa_json = WALLET_SA.read_text(encoding="utf-8")
    # firebase functions:config:set acepta pares clave=valor
    rc = run_cmd(
        [
            *firebase,
            "functions:config:set",
            f"wallet.issuer_id={iid}",
            f'wallet.service_account={sa_json}',
            "wallet.class_suffix=la_sucursal_fidelizacion",
            f"--project={DEFAULT_FIREBASE_PROJECT}",
        ]
    )
    if rc != 0:
        error("No se pudo guardar config. Prueba manualmente (ver GOOGLE-WALLET-SETUP.md).")
        return rc

    update_env_var("GOOGLE_WALLET_ISSUER_ID", iid)
    ok("Firebase Functions configurado para Google Wallet.")
    return 0


def cmd_deploy() -> int:
    if not (FUNCTIONS_DIR / "package.json").is_file():
        error("No existe carpeta functions/")
        return 1

    rc = run_cmd(["npm", "install"], cwd=FUNCTIONS_DIR)
    if rc != 0:
        return rc

    if shutil.which("firebase"):
        firebase = ["firebase"]
    else:
        firebase = ["npx", "-y", "firebase-tools@latest"]

    return run_cmd(
        [
            *firebase,
            "deploy",
            "--only",
            "functions:generateWalletPass,hosting",
            f"--project={DEFAULT_FIREBASE_PROJECT}",
        ]
    )


def cmd_verificar() -> int:
    ok_flag = True
    sin_json = read_env_var("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL")

    if validate_wallet_sa(WALLET_SA):
        info("Modo JSON: google-wallet-sa.json presente")
    elif sin_json:
        ok(f"Modo sin JSON: {sin_json}")
    else:
        warn("Sin JSON ni GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL en tools/.env")
        info(f"Sugerencia: usa --sin-json con {DEFAULT_WALLET_SA_EMAIL}")
        ok_flag = False

    iid = read_env_var("GOOGLE_WALLET_ISSUER_ID")
    if iid:
        ok(f"Issuer ID en .env: {iid}")
    else:
        warn("GOOGLE_WALLET_ISSUER_ID no está en tools/.env")
        ok_flag = False

    url = f"https://us-central1-{DEFAULT_FIREBASE_PROJECT}.cloudfunctions.net/generateWalletPass"
    info(f"URL esperada de la función: {url}")
    info("Prueba POST con clienteId desde mi-tarjeta.html en Android.")

    return 0 if ok_flag else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Configura Google Wallet para fidelización.")
    parser.add_argument("--configurar-firebase", action="store_true", help="Sube issuer + SA (JSON) a Firebase.")
    parser.add_argument(
        "--sin-json",
        action="store_true",
        help="Configura issuer + email SA sin archivo JSON (IAM signJwt).",
    )
    parser.add_argument("--deploy", action="store_true", help="npm install + deploy function + hosting.")
    parser.add_argument("--verificar", action="store_true", help="Comprueba archivos locales.")
    parser.add_argument("--abrir", action="store_true", help="Abrir consolas Google.")
    parser.add_argument("--issuer-id", help="Issuer ID numérico de Wallet Console.")
    parser.add_argument(
        "--service-account-email",
        help=f"Email SA para Wallet (default: {DEFAULT_WALLET_SA_EMAIL})",
    )
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()
    print("=== setup_google_wallet.py ===\n")

    if args.abrir:
        webbrowser.open(WALLET_CONSOLE)
        webbrowser.open(GCP_APIS)
        webbrowser.open(GCP_IAM_CRED)

    if args.sin_json and args.configurar_firebase:
        return cmd_configurar_firebase_iam(args.issuer_id or "", args.service_account_email or "")

    if args.configurar_firebase:
        return cmd_configurar_firebase(args.issuer_id or "")

    if args.deploy:
        return cmd_deploy()

    if args.verificar:
        return cmd_verificar()

    print_checklist()
    if not WALLET_SA.is_file():
        webbrowser.open(GCP_SA)
    return 0


if __name__ == "__main__":
    sys.exit(main())
