/**
 * KPI Pulse Monitor — Heartbeats automáticos con alertas Slack
 *
 * Timers:
 *   - Pulse checks every 15 min (speed-to-lead, unassigned, stale, confirmations, follow-ups, overdue, smart alerts)
 *   - Hourly summary (only if there's activity)
 *   - Daily report at 8 AM Chile (once per day)
 *   - EOD Setter/Closer tracker at 6 PM Chile (once per day)
 *   - Team digest every 3 days at 9 AM Chile
 *   - Weekly AI diagnostic Monday 9 AM Chile
 *
 * Dedup: content-hash based — same alert is NEVER repeated unless the data changes.
 */
import Anthropic from "@anthropic-ai/sdk";
import * as db from "./db";
import { sendSlackMessage, sendSlackAlert, isSlackConfigured, crmUrls } from "./_core/slack";
import { ENV } from "./_core/env";

// ─── Intervals ───────────────────────────────────────────────
const PULSE_INTERVAL_MS = 15 * 60 * 1000;   // 15 min
const HOURLY_INTERVAL_MS = 60 * 60 * 1000;  // 60 min
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

let pulseTimer: ReturnType<typeof setInterval> | null = null;
let hourlyTimer: ReturnType<typeof setInterval> | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

let lastDailyDate: string | null = null;   // "YYYY-MM-DD"
let lastEodDate: string | null = null;     // "YYYY-MM-DD"
let lastTeamDigestDate: string | null = null;
let lastWeeklyDiagDate: string | null = null;
let lastFollowUpHeadsUpDate: string | null = null;

// ─── Content-Hash Dedup + Time-Based Throttle (anti-spam v2) ────────────────
//
// El dedup original era solo por content-hash — basta que UN lead entre/salga
// del set para que el hash cambie y la alerta refire en el próximo pulse
// (cada 15 min). Eso producía spam: backlog de 57 leads sin contactar →
// 50/49/48/47 → 4 alertas en 1 hora.
//
// Anti-spam v2 agrega un `minIntervalMs` por alerta:
//   - Si el content NO cambió, no refire (igual que antes).
//   - Si el content CAMBIÓ pero `minIntervalMs` no pasó desde el último envío,
//     suprime — la siguiente notificación sale cuando se cumpla el intervalo.
//   - Si el content cambió Y pasó el intervalo, fire.
//
// Política por severidad:
//   critical → 1h     (speed-to-lead, confirm-1h, smart-alerts)
//   warning  → 6h     (unassigned, overdue-attendance, confirm-4h, followups)
//   info     → 24h    (confirm-24h, followups-hoy: 1 vez al día max)
//
// Algunos warnings tienen MIN_COUNT — skip cuando count < threshold porque
// 1-2 casos aislados no justifican notif al canal.
const dedup = new Map<string, { sentAt: number; contentHash: string }>();

const THROTTLE = {
  CRITICAL_MS: 1 * 60 * 60 * 1000,   // 1h
  WARNING_MS: 6 * 60 * 60 * 1000,    // 6h
  INFO_MS: 24 * 60 * 60 * 1000,      // 24h
};

function computeHash(ids: number[]): string {
  return ids.sort((a, b) => a - b).join(",");
}

/**
 * @param minIntervalMs Mínimo tiempo entre re-envíos de la misma key (incluso
 *                      si el contenido cambió). Default 0 = sin throttle.
 */
function shouldSend(key: string, contentHash: string, minIntervalMs = 0): boolean {
  const prev = dedup.get(key);
  if (!prev) return true;
  if (prev.contentHash === contentHash) return false;
  if (minIntervalMs > 0 && Date.now() - prev.sentAt < minIntervalMs) return false;
  return true;
}

function markSent(key: string, contentHash: string): void {
  dedup.set(key, { sentAt: Date.now(), contentHash });
}

/** Purge entries older than 48h (was 24h — necesitamos preservar el sentAt
 *  para que el throttling de 24h funcione correctamente). */
function cleanupDedup() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const keys = Array.from(dedup.keys());
  for (const key of keys) {
    const val = dedup.get(key);
    if (val && val.sentAt < cutoff) dedup.delete(key);
  }
}

// ─── Chile timezone helpers ─────────────────────────────────
function getChileDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

function getChileHour(): number {
  return parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      hour12: false,
    })
  );
}

function getChileDayOfWeek(): number {
  const d = new Date().toLocaleDateString("en-US", { timeZone: "America/Santiago", weekday: "short" });
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[d] ?? 0;
}

function getChileDateNumber(): number {
  return parseInt(
    new Date().toLocaleDateString("en-US", { timeZone: "America/Santiago", day: "numeric" })
  );
}

function getCurrentMes(): string {
  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const monthIdx = parseInt(
    new Date().toLocaleDateString("en-US", { timeZone: "America/Santiago", month: "numeric" })
  ) - 1;
  return MESES[monthIdx];
}

