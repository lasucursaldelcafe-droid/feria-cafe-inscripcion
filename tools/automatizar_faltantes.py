#!/usr/bin/env python3
"""
Audita y corrige automáticamente lo pendiente del ecosistema Feria Café.

Uso:
  py tools/automatizar_faltantes.py              # Solo auditar
  py tools/automatizar_faltantes.py --aplicar    # Corregir todo lo automático
  py tools/automatizar_faltantes.py --oauth       # Flujo OAuth Apps Script (navegador)
  py tools/automatizar_faltantes.py --reporte      # Genera docs/reporte-faltantes.html
  py tools/automatizar_faltantes.py --gui           # App Windows (tkinter)

Windows (doble clic):
  AUTOMATIZAR.bat
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Callable

from _util import (
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
CANONICAL_URL = TOOLS_DIR / "CANONICAL_SHEETS_URL.txt"
OAUTH_TOKEN = TOOLS_DIR / "credentials" / ".oauth-script-token.json"
FIREBASE_SA = TOOLS_DIR / "credentials" / "firebase-hosting-sa.json"
WALLET_FN = (
    f"https://us-central1-{DEFAULT_FIREBASE_PROJECT}.cloudfunctions.net/generateWalletPass"
)
REPORT_HTML = PROJECT_ROOT / "docs" / "reporte-faltantes.html"
SITE = f"https://{DEFAULT_FIREBASE_PROJECT}.web.app"


class Estado(str, Enum):
    OK = "ok"
    WARN = "warn"
    FAIL = "fail"
    MANUAL = "manual"


@dataclass
class Faltante:
    id: str
    titulo: str
    estado: Estado
    detalle: str
    auto: bool = False
    comando: str = ""
    enlace: str = ""


@dataclass
class InformeFaltantes:
    generado: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    items: list[Faltante] = field(default_factory=list)

    @property
    def criticos(self) -> list[Faltante]:
        return [i for i in self.items if i.estado == Estado.FAIL]

    @property
    def pendientes_auto(self) -> list[Faltante]:
        return [i for i in self.items if i.estado != Estado.OK and i.auto]

    @property
    def pendientes_manual(self) -> list[Faltante]:
        return [i for i in self.items if i.estado in (Estado.WARN, Estado.FAIL, Estado.MANUAL) and not i.auto]


def read_canonical_url() -> str:
    if CANONICAL_URL.is_file():
        return CANONICAL_URL.read_text(encoding="utf-8").strip()
    return ""


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


def write_env_var(key: str, value: str) -> None:
    lines: list[str] = []
    found = False
    if ENV_PATH.is_file():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith(f"{key}="):
                lines.append(f"{key}={value}")
                found = True
            else:
                lines.append(line)
    else:
        example = TOOLS_DIR / ".env.example"
        if example.is_file():
            lines = example.read_text(encoding="utf-8").splitlines()
            for i, line in enumerate(lines):
                if line.strip().startswith(f"{key}="):
                    lines[i] = f"{key}={value}"
                    found = True
    if not found:
        lines.append(f"{key}={value}")
    ENV_PATH.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def sync_env_from_canonical() -> bool:
    url = read_canonical_url()
    if not url or "/exec" not in url:
        warn("Sin URL canónica en tools/CANONICAL_SHEETS_URL.txt")
        return False
    write_env_var("SHEETS_WEB_APP_URL", url)
    write_env_var("APPS_SCRIPT_URL", url)
    write_sheets_config(url)
    ok(f"tools/.env y sheets-config.js ← URL canónica")
    return True


def resolve_apps_script_id() -> str:
    sid = read_env_var("APPS_SCRIPT_ID")
    if sid:
        return sid
    clasp = TOOLS_DIR / "google-apps-script" / ".clasp.json"
    if clasp.is_file():
        try:
            data = json.loads(clasp.read_text(encoding="utf-8"))
            sid = str(data.get("scriptId", "")).strip()
            if sid:
                write_env_var("APPS_SCRIPT_ID", sid)
                return sid
        except json.JSONDecodeError:
            pass
    return ""


def http_status(url: str, *, method: str = "GET", timeout: int = 15) -> int:
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "automatizar-faltantes/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except OSError:
        return 0


def run_py(script: str, args: list[str] | None = None, *, log: Callable[[str], None] | None = None) -> int:
    cmd = [sys.executable, f"tools/{script}", *(args or [])]
    line = " ".join(cmd)
    if log:
        log(f">>> {line}")
    else:
        info(line)
    proc = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=bool(log), text=True, encoding="utf-8", errors="replace")
    if log:
        if proc.stdout:
            for ln in proc.stdout.splitlines():
                log(ln)
        if proc.stderr:
            for ln in proc.stderr.splitlines():
                log(ln)
    return proc.returncode


def auditar_faltantes() -> InformeFaltantes:
    load_dotenv()
    informe = InformeFaltantes()
    canonical = read_canonical_url()
    env_url = read_env_var("SHEETS_WEB_APP_URL")
    local_url = read_web_app_url()
    prod_cfg = http_status(f"{SITE}/js/sheets-config.js")

    # 1 URL canónica / sheets-config
    if canonical and local_url == canonical and env_url == canonical:
        informe.items.append(Faltante("url_canonical", "URL Apps Script (local)", Estado.OK, canonical[:60] + "…"))
    elif canonical:
        mismatch = env_url and env_url != canonical
        informe.items.append(
            Faltante(
                "url_canonical",
                "URL Apps Script desincronizada",
                Estado.WARN if mismatch else Estado.FAIL,
                f".env={'desactualizada' if mismatch else 'vacía'}; canónica={canonical[:50]}…",
                auto=True,
                comando="py tools/automatizar_faltantes.py --aplicar",
            )
        )
    else:
        informe.items.append(
            Faltante("url_canonical", "URL canónica", Estado.FAIL, "Falta tools/CANONICAL_SHEETS_URL.txt", auto=False)
        )

    # 2 Producción sheets-config
    if prod_cfg == 200:
        informe.items.append(Faltante("prod_sheets", "sheets-config.js en producción", Estado.OK, SITE))
    else:
        informe.items.append(
            Faltante(
                "prod_sheets",
                "Deploy Firebase",
                Estado.FAIL,
                f"HTTP {prod_cfg} en /js/sheets-config.js",
                auto=True,
                comando="py tools/deploy_firebase.py",
            )
        )

    # 3 Apps Script health
    if canonical:
        health = http_status(f"{canonical}?action=health")
        if health == 200:
            informe.items.append(Faltante("apps_script", "Apps Script /exec", Estado.OK, "health OK"))
        else:
            informe.items.append(
                Faltante(
                    "apps_script",
                    "Apps Script no responde",
                    Estado.FAIL,
                    f"health → HTTP {health}",
                    auto=True,
                    comando="py tools/setup_admin.py --sin-firebase",
                )
            )

    # 4 OAuth token local
    if OAUTH_TOKEN.is_file():
        informe.items.append(Faltante("oauth_local", "Token OAuth local", Estado.OK, str(OAUTH_TOKEN.name)))
    else:
        informe.items.append(
            Faltante(
                "oauth_local",
                "Token OAuth Apps Script",
                Estado.WARN,
                "Requiere autorizar Google en el navegador (una vez)",
                auto=True,
                comando="py tools/automatizar_faltantes.py --oauth",
                enlace="https://script.google.com/home",
            )
        )

    # 5 APPS_SCRIPT_ID
    sid = resolve_apps_script_id()
    if sid:
        informe.items.append(Faltante("script_id", "APPS_SCRIPT_ID", Estado.OK, sid[:20] + "…"))
    else:
        informe.items.append(
            Faltante(
                "script_id",
                "APPS_SCRIPT_ID",
                Estado.WARN,
                "Vacío — necesario para CI Apps Script",
                auto=bool(read_env_var("GOOGLE_SHEET_ID")),
                comando="py tools/_find_script_id.py",
                enlace="https://script.google.com/home",
            )
        )

    # 6 GOOGLE_SHEET_ID
    sheet_id = read_env_var("GOOGLE_SHEET_ID")
    if sheet_id:
        informe.items.append(
            Faltante(
                "sheet_id",
                "GOOGLE_SHEET_ID",
                Estado.OK,
                sheet_id,
                enlace=f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit",
            )
        )
    else:
        informe.items.append(
            Faltante(
                "sheet_id",
                "GOOGLE_SHEET_ID en tools/.env",
                Estado.MANUAL,
                "Opcional si el script ya está vinculado a la hoja",
                auto=False,
                comando="# Pegar ID en tools/.env o GUI → campo Hoja",
            )
        )

    # 7 Firebase SA local
    if FIREBASE_SA.is_file():
        informe.items.append(Faltante("firebase_sa", "Cuenta servicio Firebase", Estado.OK, "firebase-hosting-sa.json"))
    else:
        informe.items.append(
            Faltante(
                "firebase_sa",
                "firebase-hosting-sa.json",
                Estado.WARN,
                "Descargar desde Firebase Console",
                auto=False,
                enlace=f"https://console.firebase.google.com/project/{DEFAULT_FIREBASE_PROJECT}/settings/serviceaccounts/adminsdk",
                comando="py tools/setup_github_ci.py --wait-sa",
            )
        )

    # 8 GitHub CLI
    if shutil.which("gh"):
        informe.items.append(Faltante("gh_cli", "GitHub CLI", Estado.OK, "gh disponible"))
        informe.items.append(
            Faltante(
                "github_secrets",
                "Secretos GitHub (CI)",
                Estado.WARN if not OAUTH_TOKEN.is_file() else Estado.OK,
                "Sincronizar tras OAuth + SA",
                auto=OAUTH_TOKEN.is_file() and FIREBASE_SA.is_file(),
                comando="py tools/setup_github_ci.py && py tools/setup_github_ci.py --apps-script",
                enlace="https://github.com/lasucursaldelcafe-droid/feria-cafe-inscripcion/settings/secrets/actions",
            )
        )
    else:
        informe.items.append(
            Faltante(
                "gh_cli",
                "GitHub CLI (gh)",
                Estado.MANUAL,
                "Instalar para subir secretos automáticamente",
                auto=False,
                enlace="https://cli.github.com/",
            )
        )

    # 9 Google Wallet (opcional)
    wallet_st = http_status(WALLET_FN)
    if wallet_st == 404:
        informe.items.append(
            Faltante(
                "wallet",
                "Google Wallet (opcional)",
                Estado.WARN,
                "generateWalletPass → 404",
                auto=FIREBASE_SA.is_file(),
                comando="py tools/setup_google_wallet.py --auto",
                enlace="https://pay.google.com/business/console",
            )
        )
    elif wallet_st == 200:
        informe.items.append(Faltante("wallet", "Google Wallet", Estado.OK, "Cloud Function activa"))
    else:
        informe.items.append(Faltante("wallet", "Google Wallet", Estado.WARN, f"HTTP {wallet_st}"))

    # 10 tools/.env
    if ENV_PATH.is_file():
        informe.items.append(Faltante("env_file", "tools/.env", Estado.OK, str(ENV_PATH)))
    else:
        informe.items.append(
            Faltante(
                "env_file",
                "tools/.env",
                Estado.FAIL,
                "Copiar desde .env.example",
                auto=True,
                comando="copy tools\\.env.example tools\\.env",
            )
        )

    return informe


def imprimir_informe(informe: InformeFaltantes) -> None:
    print(f"\n=== Reporte de faltantes — {DEFAULT_FIREBASE_PROJECT} ===\n")
    icon = {Estado.OK: "OK", Estado.WARN: "AVISO", Estado.FAIL: "FALTA", Estado.MANUAL: "MANUAL"}
    for item in informe.items:
        mark = icon.get(item.estado, "?")
        auto = " [auto]" if item.auto and item.estado != Estado.OK else ""
        print(f"  [{mark}]{auto} {item.titulo}")
        print(f"         {item.detalle}")
        if item.comando and item.estado != Estado.OK:
            print(f"         → {item.comando}")
        if item.enlace:
            print(f"         → {item.enlace}")
    print()
    ok_count = sum(1 for i in informe.items if i.estado == Estado.OK)
    pend = len(informe.items) - ok_count
    if pend == 0:
        ok("Todo conectado — no hay faltantes.")
    else:
        warn(f"{ok_count}/{len(informe.items)} OK — {pend} pendiente(s).")
        auto_n = len(informe.pendientes_auto)
        if auto_n:
            info(f"Puedes corregir {auto_n} automáticamente: py tools/automatizar_faltantes.py --aplicar")


def aplicar_correcciones(
    *,
    oauth: bool = False,
    wallet: bool = False,
    deploy: bool = False,
    ci: bool = True,
    log: Callable[[str], None] | None = None,
) -> int:
    """Ejecuta fixes automáticos en orden seguro."""
    rc = 0

    if not ENV_PATH.is_file():
        example = TOOLS_DIR / ".env.example"
        if example.is_file():
            shutil.copy(example, ENV_PATH)
            if log:
                log("[OK] Creado tools/.env desde plantilla")

    run_py("agent_setup_completo.py", ["--solo-env"], log=log)
    sync_env_from_canonical()

    if read_env_var("GOOGLE_SHEET_ID") and not read_env_var("APPS_SCRIPT_ID"):
        if run_py("_find_script_id.py", log=log) != 0:
            rc = 1

    if oauth:
        if log:
            log("Abriendo OAuth Google — autoriza en el navegador si aparece…")
        if run_py("setup_admin.py", ["--sin-firebase"], log=log) != 0:
            warn("OAuth incompleto — repite con --oauth")
            rc = 1
    elif not OAUTH_TOKEN.is_file():
        warn("Sin token OAuth — omite deploy Apps Script (usa --oauth en tu PC con navegador)")
    else:
        run_py("setup_admin.py", ["--sin-firebase"], log=log)

    run_py("conectar_sheets.py", ["--verificar"], log=log)

    if ci and shutil.which("gh"):
        if FIREBASE_SA.is_file():
            run_py("setup_github_ci.py", log=log)
        if OAUTH_TOKEN.is_file():
            run_py("setup_github_ci.py", ["--apps-script"], log=log)

    if wallet and FIREBASE_SA.is_file():
        run_py("setup_google_wallet.py", ["--auto"], log=log)

    if deploy and FIREBASE_SA.is_file():
        if run_py("deploy_firebase.py", log=log) != 0:
            rc = 1
    elif deploy:
        warn("Deploy omitido — falta firebase-hosting-sa.json")

    run_py("verificar_todo.py", log=log)

    informe = auditar_faltantes()
    imprimir_informe(informe)
    return rc


def generar_reporte_html(informe: InformeFaltantes) -> Path:
    REPORT_HTML.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    colors = {
        Estado.OK: "#5F7F4E",
        Estado.WARN: "#C47A2C",
        Estado.FAIL: "#BB5E3C",
        Estado.MANUAL: "#6B5346",
    }
    for item in informe.items:
        link = f'<a href="{item.enlace}">{item.enlace}</a>' if item.enlace else "—"
        cmd = f"<code>{item.comando}</code>" if item.comando else "—"
        rows.append(
            f"<tr><td style='color:{colors[item.estado]};font-weight:600'>{item.estado.value.upper()}</td>"
            f"<td>{item.titulo}</td><td>{item.detalle}</td><td>{cmd}</td><td>{link}</td></tr>"
        )

    html = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Reporte faltantes — Feria Café</title>
<style>
body{{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#4B352A}}
h1{{border-bottom:3px solid #BB5E3C;padding-bottom:.5rem}}
table{{width:100%;border-collapse:collapse;font-size:.9rem}}
th,td{{border:1px solid #ddd;padding:.5rem;text-align:left;vertical-align:top}}
th{{background:#4B352A;color:#fff}}
.actions{{margin:1.5rem 0;padding:1rem;background:#f5f0e8;border-radius:8px}}
code{{background:#eee;padding:.1rem .3rem;border-radius:4px;font-size:.85rem}}
</style></head><body>
<h1>Reporte de faltantes</h1>
<p>Generado: {informe.generado} UTC · <a href="{SITE}">{SITE}</a></p>
<div class="actions">
<strong>Automatizar en Windows:</strong> doble clic en <code>AUTOMATIZAR.bat</code><br>
<strong>Corregir todo:</strong> <code>py tools/automatizar_faltantes.py --aplicar</code><br>
<strong>App gráfica:</strong> <code>py tools/feria_automatizador_gui.py</code>
</div>
<table>
<thead><tr><th>Estado</th><th>Ítem</th><th>Detalle</th><th>Comando</th><th>Enlace</th></tr></thead>
<tbody>
{"".join(rows)}
</tbody></table>
<p><a href="informe-conectividad-100.html">Informe conectividad completo</a></p>
</body></html>"""
    REPORT_HTML.write_text(html, encoding="utf-8")
    ok(f"Reporte HTML: {REPORT_HTML}")
    return REPORT_HTML


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Audita y corrige faltantes del ecosistema Feria Café.")
    p.add_argument("--auditar", action="store_true", help="Solo listar faltantes (default).")
    p.add_argument("--aplicar", action="store_true", help="Corregir automáticamente lo posible.")
    p.add_argument("--oauth", action="store_true", help="Forzar flujo OAuth Apps Script.")
    p.add_argument("--wallet", action="store_true", help="Intentar configurar Google Wallet.")
    p.add_argument("--deploy", action="store_true", help="Deploy Firebase tras correcciones.")
    p.add_argument("--sin-ci", action="store_true", help="No sincronizar secretos GitHub.")
    p.add_argument("--reporte", action="store_true", help="Generar docs/reporte-faltantes.html.")
    p.add_argument("--gui", action="store_true", help="Abrir app gráfica Windows.")
    return p.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()

    if args.gui:
        return run_py("feria_automatizador_gui.py")

    informe = auditar_faltantes()

    if args.aplicar or args.oauth or args.wallet or args.deploy:
        rc = aplicar_correcciones(
            oauth=args.oauth,
            wallet=args.wallet,
            deploy=args.deploy,
            ci=not args.sin_ci,
        )
        informe = auditar_faltantes()
    else:
        imprimir_informe(informe)
        rc = 0

    if args.reporte or args.aplicar:
        generar_reporte_html(informe)

    return rc


if __name__ == "__main__":
    sys.exit(main())
