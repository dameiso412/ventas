import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";
import { updateCallAudit } from "../db";

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

const ANALYSIS_SYSTEM_PROMPT = `Eres un analista experto de llamadas de venta para clinicas de medicina estetica.

Tu trabajo es evaluar la calidad de una llamada de venta transcrita y generar un analisis estructurado.

Responde EXCLUSIVAMENTE con un objeto JSON valido (sin markdown, sin backticks) con estos campos:
{
  "grading": <numero 1-10>,
  "gradingJustification": "<2-3 oraciones explicando la nota>",
  "feedback": "<resumen de 3-5 oraciones de como fue la llamada, que hizo bien y que puede mejorar>",
  "whyNotClosed": "<si no se cerro la venta, explicar por que. Si se cerro, decir 'Venta cerrada exitosamente'>",
  "keyMoments": "<3-5 momentos clave de la llamada separados por | (pipe)>"
}

Criterios de evaluacion:
- Rapport y conexion emocional (1-2 pts)
- Identificacion del dolor del prospecto (1-2 pts)
- Presentacion de la solucion alineada al dolor (1-2 pts)
- Manejo de objeciones (1-2 pts)
- Cierre y urgencia (1-2 pts)

Se estricto pero justo. Una llamada promedio deberia estar en 5-6. Solo 8+ si realmente fue excepcional.`;

/**
 * Transcribe an audio buffer using OpenAI Whisper, then analyze with Claude.
 * Runs as a background task — updates the callAudit record as it progresses.
 */
export async function transcribeAndAnalyze(
  auditId: number,
  audioBuffer: Buffer,
  mimeType: string,
  leadContext?: { leadName?: string; closer?: string },
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

    console.log(`[Transcription] Starting Claude analysis for audit #${auditId}...`);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${contextLine}Transcripcion de la llamada:\n\n${transcript}`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";

    // Parse JSON response
    let analysis: {
      grading?: number;
      gradingJustification?: string;
      feedback?: string;
      whyNotClosed?: string;
      keyMoments?: string;
    };

    try {
      // Handle potential markdown wrapping
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, store raw text as feedback
      await updateCallAudit(auditId, { aiFeedback: text });
      console.warn(`[Transcription] Failed to parse JSON for audit #${auditId}, stored raw text`);
      return;
    }

    // Save analysis results
    await updateCallAudit(auditId, {
      aiGrading: analysis.grading ?? null,
      aiGradingJustification: analysis.gradingJustification ?? null,
      aiFeedback: analysis.feedback ?? null,
      aiWhyNotClosed: analysis.whyNotClosed ?? null,
      aiKeyMoments: analysis.keyMoments ?? null,
    });

    console.log(`[Transcription] Analysis complete for audit #${auditId}: ${analysis.grading}/10`);
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
 * Re-run AI analysis on an existing transcript (no re-transcription).
 */
export async function reanalyzeTranscript(auditId: number, transcript: string) {
  const anthropic = getAnthropic();
  if (!anthropic) throw new Error("ANTHROPIC_API_KEY no configurada");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Transcripcion de la llamada:\n\n${transcript}` }],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const analysis = JSON.parse(jsonStr);

  await updateCallAudit(auditId, {
    aiGrading: analysis.grading ?? null,
    aiGradingJustification: analysis.gradingJustification ?? null,
    aiFeedback: analysis.feedback ?? null,
    aiWhyNotClosed: analysis.whyNotClosed ?? null,
    aiKeyMoments: analysis.keyMoments ?? null,
  });
}
