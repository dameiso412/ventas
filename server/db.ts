import { eq, desc, and, gte, lte, lt, sql, asc, inArray, isNull, isNotNull, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser, users,
  leads, InsertLead, Lead,
  leadScoring, InsertLeadScoring,
  setterActivities, InsertSetterActivity,
  closerActivities, InsertCloserActivity,
  monthlyMetrics, InsertMonthlyMetric,
  closerProjections, InsertCloserProjection,
  setterProjections, InsertSetterProjection,
  callAudits, InsertCallAudit,
  followUps, InsertFollowUp, FollowUp,
  followUpLogs, InsertFollowUpLog,
  webhookLogs, InsertWebhookLog,
  contactAttempts, InsertContactAttempt,
  leadComments, InsertLeadComment,
  notifications, InsertNotification,
  adCampaigns, InsertAdCampaign,
  adAdsets, InsertAdAdset,
  adAds, InsertAdAd,
  adCreatives, InsertAdCreative, AdCreative,
  adMetricsDaily, InsertAdMetricDaily,
  syncLog, InsertSyncLog,
  teamMembers, InsertTeamMember, TeamMember,
  allowedEmails, InsertAllowedEmail, AllowedEmail,
  revenueScenarios, InsertRevenueScenario,
  leadDataEntries, InsertLeadDataEntry,
  manychatEvents, InsertManychatEvent,
  stripePayments, InsertStripePayment, StripePayment,
  stripeWebhookLogs, InsertStripeWebhookLog,
  systemConfig,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { getAdSpendDivisor } from './_core/exchange-rate';
import { calculateBusinessHours } from '../shared/businessHours';

let _db: ReturnType<typeof drizzle> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30_000; // 30s

export async function getDb() {
  // If we have a cached connection, verify it's still alive periodically
  if (_db && _sql) {
    const now = Date.now();
    if (now - _lastHealthCheck > HEALTH_CHECK_INTERVAL) {
      try {
        await _sql`SELECT 1`;
        _lastHealthCheck = now;
      } catch {
        console.warn("[Database] Stale connection detected, reconnecting...");
        try { await _sql.end(); } catch {}
        _db = null;
        _sql = null;
      }
    }
    if (_db) return _db;
  }

  if (!process.env.DATABASE_URL) {
    console.error("[Database] DATABASE_URL is not set!");
    return null;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      _sql = postgres(process.env.DATABASE_URL, {
        prepare: false,
        connect_timeout: 30,
        idle_timeout: 20,
        max_lifetime: 60 * 30,
      });
      _db = drizzle(_sql);
      await _sql`SELECT 1`;
      _lastHealthCheck = Date.now();
      console.log("[Database] Connected successfully");
      return _db;
    } catch (error) {
      console.warn(`[Database] Connection attempt ${attempt}/3 failed:`, error);
      try { if (_sql) await _sql.end(); } catch {}
      _db = null;
      _sql = null;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  console.error("[Database] All 3 connection attempts failed");
  return null;
}

/** Force reconnect (e.g. after connection failure) */
export async function resetDb() {
  if (_sql) {
    try { await _sql.end(); } catch {}
  }
  _db = null;
  _sql = null;
  _lastHealthCheck = 0;
}

// ==================== USERS ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.authId) throw new Error("User authId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { authId: user.authId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.email && user.email === ENV.adminEmail) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    updateSet.updatedAt = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.authId, set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByAuthId(authId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.authId, authId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== LEADS ====================
export async function createLead(lead: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(leads).values(lead).returning({ id: leads.id });
  return result.id;
}

export async function getLeads(filters?: {
  mes?: string;
  semana?: number;
  origen?: string;
  setter?: string;
  closer?: string;
  scoreLabel?: string;
  outcome?: string;
  tipo?: string;
  categoria?: string;
  estadoLead?: string;
  timeFilter?: "proximas" | "pasadas";
}) {
  const db = await getDb();
  if (!db) throw new Error("No se pudo conectar a la base de datos. Verifica la conexion.");
  const conditions = [];
  if (filters?.mes) conditions.push(eq(leads.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(leads.semana, filters.semana));
  if (filters?.origen) conditions.push(eq(leads.origen, filters.origen as any));
  if (filters?.setter) conditions.push(eq(leads.setterAsignado, filters.setter));
  if (filters?.closer) conditions.push(eq(leads.closer, filters.closer));
  if (filters?.scoreLabel) conditions.push(eq(leads.scoreLabel, filters.scoreLabel as any));
  if (filters?.outcome) conditions.push(eq(leads.outcome, filters.outcome as any));
  if (filters?.tipo) conditions.push(eq(leads.tipo, filters.tipo as any));
  if (filters?.categoria) conditions.push(eq(leads.categoria, filters.categoria as any));
  if (filters?.estadoLead) conditions.push(eq(leads.estadoLead, filters.estadoLead as any));
  if (filters?.timeFilter === "proximas") {
    // Compare against midnight today so appointments that already happened
    // today (e.g. 9am meeting checked at 3pm) still appear in "próximas"
    // rather than silently moving to "pasadas" the moment their time passes.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    conditions.push(gte(leads.fecha, startOfToday));
  } else if (filters?.timeFilter === "pasadas") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    conditions.push(lt(leads.fecha, startOfToday));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const order = filters?.timeFilter === "proximas" ? asc(leads.fecha) : desc(leads.fecha);
  return db.select().from(leads).where(where).orderBy(order);
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0] || null;
}

export async function updateLead(id: number, data: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Sanitize data before update: empty strings for decimal fields → "0", empty dates → null
  const sanitized = { ...data } as any;
  const decimalFields = ["facturado", "cashCollected", "deposito", "contractedRevenue", "setupFee", "recurrenciaMensual", "tiempoRespuestaHoras"];
  for (const field of decimalFields) {
    if (sanitized[field] === "" || sanitized[field] === undefined) {
      sanitized[field] = "0";
    }
  }
  const timestampFields = ["fechaPrimerContacto", "fechaProximoCobro", "fecha", "fechaIntro"];
  for (const field of timestampFields) {
    if (sanitized[field] === "" || sanitized[field] === "null") {
      sanitized[field] = null;
    }
  }
  // Ensure productoTipo is null if empty
  if (sanitized.productoTipo === "" || sanitized.productoTipo === undefined) {
    sanitized.productoTipo = null;
  }
  sanitized.updatedAt = new Date();
  await db.update(leads).set(sanitized).where(eq(leads.id, id));
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(leads).where(eq(leads.id, id));
}

export async function bulkDeleteLeads(ids: number[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(leads).where(inArray(leads.id, ids));
}

/**
 * Find a lead by correo or telefono (for webhook score matching).
 * Tries correo first, then telefono. Returns the most recent match.
 */
export async function findLeadByEmailOrPhone(correo?: string | null, telefono?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (correo) {
    const result = await db.select().from(leads).where(eq(leads.correo, correo)).orderBy(desc(leads.createdAt)).limit(1);
    if (result.length > 0) return result[0];
  }
  if (telefono) {
    const result = await db.select().from(leads).where(eq(leads.telefono, telefono)).orderBy(desc(leads.createdAt)).limit(1);
    if (result.length > 0) return result[0];
  }
  return null;
}

// ==================== LEAD SCORING ====================
export async function createLeadScoring(scoring: InsertLeadScoring) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(leadScoring).values(scoring).returning({ id: leadScoring.id });
  return result.id;
}

export async function getLeadScoringByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get the most recent scoring record (ordered by id DESC) to ensure we get the one with actual data
  const result = await db.select().from(leadScoring).where(eq(leadScoring.leadId, leadId)).orderBy(desc(leadScoring.id)).limit(1);
  return result[0] || null;
}

// Find scoring by correo (fallback when leadId doesn't match)
export async function getLeadScoringByCorreo(correo: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(leadScoring).where(eq(leadScoring.correo, correo)).orderBy(desc(leadScoring.id)).limit(1);
  return result[0] || null;
}

export async function getAllLeadScoring(filters?: { scoreLabel?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (filters?.scoreLabel) conditions.push(eq(leadScoring.scoreLabel, filters.scoreLabel as any));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(leadScoring).where(where).orderBy(desc(leadScoring.createdAt));
}

// ==================== LEAD DATA ENTRIES (Universal Profile) ====================
export async function createLeadDataEntry(entry: InsertLeadDataEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(leadDataEntries).values(entry).returning({ id: leadDataEntries.id });
  return result.id;
}

export async function getLeadDataEntries(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(leadDataEntries)
    .where(eq(leadDataEntries.leadId, leadId))
    .orderBy(desc(leadDataEntries.createdAt));
}

export async function getLatestLeadDataEntry(leadId: number, source?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [eq(leadDataEntries.leadId, leadId)];
  if (source) conditions.push(eq(leadDataEntries.source, source));
  const [result] = await db.select().from(leadDataEntries)
    .where(and(...conditions))
    .orderBy(desc(leadDataEntries.createdAt))
    .limit(1);
  return result ?? null;
}

// ==================== SETTER ACTIVITIES ====================
export async function createSetterActivity(activity: InsertSetterActivity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(setterActivities).values(activity).returning({ id: setterActivities.id });
  return result.id;
}

export async function getSetterActivities(filters?: {
  setter?: string;
  mes?: string;
  semana?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (filters?.setter) conditions.push(eq(setterActivities.setter, filters.setter));
  if (filters?.mes) conditions.push(eq(setterActivities.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(setterActivities.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(setterActivities).where(where).orderBy(desc(setterActivities.fecha));
}

export async function updateSetterActivity(id: number, data: Partial<InsertSetterActivity>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(setterActivities).set({ ...data, updatedAt: new Date() }).where(eq(setterActivities.id, id));
}

export async function bulkDeleteSetterActivities(ids: number[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(setterActivities).where(inArray(setterActivities.id, ids));
}

export async function deleteSetterActivity(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(setterActivities).where(eq(setterActivities.id, id));
}

// ==================== CLOSER ACTIVITIES ====================
export async function createCloserActivity(activity: InsertCloserActivity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(closerActivities).values(activity).returning({ id: closerActivities.id });
  return result.id;
}

export async function getCloserActivities(filters?: {
  closer?: string;
  mes?: string;
  semana?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (filters?.closer) conditions.push(eq(closerActivities.closer, filters.closer));
  if (filters?.mes) conditions.push(eq(closerActivities.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(closerActivities.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(closerActivities).where(where).orderBy(desc(closerActivities.fecha));
}

export async function updateCloserActivity(id: number, data: Partial<InsertCloserActivity>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(closerActivities).set({ ...data, updatedAt: new Date() }).where(eq(closerActivities.id, id));
}

export async function bulkDeleteCloserActivities(ids: number[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(closerActivities).where(inArray(closerActivities.id, ids));
}

export async function deleteCloserActivity(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(closerActivities).where(eq(closerActivities.id, id));
}

// ==================== MONTHLY METRICS ====================
export async function upsertMonthlyMetrics(data: InsertMonthlyMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(monthlyMetrics).values(data).onConflictDoUpdate({
    target: [monthlyMetrics.mes, monthlyMetrics.anio],
    set: {
      adSpend: data.adSpend,
      totalLeads: data.totalLeads,
      totalLeadsRaw: data.totalLeadsRaw,
      visitasLandingPage: data.visitasLandingPage,
      ctrUnico: data.ctrUnico,
      ctr: data.ctr,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get current month metrics (for MTD Ad Spend quick access)
 */
export async function getCurrentMonthMetrics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const mesActual = MESES[now.getMonth()];
  const anioActual = now.getFullYear();
  const result = await db.select().from(monthlyMetrics)
    .where(and(eq(monthlyMetrics.mes, mesActual), eq(monthlyMetrics.anio, anioActual)))
    .limit(1);
  return result[0] || null;
}

const MESES_ARRAY = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/**
 * Aggregate ad metrics from ad_metrics_daily for a given month.
 * This is the source of truth for ad spend — uses real Meta Ads data synced daily by CronSync.
 */
export async function aggregateAdMetricsForMonth(mes: string, anio: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const mesNum = MESES_ARRAY.indexOf(mes) + 1;
  if (mesNum === 0) return null;

  const dateFrom = new Date(`${anio}-${String(mesNum).padStart(2, "0")}-01T00:00:00`);
  const lastDay = new Date(anio, mesNum, 0).getDate();
  const dateTo = new Date(`${anio}-${String(mesNum).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59`);

  const result = await db.select({
    totalSpend: sql<number>`COALESCE(SUM(CAST(${adMetricsDaily.spend} AS DECIMAL(10,2))), 0)`,
    totalLeads: sql<number>`COALESCE(SUM(${adMetricsDaily.leads}), 0)`,
    totalImpressions: sql<number>`COALESCE(SUM(${adMetricsDaily.impressions}), 0)`,
    totalClicks: sql<number>`COALESCE(SUM(${adMetricsDaily.clicks}), 0)`,
    totalReach: sql<number>`COALESCE(SUM(${adMetricsDaily.reach}), 0)`,
    totalLinkClicks: sql<number>`COALESCE(SUM(${adMetricsDaily.linkClicks}), 0)`,
  }).from(adMetricsDaily)
    .where(and(gte(adMetricsDaily.fecha, dateFrom), lte(adMetricsDaily.fecha, dateTo)));

  const row = result[0];
  const totalClicks = Number(row.totalClicks);
  const totalImpressions = Number(row.totalImpressions);

  // Convert from account currency (e.g. CLP) to USD using real-time rate
  const divisor = await getAdSpendDivisor();

  return {
    adSpend: Number(row.totalSpend) / divisor,
    totalLeadsRaw: Number(row.totalLeads),
    totalImpressions,
    totalClicks,
    totalReach: Number(row.totalReach),
    totalLinkClicks: Number(row.totalLinkClicks),
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
  };
}

/**
 * Get real ad metrics for a specific week (days 1-7, 8-14, etc.) from ad_metrics_daily.
 * Replaces the old prorating logic that assumed uniform spend distribution.
 */
export async function getWeeklyAdMetrics(mes: string, semana: number, anio: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const mesNum = MESES_ARRAY.indexOf(mes) + 1;
  if (mesNum === 0) return null;

  const dayStart = (semana - 1) * 7 + 1;
  const lastDayOfMonth = new Date(anio, mesNum, 0).getDate();
  const dayEnd = Math.min(semana * 7, lastDayOfMonth);

  const dateFrom = new Date(`${anio}-${String(mesNum).padStart(2, "0")}-${String(dayStart).padStart(2, "0")}T00:00:00`);
  const dateTo = new Date(`${anio}-${String(mesNum).padStart(2, "0")}-${String(dayEnd).padStart(2, "0")}T23:59:59`);

  const result = await db.select({
    totalSpend: sql<number>`COALESCE(SUM(CAST(${adMetricsDaily.spend} AS DECIMAL(10,2))), 0)`,
    totalLeads: sql<number>`COALESCE(SUM(${adMetricsDaily.leads}), 0)`,
    totalClicks: sql<number>`COALESCE(SUM(${adMetricsDaily.clicks}), 0)`,
    totalImpressions: sql<number>`COALESCE(SUM(${adMetricsDaily.impressions}), 0)`,
  }).from(adMetricsDaily)
    .where(and(gte(adMetricsDaily.fecha, dateFrom), lte(adMetricsDaily.fecha, dateTo)));

  return result[0];
}

/**
 * Get marketing KPIs calculated from leads data + ad_metrics_daily (real Meta data) for a given period.
 * Falls back to monthly_metrics for historical months without daily ad data.
 */
export async function getMarketingKPIs(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get lead-based metrics for the filtered period
  const conditions = [];
  if (filters?.mes) conditions.push(eq(leads.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(leads.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const leadStats = await db.select({
    totalAgendas: sql<number>`COUNT(*)`,
    contestados: sql<number>`SUM(CASE WHEN ${leads.resultadoContacto} = 'CONTESTÓ' THEN 1 ELSE 0 END)`,
    introsEfectivas: sql<number>`SUM(CASE WHEN ${leads.resultadoContacto} = 'CONTESTÓ' AND ${leads.validoParaContacto} = 'SÍ' THEN 1 ELSE 0 END)`,
    triageCompletados: sql<number>`SUM(CASE WHEN ${leads.triage} = 'COMPLETADO' THEN 1 ELSE 0 END)`,
    demosConfirmadas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'CONFIRMADA' THEN 1 ELSE 0 END)`,
    demosAsistidas: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'ASISTIÓ' THEN 1 ELSE 0 END)`,
    ofertasHechas: sql<number>`SUM(CASE WHEN ${leads.ofertaHecha} = 'SÍ' THEN 1 ELSE 0 END)`,
    ventas: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN 1 ELSE 0 END)`,
    totalRevenue: sql<number>`SUM(CAST(${leads.facturado} AS DECIMAL(10,2)))`,
    totalCash: sql<number>`SUM(CAST(${leads.cashCollected} AS DECIMAL(10,2)))`,
    totalDeposito: sql<number>`SUM(CAST(${leads.deposito} AS DECIMAL(10,2)))`,
    totalContractedRevenue: sql<number>`SUM(CAST(${leads.contractedRevenue} AS DECIMAL(10,2)))`,
    calificados: sql<number>`SUM(CASE WHEN ${leads.califica} = 'SÍ' THEN 1 ELSE 0 END)`,
    noCalificados: sql<number>`SUM(CASE WHEN ${leads.califica} = 'NO' THEN 1 ELSE 0 END)`,
  }).from(leads).where(where);

  // Determine which month/year to use for ad metrics
  const now = new Date();
  const targetMes = filters?.mes || MESES_ARRAY[now.getMonth()];
  const anio = now.getFullYear();

  // Try to get REAL ad metrics from ad_metrics_daily (synced from Meta Ads by CronSync)
  let adSpend = 0;
  let totalLeadsRaw = 0;
  let ctr = 0;
  let ctrUnico = 0;
  let visitasLandingPage = 0;

  if (filters?.semana) {
    // Weekly: query actual daily ad data for the specific week's date range
    const weeklyData = await getWeeklyAdMetrics(targetMes, filters.semana, anio);
    if (weeklyData && Number(weeklyData.totalSpend) > 0) {
      const weeklyDivisor = await getAdSpendDivisor();
      adSpend = Number(weeklyData.totalSpend) / weeklyDivisor;
      totalLeadsRaw = Number(weeklyData.totalLeads);
      const impressions = Number(weeklyData.totalImpressions);
      ctr = impressions > 0 ? (Number(weeklyData.totalClicks) / impressions) * 100 : 0;
    }
  } else {
    // Monthly: aggregate all daily data for the month
    const monthlyData = await aggregateAdMetricsForMonth(targetMes, anio);
    if (monthlyData && monthlyData.adSpend > 0) {
      adSpend = monthlyData.adSpend;
      totalLeadsRaw = monthlyData.totalLeadsRaw;
      ctr = monthlyData.ctr;
    }
  }

  // Fallback to manual monthly_metrics if no daily ad data exists (historical months pre-CronSync)
  if (adSpend === 0) {
    const metricsResult = await db.select().from(monthlyMetrics)
      .where(and(eq(monthlyMetrics.mes, targetMes), eq(monthlyMetrics.anio, anio)))
      .limit(1);
    const fallback = metricsResult[0] || null;
    if (fallback) {
      adSpend = Number(fallback.adSpend || 0);
      totalLeadsRaw = Number(fallback.totalLeadsRaw || 0);
      visitasLandingPage = Number(fallback.visitasLandingPage || 0);
      ctrUnico = Number(fallback.ctrUnico || 0);
      ctr = Number(fallback.ctr || 0);
    }
  }

  return {
    ...leadStats[0],
    adSpend,
    totalLeadsRaw,
    visitasLandingPage,
    ctrUnico,
    ctr,
  };
}

export async function getMonthlyMetrics(anio?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (anio) {
    return db.select().from(monthlyMetrics).where(eq(monthlyMetrics.anio, anio)).orderBy(asc(monthlyMetrics.mes));
  }
  return db.select().from(monthlyMetrics).orderBy(desc(monthlyMetrics.anio), asc(monthlyMetrics.mes));
}

// ==================== DASHBOARD KPIs ====================
export async function getDashboardKPIs(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  if (filters?.mes) conditions.push(eq(leads.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(leads.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db.select({
    totalLeads: sql<number>`COUNT(*)`,
    contestados: sql<number>`SUM(CASE WHEN ${leads.resultadoContacto} = 'CONTESTÓ' THEN 1 ELSE 0 END)`,
    demosConfirmadas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'CONFIRMADA' THEN 1 ELSE 0 END)`,
    demosAsistidas: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'ASISTIÓ' THEN 1 ELSE 0 END)`,
    ofertasHechas: sql<number>`SUM(CASE WHEN ${leads.ofertaHecha} = 'SÍ' THEN 1 ELSE 0 END)`,
    ventas: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN 1 ELSE 0 END)`,
    totalRevenue: sql<number>`SUM(CAST(${leads.facturado} AS DECIMAL(10,2)))`,
    totalCash: sql<number>`SUM(CAST(${leads.cashCollected} AS DECIMAL(10,2)))`,
    totalDeposito: sql<number>`SUM(CAST(${leads.deposito} AS DECIMAL(10,2)))`,
    seguimientos: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'SEGUIMIENTO' THEN 1 ELSE 0 END)`,
    noShow: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'NO SHOW' THEN 1 ELSE 0 END)`,
    leadsAds: sql<number>`SUM(CASE WHEN ${leads.origen} = 'ADS' THEN 1 ELSE 0 END)`,
    leadsReferido: sql<number>`SUM(CASE WHEN ${leads.origen} = 'REFERIDO' THEN 1 ELSE 0 END)`,
    leadsOrganico: sql<number>`SUM(CASE WHEN ${leads.origen} = 'ORGANICO' THEN 1 ELSE 0 END)`,
    leadsInstagram: sql<number>`SUM(CASE WHEN ${leads.origen} = 'INSTAGRAM' THEN 1 ELSE 0 END)`,
    // Product type aggregation
    ventasPIF: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' AND ${leads.productoTipo} = 'PIF' THEN 1 ELSE 0 END)`,
    ventasSetupMonthly: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' AND ${leads.productoTipo} = 'SETUP_MONTHLY' THEN 1 ELSE 0 END)`,
    totalSetupFees: sql<number>`SUM(CASE WHEN ${leads.productoTipo} = 'SETUP_MONTHLY' THEN CAST(${leads.setupFee} AS DECIMAL(10,2)) ELSE 0 END)`,
    totalRecurrenciaMensual: sql<number>`SUM(CASE WHEN ${leads.productoTipo} = 'SETUP_MONTHLY' THEN CAST(${leads.recurrenciaMensual} AS DECIMAL(10,2)) ELSE 0 END)`,
    hot: sql<number>`SUM(CASE WHEN ${leads.scoreLabel} = 'HOT' THEN 1 ELSE 0 END)`,
    warm: sql<number>`SUM(CASE WHEN ${leads.scoreLabel} = 'WARM' THEN 1 ELSE 0 END)`,
    tibio: sql<number>`SUM(CASE WHEN ${leads.scoreLabel} = 'TIBIO' THEN 1 ELSE 0 END)`,
    frio: sql<number>`SUM(CASE WHEN ${leads.scoreLabel} = 'FRÍO' THEN 1 ELSE 0 END)`,
    // Intro metrics
    totalIntros: sql<number>`SUM(CASE WHEN ${leads.tipo} = 'INTRO' THEN 1 ELSE 0 END)`,
    totalDemos: sql<number>`SUM(CASE WHEN ${leads.tipo} = 'DEMO' THEN 1 ELSE 0 END)`,
    introsConvertidas: sql<number>`SUM(CASE WHEN ${leads.tipo} = 'DEMO' AND ${leads.fechaIntro} IS NOT NULL THEN 1 ELSE 0 END)`,
  }).from(leads).where(where);

  return result[0];
}

// ==================== LEADERBOARD ====================
export async function getSetterLeaderboard(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (filters?.mes) conditions.push(eq(setterActivities.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(setterActivities.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.select({
    setter: setterActivities.setter,
    totalIntentos: sql<number>`SUM(${setterActivities.intentosLlamada})`,
    totalIntros: sql<number>`SUM(${setterActivities.introsEfectivas})`,
    totalDemosAseguradas: sql<number>`SUM(${setterActivities.demosAseguradasConIntro})`,
    totalCalendario: sql<number>`SUM(${setterActivities.demosEnCalendario})`,
    totalConfirmadas: sql<number>`SUM(${setterActivities.demosConfirmadas})`,
    totalAsistidas: sql<number>`SUM(${setterActivities.demosAsistidas})`,
    totalCierres: sql<number>`SUM(${setterActivities.cierresAtribuidos})`,
    totalRevenue: sql<number>`SUM(CAST(${setterActivities.revenueAtribuido} AS DECIMAL(10,2)))`,
    totalCash: sql<number>`SUM(CAST(${setterActivities.cashAtribuido} AS DECIMAL(10,2)))`,
    totalIntroAgendadas: sql<number>`SUM(${setterActivities.introAgendadas})`,
    totalIntroLive: sql<number>`SUM(${setterActivities.introLive})`,
    totalIntroADemo: sql<number>`SUM(${setterActivities.introADemo})`,
    dias: sql<number>`COUNT(*)`,
  }).from(setterActivities).where(where).groupBy(setterActivities.setter).orderBy(sql`SUM(${setterActivities.demosAsistidas}) DESC`);
}

export async function getCloserLeaderboard(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (filters?.mes) conditions.push(eq(closerActivities.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(closerActivities.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.select({
    closer: closerActivities.closer,
    totalSchedule: sql<number>`SUM(${closerActivities.scheduleCalls})`,
    totalLive: sql<number>`SUM(${closerActivities.liveCalls})`,
    totalOffers: sql<number>`SUM(${closerActivities.offers})`,
    totalDeposits: sql<number>`SUM(${closerActivities.deposits})`,
    totalCloses: sql<number>`SUM(${closerActivities.closes})`,
    totalPiffRevenue: sql<number>`SUM(CAST(${closerActivities.piffRevenue} AS DECIMAL(10,2)))`,
    totalPiffCash: sql<number>`SUM(CAST(${closerActivities.piffCash} AS DECIMAL(10,2)))`,
    totalSetupRevenue: sql<number>`SUM(CAST(${closerActivities.setupRevenue} AS DECIMAL(10,2)))`,
    totalSetupCash: sql<number>`SUM(CAST(${closerActivities.setupCash} AS DECIMAL(10,2)))`,
    dias: sql<number>`COUNT(*)`,
  }).from(closerActivities).where(where).groupBy(closerActivities.closer).orderBy(sql`SUM(${closerActivities.closes}) DESC`);
}

// ==================== DISTINCT VALUES (for filters) ====================
export async function getDistinctValues() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [meses, setters, closers, setterAct, closerAct] = await Promise.all([
    db.selectDistinct({ mes: leads.mes }).from(leads).where(sql`${leads.mes} IS NOT NULL`),
    db.selectDistinct({ setter: leads.setterAsignado }).from(leads).where(sql`${leads.setterAsignado} IS NOT NULL`),
    db.selectDistinct({ closer: leads.closer }).from(leads).where(sql`${leads.closer} IS NOT NULL`),
    db.selectDistinct({ setter: setterActivities.setter }).from(setterActivities),
    db.selectDistinct({ closer: closerActivities.closer }).from(closerActivities),
  ]);

  const allSetters = Array.from(new Set([...setters.map(s => s.setter), ...setterAct.map(s => s.setter)].filter(Boolean)));
  const allClosers = Array.from(new Set([...closers.map(c => c.closer), ...closerAct.map(c => c.closer)].filter(Boolean)));

  return {
    meses: meses.map(m => m.mes).filter(Boolean) as string[],
    setters: allSetters as string[],
    closers: allClosers as string[],
  };
}

// ==================== TRACKER-BASED KPIs FOR DASHBOARD ====================
/**
 * Get setter tracker aggregates for dashboard rates (Answer Rate, Triage Rate)
 * Source of truth: setter_activities table
 */
export async function getSetterTrackerKPIs(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  if (filters?.mes) conditions.push(eq(setterActivities.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(setterActivities.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db.select({
    totalIntentos: sql<number>`COALESCE(SUM(${setterActivities.intentosLlamada}), 0)`,
    totalIntros: sql<number>`COALESCE(SUM(${setterActivities.introsEfectivas}), 0)`,
    totalDemosAseguradas: sql<number>`COALESCE(SUM(${setterActivities.demosAseguradasConIntro}), 0)`,
    totalCalendario: sql<number>`COALESCE(SUM(${setterActivities.demosEnCalendario}), 0)`,
    totalConfirmadas: sql<number>`COALESCE(SUM(${setterActivities.demosConfirmadas}), 0)`,
    totalAsistidas: sql<number>`COALESCE(SUM(${setterActivities.demosAsistidas}), 0)`,
    totalCierres: sql<number>`COALESCE(SUM(${setterActivities.cierresAtribuidos}), 0)`,
    totalRevenue: sql<number>`COALESCE(SUM(CAST(${setterActivities.revenueAtribuido} AS DECIMAL(10,2))), 0)`,
    totalCash: sql<number>`COALESCE(SUM(CAST(${setterActivities.cashAtribuido} AS DECIMAL(10,2))), 0)`,
    totalIntroAgendadas: sql<number>`COALESCE(SUM(${setterActivities.introAgendadas}), 0)`,
    totalIntroLive: sql<number>`COALESCE(SUM(${setterActivities.introLive}), 0)`,
    totalIntroADemo: sql<number>`COALESCE(SUM(${setterActivities.introADemo}), 0)`,
  }).from(setterActivities).where(where);

  const row = result[0];
  const dqCount = Number(row.totalIntros) - Number(row.totalDemosAseguradas);
  const dqRate = Number(row.totalIntros) > 0 ? (dqCount / Number(row.totalIntros)) * 100 : 0;
  return {
    ...row,
    dqCount: dqCount > 0 ? dqCount : 0,
    dqRate: dqRate > 0 ? dqRate : 0,
  };
}

/**
 * Get closer tracker aggregates for dashboard rates (Show Rate, Offer Rate, Close Rate)
 * and financial KPIs (Revenue, Cash, Ticket Promedio)
 * Source of truth: closer_activities table
 */
export async function getCloserTrackerKPIs(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  if (filters?.mes) conditions.push(eq(closerActivities.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(closerActivities.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db.select({
    totalSchedule: sql<number>`COALESCE(SUM(${closerActivities.scheduleCalls}), 0)`,
    totalLive: sql<number>`COALESCE(SUM(${closerActivities.liveCalls}), 0)`,
    totalOffers: sql<number>`COALESCE(SUM(${closerActivities.offers}), 0)`,
    totalDeposits: sql<number>`COALESCE(SUM(${closerActivities.deposits}), 0)`,
    totalCloses: sql<number>`COALESCE(SUM(${closerActivities.closes}), 0)`,
    totalPiffRevenue: sql<number>`COALESCE(SUM(CAST(${closerActivities.piffRevenue} AS DECIMAL(10,2))), 0)`,
    totalPiffCash: sql<number>`COALESCE(SUM(CAST(${closerActivities.piffCash} AS DECIMAL(10,2))), 0)`,
    totalSetupRevenue: sql<number>`COALESCE(SUM(CAST(${closerActivities.setupRevenue} AS DECIMAL(10,2))), 0)`,
    totalSetupCash: sql<number>`COALESCE(SUM(CAST(${closerActivities.setupCash} AS DECIMAL(10,2))), 0)`,
  }).from(closerActivities).where(where);

  const row = result[0];
  const totalRevenue = Number(row.totalPiffRevenue) + Number(row.totalSetupRevenue);
  const totalCash = Number(row.totalPiffCash) + Number(row.totalSetupCash);
  const noShow = Number(row.totalSchedule) - Number(row.totalLive);
  return {
    ...row,
    totalRevenue,
    totalCash,
    noShow: noShow > 0 ? noShow : 0,
  };
}

// ==================== DATA VALIDATION (Cross-check trackers vs leads) ====================

/**
 * Compare tracker data against leads data to detect discrepancies.
 * Returns warnings when metrics differ by >10%.
 */
export async function getDataValidation(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Lead-based metrics (automated/webhook source)
  const lConditions = [];
  if (filters?.mes) lConditions.push(eq(leads.mes, filters.mes));
  if (filters?.semana) lConditions.push(eq(leads.semana, filters.semana));
  const lWhere = lConditions.length > 0 ? and(...lConditions) : undefined;

  const leadStats = await db.select({
    ventasLeads: sql<number>`COALESCE(SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN 1 ELSE 0 END), 0)`,
    revenueLeads: sql<number>`COALESCE(SUM(CAST(${leads.facturado} AS DECIMAL(10,2))), 0)`,
    confirmadasLeads: sql<number>`COALESCE(SUM(CASE WHEN ${leads.estadoConfirmacion} = 'CONFIRMADA' THEN 1 ELSE 0 END), 0)`,
    ofertasLeads: sql<number>`COALESCE(SUM(CASE WHEN ${leads.ofertaHecha} = 'SÍ' THEN 1 ELSE 0 END), 0)`,
  }).from(leads).where(lWhere);

  // Setter tracker metrics (manual)
  const stConditions: any[] = [];
  if (filters?.mes) stConditions.push(eq(setterActivities.mes, filters.mes));
  if (filters?.semana) stConditions.push(eq(setterActivities.semana, filters.semana));
  const stWhere = stConditions.length > 0 ? and(...stConditions) : undefined;

  const setterStats = await db.select({
    confirmadasTracker: sql<number>`COALESCE(SUM(${setterActivities.demosConfirmadas}), 0)`,
  }).from(setterActivities).where(stWhere);

  // Closer tracker metrics (manual)
  const ctConditions: any[] = [];
  if (filters?.mes) ctConditions.push(eq(closerActivities.mes, filters.mes));
  if (filters?.semana) ctConditions.push(eq(closerActivities.semana, filters.semana));
  const ctWhere = ctConditions.length > 0 ? and(...ctConditions) : undefined;

  const closerStats = await db.select({
    closesTracker: sql<number>`COALESCE(SUM(${closerActivities.closes}), 0)`,
    revenueTracker: sql<number>`COALESCE(SUM(CAST(${closerActivities.piffRevenue} AS DECIMAL(10,2))) + SUM(CAST(${closerActivities.setupRevenue} AS DECIMAL(10,2))), 0)`,
    offersTracker: sql<number>`COALESCE(SUM(${closerActivities.offers}), 0)`,
  }).from(closerActivities).where(ctWhere);

  const l = leadStats[0];
  const s = setterStats[0];
  const c = closerStats[0];

  const warnings: Array<{ metric: string; leads: number; tracker: number; diff: number; severity: "warning" | "critical" }> = [];

  const checks = [
    { metric: "Ventas/Cierres", leads: Number(l.ventasLeads), tracker: Number(c.closesTracker) },
    { metric: "Revenue ($)", leads: Number(l.revenueLeads), tracker: Number(c.revenueTracker) },
    { metric: "Demos Confirmadas", leads: Number(l.confirmadasLeads), tracker: Number(s.confirmadasTracker) },
    { metric: "Ofertas", leads: Number(l.ofertasLeads), tracker: Number(c.offersTracker) },
  ];

  for (const check of checks) {
    if (check.leads === 0 && check.tracker === 0) continue;
    const max = Math.max(check.leads, check.tracker);
    const diff = Math.abs(check.leads - check.tracker);
    const pct = max > 0 ? (diff / max) * 100 : 0;
    if (pct > 10) {
      warnings.push({
        metric: check.metric,
        leads: check.leads,
        tracker: check.tracker,
        diff,
        severity: pct > 30 ? "critical" : "warning",
      });
    }
  }

  return { warnings };
}

// ==================== CLOSER PROJECTIONS ====================

export async function createCloserProjection(data: InsertCloserProjection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Calculate derived fields from targets
  const scheduledCallsTarget = data.scheduledCallsTarget ?? 0;
  const showRate = Number(data.showRateTarget ?? 0) / 100;
  const offerRate = Number(data.offerRateTarget ?? 0) / 100;
  const closeRate = Number(data.closeRateTarget ?? 0) / 100;
  
  const projectedLiveCalls = Math.round(scheduledCallsTarget * showRate);
  const projectedOffers = Math.round(projectedLiveCalls * offerRate);
  const projectedCloses = Math.round(projectedOffers * closeRate);
  
  const [result] = await db.insert(closerProjections).values({
    ...data,
    projectedLiveCalls,
    projectedOffers,
    projectedCloses,
  }).returning({ id: closerProjections.id });

  return result.id;
}

export async function getCloserProjections(filters?: { mes?: string; anio?: number; closer?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions = [];
  if (filters?.mes) conditions.push(eq(closerProjections.mes, filters.mes));
  if (filters?.anio) conditions.push(eq(closerProjections.anio, filters.anio));
  if (filters?.closer) conditions.push(eq(closerProjections.closer, filters.closer));
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(closerProjections).where(where).orderBy(desc(closerProjections.createdAt));
}

export async function getCloserProjectionById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const rows = await db.select().from(closerProjections).where(eq(closerProjections.id, id));
  return rows[0] ?? null;
}

export async function updateCloserProjection(id: number, data: Partial<InsertCloserProjection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Recalculate projections if targets changed
  const updateData: any = { ...data };
  if (data.scheduledCallsTarget !== undefined || data.showRateTarget !== undefined || data.offerRateTarget !== undefined || data.closeRateTarget !== undefined) {
    const existing = await getCloserProjectionById(id);
    if (existing) {
      const scheduledCallsTarget = data.scheduledCallsTarget ?? existing.scheduledCallsTarget ?? 0;
      const showRate = Number(data.showRateTarget ?? existing.showRateTarget ?? 0) / 100;
      const offerRate = Number(data.offerRateTarget ?? existing.offerRateTarget ?? 0) / 100;
      const closeRate = Number(data.closeRateTarget ?? existing.closeRateTarget ?? 0) / 100;
      
      updateData.projectedLiveCalls = Math.round(scheduledCallsTarget * showRate);
      updateData.projectedOffers = Math.round(updateData.projectedLiveCalls * offerRate);
      updateData.projectedCloses = Math.round(updateData.projectedOffers * closeRate);
    }
  }
  
  updateData.updatedAt = new Date();
  await db.update(closerProjections).set(updateData).where(eq(closerProjections.id, id));
}

export async function deleteCloserProjection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(closerProjections).where(eq(closerProjections.id, id));
}

// Get actual tracker data for a closer projection's date range and compare vs goals
export async function getCloserProjectionWithActuals(projectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const proj = await getCloserProjectionById(projectionId);
  if (!proj) return null;
  
  // Get actual closer_activities within the projection's week range
  let actuals: any[] = [];
  if (proj.weekStarting && proj.weekEnding) {
    actuals = await db.select().from(closerActivities)
      .where(and(
        eq(closerActivities.closer, proj.closer),
        gte(closerActivities.fecha, proj.weekStarting),
        lte(closerActivities.fecha, proj.weekEnding)
      ))
      .orderBy(asc(closerActivities.fecha));
  } else {
    // Fallback: match by mes + semana
    const conditions = [
      eq(closerActivities.closer, proj.closer),
      eq(closerActivities.mes, proj.mes),
    ];
    if (proj.semana) conditions.push(eq(closerActivities.semana, proj.semana));
    actuals = await db.select().from(closerActivities)
      .where(and(...conditions))
      .orderBy(asc(closerActivities.fecha));
  }
  
  // Aggregate actuals
  const totals = {
    scheduleCalls: actuals.reduce((s, a) => s + (a.scheduleCalls || 0), 0),
    liveCalls: actuals.reduce((s, a) => s + (a.liveCalls || 0), 0),
    offers: actuals.reduce((s, a) => s + (a.offers || 0), 0),
    deposits: actuals.reduce((s, a) => s + (a.deposits || 0), 0),
    closes: actuals.reduce((s, a) => s + (a.closes || 0), 0),
    piffRevenue: actuals.reduce((s, a) => s + Number(a.piffRevenue || 0), 0),
    piffCash: actuals.reduce((s, a) => s + Number(a.piffCash || 0), 0),
    setupRevenue: actuals.reduce((s, a) => s + Number(a.setupRevenue || 0), 0),
    setupCash: actuals.reduce((s, a) => s + Number(a.setupCash || 0), 0),
  };
  const totalRevenue = totals.piffRevenue + totals.setupRevenue;
  const totalCash = totals.piffCash + totals.setupCash;
  
  // Calculate pace status
  const daysWithData = actuals.length;
  const totalWorkDays = 5;
  const dayProgress = daysWithData / totalWorkDays;
  
  const bloodGoalCloses = proj.bloodGoalCloses ?? 0;
  const bloodGoalRevenue = Number(proj.bloodGoalRevenue ?? 0);
  const bloodGoalCash = Number(proj.bloodGoalCash ?? 0);
  const stretchGoalCloses = proj.stretchGoalCloses ?? 0;
  const stretchGoalRevenue = Number(proj.stretchGoalRevenue ?? 0);
  const stretchGoalCash = Number(proj.stretchGoalCash ?? 0);
  
  const expectedCloses = Math.round(bloodGoalCloses * dayProgress);
  const expectedRevenue = bloodGoalRevenue * dayProgress;
  const expectedCash = bloodGoalCash * dayProgress;
  
  const paceStatus = {
    closes: daysWithData === 0 ? 'pending' : totals.closes >= expectedCloses ? 'on_track' : 'off_track',
    revenue: daysWithData === 0 ? 'pending' : totalRevenue >= expectedRevenue ? 'on_track' : 'off_track',
    cash: daysWithData === 0 ? 'pending' : totalCash >= expectedCash ? 'on_track' : 'off_track',
  };
  
  const bloodHit = totals.closes >= bloodGoalCloses && bloodGoalCloses > 0;
  const stretchHit = totals.closes >= stretchGoalCloses && stretchGoalCloses > 0;
  
  return {
    projection: proj,
    actuals: actuals.map(a => ({
      fecha: a.fecha,
      scheduleCalls: a.scheduleCalls || 0,
      liveCalls: a.liveCalls || 0,
      offers: a.offers || 0,
      deposits: a.deposits || 0,
      closes: a.closes || 0,
      piffRevenue: Number(a.piffRevenue || 0),
      piffCash: Number(a.piffCash || 0),
      setupRevenue: Number(a.setupRevenue || 0),
      setupCash: Number(a.setupCash || 0),
    })),
    totals,
    totalRevenue,
    totalCash,
    daysWithData,
    dayProgress,
    expectedCloses,
    expectedRevenue,
    expectedCash,
    paceStatus,
    bloodHit,
    stretchHit,
  };
}

// ==================== SETTER PROJECTIONS ====================

export async function createSetterProjection(data: InsertSetterProjection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(setterProjections).values(data).returning({ id: setterProjections.id });
  return result.id;
}

export async function getSetterProjections(filters?: { mes?: string; anio?: number; setter?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions = [];
  if (filters?.mes) conditions.push(eq(setterProjections.mes, filters.mes));
  if (filters?.anio) conditions.push(eq(setterProjections.anio, filters.anio));
  if (filters?.setter) conditions.push(eq(setterProjections.setter, filters.setter));
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(setterProjections).where(where).orderBy(desc(setterProjections.createdAt));
}

export async function getSetterProjectionById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const rows = await db.select().from(setterProjections).where(eq(setterProjections.id, id));
  return rows[0] ?? null;
}

export async function updateSetterProjection(id: number, data: Partial<InsertSetterProjection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(setterProjections).set({ ...data, updatedAt: new Date() }).where(eq(setterProjections.id, id));
}

export async function deleteSetterProjection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(setterProjections).where(eq(setterProjections.id, id));
}

// Get actual tracker data for a setter projection's date range and compare vs goals
export async function getSetterProjectionWithActuals(projectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const proj = await getSetterProjectionById(projectionId);
  if (!proj) return null;
  
  // Get actual setter_activities within the projection's week range
  let actuals: any[] = [];
  if (proj.weekStarting && proj.weekEnding) {
    actuals = await db.select().from(setterActivities)
      .where(and(
        eq(setterActivities.setter, proj.setter),
        gte(setterActivities.fecha, proj.weekStarting),
        lte(setterActivities.fecha, proj.weekEnding)
      ))
      .orderBy(asc(setterActivities.fecha));
  } else {
    const conditions = [
      eq(setterActivities.setter, proj.setter),
      eq(setterActivities.mes, proj.mes),
    ];
    if (proj.semana) conditions.push(eq(setterActivities.semana, proj.semana));
    actuals = await db.select().from(setterActivities)
      .where(and(...conditions))
      .orderBy(asc(setterActivities.fecha));
  }
  
  // Aggregate actuals
  const totals = {
    intentosLlamada: actuals.reduce((s, a) => s + (a.intentosLlamada || 0), 0),
    introsEfectivas: actuals.reduce((s, a) => s + (a.introsEfectivas || 0), 0),
    demosAseguradasConIntro: actuals.reduce((s, a) => s + (a.demosAseguradasConIntro || 0), 0),
    demosEnCalendario: actuals.reduce((s, a) => s + (a.demosEnCalendario || 0), 0),
    demosConfirmadas: actuals.reduce((s, a) => s + (a.demosConfirmadas || 0), 0),
    demosAsistidas: actuals.reduce((s, a) => s + (a.demosAsistidas || 0), 0),
    cierresAtribuidos: actuals.reduce((s, a) => s + (a.cierresAtribuidos || 0), 0),
    revenueAtribuido: actuals.reduce((s, a) => s + Number(a.revenueAtribuido || 0), 0),
    cashAtribuido: actuals.reduce((s, a) => s + Number(a.cashAtribuido || 0), 0),
  };
  
  // Calculate pace status
  const daysWithData = actuals.length;
  const totalWorkDays = 5;
  const dayProgress = daysWithData / totalWorkDays;
  
  const bloodGoalDemos = proj.bloodGoalDemosAsistidas ?? 0;
  const bloodGoalCierres = proj.bloodGoalCierres ?? 0;
  const bloodGoalRevenue = Number(proj.bloodGoalRevenue ?? 0);
  const bloodGoalCash = Number(proj.bloodGoalCash ?? 0);
  const stretchGoalDemos = proj.stretchGoalDemosAsistidas ?? 0;
  const stretchGoalCierres = proj.stretchGoalCierres ?? 0;
  
  const expectedDemos = Math.round(bloodGoalDemos * dayProgress);
  const expectedCierres = Math.round(bloodGoalCierres * dayProgress);
  const expectedRevenue = bloodGoalRevenue * dayProgress;
  
  const paceStatus = {
    demosAsistidas: daysWithData === 0 ? 'pending' : totals.demosAsistidas >= expectedDemos ? 'on_track' : 'off_track',
    cierres: daysWithData === 0 ? 'pending' : totals.cierresAtribuidos >= expectedCierres ? 'on_track' : 'off_track',
    revenue: daysWithData === 0 ? 'pending' : totals.revenueAtribuido >= expectedRevenue ? 'on_track' : 'off_track',
  };
  
  const bloodHit = totals.demosAsistidas >= bloodGoalDemos && bloodGoalDemos > 0;
  const stretchHit = totals.demosAsistidas >= stretchGoalDemos && stretchGoalDemos > 0;
  
  return {
    projection: proj,
    actuals: actuals.map(a => ({
      fecha: a.fecha,
      intentosLlamada: a.intentosLlamada || 0,
      introsEfectivas: a.introsEfectivas || 0,
      demosAseguradasConIntro: a.demosAseguradasConIntro || 0,
      demosEnCalendario: a.demosEnCalendario || 0,
      demosConfirmadas: a.demosConfirmadas || 0,
      demosAsistidas: a.demosAsistidas || 0,
      cierresAtribuidos: a.cierresAtribuidos || 0,
      revenueAtribuido: Number(a.revenueAtribuido || 0),
      cashAtribuido: Number(a.cashAtribuido || 0),
    })),
    totals,
    daysWithData,
    dayProgress,
    expectedDemos,
    expectedCierres,
    expectedRevenue,
    paceStatus,
    bloodHit,
    stretchHit,
  };
}


// ==================== P9: WEIGHTED LEADERBOARD ====================
export async function getWeightedSetterLeaderboard(filters?: { mes?: string; semana?: number }, weights?: { intentos?: number; intros?: number; asistidas?: number; cierres?: number; revenue?: number }) {
  const raw = await getSetterLeaderboard(filters);
  if (!raw.length) return [];
  const w = { intentos: weights?.intentos ?? 10, intros: weights?.intros ?? 15, asistidas: weights?.asistidas ?? 30, cierres: weights?.cierres ?? 25, revenue: weights?.revenue ?? 20 };
  // Normalize each metric across reps (0-100 scale)
  const maxVals = {
    intentos: Math.max(...raw.map(r => Number(r.totalIntentos) || 1)),
    intros: Math.max(...raw.map(r => Number(r.totalIntros) || 1)),
    asistidas: Math.max(...raw.map(r => Number(r.totalAsistidas) || 1)),
    cierres: Math.max(...raw.map(r => Number(r.totalCierres) || 1)),
    revenue: Math.max(...raw.map(r => Number(r.totalRevenue) || 1)),
  };
  return raw.map(r => {
    const scores = {
      intentos: (Number(r.totalIntentos) / maxVals.intentos) * 100,
      intros: (Number(r.totalIntros) / maxVals.intros) * 100,
      asistidas: (Number(r.totalAsistidas) / maxVals.asistidas) * 100,
      cierres: (Number(r.totalCierres) / maxVals.cierres) * 100,
      revenue: (Number(r.totalRevenue) / maxVals.revenue) * 100,
    };
    const weightedScore = (scores.intentos * w.intentos + scores.intros * w.intros + scores.asistidas * w.asistidas + scores.cierres * w.cierres + scores.revenue * w.revenue) / 100;
    return { ...r, scores, weightedScore };
  }).sort((a, b) => b.weightedScore - a.weightedScore);
}

export async function getWeightedCloserLeaderboard(filters?: { mes?: string; semana?: number }, weights?: { closes?: number; revenue?: number; cash?: number; closeRate?: number; showRate?: number }) {
  const raw = await getCloserLeaderboard(filters);
  if (!raw.length) return [];
  const w = { closes: weights?.closes ?? 30, revenue: weights?.revenue ?? 20, cash: weights?.cash ?? 15, closeRate: weights?.closeRate ?? 20, showRate: weights?.showRate ?? 15 };
  const maxVals = {
    closes: Math.max(...raw.map(r => Number(r.totalCloses) || 1)),
    revenue: Math.max(...raw.map(r => Number(r.totalPiffRevenue) + Number(r.totalSetupRevenue) || 1)),
    cash: Math.max(...raw.map(r => Number(r.totalPiffCash) + Number(r.totalSetupCash) || 1)),
  };
  return raw.map(r => {
    const totalRev = Number(r.totalPiffRevenue) + Number(r.totalSetupRevenue);
    const totalCash = Number(r.totalPiffCash) + Number(r.totalSetupCash);
    const closeRate = Number(r.totalOffers) > 0 ? (Number(r.totalCloses) / Number(r.totalOffers)) * 100 : 0;
    const showRate = Number(r.totalSchedule) > 0 ? (Number(r.totalLive) / Number(r.totalSchedule)) * 100 : 0;
    const scores = {
      closes: (Number(r.totalCloses) / maxVals.closes) * 100,
      revenue: (totalRev / maxVals.revenue) * 100,
      cash: (totalCash / maxVals.cash) * 100,
      closeRate: Math.min(closeRate, 100),
      showRate: Math.min(showRate, 100),
    };
    const weightedScore = (scores.closes * w.closes + scores.revenue * w.revenue + scores.cash * w.cash + scores.closeRate * w.closeRate + scores.showRate * w.showRate) / 100;
    return { ...r, scores, weightedScore, totalRevenue: totalRev, totalCash, closeRate, showRate };
  }).sort((a, b) => b.weightedScore - a.weightedScore);
}

// ==================== P2: TEAM SUMMARY BY MONTH ====================
export async function getSetterTeamSummaryByMonth(anio?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const year = anio ?? new Date().getFullYear();
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  const results = await db.select({
    mes: setterActivities.mes,
    totalIntentos: sql<number>`COALESCE(SUM(${setterActivities.intentosLlamada}), 0)`,
    totalIntros: sql<number>`COALESCE(SUM(${setterActivities.introsEfectivas}), 0)`,
    totalAseguradas: sql<number>`COALESCE(SUM(${setterActivities.demosAseguradasConIntro}), 0)`,
    totalCalendario: sql<number>`COALESCE(SUM(${setterActivities.demosEnCalendario}), 0)`,
    totalConfirmadas: sql<number>`COALESCE(SUM(${setterActivities.demosConfirmadas}), 0)`,
    totalAsistidas: sql<number>`COALESCE(SUM(${setterActivities.demosAsistidas}), 0)`,
    totalCierres: sql<number>`COALESCE(SUM(${setterActivities.cierresAtribuidos}), 0)`,
    totalRevenue: sql<number>`COALESCE(SUM(CAST(${setterActivities.revenueAtribuido} AS DECIMAL(10,2))), 0)`,
    totalCash: sql<number>`COALESCE(SUM(CAST(${setterActivities.cashAtribuido} AS DECIMAL(10,2))), 0)`,
    dias: sql<number>`COUNT(*)`,
  }).from(setterActivities).groupBy(setterActivities.mes);

  // Sort by month order
  return results.sort((a, b) => MESES.indexOf(a.mes ?? '') - MESES.indexOf(b.mes ?? ''));
}

export async function getCloserTeamSummaryByMonth(anio?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  
  const results = await db.select({
    mes: closerActivities.mes,
    totalSchedule: sql<number>`COALESCE(SUM(${closerActivities.scheduleCalls}), 0)`,
    totalLive: sql<number>`COALESCE(SUM(${closerActivities.liveCalls}), 0)`,
    totalOffers: sql<number>`COALESCE(SUM(${closerActivities.offers}), 0)`,
    totalDeposits: sql<number>`COALESCE(SUM(${closerActivities.deposits}), 0)`,
    totalCloses: sql<number>`COALESCE(SUM(${closerActivities.closes}), 0)`,
    totalPiffRevenue: sql<number>`COALESCE(SUM(CAST(${closerActivities.piffRevenue} AS DECIMAL(10,2))), 0)`,
    totalPiffCash: sql<number>`COALESCE(SUM(CAST(${closerActivities.piffCash} AS DECIMAL(10,2))), 0)`,
    totalSetupRevenue: sql<number>`COALESCE(SUM(CAST(${closerActivities.setupRevenue} AS DECIMAL(10,2))), 0)`,
    totalSetupCash: sql<number>`COALESCE(SUM(CAST(${closerActivities.setupCash} AS DECIMAL(10,2))), 0)`,
    dias: sql<number>`COUNT(*)`,
  }).from(closerActivities).groupBy(closerActivities.mes);

  return results.sort((a, b) => MESES.indexOf(a.mes ?? '') - MESES.indexOf(b.mes ?? ''));
}

// ==================== P6: REP PROFILE (individual rep summary) ====================
export async function getSetterRepProfile(setter: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Monthly breakdown
  const monthly = await db.select({
    mes: setterActivities.mes,
    totalIntentos: sql<number>`COALESCE(SUM(${setterActivities.intentosLlamada}), 0)`,
    totalIntros: sql<number>`COALESCE(SUM(${setterActivities.introsEfectivas}), 0)`,
    totalAseguradas: sql<number>`COALESCE(SUM(${setterActivities.demosAseguradasConIntro}), 0)`,
    totalCalendario: sql<number>`COALESCE(SUM(${setterActivities.demosEnCalendario}), 0)`,
    totalConfirmadas: sql<number>`COALESCE(SUM(${setterActivities.demosConfirmadas}), 0)`,
    totalAsistidas: sql<number>`COALESCE(SUM(${setterActivities.demosAsistidas}), 0)`,
    totalCierres: sql<number>`COALESCE(SUM(${setterActivities.cierresAtribuidos}), 0)`,
    totalRevenue: sql<number>`COALESCE(SUM(CAST(${setterActivities.revenueAtribuido} AS DECIMAL(10,2))), 0)`,
    totalCash: sql<number>`COALESCE(SUM(CAST(${setterActivities.cashAtribuido} AS DECIMAL(10,2))), 0)`,
    dias: sql<number>`COUNT(*)`,
  }).from(setterActivities).where(eq(setterActivities.setter, setter)).groupBy(setterActivities.mes);

  // Recent activities (last 30 entries)
  const recent = await db.select().from(setterActivities)
    .where(eq(setterActivities.setter, setter))
    .orderBy(desc(setterActivities.fecha))
    .limit(30);

  // Projection history
  const projections = await db.select().from(setterProjections)
    .where(eq(setterProjections.setter, setter))
    .orderBy(desc(setterProjections.createdAt));

  // Weekly breakdown
  const weekly = await db.select({
    mes: setterActivities.mes,
    semana: setterActivities.semana,
    totalIntentos: sql<number>`COALESCE(SUM(${setterActivities.intentosLlamada}), 0)`,
    totalIntros: sql<number>`COALESCE(SUM(${setterActivities.introsEfectivas}), 0)`,
    totalAsistidas: sql<number>`COALESCE(SUM(${setterActivities.demosAsistidas}), 0)`,
    totalCierres: sql<number>`COALESCE(SUM(${setterActivities.cierresAtribuidos}), 0)`,
    totalRevenue: sql<number>`COALESCE(SUM(CAST(${setterActivities.revenueAtribuido} AS DECIMAL(10,2))), 0)`,
    dias: sql<number>`COUNT(*)`,
  }).from(setterActivities).where(eq(setterActivities.setter, setter))
    .groupBy(setterActivities.mes, setterActivities.semana);

  // Summary totals
  const allIntentos = monthly.reduce((s, m) => s + Number(m.totalIntentos), 0);
  const allIntros = monthly.reduce((s, m) => s + Number(m.totalIntros), 0);
  const allCalendario = monthly.reduce((s, m) => s + Number(m.totalCalendario), 0);
  const allAsistidas = monthly.reduce((s, m) => s + Number(m.totalAsistidas), 0);
  const allCierres = monthly.reduce((s, m) => s + Number(m.totalCierres), 0);
  const allRevenue = monthly.reduce((s, m) => s + Number(m.totalRevenue), 0);
  const allCash = monthly.reduce((s, m) => s + Number(m.totalCash), 0);
  const summary = {
    totalIntentos: allIntentos,
    totalIntros: allIntros,
    totalAsistidas: allAsistidas,
    totalCierres: allCierres,
    totalRevenue: allRevenue,
    totalCash: allCash,
    tasaResp: allIntentos > 0 ? ((allIntros / allIntentos) * 100).toFixed(1) : '0',
    tasaAsist: allCalendario > 0 ? ((allAsistidas / allCalendario) * 100).toFixed(1) : '0',
  };

  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return {
    setter,
    summary,
    monthly: monthly.sort((a, b) => MESES.indexOf(a.mes ?? '') - MESES.indexOf(b.mes ?? '')),
    weekly: weekly.sort((a, b) => {
      const mi = MESES.indexOf(a.mes ?? '') - MESES.indexOf(b.mes ?? '');
      return mi !== 0 ? mi : (a.semana ?? 0) - (b.semana ?? 0);
    }),
    recentActivities: recent,
    projections,
  };
}

export async function getCloserRepProfile(closer: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const monthly = await db.select({
    mes: closerActivities.mes,
    totalSchedule: sql<number>`COALESCE(SUM(${closerActivities.scheduleCalls}), 0)`,
    totalLive: sql<number>`COALESCE(SUM(${closerActivities.liveCalls}), 0)`,
    totalOffers: sql<number>`COALESCE(SUM(${closerActivities.offers}), 0)`,
    totalDeposits: sql<number>`COALESCE(SUM(${closerActivities.deposits}), 0)`,
    totalCloses: sql<number>`COALESCE(SUM(${closerActivities.closes}), 0)`,
    totalPiffRevenue: sql<number>`COALESCE(SUM(CAST(${closerActivities.piffRevenue} AS DECIMAL(10,2))), 0)`,
    totalPiffCash: sql<number>`COALESCE(SUM(CAST(${closerActivities.piffCash} AS DECIMAL(10,2))), 0)`,
    totalSetupRevenue: sql<number>`COALESCE(SUM(CAST(${closerActivities.setupRevenue} AS DECIMAL(10,2))), 0)`,
    totalSetupCash: sql<number>`COALESCE(SUM(CAST(${closerActivities.setupCash} AS DECIMAL(10,2))), 0)`,
    dias: sql<number>`COUNT(*)`,
  }).from(closerActivities).where(eq(closerActivities.closer, closer)).groupBy(closerActivities.mes);

  const recent = await db.select().from(closerActivities)
    .where(eq(closerActivities.closer, closer))
    .orderBy(desc(closerActivities.fecha))
    .limit(30);

  const projections = await db.select().from(closerProjections)
    .where(eq(closerProjections.closer, closer))
    .orderBy(desc(closerProjections.createdAt));

  // Weekly breakdown
  const weekly = await db.select({
    mes: closerActivities.mes,
    semana: closerActivities.semana,
    totalSchedule: sql<number>`COALESCE(SUM(${closerActivities.scheduleCalls}), 0)`,
    totalLive: sql<number>`COALESCE(SUM(${closerActivities.liveCalls}), 0)`,
    totalOffers: sql<number>`COALESCE(SUM(${closerActivities.offers}), 0)`,
    totalCloses: sql<number>`COALESCE(SUM(${closerActivities.closes}), 0)`,
    totalPiffRevenue: sql<number>`COALESCE(SUM(CAST(${closerActivities.piffRevenue} AS DECIMAL(10,2))), 0)`,
    totalPiffCash: sql<number>`COALESCE(SUM(CAST(${closerActivities.piffCash} AS DECIMAL(10,2))), 0)`,
    totalSetupRevenue: sql<number>`COALESCE(SUM(CAST(${closerActivities.setupRevenue} AS DECIMAL(10,2))), 0)`,
    totalSetupCash: sql<number>`COALESCE(SUM(CAST(${closerActivities.setupCash} AS DECIMAL(10,2))), 0)`,
    dias: sql<number>`COUNT(*)`,
  }).from(closerActivities).where(eq(closerActivities.closer, closer))
    .groupBy(closerActivities.mes, closerActivities.semana);

  // Summary totals
  const allSchedule = monthly.reduce((s, m) => s + Number(m.totalSchedule), 0);
  const allLive = monthly.reduce((s, m) => s + Number(m.totalLive), 0);
  const allOffers = monthly.reduce((s, m) => s + Number(m.totalOffers), 0);
  const allCloses = monthly.reduce((s, m) => s + Number(m.totalCloses), 0);
  const allRevenue = monthly.reduce((s, m) => s + Number(m.totalPiffRevenue) + Number(m.totalSetupRevenue), 0);
  const allCash = monthly.reduce((s, m) => s + Number(m.totalPiffCash) + Number(m.totalSetupCash), 0);
  const summary = {
    totalSchedule: allSchedule,
    totalLive: allLive,
    totalOffers: allOffers,
    totalCloses: allCloses,
    totalRevenue: allRevenue,
    totalCash: allCash,
    showRate: allSchedule > 0 ? ((allLive / allSchedule) * 100).toFixed(1) : '0',
    closeRate: allOffers > 0 ? ((allCloses / allOffers) * 100).toFixed(1) : '0',
  };

  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return {
    closer,
    summary,
    monthly: monthly.sort((a, b) => MESES.indexOf(a.mes ?? '') - MESES.indexOf(b.mes ?? '')),
    weekly: weekly.sort((a, b) => {
      const mi = MESES.indexOf(a.mes ?? '') - MESES.indexOf(b.mes ?? '');
      return mi !== 0 ? mi : (a.semana ?? 0) - (b.semana ?? 0);
    }),
    recentActivities: recent,
    projections,
  };
}

// ==================== P5: SMART ALERTS ====================
export async function getSmartAlerts() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const alerts: { type: string; severity: 'info' | 'warning' | 'critical' | 'success'; title: string; description: string; rep?: string; department?: string }[] = [];
  
  const now = new Date();
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const mesActual = MESES[now.getMonth()];
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  
  // 1. Reps without activity in last 2 days
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  const allSetters = await db.selectDistinct({ setter: setterActivities.setter }).from(setterActivities);
  for (const s of allSetters) {
    const recentAct = await db.select({ count: sql<number>`COUNT(*)` })
      .from(setterActivities)
      .where(and(eq(setterActivities.setter, s.setter), gte(setterActivities.fecha, twoDaysAgo)));
    if (Number(recentAct[0]?.count) === 0) {
      alerts.push({ type: 'inactivity', severity: 'warning', title: 'Sin actividad reciente', description: `${s.setter} no ha registrado actividad en los últimos 2 días`, rep: s.setter, department: 'setter' });
    }
  }
  
  const allClosers = await db.selectDistinct({ closer: closerActivities.closer }).from(closerActivities);
  for (const c of allClosers) {
    const recentAct = await db.select({ count: sql<number>`COUNT(*)` })
      .from(closerActivities)
      .where(and(eq(closerActivities.closer, c.closer), gte(closerActivities.fecha, twoDaysAgo)));
    if (Number(recentAct[0]?.count) === 0) {
      alerts.push({ type: 'inactivity', severity: 'warning', title: 'Sin actividad reciente', description: `${c.closer} no ha registrado actividad en los últimos 2 días`, rep: c.closer, department: 'closer' });
    }
  }
  
  // 2. Projections off track - read from actual trackers, not daily tracking tables
  const closerProjs = await db.select().from(closerProjections).where(eq(closerProjections.mes, mesActual));
  for (const proj of closerProjs) {
    const result = await getCloserProjectionWithActuals(proj.id);
    if (result && result.daysWithData >= 2) {
      const bloodCloses = proj.bloodGoalCloses ?? 0;
      if (result.totals.closes < result.expectedCloses * 0.8 && bloodCloses > 0) {
        alerts.push({ type: 'off_track', severity: 'critical', title: 'Off Track en Proyección', description: `${proj.closer} lleva ${result.totals.closes} closes vs ${result.expectedCloses} esperados (Semana ${proj.semana})`, rep: proj.closer, department: 'closer' });
      }
    }
  }
  
  const setterProjs = await db.select().from(setterProjections).where(eq(setterProjections.mes, mesActual));
  for (const proj of setterProjs) {
    const result = await getSetterProjectionWithActuals(proj.id);
    if (result && result.daysWithData >= 2) {
      const bloodDemos = proj.bloodGoalDemosAsistidas ?? 0;
      if (result.totals.demosAsistidas < result.expectedDemos * 0.8 && bloodDemos > 0) {
        alerts.push({ type: 'off_track', severity: 'critical', title: 'Off Track en Proyección', description: `${proj.setter} lleva ${result.totals.demosAsistidas} demos asistidas vs ${result.expectedDemos} esperadas (Semana ${proj.semana})`, rep: proj.setter, department: 'setter' });
      }
    }
  }
  
  // 3. Stretch goal hit (celebration) - read from actual trackers
  for (const proj of closerProjs) {
    const result = await getCloserProjectionWithActuals(proj.id);
    if (result && result.stretchHit) {
      alerts.push({ type: 'stretch_hit', severity: 'success', title: 'Stretch Goal Alcanzado', description: `${proj.closer} superó su Stretch Goal con ${result.totals.closes} closes (meta: ${proj.stretchGoalCloses})`, rep: proj.closer, department: 'closer' });
    }
  }
  
  // 4. Sunday reminder for missing projections
  if (dayOfWeek === 0) {
    const nextWeekNum = Math.ceil((now.getDate() + 7) / 7);
    const nextMonth = now.getDate() + 7 > new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() ? MESES[(now.getMonth() + 1) % 12] : mesActual;
    
    const existingCloserProjs = await db.select({ closer: closerProjections.closer }).from(closerProjections)
      .where(and(eq(closerProjections.mes, nextMonth), eq(closerProjections.semana, nextWeekNum)));
    const existingSetterProjs = await db.select({ setter: setterProjections.setter }).from(setterProjections)
      .where(and(eq(setterProjections.mes, nextMonth), eq(setterProjections.semana, nextWeekNum)));
    
    const closersWithProj = new Set(existingCloserProjs.map(p => p.closer));
    const settersWithProj = new Set(existingSetterProjs.map(p => p.setter));
    
    for (const c of allClosers) {
      if (!closersWithProj.has(c.closer)) {
        alerts.push({ type: 'missing_projection', severity: 'info', title: 'Proyección Pendiente', description: `${c.closer} no tiene proyección para la próxima semana`, rep: c.closer, department: 'closer' });
      }
    }
    for (const s of allSetters) {
      if (!settersWithProj.has(s.setter)) {
        alerts.push({ type: 'missing_projection', severity: 'info', title: 'Proyección Pendiente', description: `${s.setter} no tiene proyección para la próxima semana`, rep: s.setter, department: 'setter' });
      }
    }
  }
  
  return alerts;
}



// ==================== CALL AUDITS ====================

export async function createCallAudit(data: InsertCallAudit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(callAudits).values(data).returning({ id: callAudits.id });
  return { id: result.id };
}

export async function getCallAudits(filters?: { closer?: string; manualReview?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [];
  if (filters?.closer) conditions.push(eq(callAudits.closer, filters.closer));
  if (filters?.manualReview) conditions.push(eq(callAudits.manualReview, filters.manualReview as any));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  
  const rows = await db.select().from(callAudits)
    .where(whereClause)
    .orderBy(desc(callAudits.createdAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function getCallAuditById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(callAudits).where(eq(callAudits.id, id)).limit(1);
  return rows[0] || null;
}

export async function getCallAuditsByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(callAudits)
    .where(eq(callAudits.leadId, leadId))
    .orderBy(desc(callAudits.createdAt));
  return rows;
}

export async function updateCallAuditReview(id: number, data: {
  manualReview?: string;
  manualNotes?: string;
  actionItems?: any;
  reviewedBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = { ...data, updatedAt: new Date() };
  if (data.manualReview === "REVISADA" || data.manualReview === "ACCIONADA") {
    updateData.reviewedAt = new Date();
  }
  await db.update(callAudits).set(updateData).where(eq(callAudits.id, id));
  return getCallAuditById(id);
}

export async function updateCallAudit(id: number, data: Partial<InsertCallAudit>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(callAudits).set({ ...data, updatedAt: new Date() }).where(eq(callAudits.id, id));
  return getCallAuditById(id);
}

export async function getCallAuditStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const allAudits = await db.select().from(callAudits);
  
  const total = allAudits.length;
  const pendientes = allAudits.filter(a => a.manualReview === "PENDIENTE").length;
  const revisadas = allAudits.filter(a => a.manualReview === "REVISADA").length;
  const accionadas = allAudits.filter(a => a.manualReview === "ACCIONADA").length;
  const withGrading = allAudits.filter(a => a.aiGrading !== null);
  const avgGrading = withGrading.length > 0
    ? withGrading.reduce((sum, a) => sum + (a.aiGrading || 0), 0) / withGrading.length
    : 0;
  
  // Distribution by grade ranges
  const gradingDistribution = {
    excellent: withGrading.filter(a => (a.aiGrading || 0) >= 8).length,
    good: withGrading.filter(a => (a.aiGrading || 0) >= 6 && (a.aiGrading || 0) < 8).length,
    needsWork: withGrading.filter(a => (a.aiGrading || 0) >= 4 && (a.aiGrading || 0) < 6).length,
    poor: withGrading.filter(a => (a.aiGrading || 0) < 4).length,
  };
  
  return {
    total,
    pendientes,
    revisadas,
    accionadas,
    avgGrading: Math.round(avgGrading * 10) / 10,
    gradingDistribution,
  };
}


// ==================== FOLLOW-UPS (E-ID System) ====================

export async function getFollowUps(filters?: {
  tipo?: string;
  estado?: string;
  closerAsignado?: string;
  prioridad?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let query = db.select().from(followUps);
  const conditions: any[] = [];
  if (filters?.tipo) conditions.push(eq(followUps.tipo, filters.tipo as any));
  if (filters?.estado) conditions.push(eq(followUps.estado, filters.estado as any));
  if (filters?.closerAsignado) conditions.push(eq(followUps.closerAsignado, filters.closerAsignado));
  if (filters?.prioridad) conditions.push(eq(followUps.prioridad, filters.prioridad as any));
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return (query as any).orderBy(desc(followUps.proximoFollowUp));
}

export async function getFollowUpById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(followUps).where(eq(followUps.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createFollowUp(data: InsertFollowUp) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(followUps).values(data).returning({ id: followUps.id });
  return result.id;
}

export async function updateFollowUp(id: number, data: Partial<InsertFollowUp>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(followUps).set({ ...data, updatedAt: new Date() }).where(eq(followUps.id, id));
}

export async function deleteFollowUp(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Also delete associated logs
  await db.delete(followUpLogs).where(eq(followUpLogs.followUpId, id));
  await db.delete(followUps).where(eq(followUps.id, id));
}

export async function getFollowUpStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const all = await db.select().from(followUps);
  const activos = all.filter(f => f.estado === "ACTIVO");
  const hot = activos.filter(f => f.tipo === "HOT");
  const warm = activos.filter(f => f.tipo === "WARM");
  const cerradosGanados = all.filter(f => f.estado === "CERRADO_GANADO");
  const cerradosPerdidos = all.filter(f => f.estado === "CERRADO_PERDIDO");
  
  const now = new Date();
  const vencidos = activos.filter(f => f.proximoFollowUp && new Date(f.proximoFollowUp) < now);
  
  const montoEstimadoTotal = activos.reduce((sum, f) => sum + parseFloat(String(f.montoEstimado || "0")), 0);
  
  return {
    hotCount: hot.length,
    warmCount: warm.length,
    totalActivos: activos.length,
    cerradosGanados: cerradosGanados.length,
    cerradosPerdidos: cerradosPerdidos.length,
    vencidos: vencidos.length,
    montoEstimadoTotal,
  };
}

export async function createFollowUpFromLead(leadId: number, closerAsignado?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get lead data
  const leadRows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const lead = leadRows[0];
  if (!lead) throw new Error("Lead not found");
  
  // Check if follow-up already exists for this lead
  const existing = await db.select().from(followUps).where(eq(followUps.leadId, leadId)).limit(1);
  if (existing.length > 0) return existing[0].id;
  
  // Determine priority from lead scoring
  let prioridad: "RED_HOT" | "HOT" | "WARM" | "COLD" = "HOT";
  if (lead.scoreLabel === "HOT") prioridad = "RED_HOT";
  else if (lead.scoreLabel === "WARM") prioridad = "HOT";
  else if (lead.scoreLabel === "TIBIO") prioridad = "WARM";
  else if (lead.scoreLabel === "FRÍO") prioridad = "COLD";
  
  const tipo = (prioridad === "RED_HOT" || prioridad === "HOT") ? "HOT" : "WARM";
  
  // Set next follow-up to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  
  const [result] = await db.insert(followUps).values({
    leadId,
    nombre: lead.nombre,
    correo: lead.correo,
    telefono: lead.telefono,
    instagram: lead.instagram,
    tipo,
    prioridad,
    estado: "ACTIVO",
    ultimaObjecion: lead.razonNoConversion,
    montoEstimado: lead.facturado || "0",
    closerAsignado: closerAsignado || lead.closer,
    notas: lead.notas,
    linkCRM: lead.linkCRM,
    creadoDesde: "CITAS",
    proximoFollowUp: tomorrow,
  }).returning({ id: followUps.id });

  return result.id;
}

// ==================== FOLLOW-UP LOGS ====================

export async function getFollowUpLogs(followUpId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(followUpLogs)
    .where(eq(followUpLogs.followUpId, followUpId))
    .orderBy(desc(followUpLogs.createdAt));
}

export async function createFollowUpLog(data: InsertFollowUpLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(followUpLogs).values(data).returning({ id: followUpLogs.id });

  // Update the follow-up's last FU date and increment counter
  await db.update(followUps).set({
    ultimoFollowUp: new Date(),
    totalFollowUps: sql`"totalFollowUps" + 1`,
    updatedAt: new Date(),
  }).where(eq(followUps.id, data.followUpId));

  return result.id;
}

// ==================== WEBHOOK LOGS ====================
export async function createWebhookLog(log: InsertWebhookLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Truncate rawPayload to 10KB for safety
  if (log.rawPayload && log.rawPayload.length > 10000) {
    log.rawPayload = log.rawPayload.substring(0, 10000) + "...[TRUNCATED]";
  }
  const [result] = await db.insert(webhookLogs).values(log).returning({ id: webhookLogs.id });
  return result.id;
}

export async function updateWebhookLog(id: number, data: Partial<InsertWebhookLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(webhookLogs).set(data).where(eq(webhookLogs.id, id));
}

export async function getWebhookLogs(limit: number = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(webhookLogs).orderBy(desc(webhookLogs.createdAt)).limit(limit);
}

/**
 * Find a lead by name (case-insensitive, trimmed).
 * Used as fallback when email/phone are not available for duplicate detection.
 */
export async function findLeadByName(nombre: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const trimmed = nombre.trim();
  if (!trimmed) return null;
  const result = await db.select().from(leads)
    .where(sql`LOWER(TRIM(${leads.nombre})) = LOWER(${trimmed})`)
    .orderBy(desc(leads.createdAt))
    .limit(1);
  return result[0] || null;
}

// ==============================
// CONTACT ATTEMPTS
// ==============================

export async function createContactAttempt(data: {
  leadId: number;
  timestamp: Date;
  canal: "LLAMADA" | "WHATSAPP" | "SMS" | "EMAIL" | "DM_INSTAGRAM" | "OTRO";
  resultado?: "CONTESTÓ" | "NO CONTESTÓ" | "BUZÓN" | "NÚMERO INVÁLIDO" | "MENSAJE ENVIADO" | "WHATSAPP LIMPIADO";
  notas?: string;
  realizadoPor?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  const result = await db.insert(contactAttempts).values({
    leadId: data.leadId,
    timestamp: data.timestamp,
    canal: data.canal,
    resultado: data.resultado || "NO CONTESTÓ",
    notas: data.notas || null,
    realizadoPor: data.realizadoPor || null,
  });
  
  // Update the intentosContacto counter on the lead
  await db.execute(
    sql`UPDATE leads SET "intentosContacto" = (
      SELECT COUNT(*) FROM contact_attempts WHERE "leadId" = ${data.leadId}
    ) WHERE id = ${data.leadId}`
  );
  
  // Auto-sync resultadoContacto to the latest attempt's resultado
  const [latestAttempt] = await db.execute(
    sql`SELECT resultado FROM contact_attempts WHERE "leadId" = ${data.leadId} ORDER BY timestamp DESC LIMIT 1`
  );
  if (latestAttempt) {
    const resultado = (latestAttempt as any).resultado;
    // Map MENSAJE ENVIADO → NO CONTESTÓ for the lead enum
    const mapped = resultado === "MENSAJE ENVIADO" ? "NO CONTESTÓ" : resultado;
    await db.execute(
      sql`UPDATE leads SET "resultadoContacto" = ${mapped} WHERE id = ${data.leadId}`
    );
  }
  
  // Auto-update fechaPrimerContacto: set to earliest contact attempt timestamp
  // This ensures the field always reflects the actual first attempt
  await db.execute(
    sql`UPDATE leads SET "fechaPrimerContacto" = (
      SELECT MIN(timestamp) FROM contact_attempts WHERE "leadId" = ${data.leadId}
    ) WHERE id = ${data.leadId}`
  );
  
  // Auto-calculate tiempoRespuestaHoras using business hours (createdAt → first attempt)
  const [lead] = await db.select({ createdAt: leads.createdAt }).from(leads).where(eq(leads.id, data.leadId));
  if (lead?.createdAt) {
    const [firstRow] = await db.execute(
      sql`SELECT MIN(timestamp) as first_ts FROM contact_attempts WHERE "leadId" = ${data.leadId}`
    );
    const firstTs = (firstRow as any)?.first_ts;
    if (firstTs) {
      const bizHours = calculateBusinessHours(new Date(lead.createdAt), new Date(firstTs));
      await db.execute(
        sql`UPDATE leads SET "tiempoRespuestaHoras" = ${String(bizHours)}, "updatedAt" = NOW() WHERE id = ${data.leadId}`
      );
    }
  }

  return result;
}

export async function getContactAttempts(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.select().from(contactAttempts)
    .where(eq(contactAttempts.leadId, leadId))
    .orderBy(desc(contactAttempts.timestamp));
}

export async function deleteContactAttempt(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  // Get the leadId before deleting
  const [attempt] = await db.select().from(contactAttempts).where(eq(contactAttempts.id, id));
  if (!attempt) throw new Error("Attempt not found");
  
  await db.delete(contactAttempts).where(eq(contactAttempts.id, id));
  
  // Update the counter on the lead
  await db.execute(
    sql`UPDATE leads SET "intentosContacto" = (
      SELECT COUNT(*) FROM contact_attempts WHERE "leadId" = ${attempt.leadId}
    ) WHERE id = ${attempt.leadId}`
  );

  // Recalculate fechaPrimerContacto (might change if we deleted the earliest)
  await db.execute(
    sql`UPDATE leads SET "fechaPrimerContacto" = (
      SELECT MIN(timestamp) FROM contact_attempts WHERE "leadId" = ${attempt.leadId}
    ) WHERE id = ${attempt.leadId}`
  );
  
  // Recalculate resultadoContacto from remaining attempts (latest wins), or PENDIENTE if none
  const [latestRemaining] = await db.execute(
    sql`SELECT resultado FROM contact_attempts WHERE "leadId" = ${attempt.leadId} ORDER BY timestamp DESC LIMIT 1`
  );
  if (latestRemaining) {
    const resultado = (latestRemaining as any).resultado;
    const mapped = resultado === "MENSAJE ENVIADO" ? "NO CONTESTÓ" : resultado;
    await db.execute(
      sql`UPDATE leads SET "resultadoContacto" = ${mapped} WHERE id = ${attempt.leadId}`
    );
  } else {
    await db.execute(
      sql`UPDATE leads SET "resultadoContacto" = 'PENDIENTE' WHERE id = ${attempt.leadId}`
    );
  }

  // Recalculate tiempoRespuestaHoras using business hours (createdAt → first attempt)
  const [lead] = await db.select({ createdAt: leads.createdAt }).from(leads).where(eq(leads.id, attempt.leadId));
  const [firstRow] = await db.execute(
    sql`SELECT MIN(timestamp) as first_ts FROM contact_attempts WHERE "leadId" = ${attempt.leadId}`
  );
  const firstTs = (firstRow as any)?.first_ts;
  if (lead?.createdAt && firstTs) {
    const bizHours = calculateBusinessHours(new Date(lead.createdAt), new Date(firstTs));
    await db.execute(
      sql`UPDATE leads SET "tiempoRespuestaHoras" = ${String(bizHours)}, "updatedAt" = NOW() WHERE id = ${attempt.leadId}`
    );
  } else {
    await db.execute(
      sql`UPDATE leads SET "tiempoRespuestaHoras" = NULL, "updatedAt" = NOW() WHERE id = ${attempt.leadId}`
    );
  }
  
  return { success: true };
}

/**
 * Get first contact attempt timestamp for multiple leads (batch query)
 * Returns a map of leadId -> firstAttemptTimestamp for efficient display
 */
export async function getFirstContactAttemptForLeads(leadIds: number[]) {
  if (leadIds.length === 0) return [];
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const rows = await db.execute(
    sql`SELECT "leadId", MIN(timestamp) as "firstAttempt", COUNT(*) as "attemptCount"
        FROM contact_attempts
        WHERE "leadId" IN (${sql.join(leadIds.map(id => sql`${id}`), sql`, `)})
        GROUP BY "leadId"`
  );
  return rows as unknown as { leadId: number; firstAttempt: Date | null; attemptCount: number }[];
}

/**
 * Get leads that need attention: created >48h ago with <3 contact attempts
 * and still in PENDIENTE or NO CONTESTÓ status
 */
export async function getLeadsNeedingAttention(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  let query = sql`
    SELECT l.id, l.nombre, l.correo, l.telefono, l.fecha, l."setterAsignado",
           l."intentosContacto", l."resultadoContacto", l."createdAt",
           EXTRACT(EPOCH FROM (NOW() - l."createdAt")) / 3600 as "hoursElapsed"
    FROM leads l
    WHERE l."createdAt" < ${fortyEightHoursAgo}
      AND (l."intentosContacto" IS NULL OR l."intentosContacto" < 3)
      AND l."resultadoContacto" IN ('PENDIENTE', 'NO CONTESTÓ', 'BUZÓN')
  `;

  if (filters?.mes) {
    query = sql`${query} AND l.mes = ${filters.mes}`;
  }
  if (filters?.semana) {
    query = sql`${query} AND l.semana = ${filters.semana}`;
  }

  query = sql`${query} ORDER BY l."createdAt" ASC`;

  const rows = await db.execute(query);
  return rows;
}

// ============================================================
// LEAD COMMENTS (Team communication threads)
// ============================================================

export async function getLeadComments(leadId: number) {
  const db = await getDb();
  return db!.select().from(leadComments).where(eq(leadComments.leadId, leadId)).orderBy(desc(leadComments.createdAt));
}

export async function createLeadComment(data: {
  leadId: number;
  userId?: number;
  autor: string;
  autorRole?: string;
  texto: string;
  mentions?: string; // JSON array of user IDs
}) {
  const db = await getDb();
  const [result] = await db!.insert(leadComments).values(data).returning({ id: leadComments.id });
  return result.id;
}

export async function updateLeadComment(id: number, texto: string) {
  const db = await getDb();
  await db!.update(leadComments).set({ texto, updatedAt: new Date() }).where(eq(leadComments.id, id));
}

export async function deleteLeadComment(id: number) {
  const db = await getDb();
  await db!.delete(leadComments).where(eq(leadComments.id, id));
}

/** Get the latest comment for each lead in a list of lead IDs (for table preview) */
export async function getLatestCommentsForLeads(leadIds: number[]) {
  if (!leadIds.length) return [];
  const db = await getDb();
  const allComments = await db!.select().from(leadComments)
    .where(inArray(leadComments.leadId, leadIds))
    .orderBy(desc(leadComments.id));
  
  const seen = new Set<number>();
  const latestPerLead: typeof allComments = [];
  for (const c of allComments) {
    if (!seen.has(c.leadId)) {
      seen.add(c.leadId);
      latestPerLead.push(c);
    }
  }
  return latestPerLead;
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export async function createNotification(data: {
  userId: number;
  type?: "mention" | "comment" | "system";
  title: string;
  message: string;
  leadId?: number;
  commentId?: number;
  fromUserId?: number;
  fromUserName?: string;
}) {
  const db = await getDb();
  const [result] = await db!.insert(notifications).values(data).returning({ id: notifications.id });
  return result.id;
}

export async function getNotificationsForUser(userId: number, limit = 50) {
  const db = await getDb();
  return db!.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  const rows = await db!.select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
  return rows[0]?.count ?? 0;
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  await db!.update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  await db!.update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));
}

/** Get all CRM users (for @mention autocomplete) */
export async function getCrmUsers() {
  const db = await getDb();
  return db!.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
  }).from(users)
    .where(sql`${users.role} IN ('admin', 'setter', 'closer')`);
}

/** Find user by ID */
export async function getUserById(id: number) {
  const db = await getDb();
  const rows = await db!.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Check for new notifications since a given timestamp */
export async function getNewNotificationsSince(userId: number, since: Date) {
  const db = await getDb();
  return db!.select().from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      sql`${notifications.createdAt} > ${since}`
    ))
    .orderBy(desc(notifications.createdAt));
}

// ==================== AD CAMPAIGNS ====================

export async function upsertAdCampaign(data: { campaignId: string; name?: string; status?: string; objective?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adCampaigns).values({
    ...data,
    lastSyncedAt: new Date(),
  }).onConflictDoUpdate({
    target: adCampaigns.campaignId,
    set: { name: data.name, status: data.status, objective: data.objective, lastSyncedAt: new Date(), updatedAt: new Date() },
  });
}

export async function getAdCampaigns() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(adCampaigns).orderBy(desc(adCampaigns.updatedAt));
}

// ==================== AD ADSETS ====================

export async function upsertAdAdset(data: { adsetId: string; campaignId: string; name?: string; status?: string; targetingDescription?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adAdsets).values({
    ...data,
    lastSyncedAt: new Date(),
  }).onConflictDoUpdate({
    target: adAdsets.adsetId,
    set: { name: data.name, status: data.status, campaignId: data.campaignId, lastSyncedAt: new Date(), updatedAt: new Date() },
  });
}

export async function getAdAdsets(campaignId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [];
  if (campaignId) conditions.push(eq(adAdsets.campaignId, campaignId));
  return db.select().from(adAdsets)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(adAdsets.updatedAt));
}

// ==================== AD ADS ====================

export async function upsertAdAd(data: { adId: string; adsetId?: string; campaignId?: string; name?: string; status?: string; urlTags?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adAds).values({
    ...data,
    lastSyncedAt: new Date(),
  }).onConflictDoUpdate({
    target: adAds.adId,
    set: { name: data.name, status: data.status, urlTags: data.urlTags, lastSyncedAt: new Date(), updatedAt: new Date() },
  });
}

export async function getAdAds(filters?: { campaignId?: string; adsetId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [];
  if (filters?.campaignId) conditions.push(eq(adAds.campaignId, filters.campaignId));
  if (filters?.adsetId) conditions.push(eq(adAds.adsetId, filters.adsetId));
  return db.select().from(adAds)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(adAds.updatedAt));
}

// ==================== AD CREATIVES ====================

/**
 * Upsert a single ad creative (video/image/copy metadata). Indexed by adId so
 * re-running `syncStructure` refreshes the cached media without duplicating.
 */
export async function upsertAdCreative(
  data: Omit<InsertAdCreative, "id" | "createdAt" | "updatedAt" | "lastSyncedAt">
) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db.insert(adCreatives).values({
    ...data,
    lastSyncedAt: now,
  }).onConflictDoUpdate({
    target: adCreatives.adId,
    set: {
      creativeId: data.creativeId,
      videoId: data.videoId,
      videoSourceUrl: data.videoSourceUrl,
      videoPermalinkUrl: data.videoPermalinkUrl,
      thumbnailUrl: data.thumbnailUrl,
      imageUrl: data.imageUrl,
      title: data.title,
      body: data.body,
      callToActionType: data.callToActionType,
      destinationUrl: data.destinationUrl,
      instagramPermalinkUrl: data.instagramPermalinkUrl,
      effectiveObjectStoryId: data.effectiveObjectStoryId,
      lastSyncedAt: now,
      updatedAt: now,
    },
  });
}

/** Lookup a single creative by the Meta ad ID. Returns null when not cached. */
export async function getAdCreative(adId: string): Promise<AdCreative | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(adCreatives).where(eq(adCreatives.adId, adId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Batch lookup for creatives — returns a map keyed by adId so callers (UI
 * grids, attribution drill-downs) can build a lookup table in one roundtrip.
 */
export async function getAdCreativesByAdIds(adIds: string[]): Promise<Record<string, AdCreative>> {
  if (!adIds.length) return {};
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(adCreatives).where(inArray(adCreatives.adId, adIds));
  return rows.reduce<Record<string, AdCreative>>((acc, row) => {
    acc[row.adId] = row;
    return acc;
  }, {});
}

// ==================== AD METRICS DAILY ====================

export async function upsertAdMetricDaily(data: Omit<InsertAdMetricDaily, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adMetricsDaily).values({
    ...data,
    lastSyncedAt: new Date(),
  }).onConflictDoUpdate({
    target: [adMetricsDaily.fecha, adMetricsDaily.campaignId, adMetricsDaily.adsetId, adMetricsDaily.adId],
    set: {
      campaignName: data.campaignName,
      adsetName: data.adsetName,
      adName: data.adName,
      impressions: data.impressions,
      clicks: data.clicks,
      spend: data.spend,
      reach: data.reach,
      leads: data.leads,
      linkClicks: data.linkClicks,
      ctr: data.ctr,
      cpc: data.cpc,
      cpl: data.cpl,
      costPerResult: data.costPerResult,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function getAdMetricsDaily(filters?: {
  dateFrom?: string;
  dateTo?: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [];
  if (filters?.dateFrom) conditions.push(gte(adMetricsDaily.fecha, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(adMetricsDaily.fecha, new Date(filters.dateTo)));
  if (filters?.campaignId) conditions.push(eq(adMetricsDaily.campaignId, filters.campaignId));
  if (filters?.adsetId) conditions.push(eq(adMetricsDaily.adsetId, filters.adsetId));
  if (filters?.adId) conditions.push(eq(adMetricsDaily.adId, filters.adId));
  return db.select().from(adMetricsDaily)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(adMetricsDaily.fecha));
}

/**
 * Get aggregated metrics by campaign for attribution dashboard.
 * Groups daily metrics by campaign and sums them.
 */
export async function getAdMetricsByCampaign(dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [];
  if (dateFrom) conditions.push(gte(adMetricsDaily.fecha, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(adMetricsDaily.fecha, new Date(dateTo)));

  const result = await db.select({
    campaignId: adMetricsDaily.campaignId,
    campaignName: adMetricsDaily.campaignName,
    totalSpend: sql<number>`SUM(${adMetricsDaily.spend})`,
    totalImpressions: sql<number>`SUM(${adMetricsDaily.impressions})`,
    totalClicks: sql<number>`SUM(${adMetricsDaily.clicks})`,
    totalReach: sql<number>`SUM(${adMetricsDaily.reach})`,
    totalLeads: sql<number>`SUM(${adMetricsDaily.leads})`,
    totalLinkClicks: sql<number>`SUM(${adMetricsDaily.linkClicks})`,
    avgCtr: sql<number>`AVG(${adMetricsDaily.ctr})`,
    avgCpc: sql<number>`AVG(${adMetricsDaily.cpc})`,
    avgCostPerResult: sql<number>`AVG(NULLIF(${adMetricsDaily.costPerResult}, 0))`,
    days: sql<number>`COUNT(DISTINCT ${adMetricsDaily.fecha})`,
  })
    .from(adMetricsDaily)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(adMetricsDaily.campaignId, adMetricsDaily.campaignName);

  return result;
}

/**
 * Get aggregated metrics by adset for attribution drill-down.
 */
export async function getAdMetricsByAdset(campaignId: string, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [eq(adMetricsDaily.campaignId, campaignId)];
  if (dateFrom) conditions.push(gte(adMetricsDaily.fecha, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(adMetricsDaily.fecha, new Date(dateTo)));

  return db.select({
    adsetId: adMetricsDaily.adsetId,
    adsetName: adMetricsDaily.adsetName,
    totalSpend: sql<number>`SUM(${adMetricsDaily.spend})`,
    totalImpressions: sql<number>`SUM(${adMetricsDaily.impressions})`,
    totalClicks: sql<number>`SUM(${adMetricsDaily.clicks})`,
    totalLeads: sql<number>`SUM(${adMetricsDaily.leads})`,
    avgCtr: sql<number>`AVG(${adMetricsDaily.ctr})`,
    avgCpc: sql<number>`AVG(${adMetricsDaily.cpc})`,
  })
    .from(adMetricsDaily)
    .where(and(...conditions))
    .groupBy(adMetricsDaily.adsetId, adMetricsDaily.adsetName);
}

/**
 * Get aggregated metrics by ad for the most granular attribution.
 */
export async function getAdMetricsByAd(adsetId: string, dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [eq(adMetricsDaily.adsetId, adsetId)];
  if (dateFrom) conditions.push(gte(adMetricsDaily.fecha, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(adMetricsDaily.fecha, new Date(dateTo)));

  return db.select({
    adId: adMetricsDaily.adId,
    adName: adMetricsDaily.adName,
    totalSpend: sql<number>`SUM(${adMetricsDaily.spend})`,
    totalImpressions: sql<number>`SUM(${adMetricsDaily.impressions})`,
    totalClicks: sql<number>`SUM(${adMetricsDaily.clicks})`,
    totalLeads: sql<number>`SUM(${adMetricsDaily.leads})`,
    avgCtr: sql<number>`AVG(${adMetricsDaily.ctr})`,
    avgCpc: sql<number>`AVG(${adMetricsDaily.cpc})`,
  })
    .from(adMetricsDaily)
    .where(and(...conditions))
    .groupBy(adMetricsDaily.adId, adMetricsDaily.adName);
}

/**
 * Get attribution data: leads grouped by UTM campaign with their outcomes.
 * This is the core of the traceability feature.
 */
export async function getLeadAttribution(filters?: { dateFrom?: string; dateTo?: string; campaignId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [];
  if (filters?.dateFrom) conditions.push(gte(leads.fecha, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(leads.fecha, new Date(filters.dateTo)));
  if (filters?.campaignId) conditions.push(eq(leads.utmCampaign, filters.campaignId));
  // Only include leads that have UTM data
  conditions.push(sql`${leads.utmCampaign} IS NOT NULL AND ${leads.utmCampaign} != ''`);

  return db.select({
    utmCampaign: leads.utmCampaign,
    utmContent: leads.utmContent,
    utmTerm: leads.utmTerm,
    totalLeads: sql<number>`COUNT(*)`,
    contactados: sql<number>`SUM(CASE WHEN ${leads.resultadoContacto} = 'CONTESTÓ' THEN 1 ELSE 0 END)`,
    demosAsistidas: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'ASISTIÓ' THEN 1 ELSE 0 END)`,
    ventas: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN 1 ELSE 0 END)`,
    totalRevenue: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN COALESCE(${leads.facturado}, 0) ELSE 0 END)`,
    totalCash: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN COALESCE(${leads.cashCollected}, 0) ELSE 0 END)`,
  })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.utmCampaign, leads.utmContent, leads.utmTerm);
}

/**
 * Get lead count by UTM campaign for quick overview.
 */
export async function getLeadCountByUtmCampaign(dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [sql`${leads.utmCampaign} IS NOT NULL AND ${leads.utmCampaign} != ''`];
  if (dateFrom) conditions.push(gte(leads.fecha, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(leads.fecha, new Date(dateTo)));

  return db.select({
    utmCampaign: leads.utmCampaign,
    count: sql<number>`COUNT(*)`,
    ventas: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN 1 ELSE 0 END)`,
    revenue: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN COALESCE(${leads.cashCollected}, 0) ELSE 0 END)`,
  })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.utmCampaign);
}

// ==================== UTM AUDIT / COMPLETENESS ====================

export interface UtmCompletenessRow {
  origen: string;
  total: number;
  hasSource: number;
  hasMedium: number;
  hasCampaign: number;
  hasContent: number;
  hasTerm: number;
  completelyMissing: number;
}

/**
 * Compute UTM completeness per `origen` for the date range. Lets the audit
 * panel quantify "what % of leads from each source carry each UTM level" —
 * prerequisite for fixing the fuga de atribución because we can't improve
 * what we don't measure.
 */
export async function getUtmCompleteness(filters?: { dateFrom?: string; dateTo?: string }): Promise<UtmCompletenessRow[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.dateFrom) conditions.push(gte(leads.createdAt, new Date(filters.dateFrom)));
  if (filters?.dateTo) conditions.push(lte(leads.createdAt, new Date(filters.dateTo)));

  const rows = await db.select({
    origen: leads.origen,
    total: sql<number>`COUNT(*)::int`,
    hasSource: sql<number>`SUM(CASE WHEN ${leads.utmSource} IS NOT NULL AND ${leads.utmSource} != '' THEN 1 ELSE 0 END)::int`,
    hasMedium: sql<number>`SUM(CASE WHEN ${leads.utmMedium} IS NOT NULL AND ${leads.utmMedium} != '' THEN 1 ELSE 0 END)::int`,
    hasCampaign: sql<number>`SUM(CASE WHEN ${leads.utmCampaign} IS NOT NULL AND ${leads.utmCampaign} != '' THEN 1 ELSE 0 END)::int`,
    hasContent: sql<number>`SUM(CASE WHEN ${leads.utmContent} IS NOT NULL AND ${leads.utmContent} != '' THEN 1 ELSE 0 END)::int`,
    hasTerm: sql<number>`SUM(CASE WHEN ${leads.utmTerm} IS NOT NULL AND ${leads.utmTerm} != '' THEN 1 ELSE 0 END)::int`,
    completelyMissing: sql<number>`SUM(CASE WHEN (${leads.utmSource} IS NULL OR ${leads.utmSource} = '') AND (${leads.utmCampaign} IS NULL OR ${leads.utmCampaign} = '') THEN 1 ELSE 0 END)::int`,
  })
    .from(leads)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(leads.origen)
    .orderBy(desc(sql<number>`COUNT(*)`));

  return rows.map((r) => ({
    origen: r.origen ?? "(sin origen)",
    total: Number(r.total ?? 0),
    hasSource: Number(r.hasSource ?? 0),
    hasMedium: Number(r.hasMedium ?? 0),
    hasCampaign: Number(r.hasCampaign ?? 0),
    hasContent: Number(r.hasContent ?? 0),
    hasTerm: Number(r.hasTerm ?? 0),
    completelyMissing: Number(r.completelyMissing ?? 0),
  }));
}

export interface LeadWithMissingUtm {
  leadId: number;
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
  origen: string | null;
  fecha: Date | null;
  createdAt: Date;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  webhookLogId: number | null;
  webhookEndpoint: string | null;
  hasRawPayload: boolean;
}

/**
 * List up to `limit` recent leads that have no UTM attribution — the
 * "unrecoverable unless we dig into the raw webhook payload" bucket.
 * Joined to `webhook_logs` by leadId so the UI can show "view payload" for
 * forensic inspection and retroactive repair.
 */
export async function getLeadsWithMissingUtm(params: { limit?: number; dateFrom?: string; dateTo?: string } = {}): Promise<LeadWithMissingUtm[]> {
  const db = await getDb();
  if (!db) return [];
  const limit = params.limit ?? 20;
  const conditions: any[] = [
    sql`(${leads.utmSource} IS NULL OR ${leads.utmSource} = '')`,
    sql`(${leads.utmCampaign} IS NULL OR ${leads.utmCampaign} = '')`,
  ];
  if (params.dateFrom) conditions.push(gte(leads.createdAt, new Date(params.dateFrom)));
  if (params.dateTo) conditions.push(lte(leads.createdAt, new Date(params.dateTo)));

  const rows = await db.select({
    leadId: leads.id,
    nombre: leads.nombre,
    correo: leads.correo,
    telefono: leads.telefono,
    origen: leads.origen,
    fecha: leads.fecha,
    createdAt: leads.createdAt,
    utmSource: leads.utmSource,
    utmMedium: leads.utmMedium,
    utmCampaign: leads.utmCampaign,
    utmContent: leads.utmContent,
    utmTerm: leads.utmTerm,
  })
    .from(leads)
    .where(and(...conditions))
    .orderBy(desc(leads.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  // Second query: find the most recent webhook_log per leadId so we can show
  // "view payload" when available. One-shot query keeps this cheap.
  const leadIds = rows.map((r) => r.leadId);
  const logs = await db
    .select({
      id: webhookLogs.id,
      leadId: webhookLogs.leadId,
      endpoint: webhookLogs.endpoint,
      rawPayload: webhookLogs.rawPayload,
      createdAt: webhookLogs.createdAt,
    })
    .from(webhookLogs)
    .where(and(inArray(webhookLogs.leadId, leadIds)))
    .orderBy(desc(webhookLogs.createdAt));

  // Take the first (most recent) log per leadId.
  const logByLead = new Map<number, { id: number; endpoint: string | null; hasRawPayload: boolean }>();
  for (const log of logs) {
    if (log.leadId == null) continue;
    if (!logByLead.has(log.leadId)) {
      logByLead.set(log.leadId, {
        id: log.id,
        endpoint: log.endpoint ?? null,
        hasRawPayload: Boolean(log.rawPayload && log.rawPayload.length > 0),
      });
    }
  }

  return rows.map((r) => {
    const log = logByLead.get(r.leadId);
    return {
      leadId: r.leadId,
      nombre: r.nombre,
      correo: r.correo,
      telefono: r.telefono,
      origen: r.origen,
      fecha: r.fecha,
      createdAt: r.createdAt,
      utmSource: r.utmSource,
      utmMedium: r.utmMedium,
      utmCampaign: r.utmCampaign,
      utmContent: r.utmContent,
      utmTerm: r.utmTerm,
      webhookLogId: log?.id ?? null,
      webhookEndpoint: log?.endpoint ?? null,
      hasRawPayload: log?.hasRawPayload ?? false,
    };
  });
}

/** Fetch a single webhook_log by id — used by the "ver payload" modal. */
export async function getWebhookLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(webhookLogs).where(eq(webhookLogs.id, id)).limit(1);
  return rows[0] ?? null;
}

// ==================== ATTRIBUTION REPAIR ====================
//
// Retroactively recovers attribution fields for leads that came in with
// missing/empty UTMs, by re-parsing the original `webhook_log.rawPayload`.
//
// Why this exists: the live webhook parsers evolved — earlier versions missed
// some aliases (e.g. `ad_name`→utmContent, ManyChat `custom_fields.last_ad_id`,
// `fbclid` as fallback identifier). For any lead whose payload was captured in
// full we can now re-run the improved parser and fill in the gaps without
// losing anything (only NULL/empty fields are touched; known-good values are
// never overwritten).

interface ExtractedAttribution {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  gclid: string | null;
  landingUrl: string | null;
  attributionReferrer: string | null;
}

/**
 * Normalize ManyChat custom_fields which arrive as either:
 *   {name: value}  (webhook direct payload)
 *   [{name, value}, ...]  (API response)
 */
function normalizeManychatCustomFields(raw: any): Record<string, any> {
  if (!raw || typeof raw !== "object") return {};
  if (Array.isArray(raw)) {
    const out: Record<string, any> = {};
    for (const f of raw) {
      if (f && typeof f === "object" && f.name != null) out[String(f.name)] = f.value;
    }
    return out;
  }
  return raw;
}

/**
 * Walk a potentially-nested webhook payload and pull out any attribution data
 * we know how to recognize. Mirrors the logic in /api/webhook/{lead,prospect,manychat}
 * so that rebuilding a lead from its stored rawPayload yields the same result
 * the live webhook would today.
 *
 * Returns nulls for anything not found; caller decides whether to overwrite.
 */
function extractAttributionFromPayload(payload: any): ExtractedAttribution {
  const out: ExtractedAttribution = {
    utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null,
    fbclid: null, gclid: null, landingUrl: null, attributionReferrer: null,
  };
  if (!payload || typeof payload !== "object") return out;

  // Flatten one level of nested objects like {customData: {...}, contact: {...}}
  // so we can look up keys uniformly. We keep the original at the top and
  // layer flatter versions underneath.
  const merged: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      for (const [nk, nv] of Object.entries(v as Record<string, any>)) {
        if (typeof nv !== "object" || nv === null) {
          if (merged[nk] === undefined) merged[nk] = nv;
        }
      }
    }
    // Always keep the root-level value — it wins over nested.
    merged[k] = v;
  }

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = merged[k];
      if (v != null && String(v).trim() !== "") return String(v);
    }
    return null;
  };

  // Straight UTM keys (all known aliases from the live parsers)
  out.utmSource = pick("utm_source", "utmSource", "UTM_Source");
  out.utmMedium = pick("utm_medium", "utmMedium", "UTM_Medium");
  out.utmCampaign = pick("utm_campaign", "utmCampaign", "UTM_Campaign", "campaign_name");
  out.utmContent = pick("utm_content", "utmContent", "UTM_Content", "ad_name");
  out.utmTerm = pick("utm_term", "utmTerm", "UTM_Term", "adset_name");

  out.fbclid = pick("fbclid", "fbc");
  out.gclid = pick("gclid");
  out.landingUrl = pick("landing_url", "landingUrl", "page_url", "pageUrl");
  out.attributionReferrer = pick("referrer", "http_referrer", "httpReferrer");

  // --- ManyChat-specific fallback ---
  const customFields = normalizeManychatCustomFields(
    payload.custom_fields ?? payload.subscriber?.custom_fields ?? null,
  );
  const igRef = payload.ig_ref || payload.entry_point || payload.last_input_text
    || payload.subscriber?.ig_ref || null;
  const hasAdRef = !!igRef || !!customFields.last_ad_id || !!customFields.utm_source
    || !!customFields.ad_id || !!customFields.utm_content;

  if (!out.utmSource && customFields.utm_source) out.utmSource = String(customFields.utm_source);
  if (!out.utmSource && hasAdRef) out.utmSource = "instagram";
  if (!out.utmMedium && customFields.utm_medium) out.utmMedium = String(customFields.utm_medium);
  if (!out.utmMedium && hasAdRef) out.utmMedium = "social";
  if (!out.utmCampaign && (customFields.utm_campaign || customFields.campaign_name)) {
    out.utmCampaign = String(customFields.utm_campaign || customFields.campaign_name);
  }
  if (!out.utmContent && (customFields.utm_content || customFields.last_ad_id || customFields.ad_id)) {
    out.utmContent = String(customFields.utm_content || customFields.last_ad_id || customFields.ad_id);
  }
  if (!out.utmTerm && (customFields.utm_term || customFields.adset_id || customFields.adset_name)) {
    out.utmTerm = String(customFields.utm_term || customFields.adset_id || customFields.adset_name);
  }
  if (!out.fbclid && (customFields.fbclid || customFields.fbc)) {
    out.fbclid = String(customFields.fbclid || customFields.fbc);
  }
  if (!out.landingUrl && (customFields.landing_url || customFields.landingUrl)) {
    out.landingUrl = String(customFields.landing_url || customFields.landingUrl);
  }

  return out;
}

export interface RepairAttributionResult {
  leadId: number;
  repaired: boolean;
  fieldsSet: string[];
  reason: string;
  source?: string | null;   // webhook endpoint where the data came from, if any
}

/**
 * Re-parse stored webhook_logs for leads missing attribution and backfill
 * nullable/empty UTM + click-id fields. Never overwrites existing values.
 *
 * Modes:
 *   - If `leadId` provided: attempt repair for that lead only.
 *   - Otherwise: scan up to `limit` most-recent leads with missing utmSource/utmCampaign.
 *
 * Returns one result per candidate lead. `repaired=false` is expected when the
 * original payload truly had no attribution (e.g. direct prospect form, manual
 * entry) — the UI uses `reason` to explain why.
 */
export async function repairMissingAttribution(params: { leadId?: number; limit?: number } = {}): Promise<RepairAttributionResult[]> {
  const db = await getDb();
  if (!db) return [];
  const limit = params.limit ?? 50;

  // Step 1: pick candidates
  const baseQuery = db.select({
    id: leads.id,
    utmSource: leads.utmSource,
    utmMedium: leads.utmMedium,
    utmCampaign: leads.utmCampaign,
    utmContent: leads.utmContent,
    utmTerm: leads.utmTerm,
    fbclid: leads.fbclid,
    gclid: leads.gclid,
    landingUrl: leads.landingUrl,
    attributionReferrer: leads.attributionReferrer,
  }).from(leads);

  const candidates = params.leadId
    ? await baseQuery.where(eq(leads.id, params.leadId)).limit(1)
    : await baseQuery
        .where(and(
          sql`(${leads.utmSource} IS NULL OR ${leads.utmSource} = '')`,
          sql`(${leads.utmCampaign} IS NULL OR ${leads.utmCampaign} = '')`,
        ))
        .orderBy(desc(leads.createdAt))
        .limit(limit);

  if (candidates.length === 0) return [];

  // Step 2: pull all webhook_logs for those leads in one query
  const leadIds = candidates.map((c) => c.id);
  const logs = await db.select({
    id: webhookLogs.id,
    leadId: webhookLogs.leadId,
    endpoint: webhookLogs.endpoint,
    rawPayload: webhookLogs.rawPayload,
    createdAt: webhookLogs.createdAt,
  })
    .from(webhookLogs)
    .where(and(inArray(webhookLogs.leadId, leadIds), isNotNull(webhookLogs.rawPayload)))
    .orderBy(desc(webhookLogs.createdAt));

  const logsByLead = new Map<number, Array<{ endpoint: string | null; rawPayload: string }>>();
  for (const log of logs) {
    if (log.leadId == null || !log.rawPayload) continue;
    const list = logsByLead.get(log.leadId) ?? [];
    list.push({ endpoint: log.endpoint ?? null, rawPayload: log.rawPayload });
    logsByLead.set(log.leadId, list);
  }

  const results: RepairAttributionResult[] = [];
  for (const lead of candidates) {
    const leadLogs = logsByLead.get(lead.id) ?? [];
    if (leadLogs.length === 0) {
      results.push({
        leadId: lead.id,
        repaired: false,
        fieldsSet: [],
        reason: "No webhook_log with rawPayload (probably manual entry or ManyChat before logging was enabled).",
      });
      continue;
    }

    // Try each stored payload. We prefer the first (most recent) payload
    // that surfaces any attribution — that's the one that drove the latest
    // webhook update for this lead.
    let extracted: ExtractedAttribution | null = null;
    let extractedEndpoint: string | null = null;
    for (const log of leadLogs) {
      let parsed: any;
      try {
        parsed = JSON.parse(log.rawPayload);
      } catch {
        continue;
      }
      const e = extractAttributionFromPayload(parsed);
      const hasAny = e.utmSource || e.utmMedium || e.utmCampaign || e.utmContent
                  || e.utmTerm || e.fbclid || e.gclid || e.landingUrl;
      if (hasAny) {
        extracted = e;
        extractedEndpoint = log.endpoint;
        break;
      }
    }

    if (!extracted) {
      results.push({
        leadId: lead.id,
        repaired: false,
        fieldsSet: [],
        reason: `Scanned ${leadLogs.length} payload(s) — no attribution data found.`,
        source: leadLogs[0]?.endpoint ?? null,
      });
      continue;
    }

    // Only fill empty fields — never overwrite
    const updateData: Record<string, any> = {};
    const fieldsSet: string[] = [];
    const setIfEmpty = (key: keyof ExtractedAttribution, current: string | null) => {
      const val = extracted![key];
      if (val && (current == null || current === "")) {
        updateData[key] = val;
        fieldsSet.push(key);
      }
    };
    setIfEmpty("utmSource", lead.utmSource);
    setIfEmpty("utmMedium", lead.utmMedium);
    setIfEmpty("utmCampaign", lead.utmCampaign);
    setIfEmpty("utmContent", lead.utmContent);
    setIfEmpty("utmTerm", lead.utmTerm);
    setIfEmpty("fbclid", lead.fbclid);
    setIfEmpty("gclid", lead.gclid);
    setIfEmpty("landingUrl", lead.landingUrl);
    setIfEmpty("attributionReferrer", lead.attributionReferrer);

    if (fieldsSet.length === 0) {
      results.push({
        leadId: lead.id,
        repaired: false,
        fieldsSet: [],
        reason: "Attribution found in payload but lead already has these fields.",
        source: extractedEndpoint,
      });
      continue;
    }

    updateData.updatedAt = new Date();
    await db.update(leads).set(updateData).where(eq(leads.id, lead.id));
    results.push({
      leadId: lead.id,
      repaired: true,
      fieldsSet,
      reason: `Filled ${fieldsSet.length} field(s) from ${extractedEndpoint ?? "stored payload"}.`,
      source: extractedEndpoint,
    });
  }

  return results;
}

/**
 * Get daily spend trend for a date range (for charts).
 */
export async function getAdSpendTrend(dateFrom: string, dateTo: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    fecha: adMetricsDaily.fecha,
    totalSpend: sql<number>`SUM(${adMetricsDaily.spend})`,
    totalImpressions: sql<number>`SUM(${adMetricsDaily.impressions})`,
    totalClicks: sql<number>`SUM(${adMetricsDaily.clicks})`,
    totalLeads: sql<number>`SUM(${adMetricsDaily.leads})`,
  })
    .from(adMetricsDaily)
    .where(and(
      gte(adMetricsDaily.fecha, new Date(dateFrom)),
      lte(adMetricsDaily.fecha, new Date(dateTo)),
    ))
    .groupBy(adMetricsDaily.fecha)
    .orderBy(asc(adMetricsDaily.fecha));
}


// ==================== SYNC LOG ====================

export async function createSyncLog(data: { syncType: string; status?: "running" | "success" | "error"; dateFrom?: string; dateTo?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(syncLog).values({
    syncType: data.syncType,
    status: data.status ?? "running",
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
  }).returning({ id: syncLog.id });
  return result.id;
}

export async function updateSyncLog(id: number, data: {
  status?: "running" | "success" | "error";
  details?: string;
  campaignsSynced?: number;
  adsetsSynced?: number;
  adsSynced?: number;
  insightsSynced?: number;
  durationMs?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(syncLog).set(data).where(eq(syncLog.id, id));
}

export async function getLastSyncLog(syncType?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = syncType ? [eq(syncLog.syncType, syncType), eq(syncLog.status, "success")] : [eq(syncLog.status, "success")];
  const rows = await db.select().from(syncLog).where(and(...conditions)).orderBy(desc(syncLog.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function getSyncLogs(limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(syncLog).orderBy(desc(syncLog.createdAt)).limit(limit);
}


// ============================================================
// SETTER WORK QUEUE - Priority Action Chain
// ============================================================

export type WorkQueueItem = {
  id: number;
  leadId: number;
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
  score: number | null;
  scoreLabel: string | null;
  setterAsignado: string | null;
  categoria: string;
  action: string; // The action type
  priority: number; // 1 = highest
  urgency: "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
  detail: string; // Human-readable description
  timeInfo: string | null; // e.g. "hace 2h", "mañana 3pm"
  leadFecha: Date | null;
};

/**
 * Get the setter's prioritized work queue.
 * Priority chain (adapted to Sacamedi process):
 * 1. CONFIRMAR_HOY - Leads con demo HOY que no están confirmados
 * 2. LEADS_NUEVOS_SIN_CONTACTAR - Leads que entraron y nadie ha contactado (speed-to-lead)
 * 3. CONFIRMAR_MANANA - Leads con demo MAÑANA que no están confirmados
 * 4. LEADS_NO_CONTESTARON - Leads que no contestaron, reintentar
 * 5. DINERO_GRATIS - Leads sin agendar nuevos (categoría LEAD)
 * 6. CONFIRMAR_PROXIMOS - Leads con demo en 2-3 días sin confirmar
 */
export async function getSetterWorkQueue(setter?: string): Promise<WorkQueueItem[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000);
  const threeDaysEnd = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000);

  const queue: WorkQueueItem[] = [];

  // Build base conditions
  const baseConditions = setter ? [eq(leads.setterAsignado, setter)] : [];

  // === PRIORITY 1: Confirmar demos de HOY ===
  const demosHoy = await db.select().from(leads).where(
    and(
      eq(leads.categoria, "AGENDA"),
      gte(leads.fecha, todayStart),
      lte(leads.fecha, todayEnd),
      ne(leads.estadoConfirmacion, "CONFIRMADA"),
      ne(leads.estadoConfirmacion, "CANCELADA"),
      ne(leads.asistencia, "ASISTIÓ"),
      ne(leads.asistencia, "NO SHOW"),
      ...baseConditions
    )
  ).orderBy(asc(leads.fecha));

  for (const lead of demosHoy) {
    queue.push({
      id: queue.length + 1,
      leadId: lead.id,
      nombre: lead.nombre,
      correo: lead.correo,
      telefono: lead.telefono,
      score: lead.score,
      scoreLabel: lead.scoreLabel,
      setterAsignado: lead.setterAsignado,
      categoria: lead.categoria,
      action: "CONFIRMAR_HOY",
      priority: 1,
      urgency: "CRITICA",
      detail: "Demo hoy — confirmar asistencia",
      timeInfo: lead.fecha ? formatTime(lead.fecha) : null,
      leadFecha: lead.fecha,
    });
  }

  // === PRIORITY 2: Leads nuevos sin contactar (speed-to-lead) ===
  // Un lead se considera "sin contactar" si resultadoContacto es PENDIENTE o nulo
  // (CONTESTÓ, NO CONTESTÓ, BUZÓN, etc. = ya fue contactado en algún momento)
  const sinContactar = await db.select().from(leads).where(
    and(
      eq(leads.categoria, "AGENDA"),
      or(
        eq(leads.resultadoContacto, "PENDIENTE"),
        isNull(leads.resultadoContacto)
      ),
      ...baseConditions
    )
  ).orderBy(asc(leads.createdAt));

  for (const lead of sinContactar) {
    const minutesSinceEntry = Math.floor((now.getTime() - (lead.createdAt?.getTime() || now.getTime())) / 60000);
    let urgency: WorkQueueItem["urgency"] = "MEDIA";
    if (minutesSinceEntry <= 30) urgency = "CRITICA";
    else if (minutesSinceEntry <= 180) urgency = "ALTA";
    else urgency = "CRITICA"; // más de 3h sin contactar = crítico

    queue.push({
      id: queue.length + 1,
      leadId: lead.id,
      nombre: lead.nombre,
      correo: lead.correo,
      telefono: lead.telefono,
      score: lead.score,
      scoreLabel: lead.scoreLabel,
      setterAsignado: lead.setterAsignado,
      categoria: lead.categoria,
      action: "CONTACTAR_NUEVO",
      priority: 2,
      urgency,
      detail: `Sin contactar — ${formatElapsed(minutesSinceEntry)}`,
      timeInfo: formatElapsed(minutesSinceEntry),
      leadFecha: lead.fecha,
    });
  }

  // === PRIORITY 3: Confirmar demos de MAÑANA ===
  const demosManana = await db.select().from(leads).where(
    and(
      eq(leads.categoria, "AGENDA"),
      gte(leads.fecha, todayEnd),
      lte(leads.fecha, tomorrowEnd),
      ne(leads.estadoConfirmacion, "CONFIRMADA"),
      ne(leads.estadoConfirmacion, "CANCELADA"),
      ne(leads.asistencia, "ASISTIÓ"),
      ne(leads.asistencia, "NO SHOW"),
      ...baseConditions
    )
  ).orderBy(asc(leads.fecha));

  for (const lead of demosManana) {
    queue.push({
      id: queue.length + 1,
      leadId: lead.id,
      nombre: lead.nombre,
      correo: lead.correo,
      telefono: lead.telefono,
      score: lead.score,
      scoreLabel: lead.scoreLabel,
      setterAsignado: lead.setterAsignado,
      categoria: lead.categoria,
      action: "CONFIRMAR_MANANA",
      priority: 3,
      urgency: "ALTA",
      detail: "Demo mañana — confirmar asistencia",
      timeInfo: lead.fecha ? formatTime(lead.fecha) : null,
      leadFecha: lead.fecha,
    });
  }

  // === PRIORITY 4: Leads que no contestaron (reintentar) ===
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const noContestaron = await db.select().from(leads).where(
    and(
      eq(leads.categoria, "AGENDA"),
      or(
        eq(leads.resultadoContacto, "NO CONTESTÓ"),
        eq(leads.resultadoContacto, "BUZÓN")
      ),
      gte(leads.createdAt, sevenDaysAgo),
      ne(leads.estadoConfirmacion, "CONFIRMADA"),
      ne(leads.estadoConfirmacion, "CANCELADA"),
      ...baseConditions
    )
  ).orderBy(asc(leads.createdAt));

  for (const lead of noContestaron) {
    queue.push({
      id: queue.length + 1,
      leadId: lead.id,
      nombre: lead.nombre,
      correo: lead.correo,
      telefono: lead.telefono,
      score: lead.score,
      scoreLabel: lead.scoreLabel,
      setterAsignado: lead.setterAsignado,
      categoria: lead.categoria,
      action: "REINTENTAR_CONTACTO",
      priority: 4,
      urgency: "MEDIA",
      detail: `${lead.resultadoContacto} — ${lead.intentosContacto || 0} intentos`,
      timeInfo: lead.intentosContacto ? `${lead.intentosContacto} intentos` : null,
      leadFecha: lead.fecha,
    });
  }

  // === PRIORITY 5: Dinero Gratis - Leads sin agendar nuevos ===
  const leadsSinAgendar = await db.select().from(leads).where(
    and(
      eq(leads.categoria, "LEAD"),
      or(
        eq(leads.estadoLead, "NUEVO"),
        eq(leads.estadoLead, "CONTACTADO")
      ),
      ...baseConditions
    )
  ).orderBy(asc(leads.createdAt));

  for (const lead of leadsSinAgendar) {
    const minutesSinceEntry = Math.floor((now.getTime() - (lead.createdAt?.getTime() || now.getTime())) / 60000);
    queue.push({
      id: queue.length + 1,
      leadId: lead.id,
      nombre: lead.nombre,
      correo: lead.correo,
      telefono: lead.telefono,
      score: lead.score,
      scoreLabel: lead.scoreLabel,
      setterAsignado: lead.setterAsignado,
      categoria: lead.categoria,
      action: "DINERO_GRATIS",
      priority: 5,
      urgency: lead.estadoLead === "NUEVO" ? "ALTA" : "MEDIA",
      detail: lead.estadoLead === "NUEVO" ? `Lead nuevo — ${formatElapsed(minutesSinceEntry)}` : "Lead contactado — seguir calificando",
      timeInfo: formatElapsed(minutesSinceEntry),
      leadFecha: lead.fecha,
    });
  }

  // === PRIORITY 6: Confirmar demos en 2-3 días ===
  const demosProximos = await db.select().from(leads).where(
    and(
      eq(leads.categoria, "AGENDA"),
      gte(leads.fecha, tomorrowEnd),
      lte(leads.fecha, threeDaysEnd),
      ne(leads.estadoConfirmacion, "CONFIRMADA"),
      ne(leads.estadoConfirmacion, "CANCELADA"),
      ne(leads.asistencia, "ASISTIÓ"),
      ne(leads.asistencia, "NO SHOW"),
      ...baseConditions
    )
  ).orderBy(asc(leads.fecha));

  for (const lead of demosProximos) {
    queue.push({
      id: queue.length + 1,
      leadId: lead.id,
      nombre: lead.nombre,
      correo: lead.correo,
      telefono: lead.telefono,
      score: lead.score,
      scoreLabel: lead.scoreLabel,
      setterAsignado: lead.setterAsignado,
      categoria: lead.categoria,
      action: "CONFIRMAR_PROXIMOS",
      priority: 6,
      urgency: "BAJA",
      detail: "Demo en 2-3 días — pre-confirmar",
      timeInfo: lead.fecha ? formatTime(lead.fecha) : null,
      leadFecha: lead.fecha,
    });
  }

  return queue;
}

// Helper: format elapsed time in human-readable Spanish
function formatElapsed(minutes: number): string {
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

// Helper: format a date as time string
function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ============================================================
// CONFIRMATION WORKFLOW
// ============================================================

/**
 * Get leads that need confirmation actions.
 * Returns leads with upcoming demos that haven't been confirmed yet,
 * grouped by urgency based on how close the demo is.
 */
export async function getConfirmationQueue(setter?: string): Promise<{
  urgente: Lead[];   // Demo hoy, sin confirmar
  pronto: Lead[];    // Demo mañana, sin confirmar
  planificar: Lead[]; // Demo en 2-3 días, sin confirmar
  stats: { total: number; confirmadas: number; pendientes: number; tasa: number };
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000);
  const threeDaysEnd = new Date(todayStart.getTime() + 4 * 24 * 60 * 60 * 1000);

  const baseConditions = setter ? [eq(leads.setterAsignado, setter)] : [];

  // All upcoming demos in the next 4 days
  const upcomingDemos = await db.select().from(leads).where(
    and(
      eq(leads.categoria, "AGENDA"),
      gte(leads.fecha, todayStart),
      lte(leads.fecha, threeDaysEnd),
      ne(leads.asistencia, "ASISTIÓ"),
      ne(leads.asistencia, "NO SHOW"),
      ...baseConditions
    )
  ).orderBy(asc(leads.fecha));

  const urgente: Lead[] = [];
  const pronto: Lead[] = [];
  const planificar: Lead[] = [];
  let confirmadas = 0;

  for (const lead of upcomingDemos) {
    const demoDate = lead.fecha;
    if (!demoDate) continue;

    if (lead.estadoConfirmacion === "CONFIRMADA") {
      confirmadas++;
      continue;
    }
    if (lead.estadoConfirmacion === "CANCELADA") continue;

    if (demoDate >= todayStart && demoDate < todayEnd) {
      urgente.push(lead);
    } else if (demoDate >= todayEnd && demoDate < tomorrowEnd) {
      pronto.push(lead);
    } else {
      planificar.push(lead);
    }
  }

  const pendientes = urgente.length + pronto.length + planificar.length;
  const total = pendientes + confirmadas;
  const tasa = total > 0 ? Math.round((confirmadas / total) * 100) : 0;

  return {
    urgente,
    pronto,
    planificar,
    stats: { total, confirmadas, pendientes, tasa },
  };
}


// ============================================================
// Team Members - Perfiles de setters y closers
// ============================================================

export async function getTeamMembers(filters?: { rol?: string; activo?: boolean }) {
  const db = (await getDb())!;
  const conditions: any[] = [];

  if (filters?.rol) {
    if (filters.rol === "SETTER") {
      conditions.push(or(eq(teamMembers.rol, "SETTER"), eq(teamMembers.rol, "SETTER_CLOSER")));
    } else if (filters.rol === "CLOSER") {
      conditions.push(or(eq(teamMembers.rol, "CLOSER"), eq(teamMembers.rol, "SETTER_CLOSER")));
    } else {
      conditions.push(eq(teamMembers.rol, filters.rol as any));
    }
  }

  if (filters?.activo !== undefined) {
    conditions.push(eq(teamMembers.activo, filters.activo ? 1 : 0));
  }

  const result = await db
    .select()
    .from(teamMembers)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(teamMembers.nombre);

  return result;
}

export async function createTeamMember(data: { nombre: string; rol: "SETTER" | "CLOSER" | "SETTER_CLOSER"; correo?: string; telefono?: string }) {
  const db = (await getDb())!;
  const [result] = await db.insert(teamMembers).values({
    nombre: data.nombre,
    rol: data.rol,
    correo: data.correo || null,
    telefono: data.telefono || null,
  }).returning();
  return result;
}

export async function updateTeamMember(id: number, data: Partial<{ nombre: string; rol: string; activo: boolean; correo: string; telefono: string }>) {
  const db = (await getDb())!;
  const updates: any = {};
  if (data.nombre !== undefined) updates.nombre = data.nombre;
  if (data.rol !== undefined) updates.rol = data.rol;
  if (data.activo !== undefined) updates.activo = data.activo ? 1 : 0;
  if (data.correo !== undefined) updates.correo = data.correo || null;
  if (data.telefono !== undefined) updates.telefono = data.telefono || null;

  updates.updatedAt = new Date();
  await db.update(teamMembers).set(updates).where(eq(teamMembers.id, id));
  const [updated] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
  return updated;
}

export async function deleteTeamMember(id: number) {
  const db = (await getDb())!;
  await db.delete(teamMembers).where(eq(teamMembers.id, id));
}

// ==================== NO-SHOW PROTOCOL ====================

/**
 * Protocolo No-Show:
 * 1. Actualiza el lead con asistencia = "NO SHOW"
 * 2. Crea (o actualiza) un follow-up RED_HOT desde el lead
 * 3. Registra un log de actividad con el contexto del no-show
 */
export async function createFollowUpFromNoShow(leadId: number, closerAsignado?: string, notas?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Marcar el lead como NO SHOW
  await db.update(leads).set({ asistencia: "NO SHOW", updatedAt: new Date() }).where(eq(leads.id, leadId));

  // 2. Obtener datos del lead
  const leadRows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const lead = leadRows[0];
  if (!lead) throw new Error("Lead not found");

  // 3. Verificar si ya existe un follow-up para este lead
  const existing = await db.select().from(followUps).where(eq(followUps.leadId, leadId)).limit(1);

  let followUpId: number;

  if (existing.length > 0) {
    // Actualizar el follow-up existente a RED_HOT
    followUpId = existing[0].id;
    const proximoFollowUp = new Date();
    proximoFollowUp.setHours(proximoFollowUp.getHours() + 2); // Próximo intento en 2 horas
    await db.update(followUps).set({
      prioridad: "RED_HOT",
      tipo: "HOT",
      estado: "ACTIVO",
      proximoFollowUp,
      notas: notas ? `[NO SHOW] ${notas}` : "[NO SHOW] Lead no asistió a la demo. Protocolo de re-enganche activado.",
      updatedAt: new Date(),
    }).where(eq(followUps.id, followUpId));
  } else {
    // Crear nuevo follow-up RED_HOT
    const proximoFollowUp = new Date();
    proximoFollowUp.setHours(proximoFollowUp.getHours() + 2);

    const [result] = await db.insert(followUps).values({
      leadId,
      nombre: lead.nombre,
      correo: lead.correo,
      telefono: lead.telefono,
      instagram: lead.instagram,
      tipo: "HOT",
      prioridad: "RED_HOT",
      estado: "ACTIVO",
      ultimaObjecion: lead.razonNoConversion,
      montoEstimado: lead.facturado || "0",
      closerAsignado: closerAsignado || lead.closer,
      notas: notas ? `[NO SHOW] ${notas}` : "[NO SHOW] Lead no asistió a la demo. Protocolo de re-enganche activado.",
      linkCRM: lead.linkCRM,
      creadoDesde: "CITAS",
      proximoFollowUp,
    }).returning({ id: followUps.id });
    followUpId = result.id;
  }

  // 4. Registrar log de actividad
  await db.insert(followUpLogs).values({
    followUpId,
    accion: "NOTA",
    detalle: `Protocolo No-Show activado. ${notas || "Lead no asistió a la demo programada."}`,
    realizadoPor: closerAsignado || "Sistema",
  });

  // 5. Actualizar contador de follow-ups
  await db.update(followUps).set({
    ultimoFollowUp: new Date(),
    totalFollowUps: sql`"totalFollowUps" + 1`,
    updatedAt: new Date(),
  }).where(eq(followUps.id, followUpId));

  return followUpId;
}

// ==================== ALLOWED EMAILS (ACCESS CONTROL) ====================

export async function checkEmailAllowed(email: string): Promise<AllowedEmail | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalized = email.toLowerCase().trim();
  const result = await db.select().from(allowedEmails)
    .where(and(eq(allowedEmails.email, normalized), eq(allowedEmails.activo, 1)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllowedEmails(): Promise<AllowedEmail[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(allowedEmails).orderBy(allowedEmails.nombre);
}

export async function createAllowedEmail(data: { email: string; role: "admin" | "setter" | "closer"; nombre?: string }): Promise<AllowedEmail> {
  const db = (await getDb())!;
  const normalized = data.email.toLowerCase().trim();
  const [created] = await db.insert(allowedEmails).values({
    email: normalized,
    role: data.role,
    nombre: data.nombre || null,
  }).returning();
  return created;
}

export async function updateAllowedEmail(id: number, data: Partial<{ email: string; role: string; nombre: string; activo: boolean }>): Promise<AllowedEmail> {
  const db = (await getDb())!;
  const updates: Record<string, any> = {};
  if (data.email !== undefined) updates.email = data.email.toLowerCase().trim();
  if (data.role !== undefined) updates.role = data.role;
  if (data.nombre !== undefined) updates.nombre = data.nombre || null;
  if (data.activo !== undefined) updates.activo = data.activo ? 1 : 0;
  updates.updatedAt = new Date();
  await db.update(allowedEmails).set(updates).where(eq(allowedEmails.id, id));
  const [updated] = await db.select().from(allowedEmails).where(eq(allowedEmails.id, id));
  return updated;
}

export async function deleteAllowedEmail(id: number): Promise<void> {
  const db = (await getDb())!;
  await db.delete(allowedEmails).where(eq(allowedEmails.id, id));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: users.id,
    authId: users.authId,
    name: users.name,
    email: users.email,
    role: users.role,
    lastSignedIn: users.lastSignedIn,
    createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.lastSignedIn));
}


// ==========================================
// Revenue Calculator - Scenarios
// ==========================================

/**
 * Calculate full funnel metrics from inputs.
 * Works in both reverse (revenue → spend) and forward (spend → revenue) modes.
 */
export function calculateFunnel(inputs: {
  mode: "reverse" | "forward";
  revenueGoal?: number;
  adSpendInput?: number;
  ticketPromedio: number;
  upfrontCashPct: number;
  closeRate: number;
  showRate: number;
  confirmationRate: number;
  answerRate: number;
  bookingRate: number;
  landingConvRate: number;
  ctr: number;
  cpm: number;
  setterCapacity: number;
  closerCapacity: number;
  setterMonthlyCost: number;
  closerMonthlyCost: number;
}) {
  const {
    mode, ticketPromedio, upfrontCashPct, closeRate, showRate,
    confirmationRate, answerRate, bookingRate, landingConvRate, ctr, cpm,
    setterCapacity, closerCapacity, setterMonthlyCost, closerMonthlyCost,
  } = inputs;

  const cr = closeRate / 100;
  const sr = showRate / 100;
  const confR = confirmationRate / 100;
  const ar = answerRate / 100;
  const br = bookingRate / 100;
  const lcr = landingConvRate / 100;
  const ctrD = ctr / 100;
  const ucPct = upfrontCashPct / 100;

  let revenue: number;
  let adSpend: number;
  let clientesNecesarios: number;
  let demosNecesarias: number;
  let agendasConfirmadas: number;
  let agendasTotales: number;
  let leadsContactados: number;
  let leadsTotales: number;
  let clicksNecesarios: number;
  let impresionesNecesarias: number;

  if (mode === "reverse") {
    revenue = inputs.revenueGoal || 0;
    clientesNecesarios = Math.ceil(revenue / ticketPromedio);
    demosNecesarias = Math.ceil(clientesNecesarios / cr);
    agendasConfirmadas = Math.ceil(demosNecesarias / sr);
    agendasTotales = Math.ceil(agendasConfirmadas / confR);
    leadsContactados = Math.ceil(agendasTotales / ar);
    leadsTotales = Math.ceil(leadsContactados / br);
    clicksNecesarios = Math.ceil(leadsTotales / lcr);
    impresionesNecesarias = Math.ceil(clicksNecesarios / ctrD);
    adSpend = (impresionesNecesarias / 1000) * cpm;
  } else {
    adSpend = inputs.adSpendInput || 0;
    impresionesNecesarias = Math.floor((adSpend / cpm) * 1000);
    clicksNecesarios = Math.floor(impresionesNecesarias * ctrD);
    leadsTotales = Math.floor(clicksNecesarios * lcr);
    leadsContactados = Math.floor(leadsTotales * br);
    agendasTotales = Math.floor(leadsContactados * ar);
    agendasConfirmadas = Math.floor(agendasTotales * confR);
    demosNecesarias = Math.floor(agendasConfirmadas * sr);
    clientesNecesarios = Math.floor(demosNecesarias * cr);
    revenue = clientesNecesarios * ticketPromedio;
  }

  const cplCalc = leadsTotales > 0 ? adSpend / leadsTotales : 0;
  const cpbCalc = agendasTotales > 0 ? adSpend / agendasTotales : 0;
  const cpaCalc = clientesNecesarios > 0 ? adSpend / clientesNecesarios : 0;
  const settersNeeded = setterCapacity > 0 ? leadsContactados / setterCapacity : 0;
  const closersNeeded = closerCapacity > 0 ? demosNecesarias / closerCapacity : 0;
  const teamCost = (Math.ceil(settersNeeded) * setterMonthlyCost) + (Math.ceil(closersNeeded) * closerMonthlyCost);
  const cacCalc = clientesNecesarios > 0 ? (adSpend + teamCost) / clientesNecesarios : 0;
  const roasCalc = adSpend > 0 ? revenue / adSpend : 0;
  const cashCollected = revenue * ucPct;
  const contractedRevenue = revenue - cashCollected;

  return {
    clientesNecesarios, demosNecesarias, agendasConfirmadas, agendasTotales,
    leadsContactados, leadsTotales, clicksNecesarios, impresionesNecesarias,
    adSpendCalculated: Math.round(adSpend * 100) / 100,
    cpl: Math.round(cplCalc * 100) / 100,
    cpb: Math.round(cpbCalc * 100) / 100,
    cpa: Math.round(cpaCalc * 100) / 100,
    cac: Math.round(cacCalc * 100) / 100,
    roas: Math.round(roasCalc * 100) / 100,
    cashCollected: Math.round(cashCollected * 100) / 100,
    contractedRevenue: Math.round(contractedRevenue * 100) / 100,
    revenueCalculated: Math.round(revenue * 100) / 100,
    settersNecesarios: Math.round(settersNeeded * 100) / 100,
    closersNecesarios: Math.round(closersNeeded * 100) / 100,
    presupuestoMensual: Math.round(adSpend * 100) / 100,
    presupuestoDiario: Math.round((adSpend / 30) * 100) / 100,
  };
}

export async function createRevenueScenario(data: InsertRevenueScenario) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(revenueScenarios).values(data).returning({ id: revenueScenarios.id });
  return { id: result.id };
}

export async function getRevenueScenarios() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(revenueScenarios)
    .where(eq(revenueScenarios.isActive, 1))
    .orderBy(desc(revenueScenarios.updatedAt));
}

export async function getRevenueScenarioById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(revenueScenarios).where(eq(revenueScenarios.id, id));
  return rows[0] || null;
}

export async function updateRevenueScenario(id: number, data: Partial<InsertRevenueScenario>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(revenueScenarios).set({ ...data, updatedAt: new Date() }).where(eq(revenueScenarios.id, id));
}

export async function deleteRevenueScenario(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(revenueScenarios).set({ isActive: 0, updatedAt: new Date() }).where(eq(revenueScenarios.id, id));
}

// ============================================================
// KPI PULSE MONITOR — queries for cron-kpi-monitor
// ============================================================

/**
 * Leads AGENDA with resultadoContacto=PENDIENTE older than `thresholdMinutes`.
 * These are leads that nobody has contacted yet.
 */
export async function getSpeedToLeadAlerts(thresholdMinutes: number = 30) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  const rows = await db
    .select({
      id: leads.id,
      nombre: leads.nombre,
      setterAsignado: leads.setterAsignado,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.categoria, "AGENDA"),
        eq(leads.resultadoContacto, "PENDIENTE"),
        lte(leads.createdAt, cutoff)
      )
    )
    .orderBy(asc(leads.createdAt));

  return rows.map((r) => ({
    ...r,
    minutesSinceCreated: Math.round(
      (Date.now() - new Date(r.createdAt).getTime()) / 60000
    ),
  }));
}

/**
 * Leads without a setter assigned, created in the last 7 days, still PENDIENTE.
 */
export async function getUnassignedLeads() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return db
    .select({
      id: leads.id,
      nombre: leads.nombre,
      correo: leads.correo,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .where(
      and(
        isNull(leads.setterAsignado),
        gte(leads.createdAt, sevenDaysAgo),
        eq(leads.resultadoContacto, "PENDIENTE")
      )
    )
    .orderBy(asc(leads.createdAt));
}

/**
 * Leads with outcome=SEGUIMIENTO whose updatedAt is older than `hoursThreshold`.
 */
export async function getStaleSeguimientos(hoursThreshold: number = 72) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoff = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
  return db
    .select({
      id: leads.id,
      nombre: leads.nombre,
      closer: leads.closer,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.outcome, "SEGUIMIENTO"),
        lte(leads.updatedAt, cutoff)
      )
    )
    .orderBy(asc(leads.updatedAt));
}

/**
 * Quick counts for the last hour: new leads, contact attempts, confirmations.
 */
export async function getHourlySummaryStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [newLeadsRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(leads)
    .where(gte(leads.createdAt, oneHourAgo));

  const [contactedRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(contactAttempts)
    .where(gte(contactAttempts.createdAt, oneHourAgo));

  const [confirmedRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(leads)
    .where(
      and(
        eq(leads.estadoConfirmacion, "CONFIRMADA"),
        gte(leads.updatedAt, oneHourAgo)
      )
    );

  return {
    newLeads: Number(newLeadsRow?.count ?? 0),
    contacted: Number(contactedRow?.count ?? 0),
    confirmed: Number(confirmedRow?.count ?? 0),
  };
}

// ==================== SLACK ALERT QUERIES ====================

/**
 * Appointments that already passed but attendance was never recorded.
 * Only looks at last 24h to avoid flooding with old data.
 */
export async function getOverdueAppointments() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return db
    .select({
      id: leads.id,
      nombre: leads.nombre,
      correo: leads.correo,
      closer: leads.closer,
      setter: leads.setterAsignado,
      fecha: leads.fecha,
    })
    .from(leads)
    .where(
      and(
        eq(leads.categoria, "AGENDA"),
        eq(leads.asistencia, "PENDIENTE"),
        lte(leads.fecha, now),
        gte(leads.fecha, yesterday)
      )
    )
    .orderBy(asc(leads.fecha));
}

/**
 * Follow-ups that are overdue or stale (no recent activity).
 */
export async function getStaleFollowUps(staleDays: number = 5) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);

  // Overdue: proximoFollowUp is in the past
  const overdue = await db
    .select({
      id: followUps.id,
      leadId: followUps.leadId,
      tipo: followUps.tipo,
      closer: followUps.closerAsignado,
      proximoFollowUp: followUps.proximoFollowUp,
      ultimoFollowUp: followUps.ultimoFollowUp,
    })
    .from(followUps)
    .where(
      and(
        eq(followUps.estado, "ACTIVO"),
        lte(followUps.proximoFollowUp, now)
      )
    )
    .orderBy(asc(followUps.proximoFollowUp));

  // Stale: no activity in N days (based on ultimoFollowUp)
  const stale = await db
    .select({
      id: followUps.id,
      leadId: followUps.leadId,
      tipo: followUps.tipo,
      closer: followUps.closerAsignado,
      proximoFollowUp: followUps.proximoFollowUp,
      ultimoFollowUp: followUps.ultimoFollowUp,
    })
    .from(followUps)
    .where(
      and(
        eq(followUps.estado, "ACTIVO"),
        or(
          lte(followUps.ultimoFollowUp, staleThreshold),
          isNull(followUps.ultimoFollowUp)
        )
      )
    )
    .orderBy(asc(followUps.ultimoFollowUp));

  // Today's follow-ups (heads-up)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const todayFollowUps = await db
    .select({
      id: followUps.id,
      leadId: followUps.leadId,
      tipo: followUps.tipo,
      closer: followUps.closerAsignado,
      proximoFollowUp: followUps.proximoFollowUp,
    })
    .from(followUps)
    .where(
      and(
        eq(followUps.estado, "ACTIVO"),
        gte(followUps.proximoFollowUp, now),
        lte(followUps.proximoFollowUp, tomorrow)
      )
    )
    .orderBy(asc(followUps.proximoFollowUp));

  return { overdue, stale, todayFollowUps };
}

/**
 * Escalated confirmation check: leads with upcoming demos split by urgency tier.
 */
export async function getEscalatedConfirmations() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const in1h = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const in4h = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const base = and(
    eq(leads.categoria, "AGENDA"),
    eq(leads.estadoConfirmacion, "PENDIENTE"),
    gte(leads.fecha, now)
  );

  const cols = {
    id: leads.id,
    nombre: leads.nombre,
    correo: leads.correo,
    setter: leads.setterAsignado,
    closer: leads.closer,
    fecha: leads.fecha,
  };

  // T-1h: critical
  const within1h = await db.select(cols).from(leads)
    .where(and(base, lte(leads.fecha, in1h)))
    .orderBy(asc(leads.fecha));

  // T-4h: warning (excluding those already in 1h bucket)
  const within4h = await db.select(cols).from(leads)
    .where(and(base, gte(leads.fecha, in1h), lte(leads.fecha, in4h)))
    .orderBy(asc(leads.fecha));

  // T-24h: info (excluding 4h bucket)
  const within24h = await db.select(cols).from(leads)
    .where(and(base, gte(leads.fecha, in4h), lte(leads.fecha, in24h)))
    .orderBy(asc(leads.fecha));

  return { within1h, within4h, within24h };
}

// ==================== INSTAGRAM FUNNEL ====================

export async function findLeadByInstagram(handle: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db
    .select()
    .from(leads)
    .where(sql`LOWER(${leads.instagram}) = LOWER(${handle})`)
    .limit(1);
  return results[0] ?? null;
}

export async function findLeadByManychatId(subscriberId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db
    .select()
    .from(leads)
    .where(eq(leads.manychatSubscriberId, subscriberId))
    .limit(1);
  return results[0] ?? null;
}

export async function createManychatEvent(data: {
  subscriberId: string;
  eventType: string;
  eventData?: any;
  rawPayload?: string;
  tagName?: string;
  leadId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { rawPayload, ...rest } = data;
  const values = {
    ...rest,
    eventData: rest.eventData ?? (rawPayload ? rawPayload : undefined),
  };
  const [result] = await db
    .insert(manychatEvents)
    .values(values)
    .returning({ id: manychatEvents.id });
  return result.id;
}

export async function getManychatEvents(limit: number = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(manychatEvents)
    .orderBy(desc(manychatEvents.createdAt))
    .limit(limit);
}

export async function getInstagramFunnelKPIs(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [eq(leads.origen, "INSTAGRAM")];
  if (filters?.mes) conditions.push(eq(leads.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(leads.semana, filters.semana));
  const where = and(...conditions);

  const result = await db.select({
    totalIgLeads: sql<number>`COUNT(*)`,
    nuevosSeguidores: sql<number>`SUM(CASE WHEN ${leads.igFunnelStage} = 'NUEVO_SEGUIDOR' THEN 1 ELSE 0 END)`,
    dmsEnviados: sql<number>`SUM(CASE WHEN ${leads.igFunnelStage} = 'DM_ENVIADO' THEN 1 ELSE 0 END)`,
    enConversacion: sql<number>`SUM(CASE WHEN ${leads.igFunnelStage} = 'EN_CONVERSACION' THEN 1 ELSE 0 END)`,
    calificados: sql<number>`SUM(CASE WHEN ${leads.igFunnelStage} = 'CALIFICADO' THEN 1 ELSE 0 END)`,
    agendasEnviadas: sql<number>`SUM(CASE WHEN ${leads.igFunnelStage} = 'AGENDA_ENVIADA' THEN 1 ELSE 0 END)`,
    agendasReservadas: sql<number>`SUM(CASE WHEN ${leads.igFunnelStage} = 'AGENDA_RESERVADA' THEN 1 ELSE 0 END)`,
    demosAsistidas: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'ASISTIÓ' THEN 1 ELSE 0 END)`,
    ventas: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN 1 ELSE 0 END)`,
    cashFromIg: sql<number>`COALESCE(SUM(CAST(${leads.cashCollected} AS DECIMAL(10,2))), 0)`,
    revenueFromIg: sql<number>`COALESCE(SUM(CAST(${leads.contractedRevenue} AS DECIMAL(10,2))), 0)`,
  }).from(leads).where(where);

  return result[0];
}

export async function getSetterIgPerformance(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: any[] = [];
  if (filters?.mes) conditions.push(eq(setterActivities.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(setterActivities.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.select({
    setter: setterActivities.setter,
    igConversacionesIniciadas: sql<number>`COALESCE(SUM(${setterActivities.igConversacionesIniciadas}), 0)`,
    igRespuestasRecibidas: sql<number>`COALESCE(SUM(${setterActivities.igRespuestasRecibidas}), 0)`,
    igCalificados: sql<number>`COALESCE(SUM(${setterActivities.igCalificados}), 0)`,
    igAgendasEnviadas: sql<number>`COALESCE(SUM(${setterActivities.igAgendasEnviadas}), 0)`,
    igAgendasReservadas: sql<number>`COALESCE(SUM(${setterActivities.igAgendasReservadas}), 0)`,
  }).from(setterActivities).where(where).groupBy(setterActivities.setter).orderBy(sql`COALESCE(SUM(${setterActivities.igAgendasReservadas}), 0) DESC`);
}

// ==================== SYSTEM CONFIG ====================
/**
 * Get a single config value by key. Returns null if the key doesn't exist.
 * All values are stored as text; caller is responsible for parsing numbers/JSON.
 */
export async function getSystemConfig(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

/**
 * Get many keys at once. Returns a plain object of {key: value}. Missing keys
 * are simply absent from the result.
 */
export async function getSystemConfigMany(keys: string[]): Promise<Record<string, string | null>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (keys.length === 0) return {};
  const rows = await db.select().from(systemConfig).where(inArray(systemConfig.key, keys));
  const result: Record<string, string | null> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

/**
 * Set a config value. Creates the row if it doesn't exist, otherwise updates
 * the existing one. Returns the stored value.
 */
export async function setSystemConfig(data: {
  key: string;
  value: string | null;
  description?: string;
  updatedBy?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(systemConfig)
    .values({
      key: data.key,
      value: data.value,
      description: data.description,
      updatedBy: data.updatedBy,
    })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: {
        value: data.value,
        description: data.description,
        updatedBy: data.updatedBy,
        updatedAt: new Date(),
      },
    });
}

/**
 * Resolve the platform-wide default ticket value. Used by Dashboard > Pipeline
 * when a lead's `contractedRevenue` / `ticket` is null. Falls back to 3150 USD
 * if the row is missing.
 */
export async function getDefaultTicketValue(): Promise<number> {
  const raw = await getSystemConfig("defaultTicketValue");
  if (!raw) return 3150;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 3150;
}

// ==================== DASHBOARD > CITAS (Appointments report) ====================
/**
 * Breakdown of appointments by confirmation state, attendance, and period.
 * Consumed by `/dashboard/citas`.
 */
export async function getCitasReport(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  if (filters?.mes) conditions.push(eq(leads.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(leads.semana, filters.semana));
  // A "cita" in the business sense = lead with a scheduled appointment. We keep
  // all leads here (even without fecha) because estadoConfirmacion / asistencia
  // still make sense as aggregate metrics.
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totals] = await db.select({
    total: sql<number>`COUNT(*)`,
    pendienteConfirmacion: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'PENDIENTE' THEN 1 ELSE 0 END)`,
    confirmadas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'CONFIRMADA' THEN 1 ELSE 0 END)`,
    noConfirmadas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'NO CONFIRMADA' THEN 1 ELSE 0 END)`,
    canceladas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'CANCELADA' THEN 1 ELSE 0 END)`,
    reagendadas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'REAGENDADA' THEN 1 ELSE 0 END)`,
    asistidas: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'ASISTIÓ' THEN 1 ELSE 0 END)`,
    noShow: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'NO SHOW' THEN 1 ELSE 0 END)`,
    pendienteAsistencia: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'PENDIENTE' THEN 1 ELSE 0 END)`,
    invalidas: sql<number>`SUM(CASE WHEN ${leads.validoParaContacto} = 'NO' THEN 1 ELSE 0 END)`,
    nuevasHoy: sql<number>`SUM(CASE WHEN DATE(${leads.createdAt} AT TIME ZONE 'America/Santiago') = DATE(NOW() AT TIME ZONE 'America/Santiago') THEN 1 ELSE 0 END)`,
    withFecha: sql<number>`SUM(CASE WHEN ${leads.fecha} IS NOT NULL THEN 1 ELSE 0 END)`,
  }).from(leads).where(where);

  // Daily breakdown for the chart — group by date of fecha in Chile TZ.
  const timeline = await db.select({
    date: sql<string>`TO_CHAR(${leads.fecha} AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`,
    total: sql<number>`COUNT(*)`,
    confirmadas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'CONFIRMADA' THEN 1 ELSE 0 END)`,
    canceladas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'CANCELADA' THEN 1 ELSE 0 END)`,
    reagendadas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} = 'REAGENDADA' THEN 1 ELSE 0 END)`,
    asistidas: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'ASISTIÓ' THEN 1 ELSE 0 END)`,
    noShow: sql<number>`SUM(CASE WHEN ${leads.asistencia} = 'NO SHOW' THEN 1 ELSE 0 END)`,
  })
    .from(leads)
    .where(and(
      sql`${leads.fecha} IS NOT NULL`,
      ...(conditions.length > 0 ? conditions : []),
    ))
    .groupBy(sql`TO_CHAR(${leads.fecha} AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${leads.fecha} AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') ASC`);

  // Average daily from the timeline (only days where we actually had citas)
  const diasActivos = timeline.length;
  const totalConFecha = Number(totals?.withFecha ?? 0);
  const confirmadasCount = Number(totals?.confirmadas ?? 0);
  const promedioDiarioTotal = diasActivos > 0 ? totalConFecha / diasActivos : 0;
  const promedioDiarioConfirmadas = diasActivos > 0 ? confirmadasCount / diasActivos : 0;

  return {
    totals: {
      total: Number(totals?.total ?? 0),
      pendienteConfirmacion: Number(totals?.pendienteConfirmacion ?? 0),
      confirmadas: confirmadasCount,
      noConfirmadas: Number(totals?.noConfirmadas ?? 0),
      canceladas: Number(totals?.canceladas ?? 0),
      reagendadas: Number(totals?.reagendadas ?? 0),
      asistidas: Number(totals?.asistidas ?? 0),
      noShow: Number(totals?.noShow ?? 0),
      pendienteAsistencia: Number(totals?.pendienteAsistencia ?? 0),
      invalidas: Number(totals?.invalidas ?? 0),
      nuevasHoy: Number(totals?.nuevasHoy ?? 0),
      diasActivos,
      promedioDiarioTotal,
      promedioDiarioConfirmadas,
    },
    timeline: timeline.map(t => ({
      date: t.date,
      total: Number(t.total),
      confirmadas: Number(t.confirmadas),
      canceladas: Number(t.canceladas),
      reagendadas: Number(t.reagendadas),
      asistidas: Number(t.asistidas),
      noShow: Number(t.noShow),
    })),
  };
}

// ==================== DASHBOARD > PIPELINE (Value of open opportunities) ====================
/**
 * Pipeline value = sum(ticket) of open confirmed demos that haven't happened yet.
 * A lead counts as "pipeline" when:
 *   - estadoConfirmacion = CONFIRMADA (they said they'll come)
 *   - asistencia = PENDIENTE (haven't attended yet)
 *   - outcome = PENDIENTE (not closed/lost)
 * Ticket value per lead: `contractedRevenue` → `ticket` → global default.
 *
 * Also returns top N open opportunities by ticket value.
 */
export async function getPipelineValue(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const defaultTicket = await getDefaultTicketValue();

  const conditions = [];
  if (filters?.mes) conditions.push(eq(leads.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(leads.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Effective ticket value per lead:
  //   1. contractedRevenue (if set and > 0) — what they were actually sold at
  //   2. setupFee + 3*recurrenciaMensual (for SETUP_MONTHLY products, estimated 3-month LTV)
  //   3. facturado (if set and > 0) — invoiced amount fallback
  //   4. the global default (platform-wide setting)
  const effectiveTicketExpr = sql<number>`COALESCE(
    NULLIF(CAST(${leads.contractedRevenue} AS DECIMAL(10,2)), 0),
    NULLIF(CAST(${leads.setupFee} AS DECIMAL(10,2)) + 3 * CAST(${leads.recurrenciaMensual} AS DECIMAL(10,2)), 0),
    NULLIF(CAST(${leads.facturado} AS DECIMAL(10,2)), 0),
    ${defaultTicket}
  )`;

  const [row] = await db.select({
    // Pipeline = open opportunities, regardless of outcome of "confirmada" timing
    pipelineValue: sql<number>`SUM(CASE
      WHEN ${leads.estadoConfirmacion} = 'CONFIRMADA'
       AND ${leads.asistencia} = 'PENDIENTE'
       AND ${leads.outcome} = 'PENDIENTE'
      THEN ${effectiveTicketExpr} ELSE 0 END)`,
    pipelineCount: sql<number>`SUM(CASE
      WHEN ${leads.estadoConfirmacion} = 'CONFIRMADA'
       AND ${leads.asistencia} = 'PENDIENTE'
       AND ${leads.outcome} = 'PENDIENTE'
      THEN 1 ELSE 0 END)`,
    // All open opportunities — includes not yet confirmed
    openOpportunities: sql<number>`SUM(CASE
      WHEN ${leads.outcome} = 'PENDIENTE'
       AND ${leads.asistencia} = 'PENDIENTE'
      THEN 1 ELSE 0 END)`,
    openValue: sql<number>`SUM(CASE
      WHEN ${leads.outcome} = 'PENDIENTE'
       AND ${leads.asistencia} = 'PENDIENTE'
      THEN ${effectiveTicketExpr} ELSE 0 END)`,
    // Closed value for the period (ya cerrado = venta)
    closedValue: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN COALESCE(CAST(${leads.cashCollected} AS DECIMAL(10,2)), 0) ELSE 0 END)`,
    closedCount: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN 1 ELSE 0 END)`,
    // Average ticket across all with a price
    avgTicket: sql<number>`AVG(${effectiveTicketExpr})`,
  }).from(leads).where(where);

  // Top 10 open opportunities (confirmed, not yet attended)
  const topOpps = await db.select({
    id: leads.id,
    nombre: leads.nombre,
    correo: leads.correo,
    telefono: leads.telefono,
    score: leads.score,
    scoreLabel: leads.scoreLabel,
    estadoConfirmacion: leads.estadoConfirmacion,
    asistencia: leads.asistencia,
    outcome: leads.outcome,
    closer: leads.closer,
    fecha: leads.fecha,
    mes: leads.mes,
    semana: leads.semana,
    effectiveTicket: effectiveTicketExpr,
  })
    .from(leads)
    .where(and(
      eq(leads.estadoConfirmacion, "CONFIRMADA"),
      eq(leads.asistencia, "PENDIENTE"),
      eq(leads.outcome, "PENDIENTE"),
      ...(conditions.length > 0 ? conditions : []),
    ))
    .orderBy(desc(effectiveTicketExpr))
    .limit(10);

  const pipelineValue = Number(row?.pipelineValue ?? 0);
  const closedValue = Number(row?.closedValue ?? 0);
  const conversionRate = pipelineValue > 0 ? (closedValue / (pipelineValue + closedValue)) * 100 : 0;

  return {
    defaultTicket,
    pipelineValue,
    pipelineCount: Number(row?.pipelineCount ?? 0),
    openOpportunities: Number(row?.openOpportunities ?? 0),
    openValue: Number(row?.openValue ?? 0),
    closedValue,
    closedCount: Number(row?.closedCount ?? 0),
    avgTicket: Number(row?.avgTicket ?? 0),
    conversionRate,
    topOpps: topOpps.map(o => ({
      ...o,
      effectiveTicket: Number(o.effectiveTicket),
    })),
  };
}

// ==================== DASHBOARD > FUENTES (Lead sources breakdown) ====================
/**
 * Breakdown of leads by source channel, with sub-breakdowns for Instagram
 * (by funnel stage) and Ads (by UTM campaign/content/term).
 */
export async function getSourceBreakdown(filters?: { mes?: string; semana?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  if (filters?.mes) conditions.push(eq(leads.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(leads.semana, filters.semana));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Totals by origen
  const byOrigen = await db.select({
    origen: leads.origen,
    count: sql<number>`COUNT(*)`,
    ventas: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN 1 ELSE 0 END)`,
    revenue: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN COALESCE(CAST(${leads.cashCollected} AS DECIMAL(10,2)), 0) ELSE 0 END)`,
  }).from(leads).where(where).groupBy(leads.origen);

  // Instagram funnel breakdown (only for origen = INSTAGRAM)
  const igByStage = await db.select({
    stage: leads.igFunnelStage,
    count: sql<number>`COUNT(*)`,
    hasManychat: sql<number>`SUM(CASE WHEN ${leads.manychatSubscriberId} IS NOT NULL AND ${leads.manychatSubscriberId} != '' THEN 1 ELSE 0 END)`,
  })
    .from(leads)
    .where(and(
      eq(leads.origen, "INSTAGRAM"),
      ...(conditions.length > 0 ? conditions : []),
    ))
    .groupBy(leads.igFunnelStage);

  // Instagram sub-categories (ManyChat-sourced vs bio-link estimated)
  const [igSources] = await db.select({
    total: sql<number>`COUNT(*)`,
    withManychat: sql<number>`SUM(CASE WHEN ${leads.manychatSubscriberId} IS NOT NULL AND ${leads.manychatSubscriberId} != '' THEN 1 ELSE 0 END)`,
    withoutManychat: sql<number>`SUM(CASE WHEN (${leads.manychatSubscriberId} IS NULL OR ${leads.manychatSubscriberId} = '') THEN 1 ELSE 0 END)`,
  })
    .from(leads)
    .where(and(
      eq(leads.origen, "INSTAGRAM"),
      ...(conditions.length > 0 ? conditions : []),
    ));

  // Ads breakdown by UTM (only leads with UTM campaign populated)
  const adsBreakdown = await db.select({
    utmCampaign: leads.utmCampaign,
    utmContent: leads.utmContent,
    utmTerm: leads.utmTerm,
    leads: sql<number>`COUNT(*)`,
    agendas: sql<number>`SUM(CASE WHEN ${leads.estadoConfirmacion} IN ('CONFIRMADA', 'PENDIENTE', 'REAGENDADA') THEN 1 ELSE 0 END)`,
    ventas: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN 1 ELSE 0 END)`,
    revenue: sql<number>`SUM(CASE WHEN ${leads.outcome} = 'VENTA' THEN COALESCE(CAST(${leads.cashCollected} AS DECIMAL(10,2)), 0) ELSE 0 END)`,
  })
    .from(leads)
    .where(and(
      sql`${leads.utmCampaign} IS NOT NULL AND ${leads.utmCampaign} != ''`,
      ...(conditions.length > 0 ? conditions : []),
    ))
    .groupBy(leads.utmCampaign, leads.utmContent, leads.utmTerm)
    .orderBy(sql`COUNT(*) DESC`);

  return {
    byOrigen: byOrigen.map(r => ({
      origen: r.origen,
      count: Number(r.count),
      ventas: Number(r.ventas),
      revenue: Number(r.revenue),
    })),
    igByStage: igByStage.map(r => ({
      stage: r.stage,
      count: Number(r.count),
      hasManychat: Number(r.hasManychat),
    })),
    igSources: {
      total: Number(igSources?.total ?? 0),
      withManychat: Number(igSources?.withManychat ?? 0),
      withoutManychat: Number(igSources?.withoutManychat ?? 0),
    },
    adsBreakdown: adsBreakdown.map(r => ({
      utmCampaign: r.utmCampaign,
      utmContent: r.utmContent,
      utmTerm: r.utmTerm,
      leads: Number(r.leads),
      agendas: Number(r.agendas),
      ventas: Number(r.ventas),
      revenue: Number(r.revenue),
    })),
  };
}

// ==================== CONTACTOS > TIMELINE (Unified event stream per lead) ====================
/**
 * Returns the full journey of one contact as a flat list of events, ordered
 * chronologically. Powers `/contactos/todos` split view.
 *
 * Events come from these sources (and then merged client-side):
 *   - `leads` itself: creation, estado transitions, triage, attendance, outcome
 *   - `contactAttempts`: every call/WhatsApp/DM attempt
 *   - `leadComments`: team notes
 *   - `followUps`: follow-up creation + their logs
 *   - `leadScoring`: score assignment
 *   - `leadDataEntries`: form/triage/scoring submissions
 */
export type TimelineEvent = {
  kind: "lead_created" | "first_contact" | "contact_attempt" | "confirmation" | "triage" | "attendance" | "outcome" | "follow_up_created" | "follow_up_log" | "comment" | "scoring" | "data_entry";
  timestamp: string; // ISO
  title: string;
  detail?: string | null;
  icon?: string; // e.g. "Phone", "CheckCircle", "AlertCircle" — Lucide name string
  meta?: Record<string, any>;
};

export async function getContactoTimeline(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found");

  const [attempts, comments, followUpRows, scoringRow, dataEntries] = await Promise.all([
    db.select().from(contactAttempts).where(eq(contactAttempts.leadId, leadId)).orderBy(asc(contactAttempts.timestamp)),
    db.select().from(leadComments).where(eq(leadComments.leadId, leadId)).orderBy(asc(leadComments.createdAt)),
    db.select().from(followUps).where(eq(followUps.leadId, leadId)).orderBy(asc(followUps.createdAt)),
    db.select().from(leadScoring).where(eq(leadScoring.leadId, leadId)).orderBy(desc(leadScoring.id)).limit(1),
    db.select().from(leadDataEntries).where(eq(leadDataEntries.leadId, leadId)).orderBy(asc(leadDataEntries.createdAt)),
  ]);

  // Follow-up logs: fetch all logs for this lead's follow-ups
  const followUpIds = followUpRows.map(f => f.id);
  const fuLogs = followUpIds.length > 0
    ? await db.select().from(followUpLogs).where(inArray(followUpLogs.followUpId, followUpIds)).orderBy(asc(followUpLogs.createdAt))
    : [];

  const events: TimelineEvent[] = [];

  // Lead creation
  events.push({
    kind: "lead_created",
    timestamp: (lead.createdAt instanceof Date ? lead.createdAt : new Date(lead.createdAt)).toISOString(),
    title: "Lead creado",
    detail: `Origen: ${lead.origen ?? "—"} · ${lead.tipo ?? ""}${lead.setterAsignado ? ` · Setter: ${lead.setterAsignado}` : ""}`,
    icon: "UserPlus",
    meta: { origen: lead.origen, tipo: lead.tipo, setter: lead.setterAsignado },
  });

  // First contact
  if (lead.fechaPrimerContacto) {
    const ts = lead.fechaPrimerContacto instanceof Date ? lead.fechaPrimerContacto : new Date(lead.fechaPrimerContacto);
    events.push({
      kind: "first_contact",
      timestamp: ts.toISOString(),
      title: "Primer contacto",
      detail: lead.resultadoContacto ? `Resultado: ${lead.resultadoContacto}` : null,
      icon: "PhoneCall",
    });
  }

  // Contact attempts
  for (const a of attempts) {
    const ts = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
    events.push({
      kind: "contact_attempt",
      timestamp: ts.toISOString(),
      title: `${a.canal}${a.resultado ? ` — ${a.resultado}` : ""}`,
      detail: a.notas || (a.realizadoPor ? `por ${a.realizadoPor}` : null),
      icon: a.canal === "WHATSAPP" ? "MessageCircle" : a.canal === "EMAIL" ? "Mail" : a.canal === "DM_INSTAGRAM" ? "Instagram" : "Phone",
      meta: { canal: a.canal, resultado: a.resultado, realizadoPor: a.realizadoPor },
    });
  }

  // Confirmation state (use updatedAt as best-guess since we don't have audit log)
  if (lead.estadoConfirmacion && lead.estadoConfirmacion !== "PENDIENTE") {
    const ts = lead.updatedAt instanceof Date ? lead.updatedAt : new Date(lead.updatedAt);
    events.push({
      kind: "confirmation",
      timestamp: ts.toISOString(),
      title: `Confirmación: ${lead.estadoConfirmacion}`,
      icon: lead.estadoConfirmacion === "CONFIRMADA" ? "CheckCircle2" : lead.estadoConfirmacion === "CANCELADA" ? "XCircle" : "RefreshCw",
    });
  }

  // Triage
  if (lead.triage) {
    const ts = lead.updatedAt instanceof Date ? lead.updatedAt : new Date(lead.updatedAt);
    events.push({
      kind: "triage",
      timestamp: ts.toISOString(),
      title: "Triage completado",
      detail: lead.triage,
      icon: "ClipboardCheck",
    });
  }

  // Attendance
  if (lead.asistencia && lead.asistencia !== "PENDIENTE") {
    const ts = lead.fecha instanceof Date ? lead.fecha : lead.fecha ? new Date(lead.fecha) : lead.updatedAt instanceof Date ? lead.updatedAt : new Date(lead.updatedAt);
    events.push({
      kind: "attendance",
      timestamp: ts.toISOString(),
      title: lead.asistencia === "ASISTIÓ" ? "Asistió" : "No show",
      icon: lead.asistencia === "ASISTIÓ" ? "CheckCircle2" : "AlertCircle",
    });
  }

  // Outcome
  if (lead.outcome && lead.outcome !== "PENDIENTE") {
    const ts = lead.updatedAt instanceof Date ? lead.updatedAt : new Date(lead.updatedAt);
    let title = `Outcome: ${lead.outcome}`;
    let detail: string | null = null;
    if (lead.outcome === "VENTA") {
      title = `Venta cerrada`;
      const cash = Number(lead.cashCollected ?? 0);
      const revenue = Number(lead.contractedRevenue ?? 0);
      detail = cash > 0
        ? `Cash: $${cash.toLocaleString()}${revenue > 0 ? ` · Contratado: $${revenue.toLocaleString()}` : ""}${lead.productoTipo ? ` · ${lead.productoTipo}` : ""}`
        : (lead.productoTipo ? `Producto: ${lead.productoTipo}` : null);
    } else if (lead.outcome === "PERDIDA") {
      title = `Oportunidad perdida`;
    } else if (lead.outcome === "SEGUIMIENTO") {
      title = `Movido a seguimiento`;
    }
    events.push({
      kind: "outcome",
      timestamp: ts.toISOString(),
      title,
      detail,
      icon: lead.outcome === "VENTA" ? "DollarSign" : lead.outcome === "PERDIDA" ? "XCircle" : "RotateCcw",
      meta: { outcome: lead.outcome, closer: lead.closer },
    });
  }

  // Follow-ups created
  for (const fu of followUpRows) {
    const ts = fu.createdAt instanceof Date ? fu.createdAt : new Date(fu.createdAt);
    events.push({
      kind: "follow_up_created",
      timestamp: ts.toISOString(),
      title: `Follow-up ${fu.tipo} creado`,
      detail: fu.ultimaObjecion || (fu.closerAsignado ? `Asignado: ${fu.closerAsignado}` : null),
      icon: "Flame",
      meta: { followUpId: fu.id, tipo: fu.tipo },
    });
  }

  // Follow-up logs
  for (const log of fuLogs) {
    const ts = log.createdAt instanceof Date ? log.createdAt : new Date(log.createdAt);
    events.push({
      kind: "follow_up_log",
      timestamp: ts.toISOString(),
      title: `Follow-up: ${log.accion}`,
      detail: log.detalle || (log.realizadoPor ? `por ${log.realizadoPor}` : null),
      icon: "Flame",
      meta: { accion: log.accion },
    });
  }

  // Comments
  for (const c of comments) {
    const ts = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt);
    events.push({
      kind: "comment",
      timestamp: ts.toISOString(),
      title: `Nota de ${c.autor}`,
      detail: c.texto,
      icon: "MessageSquare",
      meta: { autor: c.autor, autorRole: c.autorRole },
    });
  }

  // Scoring (most-recent only)
  if (scoringRow[0]) {
    const s = scoringRow[0];
    const ts = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt);
    events.push({
      kind: "scoring",
      timestamp: ts.toISOString(),
      title: `Score asignado: ${s.scoreLabel ?? "—"}${s.scoreFinal != null ? ` (${s.scoreFinal})` : ""}`,
      detail: s.scoreTotal != null ? `Score total: ${s.scoreTotal}` : null,
      icon: "Star",
      meta: { scoreLabel: s.scoreLabel, scoreFinal: s.scoreFinal },
    });
  }

  // Data entries (triage forms, scoring forms, etc.)
  for (const e of dataEntries) {
    const ts = e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt);
    events.push({
      kind: "data_entry",
      timestamp: ts.toISOString(),
      title: `Formulario: ${e.source}${e.formId ? ` (${e.formId})` : ""}`,
      detail: e.scoreLabel ? `Score: ${e.scoreLabel}${e.scoreFinal != null ? ` · ${e.scoreFinal}` : ""}` : null,
      icon: "FileText",
      meta: { source: e.source, formId: e.formId },
    });
  }

  // Sort chronologically (oldest first for timeline rendering top-down)
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    lead: {
      id: lead.id,
      nombre: lead.nombre,
      correo: lead.correo,
      telefono: lead.telefono,
      instagram: lead.instagram,
      origen: lead.origen,
      tipo: lead.tipo,
      estadoConfirmacion: lead.estadoConfirmacion,
      asistencia: lead.asistencia,
      outcome: lead.outcome,
      score: lead.score,
      scoreLabel: lead.scoreLabel,
      setterAsignado: lead.setterAsignado,
      closer: lead.closer,
      fecha: lead.fecha,
      createdAt: lead.createdAt,
      cashCollected: lead.cashCollected,
      contractedRevenue: lead.contractedRevenue,
      facturado: lead.facturado,
      utmCampaign: lead.utmCampaign,
      utmContent: lead.utmContent,
      utmTerm: lead.utmTerm,
      mes: lead.mes,
      semana: lead.semana,
    },
    events,
  };
}

// ==================== SALES > PAYMENTS + COMMISSIONS ====================

export type PaymentRow = {
  id: number;
  nombre: string | null;
  closer: string | null;
  productoTipo: string | null;
  cashCollected: number;
  contractedRevenue: number;
  facturado: number;
  setupFee: number;
  recurrenciaMensual: number;
  fechaProximoCobro: string | null;
  /** Best-guess "payment date" — uses updatedAt since that's when cashCollected was typically set */
  paymentDate: string;
  /** Lead's own `fecha` (demo/agenda date) for context */
  fecha: string | null;
  mes: string | null;
  semana: number | null;
  outcome: string | null;
};

/**
 * Lista de pagos derivada de leads con cashCollected > 0. La fecha de pago
 * es `updatedAt` del lead (approx. cuando se registró el cash). Consumido
 * por `/ventas/pagos`.
 */
export async function getPayments(filters?: { mes?: string; semana?: number; closer?: string }): Promise<{
  payments: PaymentRow[];
  totals: {
    count: number;
    sumCash: number;
    sumContracted: number;
    avgTicket: number;
    pifCount: number;
    pifCash: number;
    setupMonthlyCount: number;
    setupMonthlyCash: number;
  };
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [sql`CAST(${leads.cashCollected} AS DECIMAL(10,2)) > 0`];
  if (filters?.mes) conditions.push(eq(leads.mes, filters.mes));
  if (filters?.semana) conditions.push(eq(leads.semana, filters.semana));
  if (filters?.closer) conditions.push(eq(leads.closer, filters.closer));
  const where = and(...conditions);

  const rows = await db.select({
    id: leads.id,
    nombre: leads.nombre,
    closer: leads.closer,
    productoTipo: leads.productoTipo,
    cashCollected: leads.cashCollected,
    contractedRevenue: leads.contractedRevenue,
    facturado: leads.facturado,
    setupFee: leads.setupFee,
    recurrenciaMensual: leads.recurrenciaMensual,
    fechaProximoCobro: leads.fechaProximoCobro,
    fecha: leads.fecha,
    mes: leads.mes,
    semana: leads.semana,
    outcome: leads.outcome,
    updatedAt: leads.updatedAt,
  })
    .from(leads)
    .where(where)
    .orderBy(desc(leads.updatedAt));

  const payments: PaymentRow[] = rows.map(r => ({
    id: r.id,
    nombre: r.nombre,
    closer: r.closer,
    productoTipo: r.productoTipo,
    cashCollected: Number(r.cashCollected ?? 0),
    contractedRevenue: Number(r.contractedRevenue ?? 0),
    facturado: Number(r.facturado ?? 0),
    setupFee: Number(r.setupFee ?? 0),
    recurrenciaMensual: Number(r.recurrenciaMensual ?? 0),
    fechaProximoCobro: r.fechaProximoCobro ? (r.fechaProximoCobro instanceof Date ? r.fechaProximoCobro.toISOString() : new Date(r.fechaProximoCobro).toISOString()) : null,
    paymentDate: (r.updatedAt instanceof Date ? r.updatedAt : new Date(r.updatedAt)).toISOString(),
    fecha: r.fecha ? (r.fecha instanceof Date ? r.fecha.toISOString() : new Date(r.fecha).toISOString()) : null,
    mes: r.mes,
    semana: r.semana,
    outcome: r.outcome,
  }));

  const count = payments.length;
  const sumCash = payments.reduce((acc, p) => acc + p.cashCollected, 0);
  const sumContracted = payments.reduce((acc, p) => acc + p.contractedRevenue, 0);
  const avgTicket = count > 0 ? sumCash / count : 0;
  const pifPayments = payments.filter(p => p.productoTipo === "PIF");
  const smPayments = payments.filter(p => p.productoTipo === "SETUP_MONTHLY");

  return {
    payments,
    totals: {
      count,
      sumCash,
      sumContracted,
      avgTicket,
      pifCount: pifPayments.length,
      pifCash: pifPayments.reduce((a, p) => a + p.cashCollected, 0),
      setupMonthlyCount: smPayments.length,
      setupMonthlyCash: smPayments.reduce((a, p) => a + p.cashCollected, 0),
    },
  };
}

// ---------- Commission rate config shape ----------

export type CommissionRates = {
  default: { pif: number; setupMonthly: number };
  byCloser: Record<string, { pif: number; setupMonthly: number }>;
};

const DEFAULT_COMMISSION_RATES: CommissionRates = {
  default: { pif: 0.10, setupMonthly: 0.12 },
  byCloser: {},
};

/**
 * Read commission rates from system_config (key = "commissionRates").
 * Falls back to 10% / 12% defaults if unset or malformed.
 */
export async function getCommissionRates(): Promise<CommissionRates> {
  const raw = await getSystemConfig("commissionRates");
  if (!raw) return DEFAULT_COMMISSION_RATES;
  try {
    const parsed = JSON.parse(raw);
    // Light validation — require the shape we expect
    if (
      parsed &&
      parsed.default && typeof parsed.default.pif === "number" && typeof parsed.default.setupMonthly === "number" &&
      parsed.byCloser && typeof parsed.byCloser === "object"
    ) {
      return parsed as CommissionRates;
    }
    return DEFAULT_COMMISSION_RATES;
  } catch {
    return DEFAULT_COMMISSION_RATES;
  }
}

export type CommissionRow = {
  closer: string;
  pifCount: number;
  pifCash: number;
  pifRate: number;
  pifCommission: number;
  smCount: number;
  smCash: number;
  smRate: number;
  smCommission: number;
  totalCommission: number;
  totalCash: number;
};

/**
 * Calcula comisiones por closer en el periodo. Agrupa los leads con
 * cashCollected > 0, separa PIF vs SETUP_MONTHLY, y aplica la tasa
 * configurada (override por closer si existe, si no la default).
 * Consumido por `/ventas/comisiones`.
 */
export async function getCommissions(filters?: { mes?: string; semana?: number }): Promise<{
  rows: CommissionRow[];
  totals: {
    pifCash: number;
    pifCommission: number;
    smCash: number;
    smCommission: number;
    totalCash: number;
    totalCommission: number;
  };
  rates: CommissionRates;
}> {
  const rates = await getCommissionRates();
  const { payments } = await getPayments(filters);

  // --- Stripe refund/dispute deductions ---
  // Any lead with a matched Stripe payment in `refunded`, `partially_refunded`,
  // or `disputed` state has that money pulled back from the commission base.
  // This keeps comisiones honest without the admin having to manually decrement
  // `cashCollected`.
  const leadIds = payments.map((p) => p.id);
  const deductions = await getStripeDeductionsByLead(leadIds);

  // Bucket by closer, applying per-lead deduction first so pct splits are correct.
  const byCloser = new Map<string, PaymentRow[]>();
  for (const p of payments) {
    if (!p.closer) continue;
    const deduction = deductions.get(p.id) ?? 0;
    const adjusted: PaymentRow = deduction > 0
      ? { ...p, cashCollected: Math.max(0, p.cashCollected - deduction) }
      : p;
    const list = byCloser.get(p.closer) ?? [];
    list.push(adjusted);
    byCloser.set(p.closer, list);
  }

  const rows: CommissionRow[] = [];
  for (const [closer, paysForCloser] of Array.from(byCloser.entries())) {
    const rate = rates.byCloser[closer] ?? rates.default;
    const pifs = paysForCloser.filter((p: PaymentRow) => p.productoTipo === "PIF");
    const sms = paysForCloser.filter((p: PaymentRow) => p.productoTipo === "SETUP_MONTHLY");
    const others = paysForCloser.filter((p: PaymentRow) => !p.productoTipo);

    const pifCash = pifs.reduce((a: number, p: PaymentRow) => a + p.cashCollected, 0);
    const smCash = sms.reduce((a: number, p: PaymentRow) => a + p.cashCollected, 0);
    // Payments without productoTipo fall into PIF bucket by convention (single payment)
    const otherCash = others.reduce((a: number, p: PaymentRow) => a + p.cashCollected, 0);
    const pifCashTotal = pifCash + otherCash;

    const pifCommission = pifCashTotal * rate.pif;
    const smCommission = smCash * rate.setupMonthly;

    rows.push({
      closer,
      pifCount: pifs.length + others.length,
      pifCash: pifCashTotal,
      pifRate: rate.pif,
      pifCommission,
      smCount: sms.length,
      smCash,
      smRate: rate.setupMonthly,
      smCommission,
      totalCommission: pifCommission + smCommission,
      totalCash: pifCashTotal + smCash,
    });
  }

  // Sort by total commission desc
  rows.sort((a, b) => b.totalCommission - a.totalCommission);

  const totals = rows.reduce(
    (acc, r) => ({
      pifCash: acc.pifCash + r.pifCash,
      pifCommission: acc.pifCommission + r.pifCommission,
      smCash: acc.smCash + r.smCash,
      smCommission: acc.smCommission + r.smCommission,
      totalCash: acc.totalCash + r.totalCash,
      totalCommission: acc.totalCommission + r.totalCommission,
    }),
    { pifCash: 0, pifCommission: 0, smCash: 0, smCommission: 0, totalCash: 0, totalCommission: 0 }
  );

  return { rows, totals, rates };
}

// ==================== STRIPE PAYMENTS ====================
//
// Local cache of Stripe charges + helpers. Two write paths:
//   1. Sync: admin kicks off a one-time backfill of historical charges.
//   2. Webhook: every state change (succeeded → refunded → disputed) upserts
//      the same row by `stripeChargeId`.
// The read path is the same in both cases — the UI doesn't care how a row
// got there.

/**
 * Input shape accepted by `upsertStripePayment`. Keeps numeric amounts as
 * `number` for callers (the Stripe parser, manual code) — they're coerced
 * to strings here before hitting Drizzle's decimal columns.
 */
export type StripePaymentInsert = {
  stripeChargeId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  stripeInvoiceId: string | null;
  stripeCheckoutSessionId: string | null;
  amount: number;
  amountRefunded: number;
  currency: string;
  status: "succeeded" | "pending" | "failed" | "refunded" | "partially_refunded" | "disputed" | "canceled";
  paymentMethodBrand: string | null;
  last4: string | null;
  receiptUrl: string | null;
  customerEmail: string | null;
  customerName: string | null;
  description: string | null;
  rawMetadata: Record<string, any> | null;
  stripeCreatedAt: Date;
  leadId?: number | null;
  matchMethod?: string | null;
  matchedAt?: Date | null;
  matchedBy?: string | null;
};

/**
 * Upsert a parsed Stripe payment by `stripeChargeId`. Preserves lead linkage
 * and matchMethod across updates — a refund coming in later shouldn't wipe
 * the leadId that a successful charge set when it first arrived.
 */
export async function upsertStripePayment(payment: StripePaymentInsert): Promise<{ id: number; isNew: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Drizzle numeric/decimal columns expect strings on the wire — convert once
  // here so every caller can keep numbers in their own code.
  const toInsert: InsertStripePayment = {
    stripeChargeId: payment.stripeChargeId ?? null,
    stripePaymentIntentId: payment.stripePaymentIntentId ?? null,
    stripeCustomerId: payment.stripeCustomerId ?? null,
    stripeInvoiceId: payment.stripeInvoiceId ?? null,
    stripeCheckoutSessionId: payment.stripeCheckoutSessionId ?? null,
    amount: payment.amount.toFixed(2),
    amountRefunded: payment.amountRefunded.toFixed(2),
    currency: payment.currency,
    status: payment.status,
    paymentMethodBrand: payment.paymentMethodBrand ?? null,
    last4: payment.last4 ?? null,
    receiptUrl: payment.receiptUrl ?? null,
    customerEmail: payment.customerEmail ?? null,
    customerName: payment.customerName ?? null,
    description: payment.description ?? null,
    rawMetadata: payment.rawMetadata ?? null,
    stripeCreatedAt: payment.stripeCreatedAt,
    leadId: payment.leadId ?? null,
    matchMethod: payment.matchMethod ?? null,
    matchedAt: payment.matchedAt ?? null,
    matchedBy: payment.matchedBy ?? null,
    updatedAt: new Date(),
  };

  if (!payment.stripeChargeId) {
    // No stable key to upsert on — just insert.
    const [row] = await db.insert(stripePayments).values(toInsert).returning({ id: stripePayments.id });
    return { id: row.id, isNew: true };
  }

  const existing = await db.select({ id: stripePayments.id, leadId: stripePayments.leadId, matchMethod: stripePayments.matchMethod, matchedAt: stripePayments.matchedAt, matchedBy: stripePayments.matchedBy })
    .from(stripePayments)
    .where(eq(stripePayments.stripeChargeId, payment.stripeChargeId))
    .limit(1);

  if (existing.length === 0) {
    const [row] = await db.insert(stripePayments).values(toInsert).returning({ id: stripePayments.id });
    return { id: row.id, isNew: true };
  }

  // Preserve manual link if a later event was missing it (e.g. if a refund
  // event arrives, the Stripe API won't re-send the metadata we used to match).
  const prev = existing[0];
  await db.update(stripePayments)
    .set({
      ...toInsert,
      // Never overwrite a good link with null
      leadId: toInsert.leadId ?? prev.leadId,
      matchMethod: toInsert.matchMethod ?? prev.matchMethod,
      matchedAt: toInsert.matchedAt ?? prev.matchedAt,
      matchedBy: toInsert.matchedBy ?? prev.matchedBy,
    })
    .where(eq(stripePayments.id, prev.id));

  return { id: prev.id, isNew: false };
}

/**
 * Auto-match a payment to a lead by email (exact match, case-insensitive).
 * Returns `{ matched: true, leadId }` on single unique hit, otherwise
 * `{ matched: false, reason }`. Ambiguous (2+ leads with same email) is
 * marked with matchMethod="ambiguous" on the payment so the admin can
 * disambiguate manually.
 */
export async function attemptStripeAutoMatch(paymentId: number): Promise<{ matched: boolean; leadId?: number; reason?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [payment] = await db.select().from(stripePayments).where(eq(stripePayments.id, paymentId)).limit(1);
  if (!payment) return { matched: false, reason: "payment_not_found" };
  if (payment.leadId) return { matched: true, leadId: payment.leadId, reason: "already_matched" };

  // Priority 1: explicit leadId in Stripe metadata (comes from our own
  // createCheckoutSession — the most reliable signal we have).
  const metaLeadId = Number((payment.rawMetadata as any)?.leadId);
  if (metaLeadId && Number.isFinite(metaLeadId)) {
    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, metaLeadId)).limit(1);
    if (lead) {
      await db.update(stripePayments).set({
        leadId: lead.id,
        matchMethod: "metadata",
        matchedAt: new Date(),
        matchedBy: "auto",
        updatedAt: new Date(),
      }).where(eq(stripePayments.id, payment.id));
      return { matched: true, leadId: lead.id, reason: "metadata" };
    }
  }

  // Priority 2: email match. Case-insensitive. If >1 hit, mark ambiguous.
  const email = payment.customerEmail?.trim().toLowerCase();
  if (!email) {
    return { matched: false, reason: "no_email" };
  }

  const matches = await db.select({ id: leads.id })
    .from(leads)
    .where(sql`lower(${leads.correo}) = ${email}`)
    .limit(2);

  if (matches.length === 0) return { matched: false, reason: "no_lead_match" };
  if (matches.length > 1) {
    await db.update(stripePayments).set({
      matchMethod: "ambiguous",
      updatedAt: new Date(),
    }).where(eq(stripePayments.id, payment.id));
    return { matched: false, reason: "ambiguous_email" };
  }

  await db.update(stripePayments).set({
    leadId: matches[0].id,
    matchMethod: "email_auto",
    matchedAt: new Date(),
    matchedBy: "auto",
    updatedAt: new Date(),
  }).where(eq(stripePayments.id, payment.id));

  return { matched: true, leadId: matches[0].id, reason: "email" };
}

export async function assignStripePaymentToLead(params: { paymentId: number; leadId: number; matchedBy: string }): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Verify both exist before linking
  const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, params.leadId)).limit(1);
  if (!lead) throw new Error(`Lead #${params.leadId} not found`);
  const [payment] = await db.select({ id: stripePayments.id }).from(stripePayments).where(eq(stripePayments.id, params.paymentId)).limit(1);
  if (!payment) throw new Error(`Stripe payment #${params.paymentId} not found`);

  await db.update(stripePayments).set({
    leadId: params.leadId,
    matchMethod: "manual",
    matchedAt: new Date(),
    matchedBy: params.matchedBy,
    updatedAt: new Date(),
  }).where(eq(stripePayments.id, params.paymentId));

  return { ok: true };
}

export async function unassignStripePaymentFromLead(paymentId: number): Promise<{ ok: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stripePayments).set({
    leadId: null,
    matchMethod: null,
    matchedAt: null,
    matchedBy: null,
    updatedAt: new Date(),
  }).where(eq(stripePayments.id, paymentId));
  return { ok: true };
}

export interface StripePaymentRow {
  id: number;
  stripeChargeId: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  amount: number;
  amountRefunded: number;
  amountNet: number;              // amount - amountRefunded
  currency: string;
  status: string;
  paymentMethodBrand: string | null;
  last4: string | null;
  receiptUrl: string | null;
  customerEmail: string | null;
  customerName: string | null;
  description: string | null;
  leadId: number | null;
  leadNombre: string | null;
  leadCorreo: string | null;
  matchMethod: string | null;
  matchedAt: Date | null;
  matchedBy: string | null;
  stripeCreatedAt: Date;
  createdAt: Date;
}

/**
 * List Stripe payments with optional filter on link status.
 *   kind: "assigned" → only those with leadId
 *         "unassigned" → only those without leadId (includes "ambiguous")
 *         "all" (default) → both
 */
export async function listStripePayments(params: {
  kind?: "assigned" | "unassigned" | "all";
  status?: "succeeded" | "refunded" | "partially_refunded" | "disputed" | "failed";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
} = {}): Promise<StripePaymentRow[]> {
  const db = await getDb();
  if (!db) return [];
  const limit = params.limit ?? 200;
  const conds: any[] = [];
  if (params.kind === "assigned") conds.push(isNotNull(stripePayments.leadId));
  if (params.kind === "unassigned") conds.push(isNull(stripePayments.leadId));
  if (params.status) conds.push(eq(stripePayments.status, params.status as any));
  if (params.dateFrom) conds.push(gte(stripePayments.stripeCreatedAt, new Date(params.dateFrom)));
  if (params.dateTo) conds.push(lte(stripePayments.stripeCreatedAt, new Date(params.dateTo)));

  const rows = await db.select({
    id: stripePayments.id,
    stripeChargeId: stripePayments.stripeChargeId,
    stripePaymentIntentId: stripePayments.stripePaymentIntentId,
    stripeCheckoutSessionId: stripePayments.stripeCheckoutSessionId,
    amount: stripePayments.amount,
    amountRefunded: stripePayments.amountRefunded,
    currency: stripePayments.currency,
    status: stripePayments.status,
    paymentMethodBrand: stripePayments.paymentMethodBrand,
    last4: stripePayments.last4,
    receiptUrl: stripePayments.receiptUrl,
    customerEmail: stripePayments.customerEmail,
    customerName: stripePayments.customerName,
    description: stripePayments.description,
    leadId: stripePayments.leadId,
    matchMethod: stripePayments.matchMethod,
    matchedAt: stripePayments.matchedAt,
    matchedBy: stripePayments.matchedBy,
    stripeCreatedAt: stripePayments.stripeCreatedAt,
    createdAt: stripePayments.createdAt,
    leadNombre: leads.nombre,
    leadCorreo: leads.correo,
  })
    .from(stripePayments)
    .leftJoin(leads, eq(stripePayments.leadId, leads.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(stripePayments.stripeCreatedAt))
    .limit(limit);

  return rows.map((r) => {
    const amount = Number(r.amount ?? 0);
    const amountRefunded = Number(r.amountRefunded ?? 0);
    return {
      id: r.id,
      stripeChargeId: r.stripeChargeId,
      stripePaymentIntentId: r.stripePaymentIntentId,
      stripeCheckoutSessionId: r.stripeCheckoutSessionId,
      amount,
      amountRefunded,
      amountNet: Math.max(0, amount - amountRefunded),
      currency: r.currency,
      status: r.status as string,
      paymentMethodBrand: r.paymentMethodBrand,
      last4: r.last4,
      receiptUrl: r.receiptUrl,
      customerEmail: r.customerEmail,
      customerName: r.customerName,
      description: r.description,
      leadId: r.leadId,
      leadNombre: r.leadNombre,
      leadCorreo: r.leadCorreo,
      matchMethod: r.matchMethod,
      matchedAt: r.matchedAt,
      matchedBy: r.matchedBy,
      stripeCreatedAt: r.stripeCreatedAt,
      createdAt: r.createdAt,
    };
  });
}

/** Stripe payments linked to a given lead, ordered newest first. */
export async function getStripePaymentsByLead(leadId: number): Promise<StripePaymentRow[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select()
    .from(stripePayments)
    .where(eq(stripePayments.leadId, leadId))
    .orderBy(desc(stripePayments.stripeCreatedAt));

  return rows.map((r) => {
    const amount = Number(r.amount ?? 0);
    const amountRefunded = Number(r.amountRefunded ?? 0);
    return {
      id: r.id,
      stripeChargeId: r.stripeChargeId,
      stripePaymentIntentId: r.stripePaymentIntentId,
      stripeCheckoutSessionId: r.stripeCheckoutSessionId,
      amount,
      amountRefunded,
      amountNet: Math.max(0, amount - amountRefunded),
      currency: r.currency,
      status: r.status as string,
      paymentMethodBrand: r.paymentMethodBrand,
      last4: r.last4,
      receiptUrl: r.receiptUrl,
      customerEmail: r.customerEmail,
      customerName: r.customerName,
      description: r.description,
      leadId: r.leadId,
      leadNombre: null,
      leadCorreo: null,
      matchMethod: r.matchMethod,
      matchedAt: r.matchedAt,
      matchedBy: r.matchedBy,
      stripeCreatedAt: r.stripeCreatedAt,
      createdAt: r.createdAt,
    };
  });
}

/** Aggregate refunded/disputed $ amount per lead, for commission adjustments. */
export async function getStripeDeductionsByLead(leadIds: number[]): Promise<Map<number, number>> {
  const db = await getDb();
  const out = new Map<number, number>();
  if (!db || leadIds.length === 0) return out;

  const rows = await db.select({
    leadId: stripePayments.leadId,
    refundSum: sql<number>`COALESCE(SUM(CAST(${stripePayments.amountRefunded} AS NUMERIC)), 0)::numeric`,
  })
    .from(stripePayments)
    .where(and(
      inArray(stripePayments.leadId, leadIds),
      or(eq(stripePayments.status, "refunded"), eq(stripePayments.status, "partially_refunded"), eq(stripePayments.status, "disputed")) as any,
    ))
    .groupBy(stripePayments.leadId);

  for (const r of rows) {
    if (r.leadId != null) out.set(r.leadId, Number(r.refundSum ?? 0));
  }
  return out;
}

// ---------- Stripe webhook log (idempotency) ----------

export async function createStripeWebhookLog(data: InsertStripeWebhookLog): Promise<{ id: number; isNew: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const [row] = await db.insert(stripeWebhookLogs).values(data).returning({ id: stripeWebhookLogs.id });
    return { id: row.id, isNew: true };
  } catch (err: any) {
    // Unique violation on eventId → Stripe replayed an event. We treat this
    // as "already processed" and noop the handler.
    if (err?.code === "23505" || err?.message?.includes("unique")) {
      const [existing] = await db.select({ id: stripeWebhookLogs.id })
        .from(stripeWebhookLogs)
        .where(eq(stripeWebhookLogs.eventId, data.eventId))
        .limit(1);
      return { id: existing?.id ?? 0, isNew: false };
    }
    throw err;
  }
}

export async function updateStripeWebhookLog(id: number, data: Partial<InsertStripeWebhookLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stripeWebhookLogs).set(data).where(eq(stripeWebhookLogs.id, id));
}
