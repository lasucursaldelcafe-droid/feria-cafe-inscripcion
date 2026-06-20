#!/usr/bin/env python3
"""Valida config OAuth/Firebase del panel admin (3 intentos documentados)."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FIREBASE_CONFIG = PROJECT_ROOT / "js" / "firebase-config.js"
PROJECT_ID = "la-sucursal-del-cafe"
INIT_JSON = f"https://{PROJECT_ID}.firebaseapp.com/__/firebase/init.json"


def read_firebase_config() -> dict[str, str]:
    text = FIREBASE_CONFIG.read_text(encoding="utf-8")
    cfg: dict[str, str] = {}
    for key in ("apiKey", "authDomain", "projectId", "appId", "messagingSenderId"):
        marker = f"{key}: '"
        if marker in text:
            start = text.index(marker) + len(marker)
            end = text.index("'", start)
            cfg[key] = text[start:end]
    return cfg


def fetch_json(url: str, timeout: int = 20) -> tuple[int, dict | str]:
    req = urllib.request.Request(url, headers={"User-Agent": "check-oauth/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(body)
        except json.JSONDecodeError:
            return exc.code, body


def main() -> int:
    print("=== check_oauth.py — panel admin La Sucursal del Café ===\n")

    if not FIREBASE_CONFIG.is_file():
        print("[FAIL] Falta js/firebase-config.js")
        return 1

    local = read_firebase_config()
    print("Config local:")
    for k, v in local.items():
        print(f"  {k}: {v}")

    status, remote = fetch_json(INIT_JSON)
    print(f"\nHosting init.json ({status}):")
    if isinstance(remote, dict):
        print(json.dumps(remote, indent=2))
        mismatches = [k for k in ("apiKey", "authDomain", "projectId", "appId") if remote.get(k) != local.get(k)]
        if mismatches:
            print(f"\n[WARN] Diferencias vs local: {', '.join(mismatches)}")
        else:
            print("\n[OK] init.json coincide con firebase-config.js")
    else:
        print(remote)

    api_key = local.get("apiKey", "")
    if api_key:
        cfg_url = (
            "https://identitytoolkit.googleapis.com/v1/projects?"
            f"key={urllib.parse.quote(api_key)}"
        )
        st, auth_cfg = fetch_json(cfg_url)
        print(f"\nIdentity Toolkit ({st}):")
        if isinstance(auth_cfg, dict):
            providers = auth_cfg.get("signIn", {}).get("allowDuplicateEmails")
            print(json.dumps(auth_cfg, indent=2)[:1200])
        else:
            print(str(auth_cfg)[:800])
            if "invalid_client" in str(auth_cfg).lower() or st == 401:
                print("\n[FAIL] OAuth client inválido — error típico GeneralOAuthFlow / invalid_client")
                print("  → Firebase Console → Authentication → Sign-in method → Google → Enable")
                print("  → Google Cloud Console → APIs & Services → Credentials → Web client (auto created by Firebase)")

    print("\n--- Resumen de 3 intentos ---")
    print("1. sdkconfig + deploy --only auth (config OK si init.json coincide)")
    print("2. signInWithRedirect (requiere OAuth client válido en GCP)")
    print("3. Verificar Credentials en GCP; si falla → panel abierto sin login (ALLOW_PUBLIC_ADMIN)")
    print("\nPanel actual: https://la-sucursal-del-cafe.web.app/admin (sin login)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
