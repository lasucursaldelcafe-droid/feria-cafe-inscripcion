#!/usr/bin/env python3
"""
Verifica URLs públicas del sitio (Firebase Hosting) y endpoints clave de Apps Script.

Uso:
  python3 tools/verify_urls.py
  python3 tools/verify_urls.py --base https://la-sucursal-del-cafe.web.app
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTES_PATH = ROOT / "tools" / "routes.json"
CANONICAL_SHEETS = ROOT / "tools" / "CANONICAL_SHEETS_URL.txt"

DEFAULT_BASE = "https://la-sucursal-del-cafe.web.app"

EXTRA_PATHS = [
    "/assets/logo-la-sucursal-del-cafe.png",
    "/js/sheets-config.js",
    "/js/form-submit.js",
    "/robots.txt",
    "/sitemap.xml",
]

API_ACTIONS = [
    ("cupo", "ok"),
    ("patrocinadores_competencia_publico", "ok"),
    ("feria_resumen", "ok"),
]


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def fetch_status(url: str, timeout: float = 20.0) -> tuple[int, str]:
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": "feria-verify-urls/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.geturl()
    except urllib.error.HTTPError as exc:
        return exc.code, str(exc.reason)
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc)


def fetch_json(url: str, timeout: float = 25.0) -> tuple[bool, dict | str]:
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": "feria-verify-urls/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return True, json.loads(body)
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)


def sheets_url() -> str:
    if CANONICAL_SHEETS.exists():
        value = CANONICAL_SHEETS.read_text(encoding="utf-8").strip()
        if value:
            return value
    cfg = ROOT / "js" / "sheets-config.js"
    if cfg.exists():
        text = cfg.read_text(encoding="utf-8")
        marker = "WEB_APP_URL:"
        if marker in text:
            part = text.split(marker, 1)[1]
            quote = "'" if "'" in part else '"'
            start = part.find(quote) + 1
            end = part.find(quote, start)
            return part[start:end].strip()
    return ""


def main() -> int:
    parser = argparse.ArgumentParser(description="Verifica rutas del sitio Feria Café")
    parser.add_argument("--base", default=DEFAULT_BASE, help="URL base del hosting")
    args = parser.parse_args()

    base = args.base.rstrip("/")
    routes = load_json(ROUTES_PATH).get("routes", [])
    paths = sorted({r["hosted"] for r in routes if r.get("hosted")} | set(EXTRA_PATHS))

    print(f"Base: {base}\n")

    failed = 0

    print("== Páginas y assets ==")
    for path in paths:
        url = base if path == "/" else f"{base}{path}"
        status, detail = fetch_status(url)
        ok = 200 <= status < 400
        mark = "OK" if ok else "FAIL"
        print(f"[{mark}] {status:>3} {path}" + (f" — {detail}" if not ok else ""))
        if not ok:
            failed += 1

    print("\n== Legacy redirects (muestra) ==")
    legacy_samples = [
        "/competencia.html",
        "/inscripcion.html",
        "/festival",
        "/como-funciona-evento.html",
    ]
    for path in legacy_samples:
        url = f"{base}{path}"
        status, final = fetch_status(url)
        ok = 200 <= status < 400
        mark = "OK" if ok else "FAIL"
        redirected = final != url
        note = f" → {final}" if redirected else ""
        print(f"[{mark}] {status:>3} {path}{note}")
        if not ok:
            failed += 1

    sheets = sheets_url()
    print("\n== Apps Script ==")
    if not sheets:
        print("[FAIL] Sin URL de Apps Script (CANONICAL_SHEETS_URL.txt o js/sheets-config.js)")
        failed += 1
    else:
        print(f"URL: {sheets}")
        for action, key in API_ACTIONS:
            sep = "&" if "?" in sheets else "?"
            url = f"{sheets}{sep}action={action}"
            ok_json, payload = fetch_json(url)
            valid = ok_json and isinstance(payload, dict) and payload.get(key) is True
            mark = "OK" if valid else "FAIL"
            extra = ""
            if valid and action == "cupo":
                extra = f" count={payload.get('count')} max={payload.get('max')}"
            print(f"[{mark}] action={action}{extra}")
            if not valid:
                failed += 1
                if not ok_json:
                    print(f"       {payload}")

    print(f"\nResumen: {failed} fallo(s)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
