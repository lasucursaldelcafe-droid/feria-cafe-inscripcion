#!/usr/bin/env python3
"""
Despliega el sitio estático en Firebase Hosting.

Usa firebase-tools vía npx (no requiere instalación global).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from _util import (
    DEFAULT_FIREBASE_PROJECT,
    PROJECT_ROOT,
    error,
    info,
    ok,
    require_node,
    run_command,
    warn,
)

FIREBASE_BIN = ["npx", "-y", "firebase-tools@latest"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Despliega Firebase Hosting del proyecto.")
    parser.add_argument(
        "--project",
        default=os.environ.get("FIREBASE_PROJECT", DEFAULT_FIREBASE_PROJECT),
        help=f"ID del proyecto Firebase (default: {DEFAULT_FIREBASE_PROJECT})",
    )
    parser.add_argument(
        "--token",
        help="Token CI de firebase login:ci (alternativa: FIREBASE_TOKEN)",
    )
    parser.add_argument(
        "--service-account",
        help="JSON de cuenta de servicio con rol Firebase Hosting Admin",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo valida requisitos, no despliega.",
    )
    return parser.parse_args()


def build_env(args: argparse.Namespace) -> dict[str, str]:
    env: dict[str, str] = {}

    token = (args.token or os.environ.get("FIREBASE_TOKEN", "")).strip()
    if token:
        env["FIREBASE_TOKEN"] = token
        info("Autenticación: token CI (FIREBASE_TOKEN)")
        return env

    sa_path = (args.service_account or os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")).strip()
    if sa_path:
        resolved = Path(sa_path).expanduser().resolve()
        if not resolved.is_file():
            raise FileNotFoundError(f"No existe la cuenta de servicio: {resolved}")
        env["GOOGLE_APPLICATION_CREDENTIALS"] = str(resolved)
        info(f"Autenticación: cuenta de servicio ({resolved.name})")
        return env

    info("Autenticación: sesión local de firebase login (si existe)")
    return env


def validate_service_account(path: Path) -> None:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if "client_email" not in data or "private_key" not in data:
        raise ValueError("El JSON no parece una cuenta de servicio válida.")


def main() -> int:
    args = parse_args()

    try:
        require_node()
        ok("Node.js y npx disponibles.")

        env = build_env(args)
        if args.service_account or os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON"):
            sa = Path(
                (args.service_account or os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")).strip()
            ).expanduser().resolve()
            validate_service_account(sa)

        if args.dry_run:
            ok(f"Modo dry-run: se desplegaría hosting en {args.project}")
            return 0

        run_command(
            FIREBASE_BIN + ["use", args.project, "--non-interactive"],
            cwd=PROJECT_ROOT,
            env=env,
        )
        ok(f"Proyecto activo: {args.project}")

        run_command(
            FIREBASE_BIN
            + [
                "deploy",
                "--only",
                "hosting,firestore:rules",
                "--project",
                args.project,
                "--non-interactive",
            ],
            cwd=PROJECT_ROOT,
            env=env,
        )

        ok("Despliegue de Firebase Hosting y reglas Firestore completado.")
        info(f"Sitio: https://{args.project}.web.app")
        return 0

    except FileNotFoundError as exc:
        error(str(exc))
        return 2
    except RuntimeError as exc:
        error(str(exc))
        info("Si falla la autenticación, prueba una de estas opciones:")
        print("  py tools/deploy_firebase.py --token TU_TOKEN")
        print("  npx -y firebase-tools@latest login:ci")
        print("  py tools/deploy_firebase.py --service-account ruta/cuenta-servicio.json")
        return 3
    except Exception as exc:  # noqa: BLE001 — script CLI
        error(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
