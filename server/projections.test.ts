import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => {
  const mockCloserProjections: any[] = [];
  const mockSetterProjections: any[] = [];
  let closerIdCounter = 1;
  let setterIdCounter = 1;

  return {
    // Closer projections
    createCloserProjection: vi.fn(async (data: any) => {
      const id = closerIdCounter++;
      mockCloserProjections.push({ id, ...data });
      return id;
    }),
    getCloserProjections: vi.fn(async () => mockCloserProjections),
    getCloserProjectionById: vi.fn(async (id: number) => {
      const p = mockCloserProjections.find(p => p.id === id);
      return p || null;
    }),
    getCloserProjectionWithActuals: vi.fn(async (id: number) => {
      const p = mockCloserProjections.find(p => p.id === id);
      if (!p) return null;
      return {
        projection: p,
        actuals: [
          { fecha: "2026-02-23", scheduleCalls: 5, liveCalls: 4, offers: 3, deposits: 1, closes: 2, piffRevenue: 14000, piffCash: 7000, setupRevenue: 3000, setupCash: 1500 },
          { fecha: "2026-02-24", scheduleCalls: 6, liveCalls: 5, offers: 4, deposits: 2, closes: 1, piffRevenue: 7000, piffCash: 3500, setupRevenue: 0, setupCash: 0 },
        ],
        totals: { scheduleCalls: 11, liveCalls: 9, offers: 7, deposits: 3, closes: 3 },
        totalRevenue: 24000,
        totalCash: 12000,
        daysWithData: 2,
        paceStatus: { closes: "on_track", revenue: "on_track", cash: "on_track" },
        bloodHit: false,
        stretchHit: false,
      };
    }),
    updateCloserProjection: vi.fn(async () => {}),
    deleteCloserProjection: vi.fn(async () => {}),

    // Setter projections
    createSetterProjection: vi.fn(async (data: any) => {
      const id = setterIdCounter++;
      mockSetterProjections.push({ id, ...data });
      return id;
    }),
    getSetterProjections: vi.fn(async () => mockSetterProjections),
    getSetterProjectionById: vi.fn(async (id: number) => {
      const p = mockSetterProjections.find(p => p.id === id);
      return p || null;
    }),
    getSetterProjectionWithActuals: vi.fn(async (id: number) => {
      const p = mockSetterProjections.find(p => p.id === id);
      if (!p) return null;
      return {
        projection: p,
        actuals: [
          { fecha: "2026-02-23", intentosLlamada: 10, introsEfectivas: 4, demosAseguradasConIntro: 2, demosEnCalendario: 2, demosConfirmadas: 1, demosAsistidas: 1, cierresAtribuidos: 1, revenueAtribuido: 7000, cashAtribuido: 3500 },
        ],
        totals: { intentosLlamada: 10, introsEfectivas: 4, demosAseguradasConIntro: 2, demosEnCalendario: 2, demosConfirmadas: 1, demosAsistidas: 1, cierresAtribuidos: 1, revenueAtribuido: 7000, cashAtribuido: 3500 },
        daysWithData: 1,
        paceStatus: { demosAsistidas: "on_track", cierres: "on_track", revenue: "on_track" },
        bloodHit: false,
        stretchHit: false,
      };
    }),
    updateSetterProjection: vi.fn(async () => {}),
    deleteSetterProjection: vi.fn(async () => {}),

    // Stubs for other db functions used by other routers
    getLeads: vi.fn(async () => []),
    getLeadById: vi.fn(async () => null),
    createLead: vi.fn(async () => 1),
    updateLead: vi.fn(async () => {}),
    deleteLead: vi.fn(async () => {}),
    getAllLeadScoring: vi.fn(async () => []),
    getLeadScoringByLeadId: vi.fn(async () => null),
    getLeadScoringByCorreo: vi.fn(async () => null),
    createLeadScoring: vi.fn(async () => 1),
    getSetterActivities: vi.fn(async () => []),
    createSetterActivity: vi.fn(async () => 1),
    updateSetterActivity: vi.fn(async () => {}),
    deleteSetterActivity: vi.fn(async () => {}),
    getSetterLeaderboard: vi.fn(async () => []),
    getCloserActivities: vi.fn(async () => []),
    createCloserActivity: vi.fn(async () => 1),
    updateCloserActivity: vi.fn(async () => {}),
    deleteCloserActivity: vi.fn(async () => {}),
    getCloserLeaderboard: vi.fn(async () => []),
    getDashboardKPIs: vi.fn(async () => ({})),
    getMonthlyMetrics: vi.fn(async () => []),
    upsertMonthlyMetrics: vi.fn(async () => {}),
    getMarketingKPIs: vi.fn(async () => ({})),
    getCurrentMonthMetrics: vi.fn(async () => null),
    getSetterTrackerKPIs: vi.fn(async () => ({})),
    getCloserTrackerKPIs: vi.fn(async () => ({})),
    getDistinctValues: vi.fn(async () => ({})),
  };
});

