#!/usr/bin/env python3
"""Valida sintaxis de tools/google-apps-script/Code.gs antes de pegar en Apps Script."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from _util import CODE_GS_PATH, error, ok


def main() -> int:
    if not CODE_GS_PATH.is_file():
        error(f"No existe {CODE_GS_PATH}")
        return 1

    code = CODE_GS_PATH.read_text(encoding="utf-8")
    script = (
        "const fs=require('fs');"
        f"new Function(fs.readFileSync({CODE_GS_PATH.as_posix()!r},'utf8'));"
        "console.log('OK');"
    )
    result = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        error(f"Code.gs tiene error de sintaxis:\n{err}")
        return 1

    if "joinRowParts_" not in code:
        error("Code.gs no incluye joinRowParts_ (versión antigua con bug de paréntesis).")
        return 1

    ok(f"Code.gs válido ({CODE_GS_PATH})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
