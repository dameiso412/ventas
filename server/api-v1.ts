import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import * as db from "./db";
import { apiKeys } from "../drizzle/schema";
import {
  COST_BENCHMARKS, RATE_BENCHMARKS, evaluateMetric,
  CONSTRAINT_SCENARIOS, HEALTH_COLORS,
  type HealthLevel, type ConstraintCategory
} from "../shared/benchmarks";

const apiRouter = Router();

// ==================== HELPERS ====================

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateApiKey(): string {
  const prefix = "sk_sacamedi_";
  const random = crypto.randomBytes(32).toString("hex");
  return `${prefix}${random}`;
}

// ==================== API KEY MANAGEMENT (DB helpers) ====================

async function createApiKey(name: string) {
  const database = await db.getDb();
  if (!database) throw new Error("Database not available");

  const rawKey = generateApiKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.substring(0, 16) + "...";

  await database.insert(apiKeys).values({
    name,
    keyHash,
    keyPrefix,
  });

  // Return the raw key ONLY on creation (never stored in plain text)
  return { key: rawKey, keyPrefix, name };
}

async function validateApiKey(key: string): Promise<boolean> {
  const database = await db.getDb();
  if (!database) return false;

  const { eq, and } = await import("drizzle-orm");
  const keyHash = hashKey(key);

  const results = await database
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, 1)));

  if (results.length === 0) return false;

  // Update lastUsedAt
  await database
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, results[0].id));

  return true;
}

async function listApiKeys() {
  const database = await db.getDb();
  if (!database) return [];

  const { desc } = await import("drizzle-orm");
  return database
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      isActive: apiKeys.isActive,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt));
}

async function revokeApiKey(id: number) {
  const database = await db.getDb();
  if (!database) return false;

  const { eq } = await import("drizzle-orm");
  await database.update(apiKeys).set({ isActive: 0 }).where(eq(apiKeys.id, id));
  return true;
}

async function deleteApiKey(id: number) {
  const database = await db.getDb();
  if (!database) return false;

  const { eq } = await import("drizzle-orm");
  await database.delete(apiKeys).where(eq(apiKeys.id, id));
  return true;
}

// ==================== AUTH MIDDLEWARE ====================

async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: "API Key requerida",
      message: "Incluye tu API Key en el header X-API-Key",
    });
  }

  const valid = await validateApiKey(apiKey);
  if (!valid) {
    return res.status(403).json({
      error: "API Key inválida o revocada",
      message: "Verifica que tu API Key sea correcta y esté activa",
    });
  }

  next();
}

// ==================== INTERNAL: API KEY MANAGEMENT (no auth required, protected by tRPC session) ====================
// These are called from tRPC procedures, not directly from the API

export { createApiKey, listApiKeys, revokeApiKey, deleteApiKey };

// ==================== API v1 ROUTES (all require API Key) ====================

// --- Health Check ---
apiRouter.get("/api/v1/health", apiKeyAuth, (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      core: [
        "GET /api/v1/health",
        "GET /api/v1/dashboard",
        "GET /api/v1/summary",
      ],
      leads: [
        "GET /api/v1/leads",
        "GET /api/v1/leads/:id",
        "GET /api/v1/leads/needs-attention",
        "GET /api/v1/leads/:id/contact-attempts",
        "GET /api/v1/leads/:id/comments",
      ],
      trackers: [
        "GET /api/v1/setter-tracker",
        "GET /api/v1/closer-tracker",
      ],
      leaderboards: [
        "GET /api/v1/leaderboards",
        "GET /api/v1/leaderboards/weighted",
      ],
      diagnostics: [
        "GET /api/v1/diagnostics",
        "GET /api/v1/alerts",
      ],
      marketing: [
        "GET /api/v1/marketing",
        "GET /api/v1/scoring",
        "GET /api/v1/scoring/:leadId",
      ],
      followUps: [
        "GET /api/v1/follow-ups",
        "GET /api/v1/follow-ups/:id",
        "GET /api/v1/follow-ups/stats",
        "GET /api/v1/follow-ups/:id/logs",
      ],
      projections: [
        "GET /api/v1/projections/closer",
        "GET /api/v1/projections/closer/:id",
        "GET /api/v1/projections/setter",
        "GET /api/v1/projections/setter/:id",
      ],
      callAudits: [
        "GET /api/v1/call-audits",
        "GET /api/v1/call-audits/:id",
        "GET /api/v1/call-audits/stats",
        "GET /api/v1/call-audits/by-lead/:leadId",
      ],
      team: [
        "GET /api/v1/team",
        "GET /api/v1/team-summary/setter",
        "GET /api/v1/team-summary/closer",
        "GET /api/v1/rep-profile/setter/:name",
        "GET /api/v1/rep-profile/closer/:name",
      ],
      operations: [
        "GET /api/v1/work-queue",
        "GET /api/v1/confirmations",
      ],
      attribution: [
        "GET /api/v1/attribution",
        "GET /api/v1/attribution/by-campaign",
      ],
      ads: [
        "GET /api/v1/ads/campaigns",
        "GET /api/v1/ads/adsets",
        "GET /api/v1/ads/ads",
        "GET /api/v1/ads/metrics",
        "GET /api/v1/ads/metrics/by-campaign",
        "GET /api/v1/ads/metrics/by-adset",
        "GET /api/v1/ads/metrics/by-ad",
        "GET /api/v1/ads/spend-trend",
      ],
    },
    totalEndpoints: 44,
  });
});

