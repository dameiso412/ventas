/**
 * Slack Interactivity endpoint — receives button clicks from Slack and
 * actuates on the CRM (mark contacted, assign lead, no-show, snooze).
 *
 * Architecture:
 *   1. Slack POSTs application/x-www-form-urlencoded with field `payload`
 *      to /api/slack/interactive when the user clicks an action button.
 *   2. We verify the HMAC signature (Slack signs the raw body with our
 *      Signing Secret). Reject if mismatch or timestamp >5 min old (replay
 *      protection).
 *   3. ack() with HTTP 200 in <3s (Slack timeout) — process the action async
 *      AFTER the response.
 *   4. Resolve the Slack user → CRM user via Slack API (users.info) and
 *      match by email against `team_members`.
 *   5. Dispatch the action (lead_contactado, lead_asignar, agenda_no_show,
 *      snooze) to an idempotent handler.
 *   6. Update the original Slack message via response_url with a clean
 *      "✅ Procesado por X · 14:32" status block, removing the action
 *      buttons so it can't be re-clicked.
 *   7. Log every click in slack_actions_log for audit + debug.
 *
 * Setup runbook for the Slack App: docs/slack-app-setup.md
 */
import { Router } from "express";
import crypto from "node:crypto";
import { ENV } from "./_core/env";
import * as db from "./db";

export const slackRouter = Router();

// In-memory cache for Slack user → email lookups. 5 min TTL — short enough
// that a permission revoke takes effect quickly; long enough to avoid
// hitting Slack API on every click during a busy alert burst.
const userCache = new Map<string, { email: string; name: string; cachedAt: number }>();
const USER_CACHE_TTL_MS = 5 * 60 * 1000;

// Action ID format: `${accion}:${targetId}` (e.g. "lead_contactado:1234")
// or `${accion}:${alertKey}:${minutes}` for snoozes (e.g. "snooze:speed-to-lead:60").
type ParsedAction = {
  accion: string;
  targetId?: number;
  alertKey?: string;
  minutes?: number;
};

function parseActionId(actionId: string): ParsedAction {
  const [accion, ...rest] = actionId.split(":");
  if (accion === "snooze") {
    return { accion, alertKey: rest[0], minutes: parseInt(rest[1] ?? "60", 10) };
  }
  return { accion, targetId: rest[0] ? parseInt(rest[0], 10) : undefined };
}

// ─── HMAC signature verification ──────────────────────────────

/**
 * Slack signs every interactive POST with HMAC-SHA256 over
 *   `v0:{X-Slack-Request-Timestamp}:{raw_body}`
 * keyed with our Signing Secret. We rebuild the signature and compare with
 * timing-safe equality. Without this anyone could POST fake button clicks
 * and act on the CRM.
 */
function verifyHmac(
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!timestamp || !signature || !secret) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const expected = "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");
  // Both buffers must be the same length for timingSafeEqual; if not it
  // throws. Compare lengths first to fail-safe.
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ─── Slack user resolution ────────────────────────────────────

interface ResolvedUser {
  slackUserId: string;
  slackUserName: string;
  email: string;
  crmUserName: string;
  isAuthorized: boolean;
}

async function resolveSlackUser(slackUserId: string, slackDisplayName: string | undefined): Promise<ResolvedUser> {
  if (!ENV.slackBotToken) {
    return {
      slackUserId,
      slackUserName: slackDisplayName ?? slackUserId,
      email: "",
      crmUserName: slackDisplayName ?? slackUserId,
      isAuthorized: false,
    };
  }

  // Cache hit
  const cached = userCache.get(slackUserId);
  if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL_MS) {
    const member = await db.findTeamMemberByEmail(cached.email);
    return {
      slackUserId,
      slackUserName: cached.name,
      email: cached.email,
      crmUserName: member?.nombre ?? cached.name,
      isAuthorized: !!member,
    };
  }

  // Fetch from Slack
  try {
    const res = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
      headers: { Authorization: `Bearer ${ENV.slackBotToken}` },
    });
    const data = await res.json() as any;
    const profile = data?.user?.profile;
    const email: string = profile?.email ?? "";
    const name: string = profile?.real_name ?? profile?.display_name ?? slackDisplayName ?? slackUserId;

    if (email) {
      userCache.set(slackUserId, { email, name, cachedAt: Date.now() });
    }

    const member = email ? await db.findTeamMemberByEmail(email) : null;
    return {
      slackUserId,
      slackUserName: name,
      email,
      crmUserName: member?.nombre ?? name,
      isAuthorized: !!member,
    };
  } catch (err) {
    console.error("[Slack:Interactive] users.info failed:", err);
    return {
      slackUserId,
      slackUserName: slackDisplayName ?? slackUserId,
      email: "",
      crmUserName: slackDisplayName ?? slackUserId,
      isAuthorized: false,
    };
  }
}

