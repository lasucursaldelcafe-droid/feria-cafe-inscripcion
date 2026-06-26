#!/usr/bin/env python3
"""
Escribe functions/.env para Google Wallet (CI y local).
Evita functions:config:set (deprecado en firebase-tools 2026).

Uso:
  FIREBASE_SERVICE_ACCOUNT='...' py tools/configure_wallet_firebase.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from _util import DEFAULT_FIREBASE_PROJECT, PROJECT_ROOT, TOOLS_DIR, error, info, ok, warn

FIREBASE_HOSTING_SA = TOOLS_DIR / "credentials" / "firebase-hosting-sa.json"
FUNCTIONS_ENV = PROJECT_ROOT / "functions" / ".env"
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


def write_functions_env(sa: dict, issuer_id: str) -> int:
    email = sa.get("client_email", "")
    if not email:
        error("client_email ausente en la cuenta de servicio.")
        return 1

    sa_compact = json.dumps(sa, separators=(",", ":"), ensure_ascii=False)
    # Firebase carga functions/.env en deploy; JSON en una línea entre comillas simples
    escaped = sa_compact.replace("'", "'\"'\"'")
    lines = [
        f"GOOGLE_WALLET_ISSUER_ID={issuer_id}",
        f"GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL={email}",
        f"GOOGLE_WALLET_CLASS_SUFFIX={CLASS_SUFFIX}",
        f"GOOGLE_WALLET_SERVICE_ACCOUNT='{escaped}'",
    ]
    FUNCTIONS_ENV.write_text("\n".join(lines) + "\n", encoding="utf-8")
    ok(f"Escrito {FUNCTIONS_ENV}")
    info(f"  issuer_id={issuer_id}")
    info(f"  service_account_email={email}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera functions/.env para Wallet.")
    parser.add_argument("--service-account", type=Path, help="JSON Firebase Admin SDK.")
    parser.add_argument("--issuer-id", default=os.environ.get("GOOGLE_WALLET_ISSUER_ID", DEFAULT_ISSUER_ID))
    parser.add_argument("--enable-apis", action="store_true", help="Ignorado (compat CI).")
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

    return write_functions_env(sa, args.issuer_id.strip())


if __name__ == "__main__":
    sys.exit(main())
