#!/usr/bin/env python3
"""
Orden automática de verificación e implementación.

1. Ejecuta verificar_todo.py (auditoría completa)
2. Genera plan de acciones ordenadas por prioridad
3. Con --aplicar, ejecuta remediaciones automáticas seguras

Uso:
  py tools/orden_automatica.py              # Solo informe + plan
  py tools/orden_automatica.py --aplicar  # Ejecutar correcciones automáticas
  py tools/orden_automatica.py --completo   # Plan + deploy + verificación final
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass

from _util import PROJECT_ROOT, TOOLS_DIR, error, info, ok, warn

VERIFICAR = TOOLS_DIR / "verificar_todo.py"


@dataclass
class Action:
    priority: int
    id: str
    command: str
    description: str
    auto: bool  # seguro para ejecutar sin confirmación


# Mapa remediation → acción ordenada (menor priority = antes)
REMEDIATION_ACTIONS: dict[str, Action] = {
    "copy tools\\.env.example tools\\.env": Action(
        10,
        "env",
        "",
        "Crear tools/.env: copy tools\\.env.example tools\\.env",
        False,
    ),
    "py tools/conectar_sheets.py --configurar-url \"URL/exec\"": Action(
        20,
        "sheets_url",
        f'"{sys.executable}" tools/conectar_sheets.py --verificar',
        "Verificar/conectar URL Apps Script local",
        False,
    ),
    "py tools/setup_admin.py --sin-firebase": Action(
        30,
        "apps_script",
        f'"{sys.executable}" tools/setup_admin.py --sin-firebase',
        "Redeploy Code.gs + verificar endpoints",
        True,
    ),
    "py tools/setup_github_ci.py && gh workflow run \"Deploy Firebase Hosting\"": Action(
        40,
        "ci_secrets",
        f'"{sys.executable}" tools/setup_github_ci.py',
        "Sincronizar secretos GitHub (Firebase + Sheets)",
        True,
    ),
    "py tools/deploy_firebase.py": Action(
        50,
        "hosting",
        f'"{sys.executable}" tools/deploy_firebase.py',
        "Desplegar Firebase Hosting",
        True,
    ),
    "py tools/setup_google_wallet.py --auto": Action(
        60,
        "wallet",
        f'"{sys.executable}" tools/setup_google_wallet.py --verificar',
        "Google Wallet (Firebase SA + deploy)",
        False,
    ),
}

# Pipeline completo recomendado (mantenimiento)
PIPELINE_COMPLETO: list[Action] = [
    Action(5, "verify_initial", f'"{sys.executable}" tools/verificar_todo.py', "Auditoría inicial", True),
    Action(30, "apps_script", f'"{sys.executable}" tools/setup_admin.py --sin-firebase', "Apps Script", True),
    Action(35, "sheets_verify", f'"{sys.executable}" tools/conectar_sheets.py --verificar', "Verificar Sheets", True),
    Action(40, "ci", f'"{sys.executable}" tools/setup_github_ci.py', "Secretos CI", True),
    Action(50, "hosting", f'"{sys.executable}" tools/deploy_firebase.py', "Firebase Hosting", True),
    Action(55, "verify_admin", f'"{sys.executable}" tools/verify_admin.py', "Verificar admin/API", True),
    Action(5, "verify_final", f'"{sys.executable}" tools/verificar_todo.py', "Auditoría final", True),
]


def run_json_verification() -> dict:
    result = subprocess.run(
        [sys.executable, str(VERIFICAR), "--json"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode not in (0, 1):
        error(f"verificar_todo.py falló: {result.stderr[:300]}")
        return {"checks": []}
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        error("Salida JSON inválida de verificar_todo.py")
        return {"checks": []}


def build_plan(report: dict) -> list[Action]:
    failed = [c for c in report.get("checks", []) if not c.get("passed") and not c.get("optional")]
    planned: dict[str, Action] = {}

    for check in failed:
        rem = (check.get("remediation") or "").strip()
        if rem in REMEDIATION_ACTIONS:
            action = REMEDIATION_ACTIONS[rem]
            planned[action.id] = action
        elif rem:
            planned[check["id"]] = Action(
                99,
                check["id"],
                "",
                rem,
                False,
            )

    return sorted(planned.values(), key=lambda a: a.priority)


def print_plan(actions: list[Action], *, title: str) -> None:
    print(f"\n=== {title} ===\n")
    if not actions:
        ok("No hay acciones pendientes — el sitio está en orden.")
        return
    for i, action in enumerate(actions, 1):
        auto = " [AUTO]" if action.auto else " [MANUAL]"
        print(f"{i}. ({action.priority}) {action.description}{auto}")
        if action.command:
            print(f"   {action.command}")
        print()


def run_action(action: Action) -> bool:
    if not action.command:
        warn(f"Omitido (manual): {action.description}")
        return False
    info(f"Ejecutando: {action.description}")
    rc = subprocess.run(action.command, cwd=str(PROJECT_ROOT), shell=True).returncode
    if rc == 0:
        ok(f"Completado: {action.id}")
        return True
    error(f"Falló ({rc}): {action.id}")
    return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Orden automática de verificación e implementación.")
    parser.add_argument("--aplicar", action="store_true", help="Ejecutar remediaciones automáticas del plan.")
    parser.add_argument(
        "--completo",
        action="store_true",
        help="Pipeline de mantenimiento completo (verify → deploy → verify).",
    )
    parser.add_argument("--solo-web", action="store_true", help="Pasar --solo-web a verificar_todo.")
    return parser.parse_args()


def main() -> int:
    if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    args = parse_args()
    print("=== orden_automatica.py — La Sucursal del Café ===\n")

    if args.completo:
        print_plan(PIPELINE_COMPLETO, title="Pipeline completo")
        if not args.aplicar:
            info("Añade --aplicar para ejecutar el pipeline.")
            return 0
        results: list[bool] = []
        for action in PIPELINE_COMPLETO:
            if action.auto:
                results.append(run_action(action))
            else:
                warn(f"Salto manual: {action.description}")
        return 0 if all(results) else 1

    # Auditoría
    verify_cmd = [sys.executable, str(VERIFICAR)]
    if args.solo_web:
        verify_cmd.append("--solo-web")
    subprocess.run(verify_cmd, cwd=str(PROJECT_ROOT))

    report = run_json_verification()
    plan = build_plan(report)
    print_plan(plan, title="Plan de implementación (orden de prioridad)")

    if not args.aplicar:
        info("Modo informe. Para aplicar correcciones automáticas:")
        print("  py tools/orden_automatica.py --aplicar")
        print("  py tools/orden_automatica.py --completo --aplicar")
        return 0 if not plan else 1

    applied = 0
    for action in plan:
        if action.auto:
            if run_action(action):
                applied += 1
        else:
            warn(f"Pendiente manual: {action.description}")

    info(f"Acciones automáticas ejecutadas: {applied}")
    print("\n--- Re-verificación ---\n")
    final = subprocess.run([sys.executable, str(VERIFICAR)], cwd=str(PROJECT_ROOT))
    return final.returncode


if __name__ == "__main__":
    sys.exit(main())