// --- Helper to parse common filters ---
function parseFilters(query: any) {
  return {
    mes: query.mes as string | undefined,
    semana: query.semana ? Number(query.semana) : undefined,
  };
}

// --- Dashboard KPIs ---
apiRouter.get("/api/v1/dashboard", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req.query);

    const [kpis, marketing, trackerSetter, trackerCloser] = await Promise.all([
      db.getDashboardKPIs(filters),
      db.getMarketingKPIs(filters),
      db.getSetterTrackerKPIs(filters),
      db.getCloserTrackerKPIs(filters),
    ]);

    // Calculate derived KPIs
    const adSpend = Number(marketing?.adSpend || 0);
    const totalLeads = Number(kpis?.totalLeads || 0);
    const stIntros = Number(trackerSetter?.totalIntros || 0);
    const stDemosConf = Number(trackerSetter?.totalConfirmadas || 0);
    const ctCloses = Number(trackerCloser?.totalCloses || 0);
    const ctRevenue = Number(trackerCloser?.totalRevenue || 0);
    const ctCash = Number(trackerCloser?.totalCash || 0);
    const ctSchedule = Number(trackerCloser?.totalSchedule || 0);
    const ctLive = Number(trackerCloser?.totalLive || 0);
    const ctOffers = Number(trackerCloser?.totalOffers || 0);

    const costKPIs = {
      cpl: totalLeads > 0 ? adSpend / totalLeads : 0,
      costoAgenda: totalLeads > 0 ? adSpend / totalLeads : 0,
      costoTriage: stIntros > 0 ? adSpend / stIntros : 0,
      costoDemoConfirmada: stDemosConf > 0 ? adSpend / stDemosConf : 0,
      costoAsistencia: ctLive > 0 ? adSpend / ctLive : 0,
      costoOferta: ctOffers > 0 ? adSpend / ctOffers : 0,
      cpa: ctCloses > 0 ? adSpend / ctCloses : 0,
    };

    const rateKPIs = {
      landingOptIn: Number(marketing?.visitasLandingPage || 0) > 0
        ? (Number(marketing?.totalLeadsRaw || 0) / Number(marketing?.visitasLandingPage || 0)) * 100 : 0,
      bookingRate: Number(marketing?.totalLeadsRaw || 0) > 0
        ? (totalLeads / Number(marketing?.totalLeadsRaw || 0)) * 100 : 0,
      answerRate: Number(trackerSetter?.totalIntentos || 0) > 0
        ? (stIntros / Number(trackerSetter?.totalIntentos || 0)) * 100 : 0,
      dqPercent: stIntros > 0
        ? ((stIntros - stDemosConf) / stIntros) * 100 : 0,
      triageRate: stIntros > 0
        ? (stDemosConf / stIntros) * 100 : 0,
      showRate: ctSchedule > 0
        ? (ctLive / ctSchedule) * 100 : 0,
      offerRate: ctLive > 0
        ? (ctOffers / ctLive) * 100 : 0,
      closeRate: ctOffers > 0
        ? (ctCloses / ctOffers) * 100 : 0,
    };

    const financialKPIs = {
      revenue: ctRevenue,
      cashCollected: ctCash,
      ticketPromedio: ctCloses > 0 ? ctRevenue / ctCloses : 0,
      cashPercent: ctRevenue > 0 ? (ctCash / ctRevenue) * 100 : 0,
      roasUpFront: adSpend > 0 ? ctCash / adSpend : 0,
      contractedRoas: adSpend > 0 ? ctRevenue / adSpend : 0,
      newMRR: Number(kpis?.totalRecurrenciaMensual || 0),
      ventas: ctCloses,
      ventasPIF: Number(kpis?.ventasPIF || 0),
      ventasSetupMonthly: Number(kpis?.ventasSetupMonthly || 0),
    };

    const pipeline = {
      totalAgendas: totalLeads,
      noShow: ctSchedule - ctLive,
      seguimientos: Number(kpis?.seguimientos || 0),
      pendientes: 0,
    };

    res.json({
      filters,
      costKPIs,
      rateKPIs,
      financialKPIs,
      pipeline,
      rawData: {
        adSpend,
        totalLeadsRaw: Number(marketing?.totalLeadsRaw || 0),
        visitasLanding: Number(marketing?.visitasLandingPage || 0),
        ctrUnico: Number(marketing?.ctrUnico || 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener dashboard KPIs", details: err.message });
  }
});

// --- Leads (Registro de Citas) ---
apiRouter.get("/api/v1/leads", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.mes) filters.mes = req.query.mes;
    if (req.query.semana) filters.semana = Number(req.query.semana);
    if (req.query.origen) filters.origen = req.query.origen;
    if (req.query.setter) filters.setter = req.query.setter;
    if (req.query.closer) filters.closer = req.query.closer;
    if (req.query.outcome) filters.outcome = req.query.outcome;
    if (req.query.scoreLabel) filters.scoreLabel = req.query.scoreLabel;

    const leads = await db.getLeads(filters);
    res.json({
      filters,
      total: leads.length,
      leads,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener leads", details: err.message });
  }
});

