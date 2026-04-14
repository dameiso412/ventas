/**
 * KPI Pulse Monitor — Heartbeats automáticos con alertas Slack
 *
 * Timers:
 *   - Pulse checks every 10 min (speed-to-lead, unassigned, stale, confirmations, smart alerts)
 *   - Hourly summary (only if there's activity)
 *   - Daily report at 8 AM Chile (once per day)
 */
import * as db from "./db";
import { sendSlackMessage, sendSlackAlert, isSlackConfigured } from "./_core/slack";

// ─── Intervals ───────────────────────────────────────────────
const PULSE_INTERVAL_MS = 15 * 60 * 1000;   // 15 min
const HOURLY_INTERVAL_MS = 60 * 60 * 1000;  // 60 min

let pulseTimer: ReturnType<typeof setInterval> | null = null;
let hourlyTimer: ReturnType<typeof setInterval> | null = null;
let lastDailyDate: string | null = null; // "YYYY-MM-DD"

// ─── Deduplication ───────────────────────────────────────────
// Map<alertKey, { sentAt: number; ids: Set<number> }>
const dedup = new Map<string, { sentAt: number; ids: Set<number> }>();
const DEDUP_TTL_MS = 30 * 60 * 1000; // 30 min

function shouldSend(key: string, currentIds: number[]): boolean {
  const prev = dedup.get(key);
  if (!prev) return true;
  if (Date.now() - prev.sentAt > DEDUP_TTL_MS) return true;
  // Changed set of IDs?
  if (currentIds.length !== prev.ids.size) return true;
  return currentIds.some((id) => !prev.ids.has(id));
}

function markSent(key: string, ids: number[]) {
  dedup.set(key, { sentAt: Date.now(), ids: new Set(ids) });
}

// ─── Pulse Checks (every 10 min) ────────────────────────────
async function runPulseCheck() {
  try {
    // 1. Speed to Lead — leads >30 min sin contactar
    const stl = await db.getSpeedToLeadAlerts(30);
    if (stl.length > 0 && shouldSend("speed-to-lead", stl.map((l) => l.id))) {
      const lines = stl
        .slice(0, 10)
        .map((l) => `• *${l.nombre || "Sin nombre"}* — ${l.minutesSinceCreated} min (setter: ${l.setterAsignado || "sin asignar"})`)
        .join("\n");
      await sendSlackAlert({
        severity: "critical",
        title: `${stl.length} lead(s) sin contactar hace +30 min`,
        body: lines + (stl.length > 10 ? `\n_...y ${stl.length - 10} más_` : ""),
      });
      markSent("speed-to-lead", stl.map((l) => l.id));
    }

    // 2. Leads sin setter asignado
    const unassigned = await db.getUnassignedLeads();
    if (unassigned.length > 0 && shouldSend("unassigned", unassigned.map((l) => l.id))) {
      const lines = unassigned
        .slice(0, 10)
        .map((l) => `• *${l.nombre || l.correo || "ID " + l.id}*`)
        .join("\n");
      await sendSlackAlert({
        severity: "warning",
        title: `${unassigned.length} lead(s) sin setter asignado`,
        body: lines + (unassigned.length > 10 ? `\n_...y ${unassigned.length - 10} más_` : ""),
      });
      markSent("unassigned", unassigned.map((l) => l.id));
    }

    // 3. Seguimientos estancados (>72h sin update)
    const stale = await db.getStaleSeguimientos(72);
    if (stale.length > 0 && shouldSend("stale-seguimiento", stale.map((l) => l.id))) {
      const lines = stale
        .slice(0, 10)
        .map((l) => `• *${l.nombre || "ID " + l.id}* — closer: ${l.closer || "N/A"}`)
        .join("\n");
      await sendSlackAlert({
        severity: "warning",
        title: `${stale.length} seguimiento(s) estancado(s) (+72h)`,
        body: lines + (stale.length > 10 ? `\n_...y ${stale.length - 10} más_` : ""),
      });
      markSent("stale-seguimiento", stale.map((l) => l.id));
    }

    // 4. Citas sin confirmar (próximas 24h)
    const queue = await db.getConfirmationQueue();
    const urgent = queue.urgente;
    if (urgent.length > 0 && shouldSend("unconfirmed-today", urgent.map((l) => l.id))) {
      const lines = urgent
        .slice(0, 10)
        .map((l) => `• *${l.nombre || "ID " + l.id}* — setter: ${l.setterAsignado || "N/A"}`)
        .join("\n");
      await sendSlackAlert({
        severity: "critical",
        title: `${urgent.length} cita(s) HOY sin confirmar`,
        body: lines + (urgent.length > 10 ? `\n_...y ${urgent.length - 10} más_` : ""),
      });
      markSent("unconfirmed-today", urgent.map((l) => l.id));
    }

    // 5. Forward critical/warning smart alerts
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

    // Dedup by concatenated descriptions
    const key = "smart-alerts";
    const hash = critical.map((a) => a.description).sort().join("|");
    const prev = dedup.get(key);
    if (prev && Date.now() - prev.sentAt < DEDUP_TTL_MS) {
      const prevHash = Array.from(prev.ids).join("|");
      if (prevHash === hash) return;
    }

    const lines = critical
      .slice(0, 8)
      .map((a) => `• *${a.title}*: ${a.description}`)
      .join("\n");
    await sendSlackAlert({
      severity: "critical",
      title: `${critical.length} alerta(s) critica(s) del sistema`,
      body: lines,
    });

    // Store hash as pseudo-IDs
    dedup.set(key, {
      sentAt: Date.now(),
      ids: new Set(hash.split("").map((_, i) => i)),
    });
  } catch (err) {
    console.error("[KPI Monitor] Smart alert forward error:", err);
  }
}