// ─── Action handlers (all idempotent) ─────────────────────────

interface HandlerContext {
  user: ResolvedUser;
  responseUrl: string;
  payload: any;
  action: ParsedAction;
}

async function handleLeadContactado(ctx: HandlerContext): Promise<{ message: string; targetType: string; targetId?: number }> {
  const leadId = ctx.action.targetId;
  if (!leadId) throw new Error("leadId requerido");

  // Idempotencia: si ya hay un contact_attempt en los últimos 5 min para
  // este lead, no creamos otro. Cubre doble-click + clicks simultáneos.
  const recent = await db.getRecentContactAttempts(leadId, 5);
  if (recent.length === 0) {
    await db.createContactAttempt({
      leadId,
      timestamp: new Date(),
      canal: "OTRO",
      resultado: "MENSAJE ENVIADO",
      realizadoPor: ctx.user.crmUserName,
      notas: `Marcado como contactado desde Slack por ${ctx.user.crmUserName}`,
    });
    await db.updateLead(leadId, { resultadoContacto: "CONTESTÓ" } as any);
  }

  return {
    message: `✅ *Contactado* por ${ctx.user.crmUserName} · ${nowLabel()}`,
    targetType: "lead",
    targetId: leadId,
  };
}

async function handleLeadAsignar(ctx: HandlerContext): Promise<{ message: string; targetType: string; targetId?: number }> {
  const leadId = ctx.action.targetId;
  if (!leadId) throw new Error("leadId requerido");

  // Solo asignamos si el lead no tiene setter ya. Si lo tiene, mostramos
  // mensaje informativo en lugar de pisar la asignación previa.
  const lead = await db.getLeadById(leadId);
  if (lead?.setterAsignado && lead.setterAsignado !== ctx.user.crmUserName) {
    return {
      message: `ℹ️ Este lead ya estaba asignado a *${lead.setterAsignado}*. No se reasignó.`,
      targetType: "lead",
      targetId: leadId,
    };
  }

  if (lead?.setterAsignado !== ctx.user.crmUserName) {
    await db.updateLead(leadId, { setterAsignado: ctx.user.crmUserName } as any);
  }

  return {
    message: `👤 *Asignado a ${ctx.user.crmUserName}* · ${nowLabel()}`,
    targetType: "lead",
    targetId: leadId,
  };
}

async function handleAgendaNoShow(ctx: HandlerContext): Promise<{ message: string; targetType: string; targetId?: number }> {
  const leadId = ctx.action.targetId;
  if (!leadId) throw new Error("leadId requerido");

  // Idempotencia: si ya existe un follow-up RED_HOT para este lead reciente
  // (creado en la última hora), no creamos otro.
  const lead = await db.getLeadById(leadId);
  if (lead?.asistencia === "NO SHOW") {
    return {
      message: `ℹ️ Este lead ya estaba marcado como NO SHOW.`,
      targetType: "lead",
      targetId: leadId,
    };
  }

  await db.updateLead(leadId, { asistencia: "NO SHOW" } as any);
  await db.createFollowUpFromNoShow(leadId, ctx.user.crmUserName, `Marcado NO SHOW desde Slack por ${ctx.user.crmUserName}`);

  return {
    message: `🚫 *NO SHOW* marcado por ${ctx.user.crmUserName} · ${nowLabel()}\nFollow-up RED_HOT creado.`,
    targetType: "lead",
    targetId: leadId,
  };
}