// ─── Pulse Checks (every 15 min) ────────────────────────────
async function runPulseCheck() {
  try {
    // 1. Speed to Lead — leads >30 min sin contactar
    // Critical pero throttled a 1h: el backlog cambia constantemente (57→55→52)
    // y un alert por cada delta sería spam. 1h le da tiempo al equipo a
    // procesar antes del siguiente recordatorio.
    const stl = await db.getSpeedToLeadAlerts(30);
    if (stl.length >= 3) {
      const hash = computeHash(stl.map((l) => l.id));
      if (shouldSend("speed-to-lead", hash, THROTTLE.CRITICAL_MS)) {
        await sendSlackAlert({
          severity: "critical",
          title: `${stl.length} lead${stl.length === 1 ? "" : "s"} sin contactar hace +30 min`,
          body: "Cada minuto perdido cae el contact rate. Revisá la cola de trabajo y contactá ya.",
          items: stl.map((l) => ({
            text: `• *${l.nombre || "Sin nombre"}* — ${l.minutesSinceCreated} min (setter: ${l.setterAsignado || "_sin asignar_"})`,
            actionUrl: crmUrls.lead(l.id),
            actionLabel: "Abrir lead",
          })),
          itemsTruncatedActionUrl: crmUrls.colaTrabajo(),
          itemsTruncatedActionLabel: "Ver cola completa",
          actions: [
            { label: "Abrir cola de trabajo", url: crmUrls.colaTrabajo(), emoji: "📋", style: "primary" },
          ],
        });
        markSent("speed-to-lead", hash);
      }
    }

    // 2. Leads sin setter asignado — warning, throttled 6h.
    // Skip si <3 (1-2 casos no justifican alert al canal).
    const unassigned = await db.getUnassignedLeads();
    if (unassigned.length >= 3) {
      const hash = computeHash(unassigned.map((l) => l.id));
      if (shouldSend("unassigned", hash, THROTTLE.WARNING_MS)) {
        await sendSlackAlert({
          severity: "warning",
          title: `${unassigned.length} lead${unassigned.length === 1 ? "" : "s"} sin setter asignado`,
          body: "Activá el round-robin o asigná manualmente para que nadie quede huérfano.",
          items: unassigned.map((l) => ({
            text: `• *${l.nombre || l.correo || "ID " + l.id}*`,
            actionUrl: crmUrls.lead(l.id),
            actionLabel: "Asignar",
          })),
          itemsTruncatedActionUrl: crmUrls.colaTrabajo(),
          itemsTruncatedActionLabel: "Ver todos",
          actions: [
            { label: "Configurar Round-Robin", url: crmUrls.roundRobin(), emoji: "🔀", style: "primary" },
            { label: "Cola de trabajo", url: crmUrls.colaTrabajo(), emoji: "📋" },
          ],
        });
        markSent("unassigned", hash);
      }
    }

    // 3. Seguimientos estancados (>72h sin update) — warning, throttled 6h.
    // Skip si <3 (lista corta es trivial de revisar manualmente).
    const stale = await db.getStaleSeguimientos(72);
    if (stale.length >= 3) {
      const hash = computeHash(stale.map((l) => l.id));
      if (shouldSend("stale-seguimiento", hash, THROTTLE.WARNING_MS)) {
        await sendSlackAlert({
          severity: "warning",
          title: `${stale.length} seguimiento${stale.length === 1 ? "" : "s"} estancado${stale.length === 1 ? "" : "s"} (+72h)`,
          body: "Estos leads quedaron en SEGUIMIENTO sin movimiento por más de 3 días.",
          items: stale.map((l) => ({
            text: `• *${l.nombre || "ID " + l.id}* — closer: ${l.closer || "_N/A_"}`,
            actionUrl: crmUrls.lead(l.id),
            actionLabel: "Abrir",
          })),
          itemsTruncatedActionUrl: crmUrls.followUps(),
        });
        markSent("stale-seguimiento", hash);
      }
    }

    // 4. Citas vencidas sin registrar asistencia — warning, throttled 6h.
    const overdue = await db.getOverdueAppointments();
    if (overdue.length >= 2) {
      const hash = computeHash(overdue.map((l) => l.id));
      if (shouldSend("overdue-attendance", hash, THROTTLE.WARNING_MS)) {
        await sendSlackAlert({
          severity: "warning",
          title: `${overdue.length} cita${overdue.length === 1 ? "" : "s"} sin registrar asistencia`,
          body: "Closer: registrá ASISTIÓ / NO SHOW para que el funnel quede limpio.",
          items: overdue.map((l) => {
            const time = l.fecha ? new Date(l.fecha).toLocaleString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }) : "?";
            return {
              text: `• *${l.nombre || l.correo || "ID " + l.id}* — cita a las ${time} (closer: ${l.closer || "_N/A_"})`,
              actionUrl: crmUrls.lead(l.id),
              actionLabel: "Marcar",
            };
          }),
          itemsTruncatedActionUrl: crmUrls.citas(),
          actions: [
            { label: "Ir a Citas", url: crmUrls.citas(), emoji: "📅" },
          ],
        });
        markSent("overdue-attendance", hash);
      }
    }

    // 5. Confirmaciones escalonadas (T-1h, T-4h, T-24h)
    const confirmations = await db.getEscalatedConfirmations();

    if (confirmations.within1h.length > 0) {
      // Critical pero throttled a 1h: si en 1h sigue sin confirmar, refire.
      const hash = computeHash(confirmations.within1h.map((l) => l.id));
      if (shouldSend("confirm-1h", hash, THROTTLE.CRITICAL_MS)) {
        await sendSlackAlert({
          severity: "critical",
          title: `${confirmations.within1h.length} cita${confirmations.within1h.length === 1 ? "" : "s"} en <1h SIN confirmar`,
          body: "Última oportunidad antes del horario. Llamá YA.",
          emoji: "⏰",
          items: confirmations.within1h.map((l) => ({
            text: `• *${l.nombre || "ID " + l.id}* — setter: ${l.setter || "_N/A_"}`,
            actionUrl: crmUrls.lead(l.id),
            actionLabel: "Confirmar",
          })),
          itemsTruncatedActionUrl: crmUrls.confirmaciones(),
          actions: [
            { label: "Abrir Confirmaciones", url: crmUrls.confirmaciones(), emoji: "🚨", style: "danger" },
          ],
        });
        markSent("confirm-1h", hash);
      }
    }

    if (confirmations.within4h.length >= 2) {
      // Warning, throttled 6h. <2 casos no spamea — el confirm-1h cubrirá
      // cuando se acerque la cita.
      const hash = computeHash(confirmations.within4h.map((l) => l.id));
      if (shouldSend("confirm-4h", hash, THROTTLE.WARNING_MS)) {
        await sendSlackAlert({
          severity: "warning",
          title: `${confirmations.within4h.length} cita${confirmations.within4h.length === 1 ? "" : "s"} en 1-4h sin confirmar`,
          items: confirmations.within4h.map((l) => ({
            text: `• *${l.nombre || "ID " + l.id}* — setter: ${l.setter || "_N/A_"}`,
            actionUrl: crmUrls.lead(l.id),
            actionLabel: "Confirmar",
          })),
          itemsTruncatedActionUrl: crmUrls.confirmaciones(),
          actions: [
            { label: "Abrir Confirmaciones", url: crmUrls.confirmaciones(), emoji: "📅" },
          ],
        });
        markSent("confirm-4h", hash);
      }
    }

    if (confirmations.within24h.length >= 3) {
      // Info — heads-up del día siguiente. Throttled 24h: 1 alert por día max.
      const hash = computeHash(confirmations.within24h.map((l) => l.id));
      if (shouldSend("confirm-24h", hash, THROTTLE.INFO_MS)) {
        await sendSlackAlert({
          severity: "info",
          title: `${confirmations.within24h.length} cita${confirmations.within24h.length === 1 ? "" : "s"} próximas 24h sin confirmar`,
          items: confirmations.within24h.map((l) => ({
            text: `• *${l.nombre || "ID " + l.id}*`,
            actionUrl: crmUrls.lead(l.id),
            actionLabel: "Ver",
          })),
          itemsTruncatedActionUrl: crmUrls.confirmaciones(),
          actions: [
            { label: "Confirmaciones", url: crmUrls.confirmaciones(), emoji: "📅" },
          ],
        });
        markSent("confirm-24h", hash);
      }
    }

    // 6. Follow-up tracking (overdue + stale + today's heads-up)
    const fups = await db.getStaleFollowUps(5);

    if (fups.overdue.length >= 2) {
      // Severity escala con cantidad. Throttle según severity:
      //   <5 → warning, 6h
      //   >=5 → critical, 1h (problema sistémico)
      const hash = computeHash(fups.overdue.map((f) => f.id));
      const severity = fups.overdue.length >= 5 ? "critical" : "warning";
      const minInterval = severity === "critical" ? THROTTLE.CRITICAL_MS : THROTTLE.WARNING_MS;
      if (shouldSend("followup-overdue", hash, minInterval)) {
        await sendSlackAlert({
          severity,
          title: `${fups.overdue.length} follow-up${fups.overdue.length === 1 ? "" : "s"} vencido${fups.overdue.length === 1 ? "" : "s"}`,
          body: "Pasaron de su próxima fecha programada y siguen activos.",
          items: fups.overdue.map((f) => ({
            text: `• Follow-up *#${f.id}* (${f.tipo}) — closer: ${f.closer || "_N/A_"}`,
            actionUrl: f.leadId ? crmUrls.lead(f.leadId) : crmUrls.followUps(),
            actionLabel: "Abrir",
          })),
          itemsTruncatedActionUrl: crmUrls.followUps(),
          actions: [
            { label: "Abrir Follow-Ups", url: crmUrls.followUps(), emoji: "🔥", style: severity === "critical" ? "danger" : undefined },
          ],
        });
        markSent("followup-overdue", hash);
      }
    }

    if (fups.stale.length >= 3) {
      // Warning, throttled 6h. Skip <3 (lista corta es trivial).
      const hash = computeHash(fups.stale.map((f) => f.id));
      if (shouldSend("followup-stale", hash, THROTTLE.WARNING_MS)) {
        await sendSlackAlert({
          severity: "warning",
          title: `${fups.stale.length} follow-up${fups.stale.length === 1 ? "" : "s"} sin actividad (+5 días)`,
          body: "Se enfrían: registrá un toque o cerrá el follow-up.",
          items: fups.stale.map((f) => ({
            text: `• Follow-up *#${f.id}* (${f.tipo}) — closer: ${f.closer || "_N/A_"}`,
            actionUrl: f.leadId ? crmUrls.lead(f.leadId) : crmUrls.followUps(),
            actionLabel: "Abrir",
          })),
          itemsTruncatedActionUrl: crmUrls.followUps(),
          actions: [
            { label: "Abrir Follow-Ups", url: crmUrls.followUps(), emoji: "📋" },
          ],
        });
        markSent("followup-stale", hash);
      }
    }

    // Follow-ups de hoy: only once per day
    const today = getChileDate();
    if (fups.todayFollowUps.length > 0 && lastFollowUpHeadsUpDate !== today) {
      await sendSlackAlert({
        severity: "info",
        title: `${fups.todayFollowUps.length} follow-up${fups.todayFollowUps.length === 1 ? "" : "s"} programado${fups.todayFollowUps.length === 1 ? "" : "s"} para hoy`,
        body: "Heads-up del día — closers, planeen sus toques.",
        emoji: "📅",
        items: fups.todayFollowUps.map((f) => ({
          text: `• Follow-up *#${f.id}* (${f.tipo}) — closer: ${f.closer || "_N/A_"}`,
          actionUrl: f.leadId ? crmUrls.lead(f.leadId) : crmUrls.followUps(),
          actionLabel: "Abrir",
        })),
        itemsTruncatedActionUrl: crmUrls.followUps(),
        actions: [
          { label: "Ver Follow-Ups", url: crmUrls.followUps(), emoji: "📋" },
        ],
      });
      lastFollowUpHeadsUpDate = today;
    }

    // 7. Forward critical smart alerts
    await runSmartAlertForward();
  } catch (err) {
    console.error("[KPI Monitor] Pulse check error:", err);
  }
}

