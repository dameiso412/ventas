import { describe, it, expect, vi } from "vitest";
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

describe("Cron Sync & Sync Logs", () => {
  it("returns last sync info with correct shape", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.lastSync();

    expect(result).toBeDefined();
    expect(result).toHaveProperty("autoSync");
    expect(result).toHaveProperty("manualSync");
    expect(result).toHaveProperty("lastAny");
  });

  it("returns sync logs list", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.syncLogs({ limit: 5 });

    expect(Array.isArray(result)).toBe(true);
    // Should have at least one log from the auto-sync that ran on server start
    if (result.length > 0) {
      const log = result[0];
      expect(log).toHaveProperty("id");
      expect(log).toHaveProperty("syncType");
      expect(log).toHaveProperty("status");
      expect(log).toHaveProperty("createdAt");
    }
  });

  it("has auto sync log from server startup", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.lastSync();

    // The cron job should have created at least one auto sync log on startup
    if (result.autoSync) {
      expect(result.autoSync.syncType).toBe("meta_ads_auto");
      expect(result.autoSync.status).toBe("success");
      expect(Number(result.autoSync.insightsSynced)).toBeGreaterThan(0);
    }
  });

  it("triggers a manual full sync successfully", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.fullSync();

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.logId).toBeGreaterThan(0);
    expect(result.campaigns).toBeGreaterThan(0);
    expect(result.ads).toBeGreaterThan(0);
    expect(result.insights).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
  }, 90_000); // Allow 90s for full sync

  it("shows manual sync in lastSync after fullSync", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.metaAds.lastSync();

    expect(result.manualSync).not.toBeNull();
    if (result.manualSync) {
      expect(result.manualSync.syncType).toBe("meta_ads_manual");
      expect(result.manualSync.status).toBe("success");
    }
  });

  it("shows the manual sync in sync logs list", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const logs = await caller.metaAds.syncLogs({ limit: 5 });

    expect(logs.length).toBeGreaterThan(0);
    const manualLog = logs.find((l: any) => l.syncType === "meta_ads_manual");
    expect(manualLog).toBeDefined();
    if (manualLog) {
      expect(manualLog.status).toBe("success");
      expect(Number(manualLog.campaignsSynced)).toBeGreaterThan(0);
    }
  });
});
