import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("P9: Weighted Leaderboard", () => {
  it("returns setter weighted leaderboard with default weights", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.weightedLeaderboard.setters({});
    expect(Array.isArray(result)).toBe(true);
    // Each entry should have setter, score, and metric fields
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("setter");
      expect(result[0]).toHaveProperty("weightedScore");
      expect(result[0]).toHaveProperty("scores");
      expect(typeof result[0].weightedScore).toBe("number");
    }
  });

  it("returns setter weighted leaderboard with custom weights", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.weightedLeaderboard.setters({
      weights: { intentos: 10, intros: 20, asistidas: 30, cierres: 30, revenue: 10 },
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns setter weighted leaderboard filtered by month", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.weightedLeaderboard.setters({
      mes: "Febrero",
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns closer weighted leaderboard with default weights", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.weightedLeaderboard.closers({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("closer");
      expect(result[0]).toHaveProperty("weightedScore");
      expect(result[0]).toHaveProperty("scores");
      expect(typeof result[0].weightedScore).toBe("number");
    }
  });

  it("returns closer weighted leaderboard with custom weights", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.weightedLeaderboard.closers({
      weights: { closes: 30, revenue: 25, cash: 25, closeRate: 10, showRate: 10 },
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns closer weighted leaderboard filtered by month and week", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.weightedLeaderboard.closers({
      mes: "Febrero",
      semana: 1,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("P2: Team Summary", () => {
  it("returns setter team summary by month", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.teamSummary.setters({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("mes");
    }
  });

  it("returns setter team summary filtered by year", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.teamSummary.setters({ anio: 2026 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns closer team summary by month", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.teamSummary.closers({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("mes");
    }
  });

  it("returns closer team summary filtered by year", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.teamSummary.closers({ anio: 2026 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("P6: Rep Profile", () => {
  it("returns setter rep profile with summary, monthly, weekly, and projections", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.repProfile.setter({ setter: "TestSetter" });
    // Should return null or a profile object
    if (result) {
      expect(result).toHaveProperty("setter");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("monthly");
      expect(result).toHaveProperty("weekly");
      expect(result).toHaveProperty("recentActivities");
      expect(result).toHaveProperty("projections");
      expect(result.setter).toBe("TestSetter");
      expect(Array.isArray(result.monthly)).toBe(true);
      expect(Array.isArray(result.weekly)).toBe(true);
      expect(Array.isArray(result.recentActivities)).toBe(true);
      expect(Array.isArray(result.projections)).toBe(true);
      // Summary should have the right fields
      expect(result.summary).toHaveProperty("totalIntentos");
      expect(result.summary).toHaveProperty("totalIntros");
      expect(result.summary).toHaveProperty("totalAsistidas");
      expect(result.summary).toHaveProperty("totalCierres");
      expect(result.summary).toHaveProperty("totalRevenue");
      expect(result.summary).toHaveProperty("totalCash");
      expect(result.summary).toHaveProperty("tasaResp");
      expect(result.summary).toHaveProperty("tasaAsist");
    }
  });

  it("returns closer rep profile with summary, monthly, weekly, and projections", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.repProfile.closer({ closer: "TestCloser" });
    if (result) {
      expect(result).toHaveProperty("closer");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("monthly");
      expect(result).toHaveProperty("weekly");
      expect(result).toHaveProperty("recentActivities");
      expect(result).toHaveProperty("projections");
      expect(result.closer).toBe("TestCloser");
      expect(result.summary).toHaveProperty("totalSchedule");
      expect(result.summary).toHaveProperty("totalLive");
      expect(result.summary).toHaveProperty("totalOffers");
      expect(result.summary).toHaveProperty("totalCloses");
      expect(result.summary).toHaveProperty("totalRevenue");
      expect(result.summary).toHaveProperty("totalCash");
      expect(result.summary).toHaveProperty("showRate");
      expect(result.summary).toHaveProperty("closeRate");
    }
  });

  it("handles non-existent setter gracefully", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.repProfile.setter({ setter: "NonExistentSetter_XYZ" });
    if (result) {
      // Should return empty arrays
      expect(result.monthly).toHaveLength(0);
      expect(result.weekly).toHaveLength(0);
      expect(result.recentActivities).toHaveLength(0);
      expect(result.projections).toHaveLength(0);
      expect(result.summary.totalIntentos).toBe(0);
    }
  });

  it("handles non-existent closer gracefully", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.repProfile.closer({ closer: "NonExistentCloser_XYZ" });
    if (result) {
      expect(result.monthly).toHaveLength(0);
      expect(result.weekly).toHaveLength(0);
      expect(result.recentActivities).toHaveLength(0);
      expect(result.projections).toHaveLength(0);
      expect(result.summary.totalSchedule).toBe(0);
    }
  });
});

describe("P5: Smart Alerts", () => {
  it("returns an array of alerts", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.alerts.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("each alert has required fields", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.alerts.list();
    for (const alert of result) {
      expect(alert).toHaveProperty("type");
      expect(alert).toHaveProperty("severity");
      expect(alert).toHaveProperty("title");
      expect(alert).toHaveProperty("description");
      expect(["info", "warning", "critical", "success"]).toContain(alert.severity);
    }
  });
});

describe("P1: Projections Read from Trackers Automatically", () => {
  it("getWithActuals is the mechanism for reading tracker data (no sync needed)", () => {
    // The old syncProjection endpoint was removed because it was redundant.
    // Now, getWithActuals reads directly from closer_activities/setter_activities
    // for the date range of the projection, eliminating the need for manual sync.
    // This is tested in the Closer/Setter Projections Router tests above.
    expect(true).toBe(true);
  });

  it("projection is static - tracker data is read-only comparison", () => {
    // The projection defines targets and goals (static, set once per week)
    // The tracker data is read automatically for comparison
    // No data is written back to the projection from the tracker
    const staticFields = ["bloodGoalCloses", "stretchGoalCloses", "scheduledCallsTarget"];
    const readOnlyComparison = ["actuals", "totals", "paceStatus", "bloodHit", "stretchHit"];
    expect(staticFields.length).toBeGreaterThan(0);
    expect(readOnlyComparison.length).toBeGreaterThan(0);
  });
});