// --- Lead by ID ---
apiRouter.get("/api/v1/leads/:id", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const lead = await db.getLeadById(id);
    if (!lead) {
      return res.status(404).json({ error: "Lead no encontrado" });
    }

    // Also fetch scoring if available
    let scoring = null;
    if (lead.correo) {
      scoring = await db.getLeadScoringByCorreo(lead.correo);
    }

    res.json({ lead, scoring });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener lead", details: err.message });
  }
});

// --- Setter Tracker ---
apiRouter.get("/api/v1/setter-tracker", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.mes) filters.mes = req.query.mes;
    if (req.query.semana) filters.semana = Number(req.query.semana);
    if (req.query.setter) filters.setter = req.query.setter;

    const [activities, kpis] = await Promise.all([
      db.getSetterActivities(filters),
      db.getSetterTrackerKPIs(filters),
    ]);

    res.json({
      filters,
      total: activities.length,
      kpis: {
        totalIntentos: Number(kpis?.totalIntentos || 0),
        totalIntrosEfectivas: Number(kpis?.totalIntros || 0),
        totalDemosConfirmadas: Number(kpis?.totalConfirmadas || 0),
        totalDemosAsistidas: Number(kpis?.totalAsistidas || 0),
        answerRate: Number(kpis?.totalIntentos || 0) > 0
          ? (Number(kpis?.totalIntros || 0) / Number(kpis?.totalIntentos || 0)) * 100 : 0,
        triageRate: Number(kpis?.totalIntros || 0) > 0
          ? (Number(kpis?.totalConfirmadas || 0) / Number(kpis?.totalIntros || 0)) * 100 : 0,
        dqPercent: Number(kpis?.totalIntros || 0) > 0
          ? ((Number(kpis?.totalIntros || 0) - Number(kpis?.totalConfirmadas || 0)) / Number(kpis?.totalIntros || 0)) * 100 : 0,
      },
      activities,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener setter tracker", details: err.message });
  }
});

// --- Closer Tracker ---
apiRouter.get("/api/v1/closer-tracker", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.mes) filters.mes = req.query.mes;
    if (req.query.semana) filters.semana = Number(req.query.semana);
    if (req.query.closer) filters.closer = req.query.closer;

    const [activities, kpis] = await Promise.all([
      db.getCloserActivities(filters),
      db.getCloserTrackerKPIs(filters),
    ]);

    res.json({
      filters,
      total: activities.length,
      kpis: {
        totalSchedule: Number(kpis?.totalSchedule || 0),
        totalLive: Number(kpis?.totalLive || 0),
        totalOffers: Number(kpis?.totalOffers || 0),
        totalDeposits: Number(kpis?.totalDeposits || 0),
        totalCloses: Number(kpis?.totalCloses || 0),
        totalRevenue: Number(kpis?.totalRevenue || 0),
        totalCash: Number(kpis?.totalCash || 0),
        showRate: Number(kpis?.totalSchedule || 0) > 0
          ? (Number(kpis?.totalLive || 0) / Number(kpis?.totalSchedule || 0)) * 100 : 0,
        offerRate: Number(kpis?.totalLive || 0) > 0
          ? (Number(kpis?.totalOffers || 0) / Number(kpis?.totalLive || 0)) * 100 : 0,
        closeRate: Number(kpis?.totalOffers || 0) > 0
          ? (Number(kpis?.totalCloses || 0) / Number(kpis?.totalOffers || 0)) * 100 : 0,
        noShow: Number(kpis?.totalSchedule || 0) - Number(kpis?.totalLive || 0),
      },
      activities,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener closer tracker", details: err.message });
  }
});