async function runSmartAlertForward() {
  try {
    const alerts = await db.getSmartAlerts();
    const critical = alerts.filter((a) => a.severity === "critical");
    if (critical.length === 0) return;

    const hash = critical.map((a) => a.description).sort().join("|");
    // Smart alerts críticas — throttled a 1h para evitar spam si el sistema
    // detecta el mismo problema recurrente.
    if (!shouldSend("smart-alerts", hash, THROTTLE.CRITICAL_MS)) return;

    await sendSlackAlert({
      severity: "critical",
      title: `${critical.length} alerta${critical.length === 1 ? "" : "s"} crítica${critical.length === 1 ? "" : "s"} del sistema`,
      body: "Smart Alerts del CRM detectó problemas que requieren atención inmediata.",
      items: critical.map((a) => ({
        text: `• *${a.title}*: ${a.description}`,
      })),
      itemsTruncatedActionUrl: crmUrls.alertas(),
      actions: [
        { label: "Ver Alertas", url: crmUrls.alertas(), emoji: "🚨", style: "danger" },
      ],
    });
    markSent("smart-alerts", hash);
  } catch (err) {
    console.error("[KPI Monitor] Smart alert forward error:", err);
  }
}

// ─── Hourly Summary ──────────────────────────────────────────
async function runHourlySummary() {
  try {
    const stats = await db.getHourlySummaryStats();
    if (stats.newLeads === 0 && stats.contacted === 0 && stats.confirmed === 0) return;

    const now = new Date().toLocaleString("es-CL", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
    });
    await sendSlackMessage(
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `*Resumen Hora (${now})*`,
              `Leads nuevos: *${stats.newLeads}* | Contactados: *${stats.contacted}* | Confirmados: *${stats.confirmed}*`,
            ].join("\n"),
          },
        },
      ],
      `Resumen horario: ${stats.newLeads} nuevos, ${stats.contacted} contactados, ${stats.confirmed} confirmados`
    );
  } catch (err) {
    console.error("[KPI Monitor] Hourly summary error:", err);
  }
}

