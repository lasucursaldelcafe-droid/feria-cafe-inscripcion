#!/usr/bin/env python3
"""Verifica preliminar-1-results.js contra la planilla (clasificatoria / semifinal / final)."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PLANILLA = {
    "clasificatoria": [
        ("Andrenia", 1, 29, 24, 27, 80),
        ("Angela", 1, 26, 22, 24, 72),
        ("Jessi", 1, 18, 24, 23, 65),
        ("Brayan", 1, 18, 19, 21, 58),
        ("Joe", 1, 28, 21, 19, 68),
        ("Useche", 1, 31, 25, 24, 80),
        ("Savedra", 1, 23, 23, 23, 69),
        ("Manjares", 1, 19, 21, 24, 64),
        ("Vera", 1, 19, 20, 21, 60),
        ("Linda", 1, 27, 24, 22, 73),
        ("Colorado", 1, 27, 23, 26, 76),
        ("Polo", 1, 24, 26, 21, 71),
    ],
    "semifinal": [
        ("Andrenia", 2, 18, 18, 22, 58),
        ("Jessi", 2, 26, 24, 29, 79),
        ("Useche", 2, 30, 27, 25, 82),
        ("Savedra", 2, 24, 24, 22, 70),
        ("Linda", 2, 26, 23, 21, 70),
        ("Colorado", 2, 27, 26, 26, 79),
    ],
    "final": [
        ("Jessi", 3, 22, 27, 19, 68),
        ("Useche", 3, 27, 26, 26, 79),
        ("Colorado", 3, 28, 29, 25, 82),
    ],
}


def load_kit() -> dict:
    script = """
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('js/preliminar-1-results.js', 'utf8');
const ctx = {};
vm.runInNewContext(code, ctx);
console.log(JSON.stringify(ctx.Preliminar1Results.exportKit()));
"""
    raw = subprocess.check_output(["node", "-e", script], cwd=ROOT, text=True)
    return json.loads(raw)


def main() -> int:
    kit = load_kit()
    rows = kit["rawRows"]
    ranking = kit["ranking"]
    errors: list[str] = []

    by_key = {(r["participante"], r["entrada"]): r for r in rows}

    for phase, entries in PLANILLA.items():
        for name, entrada, j1, j2, j3, total in entries:
            row = by_key.get((name, entrada))
            if not row:
                errors.append(f"Falta fila {phase}: {name} entrada {entrada}")
                continue
            if (row["j1"], row["j2"], row["j3"], row["total"]) != (j1, j2, j3, total):
                errors.append(
                    f"Diff {phase} {name} e{entrada}: planilla {j1}/{j2}/{j3}={total} "
                    f"vs código {row['j1']}/{row['j2']}/{row['j3']}={row['total']}"
                )
            if row.get("sumaVerificada") != total:
                errors.append(f"Suma verificada incorrecta: {name} e{entrada}")

    inscritos = kit.get("inscritos") or []
    if len(inscritos) != 12:
        errors.append(f"Esperados 12 inscritos, hay {len(inscritos)}")

  # Clasificatoria ranking order (by total desc)
    clasif = sorted(PLANILLA["clasificatoria"], key=lambda x: (-x[5], x[0].lower()))
    print("=== Verificación planilla vs código ===\n")
    print(f"Filas RAW: {len(rows)} (esperadas 21)")
    print(f"Inscritos cruzados: {len(inscritos)}/12")
    print(f"Ranking consolidado (import usa MEJOR tanda):\n")

    clasif_by_name = {e[0].lower(): e for e in PLANILLA["clasificatoria"]}
    for r in ranking:
        cl = clasif_by_name.get(r["participante"].lower())
        note = ""
        if cl and r["total"] != cl[5]:
            note = f"  ← clasificatoria tenía {cl[5]}, importó tanda {r['entrada']}"
        print(
            f"  {r['posicion']:2}. {r['participante']:<10} "
            f"tanda {r['entrada']}  J={r['j1']}+{r['j2']}+{r['j3']}={r['total']}  "
            f"→ {r['nombreInscrito']} ({r['competidorId']}){note}"
        )

    print("\n=== Clasificatoria según planilla (solo entrada 1) ===\n")
    for i, (name, _e, j1, j2, j3, total) in enumerate(clasif, 1):
        print(f"  {i:2}. {name:<10} {j1}+{j2}+{j3} = {total}")

    print("\n=== Semifinalistas (planilla) ===\n")
    for name, _e, j1, j2, j3, total in PLANILLA["semifinal"]:
        print(f"  {name:<10} {j1}+{j2}+{j3} = {total}")

    print("\n=== Finalistas (planilla) ===\n")
    for name, _e, j1, j2, j3, total in PLANILLA["final"]:
        print(f"  {name:<10} {j1}+{j2}+{j3} = {total}")

    if len(rows) != 21:
        errors.append(f"Esperadas 21 filas RAW, hay {len(rows)}")

    criteria = kit.get("criteria") or []
    if len(criteria) != 7:
        errors.append(f"Esperados 7 criterios SCA, hay {len(criteria)}")
    if any(c.get("key") == "impresion_general" for c in criteria):
        errors.append("No debe incluir Impresión general en Preliminar 1")
    event = kit.get("event") or {}
    if event.get("scaleMax") != 5:
        errors.append(f"Escala máxima debe ser 5, es {event.get('scaleMax')}")

    if errors:
        print(f"\n❌ {len(errors)} error(es):")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("\n✅ Todas las celdas de la planilla coinciden con preliminar-1-results.js")
    print("ℹ️  El botón «Cargar Preliminar 1» importa el MEJOR total por competidor (no solo clasificatoria).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
