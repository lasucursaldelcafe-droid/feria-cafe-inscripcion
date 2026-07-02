#!/usr/bin/env python3
"""
Sincroniza rutas canónicas del sitio.

Fuente de verdad: tools/routes.json
Genera:
- js/site-links.js
- firebase.json (redirects/rewrites)
- sitemap.xml
"""

from __future__ import annotations

import argparse
import json
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTES_PATH = ROOT / "tools" / "routes.json"
SITE_LINKS_PATH = ROOT / "js" / "site-links.js"
FIREBASE_PATH = ROOT / "firebase.json"
SITEMAP_PATH = ROOT / "sitemap.xml"


def load_routes() -> dict:
    with ROUTES_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def js_quote(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def object_lines(mapping: dict[str, str], indent: str = "    ") -> list[str]:
    def key_repr(key: str) -> str:
        return key if key.replace("_", "").isalnum() and not key[0].isdigit() and "-" not in key else js_quote(key)

    lines: list[str] = []
    items = list(mapping.items())
    for idx, (key, value) in enumerate(items):
        comma = "," if idx < len(items) - 1 else ""
        lines.append(f"{indent}{key_repr(key)}: {js_quote(value)}{comma}")
    return lines


def generate_site_links(config: dict) -> str:
    routes = config["routes"]
    local = {r["key"]: r["local"] for r in routes}
    hosted = {r["key"]: r["hosted"] for r in routes}
    aliases = config.get("aliases", {})

    lines = [
        "/**",
        " * Rutas canónicas del sitio (local .html vs URLs limpias en Firebase Hosting).",
        " * Generado por tools/sync_routes.py desde tools/routes.json.",
        " */",
        "(function (global) {",
        "  'use strict';",
        "",
        "  var LOCAL = {",
        *object_lines(local),
        "  };",
        "",
        "  var HOSTED = {",
        *object_lines(hosted),
        "  };",
        "",
        "  /** Alias legibles (p. ej. data-link=\"como-funciona\"). */",
        "  var ALIASES = {",
        *object_lines(aliases),
        "  };",
        "",
        "  function resolveKey(key) {",
        "    return ALIASES[key] || key;",
        "  }",
        "",
        "  function useHostedPaths() {",
        "    var protocol = global.location.protocol;",
        "    if (protocol === 'file:') return false;",
        "    var host = global.location.hostname;",
        "    return host !== 'localhost' && host !== '127.0.0.1';",
        "  }",
        "",
        "  function href(key) {",
        "    var map = useHostedPaths() ? HOSTED : LOCAL;",
        "    return map[resolveKey(key)] || '#';",
        "  }",
        "",
        "  function absUrl(key) {",
        "    var base = (global.EVENT_CONFIG && global.EVENT_CONFIG.siteUrl) || global.location.origin;",
        "    base = String(base).replace(/\\/$/, '');",
        "    var resolved = resolveKey(key);",
        "    var path = HOSTED[resolved] || LOCAL[resolved];",
        "    if (path === '/') return base + '/';",
        "    if (path.charAt(0) === '/') return base + path;",
        "    return base + '/' + path;",
        "  }",
        "",
        "  function applyLinkElements(root) {",
        "    (root || document).querySelectorAll('[data-link]').forEach(function (el) {",
        "      var key = resolveKey(el.getAttribute('data-link'));",
        "      if (!key) return;",
        "      var url = href(key);",
        "      var hash = el.getAttribute('data-hash');",
        "      if (hash) url += '#' + hash.replace(/^#/, '');",
        "      el.setAttribute('href', url);",
        "    });",
        "  }",
        "",
        "  global.SiteLinks = {",
        "    href: href,",
        "    absUrl: absUrl,",
        "    apply: applyLinkElements,",
        "    LOCAL: LOCAL,",
        "    HOSTED: HOSTED",
        "  };",
        "",
        "  function initLinks() {",
        "    applyLinkElements(document);",
        "  }",
        "",
        "  if (document.readyState === 'loading') {",
        "    document.addEventListener('DOMContentLoaded', initLinks);",
        "  } else {",
        "    initLinks();",
        "  }",
        "})(window);",
        "",
    ]
    return "\n".join(lines)


def route_destination(route: dict) -> str | None:
    rewrite = route.get("rewrite", "__auto__")
    if rewrite is None:
        return None
    if rewrite != "__auto__":
        return rewrite
    local = route["local"]
    if not local.endswith(".html"):
        return None
    return "/" + local


def generate_redirects(config: dict) -> list[dict]:
    redirects: list[dict] = []
    seen_sources: set[str] = set()

    def add(source: str, destination: str) -> None:
        if source in seen_sources:
            return
        seen_sources.add(source)
        redirects.append({"source": source, "destination": destination, "type": 301})

    for route in config["routes"]:
        hosted = route["hosted"]
        if route.get("redirectSlash", True) and hosted != "/" and hosted.startswith("/"):
            add(hosted + "/", hosted)
        if route.get("htmlRedirect", True):
            local = route["local"]
            if local.endswith(".html"):
                source = "/" + local
                if source != hosted and route.get("rewrite", "__auto__") is not None:
                    add(source, hosted)
        for source in route.get("legacySources", []):
            if source != hosted:
                add(source, hosted)
            if source.endswith(".html"):
                continue
            if source != "/" and not source.endswith("/"):
                add(source + "/", hosted)
    return redirects


def generate_rewrites(config: dict) -> list[dict]:
    rewrites: list[dict] = []
    seen: set[str] = set()

    def add(source: str, destination: str) -> None:
        if source in seen:
            return
        seen.add(source)
        rewrites.append({"source": source, "destination": destination})

    for item in config.get("dynamicRewrites", []):
        add(item["source"], item["destination"])

    for route in config["routes"]:
        destination = route_destination(route)
        if destination:
            add(route["hosted"], destination)

    for item in config.get("staticRewrites", []):
        add(item["source"], item["destination"])

    return rewrites


def generate_firebase(config: dict) -> str:
    with FIREBASE_PATH.open(encoding="utf-8") as handle:
        firebase = json.load(handle)
    firebase = deepcopy(firebase)
    hosting = firebase.setdefault("hosting", {})
    hosting["redirects"] = generate_redirects(config)
    hosting["rewrites"] = generate_rewrites(config)
    return json.dumps(firebase, ensure_ascii=False, indent=2) + "\n"


def generate_sitemap(config: dict) -> str:
    site_url = config["siteUrl"].rstrip("/")
    default_lastmod = config.get("lastmod", "")
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    seen: set[str] = set()
    for route in config["routes"]:
        sitemap = route.get("sitemap")
        if not sitemap:
            continue
        hosted = route["hosted"]
        loc = site_url + (hosted if hosted != "/" else "/")
        if loc in seen:
            continue
        seen.add(loc)
        lines.extend(
            [
                "  <url>",
                f"    <loc>{loc}</loc>",
                f"    <lastmod>{sitemap.get('lastmod', default_lastmod)}</lastmod>",
                f"    <changefreq>{sitemap.get('changefreq', 'weekly')}</changefreq>",
                f"    <priority>{sitemap.get('priority', '0.5')}</priority>",
                "  </url>",
            ]
        )
    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


def write_if_changed(path: Path, contents: str, check: bool) -> bool:
    current = path.read_text(encoding="utf-8") if path.exists() else ""
    if current == contents:
        return False
    if check:
        print(f"[DIFF] {path.relative_to(ROOT)} desactualizado")
        return True
    path.write_text(contents, encoding="utf-8")
    print(f"[OK] actualizado {path.relative_to(ROOT)}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Sincroniza rutas Firebase/site-links/sitemap.")
    parser.add_argument("--check", action="store_true", help="No escribe; falla si hay cambios pendientes.")
    args = parser.parse_args()

    config = load_routes()
    changed = False
    changed |= write_if_changed(SITE_LINKS_PATH, generate_site_links(config), args.check)
    changed |= write_if_changed(FIREBASE_PATH, generate_firebase(config), args.check)
    changed |= write_if_changed(SITEMAP_PATH, generate_sitemap(config), args.check)

    if args.check and changed:
      print("[FAIL] Ejecuta: python3 tools/sync_routes.py")
      return 1
    if not changed:
      print("[OK] rutas ya sincronizadas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