// ─── Daily Report (8 AM Chile, once per day) ─────────────────
async function maybeSendDailyReport() {
  const today = getChileDate();
  if (lastDailyDate === today) return;

  const hour = getChileHour();
  if (hour < 8 || hour > 9) return;

  lastDailyDate = today;

  try {
    await runDailyReport();
  } catch (err) {
    console.error("[KPI Monitor] Daily report error:", err);
  }
}

async function runDailyReport() {
  const mesActual = getCurrentMes();
  const now = new Date();

  const [setterLB, closerLB, closerKPIs, alerts] = await Promise.all([
    db.getSetterLeaderboard({ mes: mesActual }),
    db.getCloserLeaderboard({ mes: mesActual }),
    db.getCloserTrackerKPIs({ mes: mesActual }),
    db.getSmartAlerts(),
  ]);

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📊 Reporte Diario — ${mesActual} ${now.getFullYear()}` },
    },
  ];

  if (setterLB.length > 0) {
    const setterLines = setterLB
      .slice(0, 5)
      .map((s, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
        return `${medal} *${s.setter}* — ${Number(s.totalAsistidas)} demos asistidas, ${Number(s.totalIntentos)} intentos`;
      })
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Setters*\n${setterLines}` },
    });
  }

  if (closerLB.length > 0) {
    const closerLines = closerLB
      .slice(0, 5)
      .map((c, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
        const rev = Number(c.totalPiffRevenue) + Number(c.totalSetupRevenue);
        return `${medal} *${c.closer}* — ${Number(c.totalCloses)} cierres, $${rev.toLocaleString()}`;
      })
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Closers*\n${closerLines}` },
    });
  }

  if (closerKPIs) {
    const totalRev = Number(closerKPIs.totalPiffRevenue) + Number(closerKPIs.totalSetupRevenue);
    const totalCash = Number(closerKPIs.totalPiffCash) + Number(closerKPIs.totalSetupCash);
    const closeRate =
      Number(closerKPIs.totalLive) > 0
        ? ((Number(closerKPIs.totalCloses) / Number(closerKPIs.totalLive)) * 100).toFixed(1)
        : "0";
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Close Rate:* ${closeRate}%` },
        { type: "mrkdwn", text: `*Revenue:* $${totalRev.toLocaleString()}` },
        { type: "mrkdwn", text: `*Cash Collected:* $${totalCash.toLocaleString()}` },
        { type: "mrkdwn", text: `*Cierres:* ${Number(closerKPIs.totalCloses)}` },
      ],
    });
  }

  const criticalAlerts = alerts.filter((a) => a.severity === "critical" || a.severity === "warning");
  if (criticalAlerts.length > 0) {
    const alertLines = criticalAlerts
      .slice(0, 5)
      .map((a) => `• [${a.severity}] ${a.title}: ${a.description}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Alertas Activas (${criticalAlerts.length})*\n${alertLines}` },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `SacaMedi KPI Monitor • Reporte generado ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}`,
      },
    ],
  });

  await sendSlackMessage(blocks, `Reporte Diario SacaMedi — ${mesActual} ${now.getFullYear()}`);
  console.log("[KPI Monitor] Daily report sent");
}

