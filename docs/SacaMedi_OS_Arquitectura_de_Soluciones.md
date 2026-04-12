# SacaMedi OS: Arquitectura Definitiva de Soluciones

**Documento de Producto y Arquitectura Agéntica**
**Para:** Damaso Alvarado, CEO y Fundador
**Fecha:** Abril 2026
**Versión:** 1.0
**Clasificación:** Documento Interno Estratégico

---

## Propósito de Este Documento

Este documento define con precisión absoluta **qué hace SacaMedi OS, cómo lo hace, y qué resuelve cada componente**. No es un documento de marketing ni un pitch deck. Es la fuente de verdad técnica y funcional que debe guiar al equipo de producto, al equipo de desarrollo, al equipo de ventas y a cualquier agencia partner que necesite entender la plataforma a fondo.

Todo lo descrito aquí está fundamentado exclusivamente en la arquitectura, las decisiones de producto y los análisis estratégicos que hemos desarrollado a lo largo de esta conversación. Nada es inventado ni especulativo.

---

## Parte I: La Premisa Fundacional

### 1.1 El Paradigma: De Software a Operator

SacaMedi OS no es software en el sentido tradicional. El software tradicional (AgendaPro, Reservo, Flowww) le da herramientas al usuario para que haga el trabajo. SacaMedi OS le da **un equipo digital que hace el trabajo por él**.

Esta distinción no es semántica; es arquitectónica. En el modelo tradicional, el dueño de la clínica abre AgendaPro, busca pacientes inactivos, exporta un Excel, lo sube a GoHighLevel, redacta un mensaje, configura la automatización y lanza la campaña. Son 7 pasos manuales que requieren conocimiento técnico y entre 2 y 4 horas de trabajo.

En SacaMedi OS, el dueño abre el chat y escribe: *"Tengo huecos en la agenda del jueves. Ayúdame a llenarlos."* El sistema hace el resto. No porque sea un chatbot más inteligente, sino porque tiene acceso directo a los datos operativos de la clínica (agenda, fichas clínicas, historial de pacientes, datos de marketing) y puede tomar acciones reales sobre esos datos (enviar WhatsApps, agendar citas, lanzar campañas, generar reportes).

### 1.2 La Arquitectura de "Chat Agéntico Centralizado"

La interfaz principal de SacaMedi OS es un **chat centralizado** que funciona como el punto de entrada único para toda la operación de la clínica. Este chat no es decorativo ni es un buscador glorificado. Es un **Agente Maestro** (orquestador) que entiende la intención del usuario, tiene acceso al contexto completo de la clínica, y despliega subagentes especializados para ejecutar tareas concretas.

El Agente Maestro funciona con lo que técnicamente se llama una **"Flat Tool List"**: un único modelo de lenguaje (GPT-4o vía Vercel AI SDK) que tiene acceso simultáneo a todas las herramientas (tools) de todos los subagentes en una sola llamada. No hay un sistema complejo donde múltiples agentes se pasan mensajes entre sí (eso sería lento, caro y propenso a errores). En su lugar, hay un solo cerebro con muchos brazos.

Cuando el usuario escribe algo en el chat, el Agente Maestro hace tres cosas en secuencia:

**Paso 1: Comprensión de intención.** Analiza qué quiere el usuario. ¿Quiere ver datos? ¿Quiere ejecutar una acción? ¿Quiere un reporte?

**Paso 2: Selección de herramientas.** Identifica cuáles de las herramientas disponibles (que pertenecen a los distintos subagentes) necesita invocar para cumplir la petición.

**Paso 3: Ejecución y presentación.** Ejecuta las herramientas, obtiene los resultados y los presenta al usuario en el chat, ya sea como texto, como widgets interactivos (tablas, calendarios, gráficos) o como botones de acción ("Aprobar", "Enviar", "Modificar").

Este paradigma se llama **"Software as Content"** (SaC): en lugar de que el usuario navegue por menús y pantallas, la interfaz se genera dinámicamente dentro del flujo de la conversación. Si el usuario pregunta por la agenda del jueves, ve un mini-calendario interactivo dentro del chat. Si pregunta por las ventas del mes, ve un gráfico de barras. Si pide lanzar una campaña, ve una vista previa del mensaje con un botón de "Aprobar".

### 1.3 Los Tres "Mundos" (Espacios de Trabajo)

Aunque el chat es la interfaz principal, hay momentos donde la información necesita visualizarse de forma estructurada. SacaMedi OS se organiza en tres espacios de trabajo accesibles mediante un switch rápido:

| Mundo | Nombre | Función | Quién lo Usa |
| :--- | :--- | :--- | :--- |
| **1** | El Chat Central (El Cerebro) | Interfaz conversacional donde el usuario da órdenes, hace consultas y recibe widgets dinámicos | El dueño de la clínica, el administrador |
| **2** | Gestión y Agenda (La Operación) | Vista estructurada del día a día: Smart Calendar, lista de pacientes, fichas clínicas (EMR), punto de venta (POS) | El doctor, la recepcionista, el equipo clínico |
| **3** | Marketing y Crecimiento (El Motor) | Centro de control de adquisición y retención: Pipeline, ROI de campañas, creador de campañas, inbox unificado (WhatsApp/IG) donde los agentes de IA chatean con leads en tiempo real | El dueño, el equipo de marketing, la agencia |

El Mundo 3 es donde vive **AppSales** (el Revenue Tracker) como módulo nativo. AppSales es la interfaz visual de tarjetas donde la clínica registra qué pasó con cada paciente que vino del marketing: si asistió, si compró, cuánto pagó, quién le vendió, y si no compró, por qué no compró. Este módulo es el puente entre el marketing digital y el dinero en caja, y es la fuente de datos que alimenta la inteligencia de todo el sistema.

### 1.4 El "Autonomy Slider" (Control de Confianza)

Las clínicas no van a confiar ciegamente en la IA desde el primer día. SacaMedi OS incluye un control de autonomía configurable para cada subagente, almacenado en una tabla `agent_settings` en la base de datos:

**Nivel 1 — Copiloto.** El agente sugiere la acción y el humano aprueba antes de que se ejecute. Ejemplo: el agente redacta una campaña de reactivación, el dueño revisa el mensaje y hace clic en "Enviar".

**Nivel 2 — Autonomía Supervisada.** El agente ejecuta la acción automáticamente y notifica al humano después. Ejemplo: el agente agenda una cita que un paciente solicitó por WhatsApp a las 11 PM y envía un resumen al dueño al día siguiente.

**Nivel 3 — Autonomía Total.** El agente opera de forma independiente en background sin notificación inmediata. Ejemplo: el agente calcula comisiones de doctores y envía los reportes a contabilidad automáticamente cada quincena.

El slider permite que la clínica comience en Nivel 1 (máxima supervisión) y suba gradualmente a medida que gana confianza.

---

## Parte II: Los Subagentes — Arquitectura Detallada

### 2.1 AURA — AI Front Desk (Recepcionista Omnicanal 24/7)

**Rol en una frase:** Aura es la recepcionista que nunca duerme, nunca se enferma y nunca pierde un lead.

**El problema que resuelve:** El 40% de las consultas de pacientes llegan fuera del horario laboral (noches y fines de semana). La recepcionista humana no puede responder a las 11 PM. Cuando responde al día siguiente, el lead ya agendó en otra clínica. Además, cuando la recepcionista sí está disponible, tarda un promedio de 2 a 8 horas en responder a los leads de marketing, no tiene un script estandarizado, no sabe cualificar y no hace seguimiento sistemático. El resultado: el 60-70% de los leads captados por Meta Ads nunca llegan a agendar una cita.

**Qué hace Aura (acciones concretas):**

Aura opera en los canales donde los pacientes realmente se comunican en LATAM: WhatsApp e Instagram DM (vía la API de GoHighLevel). Cuando un mensaje llega a cualquiera de estos canales, Aura ejecuta el siguiente flujo:

**Identificación del paciente.** Aura consulta la base de datos centralizada de SacaMedi OS para determinar si el contacto es un paciente nuevo o uno recurrente. Si es recurrente, Aura tiene acceso a su historial completo: qué tratamientos se ha hecho, cuándo fue su última visita, cuánto ha gastado históricamente y qué tiene agendado a futuro. Esta capacidad es imposible para chatbots externos como Vambe o Closebot, que no tienen acceso a las fichas clínicas.

**Respuesta contextualizada.** Aura responde en menos de 60 segundos, en el tono de voz configurado para la clínica, con conocimiento del catálogo de tratamientos, precios y disponibilidad real de los doctores. Si un paciente recurrente escribe preguntando por Botox, Aura sabe que su último tratamiento fue hace 5 meses y puede responder: *"Hola María, qué gusto saludarte. Veo que tu última aplicación de toxina fue en noviembre. Ya es momento del retoque. La Dra. Valentina tiene disponibilidad este jueves a las 4 PM o viernes a las 10 AM. ¿Cuál te funciona mejor?"*

**Cualificación de leads nuevos.** Para pacientes nuevos que llegan de campañas de Meta Ads, Aura ejecuta un flujo de cualificación que incluye: confirmar el tratamiento de interés, evaluar si el paciente es candidato (preguntas básicas de contraindicaciones), manejar objeciones de precio (con scripts configurados por la clínica) y, si la clínica cobra consulta, gestionar el cobro antes de agendar.

