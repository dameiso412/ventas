# Trazabilidad por Landing — Runbook GHL

> Para: equipo de marketing. Asume acceso a GHL y al CRM (`/atribucion`).

## Por qué existe este doc

El CRM ya está preparado para recibir un slug por landing (EVTS-IN,
DIAGNOSTICO, HOME, OTRO). Lo vemos en la sección **Performance por
Landing** de `/atribucion`. Pero si GHL no manda el slug, todos los leads
caen en la fila **"Sin landing"** — inútil para decidir dónde invertir.

Este runbook es lo que hay que configurar **una sola vez por landing**
para que cada lead nuevo llegue etiquetado.

## Flujo

```
Lovable (landing EVTS-IN, DIAGNOSTICO, HOME)
   └─ usuario completa form →
      GHL (encuesta + automatización)
         └─ Paso NUEVO: Set Custom Field landing_slug = "EVTS-IN"
         └─ Paso existente: Webhook al CRM (incluir {{contact.landing_slug}})
            └─ CRM guarda lead.landingSlug = "EVTS-IN"
```

## Setup paso a paso (por cada landing)

### 1. Crear el custom field en GHL (solo la primera vez)

1. GHL → `Settings` → `Custom Fields` → `+ Add Field`
2. Field Name: **`Landing Slug`**
3. Field Key (importante, GHL lo genera): **`contact.landing_slug`**
4. Field Type: `Single Line`
5. Save.

### 2. Agregar el paso en la automatización de cada landing

Cada landing en Lovable redirige a una encuesta GHL distinta, y cada
encuesta dispara una automatización. Hay que editar esa automatización:

1. GHL → `Automation` → abrir el workflow de esa landing.
2. Antes del paso que dispara el webhook al CRM, agregar:
   - Acción: **`Update Contact Field`** (o `Set Custom Field`, según versión de GHL).
   - Field: `Landing Slug`
   - Value (texto fijo, según la landing):
     - Workflow de EVTS-IN → `EVTS-IN`
     - Workflow de DIAGNOSTICO → `DIAGNOSTICO`
     - Workflow de HOME → `HOME`
     - (cualquier landing nueva → slug en MAYÚSCULAS, sin espacios)
3. Abrir el paso del **Webhook** que ya existía.
4. En el body (Custom Payload), agregar la línea:
   ```
   "landing_slug": "{{contact.landing_slug}}"
   ```
   Si el body ya manda otros campos como `utm_source`, `landing_url`, etc., agregar esta línea junto a ellos sin borrar nada.
5. Guardar el workflow y **publicar**.

### 3. (Opcional) Mandar también la URL cruda

Si querés un fallback cuando el slug no esté seteado (por ejemplo en un
workflow que no tocaste), podés mandar también:
```
"landing_url": "{{contact.source_url}}"
```
El CRM intenta derivar el slug desde la URL si `landing_slug` viene vacío.

## Validación

### Test de cada landing (una vez hecha la config)

1. Abrí la landing en modo incógnito, completá el form, agendá una cita falsa.
2. En el CRM → `/atribucion` → **Performance por Landing**: el lead nuevo debe aparecer en la fila correcta (no en "Sin landing").
3. Si aparece en "Sin landing":
   - Revisá **Webhook logs** del CRM (URL `/webhooks`): el último evento debe tener `landing_slug` en el JSON recibido.
   - Si no lo tiene: el paso "Set Custom Field" en el workflow no se está ejecutando antes del webhook, o el body del webhook no incluye `{{contact.landing_slug}}`.

### Monitoreo continuo

En `/atribucion` → **Performance por Landing**, la fila "Sin landing" te dice cuántos leads nuevos están llegando sin etiqueta:

- **< 10%**: normal. Son leads de fuentes ad-hoc (DMs directos, links manuales, etc.) que nunca pasaron por una landing.
- **10-20%**: revisar si hay un workflow nuevo que no se configuró.
- **> 20%**: el CRM muestra un banner ⚠️ "Config GHL" en esa tarjeta. Auditar cada workflow de GHL.

## Casos de borde

- **Landing nueva sin agregar al CRM**: el slug que mandes llega verbatim (en mayúsculas). Aparecerá en la tabla como una fila nueva. Si querés que la derivación por URL también funcione para ella, agregá el patrón en `server/_core/landings.ts` → `LANDING_PATTERNS`.
- **Rename de landing** (`/evts-in` → `/events-in`): el regex en `LANDING_PATTERNS` ya cubre ambas variantes. Si renombrás a algo totalmente distinto, agregar el alias.
- **Lead rescheduleado**: el slug NO se sobreescribe si ya tenía uno (para no perder la atribución del lead original). Un lead que venía con slug NULL sí se backfillea si el reschedule trae un slug nuevo.

## Dónde vive esto en el código

| Qué | Dónde |
|---|---|
| Columna DB | `drizzle/schema.ts:landingSlug` (varchar 50, nullable) |
| Migración | `drizzle/0011_leads_landing_slug.sql` |
| Derivación desde URL | `server/_core/landings.ts` |
| Captura en webhooks | `server/webhook.ts` (3 paths: GHL lead, prospect, ManyChat) |
| Agregación | `server/db.ts:getLeadMetricsByLanding` |
| Endpoint tRPC | `server/routers.ts:attribution.byLanding` |
| UI | `client/src/pages/atribucion/LandingPerformanceCard.tsx` |
