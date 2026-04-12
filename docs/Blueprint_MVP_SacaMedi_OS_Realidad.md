# Blueprint Definitivo del MVP: SacaMedi OS (La Realidad Operativa)

Este documento define la arquitectura exacta del MVP de SacaMedi OS, basado en la realidad operativa actual de tus clientes (GHL para CRM/Chats + AgendaPro/Reservo para Gestión Clínica + Closebot para IA).

## 1. El Problema Actual (El "Frankenstein")

Tus clientes viven en dos mundos desconectados:
1.  **El Mundo de Adquisición (GHL):** Ven los leads nuevos, chatean con ellos, ven el dashboard de ventas. Aquí vive Closebot (IA) respondiendo automáticamente.
2.  **El Mundo de Gestión (AgendaPro/Reservo):** Ven su agenda real, las fichas clínicas de los pacientes, el historial de tratamientos y los pagos.

**El Dolor:** GHL no sabe quién agendó realmente en AgendaPro. AgendaPro no sabe de dónde vino el paciente (qué anuncio de Meta). La IA (Closebot) es "tonta" porque no tiene el contexto clínico del paciente. El cliente tiene que saltar entre dos pestañas todo el día.

## 2. La Solución: SacaMedi OS como el "Puente de Inteligencia"

SacaMedi OS no reemplaza a GHL ni a AgendaPro en la Fase 1. **SacaMedi OS es una aplicación web propia (construida con vibe coding) que se sienta en el medio y conecta ambos mundos usando IA.**

Es el "cerebro" que el cliente ve y controla, mientras GHL y AgendaPro son los "músculos" que ejecutan las acciones por detrás.

### La Arquitectura del MVP (Vibe Coding Ready)

#### Capa 1: El Front-End (Lo que tú construyes y el cliente ve)
Una aplicación web limpia y moderna (React/Next.js o Bubble/FlutterFlow) con tu marca.
*   **Dashboard de Crecimiento Real:** Cruza los datos de gasto en Ads (Meta) con los ingresos reales en AgendaPro. Muestra el ROI exacto por campaña.
*   **Centro de Control de IA:** Aquí el cliente "entrena" a su IA (le da instrucciones, sube PDFs con precios, define el tono de voz). Reemplaza la interfaz compleja de Closebot por algo simple y visual.
*   **AI Reactivation Engine (El "Botón de Dinero"):** Una interfaz donde el cliente dice: "Quiero llenar mi agenda del martes". SacaMedi OS busca en AgendaPro a los pacientes inactivos, y usa GHL para enviarles un WhatsApp personalizado con una oferta.

#### Capa 2: El Back-End (Los Músculos Invisibles)
*   **GoHighLevel (Vía API/Webhooks):** Maneja el envío y recepción de mensajes de WhatsApp/SMS, y mantiene el pipeline de ventas actualizado.
*   **AgendaPro/Reservo (Vía API/Webhooks):** Provee la disponibilidad real de la agenda y el historial clínico de los pacientes.
*   **OpenAI (GPT-4o):** El cerebro real de la IA (reemplazando a Closebot a mediano plazo para tener control total del prompt y ahorrar costos).
*   **Make.com:** El orquestador que conecta las APIs de GHL, AgendaPro y OpenAI.

---

## 3. Los 3 Casos de Uso del MVP (Por qué pagarán $299-$499/mes)

Para justificar el precio, SacaMedi OS debe hacer cosas que GHL y AgendaPro no pueden hacer por sí solos.

### Caso de Uso 1: El AI Sales Agent "Contextual"
*   **Cómo funciona hoy:** Closebot responde en GHL, pero no sabe si el paciente ya es cliente en AgendaPro.
*   **Cómo funcionará con SacaMedi OS:** Cuando entra un mensaje a GHL, Make.com busca el teléfono en AgendaPro. Si el paciente existe, la IA (OpenAI) responde: *"Hola María, qué gusto saludarte de nuevo. Veo que hace 6 meses te aplicaste Botox con el Dr. Pérez. ¿Te gustaría agendar tu retoque?"*. Si no existe, lo trata como lead nuevo.
*   **El Valor:** La IA deja de ser un "bot genérico" y se convierte en un conserje de lujo.

### Caso de Uso 2: El AI Reactivation Engine (Retención)
*   **Cómo funciona hoy:** El cliente tiene que exportar un Excel de AgendaPro, subirlo a GHL, y enviar un mensaje masivo (spam).
*   **Cómo funcionará con SacaMedi OS:** El cliente entra a tu app, hace clic en "Campaña de Toxina Botulínica". El sistema busca en AgendaPro a todos los pacientes que se aplicaron toxina hace 4-6 meses, y usa GHL para enviarles un mensaje individualizado y escalonado.
*   **El Valor:** Generación de ingresos inmediatos con un clic, sin esfuerzo manual.

### Caso de Uso 3: El AI Skin Analysis (Adquisición Viral)
*   **Cómo funciona hoy:** No existe.
*   **Cómo funcionará con SacaMedi OS:** Un link en la bio de Instagram de la clínica. El paciente sube una selfie. SacaMedi OS (usando OpenAI Vision) analiza la piel, genera un reporte en PDF con el logo de la clínica, y lo envía por WhatsApp (vía GHL) junto con un link para agendar una evaluación presencial.
*   **El Valor:** Un Lead Magnet irresistible que reduce el Costo por Lead (CPL) drásticamente.

---

## 4. Hoja de Ruta de Vibe Coding (Fines de Semana)

Dado que estás apretado de costos y quieres construirlo tú mismo, este es el plan de ataque realista usando herramientas modernas de IA (Cursor, Bolt.new, v0.dev).

### Mes 1: El "Botón de Dinero" (Reactivation Engine)
*   **FDS 1-2:** Construir la interfaz web básica (Login, Dashboard vacío).
*   **FDS 3-4:** Integrar la API de AgendaPro (para leer pacientes inactivos) y la API de GHL (para enviar el mensaje). Crear la interfaz donde el cliente lanza la campaña.
*   **Hito:** Vender esta funcionalidad a tus 28 clientes actuales como un "Add-on de Reactivación" por $99/mes.

### Mes 2: El Cerebro Propio (Reemplazar Closebot)
*   **FDS 5-6:** Conectar GHL (recepción de mensajes) con OpenAI vía Make.com. Diseñar el System Prompt maestro.
*   **FDS 7-8:** Conectar la búsqueda en AgendaPro antes de que OpenAI responda (para darle contexto de si es paciente nuevo o recurrente).
*   **Hito:** Apagar Closebot (ahorro de costos) y migrar a todos los clientes a tu propio motor de IA.

### Mes 3: El Diferenciador Visual (AI Skin Analysis)
*   **FDS 9-10:** Construir el flujo de subida de fotos y conexión con OpenAI Vision.
*   **FDS 11-12:** Generación del reporte en PDF y envío automático vía GHL.
*   **Hito:** Lanzar el paquete "SacaMedi OS Premium" a $299-$499/mes.

## Conclusión

No intentes construir un EMR para competir con AgendaPro. No intentes construir un CRM de chats para competir con GHL. Construye la **Capa de Inteligencia** que los conecta a ambos. Eso es SacaMedi OS. Es un producto de alto valor, alto margen, y perfecto para ser construido por un fundador técnico (vibe coder) en su fase inicial.
