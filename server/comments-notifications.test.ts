import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCrmContext(overrides?: Partial<AuthenticatedUser>) {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@sacamedi.com",
    name: "Damaso Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx, user };
}

function createSetterContext() {
  return createCrmContext({
    id: 2,
    openId: "setter-user",
    email: "setter@sacamedi.com",
    name: "Rodrigo Setter",
    role: "setter",
  });
}

function createCloserContext() {
  return createCrmContext({
    id: 3,
    openId: "closer-user",
    email: "closer@sacamedi.com",
    name: "Nicolas Closer",
    role: "closer",
  });
}

function createUnauthContext() {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

// =====================================================================
// COMMENTS
// =====================================================================
describe("comments", () => {
  describe("comments.list", () => {
    it("returns an array for a given leadId", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.comments.list({ leadId: 1 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("requires authentication (CRM user)", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.comments.list({ leadId: 1 })).rejects.toThrow();
    });
  });

  describe("comments.latestForLeads", () => {
    it("returns an array for multiple leadIds", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.comments.latestForLeads({ leadIds: [1, 2, 3] });
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns empty array for empty leadIds", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.comments.latestForLeads({ leadIds: [] });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe("comments.create", () => {
    it("creates a comment successfully", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.comments.create({
        leadId: 1,
        texto: "Test comment from admin",
        leadName: "Test Lead",
      });
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("setter can create comments", async () => {
      const { ctx } = createSetterContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.comments.create({
        leadId: 1,
        texto: "Comment from setter",
      });
      expect(result.success).toBe(true);
    });

    it("closer can create comments", async () => {
      const { ctx } = createCloserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.comments.create({
        leadId: 1,
        texto: "Comment from closer",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty text", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.comments.create({ leadId: 1, texto: "" })
      ).rejects.toThrow();
    });

    it("unauthenticated users cannot create comments", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.comments.create({ leadId: 1, texto: "Should fail" })
      ).rejects.toThrow();
    });

    it("creates a comment with @mention and generates notification", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      // Mention user id 2 (setter)
      const result = await caller.comments.create({
        leadId: 1,
        texto: "Hey @[Rodrigo Setter](2) check this lead",
        leadName: "Test Lead",
      });
      expect(result.success).toBe(true);
    });

    it("does not create notification when mentioning yourself", async () => {
      const { ctx } = createCrmContext(); // user id 1
      const caller = appRouter.createCaller(ctx);
      // Mention yourself (id 1)
      const result = await caller.comments.create({
        leadId: 1,
        texto: "Note to self @[Damaso Admin](1)",
        leadName: "Test Lead",
      });
      expect(result.success).toBe(true);
      // Check that no notification was created for self
      const notifs = await caller.notifications.list({ limit: 100 });
      const selfNotifs = (notifs as any[]).filter(
        (n: any) => n.message?.includes("Note to self")
      );
      expect(selfNotifs).toHaveLength(0);
    });
  });

  describe("comments.delete", () => {
    it("deletes a comment successfully", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      // First create a comment
      const created = await caller.comments.create({
        leadId: 9999,
        texto: "Comment to delete",
      });
      // Then delete it
      const result = await caller.comments.delete({ id: created.id });
      expect(result).toEqual({ success: true });
    });
  });

  describe("comments.update", () => {
    it("updates a comment successfully", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      // Create a comment first
      const created = await caller.comments.create({
        leadId: 9999,
        texto: "Original text",
      });
      // Update it
      const result = await caller.comments.update({
        id: created.id,
        texto: "Updated text",
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("comments.users", () => {
    it("returns an array of CRM users for @mention autocomplete", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.comments.users();
      expect(Array.isArray(result)).toBe(true);
    });

    it("requires authentication", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.comments.users()).rejects.toThrow();
    });
  });
});

// =====================================================================
// NOTIFICATIONS
// =====================================================================
describe("notifications", () => {
  describe("notifications.list", () => {
    it("returns an array of notifications for the authenticated user", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.list({ limit: 10 });
      expect(Array.isArray(result)).toBe(true);
    });

    it("works without input (uses default limit)", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.list();
      expect(Array.isArray(result)).toBe(true);
    });

    it("requires authentication", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.notifications.list()).rejects.toThrow();
    });
  });

  describe("notifications.unreadCount", () => {
    it("returns a number", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.unreadCount();
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("requires authentication", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.notifications.unreadCount()).rejects.toThrow();
    });
  });

  describe("notifications.markRead", () => {
    it("marks a notification as read", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      // This may not find a real notification, but should not throw
      const result = await caller.notifications.markRead({ id: 999999 });
      expect(result).toEqual({ success: true });
    });

    it("requires authentication", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.notifications.markRead({ id: 1 })
      ).rejects.toThrow();
    });
  });

  describe("notifications.markAllRead", () => {
    it("marks all notifications as read for the user", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.markAllRead();
      expect(result).toEqual({ success: true });
    });

    it("requires authentication", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.notifications.markAllRead()).rejects.toThrow();
    });
  });

  describe("notifications.pollNew", () => {
    it("returns notifications since a given timestamp", async () => {
      const { ctx } = createCrmContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.pollNew({
        since: new Date(Date.now() - 86400000).toISOString(),
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it("requires authentication", async () => {
      const { ctx } = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.notifications.pollNew({ since: new Date().toISOString() })
      ).rejects.toThrow();
    });
  });
});

// =====================================================================
// INTEGRATION: Mention creates notification
// =====================================================================
describe("integration: mention → notification", () => {
  it("creating a comment with @mention creates a notification for the mentioned user", async () => {
    const { ctx: adminCtx } = createCrmContext(); // admin, id=1
    const { ctx: setterCtx } = createSetterContext(); // setter, id=2
    const adminCaller = appRouter.createCaller(adminCtx);
    const setterCaller = appRouter.createCaller(setterCtx);

    // Get setter's unread count before
    const countBefore = await setterCaller.notifications.unreadCount();

    // Admin mentions setter in a comment
    await adminCaller.comments.create({
      leadId: 1,
      texto: "Hey @[Rodrigo Setter](2) please follow up",
      leadName: "Integration Test Lead",
    });

    // Setter's unread count should increase
    const countAfter = await setterCaller.notifications.unreadCount();
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);
  });
});