**Agendamiento directo.** Aura tiene acceso de lectura y escritura al Smart Calendar de SacaMedi OS. Puede ver la disponibilidad real de cada doctor, por sala y por equipo, y agendar la cita directamente sin intervención humana. No envía al paciente a un link externo de agendamiento; la cita se confirma dentro de la misma conversación de WhatsApp.

**Recordatorios y confirmaciones.** Aura envía recordatorios automáticos antes de la cita (24 horas y 2 horas antes) y gestiona las confirmaciones. Si el paciente cancela, Aura intenta reprogramar inmediatamente ofreciendo horarios alternativos. Si el paciente no responde a los recordatorios, la tarjeta en AppSales se marca como "En riesgo" para que el equipo humano intervenga si es necesario.

**Reprogramación de cancelaciones.** Cuando un paciente cancela, Aura no solo intenta reprogramar con ese paciente; también consulta la lista de espera inteligente del Smart Calendar para ofrecer el hueco liberado a otro paciente que estaba esperando disponibilidad.

**Herramientas (Tools) a las que tiene acceso:**

| Herramienta | Acción | Base de Datos que Consulta |
| :--- | :--- | :--- |
| API de WhatsApp (vía GHL) | Enviar y recibir mensajes | N/A (canal de comunicación) |
| API de Instagram DM (vía GHL) | Enviar y recibir mensajes | N/A (canal de comunicación) |
| Smart Calendar (lectura/escritura) | Ver disponibilidad, crear citas, modificar citas, cancelar citas | Tabla de citas, tabla de doctores, tabla de salas |
| Base de datos de pacientes (lectura) | Buscar paciente por teléfono/nombre, leer historial de tratamientos, leer historial de gasto | Tabla de pacientes, tabla de tratamientos, tabla de pagos |
| Catálogo de tratamientos (lectura) | Consultar precios, descripciones, duraciones, contraindicaciones | Tabla de productos/servicios |
| Lista de espera (lectura/escritura) | Consultar pacientes en espera, ofrecer huecos liberados | Tabla de lista de espera |

**Métricas que genera Aura:**

| Métrica | Descripción | Benchmark Objetivo |
| :--- | :--- | :--- |
| Tiempo de primera respuesta | Segundos desde que llega el mensaje hasta que Aura responde | < 60 segundos |
| Tasa de agendamiento | % de leads que agendan cita del total de conversaciones | 25-40% |
| Tasa de asistencia | % de pacientes agendados que efectivamente asisten | > 80% |
| Conversaciones manejadas/mes | Volumen total de conversaciones gestionadas por Aura | Ilimitado (24/7) |
| Tasa de escalamiento humano | % de conversaciones que Aura no puede resolver y escala a un humano | < 15% |

---

### 2.2 NOVA — AI Growth Agent (Directora de Crecimiento y Retención)

**Rol en una frase:** Nova es la directora de marketing que encuentra dinero escondido en tu base de datos y lo convierte en citas agendadas.

**El problema que resuelve:** La clínica promedio en LATAM tiene entre 2,000 y 10,000 pacientes en su sistema de gestión que no han vuelto en más de 6 meses. Nadie los contacta porque el proceso es completamente manual: hay que exportar un Excel de AgendaPro, filtrar por fecha de última visita, subirlo a GoHighLevel, redactar un mensaje, configurar la automatización y lanzar la campaña. Son horas de trabajo técnico que el dueño de la clínica no tiene. El resultado: entre $10,000 y $50,000 al mes en ingresos potenciales que se quedan sobre la mesa.

Además, las campañas de Meta Ads que la clínica o su agencia ejecutan generan leads, pero no hay un sistema inteligente que optimice el gasto basándose en qué tipo de paciente realmente compra. El gasto en publicidad y los ingresos reales viven en sistemas separados, haciendo imposible calcular el ROI real.

**Qué hace Nova (acciones concretas):**

**Identificación de pacientes inactivos por tratamiento y fecha.** Nova tiene acceso a la base de datos completa de pacientes de SacaMedi OS. Puede filtrar automáticamente pacientes que no han tenido una cita en X meses, segmentados por tipo de tratamiento. Por ejemplo: "Pacientes que se aplicaron toxina botulínica hace más de 4 meses y no tienen cita futura agendada". Esta segmentación es inteligente porque se basa en los ciclos reales de cada tratamiento (toxina cada 4-6 meses, ácido hialurónico cada 12-18 meses, limpieza facial cada 1-2 meses).

**Redacción de mensajes personalizados.** Nova no envía mensajes genéricos de "Te extrañamos". Redacta copys personalizados basados en el historial del paciente. Ejemplo: *"Hola María, ya pasaron 5 meses desde tu última aplicación de Botox con la Dra. Valentina. Es el momento ideal para tu retoque. Esta semana tenemos disponibilidad el jueves y viernes. ¿Te agendo?"* El mensaje incluye el nombre del paciente, el tratamiento específico, el doctor que lo atendió y la temporalidad exacta.

