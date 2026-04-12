import { describe, expect, it, vi, beforeEach } from "vitest";
import * as db from "./db";

// Mock db module
vi.mock("./db", () => ({
  getFollowUps: vi.fn().mockResolvedValue([
    { id: 1, leadId: 100, status: "pendiente", priority: "alta", closer: "Damaso" },
    { id: 2, leadId: 101, status: "en_progreso", priority: "media", closer: "Damaso" },
  ]),
  getFollowUpById: vi.fn().mockResolvedValue({
    id: 1, leadId: 100, status: "pendiente", priority: "alta", closer: "Damaso",
  }),
  getFollowUpStats: vi.fn().mockResolvedValue({
    total: 10, pendientes: 5, enProgreso: 3, completados: 2,
  }),
  getFollowUpLogs: vi.fn().mockResolvedValue([
    { id: 1, followUpId: 1, action: "llamada", note: "No contesta" },
  ]),
  getCloserProjections: vi.fn().mockResolvedValue([
    { id: 1, closer: "Damaso", mes: "Marzo", metaCierres: 10, metaRevenue: 50000 },
  ]),
  getCloserProjectionById: vi.fn().mockResolvedValue({
    id: 1, closer: "Damaso", mes: "Marzo", metaCierres: 10,
  }),
  getSetterProjections: vi.fn().mockResolvedValue([
    { id: 1, setter: "Josefa", mes: "Marzo", metaIntentos: 200 },
  ]),
  getSetterProjectionById: vi.fn().mockResolvedValue({
    id: 1, setter: "Josefa", mes: "Marzo", metaIntentos: 200,
  }),
  getTeamMembers: vi.fn().mockResolvedValue([
    { id: 1, name: "Josefa", role: "SETTER", isActive: true },
    { id: 2, name: "Damaso", role: "CLOSER", isActive: true },
  ]),
  getSmartAlerts: vi.fn().mockResolvedValue([
    { type: "no_contact", message: "3 leads sin contactar en 48h", severity: "high" },
  ]),
  getSetterMonthlyPerformance: vi.fn().mockResolvedValue([
    { setter: "Josefa", month: "Marzo", intentos: 150, intros: 80 },
  ]),
  getCloserMonthlyPerformance: vi.fn().mockResolvedValue([
    { closer: "Damaso", month: "Marzo", cierres: 5, revenue: 25000 },
  ]),
  getSetterProfile: vi.fn().mockResolvedValue({
    name: "Josefa", metrics: { intentos: 150, intros: 80, confirmadas: 60 },
  }),
  getCloserProfile: vi.fn().mockResolvedValue({
    name: "Damaso", metrics: { cierres: 5, revenue: 25000, cash: 15000 },
  }),
  getWorkQueue: vi.fn().mockResolvedValue([
    { id: 100, name: "Lead Test", phone: "123456", status: "pendiente" },
  ]),
  getConfirmationQueue: vi.fn().mockResolvedValue([
    { id: 101, name: "Lead Demo", demoDate: "2026-03-10", confirmed: false },
  ]),
  getLeadAttribution: vi.fn().mockResolvedValue([
    { leadId: 100, utmSource: "facebook", utmCampaign: "camp1" },
  ]),
  getLeadsByUtmCampaign: vi.fn().mockResolvedValue([
    { campaign: "camp1", count: 15 },
  ]),
  getAdCampaigns: vi.fn().mockResolvedValue([
    { id: "120215", name: "Campaign 1", status: "ACTIVE" },
  ]),
  getAdsets: vi.fn().mockResolvedValue([
    { id: "120216", name: "Adset 1", campaignId: "120215" },
  ]),
  getAds: vi.fn().mockResolvedValue([
    { id: "120217", name: "Ad 1", adsetId: "120216" },
  ]),
  getDailyAdMetrics: vi.fn().mockResolvedValue([
    { date: "2026-03-01", impressions: 1000, clicks: 50, spend: 25.5 },
  ]),
  getAdMetricsByCampaign: vi.fn().mockResolvedValue([
    { campaignId: "120215", impressions: 5000, clicks: 250, spend: 125 },
  ]),
  getAdMetricsByAdset: vi.fn().mockResolvedValue([
    { adsetId: "120216", impressions: 2500, clicks: 125, spend: 62.5 },
  ]),
  getAdMetricsByAd: vi.fn().mockResolvedValue([
    { adId: "120217", impressions: 1200, clicks: 60, spend: 30 },
  ]),
  getSpendTrend: vi.fn().mockResolvedValue([
    { date: "2026-03-01", spend: 25.5 },
    { date: "2026-03-02", spend: 30.0 },
  ]),
  getWeightedLeaderboards: vi.fn().mockResolvedValue({
    setters: [{ name: "Josefa", score: 85 }],
    closers: [{ name: "Damaso", score: 92 }],
  }),
  getLeadsNeedingAttention: vi.fn().mockResolvedValue([
    { id: 100, name: "Lead Urgente", status: "sin_contacto" },
  ]),
  getContactAttempts: vi.fn().mockResolvedValue([
    { id: 1, leadId: 100, type: "llamada", result: "no_contesta" },
  ]),
  getLeadComments: vi.fn().mockResolvedValue([
    { id: 1, leadId: 100, comment: "Interesado en plan premium", author: "Josefa" },
  ]),
  getCallAuditStats: vi.fn().mockResolvedValue({
    total: 20, avgScore: 7.5, distribution: { excellent: 5, good: 10, needsWork: 5 },
  }),
}));

