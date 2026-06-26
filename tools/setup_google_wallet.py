#!/usr/bin/env python3
"""
Asistente Google Wallet — usa la misma cuenta de servicio que Firebase CI.

Uso recomendado (automático):
  py tools/setup_google_wallet.py --auto

CI (GitHub Actions): tools/configure_wallet_firebase.py en deploy-firebase.yml
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

FIREBASE_HOSTING_SA = TOOLS_DIR / "credentials" / "firebase-hosting-sa.json"
WALLET_SA = TOOLS_DIR / "credentials" / "google-wallet-sa.json"
ENV_PATH = TOOLS_DIR / ".env"
FUNCTIONS_DIR = PROJECT_ROOT / "functions"
DEFAULT_ISSUER_ID = "3388000000023162431"
CONFIGURE_SCRIPT = PROJECT_ROOT / "tools" / "configure_wallet_firebase.py"

WALLET_CONSOLE = "https://pay.google.com/business/console"
GCP_APIS = f"https://console.cloud.google.com/apis/library/wallet.googleapis.com?project={DEFAULT_FIREBASE_PROJECT}"


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


def resolve_firebase_sa() -> Path | None:
    raw = read_env_var("FIREBASE_SERVICE_ACCOUNT_JSON").strip()
    if raw:
        path = Path(raw).expanduser()
        if path.is_file():
            return path.resolve()
    if FIREBASE_HOSTING_SA.is_file():
        return FIREBASE_HOSTING_SA
    return None


def print_checklist() -> None:
    print()
    info("Google Wallet — modo automático (lasucursaldelcafe@gmail.com / Firebase SA):")
    print("  py tools/setup_google_wallet.py --auto")
    print()
    info("En cada push a main, GitHub Actions ejecuta configure_wallet_firebase.py + deploy.")
    print("  Issuer ID:", DEFAULT_ISSUER_ID)
    info("Guía: GOOGLE-WALLET-SETUP.md")


def cmd_auto(issuer_id: str) -> int:
    sa = resolve_firebase_sa()
    if not sa:
        error(f"Falta {FIREBASE_HOSTING_SA} (misma clave que FIREBASE_SERVICE_ACCOUNT en GitHub).")
        info("Descárgala: Firebase Console → Project settings → Service accounts → Generate new private key")
        return 1

    iid = issuer_id or read_env_var("GOOGLE_WALLET_ISSUER_ID") or DEFAULT_ISSUER_ID
    try:
        data = json.loads(sa.read_text(encoding="utf-8"))
        update_env_var("GOOGLE_WALLET_ISSUER_ID", iid)
        if data.get("client_email"):
            update_env_var("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL", data["client_email"])
    except json.JSONDecodeError:
        pass

    rc = run_cmd(
        [
            sys.executable,
            str(CONFIGURE_SCRIPT),
            "--service-account",
            str(sa),
            "--issuer-id",
            iid,
            "--enable-apis",
        ]
    )
    if rc != 0:
        return rc
    return cmd_deploy()


def cmd_configurar_firebase(issuer_id: str) -> int:
    """Legacy: google-wallet-sa.json dedicado."""
    if not WALLET_SA.is_file():
        warn("Sin google-wallet-sa.json — usando firebase-hosting-sa.json")
        return cmd_auto(issuer_id)

    iid = issuer_id or read_env_var("GOOGLE_WALLET_ISSUER_ID") or DEFAULT_ISSUER_ID
    firebase = ["firebase"] if shutil.which("firebase") else ["npx", "-y", "firebase-tools@latest"]
    sa_json = WALLET_SA.read_text(encoding="utf-8")
    rc = run_cmd(
        [
            *firebase,
            "functions:config:set",
            f"wallet.issuer_id={iid}",
            f"wallet.service_account={sa_json}",
            "wallet.class_suffix=la_sucursal_fidelizacion",
            f"--project={DEFAULT_FIREBASE_PROJECT}",
        ]
    )
    if rc != 0:
        return rc
    update_env_var("GOOGLE_WALLET_ISSUER_ID", iid)
    ok("Firebase Functions configurado.")
    return 0


def cmd_deploy() -> int:
    if not (FUNCTIONS_DIR / "package.json").is_file():
        error("No existe carpeta functions/")
        return 1
    rc = run_cmd(["npm", "install"], cwd=FUNCTIONS_DIR)
    if rc != 0:
        return rc
    firebase = ["firebase"] if shutil.which("firebase") else ["npx", "-y", "firebase-tools@latest"]
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
    sa = resolve_firebase_sa()
    if sa:
        try:
            email = json.loads(sa.read_text(encoding="utf-8")).get("client_email", "?")
            ok(f"Firebase SA: {email}")
        except json.JSONDecodeError:
            warn(f"JSON inválido: {sa}")
            ok_flag = False
    else:
        warn("Sin firebase-hosting-sa.json (CI usa FIREBASE_SERVICE_ACCOUNT en GitHub).")
        ok_flag = False

    iid = read_env_var("GOOGLE_WALLET_ISSUER_ID") or DEFAULT_ISSUER_ID
    ok(f"Issuer ID: {iid}")

    info(
        f"URL: https://us-central1-{DEFAULT_FIREBASE_PROJECT}.cloudfunctions.net/generateWalletPass"
    )
    return 0 if ok_flag else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Google Wallet — configuración automática.")
    parser.add_argument("--auto", action="store_true", help="Config + deploy con firebase-hosting-sa.json.")
    parser.add_argument("--configurar-firebase", action="store_true", help="Solo config en Firebase.")
    parser.add_argument("--deploy", action="store_true", help="Solo deploy function + hosting.")
    parser.add_argument("--verificar", action="store_true", help="Comprueba archivos locales.")
    parser.add_argument("--abrir", action="store_true", help="Abrir Wallet Console.")
    parser.add_argument("--issuer-id", default="", help=f"Issuer ID (default {DEFAULT_ISSUER_ID}).")
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

    if args.auto:
        return cmd_auto(args.issuer_id)

    if args.configurar_firebase:
        if resolve_firebase_sa() and not WALLET_SA.is_file():
            sa = resolve_firebase_sa()
            assert sa
            iid = args.issuer_id or read_env_var("GOOGLE_WALLET_ISSUER_ID") or DEFAULT_ISSUER_ID
            return run_cmd(
                [
                    sys.executable,
                    str(CONFIGURE_SCRIPT),
                    "--service-account",
                    str(sa),
                    "--issuer-id",
                    iid,
                    "--enable-apis",
                ]
            )
        return cmd_configurar_firebase(args.issuer_id)

    if args.deploy:
        return cmd_deploy()

    if args.verificar:
        return cmd_verificar()

    print_checklist()
    return 0


if __name__ == "__main__":
    sys.exit(main())