// --- Leaderboards ---
apiRouter.get("/api/v1/leaderboards", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req.query);

    const [setterLeaderboard, closerLeaderboard] = await Promise.all([
      db.getSetterLeaderboard(filters),
      db.getCloserLeaderboard(filters),
    ]);

    res.json({
      filters,
      setters: setterLeaderboard,
      closers: closerLeaderboard,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener leaderboards", details: err.message });
  }
});

// --- Diagnostics (Constraint Engine) ---
apiRouter.get("/api/v1/diagnostics", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req.query);

    const [kpis, marketing, trackerSetter, trackerCloser] = await Promise.all([
      db.getDashboardKPIs(filters),
      db.getMarketingKPIs(filters),
      db.getSetterTrackerKPIs(filters),
      db.getCloserTrackerKPIs(filters),
    ]);

    const adSpend = Number(marketing?.adSpend || 0);
    const totalAgendas = Number(kpis?.totalLeads || 0);
    const totalLeadsRaw = Number(marketing?.totalLeadsRaw || 0);
    const visitasLanding = Number(marketing?.visitasLandingPage || 0);
    const stIntros = Number(trackerSetter?.totalIntros || 0);
    const stDemosConf = Number(trackerSetter?.totalConfirmadas || 0);
    const ctSchedule = Number(trackerCloser?.totalSchedule || 0);
    const ctLive = Number(trackerCloser?.totalLive || 0);
    const ctOffers = Number(trackerCloser?.totalOffers || 0);
    const ctCloses = Number(trackerCloser?.totalCloses || 0);
    const ctRevenue = Number(trackerCloser?.totalRevenue || 0);
    const ctCash = Number(trackerCloser?.totalCash || 0);

    // Build metrics with health evaluation
    const allBenchmarks = [...COST_BENCHMARKS, ...RATE_BENCHMARKS];
    const metricValues: Record<string, number> = {
      cpl: totalAgendas > 0 ? adSpend / totalAgendas : 0,
      costoAgenda: totalAgendas > 0 ? adSpend / totalAgendas : 0,
      cpa: ctCloses > 0 ? adSpend / ctCloses : 0,
      landingOptIn: visitasLanding > 0 ? (totalLeadsRaw / visitasLanding) * 100 : 0,
      bookingRate: totalLeadsRaw > 0 ? (totalAgendas / totalLeadsRaw) * 100 : 0,
      answerRate: Number(trackerSetter?.totalIntentos || 0) > 0
        ? (stIntros / Number(trackerSetter?.totalIntentos || 0)) * 100 : 0,
      triageRate: stIntros > 0 ? (stDemosConf / stIntros) * 100 : 0,
      showRate: ctSchedule > 0 ? (ctLive / ctSchedule) * 100 : 0,
      offerRate: ctLive > 0 ? (ctOffers / ctLive) * 100 : 0,
      closeRate: ctOffers > 0 ? (ctCloses / ctOffers) * 100 : 0,
      cashPercent: ctRevenue > 0 ? (ctCash / ctRevenue) * 100 : 0,
      roasUpFront: adSpend > 0 ? ctCash / adSpend : 0,
    };

    const metrics = allBenchmarks.map((b: any) => {
      const value = metricValues[b.metric] || 0;
      const level = evaluateMetric(value, b as any);
      return {
        metric: b.metric,
        label: b.label,
        value: Math.round(value * 100) / 100,
        unit: b.unit,
        level,
        color: HEALTH_COLORS[level],
      };
    });

    // Identify constraint
    const healthCounts: Record<string, number> = {
      excellent: 0, good: 0, watch: 0, borderline: 0, probCut: 0, cut: 0,
    };
    metrics.forEach((m: any) => { healthCounts[m.level]++; });

    const worstMetrics = metrics
      .filter((m: any) => m.level === "cut" || m.level === "probCut" || m.level === "borderline")
      .sort((a: any, b: any) => {
        const order: Record<string, number> = { cut: 0, probCut: 1, borderline: 2, watch: 3, good: 4, excellent: 5 };
        return (order[a.level] || 0) - (order[b.level] || 0);
      });

    let constraintCategory: ConstraintCategory = "marketing";
    if (worstMetrics.length > 0) {
      const worst = worstMetrics[0].metric;
      if (["answerRate", "triageRate"].includes(worst)) constraintCategory = "sales_setter";
      else if (["showRate", "offerRate", "closeRate"].includes(worst)) constraintCategory = "sales_closer";
      else if (["cashPercent", "roasUpFront"].includes(worst)) constraintCategory = "profitability";
    }

    const scenario = (CONSTRAINT_SCENARIOS as any)[constraintCategory];

    res.json({
      filters,
      metrics,
      summary: {
        totalMetrics: metrics.length,
        healthCounts,
        constraintCategory,
      constraintLabel: (scenario as any)?.label || constraintCategory,
    },
    worstMetrics: worstMetrics.slice(0, 5),
    actions: (scenario as any)?.actions || {},
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener diagnóstico", details: err.message });
  }
});