// ─── EOD Setter Tracker (6 PM Chile, daily) ──────────────────
async function maybeSendEodReports() {
  const today = getChileDate();
  if (lastEodDate === today) return;

  const hour = getChileHour();
  if (hour < 18 || hour > 19) return;

  lastEodDate = today;

  try {
    await Promise.all([runSetterEodReport(), runCloserEodReport()]);
  } catch (err) {
    console.error("[KPI Monitor] EOD report error:", err);
  }
}

async function runSetterEodReport() {
  const mesActual = getCurrentMes();
  const [leaderboard, kpis] = await Promise.all([
    db.getSetterLeaderboard({ mes: mesActual }),
    db.getSetterTrackerKPIs({ mes: mesActual }),
  ]);

  if (leaderboard.length === 0) return;

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📋 Setter Tracker EOD — ${mesActual}` },
    },
  ];

  const lines = leaderboard.map((s) => {
    const intentos = Number(s.totalIntentos);
    const intros = Number(s.totalIntros);
    const demos = Number(s.totalAsistidas);
    const cierres = Number(s.totalCierres);
    const rev = Number(s.totalRevenue);
    return `*${s.setter}*: ${intentos} intentos → ${intros} intros → ${demos} demos → ${cierres} cierres | $${rev.toLocaleString()}`;
  }).join("\n");

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: lines },
  });

  if (kpis) {
    const answerRate = Number(kpis.totalIntentos) > 0
      ? ((Number(kpis.totalIntros) / Number(kpis.totalIntentos)) * 100).toFixed(1)
      : "0";
    const dqRate = kpis.dqRate ? (Number(kpis.dqRate) * 100).toFixed(1) : "0";
    const bookingRate = Number(kpis.totalIntros) > 0
      ? ((Number(kpis.totalDemosAseguradas) / Number(kpis.totalIntros)) * 100).toFixed(1)
      : "0";

    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Answer Rate:* ${answerRate}%` },
        { type: "mrkdwn", text: `*DQ Rate:* ${dqRate}%` },
        { type: "mrkdwn", text: `*Booking Rate:* ${bookingRate}%` },
        { type: "mrkdwn", text: `*Total Intentos:* ${Number(kpis.totalIntentos)}` },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `SacaMedi KPI Monitor • EOD ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}` }],
  });

  await sendSlackMessage(blocks, `Setter Tracker EOD — ${mesActual}`);
  console.log("[KPI Monitor] Setter EOD report sent");
}

