#!/usr/bin/env python3
"""
Release web automatizado para agentes Cloud (Cursor) y mantenimiento.

Orquesta merge de PR, deploy en GitHub Actions y verificación en producción
sin intervención manual del desarrollador (salvo secretos OAuth puntuales).

Uso:
  python3 tools/agent_release.py status
  python3 tools/agent_release.py status --pr 59
  python3 tools/agent_release.py merge --pr 59
  python3 tools/agent_release.py deploy
  python3 tools/agent_release.py deploy --workflow update-all
  python3 tools/agent_release.py verify --expect-css 20260705pergamino3
  python3 tools/agent_release.py release --pr 59 --expect-css 20260705pergamino3
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from _util import DEFAULT_FIREBASE_PROJECT, PROJECT_ROOT, error, info, ok, warn

SITE_BASE = f"https://{DEFAULT_FIREBASE_PROJECT}.web.app"
WORKFLOWS = {
    "hosting": ("Deploy Firebase Hosting", "deploy-firebase.yml"),
    "update-all": ("Actualizar todo", "update-all.yml"),
    "verify": ("Verificar sitio", "verificar-sitio.yml"),
}


@dataclass
class ProductionCheck:
    ok: bool
    detail: str


def require_gh() -> bool:
    if not shutil_which("gh"):
        error("Falta GitHub CLI (gh). Instálalo y autentica: gh auth login")
        return False
    result = subprocess.run(
        ["gh", "auth", "status"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        error("gh no autenticado. Ejecuta: gh auth login")
        return False
    return True


def shutil_which(cmd: str) -> str | None:
    from shutil import which

    return which(cmd)


def fetch_url(url: str, *, timeout: int = 25) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "feria-agent-release/1.0", "Cache-Control": "no-cache"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return exc.code, body


def local_expected_css_version() -> str:
    index = PROJECT_ROOT / "index.html"
    if not index.is_file():
        return ""
    match = re.search(r"brand\.css\?v=([a-zA-Z0-9]+)", index.read_text(encoding="utf-8"))
    return match.group(1) if match else ""


def production_css_version() -> str:
    code, body = fetch_url(f"{SITE_BASE}/")
    if code != 200:
        return ""
    match = re.search(r"brand\.css\?v=([a-zA-Z0-9]+)", body)
    return match.group(1) if match else ""


def production_has_editorial() -> bool:
    code, body = fetch_url(f"{SITE_BASE}/")
    if code != 200:
        return False
    return "page-festival--editorial" in body


def pr_info(pr_number: int) -> dict | None:
    result = subprocess.run(
        ["gh", "pr", "view", str(pr_number), "--json", "state,mergeable,title,url,headRefName,baseRefName"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def merge_pr(pr_number: int, *, squash: bool = True) -> bool:
    if not require_gh():
        return False
    data = pr_info(pr_number)
    if not data:
        error(f"No se pudo leer PR #{pr_number}")
        return False
    if data.get("state") == "MERGED":
        ok(f"PR #{pr_number} ya estaba mergeado.")
        return True
    if data.get("state") != "OPEN":
        error(f"PR #{pr_number} en estado {data.get('state')}")
        return False
    if data.get("mergeable") == "CONFLICTING":
        error(f"PR #{pr_number} tiene conflictos — resuélvelos antes del merge.")
        return False

    # Draft PRs must be marked ready before merge
    view_text = subprocess.run(
        ["gh", "pr", "view", str(pr_number)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if view_text.returncode == 0 and "Draft" in view_text.stdout:
        info(f"PR #{pr_number} es borrador — marcando ready for review…")
        ready = subprocess.run(["gh", "pr", "ready", str(pr_number)], cwd=str(PROJECT_ROOT))
        if ready.returncode != 0:
            error("No se pudo marcar el PR como listo para revisión.")
            return False

    info(f"Mergeando PR #{pr_number}: {data.get('title', '')}")
    cmd = ["gh", "pr", "merge", str(pr_number), "--delete-branch"]
    if squash:
        cmd.insert(3, "--squash")
    result = subprocess.run(cmd, cwd=str(PROJECT_ROOT), capture_output=True, text=True)
    if result.returncode != 0:
        error("Merge falló (¿falta permiso o revisión pendiente?).")
        if result.stderr:
            error(result.stderr.strip()[:500])
        info(f"Manual: abre {data.get('url')} y pulsa Merge pull request.")
        return False
    ok(f"PR #{pr_number} mergeado en {data.get('baseRefName', 'main')}.")
    return True


def run_workflow(key: str, *, wait: bool = True, timeout: int = 900) -> bool:
    if not require_gh():
        return False
    if key not in WORKFLOWS:
        error(f"Workflow desconocido: {key}. Opciones: {', '.join(WORKFLOWS)}")
        return False
    name, wf_file = WORKFLOWS[key]
    info(f"Lanzando workflow «{name}»…")
    result = subprocess.run(
        ["gh", "workflow", "run", name],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        error(f"No se pudo lanzar «{name}».")
        if result.stderr:
            error(result.stderr.strip()[:400])
        return False

    if not wait:
        ok("Workflow lanzado (sin espera).")
        return True

    time.sleep(5)
    listed = subprocess.run(
        ["gh", "run", "list", "--workflow", wf_file, "--limit", "1", "--json", "databaseId,url,status"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if listed.returncode != 0 or not listed.stdout.strip():
        warn("Workflow lanzado — comprueba en GitHub Actions.")
        return True

    runs = json.loads(listed.stdout)
    if not runs:
        warn("Sin runs recientes.")
        return True

    run_id = str(runs[0].get("databaseId", ""))
    url = runs[0].get("url", "")
    if url:
        info(f"Run: {url}")

    if not run_id:
        warn("Run ID desconocido.")
        return True

    watch = subprocess.run(
        ["gh", "run", "watch", run_id, "--exit-status"],
        cwd=str(PROJECT_ROOT),
        timeout=timeout,
    )
    if watch.returncode == 0:
        ok(f"Workflow «{name}» completado.")
        return True

    error(f"Workflow «{name}» falló.")
    info(f"Logs: gh run view {run_id} --log-failed")
    return False


def verify_production(*, expect_css: str = "", require_editorial: bool = False) -> bool:
    checks: list[ProductionCheck] = []

    code_home, _ = fetch_url(f"{SITE_BASE}/")
    checks.append(ProductionCheck(code_home == 200, f"Inicio HTTP {code_home}"))

    prod_css = production_css_version()
    local_css = expect_css or local_expected_css_version()
    if local_css:
        css_ok = prod_css == local_css
        checks.append(
            ProductionCheck(
                css_ok,
                f"brand.css?v= producción={prod_css or '(no encontrado)'} esperado={local_css}",
            )
        )
    elif expect_css:
        checks.append(
            ProductionCheck(
                prod_css == expect_css,
                f"brand.css?v= producción={prod_css or '(no encontrado)'} esperado={expect_css}",
            )
        )

    if require_editorial:
        has_ed = production_has_editorial()
        checks.append(ProductionCheck(has_ed, f"Tema editorial en index: {'sí' if has_ed else 'no'}"))

    paths = ["/inscripcion", "/competencia", "/el-evento", "/actividades"]
    for path in paths:
        code, _ = fetch_url(f"{SITE_BASE}{path}")
        checks.append(ProductionCheck(code == 200, f"{path} HTTP {code}"))

    print("\n=== Verificación producción ===")
    all_ok = True
    for check in checks:
        mark = "OK" if check.ok else "FAIL"
        print(f"  [{mark}] {check.detail}")
        if not check.ok:
            all_ok = False

    if all_ok:
        ok(f"Producción verificada: {SITE_BASE}")
    else:
        warn("Producción desactualizada o con errores — relanza deploy o revisa secretos CI.")
    return all_ok


def cmd_status(args: argparse.Namespace) -> int:
    local_css = local_expected_css_version()
    prod_css = production_css_version()
    editorial = production_has_editorial()

    print("=== Estado release web ===")
    print(f"  Repo CSS (index.html): brand.css?v={local_css or '?'}")
    print(f"  Prod CSS:              brand.css?v={prod_css or '?'}")
    print(f"  Tema editorial prod:   {'sí' if editorial else 'no'}")
    print(f"  Sitio:                 {SITE_BASE}")

    if args.pr:
        data = pr_info(args.pr)
        if data:
            print(f"\n  PR #{args.pr}: {data.get('state')} — {data.get('title')}")
            print(f"  URL: {data.get('url')}")
            print(f"  Rama: {data.get('headRefName')} → {data.get('baseRefName')}")
        else:
            warn(f"No se pudo leer PR #{args.pr}")

    if require_gh():
        wf = subprocess.run(
            ["gh", "run", "list", "--workflow", "deploy-firebase.yml", "--limit", "3"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
        )
        if wf.stdout.strip():
            print("\n  Últimos deploys Firebase Hosting:")
            print(wf.stdout)

    return 0


def cmd_release(args: argparse.Namespace) -> int:
    expect_css = args.expect_css or local_expected_css_version()

    if args.pr:
        if not merge_pr(args.pr, squash=not args.no_squash):
            return 1
        info("Esperando que GitHub procese el merge en main…")
        time.sleep(8)

    if args.deploy or args.pr:
        workflow = args.workflow
        if not run_workflow(workflow, wait=True, timeout=args.timeout):
            warn("Deploy falló — intenta manualmente o revisa FIREBASE_SERVICE_ACCOUNT en GitHub Secrets.")
            if not args.skip_verify:
                verify_production(expect_css=expect_css, require_editorial=args.editorial)
            return 1

    if args.skip_verify:
        ok("Release completado (sin verificación).")
        return 0

    if verify_production(expect_css=expect_css, require_editorial=args.editorial):
        return 0
    return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Release web automatizado para agentes Cloud.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_status = sub.add_parser("status", help="Estado PR, CSS local vs producción, workflows.")
    p_status.add_argument("--pr", type=int, help="Número de PR a inspeccionar.")

    p_merge = sub.add_parser("merge", help="Mergear PR en main (squash por defecto).")
    p_merge.add_argument("--pr", type=int, required=True)
    p_merge.add_argument("--no-squash", action="store_true")

    p_deploy = sub.add_parser("deploy", help="Lanzar workflow de deploy en GitHub Actions.")
    p_deploy.add_argument(
        "--workflow",
        choices=list(WORKFLOWS),
        default="hosting",
        help="Workflow a ejecutar (default: hosting).",
    )
    p_deploy.add_argument("--no-wait", action="store_true")
    p_deploy.add_argument("--timeout", type=int, default=900)

    p_verify = sub.add_parser("verify", help="Comprobar producción (CSS, rutas, editorial).")
    p_verify.add_argument("--expect-css", default="", help="Sufijo ?v= esperado en brand.css.")
    p_verify.add_argument("--editorial", action="store_true", help="Exigir clase page-festival--editorial.")

    p_release = sub.add_parser("release", help="Merge + deploy + verify (pipeline completo).")
    p_release.add_argument("--pr", type=int, help="PR a mergear antes del deploy.")
    p_release.add_argument("--expect-css", default="", help="Sufijo ?v= esperado.")
    p_release.add_argument("--editorial", action="store_true", default=True)
    p_release.add_argument("--no-editorial", action="store_false", dest="editorial")
    p_release.add_argument("--workflow", choices=list(WORKFLOWS), default="hosting")
    p_release.add_argument("--no-deploy", action="store_true", help="Solo merge + verify.")
    p_release.add_argument("--skip-verify", action="store_true")
    p_release.add_argument("--no-squash", action="store_true")
    p_release.add_argument("--timeout", type=int, default=900)
    p_release.set_defaults(deploy=True)

    args = parser.parse_args()
    if args.command == "release" and args.no_deploy:
        args.deploy = False

    return args


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()

    if args.command == "status":
        return cmd_status(args)
    if args.command == "merge":
        return 0 if merge_pr(args.pr, squash=not args.no_squash) else 1
    if args.command == "deploy":
        return 0 if run_workflow(args.workflow, wait=not args.no_wait, timeout=args.timeout) else 1
    if args.command == "verify":
        return 0 if verify_production(expect_css=args.expect_css, require_editorial=args.editorial) else 1
    if args.command == "release":
        return cmd_release(args)

    return 1


if __name__ == "__main__":
    sys.exit(main())
