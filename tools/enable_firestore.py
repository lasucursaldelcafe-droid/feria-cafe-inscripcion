#!/usr/bin/env python3
"""
Habilita Firestore API y crea la base de datos (si hay cuenta de servicio).

Uso:
  FIREBASE_SERVICE_ACCOUNT='...' python3 tools/enable_firestore.py
  python3 tools/enable_firestore.py --service-account tools/credentials/firebase-hosting-sa.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

from _util import DEFAULT_FIREBASE_PROJECT, TOOLS_DIR, error, info, ok, warn

FIREBASE_HOSTING_SA = TOOLS_DIR / "credentials" / "firebase-hosting-sa.json"


def load_sa(path: str | None) -> dict:
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if raw:
        return json.loads(raw)
    p = path or str(FIREBASE_HOSTING_SA)
    if os.path.isfile(p):
        return json.loads(open(p, encoding="utf-8").read())
    raise FileNotFoundError("Falta FIREBASE_SERVICE_ACCOUNT o --service-account")


def get_access_token(sa: dict) -> str:
    import jwt  # type: ignore
    import time

    now = int(time.time())
    payload = {
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/cloud-platform",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }
    assertion = jwt.encode(payload, sa["private_key"], algorithm="RS256")
    data = (
        f"grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion={assertion}"
    ).encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode())
    return body["access_token"]


def enable_api(token: str, project: str, service: str) -> None:
    url = f"https://serviceusage.googleapis.com/v1/projects/{project}/services/{service}:enable"
    req = urllib.request.Request(url, method="POST", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
        ok(f"API habilitada: {service}")
    except urllib.error.HTTPError as exc:
        if exc.code in (409, 200):
            ok(f"API ya habilitada: {service}")
        else:
            raise


def create_firestore(token: str, project: str) -> None:
    url = f"https://firestore.googleapis.com/v1/projects/{project}/databases?databaseId=(default)"
    body = json.dumps({"locationId": "nam5", "type": "FIRESTORE_NATIVE"}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
        ok("Base de datos Firestore creada (nam5).")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        if exc.code == 409 or "ALREADY_EXISTS" in detail:
            ok("Firestore ya existe en el proyecto.")
        else:
            warn(f"No se pudo crear Firestore automáticamente: HTTP {exc.code}")
            info(detail[:400])


def main() -> int:
    parser = argparse.ArgumentParser(description="Habilita Firestore en el proyecto Firebase.")
    parser.add_argument("--project", default=DEFAULT_FIREBASE_PROJECT)
    parser.add_argument("--service-account", help="JSON cuenta de servicio Firebase Admin.")
    args = parser.parse_args()

    try:
        sa = load_sa(args.service_account)
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        error(str(exc))
        info("Mientras tanto, los pasaportes usan Google Sheets automáticamente (Code.gs).")
        return 1

    try:
        import jwt  # noqa: F401
    except ImportError:
        error("Instala PyJWT: pip install PyJWT")
        return 1

    try:
        token = get_access_token(sa)
        enable_api(token, args.project, "firestore.googleapis.com")
        create_firestore(token, args.project)
    except Exception as exc:
        error(str(exc))
        return 1

    info("Despliega reglas: npx firebase-tools deploy --only firestore:rules --project " + args.project)
    return 0


if __name__ == "__main__":
    sys.exit(main())
