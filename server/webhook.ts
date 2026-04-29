import { Router, Request, Response } from "express";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { ENV } from "./_core/env";
import { resolveLandingSlug } from "./_core/landings";
import { assignViaRoundRobin, notifyAgendaAssigned } from "./_core/round-robin";
import { getSubscriberInfo, setCustomField } from "./manychat";
import {
  verifyWebhookSignature as stripeVerifySignature,
  parseCharge,
  parseCheckoutSession,
  isStripeConfigured,
} from "./stripe";
import type Stripe from "stripe";
import * as db from "./db";

const webhookRouter = Router();

// ==================== Universal Data Entry Helpers ====================
interface DataField {
  key: string;
  label: string;
  value: string | null;
  category?: string;
}

function buildDataFields(entries: Array<{ key: string; label: string; value: any; category?: string }>): DataField[] {
  return entries
    .filter(e => e.value != null && e.value !== "")
    .map(e => ({ key: e.key, label: e.label, value: String(e.value), category: e.category || "general" }));
}

async function writeDataEntry(leadId: number, source: string, fields: DataField[], opts?: { formId?: string; scoreFinal?: number; scoreLabel?: string }) {
  try {
    await db.createLeadDataEntry({
      leadId,
      source,
      formId: opts?.formId || null,
      data: { fields },
      scoreFinal: opts?.scoreFinal || null,
      scoreLabel: (opts?.scoreLabel as any) || null,
    });
  } catch (err: any) {
    console.error(`[DataEntry] Failed to write for lead #${leadId} (source: ${source}):`, err.message);
  }
}

// Score label mapping
function getScoreLabel(score: number): "HOT" | "WARM" | "TIBIO" | "FRÍO" {
  if (score === 4) return "HOT";
  if (score === 3) return "WARM";
  if (score === 2) return "TIBIO";
  return "FRÍO";
}

// Get month name in Spanish
function getMesName(date: Date): string {
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return meses[date.getMonth()];
}

// Get week of month (1-5)
function getSemanaDelMes(date: Date): number {
  const day = date.getDate();
  return Math.ceil(day / 7);
}

// ============================================================
// META UTM → AD-ID RESOLVER
//
// When an ad in Meta Ads Manager is tagged with the URL-parameter macros
// `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}` (standard Meta pattern),
// those resolve to pure-numeric IDs in the landing URL and get captured as
// utm_campaign / utm_term / utm_content respectively. Converting them into
// first-class columns lets us JOIN ad_ads / ad_creatives directly on
// leads.meta_ad_id, which is the backbone of the creative-level dashboard.
//
// Heuristic: Meta numeric IDs are 10-20 digits. Anything shorter (or that
// contains non-digits) is a human-readable campaign name and we leave it
// in utm_* for reporting but don't promote it to a meta_*_id column.
//
// Returns an object with whichever fields could be resolved, so callers can
// spread it into a lead record: { ...resolveMetaIdsFromUtm(...) }.
// ============================================================
function resolveMetaIdsFromUtm(params: {
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
}): { metaCampaignId?: string; metaAdId?: string; metaAdsetId?: string } {
  const out: { metaCampaignId?: string; metaAdId?: string; metaAdsetId?: string } = {};
  const isMetaId = (v: unknown): v is string => typeof v === "string" && /^\d{10,20}$/.test(v.trim());
  // {{campaign.id}} → utm_campaign
  if (isMetaId(params.utmCampaign)) out.metaCampaignId = params.utmCampaign!.trim();
  // {{ad.id}} → utm_content
  if (isMetaId(params.utmContent)) out.metaAdId = params.utmContent!.trim();
  // {{adset.id}} → utm_term
  if (isMetaId(params.utmTerm)) out.metaAdsetId = params.utmTerm!.trim();
  return out;
}

// ============================================================
// SMART KEY MATCHER
// GHL sends form questions as full-text keys in Spanish.
// This function searches all keys in the payload for one that
// matches ANY of the given keyword patterns (case-insensitive).
// Returns the value of the first matching key, or null.
// ============================================================
function findValueByKeywords(body: Record<string, any>, keywords: string[]): string | null {
  const entries = Object.entries(body);
  for (const [key, value] of entries) {
    const keyLower = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const kw of keywords) {
      const kwNorm = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (keyLower.includes(kwNorm)) {
        if (Array.isArray(value)) return value.join(", ");
        if (value === null || value === undefined || value === "") return null;
        return String(value);
      }
    }
  }
  return null;
}

// AI Scoring prompt
const SCORING_PROMPT = `You are an AI agent responsible for evaluating and grading inbound leads for Sacamedi, a marketing agency for high-value clinics.
Your task is to grade the lead from 1 to 4 based on the criteria below.
You must only respond with a single digit: 1, 2, 3, or 4.
No extra text. No summaries. No explanation. Just the number.
---
Scoring Criteria:

**Score: 4 (Amazing Lead - HOT)**
- Urgencia: States they need results "YA (mi negocio depende de esto)".
- Marketing Previo: Has invested before and "perdió dinero sin resultados".
- Impedimento: Explicitly states "Nada, tengo autoridad y recursos".

**Score: 3 (Good Lead - WARM)**
- Urgencia: Needs results in the "próximos 30 días".
- Marketing Previo: Has had some experience, "funcionó 1-2 meses y se quemó" or only got "gente buscando descuentos".
- Impedimento: Might need to "consultarlo con socios" but shows clear intent.

**Score: 2 (Okay Lead - TIBIO)**
- Urgencia: Is looking for results in "2-3 meses".
- Marketing Previo: Has "nunca he invertido" (first time).
- Impedimento: Mentions "el presupuesto podría ser un tema" or wants to "comparar más opciones".

**Score: 1 (Unqualified - FRÍO/NO CALIFICA)**
- Urgencia: No defined timeline or is just looking.
- Marketing Previo: States "he tenido buenas experiencias con mi MK".
- Impedimento: States "tiempo para implementar / no lo haríamos ahora" or clinic is too new.
---`;

