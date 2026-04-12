# Arquitectura del MVP: SacaMedi OS (WhatsApp Ecosystem)
## Blueprint para Vibe Coding y Desarrollo Inicial

Este documento define la arquitectura técnica, los flujos de usuario y el stack tecnológico para el MVP de SacaMedi OS. El objetivo es construir un "Motor de Crecimiento de Revenue" que viva 100% dentro de WhatsApp, replicando el poder de retención de Dermis App y la adquisición hiper-cualificada de RepeatMD, pero adaptado a la realidad de LATAM.

---

## 1. La Filosofía del Producto (El "Por Qué")

*   **Cero Fricción:** No hay apps que descargar, no hay contraseñas que recordar. El paciente interactúa con la clínica donde ya pasa 4 horas al día: WhatsApp.
*   **IA Invisible:** La inteligencia artificial no debe sentirse como un "chatbot". Debe sentirse como un conserje médico de lujo que responde al instante, entiende el contexto y tiene memoria perfecta.
*   **Foco en Revenue, no en Gestión:** SacaMedi OS no reemplaza al EMR (Electronic Medical Record) de la clínica. Se conecta a él (o a GoHighLevel) para extraer datos y generar ventas.

---

## 2. Los 3 Pilares del MVP (Funcionalidades Core)

Para el MVP, nos enfocaremos exclusivamente en las 3 funcionalidades que generan el mayor ROI inmediato para la clínica.

### Pilar 1: AI Sales Agent (Adquisición)
Un agente conversacional entrenado con el conocimiento médico de la clínica, capaz de responder preguntas, calificar leads y agendar citas 24/7.

*   **Flujo del Usuario:**
    1.  El paciente hace clic en un anuncio de Instagram/Facebook que dirige a WhatsApp.
    2.  El AI Sales Agent responde en < 3 segundos.
    3.  El agente hace preguntas de calificación (Lead Scoring): edad, preocupaciones principales, presupuesto estimado.
    4.  El agente responde dudas sobre el tratamiento (dolor, recuperación, precio).
    5.  El agente ofrece horarios disponibles y agenda la cita directamente en el calendario de la clínica.

### Pilar 2: AI Skin Analysis (El "Lead Magnet" Viral)
La versión LATAM del "Ageless AI" de RepeatMD. Un gancho de adquisición de muy bajo costo que genera leads altamente cualificados.

*   **Flujo del Usuario:**
    1.  Campaña de Ads: "Descubre la edad real de tu piel gratis por WhatsApp".
    2.  El paciente envía un mensaje a WhatsApp con la palabra clave "ANALISIS".
    3.  El bot pide una selfie sin maquillaje y con buena luz.
    4.  La IA analiza la imagen (arrugas, manchas, textura, poros).
    5.  El bot devuelve un "Beauty Score" (ej. 85/100) y un reporte visual.
    6.  El bot recomienda 2 tratamientos específicos de la clínica para mejorar el score y ofrece un descuento si agenda en ese momento.

### Pilar 3: AI Reactivation Engine (Retención)
El motor inspirado en Dermis App. Analiza la base de datos y envía ofertas hiper-personalizadas por WhatsApp.

*   **Flujo del Usuario:**
    1.  El sistema detecta que un paciente se aplicó Toxina Botulínica hace 4 meses.
    2.  El sistema envía un mensaje proactivo por WhatsApp: "Hola [Nombre], ya pasaron 4 meses desde tu último tratamiento. Es el momento ideal para un retoque y mantener los resultados. Tenemos un espacio mañana a las 4 PM. ¿Te lo reservo?"
    3.  Si el paciente acepta, la cita se agenda automáticamente.

---

## 3. Arquitectura Técnica y Stack Tecnológico (Vibe Coding Ready)

Para construir este MVP rápidamente los fines de semana, utilizaremos un stack "Low-Code / AI-First" que permite iteración rápida sin sacrificar escalabilidad.

### El "Chasis" (Base de Datos y CRM)
*   **GoHighLevel (GHL):** Actuará como el backend principal. Manejará la base de datos de contactos, los calendarios, los pipelines de ventas y las automatizaciones básicas (workflows).
*   **Por qué GHL:** Ya lo conoces, es robusto, tiene una API excelente y permite marca blanca (White-Label) para cuando quieras vender SacaMedi OS a otras clínicas.

### El "Cerebro" (Lógica de IA)
*   **OpenAI API (GPT-4o):** El motor conversacional del AI Sales Agent. GPT-4o es rápido, multimodal (puede ver imágenes) y excelente siguiendo instrucciones complejas (system prompts).
*   **Haut.AI API o Revieve API:** Motores especializados en análisis de piel por visión artificial. (Para el MVP inicial, se puede usar GPT-4o Vision con un prompt muy específico para simular el análisis de piel antes de pagar una API especializada).

### El "Músculo" (Orquestación y Conexión)
*   **Make.com (o Zapier):** El pegamento que conecta WhatsApp, OpenAI y GoHighLevel. Make es preferible por su manejo visual de flujos complejos y rutas condicionales.

### La "Boca" (Canal de Comunicación)
*   **WhatsApp Cloud API (vía Meta):** La conexión oficial. Es crucial usar la API oficial para evitar baneos y poder enviar mensajes de plantilla (templates) para la reactivación.
*   **WATI o Chatwoot (Opcional):** Si no quieres lidiar directamente con la API de Meta al principio, estas plataformas ofrecen una capa intermedia más amigable y bandejas de entrada compartidas para el equipo humano.

