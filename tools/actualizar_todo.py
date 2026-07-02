#!/usr/bin/env python3
"""
Automatización integral del sitio:

1. Sincroniza rutas (site-links.js, firebase.json, sitemap.xml).
2. Genera js/sheets-config.js con la URL canónica de Apps Script.
3. Verifica Apps Script/admin.
4. Opcionalmente redespliega Apps Script.
5. Opcionalmente despliega Firebase Hosting.

Uso recomendado:
  python3 tools/actualizar_todo.py
  python3 tools/actualizar_todo.py --sin-deploy
  python3 tools/actualizar_todo.py --apps-script
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(args: list[str], *, allow_fail: bool = False) -> int:
    print(f"[RUN] {' '.join(args)}")
    proc = subprocess.run(args, cwd=ROOT, text=True)
    if proc.returncode and not allow_fail:
        raise RuntimeError(f"Falló ({proc.returncode}): {' '.join(args)}")
    return proc.returncode


def read_canonical_url() -> str:
    path = ROOT / "tools" / "CANONICAL_SHEETS_URL.txt"
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Corre actualización completa del sitio.")
    parser.add_argument("--sin-deploy", action="store_true", help="No despliega Firebase Hosting.")
    parser.add_argument("--apps-script", action="store_true", help="También redespliega Apps Script con setup_admin.py.")
    parser.add_argument("--sin-verificar", action="store_true", help="Omite verify_admin.py.")
    args = parser.parse_args()

    try:
        run([sys.executable, "tools/sync_routes.py"])
        run([sys.executable, "tools/sync_routes.py", "--check"])

        url = read_canonical_url()
        if url:
            run([sys.executable, "tools/conectar_sheets.py", "--configurar-url", url])
        else:
            print("[AVISO] Sin tools/CANONICAL_SHEETS_URL.txt; se omite sheets-config.js")

        if args.apps_script:
            run([sys.executable, "tools/setup_admin.py", "--sin-firebase"])

        if not args.sin_verificar:
            verify_cmd = [sys.executable, "tools/verify_admin.py"]
            if url:
                verify_cmd += ["--url", url]
            run(verify_cmd)

        if not args.sin_deploy:
            run([sys.executable, "tools/deploy_firebase.py"])

        print("[OK] Actualización integral completada.")
        return 0
    except Exception as exc:  # noqa: BLE001 - CLI friendly
        print(f"[ERROR] {exc}", file=sys.stderr)
        print()
        print("Si el deploy falla por autenticación Firebase, configura una de estas opciones:")
        print("  - FIREBASE_TOKEN")
        print("  - FIREBASE_SERVICE_ACCOUNT_JSON=/ruta/service-account.json")
        print("  - Ejecutar deploy desde GitHub Actions con FIREBASE_SERVICE_ACCOUNT")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
