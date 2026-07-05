---
name: feria-release-automation
description: >-
  Release web automatizado para agentes Cloud: merge PR, deploy Firebase Hosting,
  verificar CSS/editorial en producción. Usar tras cambios en HTML/CSS/JS del sitio
  festival cuando el usuario pida publicar, desplegar o automatizar pasos manuales.
---

# Feria — Release automatizado (agentes Cloud)

## Cuándo usar

- Cambios en `css/brand.css`, HTML festival, ilustraciones, `site-links.js`
- Usuario pide «despliega», «publica», «qué me toca hacer manualmente»
- Producción sirve versión vieja (`brand.css?v=` distinto al repo)

## Pipeline del agente (sin PC del usuario)

```bash
# 1. Estado actual
python3 tools/agent_release.py status --pr 59

# 2. Release completo: merge + deploy CI + verificar producción
python3 tools/agent_release.py release --pr 59 --expect-css 20260705pergamino3 --editorial

# Solo deploy (PR ya mergeado)
python3 tools/agent_release.py deploy --workflow hosting
python3 tools/agent_release.py verify --expect-css 20260705pergamino3 --editorial
```

## Workflows GitHub

| Workflow | Uso |
|----------|-----|
| `Agent Web Release` | `agent-web-release.yml` — deploy + verify CSS/editorial |
| `Deploy Firebase Hosting` | Solo hosting |
| `Actualizar todo` | Apps Script + hosting (push a `main`) |

Lanzar desde agente:

```bash
gh workflow run "Agent Web Release" -f expect_css_version=20260705pergamino3 -f require_editorial=true
gh run watch $(gh run list --workflow agent-web-release.yml --limit 1 --json databaseId -q '.[0].databaseId')
```

## Secuencia recomendada tras cambios visuales

1. Commit + push en rama `cursor/*-5490`
2. Crear/actualizar PR
3. `python3 tools/agent_release.py release --pr N --expect-css SUFIJO --editorial`
4. Si merge falla por permisos → indicar al usuario el enlace del PR

## Qué NO puede hacer el agente (usuario manual)

Ver `docs/PASOS-MANUALES-USUARIO.md`.

## Referencias

- `tools/agent_release.py`
- `.github/workflows/agent-web-release.yml`
- Skill `feria-web-hosting`
