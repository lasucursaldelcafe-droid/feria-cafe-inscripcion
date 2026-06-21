#!/usr/bin/env python3
"""
Verificación rápida del panel admin y analítica propia (pageviews).

Uso:
  py tools/verify_admin.py
  py tools/verify_admin.py --url https://script.google.com/macros/s/.../exec
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime

from _util import error, info, load_dotenv, ok, read_web_app_url, warn

SITE_BASE = "https://la-sucursal-del-cafe.web.app"
SITE_ADMIN = SITE_BASE + "/admin"
SITE_STANDS = SITE_BASE + "/stands"


def http_json(url: str, method: str = "GET", payload: dict | None = None, timeout: int = 60) -> tuple[int, dict]:
    data = None
    headers = {"User-Agent": "verify-admin/1.0"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "text/plain;charset=utf-8"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(body)
        except json.JSONDecodeError:
            return exc.code, {"raw": body}


def http_text(url: str, timeout: int = 45) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "verify-admin/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def verify_health(web_url: str) -> bool:
    status, data = http_json(web_url, "GET")
    if status != 200 or not data.get("ok"):
        error(f"Health GET falló: HTTP {status} — {data}")
        return False
    forms = data.get("forms", [])
    ok(f"Health OK — forms: {forms}")
    return True


def verify_dashboard(web_url: str) -> bool:
    dash_url = web_url + ("&" if "?" in web_url else "?") + "action=admin_dashboard"
    status, data = http_json(dash_url, "GET")
    if status != 200:
        error(f"admin_dashboard HTTP {status}")
        return False
    if not data.get("stats"):
        if data.get("ok") and data.get("message"):
            error("Apps Script desactualizado: falta admin_dashboard. Ejecuta py tools/setup_admin.py")
        else:
            error(f"admin_dashboard sin stats: {data.get('error', data)}")
        return False
    stats = data["stats"]
    ok(
        "admin_dashboard OK — "
        f"visitas={stats.get('visitsTotal', '?')} "
        f"feria={stats.get('feriaRegistrations', '?')} "
        f"comp={stats.get('competenciaRegistrations', '?')}"
    )
    if stats.get("analyticsSource") == "sheet_pageviews":
        ok("Fuente: analítica propia (Google Sheets)")
    return True


def verify_pageview(web_url: str) -> bool:
    status, data = http_json(
        web_url,
        "POST",
        {
            "action": "pageview",
            "path": "/verify-admin-test",
            "title": "Verify admin",
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "referrer": "verify_admin.py",
            "sessionId": "verify_session",
            "userAgent": "verify-admin/1.0",
        },
    )
    if data.get("ok"):
        ok("Pageview POST OK.")
        return True
    if data.get("error") == "formType inválido.":
        error("Pageview no implementado en el deploy. Redeploy Code.gs.")
        return False
    error(f"Pageview falló: {data}")
    return False


def verify_stands_map(web_url: str) -> bool:
    map_url = web_url + ("&" if "?" in web_url else "?") + "action=stands_map"
    status, data = http_json(map_url, "GET")
    if status != 200:
        error(f"stands_map HTTP {status}")
        return False
    if not data.get("ok"):
        error(f"stands_map falló: {data.get('error', data)}")
        return False
    occupied = data.get("occupied")
    if not isinstance(occupied, list):
        error("stands_map sin lista occupied")
        return False
    ok(f"stands_map OK — {len(occupied)} stand(s) ocupado(s)")
    return True


def verify_stands_page() -> bool:
    status, html = http_text(SITE_STANDS)
    if status != 200:
        error(f"/stands HTTP {status}")
        return False
    required = ["stands-map.js", "standsMapRoot"]
    missing = [token for token in required if token not in html]
    if missing:
        error(f"/stands falta contenido del mapa: {', '.join(missing)}")
        return False
    asset_status, _ = http_text(SITE_BASE + "/assets/stands-map-placeholder.svg")
    if asset_status != 200:
        error(f"Asset del mapa HTTP {asset_status}: /assets/stands-map-placeholder.svg")
        return False
    ok(f"Página de stands accesible: {SITE_STANDS}")
    return True


def verify_admin_page() -> bool:
    status, html = http_text(SITE_ADMIN)
    if status != 200:
        error(f"/admin HTTP {status}")
        return False
    lower = html.lower()
    blocked = ["firebase-auth", "signinwithpopup", "googleauthprovider", "firebase-config.js"]
    found = [t for t in blocked if t in lower]
    if found:
        error(f"/admin contiene OAuth/Firebase: {', '.join(found)}")
        return False
    if "admin-dashboard.js" not in html:
        warn("/admin no referencia admin-dashboard.js")
    ok(f"Panel accesible: {SITE_ADMIN}")
    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verifica admin_dashboard y pageview.")
    parser.add_argument("--url", help="URL /exec de Apps Script (default: sheets-config.js)")
    parser.add_argument("--sin-panel", action="store_true", help="No verificar /admin en hosting")
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    load_dotenv()
    args = parse_args()
    web_url = (args.url or read_web_app_url()).strip()
    if not web_url:
        error("No hay WEB_APP_URL. Configura js/sheets-config.js o pasa --url.")
        return 1

    info(f"Apps Script: {web_url[:70]}…")
    results = {
        "health": verify_health(web_url),
        "stands_map": verify_stands_map(web_url),
        "stands": verify_stands_page(),
        "dashboard": verify_dashboard(web_url),
        "pageview": verify_pageview(web_url),
    }
    if not args.sin_panel:
        results["admin_page"] = verify_admin_page()

    print("\n=== verify_admin.py ===")
    for name, passed in results.items():
        print(f"  [{'OK' if passed else 'FAIL'}] {name}")

    if all(results.values()):
        ok("Verificación completa.")
        return 0
    error("Hay fallos — ejecuta py tools/setup_admin.py")
    return 2


if __name__ == "__main__":
    sys.exit(main())
