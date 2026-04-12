# Arquitectura Definitiva: SacaMedi OS (AI-First Operating System)

Este documento define la arquitectura final de SacaMedi OS, diseñada bajo un paradigma radicalmente nuevo: **No es un software con IA agregada; es una IA que tiene un software por debajo.**

La interfaz principal no es un menú lleno de botones complejos. Es un **chat central** (el Agente Maestro) que entiende lenguaje natural y orquesta a los subagentes para ejecutar tareas en los distintos "mundos" de la clínica.

---

## 1. La Interfaz: El Paradigma "Chat-First"

Imagina la pantalla principal de SacaMedi OS. No se parece a AgendaPro ni a Salesforce. Se parece a ChatGPT o a Claude, pero conectado a los datos de la clínica.

### El Agente Maestro (El "Director de Orquesta")
Cuando el dueño de la clínica o el doctor entra a la plataforma, lo primero que ve es una barra de chat. Este es el Agente Maestro. Su único trabajo es entender la intención del usuario y delegar la tarea al subagente correcto.

**Ejemplos de interacción:**
*   **Usuario:** *"Lléname la agenda del martes en la tarde con pacientes de Botox."*
    *   **Agente Maestro:** Entiende que es una tarea de marketing. Llama al subagente **Nova (Marketing)**. Nova busca en la base de datos a pacientes que se aplicaron Botox hace 5 meses, redacta la campaña, y le muestra al usuario: *"Encontré 45 pacientes ideales. Aquí está el mensaje propuesto. ¿Lo envío?"*
*   **Usuario:** *"¿Cuánto vendimos ayer y quién fue el mejor doctor?"*
    *   **Agente Maestro:** Entiende que es una consulta financiera. Llama al subagente **Atlas (Finanzas)**. Atlas consulta el POS y responde con un gráfico simple en el chat.
*   **Usuario:** *"Muéstrame la ficha de María López."*
    *   **Agente Maestro:** Llama al subagente **Lumina (Clínico)**. Lumina abre el "Mundo de Gestión" y despliega la ficha clínica de María en la pantalla.

---

## 2. Los Tres "Mundos" (Espacios de Trabajo)

Aunque la interacción principal es por chat, la información debe visualizarse de forma estructurada. SacaMedi OS se divide en tres "Mundos" claros, accesibles mediante un switch rápido (como pestañas) en la interfaz:

### Mundo 1: El Chat Central (El Cerebro)
*   **Qué es:** La interfaz conversacional principal.
*   **Qué ves:** El historial de chat con el Agente Maestro, widgets dinámicos que aparecen según lo que pidas (ej. un gráfico de ventas, una vista previa de una campaña).
*   **Para qué sirve:** Dar órdenes, hacer consultas complejas, pedir resúmenes.

### Mundo 2: Gestión y Agenda (La Operación)
*   **Qué es:** La vista estructurada del día a día.
*   **Qué ves:** El Smart Calendar (vista diaria/semanal), la lista de pacientes en sala de espera, acceso rápido a las fichas clínicas (EMR) y el POS para cobrar.
*   **Para qué sirve:** Cuando el doctor necesita ver su día de un vistazo, o cuando la recepcionista humana (si la hay) necesita cobrar un tratamiento.

### Mundo 3: Marketing y Crecimiento (El Motor)
*   **Qué es:** El centro de control de adquisición y retención.
*   **Qué ves:** El embudo de ventas (Pipeline), el ROI de las campañas de Meta Ads, el creador de campañas de reactivación, y el inbox unificado (WhatsApp/IG) donde el **AI Front Desk (Aura)** está chateando con los leads en tiempo real.
*   **Para qué sirve:** Monitorear el crecimiento, lanzar campañas, auditar las conversaciones de la IA con los pacientes.

---

## 3. El Ecosistema de Subagentes (El "Staff Digital")

El Agente Maestro no hace el trabajo; lo delega a especialistas. Cada subagente tiene acceso a una parte específica de la base de datos.