// --- Marketing Metrics ---
apiRouter.get("/api/v1/marketing", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req.query);
    const marketing = await db.getMarketingKPIs(filters);
    const allMonthly = await db.getMonthlyMetrics();

    res.json({
      filters,
      current: marketing,
      historical: allMonthly,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener marketing", details: err.message });
  }
});

// --- Scoring ---
apiRouter.get("/api/v1/scoring", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.scoreLabel) filters.scoreLabel = req.query.scoreLabel;

    const scoring = await db.getAllLeadScoring(filters);
    res.json({
      filters,
      total: scoring.length,
      scoring,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener scoring", details: err.message });
  }
});

// --- Scoring by Lead ID ---
apiRouter.get("/api/v1/scoring/:leadId", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const leadId = Number(req.params.leadId);
    const scoring = await db.getLeadScoringByLeadId(leadId);
    if (!scoring) {
      return res.status(404).json({ error: "Scoring no encontrado para este lead" });
    }
    res.json({ scoring });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener scoring", details: err.message });
  }
});

// --- Full Summary (everything in one call for AI agents) ---
apiRouter.get("/api/v1/summary", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req.query);

    const [kpis, marketing, trackerSetter, trackerCloser, leads, setterActivities, closerActivities, setterLeaderboard, closerLeaderboard, distinctValues, followUps, followUpStats, closerProjections, setterProjections, teamMembers, alerts, callAuditStats] = await Promise.all([
      db.getDashboardKPIs(filters),
      db.getMarketingKPIs(filters),
      db.getSetterTrackerKPIs(filters),
      db.getCloserTrackerKPIs(filters),
      db.getLeads(filters),
      db.getSetterActivities(filters),
      db.getCloserActivities(filters),
      db.getSetterLeaderboard(filters),
      db.getCloserLeaderboard(filters),
      db.getDistinctValues(),
      db.getFollowUps(),
      db.getFollowUpStats(),
      db.getCloserProjections(),
      db.getSetterProjections(),
      db.getTeamMembers(),
      db.getSmartAlerts(),
      db.getCallAuditStats(),
    ]);

    const adSpend = Number(marketing?.adSpend || 0);
    const totalAgendas = Number(kpis?.totalLeads || 0);
    const stIntros = Number(trackerSetter?.totalIntros || 0);
    const stDemosConf = Number(trackerSetter?.totalConfirmadas || 0);
    const ctCloses = Number(trackerCloser?.totalCloses || 0);
    const ctRevenue = Number(trackerCloser?.totalRevenue || 0);
    const ctCash = Number(trackerCloser?.totalCash || 0);
    const ctSchedule = Number(trackerCloser?.totalSchedule || 0);
    const ctLive = Number(trackerCloser?.totalLive || 0);
    const ctOffers = Number(trackerCloser?.totalOffers || 0);

    res.json({
      filters,
      overview: {
        totalLeads: leads.length,
        totalAgendas,
        adSpend,
        revenue: ctRevenue,
        cashCollected: ctCash,
        ventas: ctCloses,
        cpl: totalAgendas > 0 ? Math.round((adSpend / totalAgendas) * 100) / 100 : 0,
        cpa: ctCloses > 0 ? Math.round((adSpend / ctCloses) * 100) / 100 : 0,
        roasUpFront: adSpend > 0 ? Math.round((ctCash / adSpend) * 100) / 100 : 0,
        closeRate: ctOffers > 0 ? Math.round((ctCloses / ctOffers) * 10000) / 100 : 0,
        showRate: ctSchedule > 0 ? Math.round((ctLive / ctSchedule) * 10000) / 100 : 0,
        answerRate: Number(trackerSetter?.totalIntentos || 0) > 0
          ? Math.round((stIntros / Number(trackerSetter?.totalIntentos || 0)) * 10000) / 100 : 0,
      },
      leads: {
        total: leads.length,
        data: leads,
      },
      setterTracker: {
        total: setterActivities.length,
        kpis: trackerSetter,
        activities: setterActivities,
      },
      closerTracker: {
        total: closerActivities.length,
        kpis: trackerCloser,
        activities: closerActivities,
      },
      leaderboards: {
        setters: setterLeaderboard,
        closers: closerLeaderboard,
      },
      followUps: {
        total: followUps.length,
        stats: followUpStats,
        data: followUps,
      },
      projections: {
        closer: closerProjections,
        setter: setterProjections,
      },
      team: teamMembers,
      alerts,
      callAuditStats,
      availableFilters: distinctValues,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener resumen completo", details: err.message });
  }
});

