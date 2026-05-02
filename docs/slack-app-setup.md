# Slack App Setup — Runbook

> Para: dueño del workspace de Slack (vos, Damaso).
> Lo hacés **una sola vez**, ~15 min. Sin esto los botones de Slack
> ("Marcar contactado", "Asignarme", etc.) no pueden actuar sobre el CRM.

## Por qué hace falta

Hoy el CRM manda mensajes a Slack via **Incoming Webhook** (one-way, sirve
para los reportes y alertas informativos). Los botones interactivos
necesitan que **Slack pueda llamar al CRM** cuando alguien clickea — eso
requiere una **Slack App** con permisos de OAuth y un signing secret.

Las dos formas de mensajería **coexisten**: el webhook actual sigue para
reportes/cron, y la App nueva habilita los clicks.

## Paso 1 — Crear la app

1. Andá a `https://api.slack.com/apps`
2. **Create New App** → **From scratch**
3. App Name: `SacaMedi CRM`
4. Pick a workspace: tu workspace de SacaMedi
5. **Create App**

## Paso 2 — Configurar OAuth scopes

1. En el menú izquierdo: **OAuth & Permissions**
2. Bajá hasta **Scopes** → **Bot Token Scopes** → **Add an OAuth Scope**:
   - `chat:write` — mandar y editar mensajes
   - `users:read` — listar usuarios del workspace
   - `users:read.email` — leer el email de cada usuario (necesario para mapear
     quién clickeó al usuario CRM correspondiente)
3. **No** agregues scopes de usuario (User Token Scopes) — solo bot token.

## Paso 3 — Configurar Interactivity URL

1. En el menú izquierdo: **Interactivity & Shortcuts**
2. Toggle **Interactivity** → **ON**
3. **Request URL**:
   ```
   https://<tu-dominio-railway>/api/slack/interactive
   ```
   Reemplazá `<tu-dominio-railway>` por tu dominio real (ej.
   `sacamedi-crm-production.up.railway.app`). Para conseguirlo:
   ```
   railway variables --json | jq -r '.RAILWAY_PUBLIC_DOMAIN'
   ```
   (o miralo en el dashboard Railway → Settings → Networking → Public
   Networking)
4. **Save Changes** abajo a la derecha.

## Paso 4 — Instalar la app al workspace

1. **OAuth & Permissions** (volvé arriba)
2. **Install to Workspace** → autorizá los permisos.
3. Después de la autorización, copiá el **Bot User OAuth Token**
   (empieza con `xoxb-...`).

## Paso 5 — Copiar el Signing Secret

1. Menú izquierdo: **Basic Information**
2. Bajá a **App Credentials** → copiá el **Signing Secret**.

## Paso 6 — Setear las env vars en Railway

```bash
railway variables --set SLACK_BOT_TOKEN=xoxb-...
railway variables --set SLACK_SIGNING_SECRET=<el-signing-secret>
```

(O desde el dashboard Railway → Variables → New Variable, dos veces.)

Railway redeploya automático al cambiar env vars (~1 min).

## Paso 7 — Invitar al bot al canal

En el canal de Slack donde quieras los alerts:
```
/invite @SacaMedi CRM
```
(Slack te autocompleta el nombre del bot.)

## Paso 8 — Validar end-to-end

1. En el CRM: `/admin/round-robin` → **Test Slack** (botón).
2. El mensaje llega al canal con botones de test:
   - **Test ping** — manda un click al endpoint y muestra "Procesado por X · 14:30"
3. Si el click funciona y el mensaje se actualiza → **todo OK**.

Si el click falla:
- Revisá `railway logs` por mensajes "Invalid signature" → mal copiado el
  `SLACK_SIGNING_SECRET`.
- Revisá los logs de Slack: en el dashboard de tu Slack App → **Activity Log**
  o **OAuth & Permissions** → Token Rotation → ver últimos events.

## Notas sobre seguridad

- **No publiquees** el `SLACK_BOT_TOKEN` ni el `SLACK_SIGNING_SECRET` en
  ningún lado (commits, mensajes, capturas).
- Si alguno se filtra: en el dashboard de la app Slack → **Basic Information**
  → **Regenerate Signing Secret** y/o reinstalar la app para rotar el token.
  Después actualizar Railway env vars.
- Solo usuarios del workspace de Slack pueden disparar acciones — el
  signing-secret check filtra requests externos.
- Adicionalmente, el handler valida que el correo del Slack user esté
  registrado en `team_members` activo del CRM. Si no, el click responde con
  un mensaje "No autorizado" en lugar de actuar.

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| Click muestra "operation_timeout" en Slack | Server tardó más de 3s en ack | Revisar Railway logs por errores en `/api/slack/interactive` |
| "Invalid signature" en logs | Signing secret mal copiado | Re-copiar de Slack → Basic Info |
| "No pude identificarte" en respuesta | Email Slack ≠ correo en `team_members` | Agregar el usuario en `/admin/equipo` con su correo Slack |
| El bot no recibe los mensajes | Bot no fue invitado al canal | `/invite @SacaMedi CRM` en el canal |
| Mensaje se manda pero sin botones | App no instalada / token vacío | Verificar `SLACK_BOT_TOKEN` en Railway + app instalada |

## Qué pasa si no configurás esto

Las alertas siguen funcionando como hoy (link buttons que abren URLs).
Solo perdés las acciones de 1-click. El sistema NO se rompe — `SLACK_BOT_TOKEN`
ausente hace que los botones interactivos se omitan automáticamente y solo
queden los link buttons.