| Subagente | Dominio | Tareas que ejecuta |
| :--- | :--- | :--- |
| **Aura** (Front Desk) | Inbox, WhatsApp, Agenda | Responde a leads 24/7, califica, agenda citas, envía recordatorios, maneja cancelaciones. |
| **Nova** (Marketing) | Base de datos, Campañas | Crea audiencias segmentadas (ej. "pacientes inactivos de láser"), redacta copys, lanza campañas de reactivación. |
| **Lumina** (Clínico) | Fichas Clínicas (EMR) | Analiza fotos de piel (AI Skin Analysis), transcribe notas de voz del doctor a texto estructurado en la ficha, sugiere tratamientos. |
| **Atlas** (Finanzas) | POS, Facturación | Calcula comisiones, proyecta ingresos del mes, alerta sobre caídas en el ticket promedio. |

---

## 4. La Arquitectura Técnica (Cómo se construye)

Para lograr esta experiencia fluida, la arquitectura técnica debe ser moderna y basada en APIs.

### El Stack Recomendado (Vibe Coding Friendly)
1.  **Front-End (La Interfaz):**
    *   **Herramienta:** Next.js (React) o Vercel v0 (para prototipado rápido impulsado por IA).
    *   **Por qué:** Permite crear una interfaz tipo chat fluida (como ChatGPT) con componentes dinámicos (gráficos, calendarios) que aparecen dentro del chat.
2.  **El Cerebro (Orquestación de Agentes):**
    *   **Herramienta:** LangChain o OpenAI Assistants API.
    *   **Por qué:** Permite crear el "Agente Maestro" que usa *Tool Calling* (llamada a funciones). Cuando el usuario pide "agenda del martes", el LLM sabe que debe ejecutar la función `get_calendar(date="tuesday")`.
3.  **El Back-End (Base de Datos y Lógica):**
    *   **Herramienta:** Supabase (PostgreSQL) o Firebase.
    *   **Por qué:** Necesitas una base de datos relacional robusta para conectar pacientes, citas, tratamientos y pagos. GoHighLevel no sirve como base de datos principal para un EMR complejo.
4.  **Comunicaciones (WhatsApp/SMS):**
    *   **Herramienta:** GoHighLevel (vía API) o Twilio/Meta Cloud API directamente.
    *   **Por qué:** Para manejar el volumen de mensajes de Aura y Nova.

---

## 5. El Flujo de Usuario (Ejemplo Práctico)

**Escenario:** El dueño de la clínica quiere aumentar los ingresos de la semana.

1.  **Paso 1 (Chat):** El dueño abre SacaMedi OS y escribe: *"Tengo huecos en la agenda del jueves. Ayúdame a llenarlos."*
2.  **Paso 2 (Orquestación):** El Agente Maestro analiza la petición. Llama a la API del calendario para confirmar los huecos. Luego llama a **Nova (Marketing)**.
3.  **Paso 3 (Ejecución de Nova):** Nova busca en la base de datos pacientes que suelen venir los jueves y que no tienen citas futuras.
4.  **Paso 4 (Aprobación):** El Agente Maestro responde en el chat: *"Tienes 4 horas libres el jueves. Nova encontró 120 pacientes inactivos de limpieza facial. Aquí tienes una propuesta de mensaje de WhatsApp ofreciendo un 15% de descuento válido solo para este jueves. ¿Procedo a enviarlo?"*
5.  **Paso 5 (Acción):** El dueño hace clic en un botón de "Aprobar" dentro del chat.
6.  **Paso 6 (Cierre):** Nova envía los mensajes. Cuando los pacientes responden, **Aura (Front Desk)** toma el control en WhatsApp, responde dudas y agenda las citas directamente en los huecos del jueves.

## Conclusión

Esta arquitectura transforma a SacaMedi OS de un simple "software de gestión" a un **Socio Operativo**. El cliente no tiene que aprender a usar menús complejos; solo tiene que saber chatear. Es la máxima expresión de la tecnología invisible: el software desaparece y solo queda el resultado.