async function runCloserEodReport() {
  const mesActual = getCurrentMes();
  const [leaderboard, kpis] = await Promise.all([
    db.getCloserLeaderboard({ mes: mesActual }),
    db.getCloserTrackerKPIs({ mes: mesActual }),
  ]);

  if (leaderboard.length === 0) return;

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📋 Closer Tracker EOD — ${mesActual}` },
    },
  ];

  const lines = leaderboard.map((c) => {
    const schedule = Number(c.totalSchedule);
    const live = Number(c.totalLive);
    const offers = Number(c.totalOffers);
    const closes = Number(c.totalCloses);
    const piffRev = Number(c.totalPiffRevenue);
    const setupRev = Number(c.totalSetupRevenue);
    const totalRev = piffRev + setupRev;
    return `*${c.closer}*: ${schedule} sched → ${live} live → ${offers} offers → ${closes} closes | $${totalRev.toLocaleString()}`;
  }).join("\n");

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: lines },
  });

  if (kpis) {
    const showRate = Number(kpis.totalSchedule) > 0
      ? ((Number(kpis.totalLive) / Number(kpis.totalSchedule)) * 100).toFixed(1)
      : "0";
    const offerRate = Number(kpis.totalLive) > 0
      ? ((Number(kpis.totalOffers) / Number(kpis.totalLive)) * 100).toFixed(1)
      : "0";
    const closeRate = Number(kpis.totalLive) > 0
      ? ((Number(kpis.totalCloses) / Number(kpis.totalLive)) * 100).toFixed(1)
      : "0";
    const totalRev = Number(kpis.totalPiffRevenue) + Number(kpis.totalSetupRevenue);
    const totalCash = Number(kpis.totalPiffCash) + Number(kpis.totalSetupCash);

    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Show Rate:* ${showRate}%` },
        { type: "mrkdwn", text: `*Offer Rate:* ${offerRate}%` },
        { type: "mrkdwn", text: `*Close Rate:* ${closeRate}%` },
        { type: "mrkdwn", text: `*Revenue Total:* $${totalRev.toLocaleString()}` },
        { type: "mrkdwn", text: `*Cash Collected:* $${totalCash.toLocaleString()}` },
        { type: "mrkdwn", text: `*No-Shows:* ${Number(kpis.noShow)}` },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `SacaMedi KPI Monitor • EOD ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}` }],
  });

  await sendSlackMessage(blocks, `Closer Tracker EOD — ${mesActual}`);
  console.log("[KPI Monitor] Closer EOD report sent");
}

// ─── Team Summary (every 3 days, 9 AM Chile) ────────────────
async function maybeSendTeamDigest() {
  const today = getChileDate();
  if (lastTeamDigestDate === today) return;

  const hour = getChileHour();
  if (hour < 9 || hour > 10) return;

  // Every 3 days: send on day 1, 4, 7, 10, etc.
  const dayOfMonth = getChileDateNumber();
  if (dayOfMonth % 3 !== 1) return;

  lastTeamDigestDate = today;

  try {
    await runTeamDigest();
  } catch (err) {
    console.error("[KPI Monitor] Team digest error:", err);
  }
}

async function runTeamDigest() {
  const mesActual = getCurrentMes();
  const now = new Date();

  const [setterSummary, closerSummary, followUpStats, alerts] = await Promise.all([
    db.getSetterTeamSummaryByMonth(),
    db.getCloserTeamSummaryByMonth(),
    db.getFollowUpStats(),
    db.getSmartAlerts(),
  ]);

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📈 Team Digest — ${mesActual} ${now.getFullYear()}` },
    },
  ];

  // Current month setter totals
  const currentSetterMonth = setterSummary.find((m) => m.mes === mesActual);
  if (currentSetterMonth) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Equipo Setters (${mesActual})*`,
          `Intentos: *${Number(currentSetterMonth.totalIntentos)}* | Intros: *${Number(currentSetterMonth.totalIntros)}* | Demos asistidas: *${Number(currentSetterMonth.totalAsistidas)}* | Cierres: *${Number(currentSetterMonth.totalCierres)}*`,
          `Revenue: *$${Number(currentSetterMonth.totalRevenue).toLocaleString()}* | Cash: *$${Number(currentSetterMonth.totalCash).toLocaleString()}*`,
        ].join("\n"),
      },
    });
  }

  // Current month closer totals
  const currentCloserMonth = closerSummary.find((m) => m.mes === mesActual);
  if (currentCloserMonth) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Equipo Closers (${mesActual})*`,
          `Schedule: *${Number(currentCloserMonth.totalSchedule)}* | Live: *${Number(currentCloserMonth.totalLive)}* | Offers: *${Number(currentCloserMonth.totalOffers)}* | Closes: *${Number(currentCloserMonth.totalCloses)}*`,
          `Revenue: *$${(Number(currentCloserMonth.totalPiffRevenue) + Number(currentCloserMonth.totalSetupRevenue)).toLocaleString()}*`,
        ].join("\n"),
      },
    });
  }

  // Follow-up pipeline
  if (followUpStats) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Pipeline Follow-Ups*`,
          `Hot: *${followUpStats.hotCount}* | Warm: *${followUpStats.warmCount}* | Total activos: *${followUpStats.totalActivos}*`,
          `Vencidos: *${followUpStats.vencidos}* | Monto estimado: *$${Number(followUpStats.montoEstimadoTotal).toLocaleString()}*`,
        ].join("\n"),
      },
    });
  }

  // Active alerts
  const activeAlerts = alerts.filter((a) => a.severity === "critical" || a.severity === "warning");
  if (activeAlerts.length > 0) {
    const alertLines = activeAlerts
      .slice(0, 5)
      .map((a) => `• [${a.severity}] ${a.title}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Alertas Activas (${activeAlerts.length})*\n${alertLines}` },
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `SacaMedi KPI Monitor • Team Digest ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}` }],
  });

  await sendSlackMessage(blocks, `Team Digest SacaMedi — ${mesActual} ${now.getFullYear()}`);
  console.log("[KPI Monitor] Team digest sent");
}