// ─── Hourly Summary ──────────────────────────────────────────
async function runHourlySummary() {
  try {
    const stats = await db.getHourlySummaryStats();
    // Only send if there was any activity
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

async function maybeSendDailyReport() {
  const today = getChileDate();
  if (lastDailyDate === today) return;

  const hour = getChileHour();
  if (hour < 8 || hour > 9) return; // only at 8 AM Chile window

  lastDailyDate = today;

  try {
    await runDailyReport();
  } catch (err) {
    console.error("[KPI Monitor] Daily report error:", err);
  }
}

async function runDailyReport() {
  const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const now = new Date();
  const mesActual = MESES[now.getMonth()];

  // Fetch data in parallel
  const [setterLB, closerLB, closerKPIs, alerts] = await Promise.all([
    db.getSetterLeaderboard({ mes: mesActual }),
    db.getCloserLeaderboard({ mes: mesActual }),
    db.getCloserTrackerKPIs({ mes: mesActual }),
    db.getSmartAlerts(),
  ]);

  // Build blocks
  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `Reporte Diario — ${mesActual} ${now.getFullYear()}` },
    },
  ];

  // Setter leaderboard
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

  // Closer leaderboard
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

  // KPIs del mes
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

  // Smart alerts summary
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

// ─── Start / Stop ────────────────────────────────────────────
export function startKpiMonitor() {
  if (!isSlackConfigured()) {
    console.log("[KPI Monitor] SLACK_WEBHOOK_URL not set — running in log-only mode");
  }
  console.log("[KPI Monitor] Started (pulse: 10min, hourly summary, daily report 8AM Chile)");

  // Initial pulse after 5s
  setTimeout(() => {
    runPulseCheck();
    maybeSendDailyReport();
  }, 5000);

  // Pulse every 10 min
  pulseTimer = setInterval(async () => {
    await runPulseCheck();
    await maybeSendDailyReport();
  }, PULSE_INTERVAL_MS);

  // Hourly summary
  hourlyTimer = setInterval(() => {
    runHourlySummary();
  }, HOURLY_INTERVAL_MS);
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
  console.log("[KPI Monitor] Stopped");
}
