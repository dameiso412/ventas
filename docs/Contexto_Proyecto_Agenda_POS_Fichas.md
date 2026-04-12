# Documentación de Contexto: Proyecto Agenda, POS y Fichas Clínicas (SacaMedi OS)

**Para:** Equipo de Desarrollo y Producto
**Fecha de Compilación:** Abril 2026
**Objetivo:** Proporcionar una lista consolidada, priorizada y estructurada de la documentación necesaria para entender y construir el "Chasis de Gestión" (Agenda, POS, Fichas Clínicas) de SacaMedi OS.

---

## 1. Estructura del Contexto (Cómo consumir esta información)

Para entender correctamente el alcance y los requerimientos del proyecto, la documentación debe consumirse en el siguiente orden lógico:

1.  **El Paradigma (El "Por Qué"):** Entender que no estamos construyendo un software tradicional, sino un "Sistema Operativo AI-Native" donde la agenda y el POS son la base de datos que alimenta a los agentes de IA.
2.  **La Arquitectura de Datos (El "Qué"):** Comprender cómo se estructuran las tablas de la base de datos (Supabase) para pacientes, citas, notas clínicas y pagos.
3.  **La Interfaz (El "Cómo"):** Asimilar el concepto de "Software as Content" (widgets inline en el chat) vs. las vistas estructuradas tradicionales (Mundo 2: Gestión y Agenda).
4.  **El MVP (El "Cuándo"):** Conocer qué funcionalidades específicas entran en la Fase 1 (Agenda básica) y cuáles se relegan a la Fase 2 (Fichas y POS completos).

---

## 2. Lista de Documentos Requeridos (Priorizada)

A continuación, se detallan los documentos reales y actuales que contienen la información necesaria, ordenados por prioridad de lectura.

### Prioridad Alta (Lectura Obligatoria Inmediata)

Estos documentos contienen la arquitectura técnica exacta, el esquema de base de datos y la definición funcional más reciente.

| Título del Documento | Fecha | Formato | Ubicación |
| :--- | :--- | :--- | :--- |
| **Pasted Content 3 (Estructura Técnica y DB)** | 04 Abr 2026 | `.txt` | `/home/ubuntu/upload/pasted_content_3.txt` |
| **SacaMedi OS: Arquitectura de Soluciones** | 05 Abr 2026 | `.md` | `/home/ubuntu/SacaMedi_OS_Arquitectura_de_Soluciones.md` |
| **Auditoría del Plan Claude Code** | 04 Abr 2026 | `.md` | `/home/ubuntu/Auditoria_Plan_Claude_Code.md` |

**Resumen de Relevancia:**
*   **Pasted Content 3:** Es el documento técnico más crítico. Contiene el esquema SQL exacto de Supabase para `appointments` (citas), `patients` (pacientes), `clinical_notes` (fichas) y `payments` (POS). Define la estructura de carpetas de Next.js y las *tools* que el Agente Maestro usará para interactuar con la agenda.
*   **Arquitectura de Soluciones:** Define funcionalmente el "Mundo 2" (Gestión y Agenda). Explica cómo el Smart Calendar, el Patient EMR y el POS interactúan con los subagentes (Aura, Lumina, Atlas).
*   **Auditoría Plan Claude Code:** Confirma la validación técnica del esquema de base de datos y la decisión de usar un "Flat Tool List" y "Software as Content" (widgets) para renderizar la agenda en el chat.

### Prioridad Media (Contexto Estratégico y Flujos)

Estos documentos explican cómo el usuario interactúa con la agenda y el POS, y por qué se diseñaron de esta manera.

| Título del Documento | Fecha | Formato | Ubicación |
| :--- | :--- | :--- | :--- |
| **Arquitectura SacaMedi OS Conversacional** | 04 Abr 2026 | `.md` | `/home/ubuntu/Arquitectura_SacaMedi_OS_Conversacional.md` |
| **Arquitectura Definitiva SacaMedi OS** | 04 Abr 2026 | `.md` | `/home/ubuntu/Arquitectura_Definitiva_SacaMedi_OS.md` |
| **Master Document SacaMedi OS** | 04 Abr 2026 | `.md` | `/home/ubuntu/Master_Document_SacaMedi_OS.md` |

**Resumen de Relevancia:**
*   **Arquitectura Conversacional:** Explica el paradigma "Chat-First". Detalla cómo un usuario pide ver la agenda en el chat y cómo el sistema responde con un widget, en lugar de obligar al usuario a navegar por menús.
*   **Arquitectura Definitiva:** Establece que la agenda y el POS son el "Chasis" necesario para que la IA no sea ciega. Define las fases de construcción (MVP vs. Fase 2).
*   **Master Document:** Proporciona el contexto de negocio. Explica los dolores actuales de las clínicas con sistemas legacy (AgendaPro) y cómo SacaMedi OS resuelve la fragmentación de datos.

### Prioridad Baja (Referencia Histórica y MVP Inicial)

Estos documentos muestran la evolución del concepto, útiles para entender decisiones descartadas.

| Título del Documento | Fecha | Formato | Ubicación |
| :--- | :--- | :--- | :--- |
| **Blueprint MVP SacaMedi OS Realidad** | 04 Abr 2026 | `.md` | `/home/ubuntu/Blueprint_MVP_SacaMedi_OS_Realidad.md` |
| **Definición Producto SacaMedi OS** | 04 Abr 2026 | `.md` | `/home/ubuntu/Definicion_Producto_SacaMedi_OS.md` |

**Resumen de Relevancia:**
*   **Blueprint MVP Realidad:** Muestra una versión anterior del MVP que dependía de conectar GoHighLevel con AgendaPro vía Make.com. *Nota de Resolución de Conflicto: Este enfoque fue superado por la decisión de construir el "Chasis" propio (Supabase) detallado en `pasted_content_3.txt`.*
*   **Definición Producto:** Justifica la decisión de construir un sistema "All-in-One" en lugar de solo una capa de marketing.

---

## 3. Lagunas Identificadas (Gaps)

Al revisar la documentación actual, se identifican las siguientes áreas que carecen de definición detallada y requerirán clarificación durante el desarrollo:

1.  **Lógica de Conflictos de Agenda:** No hay documentación específica sobre cómo el sistema maneja reservas simultáneas, tiempos de buffer entre citas, o reglas de disponibilidad complejas (ej. un doctor trabaja en dos clínicas diferentes).
2.  **Estructura Detallada del POS:** El esquema SQL (`payments`) es muy básico. Falta definir cómo se manejan los impuestos, descuentos, pagos parciales, y la integración con pasarelas de pago locales (ej. MercadoPago, Stripe).
3.  **Plantillas de Fichas Clínicas:** Se menciona "SOAP notes" y "consentimientos informados", pero no hay diseños ni estructuras de datos específicas para los diferentes tipos de tratamientos estéticos (ej. toxina botulínica vs. láser).

---
*Documento compilado por Manus AI.*
