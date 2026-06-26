#!/usr/bin/env python3
"""
Configura Google Wallet en Firebase Functions usando la misma cuenta de servicio
que CI (FIREBASE_SERVICE_ACCOUNT / firebase-hosting-sa.json).

No requiere google-wallet-sa.json ni invitar @appspot.

Uso (local o GitHub Actions):
  FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' py tools/configure_wallet_firebase.py
  py tools/configure_wallet_firebase.py --service-account tools/credentials/firebase-hosting-sa.json
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from _util import DEFAULT_FIREBASE_PROJECT, PROJECT_ROOT, TOOLS_DIR, error, info, ok, warn

FIREBASE_HOSTING_SA = TOOLS_DIR / "credentials" / "firebase-hosting-sa.json"
DEFAULT_ISSUER_ID = "3388000000023162431"
CLASS_SUFFIX = "la_sucursal_fidelizacion"


def load_service_account(path: Path | None, raw_env: str) -> dict:
    if raw_env.strip():
        return json.loads(raw_env)
    if path and path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    if FIREBASE_HOSTING_SA.is_file():
        return json.loads(FIREBASE_HOSTING_SA.read_text(encoding="utf-8"))
    raise FileNotFoundError(
        "Falta FIREBASE_SERVICE_ACCOUNT o tools/credentials/firebase-hosting-sa.json"
    )


def firebase_cmd() -> list[str]:
    if shutil.which("firebase"):
        return ["firebase"]
    return ["npx", "-y", "firebase-tools@latest"]


def run_config_set(sa: dict, issuer_id: str) -> int:
    email = sa.get("client_email", "")
    if not email:
        error("client_email ausente en la cuenta de servicio.")
        return 1

    sa_compact = json.dumps(sa, separators=(",", ":"), ensure_ascii=False)
    cmd = [
        *firebase_cmd(),
        "functions:config:set",
        f"wallet.issuer_id={issuer_id}",
        f"wallet.service_account_email={email}",
        f"wallet.service_account={sa_compact}",
        f"wallet.class_suffix={CLASS_SUFFIX}",
        f"--project={DEFAULT_FIREBASE_PROJECT}",
        "--non-interactive",
    ]
    info("Configurando wallet.* en Firebase Functions…")
    info(f"  issuer_id={issuer_id}")
    info(f"  service_account_email={email}")
    result = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True)
    if result.stdout:
        print(result.stdout.rstrip())
    if result.returncode != 0:
        if result.stderr:
            error(result.stderr.strip()[:800])
        return result.returncode
    ok("wallet.issuer_id + wallet.service_account configurados.")
    return 0


def enable_apis(sa_path: Path | None) -> None:
    """Habilita APIs necesarias si gcloud está disponible (opcional en CI)."""
    if not shutil.which("gcloud"):
        return
    creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if not creds and sa_path and sa_path.is_file():
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(sa_path.resolve())
    apis = ("wallet.googleapis.com", "iamcredentials.googleapis.com")
    for api in apis:
        subprocess.run(
            [
                "gcloud",
                "services",
                "enable",
                api,
                f"--project={DEFAULT_FIREBASE_PROJECT}",
                "--quiet",
            ],
            capture_output=True,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Configura Wallet en Firebase Functions (automático).")
    parser.add_argument("--service-account", type=Path, help="Ruta al JSON de Firebase Admin SDK.")
    parser.add_argument("--issuer-id", default=os.environ.get("GOOGLE_WALLET_ISSUER_ID", DEFAULT_ISSUER_ID))
    parser.add_argument("--enable-apis", action="store_true", help="Intentar habilitar APIs con gcloud.")
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")

    try:
        sa = load_service_account(args.service_account, raw)
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        error(str(exc))
        return 1

    if sa.get("project_id") != DEFAULT_FIREBASE_PROJECT:
        warn(f"project_id={sa.get('project_id')} (esperado {DEFAULT_FIREBASE_PROJECT})")

    if args.enable_apis:
        sa_path = args.service_account or (FIREBASE_HOSTING_SA if FIREBASE_HOSTING_SA.is_file() else None)
        enable_apis(sa_path)

    return run_config_set(sa, args.issuer_id.strip())


if __name__ == "__main__":
    sys.exit(main())
