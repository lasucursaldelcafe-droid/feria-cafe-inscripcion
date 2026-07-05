#!/usr/bin/env python3
"""
Verificación integral: sitio en producción, Apps Script, repo local y CI.

Uso:
  py tools/verificar_todo.py
  py tools/verificar_todo.py --json
  py tools/verificar_todo.py --solo-web
  py tools/verificar_todo.py --solo-repo
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from _util import PROJECT_ROOT, TOOLS_DIR, error, info, load_dotenv, ok, read_canonical_web_app_url, read_web_app_url, warn

SITE_BASE = "https://la-sucursal-del-cafe.web.app"
WALLET_FN = (
    "https://us-central1-la-sucursal-del-cafe.cloudfunctions.net/generateWalletPass"
)

# Rutas públicas canónicas (firebase.json + SiteLinks)
HOSTING_ROUTES: list[tuple[str, str, bool]] = [
    ("/", "Inicio", True),
    ("/el-evento", "El evento", True),
    ("/actividades", "Actividades", True),
    ("/patrocinadores", "Patrocinadores", True),
    ("/inscripcion", "Inscripción feria", True),
    ("/competencia", "V60 Championship", True),
    ("/como-funciona", "Cómo funciona", True),
    ("/reglas", "Reglamento", True),
    ("/privacidad", "Privacidad", True),
    ("/qr", "QR inscripción", True),
    ("/festival", "Alias festival", True),
    ("/stands", "Stands", True),
    ("/marcas", "Marcas", True),
    ("/pasaporte", "Pasaporte cafetero", True),
    ("/escanear-pasaporte", "Escanear pasaporte", True),
    ("/fidelizacion", "Fidelización", True),
    ("/registro-fidelizacion", "Registro fidelización", True),
    ("/mi-tarjeta", "Tarjeta cliente", True),
    ("/admin", "Panel admin", True),
    ("/panel-fidelizacion", "Panel fidelización", True),
    ("/expositor", "Panel expositor", True),
    ("/mi-stand", "Alias mi-stand", True),
    ("/stands-reserva", "Stands reserva (legacy → /stands)", True),
    ("/stands-reserva-firebase", "Stands reserva Firebase → /stands", True),
    ("/jurado-v60", "Consola principal jurado", True),
    ("/jurado/config", "Jurado configuración", True),
    ("/jurado/organizador", "Jurado organizador", True),
    ("/jurado/juez", "Jurado juez", True),
    ("/jurado/resultados", "Jurado resultados", True),
    ("/competencia/torneo", "Inscripción torneo tenant", True),
]

CRITICAL_ASSETS = [
    "/robots.txt",
    "/sitemap.xml",
    "/css/brand.css",
    "/js/site-links.js",
    "/js/form-submit.js",
    "/js/event-config.js",
    "/js/sheets-config.js",
    "/js/admin-dashboard.js",
    "/js/fidelizacion-common.js",
    "/assets/logo-la-sucursal-del-cafe.png",
    "/assets/sponsors/purist.webp",
    "/assets/sponsors/palmetto-plaza.png",
    "/assets/sponsors/marca-placeholder.svg",
    "/assets/sponsors/ghost-specialty-coffee.svg",
    "/assets/sponsors/medium-cafe.svg",
    "/assets/sponsors/elixir-cafe.svg",
    "/assets/sponsors/black-coffee-design.svg",
    "/assets/reglas-v60-championship.pdf",
    "/assets/stands-map-placeholder.svg",
]

REQUIRED_REPO_FILES = [
    "firebase.json",
    "firestore.rules",
    "tools/google-apps-script/Code.gs",
    "js/sheets-config.example.js",
    "js/site-links.js",
    ".github/workflows/deploy-firebase.yml",
]


@dataclass
class CheckResult:
    id: str
    category: str
    passed: bool
    detail: str
    remediation: str = ""
    optional: bool = False


@dataclass
class VerificationReport:
    timestamp: str
    site_base: str
    checks: list[CheckResult] = field(default_factory=list)

    @property
    def failed(self) -> list[CheckResult]:
        return [c for c in self.checks if not c.passed and not c.optional]

    @property
    def warnings(self) -> list[CheckResult]:
        return [c for c in self.checks if not c.passed and c.optional]

    @property
    def ok(self) -> bool:
        return len(self.failed) == 0


def http_status(url: str, *, method: str = "GET", body: bytes | None = None, timeout: int = 45) -> int:
    headers = {"User-Agent": "verificar-todo/1.0"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except urllib.error.URLError:
        return 0


def http_json(url: str, *, method: str = "GET", payload: dict | None = None, timeout: int = 60) -> tuple[int, dict]:
    data = None
    headers = {"User-Agent": "verificar-todo/1.0"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "text/plain;charset=utf-8"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, {"raw": raw[:200]}
    except urllib.error.URLError as exc:
        return 0, {"error": str(exc)}


def http_text(url: str, timeout: int = 45) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "verificar-todo/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        return 0, str(exc)


def resolve_web_app_url() -> str:
    load_dotenv()
    local = read_web_app_url()
    if local and "/exec" in local:
        return local
    status, html = http_text(f"{SITE_BASE}/js/sheets-config.js")
    if status == 200:
        match = re.search(r"WEB_APP_URL:\s*'([^']+)'", html)
        if match and "/exec" in match.group(1):
            return match.group(1)
    return ""


def add(report: VerificationReport, **kwargs) -> None:
    report.checks.append(CheckResult(**kwargs))


def check_hosting_routes(report: VerificationReport) -> None:
    for path, label, required in HOSTING_ROUTES:
        url = SITE_BASE + path
        status = http_status(url)
        passed = status == 200
        add(
            report,
            id=f"route:{path}",
            category="hosting",
            passed=passed,
            detail=f"{label} → HTTP {status}",
            remediation="py tools/deploy_firebase.py" if required and not passed else "",
            optional=not required,
        )


def check_assets(report: VerificationReport) -> None:
    for path in CRITICAL_ASSETS:
        status = http_status(SITE_BASE + path)
        passed = status == 200
        add(
            report,
            id=f"asset:{path}",
            category="hosting",
            passed=passed,
            detail=f"{path} → HTTP {status}",
            remediation="py tools/deploy_firebase.py" if not passed else "",
        )


def check_sheets_config_prod(report: VerificationReport) -> None:
    status, html = http_text(f"{SITE_BASE}/js/sheets-config.js")
    if status != 200:
        add(
            report,
            id="sheets_config_prod",
            category="backend",
            passed=False,
            detail=f"sheets-config.js HTTP {status}",
            remediation="py tools/conectar_sheets.py --configurar-url \"URL/exec\"",
        )
        return
    if "TU_ID_DE_DEPLOYMENT" in html or "WEB_APP_URL: ''" in html:
        add(
            report,
            id="sheets_config_prod",
            category="backend",
            passed=False,
            detail="WEB_APP_URL vacía o placeholder en producción",
            remediation="gh secret set SHEETS_WEB_APP_URL --body \"$(cat tools/CANONICAL_SHEETS_URL.txt)\"",
        )
        return
    canonical = read_canonical_web_app_url()
    match = re.search(r"WEB_APP_URL:\s*'([^']+)'", html)
    prod_url = match.group(1) if match else ""
    url_ok = bool(prod_url and "/exec" in prod_url)
    if canonical and prod_url and prod_url.rstrip("/") != canonical.rstrip("/"):
        add(
            report,
            id="sheets_config_prod",
            category="backend",
            passed=False,
            detail=f"Producción usa URL distinta a tools/CANONICAL_SHEETS_URL.txt",
            remediation='gh secret set SHEETS_WEB_APP_URL --body "$(cat tools/CANONICAL_SHEETS_URL.txt)" && gh workflow run "Deploy Firebase Hosting"',
        )
        return
    add(
        report,
        id="sheets_config_prod",
        category="backend",
        passed=url_ok,
        detail="sheets-config.js con URL /exec en producción" + (f" ({prod_url[:50]}…)" if prod_url else ""),
        remediation="gh secret set SHEETS_WEB_APP_URL" if not url_ok else "",
    )


def check_apps_script(report: VerificationReport, web_url: str) -> None:
    if not web_url:
        add(
            report,
            id="apps_script_url",
            category="backend",
            passed=False,
            detail="No hay URL de Apps Script",
            remediation="py tools/setup_admin.py --sin-firebase",
        )
        return

    tests: list[tuple[str, str, str, str]] = [
        ("health", web_url, "GET", ""),
        ("cupo", f"{web_url}?action=cupo", "GET", ""),
        ("stands_map", f"{web_url}?action=stands_map", "GET", ""),
        ("admin_dashboard", f"{web_url}?action=admin_dashboard", "GET", ""),
        ("participante_publico", f"{web_url}?action=participante_publico&id=__probe__", "GET", ""),
    ]
    for name, url, method, _ in tests:
        status, data = http_json(url, method=method)
        passed = status == 200 and data.get("ok")
        if name == "admin_dashboard":
            passed = passed and bool(data.get("stats"))
        if name == "participante_publico":
            passed = status == 200 and (
                data.get("formType") == "participante_publico"
                or (data.get("error") and "no encontrada" in str(data.get("error")).lower())
            )
        add(
            report,
            id=f"apps_script:{name}",
            category="backend",
            passed=passed,
            detail=f"{name} → HTTP {status}",
            remediation="Pega Code.gs del repo en Apps Script, redepliega y ejecuta sincronizarEncabezados()"
            if not passed and name == "participante_publico"
            else ("py tools/setup_admin.py --sin-firebase" if not passed else ""),
            optional=name == "participante_publico",
        )

    _, pv = http_json(
        web_url,
        method="POST",
        payload={
            "action": "pageview",
            "path": "/verificar-todo",
            "title": "Verificación",
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "referrer": "verificar_todo.py",
            "sessionId": "verify_auto",
            "userAgent": "verificar-todo/1.0",
        },
    )
    add(
        report,
        id="apps_script:pageview",
        category="backend",
        passed=bool(pv.get("ok")),
        detail="pageview POST",
        remediation="py tools/setup_admin.py --sin-firebase" if not pv.get("ok") else "",
    )


def check_forms_pages(report: VerificationReport) -> None:
    pages: list[tuple[str, list[str]]] = [
        ("/inscripcion", ["form-submit.js", "sheets-config.js"]),
        ("/competencia", ["form-submit.js", "sheets-config.js", "jurado-v60.css"]),
        ("/admin", ["admin-dashboard.js", "sheets-config.js", "fidelizacion-sheets.js"]),
        ("/stands", ["stands-map.js"]),
        ("/marcas", ["participantes-directory.js"]),
        ("/mi-stand", ["expositor-panel.js"]),
        ("/fidelizacion", ["site-links.js"]),
        ("/pasaporte", ["fidelizacion-sheets.js", "fidelizacion-common.js", "pasaporte-pwa.js"]),
        ("/registro-fidelizacion", ["fidelizacion-sheets.js", "fidelizacion-common.js"]),
        ("/escanear-pasaporte", ["fidelizacion-sheets.js", "fidelizacion-common.js"]),
        ("/jurado-v60", ["jurado-v60.js", "Consola principal"]),
        ("/jurado/config", ["jurado-v60.js", '<base href="/">']),
        ("/jurado/organizador", ["jurado-v60.js", '<base href="/">']),
        ("/competencia/torneo", ["competencia-torneo.js", '<base href="/">']),
    ]
    for path, tokens in pages:
        status, html = http_text(SITE_BASE + path)
        missing = [t for t in tokens if t not in html]
        passed = status == 200 and not missing
        add(
            report,
            id=f"page_scripts:{path}",
            category="hosting",
            passed=passed,
            detail=f"HTTP {status}" + (f"; falta {', '.join(missing)}" if missing else ""),
            remediation="py tools/deploy_firebase.py" if not passed else "",
        )


def check_fidelizacion_links(report: VerificationReport) -> None:
    status, html = http_text(f"{SITE_BASE}/fidelizacion")
    reg_status = http_status(f"{SITE_BASE}/registro-fidelizacion")
    passed = status == 200 and reg_status == 200
    add(
        report,
        id="fidelizacion_registro",
        category="hosting",
        passed=passed,
        detail=f"/fidelizacion + /registro-fidelizacion → HTTP {status}/{reg_status}",
        remediation="py tools/deploy_firebase.py" if not passed else "",
    )
    missing_datalink = 'data-link="fidelizacionRegistro"' not in html
    add(
        report,
        id="fidelizacion_cta_datalink",
        category="hosting",
        passed=not missing_datalink,
        detail="CTA con data-link canónico" if not missing_datalink else "CTA sin data-link (deploy pendiente)",
        remediation="py tools/deploy_firebase.py",
        optional=True,
    )

    web_url = read_canonical_web_app_url() or read_web_app_url()
    if web_url:
        _, pas_body = http_json(web_url + ("&" if "?" in web_url else "?") + "action=pasaporte_list&limit=1")
        pas_ok = bool(pas_body.get("ok")) and isinstance(pas_body.get("clientes"), list)
        add(
            report,
            id="pasaporte_api",
            category="backend",
            passed=pas_ok,
            detail="pasaporte_list con clientes[]" if pas_ok else "pasaporte_list no disponible en Apps Script",
            remediation="Redeploy Code.gs: py tools/setup_admin.py",
        )
        _, cfg_body = http_text(f"{SITE_BASE}/js/sheets-config.js")
        canonical = read_canonical_web_app_url()
        cfg_ok = canonical and canonical.split("/macros/s/")[-1].split("/")[0] in cfg_body
        add(
            report,
            id="sheets_url_prod_match",
            category="backend",
            passed=cfg_ok,
            detail="sheets-config.js coincide con CANONICAL_SHEETS_URL.txt" if cfg_ok else "URL de producción distinta al canónico",
            remediation="Fusionar deploy reciente o actualizar SHEETS_WEB_APP_URL en GitHub Secrets",
        )


def check_wallet_optional(report: VerificationReport) -> None:
    body = json.dumps({"clienteId": "verify-test"}).encode("utf-8")
    status = http_status(WALLET_FN, method="POST", body=body)
    passed = status in (200, 503)  # 503 = sin credenciales configuradas
    add(
        report,
        id="wallet_function",
        category="wallet",
        passed=passed,
        detail=f"generateWalletPass → HTTP {status}",
        remediation="py tools/setup_google_wallet.py --configurar-firebase && py tools/setup_google_wallet.py --deploy",
        optional=True,
    )


def check_repo_integrity(report: VerificationReport) -> None:
    for rel in REQUIRED_REPO_FILES:
        path = PROJECT_ROOT / rel
        add(
            report,
            id=f"repo:{rel}",
            category="repo",
            passed=path.is_file(),
            detail="presente" if path.is_file() else "FALTA",
            remediation=f"Restaurar archivo: {rel}",
        )

    # HTML referenciados en firebase.json
    firebase = json.loads((PROJECT_ROOT / "firebase.json").read_text(encoding="utf-8"))
    destinations: set[str] = set()
    for rule in firebase.get("hosting", {}).get("rewrites", []):
        dest = rule.get("destination", "")
        if dest.endswith(".html"):
            destinations.add(dest.lstrip("/"))

    for dest in sorted(destinations):
        path = PROJECT_ROOT / dest
        add(
            report,
            id=f"repo_html:{dest}",
            category="repo",
            passed=path.is_file(),
            detail="presente" if path.is_file() else "FALTA",
            remediation=f"Crear o restaurar {dest}",
        )

    sync = subprocess.run(
        [sys.executable, str(TOOLS_DIR / "sync_routes.py"), "--check"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    add(
        report,
        id="repo:sync_routes",
        category="repo",
        passed=sync.returncode == 0,
        detail="rutas sincronizadas" if sync.returncode == 0 else "site-links/firebase/sitemap desactualizados",
        remediation="python3 tools/sync_routes.py",
    )

    site_links = PROJECT_ROOT / "js" / "site-links.js"
    jurado_ok = site_links.is_file() and "buildJuradoUrls" in site_links.read_text(encoding="utf-8")
    add(
        report,
        id="repo:site_links_jurado",
        category="repo",
        passed=jurado_ok,
        detail="extensión jurado presente" if jurado_ok else "falta buildJuradoUrls en site-links.js",
        remediation="python3 tools/sync_routes.py (incluye tools/site-links-jurado.snippet.js)",
    )


def check_local_env(report: VerificationReport) -> None:
    env_path = TOOLS_DIR / ".env"
    add(
        report,
        id="local:env",
        category="local",
        passed=env_path.is_file(),
        detail="tools/.env presente" if env_path.is_file() else "falta tools/.env",
        remediation="copy tools\\.env.example tools\\.env",
        optional=True,
    )
    local_url = read_web_app_url()
    add(
        report,
        id="local:sheets_config",
        category="local",
        passed=bool(local_url and "/exec" in local_url),
        detail="js/sheets-config.js local" if local_url else "sin sheets-config local",
        remediation="py tools/conectar_sheets.py --configurar-url \"URL/exec\"",
        optional=True,
    )


def run_verification(*, web_only: bool = False, repo_only: bool = False) -> VerificationReport:
    report = VerificationReport(
        timestamp=datetime.now(UTC).isoformat(),
        site_base=SITE_BASE,
    )

    if not repo_only:
        check_hosting_routes(report)
        check_assets(report)
        check_sheets_config_prod(report)
        check_forms_pages(report)
        check_fidelizacion_links(report)
        web_url = resolve_web_app_url()
        check_apps_script(report, web_url)
        check_wallet_optional(report)

    if not web_only:
        check_repo_integrity(report)
        check_local_env(report)

    return report


def print_report(report: VerificationReport) -> None:
    print(f"\n=== verificar_todo.py — {report.site_base} ===\n")
    by_cat: dict[str, list[CheckResult]] = {}
    for c in report.checks:
        by_cat.setdefault(c.category, []).append(c)

    for cat, items in sorted(by_cat.items()):
        print(f"## {cat.upper()}")
        for c in items:
            tag = "OK" if c.passed else ("AVISO" if c.optional else "FAIL")
            print(f"  [{tag}] {c.id}: {c.detail}")
        print()

    fails = report.failed
    warns = report.warnings
    if fails:
        error(f"{len(fails)} fallo(s) crítico(s).")
        print("Remediaciones sugeridas:")
        seen: set[str] = set()
        for c in fails:
            if c.remediation and c.remediation not in seen:
                print(f"  → {c.remediation}")
                seen.add(c.remediation)
    else:
        ok("Verificación crítica: TODO OK.")

    if warns:
        warn(f"{len(warns)} aviso(s) opcional(es).")

    print("\nOrden automática de corrección:")
    print("  py tools/orden_automatica.py --aplicar")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verificación integral del sitio y el repo.")
    parser.add_argument("--json", action="store_true", help="Salida JSON (para orden_automatica.py).")
    parser.add_argument("--solo-web", action="store_true", help="Solo producción web + Apps Script.")
    parser.add_argument("--solo-repo", action="store_true", help="Solo archivos del repositorio.")
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()
    report = run_verification(web_only=args.solo_web, repo_only=args.solo_repo)

    if args.json:
        print(json.dumps(asdict(report), ensure_ascii=False, indent=2))
        return 0 if report.ok else 1

    print_report(report)
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