// ============================================================
// WEBHOOK 1: POST /api/webhook/lead
// Triggered when someone books an appointment in GHL.
// ROBUSTNESS FEATURES:
// 1. Persistent logging of every webhook call to webhook_logs table
// 2. Duplicate detection by email, phone, or name
// 3. Reschedule detection: updates date if lead already exists
// 4. Owner notification on errors
// 5. Never returns 500 to avoid GHL retries/failures
// ============================================================
webhookRouter.post("/api/webhook/lead", async (req: Request, res: Response) => {
  const startTime = Date.now();
  let logId: number | null = null;

  try {
    const rawBody = req.body;
    const rawPayloadStr = JSON.stringify(rawBody).substring(0, 10000);
    // Detect appointment type from query param (default: DEMO)
    const tipoCita = (req.query.tipo as string || "demo").toUpperCase() === "INTRO" ? "INTRO" : "DEMO";
    console.log(`[Webhook:Lead] Received new ${tipoCita} appointment (truncated):`, rawPayloadStr.substring(0, 500));

    if (rawBody.customData) {
      console.log("[Webhook:Lead] customData content:", JSON.stringify(rawBody.customData).substring(0, 1000));
    }
    console.log("[Webhook:Lead] Standard fields - full_name:", rawBody.full_name, "| email:", rawBody.email, "| phone:", rawBody.phone, "| contact_id:", rawBody.contact_id);
    console.log("[Webhook:Lead] All keys:", Object.keys(rawBody).join(", "));

    // Merge all data sources into a single flat body
    const body: Record<string, any> = {};
    const addEntries = (obj: Record<string, any>) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) continue;
        body[key] = value;
        const normalized = key.replace(/\s*_\s*/g, "_").replace(/\s+/g, "_").trim();
        if (normalized !== key) body[normalized] = value;
      }
    };

    addEntries(rawBody);
    if (rawBody.customData && typeof rawBody.customData === "object") {
      console.log("[Webhook:Lead] customData keys:", Object.keys(rawBody.customData).join(", "));
      addEntries(rawBody.customData);
    }
    if (rawBody.contact && typeof rawBody.contact === "object") {
      addEntries(rawBody.contact);
    }
    console.log("[Webhook:Lead] Merged+normalized keys:", Object.keys(body).join(", "));

    // Map GHL fields
    const nombre = body.Nombre || body.nombre || body.name || body.full_name || null;
    const telefono = body.Telefono || body.telefono || body.phone || null;
    const correo = body.Correo || body["Correo "] || body.correo || body.email || null;
    const fechaAgendaRaw = body.Fecha_Agenda || body.fecha_agenda || body.appointment_start_time || null;
    const linkCRM = body.Link_CRM || body.link_crm || body.linkCRM || body["Link_ CRM"] || null;
    const facturacion = body.Facturacion || body.facturacion || body.Fcaturacion || null;

    // ============================================================
    // UTM ATTRIBUTION EXTRACTION
    // Captures UTM parameters from multiple possible sources:
    // 1. Standard UTM fields (from GHL custom fields or direct webhook data)
    // 2. Query parameters on the webhook URL itself
    // 3. GHL attribution data (contact.attributionSource)
    // ============================================================
    const utmSource = body.utm_source || body.utmSource || body.UTM_Source || body.utm_Source
      || (req.query.utm_source as string) || null;
    const utmMedium = body.utm_medium || body.utmMedium || body.UTM_Medium || body.utm_Medium
      || (req.query.utm_medium as string) || null;
    const utmCampaign = body.utm_campaign || body.utmCampaign || body.UTM_Campaign || body.utm_Campaign
      || body.campaign_name || body.campaignName
      || (req.query.utm_campaign as string) || null;
    const utmContent = body.utm_content || body.utmContent || body.UTM_Content || body.utm_Content
      || body.ad_name || body.adName
      || (req.query.utm_content as string) || null;
    const utmTerm = body.utm_term || body.utmTerm || body.UTM_Term || body.utm_Term
      || body.adset_name || body.adsetName
      || (req.query.utm_term as string) || null;

    // Click IDs + landing URL — second vector for attribution when utm_* is stripped.
    const fbclid = body.fbclid || body.fbc || body.fb_click_id || (req.query.fbclid as string) || null;
    const gclid = body.gclid || body.gcl_id || (req.query.gclid as string) || null;
    const landingUrl = body.landing_url || body.landingUrl || body.page_url || body.pageUrl || null;
    // GHL can be configured to send a `landing_slug` custom field per landing
    // automation — preferred source (see docs/landing-tracking-ghl.md). Falls
    // back to regex derivation from landingUrl if the explicit slug is absent.
    const landingSlugRaw = body.landing_slug || body.landingSlug || (req.query.landing_slug as string) || null;
    const landingSlug = resolveLandingSlug({ explicitSlug: landingSlugRaw, landingUrl });
    const attributionReferrer = body.referrer || body.referer || (req.headers.referer as string) || null;

    // Promote numeric UTM values to first-class Meta IDs when the ad used
    // Meta's URL macros ({{campaign.id}}, {{ad.id}}, {{adset.id}}). Human-
    // readable campaign names stay only in utm_* — we never guess.
    const metaIds = resolveMetaIdsFromUtm({ utmCampaign, utmContent, utmTerm });

    console.log("[Webhook:Lead] Mapped -> nombre:", nombre, "| correo:", correo, "| telefono:", telefono, "| linkCRM:", linkCRM, "| facturacion:", facturacion);
    console.log("[Webhook:Lead] UTM -> source:", utmSource, "| medium:", utmMedium, "| campaign:", utmCampaign, "| content:", utmContent, "| term:", utmTerm);
    console.log("[Webhook:Lead] Click IDs -> fbclid:", fbclid ? "present" : "absent", "| gclid:", gclid ? "present" : "absent");
    if (metaIds.metaAdId || metaIds.metaCampaignId || metaIds.metaAdsetId) {
      console.log("[Webhook:Lead] Meta IDs resolved -> ad:", metaIds.metaAdId ?? "—", "| adset:", metaIds.metaAdsetId ?? "—", "| campaign:", metaIds.metaCampaignId ?? "—");
    }

    // Create initial webhook log entry
    try {
      logId = await db.createWebhookLog({
        endpoint: "/api/webhook/lead",
        method: "POST",
        status: "RECEIVED",
        nombre,
        correo,
        telefono,
        rawPayload: rawPayloadStr,
      });
    } catch (logErr: any) {
      console.error("[Webhook:Lead] Failed to create webhook log (non-fatal):", logErr.message);
    }

    // Parse Fecha_Agenda
    let fecha: Date;
    if (fechaAgendaRaw) {
      const parsed = new Date(fechaAgendaRaw);
      fecha = isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      fecha = new Date();
    }

    const mes = getMesName(fecha);
    const semana = getSemanaDelMes(fecha);

    // ============================================================
    // DUPLICATE DETECTION & RESCHEDULE HANDLING
    // Check if this lead already exists by email, phone, or name.
    // If found: update the appointment date (reschedule).
    // If not found: create a new lead.
    // ============================================================
    let existingLead = null;

    if (correo) {
      existingLead = await db.findLeadByEmailOrPhone(correo, null);
    }
    if (!existingLead && telefono) {
      existingLead = await db.findLeadByEmailOrPhone(null, telefono);
    }
    if (!existingLead && nombre) {
      existingLead = await db.findLeadByName(nombre);
    }

    if (existingLead) {
      // RESCHEDULE / INTRO→DEMO CONVERSION
      const updateData: Record<string, any> = { fecha, mes, semana };
      if (linkCRM && linkCRM !== existingLead.linkCRM) updateData.linkCRM = linkCRM;
      if (facturacion) updateData.facturado = facturacion;
      if (correo && !existingLead.correo) updateData.correo = correo;
      if (telefono && !existingLead.telefono) updateData.telefono = telefono;
      if (nombre && !existingLead.nombre) updateData.nombre = nombre;

      // Update UTM data if not already set on existing lead
      if (utmSource && !existingLead.utmSource) updateData.utmSource = utmSource;
      if (utmMedium && !existingLead.utmMedium) updateData.utmMedium = utmMedium;
      if (utmCampaign && !existingLead.utmCampaign) updateData.utmCampaign = utmCampaign;
      if (utmContent && !existingLead.utmContent) updateData.utmContent = utmContent;
      if (utmTerm && !existingLead.utmTerm) updateData.utmTerm = utmTerm;
      // Click IDs + landing are value-add even on reschedule: backfill if missing.
      if (fbclid && !(existingLead as any).fbclid) updateData.fbclid = fbclid;
      if (gclid && !(existingLead as any).gclid) updateData.gclid = gclid;
      if (landingUrl && !(existingLead as any).landingUrl) updateData.landingUrl = landingUrl;
      if (landingSlug && !(existingLead as any).landingSlug) updateData.landingSlug = landingSlug;
      if (attributionReferrer && !(existingLead as any).attributionReferrer) updateData.attributionReferrer = attributionReferrer;
      // Meta IDs: backfill only if empty — a reschedule shouldn't overwrite an
      // attribution we already resolved from the original lead creation.
      if (metaIds.metaAdId && !(existingLead as any).metaAdId) updateData.metaAdId = metaIds.metaAdId;
      if (metaIds.metaAdsetId && !(existingLead as any).metaAdsetId) updateData.metaAdsetId = metaIds.metaAdsetId;
      if (metaIds.metaCampaignId && !(existingLead as any).metaCampaignId) updateData.metaCampaignId = metaIds.metaCampaignId;

      // Handle intro→demo conversion
      let action = "updated";
      if (tipoCita === "DEMO" && existingLead.tipo === "INTRO") {
        // Intro is being converted to demo: save original intro date, upgrade type
        updateData.tipo = "DEMO";
        updateData.fechaIntro = existingLead.fecha; // preserve original intro date
        action = "converted_to_demo";
        console.log(`[Webhook:Lead] INTRO→DEMO conversion for Lead #${existingLead.id}`);
      } else if (tipoCita === "INTRO") {
        // Another intro for existing lead - just update
        updateData.tipo = "INTRO";
      }

      await db.updateLead(existingLead.id, updateData);

      // Round-robin: si el lead todavía no tiene setter (típicamente porque
      // venía como categoria=LEAD del webhook de prospect/manychat), ahora
      // que tiene una agenda, asignamos uno. Si ya tenía setter, NO se
      // reasigna — el reschedule conserva el owner original.
      let rescheduleAssignedSetter: string | null = existingLead.setterAsignado ?? null;
      if (!existingLead.setterAsignado) {
        try {
          const rr = await assignViaRoundRobin("AGENDA_NUEVA", existingLead.id);
          if (rr) {
            rescheduleAssignedSetter = rr.setterName;
            await db.updateLead(existingLead.id, { setterAsignado: rr.setterName });
            console.log(`[Webhook:Lead] Round-robin (reschedule) → Lead #${existingLead.id} asignado a "${rr.setterName}"`);
          }
        } catch (err: any) {
          console.error("[Webhook:Lead] Round-robin (reschedule) failed:", err.message);
        }
      }

      // Slack notif solo si: (a) hubo asignación nueva, o (b) fue un upgrade
      // INTRO→DEMO con setter ya asignado (ahí el equipo necesita saber que
      // se promovió el lead). Reschedules de misma-tipo con setter ya
      // asignado quedan silentes para no spamear el canal.
      const isFreshAssignment = !existingLead.setterAsignado && rescheduleAssignedSetter;
      const isIntroToDemoUpgrade = action === "converted_to_demo";
      if (isFreshAssignment || isIntroToDemoUpgrade) {
        notifyAgendaAssigned({
          leadId: existingLead.id,
          setterName: rescheduleAssignedSetter,
          nombre: existingLead.nombre || nombre,
          correo: existingLead.correo ?? correo,
          telefono: existingLead.telefono ?? telefono,
          fecha,
          tipoCita,
          linkCRM,
        }).catch((e: any) => console.error("[Webhook:Lead] Slack notif (reschedule) failed:", e?.message));
      }

      // Dual-write reschedule to universal profile
      await writeDataEntry(existingLead.id, "appointment", buildDataFields([
        { key: "fecha", label: "Fecha de Cita (reagendada)", value: fecha?.toISOString(), category: "appointment" },
        { key: "tipo", label: "Tipo de Cita", value: tipoCita, category: "appointment" },
        { key: "linkCRM", label: "Link CRM", value: linkCRM, category: "appointment" },
      ]));

      const processingTime = Date.now() - startTime;
      const notes = `${action === "converted_to_demo" ? "INTRO→DEMO conversion" : "Duplicate/reschedule"}: Lead #${existingLead.id} (${existingLead.nombre}). Updated fecha to ${fecha.toISOString()}, tipo=${tipoCita}`;
      console.log(`[Webhook:Lead] ${notes}`);

      if (logId) {
        try {
          await db.updateWebhookLog(logId, {
            status: "UPDATED",
            leadId: existingLead.id,
            processingNotes: notes,
            processingTimeMs: processingTime,
          });
        } catch (logErr: any) {
          console.error("[Webhook:Lead] Failed to update webhook log:", logErr.message);
        }
      }

      res.status(200).json({
        success: true,
        leadId: existingLead.id,
        action,
        tipo: tipoCita,
        message: action === "converted_to_demo"
          ? `Lead #${existingLead.id} converted from INTRO to DEMO. Demo date: ${fecha.toISOString()}.`
          : `Lead already existed (#${existingLead.id}). Appointment date updated to ${fecha.toISOString()}.`,
      });
      return;
    }

    // NEW LEAD: Create lead with tipo + UTM attribution
    const leadData: Record<string, any> = {
      fecha,
      mes,
      semana,
      tipo: tipoCita,
      nombre,
      correo,
      telefono,
      linkCRM,
      ...(facturacion ? { facturado: facturacion } : {}),
      // UTM Attribution
      ...(utmSource ? { utmSource } : {}),
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      ...(utmContent ? { utmContent } : {}),
      ...(utmTerm ? { utmTerm } : {}),
      // Click IDs + landing URL — backup vector for recovery.
      ...(fbclid ? { fbclid } : {}),
      ...(gclid ? { gclid } : {}),
      ...(landingUrl ? { landingUrl } : {}),
      ...(landingSlug ? { landingSlug } : {}),
      ...(attributionReferrer ? { attributionReferrer } : {}),
      // Meta-resolved IDs (only if UTMs used Meta's macro format).
      ...metaIds,
    };
    // If it's an intro, also save the intro date
    if (tipoCita === "INTRO") {
      leadData.fechaIntro = fecha;
    }
    const leadId = await db.createLead(leadData);

    // Round-robin assignment: nueva agenda → setterAsignado por % configurado.
    // No-op silente si la regla está inactiva o sin targets (comportamiento legacy:
    // setterAsignado queda null, alguien lo asigna a mano desde la UI).
    let assignedSetter: string | null = null;
    try {
      const rr = await assignViaRoundRobin("AGENDA_NUEVA", leadId);
      if (rr) {
        assignedSetter = rr.setterName;
        await db.updateLead(leadId, { setterAsignado: rr.setterName });
        console.log(`[Webhook:Lead] Round-robin → Lead #${leadId} asignado a "${rr.setterName}"`);
      }
    } catch (err: any) {
      // Falla silenciosa: la agenda se crea igual sin owner, no romper el webhook.
      console.error("[Webhook:Lead] Round-robin assignment failed:", err.message);
    }

    // Slack notif al canal del equipo. Fire-and-forget — Slack caído no afecta
    // la creación del lead.
    notifyAgendaAssigned({
      leadId, setterName: assignedSetter, nombre, correo, telefono,
      fecha, tipoCita, linkCRM,
    }).catch((e: any) => console.error("[Webhook:Lead] Slack notif failed:", e?.message));

    // Dual-write to universal profile
    await writeDataEntry(leadId, "appointment", buildDataFields([
      { key: "nombre", label: "Nombre", value: nombre, category: "contact" },
      { key: "correo", label: "Correo", value: correo, category: "contact" },
      { key: "telefono", label: "Teléfono", value: telefono, category: "contact" },
      { key: "fecha", label: "Fecha de Cita", value: fecha?.toISOString(), category: "appointment" },
      { key: "tipo", label: "Tipo de Cita", value: tipoCita, category: "appointment" },
      { key: "linkCRM", label: "Link CRM", value: linkCRM, category: "appointment" },
      { key: "facturado", label: "Facturación", value: facturacion, category: "financial" },
      { key: "utmSource", label: "UTM Source", value: utmSource, category: "attribution" },
      { key: "utmMedium", label: "UTM Medium", value: utmMedium, category: "attribution" },
      { key: "utmCampaign", label: "UTM Campaign", value: utmCampaign, category: "attribution" },
      { key: "utmContent", label: "UTM Content", value: utmContent, category: "attribution" },
      { key: "utmTerm", label: "UTM Term", value: utmTerm, category: "attribution" },
    ]));

    const processingTime = Date.now() - startTime;
    console.log(`[Webhook:Lead] Lead #${leadId} created successfully (${processingTime}ms)`);

    if (logId) {
      try {
        await db.updateWebhookLog(logId, {
          status: "PROCESSED",
          leadId,
          processingNotes: `New lead created: #${leadId} (${nombre || 'unnamed'})`,
          processingTimeMs: processingTime,
        });
      } catch (logErr: any) {
        console.error("[Webhook:Lead] Failed to update webhook log:", logErr.message);
      }
    }

    res.status(200).json({
      success: true,
      leadId,
      action: "created",
      message: "Lead created successfully (pending scoring)",
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("[Webhook:Lead] Error creating lead:", error);

    if (logId) {
      try {
        await db.updateWebhookLog(logId, {
          status: "ERROR",
          errorMessage: error.message || "Unknown error",
          processingTimeMs: processingTime,
        });
      } catch (logErr: any) {
        console.error("[Webhook:Lead] Failed to update webhook log with error:", logErr.message);
      }
    }

    // Notify owner about webhook failure (fire-and-forget)
    try {
      await notifyOwner({
        title: "Webhook Lead Error",
        content: `Error procesando webhook de lead: ${error.message || "Unknown error"}. Revisa los logs del webhook en el CRM.`,
      });
    } catch (notifyErr: any) {
      console.error("[Webhook:Lead] Failed to notify owner:", notifyErr.message);
    }

    // Return 200 to avoid GHL marking the webhook as failed
    res.status(200).json({
      success: false,
      error: error.message || "Internal server error",
      message: "Webhook received but processing failed. Error has been logged.",
    });
  }
});