**Lanzamiento de campañas de reactivación escalonadas.** Nova no envía todos los mensajes al mismo tiempo (eso saturaría a la clínica con citas). Lanza las campañas de forma escalonada: primero 20 mensajes, luego 30, luego 50, ajustando el volumen según la capacidad de la agenda. Los mensajes se envían por WhatsApp a través de la API de GoHighLevel.

**Optimización de presupuesto publicitario basada en ROAS real.** Cuando AppSales registra que un paciente que vino de una campaña de Meta Ads compró un tratamiento de $1,500, Nova puede cruzar ese dato con el costo de adquisición del lead. Si la campaña A generó pacientes que compraron $15,000 en total con un gasto de $1,000, y la campaña B generó pacientes que compraron $3,000 con un gasto de $1,000, Nova sabe que debe redirigir presupuesto de B hacia A. Esta capacidad de cruzar gasto en Ads con ingresos reales en POS es posible únicamente porque ambos datos viven en el mismo sistema.

**Dashboard de ROI en tiempo real.** Nova alimenta un dashboard donde el dueño de la clínica puede ver, por primera vez en un solo lugar: cuánto gastó en publicidad, cuántos leads generó, cuántos agendaron, cuántos asistieron, cuántos compraron y cuánto revenue generaron. El cálculo de Costo por Lead (benchmark ideal: < $5), Costo por Booking (benchmark ideal: $10-$15, máximo tolerable: $35-$40) y ROAS se actualiza automáticamente.

**Herramientas (Tools) a las que tiene acceso:**

| Herramienta | Acción | Base de Datos que Consulta |
| :--- | :--- | :--- |
| Base de datos de pacientes (lectura) | Filtrar pacientes inactivos por tratamiento, fecha, doctor, gasto | Tabla de pacientes, tabla de tratamientos |
| API de GHL (campañas) | Crear y enviar campañas de WhatsApp escalonadas | N/A (canal de ejecución) |
| Meta Ads API (lectura) | Leer métricas de campañas: gasto, impresiones, clics, leads | Datos de Meta Ads |
| AppSales / Revenue Tracker (lectura) | Leer datos de conversión: quién compró, cuánto, qué tratamiento | Tabla de conversiones de AppSales |
| Smart Calendar (lectura) | Verificar capacidad de agenda antes de lanzar campaña | Tabla de citas |
| Generador de copy (IA) | Redactar mensajes personalizados basados en datos del paciente | Contexto del paciente + catálogo de tratamientos |

**Métricas que genera Nova:**

| Métrica | Descripción | Benchmark Objetivo |
| :--- | :--- | :--- |
| Pacientes reactivados/mes | Pacientes inactivos que reagendaron gracias a campañas de Nova | 50-150/mes |
| Revenue por reactivación | Ingresos generados por pacientes reactivados | $5,000-$15,000/mes |
| Costo por Lead (CPL) | Costo de adquirir un lead de marketing | < $5 |
| Costo por Booking (CPB) | Costo de lograr un agendamiento | $10-$15 ideal, < $40 tolerable |
| ROAS (Return on Ad Spend) | Revenue generado / Gasto en publicidad | > 5x |

---

### 2.3 LUMINA — AI Clinical Agent (Asistente Médica)

**Rol en una frase:** Lumina es la asistente médica que analiza piel con IA, pre-llena fichas clínicas y convierte seguidores de Instagram en pacientes.

**El problema que resuelve:** Las clínicas estéticas en LATAM luchan con dos problemas clínicos que tienen impacto directo en el revenue. El primero es la adquisición viral: el costo por lead en Meta Ads sigue subiendo y las clínicas necesitan mecanismos de adquisición orgánica que no dependan exclusivamente de publicidad pagada. El segundo es la carga administrativa: los doctores pierden entre 15 y 30 minutos por paciente llenando fichas clínicas, notas de evolución y consentimientos informados, tiempo que podrían dedicar a atender más pacientes.

**Qué hace Lumina (acciones concretas):**

**AI Skin Analysis (Lead Magnet Viral).** Lumina ofrece un análisis de piel con inteligencia artificial que funciona como el lead magnet más poderoso del sector estético. El flujo es el siguiente: la clínica coloca un link en su bio de Instagram o en sus stories. El seguidor hace clic y sube una selfie. Lumina analiza la imagen usando OpenAI Vision (GPT-4o) y genera un reporte personalizado en PDF con el logo de la clínica que incluye: evaluación de textura, manchas, arrugas, poros y tono de piel, junto con recomendaciones de tratamientos específicos del catálogo de la clínica. El reporte se envía automáticamente por WhatsApp junto con una invitación para agendar una consulta de valoración. El paciente potencial recibe valor inmediato (un análisis profesional gratuito) y la clínica captura su número de WhatsApp y su interés específico sin gastar un centavo en publicidad.