async function handleSnooze(ctx: HandlerContext): Promise<{ message: string; targetType: string; targetId?: number }> {
  const alertKey = ctx.action.alertKey;
  const minutes = ctx.action.minutes ?? 60;
  if (!alertKey) throw new Error("alertKey requerido");

  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
  await db.createSlackSnooze({
    alertKey,
    expiresAt,
    snoozedBySlackUserId: ctx.user.slackUserId,
    snoozedByEmail: ctx.user.email,
    snoozedByName: ctx.user.crmUserName,
  });

  return {
    message: `🔇 *Alertas "${alertKey}" silenciadas ${minutes} min* por ${ctx.user.crmUserName} · vuelven a las ${expiresLabel(expiresAt)}`,
    targetType: "alert_key",
  };
}

const HANDLERS: Record<string, (ctx: HandlerContext) => Promise<{ message: string; targetType: string; targetId?: number }>> = {
  lead_contactado: handleLeadContactado,
  lead_asignar: handleLeadAsignar,
  agenda_no_show: handleAgendaNoShow,
  snooze: handleSnooze,
};

// ─── Slack message updates ────────────────────────────────────

/**
 * Replace the original Slack message after an action. We append a context
 * block with the status line ("✅ Contactado por X · 14:32") and remove the
 * actions block so the buttons can't be re-clicked.
 *
 * Slack accepts blocks shorter or longer than the original — we keep all
 * non-actions blocks from the original message and tack on the status.
 */
async function updateSlackMessage(responseUrl: string, originalMessage: any, statusLine: string) {
  const originalBlocks: any[] = Array.isArray(originalMessage?.blocks) ? originalMessage.blocks : [];
  // Strip the actions block (and its preceding divider, if it exists right before)
  const filtered: any[] = [];
  for (let i = 0; i < originalBlocks.length; i++) {
    const block = originalBlocks[i];
    if (block?.type === "actions") {
      // Also drop the divider that precedes the actions block (visual artifact)
      if (filtered.length > 0 && filtered[filtered.length - 1]?.type === "divider") {
        filtered.pop();
      }
      continue;
    }
    filtered.push(block);
  }

  // Append status as a context block (compact, distinct from body sections).
  filtered.push({ type: "divider" });
  filtered.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: statusLine }],
  });

  try {
    const res = await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace_original: true,
        blocks: filtered,
        // Plain-text fallback for notifications
        text: statusLine.replace(/[*_`]/g, ""),
      }),
    });
    if (!res.ok) {
      console.error(`[Slack:Interactive] update failed HTTP ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[Slack:Interactive] update fetch error:", err);
  }
}

async function sendEphemeralReply(responseUrl: string, text: string) {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "ephemeral",
        replace_original: false,
        text,
      }),
    });
  } catch (err) {
    console.error("[Slack:Interactive] ephemeral fetch error:", err);
  }
}

// ─── Main dispatcher ──────────────────────────────────────────