// ============================================================
// WEBHOOK 2: POST /api/webhook/score
// Triggered when the client submits the qualification form.
// ============================================================
webhookRouter.post("/api/webhook/score", async (req: Request, res: Response) => {
  const startTime = Date.now();
  let logId: number | null = null;

  try {
    const body = req.body;
    const rawPayloadStr = JSON.stringify(body).substring(0, 10000);
    console.log("[Webhook:Score] Received scoring form, keys:", Object.keys(body).length);

    try {
      logId = await db.createWebhookLog({
        endpoint: "/api/webhook/score",
        method: "POST",
        status: "RECEIVED",
        rawPayload: rawPayloadStr,
      });
    } catch (logErr: any) {
      console.error("[Webhook:Score] Failed to create webhook log (non-fatal):", logErr.message);
    }

    // --- Smart extraction ---
    const correo = body.correo || body.email || body.Correo || null;
    const telefono = body.telefono || body.phone || body.Telefono || null;
    const nombre = body.nombre || body.full_name || body.Nombre
      || findValueByKeywords(body, ["Primer Nombre"])
      || null;

    if (logId) {
      try { await db.updateWebhookLog(logId, { nombre, correo, telefono }); } catch (_) {}
    }

    const instagram = body.instagram
      || findValueByKeywords(body, [
        "Indique el instagram de su clinica",
        "Instagram de Su Cl",
        "Instagram URL",
        "Sitio Web de Clinica o Instagram",
      ])
      || null;

    const pais = body.pais || body.country || null;

    const facturacion = findValueByKeywords(body, [
      "facturacion mensual ACTUAL",
      "Cual es su facturaci",
      "nivel de facturacion ACTUAL",
    ]) || null;

    const p1 = body.p1_frustracion
      || findValueByKeywords(body, ["MAYOR frustraci", "frustracion con la captacion"])
      || null;

    const p2 = body.p2_marketing_previo
      || findValueByKeywords(body, ["invertido en marketing", "Si has invertido en marketing", "marketing process"])
      || null;

    const p3 = body.Urgencia || body.urgencia || body.p3_urgencia
      || findValueByKeywords(body, [
        "pudieras elegir cuan rapido", "si pudieras elegir", "urgencia",
        "PIERDES mensualmente", "Cuanto calculas que PIERD",
        "sistema de captacion efectivo", "plazo para resultados", "cuan rapido",
      ])
      || null;

    const p4 = body.p4_tiempo_operando
      || findValueByKeywords(body, ["tiempo lleva operando", "Cuanto tiempo lleva"])
      || null;

    const p5 = body.p5_tratamientos
      || findValueByKeywords(body, ["aparatologias o tratamientos faciales", "tratamientos faciales y corporales"])
      || null;

    const p6 = body.p6_impedimento
      || findValueByKeywords(body, ["solucion perfecta manana", "que te impediria implementarla", "impedimento para implementar"])
      || null;

    const metaFacturacion = findValueByKeywords(body, ["meta de facturacion exacta", "crecer tu negocio exponencialmente"]) || null;
    const inversionComoda = findValueByKeywords(body, ["inversion minima para trabajar con nosotros", "se sentiria comodo", "1.200 USD"]) || null;
    const yaBasta = findValueByKeywords(body, ["YA BASTA", "necesito resolver esto"]) || null;
    const esClinica = findValueByKeywords(body, ["Eres propietario", "clinica estetica o spa medico", "Eres Clinica estetica con tratamientos", "Eres una clinica estetica"]) || null;

    console.log("[Webhook:Score] Extracted data:", JSON.stringify({
      correo, telefono, nombre, instagram, pais, facturacion,
      p1, p2, p3, p4, p5, p6,
      metaFacturacion, inversionComoda, yaBasta, esClinica,
    }));

    // --- Find the existing lead ---
    let lead = await db.findLeadByEmailOrPhone(correo, telefono);
    if (!lead && nombre) {
      lead = await db.findLeadByName(nombre);
    }

    if (!lead) {
      console.log("[Webhook:Score] No existing lead found, creating new lead from score data");
      const now = new Date();
      const leadId = await db.createLead({
        fecha: now,
        mes: getMesName(now),
        semana: getSemanaDelMes(now),
        nombre,
        correo,
        telefono,
      });
      lead = await db.getLeadById(leadId);
    }

    if (!lead) {
      const processingTime = Date.now() - startTime;
      if (logId) {
        try { await db.updateWebhookLog(logId, { status: "ERROR", errorMessage: "Could not create or find lead", processingTimeMs: processingTime }); } catch (_) {}
      }
      res.status(200).json({ success: false, error: "Could not create or find lead" });
      return;
    }

    // --- AI Scoring ---
    let scoreFinal = body.score_override ? parseInt(body.score_override) : null;

    if (!scoreFinal) {
      try {
        const userMessage = `
**P1: Frustracion con captacion de pacientes** - ${p1 || "N/A"}
**P2: Marketing Previo / Inversion anterior** - ${p2 || "N/A"}
**P3: Perdida mensual por falta de captacion** - ${p3 || "N/A"}
**P4: Tiempo operando la clinica** - ${p4 || "N/A"}
**P5: Tratamientos / Aparatologias disponibles** - ${p5 || "N/A"}
**P6: Impedimento para implementar** - ${p6 || "N/A"}

--- Additional context ---
**"YA BASTA" trigger**: ${yaBasta || "N/A"}
**Meta de facturacion**: ${metaFacturacion || "N/A"}
**Comodo con inversion de $1200 USD**: ${inversionComoda || "N/A"}
**Es clinica estetica con aparatologia**: ${esClinica || "N/A"}
**Facturacion actual**: ${facturacion || "N/A"}`;

        const result = await invokeLLM({
          messages: [
            { role: "system", content: SCORING_PROMPT },
            { role: "user", content: userMessage },
          ],
        });

        const content = typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content.trim()
          : "";
        const parsed = parseInt(content);
        if (parsed >= 1 && parsed <= 4) {
          scoreFinal = parsed;
        }
      } catch (err) {
        console.error("[Webhook:Score] AI scoring failed:", err);
      }
    }

    const scoreLabel = scoreFinal ? getScoreLabel(scoreFinal) : null;

    // --- Update the lead ---
    const updateData: Record<string, any> = {};
    if (instagram) updateData.instagram = instagram;
    if (pais) updateData.pais = pais;
    // NOTE: facturado is a decimal field — do NOT store text like "Menos de $10,000USD/mes"
    // The facturacion text is passed to AI scoring only, not stored in the decimal column
    if (nombre && !lead.nombre) updateData.nombre = nombre;
    if (scoreFinal) updateData.score = scoreFinal;
    if (scoreLabel) updateData.scoreLabel = scoreLabel;

    if (Object.keys(updateData).length > 0) {
      await db.updateLead(lead.id, updateData);
    }

    // --- Create scoring record ---
    await db.createLeadScoring({
      leadId: lead.id,
      correo,
      instagram,
      p1Frustracion: p1,
      p2MarketingPrevio: p2,
      p3Urgencia: p3,
      p4TiempoOperando: p4,
      p5Tratamientos: p5,
      p6Impedimento: p6,
      scoreFinal,
      scoreLabel: scoreLabel as any,
    });

    // Dual-write to universal profile (captures ALL extracted data, including fields not stored in lead_scoring)
    await writeDataEntry(lead.id, "diagnostic_form", buildDataFields([
      { key: "frustracion", label: "Mayor frustración con captación", value: p1, category: "qualification" },
      { key: "marketing_previo", label: "Experiencia con marketing previo", value: p2, category: "qualification" },
      { key: "urgencia", label: "Urgencia / pérdida mensual", value: p3, category: "qualification" },
      { key: "tiempo_operando", label: "Tiempo operando la clínica", value: p4, category: "qualification" },
      { key: "tratamientos", label: "Tratamientos / aparatologías", value: p5, category: "qualification" },
      { key: "impedimento", label: "Impedimento para implementar", value: p6, category: "qualification" },
      { key: "meta_facturacion", label: "Meta de facturación", value: metaFacturacion, category: "financial" },
      { key: "inversion_comoda", label: "Inversión cómoda", value: inversionComoda, category: "financial" },
      { key: "ya_basta", label: "Urgencia (YA BASTA)", value: yaBasta, category: "qualification" },
      { key: "es_clinica", label: "¿Es clínica estética?", value: esClinica, category: "qualification" },
      { key: "facturacion", label: "Facturación mensual", value: facturacion, category: "financial" },
      { key: "instagram", label: "Instagram", value: instagram, category: "contact" },
      { key: "pais", label: "País", value: pais, category: "contact" },
    ]), { formId: "sacamedi_diagnostic_v1", scoreFinal: scoreFinal ?? undefined, scoreLabel: scoreLabel ?? undefined });

    const processingTime = Date.now() - startTime;
    console.log(`[Webhook:Score] Lead #${lead.id} enriched & scored: ${scoreFinal} (${scoreLabel}) [${processingTime}ms]`);

    if (logId) {
      try {
        await db.updateWebhookLog(logId, {
          status: "PROCESSED",
          leadId: lead.id,
          processingNotes: `Lead #${lead.id} scored: ${scoreFinal} (${scoreLabel})`,
          processingTimeMs: processingTime,
        });
      } catch (_) {}
    }

    res.json({
      success: true,
      leadId: lead.id,
      score: scoreFinal,
      scoreLabel,
      extractedData: { p1, p2, p3, p4, p5, p6, instagram, pais, facturacion },
      message: "Lead enriched and scored successfully",
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("[Webhook:Score] Error processing score:", error);

    if (logId) {
      try { await db.updateWebhookLog(logId, { status: "ERROR", errorMessage: error.message || "Unknown error", processingTimeMs: processingTime }); } catch (_) {}
    }

    try {
      await notifyOwner({
        title: "Webhook Score Error",
        content: `Error procesando webhook de scoring: ${error.message || "Unknown error"}. Revisa los logs del webhook en el CRM.`,
      });
    } catch (_) {}

    res.status(200).json({
      success: false,
      error: error.message || "Internal server error",
      message: "Webhook received but processing failed. Error has been logged.",
    });
  }
});

// ============================================================
// WEBHOOK 3: POST + GET /api/webhook/call-audit
// Receives call audit data from the GPT automation pipeline.
// ============================================================

webhookRouter.options("/api/webhook/call-audit", (_req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.status(204).send();
});

async function handleCallAudit(req: Request, res: Response) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  const startTime = Date.now();
  let logId: number | null = null;

  try {
    const data = { ...(req.query || {}), ...(req.body || {}) };
    const keys = Object.keys(data).filter(k => data[k] !== undefined && data[k] !== "");
    console.log(`[Webhook:CallAudit] ${req.method} received, keys: ${keys.join(", ") || "(none)"}`);
    console.log(`[Webhook:CallAudit] Content-Type: ${req.headers["content-type"] || "(none)"}`);

    try {
      logId = await db.createWebhookLog({
        endpoint: "/api/webhook/call-audit",
        method: req.method,
        status: "RECEIVED",
        rawPayload: JSON.stringify(data).substring(0, 10000),
      });
    } catch (logErr: any) {
      console.error("[Webhook:CallAudit] Failed to create webhook log (non-fatal):", logErr.message);
    }

    const closer = data.closer || data.Closer || data.rep || data.Rep || null;
    const email = data.correoLead || data.correo_lead || data.email || data.correo || data.Correo || data.leadEmail || data.lead_email || null;
    const phone = data.telefonoLead || data.telefono_lead || data.phone || data.telefono || data.Telefono || data.leadPhone || data.lead_phone || null;
    const leadName = data.leadName || data.lead_name || data.name || data.nombre || data.Nombre || null;
    const linkGrabacion = data.linkGrabacion || data.link_grabacion || data.recording_link || data.recordingLink || data.recordingUrl || data.recording_url || null;
    const recordingTranscript = data.recordingTranscript || data.recording_transcript || data.transcript || data.Transcript || data.recording || data.Recording || null;
    const duracionMinutos = data.duracionMinutos || data.duracion_minutos || data.duracion || data.duration || null;
    const fechaLlamadaRaw = data.fechaLlamada || data.fecha_llamada || data.callDate || data.call_date || null;

    const aiFeedback = data.aiFeedback || data.ai_feedback || data.feedback || data.Feedback || null;
    const aiGradingRaw = data.aiGrading || data.ai_grading || data.grading || data.Grading || data.grade || data.Grade || null;
    const aiGradingJustification = data.aiGradingJustification || data.ai_grading_justification || data.gradingJustification || data.grading_justification || null;
    const aiWhyNotClosed = data.aiWhyNotClosed || data.ai_why_not_closed || data.whyNotClosed || data.why_not_closed || data.WhyNotClosed || null;
    const aiKeyMoments = data.aiKeyMoments || data.ai_key_moments || data.keyMoments || data.key_moments || null;

    if (logId) {
      try {
        await db.updateWebhookLog(logId, {
          nombre: leadName ? String(leadName) : null,
          correo: email ? String(email) : null,
          telefono: phone ? String(phone) : null,
        });
      } catch (_) {}
    }

    let aiGrading: number | null = null;
    if (aiGradingRaw !== null && aiGradingRaw !== undefined && aiGradingRaw !== "") {
      const cleaned = String(aiGradingRaw).replace(/[^0-9.]/g, "");
      const parsed = parseInt(cleaned);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
        aiGrading = parsed;
      }
    }

    let fechaLlamada: Date | null = null;
    if (fechaLlamadaRaw) {
      const parsed = new Date(String(fechaLlamadaRaw));
      fechaLlamada = isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      fechaLlamada = new Date();
    }

    let leadId: number | null = null;
    try {
      let lead = await db.findLeadByEmailOrPhone(
        email ? String(email).trim() : null,
        phone ? String(phone).trim() : null
      );
      if (!lead && leadName) {
        lead = await db.findLeadByName(String(leadName));
      }
      if (lead) {
        leadId = lead.id;
        console.log(`[Webhook:CallAudit] Linked to lead #${leadId} (${lead.nombre})`);
      } else if (leadName) {
        console.log(`[Webhook:CallAudit] No lead found by email/phone/name, lead name: ${leadName}`);
      }
    } catch (lookupErr: any) {
      console.log(`[Webhook:CallAudit] Lead lookup failed (non-fatal): ${lookupErr.message}`);
    }

    let keyMomentsStr: string | null = null;
    if (aiKeyMoments) {
      keyMomentsStr = typeof aiKeyMoments === "string" ? aiKeyMoments : JSON.stringify(aiKeyMoments);
    }

    const result = await db.createCallAudit({
      leadId,
      closer: closer ? String(closer) : null,
      fechaLlamada,
      linkGrabacion: linkGrabacion ? String(linkGrabacion) : null,
      recordingTranscript: recordingTranscript ? String(recordingTranscript) : null,
      leadName: leadName ? String(leadName) : null,
      leadEmail: email ? String(email).trim() : null,
      duracionMinutos: duracionMinutos ? parseInt(String(duracionMinutos)) || null : null,
      aiFeedback: aiFeedback ? String(aiFeedback) : null,
      aiGrading,
      aiGradingJustification: aiGradingJustification ? String(aiGradingJustification) : null,
      aiWhyNotClosed: aiWhyNotClosed ? String(aiWhyNotClosed) : null,
      aiKeyMoments: keyMomentsStr,
    });

    // Dual-write to universal profile (only if linked to a lead)
    if (leadId) {
      await writeDataEntry(leadId, "call_audit", buildDataFields([
        { key: "closer", label: "Closer", value: closer, category: "team" },
        { key: "ai_grading", label: "Calificación AI", value: aiGrading, category: "audit" },
        { key: "ai_why_not_closed", label: "¿Por qué no cerró?", value: aiWhyNotClosed, category: "audit" },
        { key: "ai_key_moments", label: "Momentos clave", value: keyMomentsStr, category: "audit" },
        { key: "duracion", label: "Duración (min)", value: duracionMinutos, category: "audit" },
      ]));
    }

    const processingTime = Date.now() - startTime;
    console.log(`[Webhook:CallAudit] Audit #${result.id} created successfully${leadId ? ` (linked to lead #${leadId})` : " (no lead linked)"} [${processingTime}ms]`);

    if (logId) {
      try {
        await db.updateWebhookLog(logId, {
          status: "PROCESSED",
          leadId,
          processingNotes: `Audit #${result.id} created${leadId ? ` (linked to lead #${leadId})` : ""}`,
          processingTimeMs: processingTime,
        });
      } catch (_) {}
    }

    res.status(200).json({
      success: true,
      auditId: result.id,
      leadId,
      message: "Call audit created successfully",
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("[Webhook:CallAudit] Error (returning 200 with error info):", error?.message || error);

    if (logId) {
      try { await db.updateWebhookLog(logId, { status: "ERROR", errorMessage: String(error?.message || "Unknown error"), processingTimeMs: processingTime }); } catch (_) {}
    }

    res.status(200).json({
      success: false,
      error: String(error?.message || "Unknown error"),
      message: "Call audit processing failed but request was received",
    });
  }
}

webhookRouter.post("/api/webhook/call-audit", handleCallAudit);
webhookRouter.get("/api/webhook/call-audit", handleCallAudit);

// ============================================================
// WEBHOOK 4: POST /api/webhook/prospect
// Triggered when a new lead/prospect arrives WITHOUT an appointment.
// These are "Dinero Gratis" - qualified leads that haven't booked yet.
// ============================================================
webhookRouter.post("/api/webhook/prospect", async (req: Request, res: Response) => {
  const startTime = Date.now();
  let logId: number | null = null;

  try {
    const rawBody = req.body;
    const rawPayloadStr = JSON.stringify(rawBody).substring(0, 10000);
    console.log(`[Webhook:Prospect] Received new prospect (truncated):`, rawPayloadStr.substring(0, 500));

    // Merge all data sources into a single flat body
    const body: Record<string, any> = {};
    const addEntries = (obj: Record<string, any>) => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) continue;
        body[key] = value;
        const normalized = key.replace(/\s*_\s*/g, "_").replace(/\s+/g, "_").trim();
        if (normalized !== key) body[normalized] = value;
      }
    };

    addEntries(rawBody);
    if (rawBody.customData && typeof rawBody.customData === "object") {
      addEntries(rawBody.customData);
    }
    if (rawBody.contact && typeof rawBody.contact === "object") {
      addEntries(rawBody.contact);
    }

    // Map fields (same as lead webhook but without Fecha_Agenda requirement)
    const nombre = body.Nombre || body.nombre || body.name || body.full_name || null;
    const telefono = body.Telefono || body.telefono || body.phone || null;
    const correo = body.Correo || body["Correo "] || body.correo || body.email || null;
    const linkCRM = body.Link_CRM || body.link_crm || body.linkCRM || body["Link_ CRM"] || null;
    const pais = body.Pais || body.pais || body.country || null;
    const instagram = body.Instagram || body.instagram || null;
    const rubro = body.Rubro || body.rubro || body.industry || null;

    // UTM Attribution
    const utmSource = body.utm_source || body.utmSource || body.UTM_Source || (req.query.utm_source as string) || null;
    const utmMedium = body.utm_medium || body.utmMedium || body.UTM_Medium || (req.query.utm_medium as string) || null;
    const utmCampaign = body.utm_campaign || body.utmCampaign || body.UTM_Campaign || body.campaign_name || (req.query.utm_campaign as string) || null;
    const utmContent = body.utm_content || body.utmContent || body.UTM_Content || body.ad_name || (req.query.utm_content as string) || null;
    const utmTerm = body.utm_term || body.utmTerm || body.UTM_Term || body.adset_name || (req.query.utm_term as string) || null;

    // Click-ID + landing fallback so we can recover attribution when utm_* is stripped
    const fbclid = body.fbclid || body.fbc || (req.query.fbclid as string) || null;
    const gclid = body.gclid || (req.query.gclid as string) || null;
    const landingUrl = body.landing_url || body.landingUrl || body.page_url || body.pageUrl || null;
    const landingSlugRaw = body.landing_slug || body.landingSlug || (req.query.landing_slug as string) || null;
    const landingSlug = resolveLandingSlug({ explicitSlug: landingSlugRaw, landingUrl });
    const attributionReferrer = body.referrer || body.http_referrer || body.httpReferrer || null;

    // Promote numeric UTM values to Meta IDs (see lead webhook for rationale).
    const metaIds = resolveMetaIdsFromUtm({ utmCampaign, utmContent, utmTerm });

    console.log(`[Webhook:Prospect] Mapped -> nombre: ${nombre} | correo: ${correo} | telefono: ${telefono}`);
    if (metaIds.metaAdId || metaIds.metaCampaignId || metaIds.metaAdsetId) {
      console.log(`[Webhook:Prospect] Meta IDs resolved -> ad: ${metaIds.metaAdId ?? "—"} | adset: ${metaIds.metaAdsetId ?? "—"} | campaign: ${metaIds.metaCampaignId ?? "—"}`);
    }

    // Create webhook log
    try {
      logId = await db.createWebhookLog({
        endpoint: "/api/webhook/prospect",
        method: "POST",
        status: "RECEIVED",
        nombre,
        correo,
        telefono,
        rawPayload: rawPayloadStr,
      });
    } catch (logErr: any) {
      console.error("[Webhook:Prospect] Failed to create webhook log (non-fatal):", logErr.message);
    }

    // Duplicate detection
    let existingLead = null;
    if (correo) existingLead = await db.findLeadByEmailOrPhone(correo, null);
    if (!existingLead && telefono) existingLead = await db.findLeadByEmailOrPhone(null, telefono);

    if (existingLead) {
      // Update existing lead with any new info
      const updateData: Record<string, any> = {};
      if (correo && !existingLead.correo) updateData.correo = correo;
      if (telefono && !existingLead.telefono) updateData.telefono = telefono;
      if (nombre && !existingLead.nombre) updateData.nombre = nombre;
      if (linkCRM && !existingLead.linkCRM) updateData.linkCRM = linkCRM;
      if (pais && !existingLead.pais) updateData.pais = pais;
      if (instagram && !existingLead.instagram) updateData.instagram = instagram;
      if (rubro && !existingLead.rubro) updateData.rubro = rubro;
      // Backfill click-IDs + landing so we can reconcile later
      if (fbclid && !(existingLead as any).fbclid) updateData.fbclid = fbclid;
      if (gclid && !(existingLead as any).gclid) updateData.gclid = gclid;
      if (landingUrl && !(existingLead as any).landingUrl) updateData.landingUrl = landingUrl;
      if (landingSlug && !(existingLead as any).landingSlug) updateData.landingSlug = landingSlug;
      if (attributionReferrer && !(existingLead as any).attributionReferrer) updateData.attributionReferrer = attributionReferrer;
      // Meta-resolved IDs: backfill only if empty.
      if (metaIds.metaAdId && !(existingLead as any).metaAdId) updateData.metaAdId = metaIds.metaAdId;
      if (metaIds.metaAdsetId && !(existingLead as any).metaAdsetId) updateData.metaAdsetId = metaIds.metaAdsetId;
      if (metaIds.metaCampaignId && !(existingLead as any).metaCampaignId) updateData.metaCampaignId = metaIds.metaCampaignId;

      if (Object.keys(updateData).length > 0) {
        await db.updateLead(existingLead.id, updateData);
      }

      const processingTime = Date.now() - startTime;
      if (logId) {
        try {
          await db.updateWebhookLog(logId, {
            status: "UPDATED",
            leadId: existingLead.id,
            processingNotes: `Duplicate prospect: Lead #${existingLead.id} updated`,
            processingTimeMs: processingTime,
          });
        } catch (logErr: any) {
          console.error("[Webhook:Prospect] Failed to update webhook log:", logErr.message);
        }
      }

      res.status(200).json({
        success: true,
        leadId: existingLead.id,
        action: "updated",
        message: `Prospect already existed (#${existingLead.id}). Info updated.`,
      });
      return;
    }

    // Create new lead as LEAD category (not AGENDA)
    const now = new Date();
    const leadData: Record<string, any> = {
      fecha: now,
      mes: getMesName(now),
      semana: getSemanaDelMes(now),
      tipo: "DEMO", // default, can be changed later
      categoria: "LEAD", // This is the key difference - it's a prospect, not an appointment
      estadoLead: "NUEVO",
      origen: "ADS",
      nombre,
      correo,
      telefono,
      pais,
      instagram,
      rubro,
      linkCRM,
      ...(utmSource ? { utmSource } : {}),
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      ...(utmContent ? { utmContent } : {}),
      ...(utmTerm ? { utmTerm } : {}),
      ...(fbclid ? { fbclid } : {}),
      ...(gclid ? { gclid } : {}),
      ...(landingUrl ? { landingUrl } : {}),
      ...(landingSlug ? { landingSlug } : {}),
      ...(attributionReferrer ? { attributionReferrer } : {}),
      ...metaIds,
    };

    const leadId = await db.createLead(leadData);

    // Dual-write to universal profile
    await writeDataEntry(leadId, "prospect", buildDataFields([
      { key: "nombre", label: "Nombre", value: nombre, category: "contact" },
      { key: "correo", label: "Correo", value: correo, category: "contact" },
      { key: "telefono", label: "Teléfono", value: telefono, category: "contact" },
      { key: "pais", label: "País", value: pais, category: "contact" },
      { key: "instagram", label: "Instagram", value: instagram, category: "contact" },
      { key: "rubro", label: "Rubro", value: rubro, category: "business" },
      { key: "utmSource", label: "UTM Source", value: utmSource, category: "attribution" },
      { key: "utmMedium", label: "UTM Medium", value: utmMedium, category: "attribution" },
      { key: "utmCampaign", label: "UTM Campaign", value: utmCampaign, category: "attribution" },
    ]));

    const processingTime = Date.now() - startTime;
    console.log(`[Webhook:Prospect] Prospect #${leadId} created successfully (${processingTime}ms)`);

    if (logId) {
      try {
        await db.updateWebhookLog(logId, {
          status: "PROCESSED",
          leadId,
          processingNotes: `New prospect created: #${leadId} (${nombre || 'unnamed'})`,
          processingTimeMs: processingTime,
        });
      } catch (logErr: any) {
        console.error("[Webhook:Prospect] Failed to update webhook log:", logErr.message);
      }
    }

    res.status(200).json({
      success: true,
      leadId,
      action: "created",
      message: "Prospect created successfully",
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("[Webhook:Prospect] Error:", error);

    if (logId) {
      try {
        await db.updateWebhookLog(logId, {
          status: "ERROR",
          errorMessage: error.message || "Unknown error",
          processingTimeMs: processingTime,
        });
      } catch (logErr: any) {
        console.error("[Webhook:Prospect] Failed to update webhook log with error:", logErr.message);
      }
    }

    try {
      await notifyOwner({
        title: "Webhook Prospect Error",
        content: `Error procesando webhook de prospect: ${error.message || "Unknown error"}`,
      });
    } catch (notifyErr: any) {
      console.error("[Webhook:Prospect] Failed to notify owner:", notifyErr.message);
    }

    res.status(200).json({
      success: false,
      error: error.message || "Internal server error",
      message: "Webhook received but processing failed. Error has been logged.",
    });
  }
});

// ============================================================
// WEBHOOK 5: POST /api/webhook/universal
// Accepts self-describing payloads from any form/source.
// ============================================================
webhookRouter.post("/api/webhook/universal", async (req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  const startTime = Date.now();
  let logId: number | null = null;

  try {
    const body = req.body;
    const rawPayloadStr = JSON.stringify(body).substring(0, 10000);
    console.log("[Webhook:Universal] Received universal payload");

    try {
      logId = await db.createWebhookLog({
        endpoint: "/api/webhook/universal",
        method: "POST",
        status: "RECEIVED",
        rawPayload: rawPayloadStr,
      });
    } catch (logErr: any) {
      console.error("[Webhook:Universal] Failed to create webhook log:", logErr.message);
    }

    const source = body.source || "unknown";
    const correo = body.correo || body.email || null;
    const telefono = body.telefono || body.phone || null;
    const nombre = body.nombre || body.name || body.full_name || null;
    const fields: DataField[] = Array.isArray(body.fields) ? body.fields : [];

    if (!correo && !telefono && !nombre) {
      res.status(200).json({ success: false, error: "At least one identifier required (correo, telefono, or nombre)" });
      return;
    }

    // Find or create lead
    let lead = correo ? await db.findLeadByEmailOrPhone(correo, null) : null;
    if (!lead && telefono) lead = await db.findLeadByEmailOrPhone(null, telefono);
    if (!lead && nombre) lead = await db.findLeadByName(nombre);

    let leadId: number;
    let action = "enriched";

    if (lead) {
      leadId = lead.id;
      // Enrich lead with any new contact data
      const updateData: Record<string, any> = {};
      if (correo && !lead.correo) updateData.correo = correo;
      if (telefono && !lead.telefono) updateData.telefono = telefono;
      if (nombre && !lead.nombre) updateData.nombre = nombre;
      if (Object.keys(updateData).length > 0) await db.updateLead(leadId, updateData);
    } else {
      const now = new Date();
      leadId = await db.createLead({
        fecha: now,
        mes: getMesName(now),
        semana: getSemanaDelMes(now),
        nombre,
        correo,
        telefono,
        categoria: "LEAD",
        estadoLead: "NUEVO",
      });
      action = "created";
    }

    // AI Scoring (optional)
    let scoreFinal: number | null = null;
    let scoreLabel: "HOT" | "WARM" | "TIBIO" | "FRÍO" | null = null;

    if (body.requestScoring && fields.length > 0) {
      try {
        const userMessage = fields
          .filter((f: DataField) => f.value)
          .map((f: DataField) => `**${f.label}** - ${f.value}`)
          .join("\n");

        const result = await invokeLLM({
          messages: [
            { role: "system", content: SCORING_PROMPT },
            { role: "user", content: userMessage },
          ],
        });

        const content = typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content.trim() : "";
        const parsed = parseInt(content);
        if (parsed >= 1 && parsed <= 4) {
          scoreFinal = parsed;
          scoreLabel = getScoreLabel(scoreFinal);
          await db.updateLead(leadId, { score: scoreFinal, scoreLabel });
        }
      } catch (err) {
        console.error("[Webhook:Universal] AI scoring failed:", err);
      }
    }

    // Write to universal profile
    await writeDataEntry(leadId, source, fields, {
      formId: body.formId || null,
      scoreFinal: scoreFinal ?? undefined,
      scoreLabel: scoreLabel ?? undefined,
    });

    const processingTime = Date.now() - startTime;
    console.log(`[Webhook:Universal] Lead #${leadId} ${action} with ${fields.length} fields from "${source}" [${processingTime}ms]`);

    if (logId) {
      try {
        await db.updateWebhookLog(logId, {
          status: "PROCESSED",
          leadId,
          processingNotes: `Lead #${leadId} ${action} via universal webhook (source: ${source}, fields: ${fields.length})`,
          processingTimeMs: processingTime,
        });
      } catch (_) {}
    }

    res.status(200).json({
      success: true,
      leadId,
      action,
      source,
      fieldsCount: fields.length,
      score: scoreFinal ? { scoreFinal, scoreLabel } : null,
    });
  } catch (error: any) {
    console.error("[Webhook:Universal] Error:", error);
    if (logId) {
      try { await db.updateWebhookLog(logId, { status: "ERROR", errorMessage: error.message, processingTimeMs: Date.now() - startTime }); } catch (_) {}
    }
    res.status(200).json({ success: false, error: error.message || "Internal server error" });
  }
});

// ============================================================
// GET /api/webhook/health - comprehensive connectivity check
// ============================================================
webhookRouter.get("/api/webhook/health", async (_req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  try {
    const dbInstance = await db.getDb();
    const dbOk = !!dbInstance;
    res.json({
      status: dbOk ? "ok" : "degraded",
      database: dbOk ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
      endpoints: [
        "/api/webhook/lead",
        "/api/webhook/prospect",
        "/api/webhook/score",
        "/api/webhook/call-audit",
        "/api/webhook/universal",
      ],
    });
  } catch (err: any) {
    res.json({
      status: "degraded",
      database: "error",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/webhook/call-audit/ping
webhookRouter.get("/api/webhook/call-audit/ping", (_req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.json({ status: "ok", endpoint: "call-audit", timestamp: new Date().toISOString() });
});

// ============================================================
// GET /api/webhook/logs - View recent webhook logs
// ============================================================
webhookRouter.get("/api/webhook/logs", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await db.getWebhookLogs(Math.min(limit, 200));
    res.json({ success: true, logs, count: logs.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// WEBHOOK: POST /api/webhook/manychat
// Receives ManyChat webhook payloads for new subscribers and tag events.
// Syncs Instagram funnel leads into the CRM.
// ============================================================

const IG_FUNNEL_ORDER = [
  "NUEVO_SEGUIDOR",
  "DM_ENVIADO",
  "DM_VISTO",        // Cold DM System: MS (double-blue ✓✓ received)
  "EN_CONVERSACION",
  "CALIFICADO",
  "AGENDA_ENVIADA",
  "AGENDA_RESERVADA",
] as const;

type IgFunnelStage = (typeof IG_FUNNEL_ORDER)[number];

function igStageIndex(stage: string | null | undefined): number {
  if (!stage) return -1;
  return IG_FUNNEL_ORDER.indexOf(stage as IgFunnelStage);
}

const TAG_TO_STAGE: Record<string, IgFunnelStage> = {
  // Standard ManyChat tag → funnel stage mapping. ManyChat Flow Builder adds
  // these tags automatically when a setter moves a subscriber through the flow.
  dm_visto: "DM_VISTO",         // Optional — setter-fired tag for manual MS capture.
  mensaje_visto: "DM_VISTO",    // Alias.
  message_seen: "DM_VISTO",     // Alias (EN).
  calificado: "CALIFICADO",
  agenda_enviada: "AGENDA_ENVIADA",
  agenda_reservada: "AGENDA_RESERVADA",
};

webhookRouter.post("/api/webhook/manychat", async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const payloadStr = JSON.stringify(payload).substring(0, 10000);
    console.log(`[Webhook:ManyChat] Received:`, payloadStr.substring(0, 500));

    // Log the raw event (non-fatal if table doesn't exist yet)
    try {
      await db.createManychatEvent({
        eventType: payload.type || (payload.tag_name ? "tag_added" : "new_subscriber"),
        subscriberId: payload.subscriber_id || payload.id || null,
        rawPayload: payloadStr,
      });
    } catch (logErr: any) {
      console.error("[Webhook:ManyChat] Failed to log event (non-fatal):", logErr.message);
    }

    // --- DM SEEN EVENT (best-effort) ---
    // ManyChat does not have a first-class "message seen" webhook event, but
    // integrations sometimes forward it via External Request with type =
    // "message_seen" / "dm_seen" / "seen". If detected, we advance the lead to
    // DM_VISTO so MSR (Message Seen Rate) can be computed from lead state.
    // The setter-level igMensajesVistos counter is updated via the Rutina PM
    // fallback (Fase 3) — we don't touch it here to avoid double-counting.
    const seenEventTypes = ["message_seen", "dm_seen", "seen", "messaging_seen"];
    const payloadType = typeof payload.type === "string" ? payload.type.toLowerCase() : null;
    const isSeenEvent = payloadType && seenEventTypes.includes(payloadType);
    if (isSeenEvent) {
      const subscriberId = payload.subscriber_id || payload.id;
      if (!subscriberId) {
        console.error("[Webhook:ManyChat] dm_seen event missing subscriber_id");
        return res.status(200).json({ success: true, action: "no_subscriber_id" });
      }
      const lead = await db.findLeadByManychatId(String(subscriberId));
      if (!lead) {
        console.log(`[Webhook:ManyChat] dm_seen: no lead found for subscriber ${subscriberId}`);
        return res.status(200).json({ success: true, action: "lead_not_found" });
      }
      const currentIdx = igStageIndex(lead.igFunnelStage);
      const newIdx = igStageIndex("DM_VISTO");
      if (newIdx > currentIdx) {
        await db.updateLead(lead.id, { igFunnelStage: "DM_VISTO" });
        console.log(`[Webhook:ManyChat] Lead #${lead.id} advanced to DM_VISTO via ${payloadType} event`);
      }
      return res.status(200).json({ success: true, action: "dm_seen_processed", leadId: lead.id });
    }

    // --- TAG ADDED ---
    if (payload.tag_name) {
      const tagName = String(payload.tag_name).toLowerCase().trim();
      const newStage = TAG_TO_STAGE[tagName];

      if (!newStage) {
        console.log(`[Webhook:ManyChat] Unknown tag "${payload.tag_name}", ignoring.`);
        return res.status(200).json({ success: true, action: "tag_ignored" });
      }

      const subscriberId = payload.subscriber_id || payload.id;
      if (!subscriberId) {
        console.error("[Webhook:ManyChat] tag_added event missing subscriber_id");
        return res.status(200).json({ success: true, action: "no_subscriber_id" });
      }

      const lead = await db.findLeadByManychatId(String(subscriberId));
      if (!lead) {
        console.log(`[Webhook:ManyChat] No lead found for manychatSubscriberId=${subscriberId}`);
        return res.status(200).json({ success: true, action: "lead_not_found" });
      }

      const currentIndex = igStageIndex(lead.igFunnelStage);
      const newIndex = igStageIndex(newStage);

      if (newIndex > currentIndex) {
        await db.updateLead(lead.id, { igFunnelStage: newStage });
        console.log(`[Webhook:ManyChat] Lead #${lead.id} igFunnelStage: ${lead.igFunnelStage || "null"} -> ${newStage}`);
      } else {
        console.log(`[Webhook:ManyChat] Lead #${lead.id} already at ${lead.igFunnelStage}, skipping ${newStage}`);
      }

      return res.status(200).json({ success: true, action: "tag_processed", leadId: lead.id, stage: newStage });
    }

    // --- NEW SUBSCRIBER ---
    const subscriberId = payload.subscriber_id || payload.id;
    if (!subscriberId) {
      console.error("[Webhook:ManyChat] Payload missing subscriber_id");
      return res.status(200).json({ success: true, action: "no_subscriber_id" });
    }

    // Fetch full profile from ManyChat API
    const subscriber = await getSubscriberInfo(String(subscriberId));
    const igHandle = subscriber?.ig_username || payload.ig_username || null;
    const nombre = subscriber?.name || subscriber?.first_name || payload.name || null;
    const email = subscriber?.email || payload.email || null;
    const phone = subscriber?.phone || payload.phone || null;

    // --- Attribution from ManyChat ---
    // ManyChat can forward ad attribution in three places:
    //   1. payload.custom_fields (direct webhook setup in Flow Builder)
    //   2. subscriber.custom_fields (after hydrating profile from API)
    //   3. payload.ig_ref / payload.last_input_text (Instagram Ad-to-DM entry point)
    // We normalize all of them into standard utm_* fields.
    const rawCustomFields = (payload.custom_fields && typeof payload.custom_fields === "object")
      ? payload.custom_fields
      : (subscriber?.custom_fields && typeof subscriber.custom_fields === "object")
        ? subscriber.custom_fields
        : {};
    const customFields: Record<string, any> = {};
    // Normalize custom fields — ManyChat API returns either {name: value} or [{name, value}, ...]
    if (Array.isArray(rawCustomFields)) {
      for (const f of rawCustomFields) {
        if (f && typeof f === "object" && f.name) customFields[f.name] = f.value;
      }
    } else {
      Object.assign(customFields, rawCustomFields);
    }
    const igRef = payload.ig_ref || payload.entry_point || payload.last_input_text || (subscriber as any)?.ig_ref || null;
    const hasAdRef = !!igRef || !!customFields.last_ad_id || !!customFields.utm_source;

    const mcUtmSource = customFields.utm_source || (hasAdRef ? "instagram" : null);
    const mcUtmMedium = customFields.utm_medium || (hasAdRef ? "social" : null);
    const mcUtmCampaign = customFields.utm_campaign || customFields.campaign_name || null;
    const mcUtmContent = customFields.utm_content || customFields.last_ad_id || customFields.ad_id || null;
    const mcUtmTerm = customFields.utm_term || customFields.adset_id || customFields.adset_name || null;

    // Instagram ads append `fbclid` when the user taps the ad before entering the DM —
    // capture it so we can reconcile with Meta Ads data later.
    const mcFbclid = customFields.fbclid || customFields.fbc || null;
    const mcLandingUrl = customFields.landing_url || customFields.landingUrl || null;
    // ManyChat flows can set a `landing_slug` custom field when the DM was
    // triggered from a specific landing's ad — same precedence as the lead
    // webhook (explicit slug wins, URL derivation is the fallback).
    const mcLandingSlugRaw = customFields.landing_slug || customFields.landingSlug || null;
    const mcLandingSlug = resolveLandingSlug({ explicitSlug: mcLandingSlugRaw, landingUrl: mcLandingUrl });

    // Promote numeric IDs. ManyChat has an extra advantage here: `last_ad_id` /
    // `ad_id` / `adset_id` custom fields are ALREADY pure IDs when present, so
    // resolveMetaIdsFromUtm catches them regardless of whether they arrived via
    // utm_content or direct custom-field.
    const mcMetaIds = resolveMetaIdsFromUtm({
      utmCampaign: mcUtmCampaign,
      utmContent: mcUtmContent,
      utmTerm: mcUtmTerm,
    });

    if (mcUtmSource || mcUtmContent || igRef) {
      console.log(`[Webhook:ManyChat] Attribution captured: source=${mcUtmSource} content=${mcUtmContent} ref=${igRef ? "yes" : "no"}`);
    } else {
      console.log(`[Webhook:ManyChat] No attribution in payload or custom_fields`);
    }
    if (mcMetaIds.metaAdId || mcMetaIds.metaCampaignId || mcMetaIds.metaAdsetId) {
      console.log(`[Webhook:ManyChat] Meta IDs resolved -> ad: ${mcMetaIds.metaAdId ?? "—"} | adset: ${mcMetaIds.metaAdsetId ?? "—"} | campaign: ${mcMetaIds.metaCampaignId ?? "—"}`);
    }

    // Try to find existing lead by instagram handle
    let lead: any = null;
    if (igHandle) {
      lead = await db.findLeadByInstagram(igHandle);
    }

    if (lead) {
      // Update existing lead with ManyChat subscriber ID
      const updateData: Record<string, any> = {
        manychatSubscriberId: String(subscriberId),
      };

      // Only advance igFunnelStage if not already further
      const currentIndex = igStageIndex(lead.igFunnelStage);
      const newIndex = igStageIndex("NUEVO_SEGUIDOR");
      if (newIndex > currentIndex) {
        updateData.igFunnelStage = "NUEVO_SEGUIDOR";
      }

      // Fill in missing fields
      if (nombre && !lead.nombre) updateData.nombre = nombre;
      if (email && !lead.correo) updateData.correo = email;
      if (phone && !lead.telefono) updateData.telefono = phone;

      // Backfill attribution only if the lead doesn't have it yet (never overwrite a known-good source)
      if (mcUtmSource && !lead.utmSource) updateData.utmSource = mcUtmSource;
      if (mcUtmMedium && !lead.utmMedium) updateData.utmMedium = mcUtmMedium;
      if (mcUtmCampaign && !lead.utmCampaign) updateData.utmCampaign = mcUtmCampaign;
      if (mcUtmContent && !lead.utmContent) updateData.utmContent = mcUtmContent;
      if (mcUtmTerm && !lead.utmTerm) updateData.utmTerm = mcUtmTerm;
      if (mcFbclid && !(lead as any).fbclid) updateData.fbclid = mcFbclid;
      if (mcLandingUrl && !(lead as any).landingUrl) updateData.landingUrl = mcLandingUrl;
      if (mcLandingSlug && !(lead as any).landingSlug) updateData.landingSlug = mcLandingSlug;
      // Meta-resolved IDs: backfill only if empty.
      if (mcMetaIds.metaAdId && !(lead as any).metaAdId) updateData.metaAdId = mcMetaIds.metaAdId;
      if (mcMetaIds.metaAdsetId && !(lead as any).metaAdsetId) updateData.metaAdsetId = mcMetaIds.metaAdsetId;
      if (mcMetaIds.metaCampaignId && !(lead as any).metaCampaignId) updateData.metaCampaignId = mcMetaIds.metaCampaignId;

      await db.updateLead(lead.id, updateData);
      console.log(`[Webhook:ManyChat] Updated existing lead #${lead.id} with manychatSubscriberId=${subscriberId}`);
    } else {
      // Create new lead (createLead returns the numeric id)
      // Origen stays INSTAGRAM — that's how we differentiate IG-DM leads from direct ad clicks.
      // The UTMs let us drill into WHICH ad drove the DM within the Instagram funnel.
      const newLeadId = await db.createLead({
        nombre: nombre || igHandle || `MC-${subscriberId}`,
        correo: email || null,
        telefono: phone || null,
        instagram: igHandle || null,
        origen: "INSTAGRAM",
        estadoLead: "NUEVO",
        igFunnelStage: "NUEVO_SEGUIDOR",
        categoria: "LEAD",
        manychatSubscriberId: String(subscriberId),
        ...(mcUtmSource ? { utmSource: mcUtmSource } : {}),
        ...(mcUtmMedium ? { utmMedium: mcUtmMedium } : {}),
        ...(mcUtmCampaign ? { utmCampaign: mcUtmCampaign } : {}),
        ...(mcUtmContent ? { utmContent: mcUtmContent } : {}),
        ...(mcUtmTerm ? { utmTerm: mcUtmTerm } : {}),
        ...(mcFbclid ? { fbclid: mcFbclid } : {}),
        ...(mcLandingUrl ? { landingUrl: mcLandingUrl } : {}),
        ...(mcLandingSlug ? { landingSlug: mcLandingSlug } : {}),
        ...mcMetaIds,
      } as any);

      lead = { id: newLeadId };
      console.log(`[Webhook:ManyChat] Created new lead #${newLeadId} from ManyChat subscriber ${subscriberId}`);
    }

    // Store CRM lead ID back in ManyChat custom field
    if (lead?.id && ENV.manychatCrmFieldId) {
      try {
        await setCustomField(
          String(subscriberId),
          parseInt(ENV.manychatCrmFieldId, 10),
          String(lead.id),
        );
        console.log(`[Webhook:ManyChat] Stored CRM lead #${lead.id} in ManyChat custom field`);
      } catch (cfErr: any) {
        console.error(`[Webhook:ManyChat] Failed to set custom field (non-fatal):`, cfErr.message);
      }
    }

    return res.status(200).json({ success: true, action: "subscriber_processed", leadId: lead?.id });
  } catch (err: any) {
    console.error("[Webhook:ManyChat] Unhandled error:", err.message, err.stack);
    return res.status(200).json({ success: true, error: "internal_error" });
  }
});

// ============================================================
// WEBHOOK: POST /api/webhook/stripe
// Verifies the Stripe signature (using the raw body captured by
// express.json verify callback), logs the event, and dispatches by type.
// All handlers are idempotent — Stripe retries until we 2xx.
// ============================================================

webhookRouter.post("/api/webhook/stripe", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  if (!isStripeConfigured()) {
    console.warn("[Webhook:Stripe] Received event but STRIPE_SECRET_KEY is not configured");
    return res.status(200).json({ received: true, skipped: true, reason: "not_configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    console.error("[Webhook:Stripe] Missing Stripe-Signature header");
    return res.status(400).send("Missing signature");
  }

  // The raw body was captured during express.json()'s verify callback
  // (see server/_core/index.ts). Signature verification needs the exact bytes.
  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (!rawBody) {
    console.error("[Webhook:Stripe] Raw body missing — verify callback not wired correctly");
    return res.status(400).send("Raw body missing");
  }

  let event: Stripe.Event;
  try {
    event = stripeVerifySignature(rawBody, signature);
  } catch (err: any) {
    console.error("[Webhook:Stripe] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }

  // Idempotent logging — if we've seen this event.id before, skip the handler.
  let logId = 0;
  try {
    const result = await db.createStripeWebhookLog({
      eventId: event.id,
      eventType: event.type,
      status: "received",
      rawPayload: JSON.stringify(event).substring(0, 100_000),
    });
    logId = result.id;
    if (!result.isNew) {
      console.log(`[Webhook:Stripe] Duplicate event ${event.id} (${event.type}) — skipping handler`);
      return res.status(200).json({ received: true, duplicate: true });
    }
  } catch (err: any) {
    console.error("[Webhook:Stripe] Failed to create log (non-fatal):", err.message);
  }

  try {
    await handleStripeEvent(event);
    if (logId) {
      await db.updateStripeWebhookLog(logId, {
        status: "processed",
        processingTimeMs: Date.now() - startedAt,
      });
    }
    return res.status(200).json({ received: true, handled: event.type });
  } catch (err: any) {
    console.error(`[Webhook:Stripe] Handler error for ${event.type}:`, err.message, err.stack);
    if (logId) {
      await db.updateStripeWebhookLog(logId, {
        status: "error",
        errorMessage: err.message?.substring(0, 1000) ?? "unknown",
        processingTimeMs: Date.now() - startedAt,
      });
    }
    // Return 200 so Stripe doesn't retry forever for permanent failures,
    // but the log keeps a record so we can manually reprocess.
    return res.status(200).json({ received: true, error: "handler_failed" });
  }
});

/**
 * Route a Stripe event to the right upsert logic. We only care about events
 * that affect payment state — everything else (customer.created, product.updated, etc.)
 * is ignored silently so the log still records we saw it.
 */
async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const parsed = await parseCheckoutSession(session);
      if (!parsed) {
        console.log(`[Webhook:Stripe] checkout.session.completed ${session.id} has no charge yet — skipping`);
        return;
      }
      const { id } = await db.upsertStripePayment(parsed);
      await db.attemptStripeAutoMatch(id);
      console.log(`[Webhook:Stripe] Checkout ${session.id} upserted as payment #${id}`);
      return;
    }

    case "charge.succeeded":
    case "charge.updated":
    case "charge.refunded":
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      // charge.dispute.* objects are Dispute, not Charge — fetch the related charge.
      let charge: Stripe.Charge;
      if (event.type.startsWith("charge.dispute.")) {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
        const client = (await import("./stripe")).getStripeClient();
        charge = await client.charges.retrieve(chargeId);
      } else {
        charge = event.data.object as Stripe.Charge;
      }
      const parsed = parseCharge(charge);
      const { id } = await db.upsertStripePayment(parsed);
      await db.attemptStripeAutoMatch(id);
      console.log(`[Webhook:Stripe] ${event.type} ${charge.id} upserted as payment #${id} status=${parsed.status}`);
      return;
    }

    case "payment_intent.succeeded": {
      // Already handled by the follow-up charge.succeeded, but if the PI was
      // confirmed without an immediate charge webhook (rare), we back-reference
      // the latest_charge here.
      const pi = event.data.object as Stripe.PaymentIntent;
      const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
      if (!chargeId) return;
      const client = (await import("./stripe")).getStripeClient();
      const charge = await client.charges.retrieve(chargeId);
      const parsed = parseCharge(charge);
      const { id } = await db.upsertStripePayment(parsed);
      await db.attemptStripeAutoMatch(id);
      console.log(`[Webhook:Stripe] payment_intent.succeeded ${pi.id} upserted as payment #${id}`);
      return;
    }

    default:
      // Not an error — we intentionally accept and ignore events we don't care about.
      console.log(`[Webhook:Stripe] Ignored event type ${event.type}`);
  }
}

export { webhookRouter };
