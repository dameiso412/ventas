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
import { sendSlackMessage, sendSlackAlert, isSlackConfigured } from "./_core/slack";
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

// ─── Content-Hash Dedup (Phase 1: anti-spam) ────────────────
// Only re-alerts when the actual data changes — no more TTL-based repetition
const dedup = new Map<string, { sentAt: number; contentHash: string }>();

function computeHash(ids: number[]): string {
  return ids.sort((a, b) => a - b).join(",");
}

function shouldSend(key: string, contentHash: string): boolean {
  const prev = dedup.get(key);
  if (!prev) return true;
  return prev.contentHash !== contentHash;
}

function markSent(key: string, contentHash: string): void {
  dedup.set(key, { sentAt: Date.now(), contentHash });
}

/** Purge entries older than 24h to prevent unbounded growth */
function cleanupDedup() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
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
    const stl = await db.getSpeedToLeadAlerts(30);
    if (stl.length > 0) {
      const hash = computeHash(stl.map((l) => l.id));
      if (shouldSend("speed-to-lead", hash)) {
        const lines = stl
          .slice(0, 10)
          .map((l) => `• *${l.nombre || "Sin nombre"}* — ${l.minutesSinceCreated} min (setter: ${l.setterAsignado || "sin asignar"})`)
          .join("\n");
        await sendSlackAlert({
          severity: "critical",
          title: `${stl.length} lead(s) sin contactar hace +30 min`,
          body: lines + (stl.length > 10 ? `\n_...y ${stl.length - 10} más_` : ""),
        });
        markSent("speed-to-lead", hash);
      }
    }

    // 2. Leads sin setter asignado
    const unassigned = await db.getUnassignedLeads();
    if (unassigned.length > 0) {
      const hash = computeHash(unassigned.map((l) => l.id));
      if (shouldSend("unassigned", hash)) {
        const lines = unassigned
          .slice(0, 10)
          .map((l) => `• *${l.nombre || l.correo || "ID " + l.id}*`)
          .join("\n");
        await sendSlackAlert({
          severity: "warning",
          title: `${unassigned.length} lead(s) sin setter asignado`,
          body: lines + (unassigned.length > 10 ? `\n_...y ${unassigned.length - 10} más_` : ""),
        });
        markSent("unassigned", hash);
      }
    }

    // 3. Seguimientos estancados (>72h sin update)
    const stale = await db.getStaleSeguimientos(72);
    if (stale.length > 0) {
      const hash = computeHash(stale.map((l) => l.id));
      if (shouldSend("stale-seguimiento", hash)) {
        const lines = stale
          .slice(0, 10)
          .map((l) => `• *${l.nombre || "ID " + l.id}* — closer: ${l.closer || "N/A"}`)
          .join("\n");
        await sendSlackAlert({
          severity: "warning",
          title: `${stale.length} seguimiento(s) estancado(s) (+72h)`,
          body: lines + (stale.length > 10 ? `\n_...y ${stale.length - 10} más_` : ""),
        });
        markSent("stale-seguimiento", hash);
      }
    }

    // 4. Citas vencidas sin registrar asistencia
    const overdue = await db.getOverdueAppointments();
    if (overdue.length > 0) {
      const hash = computeHash(overdue.map((l) => l.id));
      if (shouldSend("overdue-attendance", hash)) {
        const lines = overdue
          .slice(0, 10)
          .map((l) => {
            const time = l.fecha ? new Date(l.fecha).toLocaleString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }) : "?";
            return `• *${l.nombre || l.correo || "ID " + l.id}* — cita a las ${time} (closer: ${l.closer || "N/A"})`;
          })
          .join("\n");
        await sendSlackAlert({
          severity: "warning",
          title: `${overdue.length} cita(s) sin registrar asistencia`,
          body: lines + (overdue.length > 10 ? `\n_...y ${overdue.length - 10} más_` : ""),
        });
        markSent("overdue-attendance", hash);
      }
    }

    // 5. Confirmaciones escalonadas (T-1h, T-4h, T-24h)
    const confirmations = await db.getEscalatedConfirmations();

    if (confirmations.within1h.length > 0) {
      const hash = computeHash(confirmations.within1h.map((l) => l.id));
      if (shouldSend("confirm-1h", hash)) {
        const lines = confirmations.within1h
          .slice(0, 10)
          .map((l) => `• *${l.nombre || "ID " + l.id}* — setter: ${l.setter || "N/A"}`)
          .join("\n");
        await sendSlackAlert({
          severity: "critical",
          title: `⏰ ${confirmations.within1h.length} cita(s) en <1h SIN CONFIRMAR`,
          body: lines,
        });
        markSent("confirm-1h", hash);
      }
    }

    if (confirmations.within4h.length > 0) {
      const hash = computeHash(confirmations.within4h.map((l) => l.id));
      if (shouldSend("confirm-4h", hash)) {
        const lines = confirmations.within4h
          .slice(0, 10)
          .map((l) => `• *${l.nombre || "ID " + l.id}* — setter: ${l.setter || "N/A"}`)
          .join("\n");
        await sendSlackAlert({
          severity: "warning",
          title: `${confirmations.within4h.length} cita(s) en 1-4h sin confirmar`,
          body: lines,
        });
        markSent("confirm-4h", hash);
      }
    }

    if (confirmations.within24h.length > 0) {
      const hash = computeHash(confirmations.within24h.map((l) => l.id));
      if (shouldSend("confirm-24h", hash)) {
        const lines = confirmations.within24h
          .slice(0, 8)
          .map((l) => `• *${l.nombre || "ID " + l.id}*`)
          .join("\n");
        await sendSlackAlert({
          severity: "info",
          title: `${confirmations.within24h.length} cita(s) próximas 24h sin confirmar`,
          body: lines + (confirmations.within24h.length > 8 ? `\n_...y ${confirmations.within24h.length - 8} más_` : ""),
        });
        markSent("confirm-24h", hash);
      }
    }

    // 6. Follow-up tracking (overdue + stale + today's heads-up)
    const fups = await db.getStaleFollowUps(5);

    if (fups.overdue.length > 0) {
      const hash = computeHash(fups.overdue.map((f) => f.id));
      if (shouldSend("followup-overdue", hash)) {
        const lines = fups.overdue
          .slice(0, 8)
          .map((f) => `• Follow-up #${f.id} (${f.tipo}) — closer: ${f.closer || "N/A"}`)
          .join("\n");
        const severity = fups.overdue.length >= 5 ? "critical" : "warning";
        await sendSlackAlert({
          severity,
          title: `${fups.overdue.length} follow-up(s) vencido(s)`,
          body: lines + (fups.overdue.length > 8 ? `\n_...y ${fups.overdue.length - 8} más_` : ""),
        });
        markSent("followup-overdue", hash);
      }
    }

    if (fups.stale.length > 0) {
      const hash = computeHash(fups.stale.map((f) => f.id));
      if (shouldSend("followup-stale", hash)) {
        const lines = fups.stale
          .slice(0, 8)
          .map((f) => `• Follow-up #${f.id} (${f.tipo}) — closer: ${f.closer || "N/A"}, sin actividad >5d`)
          .join("\n");
        await sendSlackAlert({
          severity: "warning",
          title: `${fups.stale.length} follow-up(s) sin actividad (+5 días)`,
          body: lines + (fups.stale.length > 8 ? `\n_...y ${fups.stale.length - 8} más_` : ""),
        });
        markSent("followup-stale", hash);
      }
    }

    // Follow-ups de hoy: only once per day
    const today = getChileDate();
    if (fups.todayFollowUps.length > 0 && lastFollowUpHeadsUpDate !== today) {
      const lines = fups.todayFollowUps
        .slice(0, 8)
        .map((f) => `• Follow-up #${f.id} (${f.tipo}) — closer: ${f.closer || "N/A"}`)
        .join("\n");
      await sendSlackAlert({
        severity: "info",
        title: `${fups.todayFollowUps.length} follow-up(s) programado(s) para hoy`,
        body: lines + (fups.todayFollowUps.length > 8 ? `\n_...y ${fups.todayFollowUps.length - 8} más_` : ""),
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
    if (!shouldSend("smart-alerts", hash)) return;

    const lines = critical
      .slice(0, 8)
      .map((a) => `• *${a.title}*: ${a.description}`)
      .join("\n");
    await sendSlackAlert({
      severity: "critical",
      title: `${critical.length} alerta(s) crítica(s) del sistema`,
      body: lines,
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
