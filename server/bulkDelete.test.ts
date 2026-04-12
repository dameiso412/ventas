import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  bulkDeleteLeads: vi.fn().mockResolvedValue(undefined),
  bulkDeleteSetterActivities: vi.fn().mockResolvedValue(undefined),
  bulkDeleteCloserActivities: vi.fn().mockResolvedValue(undefined),
  // Provide stubs for other db functions that may be imported
  getAllLeads: vi.fn().mockResolvedValue([]),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  getAllSetterActivities: vi.fn().mockResolvedValue([]),
  createSetterActivity: vi.fn(),
  updateSetterActivity: vi.fn(),
  deleteSetterActivity: vi.fn(),
  getAllCloserActivities: vi.fn().mockResolvedValue([]),
  createCloserActivity: vi.fn(),
  updateCloserActivity: vi.fn(),
  deleteCloserActivity: vi.fn(),
  getSetterLeaderboard: vi.fn().mockResolvedValue([]),
  getCloserLeaderboard: vi.fn().mockResolvedValue([]),
  getDashboardKPIs: vi.fn().mockResolvedValue({}),
  getTrackerKPIs: vi.fn().mockResolvedValue({}),
  getTeamSummary: vi.fn().mockResolvedValue([]),
  getAllLeadScoring: vi.fn().mockResolvedValue([]),
  createLeadScoring: vi.fn(),
  findLeadByContact: vi.fn(),
  getDistinctFilterValues: vi.fn().mockResolvedValue({}),
  getMonthlyMetrics: vi.fn().mockResolvedValue([]),
  upsertMonthlyMetrics: vi.fn(),
  getCloserProjections: vi.fn().mockResolvedValue([]),
  upsertCloserProjection: vi.fn(),
  deleteCloserProjection: vi.fn(),
  getAlertRules: vi.fn().mockResolvedValue([]),
  createAlertRule: vi.fn(),
  updateAlertRule: vi.fn(),
  deleteAlertRule: vi.fn(),
  getAlertHistory: vi.fn().mockResolvedValue([]),
  createAlertHistory: vi.fn(),
  getCallAudits: vi.fn().mockResolvedValue([]),
  createCallAudit: vi.fn(),
  updateCallAudit: vi.fn(),
  deleteCallAudit: vi.fn(),
  getAllFollowUps: vi.fn().mockResolvedValue([]),
  createFollowUp: vi.fn(),
  updateFollowUp: vi.fn(),
  deleteFollowUp: vi.fn(),
  getFollowUpStats: vi.fn().mockResolvedValue({ total: 0, hot: 0, warm: 0, overdue: 0, todayDue: 0, totalPipeline: 0 }),
  getFollowUpLogs: vi.fn().mockResolvedValue([]),
  createFollowUpLog: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

import * as db from "./db";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Bulk Delete Procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("leads.bulkDelete", () => {
    it("deletes multiple leads by IDs", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.leads.bulkDelete({ ids: [1, 2, 3] });

      expect(result).toEqual({ success: true, count: 3 });
      expect(db.bulkDeleteLeads).toHaveBeenCalledWith([1, 2, 3]);
      expect(db.bulkDeleteLeads).toHaveBeenCalledTimes(1);
    });

    it("works with a single ID", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.leads.bulkDelete({ ids: [42] });

      expect(result).toEqual({ success: true, count: 1 });
      expect(db.bulkDeleteLeads).toHaveBeenCalledWith([42]);
    });

    it("rejects empty array", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.leads.bulkDelete({ ids: [] })).rejects.toThrow();
    });
  });

  describe("setterActivities.bulkDelete", () => {
    it("deletes multiple setter activities by IDs", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.setterActivities.bulkDelete({ ids: [10, 20, 30] });

      expect(result).toEqual({ success: true, count: 3 });
      expect(db.bulkDeleteSetterActivities).toHaveBeenCalledWith([10, 20, 30]);
      expect(db.bulkDeleteSetterActivities).toHaveBeenCalledTimes(1);
    });

    it("works with a single ID", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.setterActivities.bulkDelete({ ids: [5] });

      expect(result).toEqual({ success: true, count: 1 });
      expect(db.bulkDeleteSetterActivities).toHaveBeenCalledWith([5]);
    });

    it("rejects empty array", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.setterActivities.bulkDelete({ ids: [] })).rejects.toThrow();
    });
  });

  describe("closerActivities.bulkDelete", () => {
    it("deletes multiple closer activities by IDs", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.closerActivities.bulkDelete({ ids: [100, 200] });

      expect(result).toEqual({ success: true, count: 2 });
      expect(db.bulkDeleteCloserActivities).toHaveBeenCalledWith([100, 200]);
      expect(db.bulkDeleteCloserActivities).toHaveBeenCalledTimes(1);
    });

    it("works with a single ID", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.closerActivities.bulkDelete({ ids: [99] });

      expect(result).toEqual({ success: true, count: 1 });
      expect(db.bulkDeleteCloserActivities).toHaveBeenCalledWith([99]);
    });

    it("rejects empty array", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.closerActivities.bulkDelete({ ids: [] })).rejects.toThrow();
    });
  });
});