// --- Call Audits ---
apiRouter.get("/api/v1/call-audits/stats", apiKeyAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await db.getCallAuditStats();
    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener estadísticas de auditorías", details: err.message });
  }
});

apiRouter.get("/api/v1/call-audits/by-lead/:leadId", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const leadId = Number(req.params.leadId);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: "leadId debe ser un número" });
    }
    const audits = await db.getCallAuditsByLeadId(leadId);
    res.json({
      leadId,
      total: audits.length,
      audits,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener auditorías del lead", details: err.message });
  }
});

apiRouter.get("/api/v1/call-audits/:id", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "id debe ser un número" });
    }
    const audit = await db.getCallAuditById(id);
    if (!audit) {
      return res.status(404).json({ error: "Auditoría no encontrada" });
    }
    res.json({ audit });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener auditoría", details: err.message });
  }
});

apiRouter.get("/api/v1/call-audits", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: { closer?: string; manualReview?: string; limit?: number; offset?: number } = {};
    if (req.query.closer) filters.closer = req.query.closer as string;
    if (req.query.manualReview) filters.manualReview = req.query.manualReview as string;
    if (req.query.limit) filters.limit = Number(req.query.limit);
    if (req.query.offset) filters.offset = Number(req.query.offset);

    const [audits, stats] = await Promise.all([
      db.getCallAudits(filters),
      db.getCallAuditStats(),
    ]);

    res.json({
      filters,
      total: audits.length,
      stats,
      audits,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener auditorías", details: err.message });
  }
});

// ==================== FOLLOW-UPS ====================

apiRouter.get("/api/v1/follow-ups", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.estado) filters.estado = req.query.estado;
    if (req.query.closer) filters.closerAsignado = req.query.closer;
    if (req.query.prioridad) filters.prioridad = req.query.prioridad;
    if (req.query.tipo) filters.tipo = req.query.tipo;
    if (req.query.limit) filters.limit = Number(req.query.limit);
    if (req.query.offset) filters.offset = Number(req.query.offset);

    const [followUps, stats] = await Promise.all([
      db.getFollowUps(filters),
      db.getFollowUpStats(),
    ]);

    res.json({ filters, total: followUps.length, stats, followUps });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener follow-ups", details: err.message });
  }
});

apiRouter.get("/api/v1/follow-ups/stats", apiKeyAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await db.getFollowUpStats();
    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener estadísticas de follow-ups", details: err.message });
  }
});

apiRouter.get("/api/v1/follow-ups/:id/logs", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "id debe ser un número" });
    const logs = await db.getFollowUpLogs(id);
    res.json({ followUpId: id, total: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener logs del follow-up", details: err.message });
  }
});

apiRouter.get("/api/v1/follow-ups/:id", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "id debe ser un número" });
    const followUp = await db.getFollowUpById(id);
    if (!followUp) return res.status(404).json({ error: "Follow-up no encontrado" });
    const logs = await db.getFollowUpLogs(id);
    res.json({ followUp, logs });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener follow-up", details: err.message });
  }
});

// ==================== PROYECCIONES ====================

apiRouter.get("/api/v1/projections/closer", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.mes) filters.mes = req.query.mes;
    if (req.query.anio) filters.anio = Number(req.query.anio);
    if (req.query.closer) filters.closer = req.query.closer;

    const projections = await db.getCloserProjections(filters);
    res.json({ filters, total: projections.length, projections });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener proyecciones de closer", details: err.message });
  }
});

apiRouter.get("/api/v1/projections/closer/:id", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "id debe ser un número" });
    const projection = await db.getCloserProjectionWithActuals(id);
    if (!projection) return res.status(404).json({ error: "Proyección no encontrada" });
    res.json({ projection });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener proyección de closer", details: err.message });
  }
});

