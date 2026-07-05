#!/usr/bin/env python3
"""Cruza inscritos de Sheets con la planilla Preliminar 1 y regenera documentación."""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHEETS_URL = (ROOT / "tools" / "CANONICAL_SHEETS_URL.txt").read_text(encoding="utf-8").strip()
MD_PATH = ROOT / "tools" / "PRELIMINAR-1-CALIFICACIONES.md"

PLANILLA_TO_KEY = {
    "Andrenia": "andrenia",
    "Angela": "angela",
    "Jessi": "jessi",
    "Brayan": "brayan",
    "Joe": "joe",
    "Useche": "useche",
    "Savedra": "savedra",
    "Manjares": "manjares",
    "Vera": "vera",
    "Linda": "linda",
    "Colorado": "colorado",
    "Polo": "polo",
}

MATCHERS = {
    "andrenia": lambda n: "andreina" in n or "andrenia" in n,
    "angela": lambda n: n.startswith("angela"),
    "jessi": lambda n: "jessica" in n or "jessi" in n,
    "brayan": lambda n: "brayan" in n,
    "joe": lambda n: n == "joe" or n.startswith("joe "),
    "useche": lambda n: "useche" in n,
    "savedra": lambda n: "savedra" in n or "saavedra" in n,
    "manjares": lambda n: "manjar" in n,
    "vera": lambda n: n.endswith("vera") or " vera" in f" {n}",
    "linda": lambda n: "linda" in n,
    "colorado": lambda n: "colorado" in n,
    "polo": lambda n: "polo" in n,
}


def norm_name(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().strip())


def fetch_inscritos() -> list[dict]:
    url = f"{SHEETS_URL}?action=admin_dashboard"
    with urllib.request.urlopen(url, timeout=60) as res:
        data = json.load(res)
    return data.get("allCompetencia") or []


def match_inscritos(rows: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for key, fn in MATCHERS.items():
        for row in rows:
            n = norm_name(str(row.get("Nombre") or ""))
            if fn(n):
                planilla = next(p for p, k in PLANILLA_TO_KEY.items() if k == key)
                out[key] = {
                    "key": key,
                    "id": str(row.get("ID") or "").strip(),
                    "nombre": str(row.get("Nombre") or "").strip(),
                    "planilla": planilla,
                    "ciudad": str(row.get("Ciudad") or "").strip(),
                    "representa": str(row.get("Representa") or "").strip(),
                    "habilitado": str(row.get("Habilitado") or "").strip(),
                    "fotoUrl": str(row.get("Foto participante enlace Drive") or "").strip(),
                    "correo": str(row.get("Correo") or "").strip(),
                    "documento": str(row.get("Documento") or "").strip(),
                }
                break
    return out


def load_preliminar_js_ranking() -> list[dict]:
    js = (ROOT / "js" / "preliminar-1-results.js").read_text(encoding="utf-8")
    # Ejecutar módulo en Node sería ideal; aquí parseamos ranking vía node subprocess
    import subprocess

    script = r"""
const fs = require('fs');
const code = fs.readFileSync('js/preliminar-1-results.js','utf8');
eval(code.replace('global.Preliminar1Results','globalThis.Preliminar1Results').replace('typeof window','false && typeof window'));
const k = globalThis.Preliminar1Results.getRankingConsolidado();
console.log(JSON.stringify(k));
"""
    proc = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(proc.stdout)


def write_markdown(inscritos: dict[str, dict], ranking: list[dict]) -> None:
    lines = [
        "# V60 Championship — Preliminar 1",
        "",
        "**Evento:** V60 Championship — Preliminar 1",
        "**Jueces:** 3 (J1, J2, J3)",
        "**Parámetros:** Aroma, Sabor, Acidez, Dulzor, Cuerpo, Balance, Limpieza de taza, Impresión general (escala 1–6 cada uno)",
        f"**Inscritos cruzados:** {len(inscritos)} de 12 competidores de planilla",
        "",
        "## Cruce planilla ↔ inscripción (Sheets)",
        "",
        "| Planilla | ID inscrito | Nombre completo | Ciudad | Representa | Habilitado |",
        "|---|---|---|---|---|---|",
    ]
    for key in sorted(inscritos, key=lambda k: inscritos[k]["planilla"]):
        i = inscritos[key]
        lines.append(
            f"| {i['planilla']} | `{i['id']}` | {i['nombre']} | {i['ciudad']} | {i['representa']} | {i['habilitado'] or '—'} |"
        )

    lines += [
        "",
        "## Clasificación final (mejor tanda por competidor)",
        "",
        "| # | ID | Competidor (inscrito) | Planilla | Tanda | J1 | J2 | J3 | Total |",
        "|---:|---|---|---|---:|---:|---:|---:|---:|",
    ]
    for row in ranking:
        ins = inscritos.get(PLANILLA_TO_KEY.get(row["participante"], ""), {})
        lines.append(
            f"| {row['posicion']} | `{ins.get('id', '—')}` | {ins.get('nombre', row['participante'])} | {row['participante']} | {row['entrada']} | {row['j1']} | {row['j2']} | {row['j3']} | **{row['total']}** |"
        )

    lines += [
        "",
        "_Generado con `python3 tools/build_preliminar1_from_inscritos.py`_",
        "",
    ]
    MD_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    rows = fetch_inscritos()
    inscritos = match_inscritos(rows)
    if len(inscritos) != 12:
        print(f"AVISO: solo {len(inscritos)}/12 inscritos cruzados", file=sys.stderr)
        for k in PLANILLA_TO_KEY.values():
            if k not in inscritos:
                print(f"  falta: {k}", file=sys.stderr)
        return 1

    ranking = load_preliminar_js_ranking()
    write_markdown(inscritos, ranking)
    print(f"OK: {len(inscritos)} inscritos · markdown → {MD_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