**Pre-llenado de fichas clínicas.** Antes de que el paciente entre al consultorio, Lumina puede pre-llenar la ficha clínica con la información que ya existe en el sistema: datos personales, historial de tratamientos previos, alergias registradas, fotos antes/después de sesiones anteriores. El doctor entra al consultorio y la ficha ya tiene el 70% de la información lista.

**Transcripción de notas de voz a texto estructurado.** Después de la consulta, el doctor puede grabar una nota de voz describiendo el tratamiento realizado, las observaciones clínicas y las recomendaciones de seguimiento. Lumina transcribe la nota de voz y la estructura en el formato de la ficha clínica del EMR (Electronic Medical Record) de SacaMedi OS, incluyendo campos como: tratamiento realizado, zona tratada, productos utilizados, dosis, observaciones y próxima cita recomendada.

**Generación de consentimientos informados.** Lumina puede generar consentimientos informados personalizados para cada tratamiento, con los datos del paciente pre-llenados, listos para firma digital dentro de la plataforma.

**Herramientas (Tools) a las que tiene acceso:**

| Herramienta | Acción | Base de Datos que Consulta |
| :--- | :--- | :--- |
| OpenAI Vision (GPT-4o) | Analizar imágenes de piel, generar diagnóstico visual | N/A (modelo de IA externo) |
| Generador de PDF | Crear reportes de Skin Analysis con logo de la clínica | Configuración de branding de la clínica |
| EMR / Fichas Clínicas (lectura/escritura) | Pre-llenar fichas, escribir notas clínicas, adjuntar fotos | Tabla de pacientes, tabla de historial clínico |
| Transcripción de voz a texto | Convertir notas de voz del doctor en texto estructurado | N/A (procesamiento de audio) |
| API de WhatsApp (vía GHL) | Enviar reportes de Skin Analysis al paciente | N/A (canal de comunicación) |
| Catálogo de tratamientos (lectura) | Recomendar tratamientos específicos basados en el análisis | Tabla de productos/servicios |

**Métricas que genera Lumina:**

| Métrica | Descripción | Benchmark Objetivo |
| :--- | :--- | :--- |
| Análisis de piel realizados/mes | Volumen de Skin Analysis completados | 100-500/mes |
| Tasa de conversión de Skin Analysis a cita | % de personas que agendan después del análisis | 15-30% |
| Tiempo ahorrado por ficha pre-llenada | Minutos que el doctor ahorra por consulta | 10-20 min/paciente |
| Costo por lead orgánico | Costo de adquirir un lead vía Skin Analysis (vs. Meta Ads) | ~$0 (orgánico) |

---

### 2.4 ATLAS — AI Financial Agent (Analista Financiero)

**Rol en una frase:** Atlas es el CFO digital que te dice exactamente cuánto dinero entra, cuánto sale, quién lo genera y dónde se está perdiendo.

**El problema que resuelve:** El dueño de la clínica estética promedio no tiene visibilidad financiera en tiempo real. Los ingresos se registran en el POS (o peor, en un cuaderno), las comisiones de los doctores se calculan manualmente en Excel al final del mes, el flujo de caja es una adivinanza y las decisiones de inversión en marketing se toman a ciegas porque no hay forma de cruzar el gasto en publicidad con los ingresos reales por paciente.

**Qué hace Atlas (acciones concretas):**

**Conciliación de pagos diarios.** Atlas cruza automáticamente los pagos registrados en el POS de SacaMedi OS con los datos de las pasarelas de pago (transferencias, tarjetas, efectivo) para generar un cierre de caja diario sin intervención manual. El dueño recibe un resumen al final de cada día con: total cobrado, desglose por método de pago, pagos pendientes y discrepancias detectadas.

**Cálculo automático de comisiones por doctor.** En las clínicas estéticas, los doctores suelen cobrar un porcentaje del tratamiento que realizan (típicamente entre 30% y 50%). Atlas calcula estas comisiones automáticamente basándose en los tratamientos registrados en el EMR y los pagos confirmados en el POS. Genera un reporte de comisiones por doctor, por período, listo para enviar a contabilidad. Esto incluye la capacidad de asignar depósitos al producto o upsell específico al que están destinados, para que el "Contracted Revenue" (ingresos contratados) se contabilice correctamente.