apiRouter.get("/api/v1/projections/setter", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.mes) filters.mes = req.query.mes;
    if (req.query.anio) filters.anio = Number(req.query.anio);
    if (req.query.setter) filters.setter = req.query.setter;

    const projections = await db.getSetterProjections(filters);
    res.json({ filters, total: projections.length, projections });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener proyecciones de setter", details: err.message });
  }
});

apiRouter.get("/api/v1/projections/setter/:id", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "id debe ser un número" });
    const projection = await db.getSetterProjectionWithActuals(id);
    if (!projection) return res.status(404).json({ error: "Proyección no encontrada" });
    res.json({ projection });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener proyección de setter", details: err.message });
  }
});

// ==================== EQUIPO ====================

apiRouter.get("/api/v1/team", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.rol) filters.rol = req.query.rol;
    if (req.query.activo !== undefined) filters.activo = req.query.activo === "true";

    const members = await db.getTeamMembers(filters);
    res.json({ total: members.length, members });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener equipo", details: err.message });
  }
});

// ==================== COLA DE TRABAJO ====================

apiRouter.get("/api/v1/work-queue", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const setter = req.query.setter as string | undefined;
    const queue = await db.getSetterWorkQueue(setter);
    res.json({ setter: setter || "todos", total: queue.length, queue });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener cola de trabajo", details: err.message });
  }
});

// ==================== CONFIRMACIONES ====================

apiRouter.get("/api/v1/confirmations", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const setter = req.query.setter as string | undefined;
    const confirmations = await db.getConfirmationQueue(setter);
    res.json({ setter: setter || "todos", ...confirmations });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener confirmaciones", details: err.message });
  }
});

// ==================== ATRIBUCIÓN ====================

apiRouter.get("/api/v1/attribution", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo;
    if (req.query.campaignId) filters.campaignId = req.query.campaignId;

    const attribution = await db.getLeadAttribution(filters);
    res.json({ filters, total: attribution.length, attribution });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener atribución", details: err.message });
  }
});

apiRouter.get("/api/v1/attribution/by-campaign", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const data = await db.getLeadCountByUtmCampaign(dateFrom, dateTo);
    res.json({ dateFrom, dateTo, total: data.length, campaigns: data });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener atribución por campaña", details: err.message });
  }
});

// ==================== ADS (Meta Ads) ====================

apiRouter.get("/api/v1/ads/campaigns", apiKeyAuth, async (_req: Request, res: Response) => {
  try {
    const campaigns = await db.getAdCampaigns();
    res.json({ total: campaigns.length, campaigns });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener campañas", details: err.message });
  }
});

apiRouter.get("/api/v1/ads/adsets", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string | undefined;
    const adsets = await db.getAdAdsets(campaignId);
    res.json({ campaignId, total: adsets.length, adsets });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener adsets", details: err.message });
  }
});

apiRouter.get("/api/v1/ads/ads", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.campaignId) filters.campaignId = req.query.campaignId;
    if (req.query.adsetId) filters.adsetId = req.query.adsetId;
    const ads = await db.getAdAds(filters);
    res.json({ filters, total: ads.length, ads });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener anuncios", details: err.message });
  }
});

apiRouter.get("/api/v1/ads/metrics", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo;
    if (req.query.campaignId) filters.campaignId = req.query.campaignId;
    if (req.query.adsetId) filters.adsetId = req.query.adsetId;
    const metrics = await db.getAdMetricsDaily(filters);
    res.json({ filters, total: metrics.length, metrics });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener métricas de ads", details: err.message });
  }
});

apiRouter.get("/api/v1/ads/metrics/by-campaign", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const metrics = await db.getAdMetricsByCampaign(dateFrom, dateTo);
    res.json({ dateFrom, dateTo, total: metrics.length, metrics });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener métricas por campaña", details: err.message });
  }
});

apiRouter.get("/api/v1/ads/metrics/by-adset", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string;
    if (!campaignId) return res.status(400).json({ error: "campaignId es requerido" });
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const metrics = await db.getAdMetricsByAdset(campaignId, dateFrom, dateTo);
    res.json({ campaignId, dateFrom, dateTo, total: metrics.length, metrics });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener métricas por adset", details: err.message });
  }
});

apiRouter.get("/api/v1/ads/metrics/by-ad", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const adsetId = req.query.adsetId as string;
    if (!adsetId) return res.status(400).json({ error: "adsetId es requerido" });
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const metrics = await db.getAdMetricsByAd(adsetId, dateFrom, dateTo);
    res.json({ adsetId, dateFrom, dateTo, total: metrics.length, metrics });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener métricas por anuncio", details: err.message });
  }
});