// ─── Weekly AI Diagnostic (Monday 9 AM Chile) ───────────────
async function maybeSendWeeklyDiagnostic() {
  const today = getChileDate();
  if (lastWeeklyDiagDate === today) return;

  const hour = getChileHour();
  if (hour < 9 || hour > 10) return;

  const dayOfWeek = getChileDayOfWeek();
  if (dayOfWeek !== 1) return; // Monday only

  lastWeeklyDiagDate = today;

  try {
    await runWeeklyAiDiagnostic();
  } catch (err) {
    console.error("[KPI Monitor] Weekly diagnostic error:", err);
  }
}

async function runWeeklyAiDiagnostic() {
  if (!ENV.anthropicApiKey) {
    console.log("[KPI Monitor] Skipping AI diagnostic — ANTHROPIC_API_KEY not set");
    return;
  }

  const mesActual = getCurrentMes();

  const [setterKPIs, closerKPIs, setterLB, closerLB, followUpStats] = await Promise.all([
    db.getSetterTrackerKPIs({ mes: mesActual }),
    db.getCloserTrackerKPIs({ mes: mesActual }),
    db.getSetterLeaderboard({ mes: mesActual }),
    db.getCloserLeaderboard({ mes: mesActual }),
    db.getFollowUpStats(),
  ]);

  // Build data summary for AI
  const dataPayload = {
    mes: mesActual,
    setterKPIs: setterKPIs ? {
      intentos: Number(setterKPIs.totalIntentos),
      intros: Number(setterKPIs.totalIntros),
      demosAseguradas: Number(setterKPIs.totalDemosAseguradas),
      calendario: Number(setterKPIs.totalCalendario),
      confirmadas: Number(setterKPIs.totalConfirmadas),
      asistidas: Number(setterKPIs.totalAsistidas),
      cierres: Number(setterKPIs.totalCierres),
      revenue: Number(setterKPIs.totalRevenue),
      answerRate: Number(setterKPIs.totalIntentos) > 0 ? (Number(setterKPIs.totalIntros) / Number(setterKPIs.totalIntentos) * 100) : 0,
      dqRate: Number(setterKPIs.dqRate) * 100,
      bookingRate: Number(setterKPIs.totalIntros) > 0 ? (Number(setterKPIs.totalDemosAseguradas) / Number(setterKPIs.totalIntros) * 100) : 0,
    } : null,
    closerKPIs: closerKPIs ? {
      schedule: Number(closerKPIs.totalSchedule),
      live: Number(closerKPIs.totalLive),
      offers: Number(closerKPIs.totalOffers),
      deposits: Number(closerKPIs.totalDeposits),
      closes: Number(closerKPIs.totalCloses),
      revenue: Number(closerKPIs.totalPiffRevenue) + Number(closerKPIs.totalSetupRevenue),
      cash: Number(closerKPIs.totalPiffCash) + Number(closerKPIs.totalSetupCash),
      noShows: Number(closerKPIs.noShow),
      showRate: Number(closerKPIs.totalSchedule) > 0 ? (Number(closerKPIs.totalLive) / Number(closerKPIs.totalSchedule) * 100) : 0,
      offerRate: Number(closerKPIs.totalLive) > 0 ? (Number(closerKPIs.totalOffers) / Number(closerKPIs.totalLive) * 100) : 0,
      closeRate: Number(closerKPIs.totalLive) > 0 ? (Number(closerKPIs.totalCloses) / Number(closerKPIs.totalLive) * 100) : 0,
    } : null,
    setterLeaderboard: setterLB.map((s) => ({
      setter: s.setter,
      intentos: Number(s.totalIntentos),
      intros: Number(s.totalIntros),
      demos: Number(s.totalAsistidas),
      cierres: Number(s.totalCierres),
      revenue: Number(s.totalRevenue),
    })),
    closerLeaderboard: closerLB.map((c) => ({
      closer: c.closer,
      schedule: Number(c.totalSchedule),
      live: Number(c.totalLive),
      offers: Number(c.totalOffers),
      closes: Number(c.totalCloses),
      revenue: Number(c.totalPiffRevenue) + Number(c.totalSetupRevenue),
    })),
    followUps: followUpStats ? {
      hot: followUpStats.hotCount,
      warm: followUpStats.warmCount,
      activos: followUpStats.totalActivos,
      vencidos: followUpStats.vencidos,
      montoEstimado: Number(followUpStats.montoEstimadoTotal),
    } : null,
  };

  const anthropic = new Anthropic({ apiKey: ENV.anthropicApiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: `Eres un consultor senior de ventas analizando el funnel de una agencia de marketing que vende servicios a clínicas de medicina estética en Chile y Latinoamérica.

Tu trabajo es dar un diagnóstico semanal BRUTAL y honesto. No seas diplomático — di la verdad directa.

Benchmarks de referencia para esta industria:
- Answer Rate (setters): 40-60% es bueno
- DQ Rate: <15% es bueno
- Booking Rate: 30-50% es bueno
- Show Rate: 60-80% es bueno
- Offer Rate: 70-90% es bueno
- Close Rate: 20-35% es bueno
- Revenue por closer/mes: $10K-25K USD es target

Responde SOLO con JSON válido (sin markdown, sin backticks).`,
    messages: [
      {
        role: "user",
        content: `Analiza estos datos del mes de ${mesActual} y genera un diagnóstico semanal:

${JSON.stringify(dataPayload, null, 2)}

Responde con este JSON exacto:
{
  "diagnostico": "2-3 párrafos de análisis brutal y directo",
  "cuelloDeBotella": "El punto más débil del funnel en una frase",
  "onTrack": true/false,
  "accionesRecomendadas": ["acción 1", "acción 2", "acción 3"],
  "repDestacado": { "nombre": "...", "razon": "..." },
  "repAtencion": { "nombre": "...", "razon": "..." }
}`,
      },
    ],
  });

  let diagnosis: any;
  try {
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text in response");
    diagnosis = JSON.parse(textBlock.text);
  } catch (err) {
    console.error("[KPI Monitor] Failed to parse AI diagnosis:", err);
    return;
  }

  // Build Slack message
  const emoji = diagnosis.onTrack ? "🟢" : "🔴";
  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `🧠 Diagnóstico Semanal IA — ${mesActual}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `${emoji} *${diagnosis.onTrack ? "ON TRACK" : "OFF TRACK"}*\n\n${diagnosis.diagnostico}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*🔍 Cuello de Botella:* ${diagnosis.cuelloDeBotella}` },
    },
  ];

  if (diagnosis.accionesRecomendadas?.length > 0) {
    const actionLines = diagnosis.accionesRecomendadas
      .map((a: string, i: number) => `${i + 1}. ${a}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*📋 Acciones Recomendadas:*\n${actionLines}` },
    });
  }

  const repFields: object[] = [];
  if (diagnosis.repDestacado?.nombre) {
    repFields.push({
      type: "mrkdwn",
      text: `*⭐ Destacado:* ${diagnosis.repDestacado.nombre}\n${diagnosis.repDestacado.razon}`,
    });
  }
  if (diagnosis.repAtencion?.nombre) {
    repFields.push({
      type: "mrkdwn",
      text: `*⚠️ Atención:* ${diagnosis.repAtencion.nombre}\n${diagnosis.repAtencion.razon}`,
    });
  }
  if (repFields.length > 0) {
    blocks.push({ type: "section", fields: repFields });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `SacaMedi KPI Monitor • Diagnóstico IA generado ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}`,
      },
    ],
  });

  await sendSlackMessage(blocks, `Diagnóstico Semanal IA — ${mesActual}`);
  console.log("[KPI Monitor] Weekly AI diagnostic sent");
}

// ─── Start / Stop ────────────────────────────────────────────
export function startKpiMonitor() {
  if (!isSlackConfigured()) {
    console.log("[KPI Monitor] SLACK_WEBHOOK_URL not set — running in log-only mode");
  }
  console.log("[KPI Monitor] Started (pulse: 15min, hourly, daily 8AM, EOD 6PM, team digest 3d, AI weekly Mon)");

  // Initial pulse after 5s
  setTimeout(() => {
    runPulseCheck();
    maybeSendDailyReport();
    maybeSendEodReports();
    maybeSendTeamDigest();
    maybeSendWeeklyDiagnostic();
  }, 5000);

  // Pulse every 15 min
  pulseTimer = setInterval(async () => {
    await runPulseCheck();
    await maybeSendDailyReport();
    await maybeSendEodReports();
    await maybeSendTeamDigest();
    await maybeSendWeeklyDiagnostic();
  }, PULSE_INTERVAL_MS);

  // Hourly summary
  hourlyTimer = setInterval(() => {
    runHourlySummary();
  }, HOURLY_INTERVAL_MS);

  // Dedup cleanup every 6h
  cleanupTimer = setInterval(() => {
    cleanupDedup();
  }, CLEANUP_INTERVAL_MS);
}

export function stopKpiMonitor() {
  if (pulseTimer) {
    clearInterval(pulseTimer);
    pulseTimer = null;
  }
  if (hourlyTimer) {
    clearInterval(hourlyTimer);
    hourlyTimer = null;
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
  console.log("[KPI Monitor] Stopped");
}
