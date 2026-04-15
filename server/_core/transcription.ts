import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";
import { updateCallAudit, createLeadDataEntry } from "../db";

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

const ANALYSIS_SYSTEM_PROMPT = `Eres un analista senior de llamadas de venta para clinicas de medicina estetica. Recibes la transcripcion de una llamada entre un closer y un prospecto.

Tu trabajo tiene DOS partes obligatorias:

=== PARTE 1: NOTAS DEL PROSPECTO ===
Extrae TODA la informacion relevante que el prospecto menciona durante la llamada. Esto es critico para que el equipo de ventas entienda al prospecto sin tener que escuchar toda la grabacion.

=== PARTE 2: AUDITORIA BRUTAL DE VENTAS ===
Evalua la llamada del closer de forma directa, honesta y sin filtros. No seas diplomatico — se brutalmente claro sobre que hizo mal y por que perdio (o casi pierde) la venta.

Responde EXCLUSIVAMENTE con un objeto JSON valido (sin markdown, sin backticks):

{
  "prospectNotes": {
    "dolores": "<Cuales son los problemas, frustraciones y dolores que el prospecto menciona? Se especifico con sus palabras>",
    "objetivos": "<Que quiere lograr? Metas, deseos, vision de su clinica/negocio>",
    "situacionActual": "<Como describe su situacion actual? Que tiene, que le falta, como opera>",
    "situacionFinanciera": "<Que menciona sobre dinero, presupuesto, inversion previa, capacidad de pago>",
    "objeciones": "<Que objeciones planteo? Precio, tiempo, confianza, necesita consultarlo, etc>",
    "datosPersonales": "<Nombre de la clinica, ubicacion, especialidades, tiempo operando, equipo, cualquier dato relevante>",
    "motivacionCompra": "<Que tan motivado esta? Que tan urgente es su necesidad? Nivel de interes real>",
    "notasAdicionales": "<Cualquier otra informacion relevante que no encaje en las categorias anteriores>"
  },
  "salesAudit": {
    "grading": <numero 1-10>,
    "gradingJustification": "<2-3 oraciones directas justificando la nota. Se brutal.>",
    "feedback": "<Auditoria de 4-6 oraciones. Que hizo bien, que hizo MAL, que momentos fueron criticos. No endulces nada.>",
    "whyNotClosed": "<Si no se cerro: razon REAL por la que se perdio (no la excusa del prospecto, sino el error del closer). Si se cerro: 'Venta cerrada exitosamente'>",
    "keyMoments": "<4-6 momentos criticos de la llamada separados por | (pipe). Incluye tanto los buenos como los terribles.>"
  }
}

CRITERIOS DE EVALUACION (se estricto):
- Rapport y conexion emocional genuina (no superficial) — 0-2 pts
- Identificacion profunda del dolor (no solo preguntar, sino escarbar) — 0-2 pts
- Presentacion de solucion alineada al dolor especifico del prospecto — 0-2 pts
- Manejo de objeciones (rebatir con logica, no rendirse) — 0-2 pts
- Cierre con urgencia y conviccion (no pedir permiso para cerrar) — 0-2 pts

La mayoria de llamadas deberian estar en 4-6. Solo 8+ si fue genuinamente excepcional. Un closer que pierde una venta cerrable NO puede tener mas de 5.`;

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
      objeciones?: string;
      datosPersonales?: string;
      motivacionCompra?: string;
      notasAdicionales?: string;
    };
    salesAudit?: {
      grading?: number;
      gradingJustification?: string;
      feedback?: string;
      whyNotClosed?: string;
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
  await updateCallAudit(auditId, {
    aiGrading: audit.grading ?? null,
    aiGradingJustification: audit.gradingJustification ?? null,
    aiFeedback: audit.feedback ?? null,
    aiWhyNotClosed: audit.whyNotClosed ?? null,
    aiKeyMoments: audit.keyMoments ?? null,
  });

  console.log(`[Transcription] Sales audit saved for audit #${auditId}: ${audit.grading}/10`);

  // Save prospect notes as a lead_data_entry (if we have a leadId)
  if (leadContext?.leadId) {
    try {
      const fields = [
        { key: "dolores", label: "Dolores y Frustraciones", value: notes.dolores || null, category: "qualification" },
        { key: "objetivos", label: "Objetivos y Metas", value: notes.objetivos || null, category: "qualification" },
        { key: "situacion_actual", label: "Situación Actual", value: notes.situacionActual || null, category: "business" },
        { key: "situacion_financiera", label: "Situación Financiera", value: notes.situacionFinanciera || null, category: "financial" },
        { key: "objeciones", label: "Objeciones Planteadas", value: notes.objeciones || null, category: "qualification" },
        { key: "datos_personales", label: "Datos del Negocio/Persona", value: notes.datosPersonales || null, category: "business" },
        { key: "motivacion_compra", label: "Motivación de Compra", value: notes.motivacionCompra || null, category: "qualification" },
        { key: "notas_adicionales", label: "Notas Adicionales", value: notes.notasAdicionales || null, category: "general" },
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