async function handleInteraction(payload: any, startedAt: number) {
  if (payload?.type !== "block_actions") return;
  const action = payload.actions?.[0];
  if (!action) return;

  const actionId = String(action.action_id ?? "");
  const responseUrl: string = payload.response_url;
  const slackUserId: string = payload?.user?.id ?? "";
  const slackDisplayName: string | undefined = payload?.user?.name ?? payload?.user?.username;

  const parsed = parseActionId(actionId);
  const handler = HANDLERS[parsed.accion];

  // Auth: resolver Slack user → CRM user. Fail clean si no es authorized.
  const user = await resolveSlackUser(slackUserId, slackDisplayName);

  if (!handler) {
    console.warn("[Slack:Interactive] Acción desconocida:", actionId);
    await sendEphemeralReply(responseUrl, `❌ Acción no reconocida: \`${actionId}\``);
    await logAction({
      actionId, payload, user, parsed,
      result: "error",
      errorMessage: "Acción desconocida",
      startedAt,
    });
    return;
  }

  if (!user.isAuthorized) {
    const reason = user.email
      ? `Tu correo Slack (${user.email}) no está en team_members del CRM. Pedile a un admin que te agregue en /admin/equipo con ese mismo correo.`
      : "No pude leer tu correo de Slack (token o permisos faltantes). Avisá al admin.";
    await sendEphemeralReply(responseUrl, `❌ ${reason}`);
    await logAction({
      actionId, payload, user, parsed,
      result: "unauthorized",
      errorMessage: reason,
      startedAt,
    });
    return;
  }

  // Run the handler
  try {
    const result = await handler({ user, responseUrl, payload, action: parsed });
    await updateSlackMessage(responseUrl, payload.message, result.message);
    await logAction({
      actionId, payload, user, parsed,
      targetType: result.targetType,
      targetId: result.targetId,
      result: "success",
      startedAt,
    });
  } catch (err: any) {
    console.error(`[Slack:Interactive] Handler "${parsed.accion}" error:`, err);
    await sendEphemeralReply(responseUrl, `❌ Error procesando la acción: ${err.message ?? "desconocido"}`);
    await logAction({
      actionId, payload, user, parsed,
      result: "error",
      errorMessage: err.message ?? "unknown error",
      startedAt,
    });
  }
}

async function logAction(args: {
  actionId: string;
  payload: any;
  user: ResolvedUser;
  parsed: ParsedAction;
  targetType?: string;
  targetId?: number;
  result: string;
  errorMessage?: string;
  startedAt: number;
}) {
  try {
    await db.createSlackActionLog({
      actionId: args.actionId,
      targetType: args.targetType ?? (args.parsed.targetId ? "lead" : args.parsed.alertKey ? "alert_key" : null),
      targetId: args.targetId ?? args.parsed.targetId ?? null,
      slackUserId: args.user.slackUserId,
      slackUserName: args.user.slackUserName,
      crmUserEmail: args.user.email || null,
      crmUserName: args.user.crmUserName,
      result: args.result,
      errorMessage: args.errorMessage ?? null,
      rawPayload: args.payload,
      processingTimeMs: Date.now() - args.startedAt,
    });
  } catch (err) {
    // Audit log failure is not user-visible. Log to console and move on.
    console.error("[Slack:Interactive] Failed to write audit log:", err);
  }
}

function nowLabel(): string {
  return new Date().toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function expiresLabel(d: Date): string {
  return d.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Express route ────────────────────────────────────────────

slackRouter.post("/api/slack/interactive", async (req, res) => {
  const startedAt = Date.now();
  // The global urlencoded parser already populated req.body. We need the
  // raw body too for HMAC verification — that's preserved on req.rawBody
  // by the `verify` callback on express.urlencoded() in _core/index.ts.
  const rawBody = (req as any).rawBody?.toString("utf8") ?? "";

  if (!ENV.slackSigningSecret || !ENV.slackBotToken) {
    console.warn("[Slack:Interactive] Faltan SLACK_SIGNING_SECRET o SLACK_BOT_TOKEN — endpoint deshabilitado.");
    res.status(503).send("Slack interactivity not configured. See docs/slack-app-setup.md");
    return;
  }

  const ts = req.header("X-Slack-Request-Timestamp");
  const sig = req.header("X-Slack-Signature");

  if (!verifyHmac(rawBody, ts, sig, ENV.slackSigningSecret)) {
    res.status(401).send("Invalid signature");
    return;
  }

  // Replay protection: rechazar requests >5 min viejos (clock-skew tolerance).
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    res.status(401).send("Stale request");
    return;
  }

  // Parse payload
  let payload: any;
  try {
    payload = JSON.parse((req.body as any)?.payload ?? "{}");
  } catch (err) {
    console.error("[Slack:Interactive] Invalid JSON payload:", err);
    res.status(400).send("Invalid payload");
    return;
  }

  // ack en <3s. Slack timeout-ea si no, mostrando error visual al usuario
  // aunque el backend procese OK. Por eso ack primero, action async después.
  res.status(200).send("");

  // Procesamiento async — no bloquea el ack.
  handleInteraction(payload, startedAt).catch((err) => {
    console.error("[Slack:Interactive] Unhandled handler error:", err);
  });
});