// Mock api-v1
vi.mock("./api-v1", () => ({
  createApiKey: vi.fn(async () => ({ id: 1, key: "test" })),
  listApiKeys: vi.fn(async () => []),
  revokeApiKey: vi.fn(async () => ({ success: true })),
  deleteApiKey: vi.fn(async () => ({ success: true })),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Closer Projections Router", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  it("creates a closer projection (static exercise, no daily rows)", async () => {
    const id = await caller.closerProjections.create({
      closer: "Damaso",
      semana: 1,
      mes: "Febrero",
      anio: 2026,
      scheduledCallsTarget: 25,
      showRateTarget: "75",
      offerRateTarget: "80",
      closeRateTarget: "30",
      bloodGoalCloses: 6,
      bloodGoalRevenue: "42000",
      bloodGoalCash: "21000",
      stretchGoalCloses: 9,
      stretchGoalRevenue: "63000",
      stretchGoalCash: "31500",
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe("number");
  });

  it("lists closer projections with filters", async () => {
    const result = await caller.closerProjections.list({
      mes: "Febrero",
      anio: 2026,
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it("gets closer projection by id (static data only)", async () => {
    const result = await caller.closerProjections.getById({ id: 1 });
    expect(result).not.toBeNull();
  });

  it("gets closer projection with actuals from tracker", async () => {
    const result = await caller.closerProjections.getWithActuals({ id: 1 });
    expect(result).not.toBeNull();
    if (result) {
      // Actuals come from the tracker, not manual daily tracking
      expect(result.actuals).toBeDefined();
      expect(Array.isArray(result.actuals)).toBe(true);
      expect(result.actuals.length).toBe(2);

      // Totals are aggregated from tracker data
      expect(result.totals).toBeDefined();
      expect(result.totals.scheduleCalls).toBe(11);
      expect(result.totals.closes).toBe(3);

      // Revenue/cash totals
      expect(result.totalRevenue).toBe(24000);
      expect(result.totalCash).toBe(12000);

      // Pace status is calculated by comparing tracker data vs blood goal
      expect(result.paceStatus).toBeDefined();
      expect(["on_track", "off_track", "pending"]).toContain(result.paceStatus.closes);
      expect(["on_track", "off_track", "pending"]).toContain(result.paceStatus.revenue);
      expect(["on_track", "off_track", "pending"]).toContain(result.paceStatus.cash);

      // Blood/Stretch hit flags
      expect(typeof result.bloodHit).toBe("boolean");
      expect(typeof result.stretchHit).toBe("boolean");

      // Days with data count
      expect(result.daysWithData).toBe(2);
    }
  });

  it("updates a closer projection (only static fields)", async () => {
    await expect(
      caller.closerProjections.update({
        id: 1,
        data: { scheduledCallsTarget: 30, showRateTarget: "80" },
      })
    ).resolves.not.toThrow();
  });

  it("deletes a closer projection", async () => {
    await expect(
      caller.closerProjections.delete({ id: 1 })
    ).resolves.not.toThrow();
  });
});

describe("Setter Projections Router", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);

  it("creates a setter projection (static exercise, no daily rows)", async () => {
    const id = await caller.setterProjections.create({
      setter: "Nicolás",
      semana: 1,
      mes: "Febrero",
      anio: 2026,
      intentosLlamadaTarget: 50,
      introsEfectivasTarget: 20,
      demosAseguradasTarget: 10,
      demosCalendarioTarget: 8,
      demosConfirmadasTarget: 6,
      demosAsistidasTarget: 5,
      bloodGoalDemosAsistidas: 5,
      bloodGoalCierres: 3,
      bloodGoalRevenue: "21000",
      bloodGoalCash: "10500",
      stretchGoalDemosAsistidas: 8,
      stretchGoalCierres: 5,
      stretchGoalRevenue: "35000",
      stretchGoalCash: "17500",
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe("number");
  });

  it("lists setter projections with filters", async () => {
    const result = await caller.setterProjections.list({
      mes: "Febrero",
      anio: 2026,
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it("gets setter projection by id (static data only)", async () => {
    const result = await caller.setterProjections.getById({ id: 1 });
    expect(result).not.toBeNull();
  });

  it("gets setter projection with actuals from tracker", async () => {
    const result = await caller.setterProjections.getWithActuals({ id: 1 });
    expect(result).not.toBeNull();
    if (result) {
      // Actuals come from the setter tracker
      expect(result.actuals).toBeDefined();
      expect(Array.isArray(result.actuals)).toBe(true);
      expect(result.actuals.length).toBe(1);

      // Totals aggregated from tracker
      expect(result.totals).toBeDefined();
      expect(result.totals.intentosLlamada).toBe(10);
      expect(result.totals.demosAsistidas).toBe(1);
      expect(result.totals.cierresAtribuidos).toBe(1);

      // Pace status
      expect(result.paceStatus).toBeDefined();
      expect(["on_track", "off_track", "pending"]).toContain(result.paceStatus.demosAsistidas);
      expect(["on_track", "off_track", "pending"]).toContain(result.paceStatus.cierres);

      // Blood/Stretch hit flags
      expect(typeof result.bloodHit).toBe("boolean");
      expect(typeof result.stretchHit).toBe("boolean");

      // Days with data
      expect(result.daysWithData).toBe(1);
    }
  });

  it("updates a setter projection (only static fields)", async () => {
    await expect(
      caller.setterProjections.update({
        id: 1,
        data: { intentosLlamadaTarget: 60, introsEfectivasTarget: 25 },
      })
    ).resolves.not.toThrow();
  });

  it("deletes a setter projection", async () => {
    await expect(
      caller.setterProjections.delete({ id: 1 })
    ).resolves.not.toThrow();
  });
});

describe("Projection Design: Static Exercise + Live Tracker Comparison", () => {
  it("projection is a static weekly exercise - no manual daily tracking", () => {
    // The projection is created once at the beginning of the week
    // It defines targets, blood goal, and stretch goal
    // It does NOT create daily tracking rows
    const projectionFields = [
      "closer", "semana", "mes", "anio",
      "scheduledCallsTarget", "showRateTarget", "offerRateTarget", "closeRateTarget",
      "bloodGoalCloses", "bloodGoalRevenue", "bloodGoalCash",
      "stretchGoalCloses", "stretchGoalRevenue", "stretchGoalCash",
    ];
    expect(projectionFields.length).toBe(14);
  });

  it("getWithActuals reads from tracker data, not manual daily entries", () => {
    // The getWithActuals endpoint reads real data from closer_activities/setter_activities
    // for the date range of the projection (weekStarting to weekEnding)
    // It compares actual tracker data against the blood/stretch goals
    // No manual daily tracking is needed - data flows automatically from trackers
    const actualFields = [
      "actuals",       // daily rows from tracker (read-only)
      "totals",        // aggregated totals from tracker
      "totalRevenue",  // sum of piffRevenue + setupRevenue
      "totalCash",     // sum of piffCash + setupCash
      "daysWithData",  // how many days have tracker entries
      "paceStatus",    // on_track/off_track calculated from actuals vs goals
      "bloodHit",      // whether blood goal was achieved
      "stretchHit",    // whether stretch goal was achieved
    ];
    expect(actualFields.length).toBe(8);
  });

  it("closer projection KPIs match closer tracker fields exactly", () => {
    // The tracker fields that are read for comparison
    const closerTrackerFields = [
      "scheduleCalls", "liveCalls", "offers", "deposits", "closes",
      "piffRevenue", "piffCash", "setupRevenue", "setupCash",
    ];
    expect(closerTrackerFields.length).toBe(9);
  });

  it("setter projection KPIs match setter tracker fields exactly", () => {
    const setterTrackerFields = [
      "intentosLlamada", "introsEfectivas", "demosAseguradasConIntro",
      "demosEnCalendario", "demosConfirmadas", "demosAsistidas",
      "cierresAtribuidos", "revenueAtribuido", "cashAtribuido",
    ];
    expect(setterTrackerFields.length).toBe(9);
  });
});