**Alertas de salud financiera.** Atlas monitorea indicadores clave del negocio y envía alertas proactivas cuando detecta anomalías. Ejemplos: "El ticket promedio bajó un 20% esta semana comparado con el mes anterior", "El doctor Andrés tiene una tasa de cierre 35% menor que la Dra. Valentina en el mismo tratamiento", "Los ingresos del martes cayeron un 40% respecto al martes anterior".

**Proyecciones de ingresos.** Basándose en las citas agendadas a futuro (del Smart Calendar), los precios de los tratamientos (del catálogo) y las tasas históricas de asistencia y cierre (de AppSales), Atlas puede proyectar los ingresos esperados para la semana o el mes siguiente. Esto le permite al dueño tomar decisiones informadas sobre inversión en marketing, contratación de personal o compra de insumos.

**Reportes de flujo de caja.** Atlas genera reportes periódicos que muestran: ingresos totales, costos operativos conocidos (insumos, comisiones, software), margen bruto estimado y tendencias mensuales. Estos reportes se pueden generar por período (semanal, mensual) y por tratamiento específico.

**Herramientas (Tools) a las que tiene acceso:**

| Herramienta | Acción | Base de Datos que Consulta |
| :--- | :--- | :--- |
| POS (lectura) | Leer pagos registrados, métodos de pago, montos | Tabla de pagos, tabla de transacciones |
| Módulo de comisiones (lectura/escritura) | Calcular y registrar comisiones por doctor | Tabla de doctores, tabla de tratamientos realizados, tabla de pagos |
| Smart Calendar (lectura) | Leer citas futuras para proyecciones | Tabla de citas |
| AppSales / Revenue Tracker (lectura) | Leer tasas de asistencia, cierre y upsell históricas | Tabla de conversiones |
| Catálogo de tratamientos (lectura) | Consultar precios para cálculos de revenue | Tabla de productos/servicios |
| Generador de reportes (escritura) | Crear reportes PDF de comisiones, flujo de caja, proyecciones | N/A (generación de documentos) |

**Métricas que genera Atlas:**

| Métrica | Descripción |
| :--- | :--- |
| Revenue diario/semanal/mensual | Ingresos totales por período |
| Ticket promedio | Ingreso promedio por paciente atendido |
| Comisiones por doctor | Monto de comisiones calculadas por profesional |
| Tasa de cierre por closer | % de pacientes que compran, segmentado por quién los atendió |
| Contracted Revenue | Ingresos contratados (incluyendo depósitos) pendientes de cobro |
| Proyección de ingresos | Estimación de ingresos futuros basada en agenda y tasas históricas |

---

### 2.5 AppSales — Revenue Tracker (Módulo de Interfaz Humana)

**Rol en una frase:** AppSales es el puente entre el marketing digital y el dinero en caja, donde el equipo humano de la clínica registra el resultado final de cada paciente.

**El problema que resuelve:** En el ecosistema de marketing médico existe un "agujero negro" de datos. Meta y Google saben cuánto costó el clic. El CRM de marketing sabe cuántos leads entraron. La cuenta bancaria sabe cuánto dinero llegó. Pero nadie sabe qué pasó en el medio: ¿el paciente asistió? ¿Le vendieron? ¿Cuánto pagó? ¿Quién le vendió? ¿Si no compró, por qué no compró? Las clínicas intentan resolver esto con Excel, pero el Excel se abandona en 2 semanas porque es tedioso de llenar.

**Qué hace AppSales (funcionalidades concretas):**

**Sistema de tarjetas visuales.** Cada paciente que llega del marketing aparece automáticamente como una tarjeta en AppSales (alimentada por Aura cuando agenda la cita). La tarjeta muestra: nombre del paciente, teléfono, monto de la consulta, estado (Pendiente, Programada, Completado) y responsable asignado. El equipo de la clínica solo tiene que mover tarjetas y hacer clic en botones, en lugar de llenar celdas de Excel.

**Registro de resultado de la cita.** Cuando el paciente asiste, el closer o el doctor marca la tarjeta como "Cita" (asistió) o "No Asistió". Si asistió y compró, registra el tratamiento vendido, el monto y si hubo upsell (tratamiento adicional). Si no compró, el sistema obliga a registrar la razón de pérdida (objeción de precio, solo estaba mirando, no calificaba médicamente, se fue a la competencia).

**Asignación de responsables.** Cada tarjeta puede asignarse a un closer o asesor comercial específico. Esto permite saber exactamente quién vendió y quién no vendió, generando datos individuales de performance por vendedor.

**Analytics de ventas.** AppSales genera automáticamente las métricas de salud del negocio: Tasa de Asistencia (% de agendados que asisten), Tasa de Upsell (% de pacientes que compran un tratamiento adicional), Revenue total por período, y performance individual por closer.