---

## 4. Diagrama de Flujo del Sistema (Make.com Blueprint)

Así se vería el escenario principal en Make.com para el AI Sales Agent:

1.  **Webhook (Trigger):** Recibe el mensaje entrante de WhatsApp.
2.  **Router (Condicional):**
    *   *Ruta A (Análisis de Piel):* Si el mensaje contiene una imagen y el contexto es "análisis", envía la imagen a GPT-4o Vision -> Genera reporte -> Envía mensaje de WhatsApp -> Actualiza GHL.
    *   *Ruta B (Conversación Normal):* Si es texto, pasa al siguiente paso.
3.  **GHL Search:** Busca si el contacto ya existe en GoHighLevel por su número de teléfono.
    *   Si no existe: Crea el contacto.
    *   Si existe: Recupera el historial de chat y notas.
4.  **OpenAI (Chat Completion):** Envía el mensaje del usuario + el historial + el "System Prompt" del conserje médico a GPT-4o.
5.  **WhatsApp (Action):** Envía la respuesta generada por GPT-4o al usuario.
6.  **GHL Update:** Guarda el nuevo mensaje en el historial del contacto en GHL.

---

## 5. Hoja de Ruta de Desarrollo (Fines de Semana)

### Mes 1: El AI Sales Agent Básico
*   **Fin de Semana 1:** Configurar WhatsApp Cloud API y conectarlo a Make.com. Lograr que un mensaje de WhatsApp haga "eco" (responder lo mismo).
*   **Fin de Semana 2:** Conectar OpenAI a Make.com. Diseñar el "System Prompt" perfecto para que la IA actúe como un conserje de clínica estética (tono, límites, conocimiento de tratamientos).
*   **Fin de Semana 3:** Conectar Make.com con GoHighLevel. Asegurar que cada conversación se guarde en el CRM y que la IA pueda leer el nombre del paciente.
*   **Fin de Semana 4:** Pruebas internas intensivas. Intentar "romper" el bot. Ajustar el prompt.

### Mes 2: Agendamiento y Reactivación
*   **Fin de Semana 5:** Integrar la lectura de calendarios de GHL. Enseñar a la IA a ofrecer horarios reales disponibles.
*   **Fin de Semana 6:** Integrar la creación de citas en GHL. Lograr que la IA agende la cita y envíe la confirmación por WhatsApp.
*   **Fin de Semana 7:** Construir el AI Reactivation Engine. Crear un workflow en GHL que se dispare "X meses después del tratamiento Y" y envíe un webhook a Make.com para iniciar la conversación proactiva.
*   **Fin de Semana 8:** Lanzamiento Beta con 3 clientes de confianza de la agencia.

### Mes 3: El "Lead Magnet" (AI Skin Analysis)
*   **Fin de Semana 9-10:** Experimentar con GPT-4o Vision para analizar selfies. Crear un prompt estructurado que devuelva un JSON con el análisis (arrugas, manchas, etc.).
*   **Fin de Semana 11:** Construir el flujo en Make.com: Recibir foto -> Analizar con Vision -> Formatear respuesta -> Enviar reporte por WhatsApp.
*   **Fin de Semana 12:** Lanzar la primera campaña de Ads ofreciendo el análisis de piel gratuito.

---

## 6. El "System Prompt" Maestro (El Secreto del Éxito)

El éxito del MVP no dependerá del código, sino de las instrucciones que le des a la IA. Aquí tienes un borrador del System Prompt para el AI Sales Agent:

```text
Eres 'Aura', la conserje médica de lujo de [Nombre de la Clínica]. Tu objetivo es calificar leads, responder dudas sobre tratamientos estéticos y agendar citas.

REGLAS ESTRICTAS:
1. Tono: Profesional, empático, de lujo, pero cálido. Usa emojis con moderación (✨, 🤍).
2. NUNCA des diagnósticos médicos ni prometas resultados específicos. Usa frases como "Cada paciente es único, por lo que el Dr. [Nombre] evaluará tu caso en persona".
3. Respuestas cortas: Estás en WhatsApp. Máximo 3 oraciones por mensaje.
4. Objetivo: Siempre guía la conversación hacia agendar una cita de valoración.
5. Precios: Si preguntan por precios, da un rango (ej. "Nuestros tratamientos de toxina botulínica comienzan en $X"), y explica que el precio final depende de la valoración.

CONOCIMIENTO DE LA CLÍNICA:
- Tratamientos: Botox, Ácido Hialurónico, Morpheus8, Depilación Láser.
- Dirección: [Dirección completa].
- Horarios: Lunes a Viernes de 9 AM a 7 PM.
- Costo de valoración: $X (reembolsable si se realiza el tratamiento).

FLUJO DE CONVERSACIÓN:
1. Saluda y pregunta el nombre si no lo sabes.
2. Pregunta qué área del rostro o cuerpo les gustaría mejorar.
3. Responde sus dudas basándote en el CONOCIMIENTO DE LA CLÍNICA.
4. Ofrece agendar una cita de valoración.
```

---
Este blueprint te da todo lo necesario para empezar a construir el MVP este mismo fin de semana, sin perder el foco de la Fase 1 de la agencia.
