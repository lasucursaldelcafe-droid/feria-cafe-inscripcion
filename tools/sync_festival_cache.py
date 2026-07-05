#!/usr/bin/env python3
"""Unifica query ?v= en páginas públicas del festival."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = "20260705assets1"

FONT_LINK = (
    "https://fonts.googleapis.com/css2?"
    "family=Karla:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&"
    "family=Montserrat:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;1,300&"
    "display=swap"
)
OLD_FONT = re.compile(
    r'<link href="https://fonts\.googleapis\.com/css2\?family=Inter[^"]+" rel="stylesheet">'
)

REPLACEMENTS = [
    (re.compile(r"brand\.css\?v=[^\"']+"), f"brand.css?v={CACHE}"),
    (re.compile(r"fidelizacion\.css\?v=[^\"']+"), f"fidelizacion.css?v={CACHE}"),
    (re.compile(r"event-config\.js\?v=[^\"']+"), f"event-config.js?v={CACHE}"),
    (re.compile(r"site-chrome\.js\?v=[^\"']+"), f"site-chrome.js?v={CACHE}"),
    (re.compile(r"site-links\.js\?v=[^\"']+"), f"site-links.js?v={CACHE}"),
    (re.compile(r"festival-nav\.js\?v=[^\"']+"), f"festival-nav.js?v={CACHE}"),
    (re.compile(r"festival-explore\.js\?v=[^\"']+"), f"festival-explore.js?v={CACHE}"),
    (re.compile(r"sponsors\.js\?v=[^\"']+"), f"sponsors.js?v={CACHE}"),
    (re.compile(r"competition-sponsors\.js\?v=[^\"']+"), f"competition-sponsors.js?v={CACHE}"),
    (re.compile(r"form-submit\.js\?v=[^\"']+"), f"form-submit.js?v={CACHE}"),
]

PASAPORTE_NAV = (
    '        <li><a data-link="fidelizacion" data-nav="fidelizacion" '
    'href="fidelizacion.html">Pasaporte Cafetero</a></li>\n'
)

SKIP = {
    "admin.html",
    "jurado-config.html",
    "jurado-juez.html",
    "jurado-organizador.html",
    "jurado-resultados.html",
    "jurado-v60.html",
    "competencia-torneo.html",
    "expositor.html",
    "dashboard-fidelizacion.html",
    "escanear-pasaporte.html",
    "mi-stand.html",
}


def inject_pasaporte_nav(html: str) -> str:
    if 'data-nav="fidelizacion"' in html:
        return html
    if 'class="festival-nav__menu"' not in html:
        return html
    pattern = re.compile(
        r'(\s*<li><a data-link="competencia"[^>]*>.*?</a></li>)',
        re.DOTALL,
    )
    if not pattern.search(html):
        return html
    return pattern.sub(PASAPORTE_NAV + r"\1", html, count=1)


def main() -> None:
    changed = 0
    for path in sorted(ROOT.glob("*.html")):
        if path.name in SKIP:
            continue
        text = path.read_text(encoding="utf-8")
        if "page-festival" not in text and path.name not in {
            "reglas-v60-championship.html",
            "pasaporte-cafetero.html",
            "pasaporte-demo.html",
        }:
            continue
        original = text
        text = OLD_FONT.sub(
            f'<link href="{FONT_LINK}" rel="stylesheet">',
            text,
        )
        for pattern, repl in REPLACEMENTS:
            text = pattern.sub(repl, text)
        text = inject_pasaporte_nav(text)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
            print(f"updated {path.name}")
    print(f"done ({changed} files)")


if __name__ == "__main__":
    main()