**Vista de Agencia (Multi-Clínica).** Para el modelo de agencia o de partners, AppSales incluye una vista donde se pueden ver todas las clínicas en una sola tabla con sus métricas principales: Pacientes (30d), Tasa de Asistencia, Tasa de Upsell, Revenue (30d). Esto permite a la agencia (o al equipo interno de SacaMedi) monitorear la salud de todas las clínicas desde un solo dashboard y detectar problemas antes de que el cliente cancele.

**Conexión con los agentes de IA.** AppSales no es un módulo aislado. Es la fuente de datos que alimenta a los demás agentes:

| Dato de AppSales | Agente que lo Consume | Para Qué lo Usa |
| :--- | :--- | :--- |
| Razón de pérdida ("Muy caro") | Nova | Ajustar el copy de los anuncios para pre-cualificar mejor el presupuesto |
| Tasa de cierre por closer | Atlas | Calcular comisiones y detectar closers de bajo rendimiento |
| Revenue por campaña | Nova | Calcular ROAS real y redistribuir presupuesto publicitario |
| Pacientes que no compraron | Aura / Agente de Seguimiento | Activar secuencia de reactivación por WhatsApp en 30 días |
| Tasa de asistencia por día/hora | Nova | Identificar los mejores horarios para agendar y optimizar campañas |

---

## Parte III: El Chasis de Gestión (Módulos Operativos)

Los subagentes de IA no operan en el vacío. Necesitan una base de datos centralizada y módulos operativos sobre los cuales ejecutar sus acciones. Estos son los módulos del "chasis" de SacaMedi OS:

### 3.1 Smart Calendar

Gestión de citas multidimensional que permite ver la agenda por Doctor, por Sala y por Equipo. Incluye vista diaria, semanal y mensual, bloqueos de horario, citas recurrentes y una lista de espera inteligente que Aura consulta automáticamente cuando se libera un hueco.

### 3.2 Patient EMR (Electronic Medical Record)

Fichas clínicas digitales con historial completo de tratamientos, galería de fotos antes/después, consentimientos informados con firma digital y notas clínicas estructuradas (con transcripción de voz a texto vía Lumina). Cada ficha está vinculada al perfil del paciente en la base de datos centralizada, lo que permite que todos los agentes tengan contexto clínico completo.

### 3.3 POS y Facturación

Punto de venta integrado que registra todos los pagos (efectivo, tarjeta, transferencia), gestiona membresías y paquetes de tratamientos, permite pagos parciales y depósitos, y alimenta automáticamente a Atlas para el cálculo de comisiones y reportes financieros.

### 3.4 Inventory Management

Control de stock de insumos (jeringas, viales de toxina botulínica, ácido hialurónico, hilos tensores) que se descuentan automáticamente al registrar un tratamiento en el EMR. Genera alertas cuando el stock de un insumo está por debajo del mínimo configurado.

### 3.5 Portal del Paciente (vía WhatsApp)

El paciente no descarga ninguna app. Toda la interacción (agendar, ver sus puntos de lealtad, recibir su análisis de piel, confirmar citas, recibir recordatorios) ocurre dentro de WhatsApp, interactuando con Aura. Esto elimina la fricción de adopción que tienen las apps de pacientes tradicionales.

---

## Parte IV: El Flujo Completo — De Lead a Revenue

Para entender cómo todas las piezas trabajan juntas, este es el flujo completo de un paciente desde que ve un anuncio hasta que genera revenue registrado:

**Paso 1: Adquisición.** Un paciente potencial ve un anuncio de la clínica en Instagram (campaña gestionada por la agencia o por Nova). Hace clic y envía un mensaje por WhatsApp o Instagram DM.

**Paso 2: Atención inmediata (Aura).** Aura responde en menos de 60 segundos. Identifica que es un lead nuevo, le pregunta por el tratamiento de interés, responde sus dudas sobre precios y disponibilidad, maneja objeciones y agenda la cita directamente en el Smart Calendar. Si la clínica cobra consulta, Aura gestiona el cobro.

**Paso 3: Aparición en AppSales.** Al momento de agendar, el paciente aparece automáticamente como una tarjeta en AppSales en la columna "Pendiente", con toda la información capturada por Aura: nombre, teléfono, tratamiento de interés, monto de consulta, fecha de cita.

**Paso 4: Recordatorio (Aura).** 24 horas y 2 horas antes de la cita, Aura envía recordatorios por WhatsApp y gestiona confirmaciones o reprogramaciones.

**Paso 5: Consulta presencial.** El paciente llega a la clínica. El doctor tiene la ficha pre-llenada por Lumina con los datos del paciente. Realiza la consulta y el tratamiento.