apiRouter.get("/api/v1/ads/spend-trend", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    if (!dateFrom || !dateTo) return res.status(400).json({ error: "dateFrom y dateTo son requeridos (YYYY-MM-DD)" });
    const trend = await db.getAdSpendTrend(dateFrom, dateTo);
    res.json({ dateFrom, dateTo, total: trend.length, trend });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener tendencia de gasto", details: err.message });
  }
});

// ==================== ALERTAS ====================

apiRouter.get("/api/v1/alerts", apiKeyAuth, async (_req: Request, res: Response) => {
  try {
    const alerts = await db.getSmartAlerts();
    res.json({ total: alerts.length, alerts });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener alertas", details: err.message });
  }
});

// ==================== TEAM SUMMARY ====================

apiRouter.get("/api/v1/team-summary/setter", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const anio = req.query.anio ? Number(req.query.anio) : undefined;
    const summary = await db.getSetterTeamSummaryByMonth(anio);
    res.json({ anio: anio || new Date().getFullYear(), summary });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener team summary setter", details: err.message });
  }
});

apiRouter.get("/api/v1/team-summary/closer", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const anio = req.query.anio ? Number(req.query.anio) : undefined;
    const summary = await db.getCloserTeamSummaryByMonth(anio);
    res.json({ anio: anio || new Date().getFullYear(), summary });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener team summary closer", details: err.message });
  }
});

// ==================== REP PROFILE ====================

apiRouter.get("/api/v1/rep-profile/setter/:name", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const profile = await db.getSetterRepProfile(name);
    res.json({ setter: name, profile });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener perfil de setter", details: err.message });
  }
});

apiRouter.get("/api/v1/rep-profile/closer/:name", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const profile = await db.getCloserRepProfile(name);
    res.json({ closer: name, profile });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener perfil de closer", details: err.message });
  }
});

// ==================== WEIGHTED LEADERBOARDS ====================

apiRouter.get("/api/v1/leaderboards/weighted", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req.query);

    // Setter weights
    const setterWeights: any = {};
    if (req.query.sw_intentos) setterWeights.intentos = Number(req.query.sw_intentos);
    if (req.query.sw_intros) setterWeights.intros = Number(req.query.sw_intros);
    if (req.query.sw_asistidas) setterWeights.asistidas = Number(req.query.sw_asistidas);
    if (req.query.sw_cierres) setterWeights.cierres = Number(req.query.sw_cierres);
    if (req.query.sw_revenue) setterWeights.revenue = Number(req.query.sw_revenue);

    // Closer weights
    const closerWeights: any = {};
    if (req.query.cw_closes) closerWeights.closes = Number(req.query.cw_closes);
    if (req.query.cw_revenue) closerWeights.revenue = Number(req.query.cw_revenue);
    if (req.query.cw_cash) closerWeights.cash = Number(req.query.cw_cash);
    if (req.query.cw_closeRate) closerWeights.closeRate = Number(req.query.cw_closeRate);
    if (req.query.cw_showRate) closerWeights.showRate = Number(req.query.cw_showRate);

    const [setters, closers] = await Promise.all([
      db.getWeightedSetterLeaderboard(
        filters,
        Object.keys(setterWeights).length > 0 ? setterWeights : undefined
      ),
      db.getWeightedCloserLeaderboard(
        filters,
        Object.keys(closerWeights).length > 0 ? closerWeights : undefined
      ),
    ]);

    res.json({ filters, setters, closers });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener leaderboards ponderados", details: err.message });
  }
});

// ==================== CONTACT ATTEMPTS ====================

apiRouter.get("/api/v1/leads/:id/contact-attempts", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) return res.status(400).json({ error: "id debe ser un número" });
    const attempts = await db.getContactAttempts(leadId);
    res.json({ leadId, total: attempts.length, attempts });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener intentos de contacto", details: err.message });
  }
});

// ==================== COMMENTS ====================

apiRouter.get("/api/v1/leads/:id/comments", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) return res.status(400).json({ error: "id debe ser un número" });
    const comments = await db.getLeadComments(leadId);
    res.json({ leadId, total: comments.length, comments });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener comentarios", details: err.message });
  }
});

// ==================== LEADS NEEDS ATTENTION ====================

apiRouter.get("/api/v1/leads/needs-attention", apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req.query);
    const leads = (await db.getLeadsNeedingAttention(filters)) as unknown as any[];
    res.json({ filters, total: leads.length, leads });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener leads que necesitan atención", details: err.message });
  }
});

export { apiRouter };
