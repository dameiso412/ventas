import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";
import { updateCallAudit, createLeadDataEntry } from "../db";
import { sendSlackAlert, crmUrls, crmLink } from "./slack";

let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;

function getOpenAI(): OpenAI | null {
  if (!ENV.openaiApiKey) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: ENV.openaiApiKey });
  return _openai;
}

function getAnthropic(): Anthropic | null {
  if (!ENV.anthropicApiKey) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: ENV.anthropicApiKey });
  return _anthropic;
}

const ANALYSIS_SYSTEM_PROMPT = `Eres un auditor experto de llamadas de INTRODUCCION/TRIAGE para una agencia de marketing de clinicas de medicina estetica. Recibes la transcripcion de una llamada entre un setter y un prospecto (dueno de clinica/spa medico).

CONTEXTO CRITICO: Esta NO es una llamada de cierre. Es una llamada de introduccion/triage con 3 objetivos:
1. Calificar al prospecto (determinar si es buen fit)
2. Crear necesidad/dolor para que tome accion
3. Preparar el terreno y agendar la demo con el closer

El protocolo de la llamada tiene 6 etapas:

ETAPA 1 — MARCO DE LA LLAMADA (~1 min):
- Establecer autoridad y proposito
- Obtener microcompromiso para conversar 5 minutos
- Manejar "no tengo tiempo" o "a que se dedican" sin dar demasiada info
- Confirmar exclusividad por ciudad

ETAPA 2 — IDENTIFICAR EL DOLOR (~2 min):
- Pregunta clave: "Cual es la mayor limitacion en tu negocio que te motivo a agendar esta llamada?"
- No aceptar respuestas superficiales como "quiero mas clientes" — escarbar mas profundo
- Si dicen que todo va bien, usar pattern interrupt: "Si no hay problemas, por que no duplicas lo que estas haciendo?"

ETAPA 3 — ESTADO ACTUAL (~3 min):
- Tratamientos de mayor valor que quieren escalar
- Plan de tratamiento promedio y costo de insumos
- Facturacion mensual promedio (ultimos 3 meses)
- Si eso es normal para ellos
- Ganancia neta de esa facturacion
- Estructura de liderazgo (CEO solo, socios, tomadores de decisiones)

ETAPA 4 — INTENTOS ANTERIORES (~2-3 min):
- Han hecho algo para resolver el problema? (ads, SEO, Groupon, etc.)
- Si SI: como les fue? Si dicen "bien" → "entonces por que no duplicas la inversion?"
- Si NO: "en X anios nunca hicieron marketing? Que cambio ahora?"
- Identificar si el problema fue resultados o relacion con proveedor anterior
- Mantener a alto nivel, no profundizar demasiado

ETAPA 5 — ESTADO DESEADO (~2 min):
- "Si resolvemos [LIMITACION], cual seria tu meta en 6-12 meses?"
- Validar si la meta es realista
- Anclar expectativas

ETAPA 6 — TRANSICION A DEMO:
- Pedir permiso para compartir perspectiva externa
- Conectar dolor → solucion → mecanismo unico
- Agendar demo con closer
- Mencionar video pre-demo para que investiguen
- Doble confirmacion de asistencia
- Si hay socio/partner, confirmar que ambos estaran

Tu trabajo tiene DOS partes obligatorias:

=== PARTE 1: NOTAS DEL PROSPECTO ===
Extrae TODA la informacion que el prospecto revela durante la llamada. Esto es para que el closer tenga toda la info ANTES de la demo sin escuchar la grabacion.

=== PARTE 2: AUDITORIA DE LA LLAMADA DE TRIAGE ===
Evalua al setter contra el protocolo de las 6 etapas. Se directo y sin filtros — que hizo, que no hizo, que etapas se salto, donde fue debil.

Responde EXCLUSIVAMENTE con un objeto JSON valido (sin markdown, sin backticks):

{
  "prospectNotes": {
    "dolores": "<Problemas, frustraciones, lo que NO esta funcionando. Usa las palabras exactas del prospecto cuando sea posible>",
    "objetivos": "<Metas a 6-12 meses, estado deseado, que quiere lograr>",
    "situacionActual": "<Tratamientos que ofrece, como opera, que tiene, que le falta>",
    "situacionFinanciera": "<Facturacion mensual, ganancia neta, plan de tratamiento promedio, costos. Numeros exactos si los dio>",
    "intentosPrevios": "<Que ha intentado antes para resolver el problema? Ads, SEO, agencia previa? Como les fue?>",
    "estructuraDecision": "<Es el unico tomador de decisiones? Tiene socios? Quien mas debe estar en la demo?>",
    "objeciones": "<Objeciones que planteo: precio, tiempo, comparando opciones, necesita consultarlo, etc>",
    "datosClinica": "<Nombre de clinica, ubicacion/ciudad, especialidades, tiempo operando, tamano del equipo>",
    "nivelInteres": "<Que tan enganchado esta? Hizo preguntas? Mostro urgencia? Se quedo callado? Nivel real de interes>",
    "notasParaDemo": "<Info critica que el closer debe saber antes de la demo. Puntos sensibles, lo que NO decir, lo que SI enfatizar>"
  },
  "salesAudit": {
    "grading": <numero 1-10>,
    "gradingJustification": "<2-3 oraciones justificando la nota. Referencia las etapas especificas del protocolo.>",
    "feedback": "<Auditoria de 4-8 oraciones. Evalua cada etapa: que hizo bien, que se salto, donde fue debil. No endulces nada. Si no siguio el protocolo, dilo claramente.>",
    "etapasCompletadas": "<Lista de etapas completadas y saltadas. Ej: 'Etapa 1: OK pero sin exclusividad | Etapa 2: Debil, acepto respuesta superficial | Etapa 3: Buena, obtuvo numeros | Etapa 4: SALTADA | Etapa 5: Parcial | Etapa 6: OK pero sin doble confirmacion'>",
    "demoAgendada": "<Se logro agendar la demo? SI/NO. Si no, por que no?>",
    "keyMoments": "<4-6 momentos criticos separados por | (pipe). Buenos y malos. Ej: 'Buen pattern interrupt cuando dijo que todo iba bien | Acepto No tengo tiempo sin insistir | No pregunto sobre estructura de liderazgo | Buena transicion a demo'>"
  }
}

CRITERIOS DE EVALUACION (contra el protocolo):
- Marco y microcompromiso (establecio autoridad? obtuvo el SI para conversar?) — 0-1.5 pts
- Identificacion del dolor (escarbó o acepto respuesta superficial?) — 0-2 pts
- Estado actual (obtuvo numeros reales? facturacion, margen, tratamientos?) — 0-2 pts
- Intentos anteriores + Estado deseado (exploro ambos?) — 0-1.5 pts
- Transicion y agendamiento de demo (logro agendar? doble confirmacion? menciono video?) — 0-2 pts
- Manejo de objeciones (las rebatió o se rindio?) — 0-1 pt

IMPORTANTE: Un setter que no agenda la demo NO puede tener mas de 4. Un setter que agenda pero se salta etapas clave (dolor, estado actual, numeros) no puede tener mas de 6. Solo 8+ si cumplio TODAS las etapas del protocolo de forma solida.`;

