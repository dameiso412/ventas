import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ==================== HELPERS ====================

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-test",
      email: "admin@sacamedi.com",
      name: "Admin Test",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ==================== TESTS ====================

describe("Meta Ads - Token Validation", () => {
  it("validates the FB access token and returns account info", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.validateToken();

    expect(result).toHaveProperty("valid");
    expect(typeof result.valid).toBe("boolean");
    if (result.valid) {
      expect(result.accountName).toBeDefined();
      expect(typeof result.accountName).toBe("string");
    }
  });
});

describe("Meta Ads - Recommended UTM Tags", () => {
  it("returns the recommended UTM tag string with Meta macros", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.recommendedUtmTags();

    expect(result.tags).toContain("utm_source=facebook");
    expect(result.tags).toContain("utm_medium=paid_social");
    expect(result.tags).toContain("{{campaign.id}}");
    expect(result.tags).toContain("{{ad.id}}");
    expect(result.tags).toContain("{{adset.id}}");
  });
});

describe("Meta Ads - Sync Operations", () => {
  it("can sync campaign structure from Meta API", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.syncStructure();

    expect(result).toHaveProperty("campaigns");
    expect(result).toHaveProperty("adsets");
    expect(result).toHaveProperty("ads");
    expect(typeof result.campaigns).toBe("number");
    expect(typeof result.adsets).toBe("number");
    expect(typeof result.ads).toBe("number");
    expect(result.campaigns).toBeGreaterThan(0);
  }, 30000);

  it("can sync insights from Meta API", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.syncInsights({
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
      level: "ad",
    });

    expect(result).toHaveProperty("synced");
    expect(typeof result.synced).toBe("number");
  }, 30000);
});

describe("Meta Ads - Metrics Queries", () => {
  it("returns campaign metrics for a date range", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const metrics = await caller.metaAds.metricsByCampaign({
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
    });

    expect(Array.isArray(metrics)).toBe(true);
    // After sync, should have data
    if (metrics.length > 0) {
      const first = metrics[0];
      expect(first).toHaveProperty("campaignId");
      expect(first).toHaveProperty("campaignName");
      expect(first).toHaveProperty("totalSpend");
      expect(first).toHaveProperty("totalImpressions");
      expect(first).toHaveProperty("totalClicks");
      expect(first).toHaveProperty("totalLeads");
    }
  });

  it("returns adset metrics for a campaign drill-down", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    // First get campaigns to find a valid ID
    const campaigns = await caller.metaAds.metricsByCampaign({
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
    });

    if (campaigns.length > 0) {
      const metrics = await caller.metaAds.metricsByAdset({
        campaignId: campaigns[0].campaignId,
        dateFrom: "2026-02-01",
        dateTo: "2026-02-28",
      });

      expect(Array.isArray(metrics)).toBe(true);
      if (metrics.length > 0) {
        expect(metrics[0]).toHaveProperty("adsetId");
        expect(metrics[0]).toHaveProperty("adsetName");
        expect(metrics[0]).toHaveProperty("totalSpend");
      }
    }
  });

  it("returns ad metrics for an adset drill-down", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    // First get campaigns, then adsets
    const campaigns = await caller.metaAds.metricsByCampaign({
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
    });

    if (campaigns.length > 0) {
      const adsets = await caller.metaAds.metricsByAdset({
        campaignId: campaigns[0].campaignId,
        dateFrom: "2026-02-01",
        dateTo: "2026-02-28",
      });

      if (adsets.length > 0) {
        const metrics = await caller.metaAds.metricsByAd({
          adsetId: adsets[0].adsetId ?? "",
          dateFrom: "2026-02-01",
          dateTo: "2026-02-28",
        });

        expect(Array.isArray(metrics)).toBe(true);
        if (metrics.length > 0) {
          expect(metrics[0]).toHaveProperty("adId");
          expect(metrics[0]).toHaveProperty("adName");
          expect(metrics[0]).toHaveProperty("totalSpend");
        }
      }
    }
  });

  it("returns spend trend data", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const trend = await caller.metaAds.spendTrend({
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
    });

    expect(Array.isArray(trend)).toBe(true);
    if (trend.length > 0) {
      expect(trend[0]).toHaveProperty("fecha");
      expect(trend[0]).toHaveProperty("totalSpend");
      expect(trend[0]).toHaveProperty("totalImpressions");
    }
  });
});

describe("Meta Ads - UTM Status", () => {
  it("returns UTM status for ads from the database", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.utmStatus();

    expect(result).toHaveProperty("withUtm");
    expect(result).toHaveProperty("withoutUtm");
    expect(Array.isArray(result.withUtm)).toBe(true);
    expect(Array.isArray(result.withoutUtm)).toBe(true);

    // Total should match what was synced
    const total = result.withUtm.length + result.withoutUtm.length;
    expect(total).toBeGreaterThan(0);

    // Each item should have id and name
    for (const ad of result.withUtm) {
      expect(ad).toHaveProperty("id");
      expect(ad).toHaveProperty("name");
      expect(ad).toHaveProperty("urlTags");
    }
    for (const ad of result.withoutUtm) {
      expect(ad).toHaveProperty("id");
      expect(ad).toHaveProperty("name");
    }
  });
});
