# Qué haces tú manualmente vs qué hace el agente

## El agente automatiza (Cloud / GitHub Actions)

| Paso | Cómo |
|------|------|
| Merge del PR (si tiene permiso) | `python3 tools/agent_release.py merge --pr N` |
| Deploy Firebase Hosting | `python3 tools/agent_release.py deploy` o workflow **Agent Web Release** |
| Verificar CSS y tema en producción | `python3 tools/agent_release.py verify --expect-css …` |
| Pipeline completo | `python3 tools/agent_release.py release --pr N --expect-css …` |
| Sincronizar rutas, sheets-config en CI | Workflows `deploy-firebase.yml`, `agent-web-release.yml` |

Tras merge a `main`, también corre **Actualizar todo** (si los secretos están bien).

---

## Lo que solo puedes hacer tú (una vez o puntual)

### 1. Aprobar y mergear el PR (si el agente no tiene permiso)

1. Abre el PR en GitHub (ej. [#59](https://github.com/lasucursaldelcafe-droid/feria-cafe-inscripcion/pull/59)).
2. Revisa el diff visual si quieres.
3. Pulsa **Merge pull request** → **Confirm merge**.

El agente puede reintentar deploy después con:

```bash
python3 tools/agent_release.py deploy
python3 tools/agent_release.py verify --expect-css 20260705pergamino3 --editorial
```

### 2. Secretos de GitHub (solo configuración inicial o rotación)

En **Settings → Secrets and variables → Actions** del repo:

| Secreto | Obligatorio | Cómo obtenerlo |
|---------|-------------|----------------|
| `FIREBASE_SERVICE_ACCOUNT` | **Sí** (para deploy) | Firebase Console → Project settings → Service accounts → Generate new private key (JSON completo) |
| `SHEETS_WEB_APP_URL` | Recomendado | URL `/exec` de Apps Script (o deja que CI use `tools/CANONICAL_SHEETS_URL.txt`) |
| `OAUTH_SCRIPT_TOKEN` | Solo si cambias `Code.gs` desde CI | `py tools/setup_admin.py --sin-firebase` en tu PC |
| `APPS_SCRIPT_ID` | Opcional | ID del proyecto Apps Script |

Desde tu PC (una vez):

```powershell
gh secret set FIREBASE_SERVICE_ACCOUNT < ruta\firebase-sa.json
gh secret set SHEETS_WEB_APP_URL --body "https://script.google.com/macros/s/.../exec"
```

O: `py tools/setup_github_ci.py --run-workflow`

### 3. OAuth Apps Script (solo al cambiar backend `Code.gs`)

Si el workflow **Deploy Apps Script** falla por token:

1. En tu PC: `py tools/setup_admin.py --sin-firebase`
2. Autoriza en el navegador cuando pida Google.
3. Vuelve a subir el token: `py tools/setup_github_ci.py --apps-script`

### 4. `sincronizarEncabezados()` en Sheets (tras cambios de columnas)

Solo si cambiaste estructura de hojas en `Code.gs`:

1. Abre el editor de Apps Script.
2. Ejecuta la función `sincronizarEncabezados` una vez.
3. Autoriza si lo pide.

### 5. Revisión visual en el móvil (recomendado)

Abre en el teléfono tras el deploy:

- https://la-sucursal-del-cafe.web.app/
- https://la-sucursal-del-cafe.web.app/inscripcion

Comprueba contraste, botones y navegación.

---

## Checklist rápido — release diseño Pergamino (ahora)

- [ ] **Tú:** Merge PR #59 (si el agente no pudo mergear solo)
- [ ] **Agente:** `release --pr 59 --expect-css 20260705pergamino3 --editorial`
- [ ] **Tú:** Mirar el sitio en móvil y confirmar que se ve bien
- [ ] **Tú (solo si deploy falla):** Verificar que existe `FIREBASE_SERVICE_ACCOUNT` en GitHub Secrets

---

## Comprobar que producción está actualizada

```bash
python3 tools/agent_release.py status
```

Debe coincidir:

- Repo: `brand.css?v=20260705pergamino3`
- Producción: el mismo sufijo
- Tema editorial: **sí**

Sitio: https://la-sucursal-del-cafe.web.app/