describe("API v1 Expansion - DB Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Follow-Ups", () => {
    it("getFollowUps returns list of follow-ups", async () => {
      const result = await db.getFollowUps();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("status");
      expect(result[0]).toHaveProperty("closer");
    });

    it("getFollowUpById returns a single follow-up", async () => {
      const result = await db.getFollowUpById(1);
      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("status", "pendiente");
    });

    it("getFollowUpStats returns aggregated stats", async () => {
      const result = await db.getFollowUpStats();
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("pendientes");
      expect(result).toHaveProperty("completados");
    });

    it("getFollowUpLogs returns action history", async () => {
      const result = await db.getFollowUpLogs(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("action", "llamada");
    });
  });

  describe("Projections", () => {
    it("getCloserProjections returns closer projections", async () => {
      const result = await db.getCloserProjections();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("closer", "Damaso");
      expect(result[0]).toHaveProperty("metaCierres");
    });

    it("getCloserProjectionById returns single projection", async () => {
      const result = await db.getCloserProjectionById(1);
      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("closer", "Damaso");
    });

    it("getSetterProjections returns setter projections", async () => {
      const result = await db.getSetterProjections();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("setter", "Josefa");
    });

    it("getSetterProjectionById returns single projection", async () => {
      const result = await db.getSetterProjectionById(1);
      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("setter", "Josefa");
    });
  });

  describe("Team", () => {
    it("getTeamMembers returns team list", async () => {
      const result = await db.getTeamMembers();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("role");
      expect(result[0]).toHaveProperty("isActive");
    });

    it("getSetterMonthlyPerformance returns monthly data", async () => {
      const result = await db.getSetterMonthlyPerformance(2026);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("setter");
      expect(result[0]).toHaveProperty("intentos");
    });

    it("getCloserMonthlyPerformance returns monthly data", async () => {
      const result = await db.getCloserMonthlyPerformance(2026);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("closer");
      expect(result[0]).toHaveProperty("cierres");
    });

    it("getSetterProfile returns setter profile", async () => {
      const result = await db.getSetterProfile("Josefa");
      expect(result).toHaveProperty("name", "Josefa");
      expect(result).toHaveProperty("metrics");
    });

    it("getCloserProfile returns closer profile", async () => {
      const result = await db.getCloserProfile("Damaso");
      expect(result).toHaveProperty("name", "Damaso");
      expect(result).toHaveProperty("metrics");
    });
  });

  describe("Operations", () => {
    it("getWorkQueue returns pending leads", async () => {
      const result = await db.getWorkQueue();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("status", "pendiente");
    });

    it("getConfirmationQueue returns pending confirmations", async () => {
      const result = await db.getConfirmationQueue();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("confirmed", false);
    });
  });

  describe("Alerts", () => {
    it("getSmartAlerts returns active alerts", async () => {
      const result = await db.getSmartAlerts();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("type");
      expect(result[0]).toHaveProperty("severity");
    });
  });

  describe("Attribution", () => {
    it("getLeadAttribution returns UTM attribution data", async () => {
      const result = await db.getLeadAttribution({});
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("utmSource");
      expect(result[0]).toHaveProperty("utmCampaign");
    });

    it("getLeadsByUtmCampaign returns campaign counts", async () => {
      const result = await db.getLeadsByUtmCampaign({});
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("campaign");
      expect(result[0]).toHaveProperty("count");
    });
  });

  describe("Meta Ads", () => {
    it("getAdCampaigns returns campaigns", async () => {
      const result = await db.getAdCampaigns();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("status");
    });

    it("getAdsets returns adsets", async () => {
      const result = await db.getAdsets();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("campaignId");
    });

    it("getAds returns ads", async () => {
      const result = await db.getAds();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("adsetId");
    });

    it("getDailyAdMetrics returns daily metrics", async () => {
      const result = await db.getDailyAdMetrics({});
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("impressions");
      expect(result[0]).toHaveProperty("clicks");
      expect(result[0]).toHaveProperty("spend");
    });

    it("getAdMetricsByCampaign returns aggregated campaign metrics", async () => {
      const result = await db.getAdMetricsByCampaign({});
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("campaignId");
    });

    it("getSpendTrend returns daily spend trend", async () => {
      const result = await db.getSpendTrend("2026-03-01", "2026-03-31");
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("spend");
    });
  });

  describe("Leaderboards", () => {
    it("getWeightedLeaderboards returns weighted rankings", async () => {
      const result = await db.getWeightedLeaderboards({}, {});
      expect(result).toHaveProperty("setters");
      expect(result).toHaveProperty("closers");
      expect(result.setters).toHaveLength(1);
      expect(result.closers).toHaveLength(1);
    });
  });

  describe("Leads Extended", () => {
    it("getLeadsNeedingAttention returns leads requiring action", async () => {
      const result = (await db.getLeadsNeedingAttention({})) as any[];
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("status", "sin_contacto");
    });

    it("getContactAttempts returns contact history for a lead", async () => {
      const result = await db.getContactAttempts(100);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("type", "llamada");
    });

    it("getLeadComments returns comments for a lead", async () => {
      const result = await db.getLeadComments(100);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("comment");
    });
  });

  describe("Call Audit Stats", () => {
    it("getCallAuditStats returns aggregated audit stats", async () => {
      const result = await db.getCallAuditStats();
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("avgScore");
      expect(result).toHaveProperty("distribution");
    });
  });
});