/**
 * Transcribe an audio buffer using OpenAI Whisper, then analyze with Claude.
 * Produces two outputs: prospect notes + sales audit.
 */
export async function transcribeAndAnalyze(
  auditId: number,
  audioBuffer: Buffer,
  mimeType: string,
  leadContext?: { leadId?: number; leadName?: string; closer?: string },
) {
  try {
    // ── Phase 1: Transcribe with Whisper ──
    const openai = getOpenAI();
    if (!openai) {
      await updateCallAudit(auditId, {
        aiFeedback: "Error: OPENAI_API_KEY no configurada. No se puede transcribir.",
      });
      return;
    }

    const ext = mimeType.includes("mp4") ? "mp4"
      : mimeType.includes("wav") ? "wav"
      : mimeType.includes("webm") ? "webm"
      : mimeType.includes("m4a") ? "m4a"
      : "mp3";

    const file = new File([new Uint8Array(audioBuffer)], `recording.${ext}`, { type: mimeType });

    console.log(`[Transcription] Starting Whisper for audit #${auditId}...`);
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      language: "es",
    });

    const transcript = transcription.text;
    if (!transcript || transcript.trim().length === 0) {
      await updateCallAudit(auditId, {
        aiFeedback: "Error: La transcripcion esta vacia. Verifica que el archivo contenga audio.",
      });
      return;
    }

    // Save transcript immediately
    await updateCallAudit(auditId, { recordingTranscript: transcript });
    console.log(`[Transcription] Transcript saved for audit #${auditId} (${transcript.length} chars)`);

    // ── Phase 2: Analyze with Claude ──
    await analyzeTranscript(auditId, transcript, leadContext);

  } catch (err: any) {
    console.error(`[Transcription] Error processing audit #${auditId}:`, err);
    try {
      await updateCallAudit(auditId, {
        aiFeedback: `Error: ${err.message || "Error desconocido durante el procesamiento"}`,
      });
    } catch {
      // If even the error update fails, just log
    }
  }
}

