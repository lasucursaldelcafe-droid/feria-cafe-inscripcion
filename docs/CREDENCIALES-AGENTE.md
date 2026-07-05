# Credenciales para el agente Cloud (Cursor)

## Importante: este entorno no es tu PC

El **agente Cloud** corre en un servidor remoto. **No puede abrir tu Chrome ni leer archivos de `C:\Users\...`** a menos que los copies al proyecto o uses **GitHub Secrets** (ya configurados para Firebase).

---

## Estado actual (auditoría automática)

| Componente | Estado | Cómo se configura |
|------------|--------|-------------------|
| Firebase Hosting | ✅ CI funciona | Secreto `FIREBASE_SERVICE_ACCOUNT` en GitHub |
| Apps Script API | ✅ Producción OK | URL en `tools/CANONICAL_SHEETS_URL.txt` |
| Deploy Apps Script (CI) | ⚠️ Falla sin OAuth | Token en `tools/credentials/.oauth-script-token.json` |
| `tools/.env` local | Opcional | Generado por script automático |
| Google Wallet | ⚠️ 404 opcional | `tools/setup_google_wallet.py` |

---

## Un solo comando (agente o tú)

```bash
# Auditoría
python3 tools/agent_setup_completo.py

# Aplicar todo lo posible con archivos en tools/credentials/
python3 tools/agent_setup_completo.py --aplicar

# Solo desde GitHub Actions (sin JSON en disco)
python3 tools/agent_setup_completo.py --cloud
```

Equivalente al mantenimiento clásico:

```bash
python3 tools/automatizar_google.py mantenimiento
```

---

## Qué copiar a `tools/credentials/` (una vez)

Desde tu PC, copia estos archivos **sin subirlos a GitHub**:

| Archivo local (típico) | Destino en el repo |
|------------------------|-------------------|
| JSON Firebase Admin SDK | `tools/credentials/firebase-hosting-sa.json` |
| JSON cuenta Sheets (opcional) | `tools/credentials/feria-sheets-sa.json` |
| Token OAuth Apps Script | `tools/credentials/.oauth-script-token.json` |

### Windows — PowerShell

```powershell
# Ajusta las rutas de origen según dónde guardaste los JSON
Copy-Item "C:\ruta\firebase-sa.json" "tools\credentials\firebase-hosting-sa.json"
Copy-Item "C:\ruta\feria-sheets-sa.json" "tools\credentials\feria-sheets-sa.json"

# OAuth: se genera en el repo al autorizar Google
py tools\setup_admin.py --sin-firebase
# → crea tools\credentials\.oauth-script-token.json
```

Luego en Cursor Cloud (o local):

```bash
python3 tools/agent_setup_completo.py --aplicar
```

Eso hace: `tools/.env` → `sheets-config.js` → secretos GitHub → verificación → deploy.

---

## OAuth Apps Script (único paso con navegador)

No se puede automatizar sin tu cuenta Google la primera vez:

```powershell
py tools\setup_admin.py --sin-firebase
```

1. Se abre el navegador → inicia sesión con `lasucursaldelcafe@gmail.com`
2. Autoriza permisos
3. Vuelve a ejecutar: `python3 tools/agent_setup_completo.py --aplicar`

El token queda en `tools/credentials/.oauth-script-token.json` y el agente lo sube a GitHub Secrets.

---

## GitHub Secrets (ya en la nube)

Si no quieres copiar JSON al agente Cloud, basta con que existan en  
**GitHub → Settings → Secrets → Actions**:

- `FIREBASE_SERVICE_ACCOUNT` ✅ (deploy ya funciona)
- `SHEETS_WEB_APP_URL` (opcional si usas `CANONICAL_SHEETS_URL.txt`)
- `OAUTH_SCRIPT_TOKEN` ⚠️ pendiente para CI de Code.gs
- `APPS_SCRIPT_ID` (opcional)

El agente Cloud **no puede leer** esos secretos, pero los workflows sí.

---

## Verificar que todo quedó bien

```bash
python3 tools/verify_admin.py
python3 tools/verificar_todo.py
python3 tools/agent_release.py status
```

Sitio: https://la-sucursal-del-cafe.web.app/
