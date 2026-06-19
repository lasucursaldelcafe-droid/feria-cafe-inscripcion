# Credenciales — Feria Café Inscripción

## No puedes descargar un JSON real

Si al intentar **Agregar clave → JSON** en Google Cloud Console ves un error como:

- `Key creation is not allowed on this service account`
- `La política de la organización restringe la creación de claves`

…tu cuenta o dominio tiene una **política organizacional** (`iam.disableServiceAccountKeyCreation`) que impide emitir claves de cuenta de servicio. **Solo Google puede generar claves privadas válidas**; ningún archivo de plantilla sustituye a un JSON descargado.

El archivo `service-account.EJEMPLO.json` de este repositorio es **solo referencia de estructura**. No lo subas a Google Cloud ni lo uses como credencial: **no funcionará**.

---

## Opción A — Proyecto personal de Google Cloud

Si necesitas automatizar la creación de la hoja con Python (`conectar_sheets.py --crear-hoja`):

1. Crea un **proyecto GCP personal** con una cuenta Gmail **fuera** de la organización corporativa (por ejemplo `@gmail.com`).
2. Habilita **Google Sheets API** y **Google Drive API**.
3. Crea una cuenta de servicio y descarga el JSON (si la política personal no lo bloquea).
4. Guárdalo en `tools/credentials/feria-sheets-sa.json` (ignorado por git).
5. Configura `tools/.env` y ejecuta:

   ```powershell
   py tools/automatizar_todo.py --solo-sheets
   ```

---

## Opción B — Sin JSON (recomendado si estás bloqueado)

**No necesitas cuenta de servicio** para que los formularios escriban en Sheets. Basta con:

1. Crear la hoja manualmente en [sheets.new](https://sheets.new).
2. Pegar los encabezados de las pestañas **Feria** y **Competencia** (ver `tools/PLANTILLA-ENCABEZADOS.json`).
3. Desplegar **Apps Script** desde la hoja (copiar `tools/google-apps-script/Code.gs`).
4. Configurar la URL `/exec` en el sitio.

Guía interactiva paso a paso:

```powershell
py tools/modo_sin_json.py
```

Equivalente en el orquestador:

```powershell
py tools/automatizar_todo.py --sin-cuenta-servicio
```

Documentación completa: `tools/INSTRUCCIONES-SHEETS.md` → sección **Modo sin JSON**.

---

## Archivos en esta carpeta

| Archivo | Propósito |
| ------- | --------- |
| `service-account.EJEMPLO.json` | Plantilla de estructura (no funcional; sin `private_key`) |
| `apps-script-manifest.json` | Manifiesto de referencia para Apps Script (igual que `google-apps-script/appsscript.json`) |
| `feria-sheets-sa.json` | Credencial real (crear localmente; **nunca** subir al repo) |