/**
 * Run dual AI analysis (prospect notes + sales audit) on transcript.
 * Used by both initial transcription and re-analysis.
 */
async function analyzeTranscript(
  auditId: number,
  transcript: string,
  leadContext?: { leadId?: number; leadName?: string; closer?: string },
) {
  const anthropic = getAnthropic();
  if (!anthropic) {
    await updateCallAudit(auditId, {
      aiFeedback: "Error: ANTHROPIC_API_KEY no configurada. Transcripcion guardada pero sin analisis.",
    });
    return;
  }

  const contextLine = leadContext
    ? `\nContexto: Lead "${leadContext.leadName || "desconocido"}", Closer: ${leadContext.closer || "desconocido"}\n`
    : "";

  console.log(`[Transcription] Starting Claude dual analysis for audit #${auditId}...`);
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${contextLine}Transcripcion de la llamada:\n\n${transcript}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";

  let analysis: {
    prospectNotes?: {
      dolores?: string;
      objetivos?: string;
      situacionActual?: string;
      situacionFinanciera?: string;
      intentosPrevios?: string;
      estructuraDecision?: string;
      objeciones?: string;
      datosClinica?: string;
      nivelInteres?: string;
      notasParaDemo?: string;
    };
    salesAudit?: {
      grading?: number;
      gradingJustification?: string;
      feedback?: string;
      etapasCompletadas?: string;
      demoAgendada?: string;
      keyMoments?: string;
    };
  };

  try {
    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    analysis = JSON.parse(jsonStr);
  } catch {
    await updateCallAudit(auditId, { aiFeedback: text });
    console.warn(`[Transcription] Failed to parse JSON for audit #${auditId}, stored raw text`);
    return;
  }

  const audit = analysis.salesAudit || {};
  const notes = analysis.prospectNotes || {};

  // Save sales audit to callAudits
  // Map etapasCompletadas → aiWhyNotClosed field (reuse existing column)
  const auditSummary = [
    audit.etapasCompletadas ? `ETAPAS: ${audit.etapasCompletadas}` : null,
    audit.demoAgendada ? `DEMO AGENDADA: ${audit.demoAgendada}` : null,
  ].filter(Boolean).join("\n");

  await updateCallAudit(auditId, {
    aiGrading: audit.grading ?? null,
    aiGradingJustification: audit.gradingJustification ?? null,
    aiFeedback: audit.feedback ?? null,
    aiWhyNotClosed: auditSummary || null,
    aiKeyMoments: audit.keyMoments ?? null,
  });

  console.log(`[Transcription] Triage audit saved for audit #${auditId}: ${audit.grading}/10`);

  // Save prospect notes as a lead_data_entry (if we have a leadId)
  if (leadContext?.leadId) {
    try {
      const fields = [
        { key: "dolores", label: "Dolores y Frustraciones", value: notes.dolores || null, category: "qualification" },
        { key: "objetivos", label: "Objetivos y Metas", value: notes.objetivos || null, category: "qualification" },
        { key: "situacion_actual", label: "Situación Actual", value: notes.situacionActual || null, category: "business" },
        { key: "situacion_financiera", label: "Situación Financiera", value: notes.situacionFinanciera || null, category: "financial" },
        { key: "intentos_previos", label: "Intentos Anteriores", value: notes.intentosPrevios || null, category: "business" },
        { key: "estructura_decision", label: "Tomadores de Decisión", value: notes.estructuraDecision || null, category: "contact" },
        { key: "objeciones", label: "Objeciones Planteadas", value: notes.objeciones || null, category: "qualification" },
        { key: "datos_clinica", label: "Datos de la Clínica", value: notes.datosClinica || null, category: "business" },
        { key: "nivel_interes", label: "Nivel de Interés", value: notes.nivelInteres || null, category: "qualification" },
        { key: "notas_para_demo", label: "Notas para la Demo", value: notes.notasParaDemo || null, category: "general" },
      ].filter(f => f.value && f.value.trim().length > 0);

      if (fields.length > 0) {
        await createLeadDataEntry({
          leadId: leadContext.leadId,
          source: "call_audit",
          formId: `audit-${auditId}`,
          data: { fields },
        });
        console.log(`[Transcription] Prospect notes saved for lead #${leadContext.leadId} (${fields.length} fields)`);
      }
    } catch (err) {
      console.error(`[Transcription] Failed to save prospect notes for audit #${auditId}:`, err);
    }
  }

  // Slack notification: triage analysis completed
  try {
    const grade = audit.grading ?? 0;
    const leadLabel = leadContext?.leadName || (leadContext?.leadId ? `Lead #${leadContext.leadId}` : "Sin lead");
    const closerLabel = leadContext?.closer || "N/A";
    const fields: Array<{ label: string; value: string }> = [
      { label: "👤 Lead", value: leadLabel },
      { label: "🎯 Closer", value: closerLabel },
      { label: "📊 Nota", value: `*${grade}/10*` },
      { label: "📅 Demo", value: audit.demoAgendada ? "Sí ✅" : "No ❌" },
    ];
    if (audit.etapasCompletadas) {
      fields.push({ label: "📋 Etapas", value: audit.etapasCompletadas });
    }
    const actions: Array<{ label: string; url: string; emoji?: string; style?: "primary" | "danger" }> = [
      { label: "Ver auditoría", url: crmLink(`/marketing/auditoria/${auditId}`), emoji: "🎙️", style: "primary" },
    ];
    if (leadContext?.leadId) {
      actions.push({ label: "Abrir lead", url: crmUrls.lead(leadContext.leadId), emoji: "🔗" });
    }
    await sendSlackAlert({
      severity: grade >= 7 ? "success" : grade >= 4 ? "info" : "warning",
      title: `Triage analizado — ${leadLabel} (${grade}/10)`,
      body: `Se completó el análisis IA de la llamada. Closer: *${closerLabel}*.`,
      emoji: grade >= 7 ? "🟢" : grade >= 4 ? "🟡" : "🔴",
      fields,
      actions,
    });
  } catch (err) {
    console.error(`[Transcription] Slack notification failed for audit #${auditId}:`, err);
  }
}

/**
 * Re-run AI analysis on an existing transcript (no re-transcription).
 */
export async function reanalyzeTranscript(
  auditId: number,
  transcript: string,
  leadContext?: { leadId?: number; leadName?: string; closer?: string },
) {
  await analyzeTranscript(auditId, transcript, leadContext);
}