**Paso 6: Registro en AppSales (Humano).** El closer o el doctor entra a AppSales y actualiza la tarjeta: marca "Asistió", registra el tratamiento vendido, el monto cobrado, si hubo upsell y quién realizó la venta. Si el paciente no compró, registra la razón de pérdida.

**Paso 7: Procesamiento de datos (Atlas + Nova).** Atlas toma el dato de venta para calcular comisiones, actualizar el revenue y alimentar las proyecciones financieras. Nova toma el dato para calcular el ROAS real de la campaña que generó ese lead y optimizar el presupuesto publicitario.

**Paso 8: Ciclo de retención (Nova).** Cuando pasan X meses desde el tratamiento (según el ciclo del tratamiento específico), Nova identifica al paciente como "inactivo" y lanza automáticamente una campaña de reactivación personalizada por WhatsApp. El ciclo vuelve a comenzar.

---

## Parte V: Lo Que SacaMedi OS Reemplaza

SacaMedi OS no agrega otra herramienta al stack de la clínica. En su visión completa, **reemplaza** el stack completo:

| Herramienta Actual | Costo Mensual Típico | Módulo de SacaMedi OS que lo Reemplaza |
| :--- | :--- | :--- |
| AgendaPro / Reservo | $49-$199/mes | Smart Calendar + EMR + POS |
| GoHighLevel | $97-$297/mes | Nova (campañas) + Aura (inbox) + Pipeline nativo |
| Vambe AI / Closebot | $413-$574/mes | Aura (AI Front Desk) con contexto clínico completo |
| Agencia de Marketing (parcial) | $1,500-$5,000/mes | Nova (AI Marketing Agent) + Dashboard de ROI |
| Recepcionista extra (turno nocturno) | $800-$1,500/mes | Aura (24/7, sin sueldo, sin vacaciones) |
| Excel de seguimiento de ventas | $0 (pero horas de trabajo) | AppSales (Revenue Tracker visual) |

**Ahorro total estimado:** $2,859 a $7,570 al mes en herramientas y personal, reemplazados por una sola suscripción de SacaMedi OS.

---

## Parte VI: El Stack Técnico

| Componente | Tecnología | Justificación |
| :--- | :--- | :--- |
| Front-End | Next.js (App Router) + shadcn/ui + Zustand | Estándar para apps de IA con streaming rápido y componentes UI listos |
| Base de Datos | Supabase (PostgreSQL) | Base relacional robusta para conectar pacientes, citas, tratamientos y pagos |
| Orquestación de IA | Vercel AI SDK + OpenAI GPT-4o | "Flat Tool List": un solo LLM call con acceso a todas las herramientas |
| Vision AI | OpenAI Vision (GPT-4o) | Para AI Skin Analysis (Lumina) y lectura de documentos médicos |
| Comunicaciones | GoHighLevel (vía API/Webhooks) | Envío y recepción de WhatsApp/SMS sin reinventar la infraestructura |
| Hosting | Vercel | Deploy automático, edge functions, escalabilidad sin configuración |
| Widget Renderer | Componente `widget-renderer.tsx` | Renderiza tablas, calendarios y tarjetas dentro del chat (paradigma SaC) |
| Autonomy Control | Tabla `agent_settings` en Supabase | Almacena el nivel de autonomía configurado para cada agente por clínica |

---

## Parte VII: Resumen de Arquitectura

SacaMedi OS es un sistema donde **un chat centralizado (Agente Maestro) orquesta cuatro subagentes especializados (Aura, Nova, Lumina, Atlas) que operan sobre una base de datos unificada (chasis de gestión), con AppSales como la interfaz donde el equipo humano de la clínica completa el ciclo registrando los resultados de venta**.

El sistema es un "Agente con Superpoderes" porque tiene algo que ningún chatbot externo puede tener: **todo el contexto específico de la clínica**. Sabe quién es cada paciente, qué tratamientos se ha hecho, cuándo fue su última visita, cuánto ha gastado, qué tiene agendado, quién es su doctor, cuánto cuesta cada tratamiento, cuál es la disponibilidad real de la agenda y cuánto revenue ha generado cada campaña de marketing. Con ese contexto, cada acción que toma es inteligente, personalizada y medible.

Ningún competidor auditado (de los 19 analizados) ofrece esta combinación. AgendaPro organiza pero no genera. Vambe conversa pero no tiene contexto clínico. GoHighLevel automatiza pero no entiende de salud. Tepali tiene la visión pero no tiene WhatsApp ni LATAM. SacaMedi OS es la única plataforma que integra gestión clínica completa, IA conversacional nativa en WhatsApp, IA especializada en estética, agentes autónomos de marketing y finanzas, atribución de revenue de ciclo completo (AppSales) y foco en Latinoamérica.

---

*Documento preparado por Manus AI para Damaso Alvarado, CEO de SacaMedi. Abril 2026.*
