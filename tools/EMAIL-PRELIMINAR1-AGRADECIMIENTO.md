# Correo de agradecimiento — Preliminar 1

Envía a los **12 competidores de la Preliminar 1** un correo con:

- Agradecimiento por participar
- Enlace al portal de resultados (`/jurado/resultados`) con instrucciones (cédula)
- Enlace a inscripción **Preliminar 2** (`/competencia`)
- Guía del circuito y reglamento
- WhatsApp del torneo y correo del organizador

## 1. Desplegar Code.gs

Tras editar `tools/google-apps-script/Code.gs`, redespliega la Web App (nueva implementación `/exec`).

## 2. Vista previa local (kit)

```bash
node tools/send_preliminar1_thankyou.mjs
```

Lista los correos del archivo `tools/PRELIMINAR-1-KIT.json` y muestra un ejemplo del texto.

## 3. Simular envío (sin mandar correos)

Desde el **editor Apps Script** → Ejecutar:

```javascript
enviarAgradecimientoPreliminar1({ dryRun: true })
```

O vía API (tras deploy):

```bash
node tools/send_preliminar1_thankyou.mjs --dry-run --pin v60organizador
```

## 4. Prueba a un solo correo

Editor Apps Script:

```javascript
enviarAgradecimientoPreliminar1({ dryRun: false, soloCorreo: 'tu@gmail.com' })
```

CLI:

```bash
node tools/send_preliminar1_thankyou.mjs --send --pin v60organizador --solo tu@gmail.com
```

## 5. Envío masivo a todos los inscritos P1 (hoja Competencia)

Solo cuando la prueba esté bien:

```javascript
enviarAgradecimientoPreliminar1({ dryRun: false })
```

```bash
node tools/send_preliminar1_thankyou.mjs --send --pin v60organizador
```

Los destinatarios se leen de la hoja **Competencia** filtrando `Evento = V60 Championship — Preliminar 1` y `Habilitado = Sí`.

## Enlaces incluidos en el correo

| Recurso | URL |
|---------|-----|
| Resultados | https://la-sucursal-del-cafe.web.app/jurado/resultados |
| Inscripción P2 | https://la-sucursal-del-cafe.web.app/competencia |
| Cómo funciona | https://la-sucursal-del-cafe.web.app/como-funciona |
| Reglamento | https://la-sucursal-del-cafe.web.app/reglas |
| Contacto | lasucursaldelcafe@gmail.com |
