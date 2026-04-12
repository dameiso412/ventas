import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { hasAccess, getAccessibleRoutes, ROLE_LABELS } from "../shared/permissions";

// ==================== Helper Factories ====================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(role: string, email?: string): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: email || "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
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

// ==================== Shared Permissions Tests ====================

describe("shared/permissions - hasAccess", () => {
  it("admin has access to all routes", () => {
    expect(hasAccess("admin", "/")).toBe(true);
    expect(hasAccess("admin", "/cola-trabajo")).toBe(true);
    expect(hasAccess("admin", "/closer-tracker")).toBe(true);
    expect(hasAccess("admin", "/diagnostico")).toBe(true);
    expect(hasAccess("admin", "/accesos")).toBe(true);
    expect(hasAccess("admin", "/webhook")).toBe(true);
    expect(hasAccess("admin", "/api")).toBe(true);
  });

  it("setter can access setter pages", () => {
    expect(hasAccess("setter", "/")).toBe(true);
    expect(hasAccess("setter", "/cola-trabajo")).toBe(true);
    expect(hasAccess("setter", "/confirmaciones")).toBe(true);
    expect(hasAccess("setter", "/citas")).toBe(true);
    expect(hasAccess("setter", "/setter-tracker")).toBe(true);
    expect(hasAccess("setter", "/scoring")).toBe(true);
    expect(hasAccess("setter", "/leaderboards")).toBe(true);
    expect(hasAccess("setter", "/follow-ups")).toBe(true);
    expect(hasAccess("setter", "/equipo")).toBe(true);
  });

  it("setter cannot access admin-only or closer-only pages", () => {
    expect(hasAccess("setter", "/closer-tracker")).toBe(false);
    expect(hasAccess("setter", "/team-summary")).toBe(false);
    expect(hasAccess("setter", "/diagnostico")).toBe(false);
    expect(hasAccess("setter", "/atribucion")).toBe(false);
    expect(hasAccess("setter", "/webhook")).toBe(false);
    expect(hasAccess("setter", "/api")).toBe(false);
    expect(hasAccess("setter", "/accesos")).toBe(false);
    expect(hasAccess("setter", "/proyecciones")).toBe(false);
    expect(hasAccess("setter", "/auditoria")).toBe(false);
  });

  it("closer can access closer pages", () => {
    expect(hasAccess("closer", "/")).toBe(true);
    expect(hasAccess("closer", "/citas")).toBe(true);
    expect(hasAccess("closer", "/closer-tracker")).toBe(true);
    expect(hasAccess("closer", "/scoring")).toBe(true);
    expect(hasAccess("closer", "/leaderboards")).toBe(true);
    expect(hasAccess("closer", "/proyecciones")).toBe(true);
    expect(hasAccess("closer", "/auditoria")).toBe(true);
    expect(hasAccess("closer", "/follow-ups")).toBe(true);
    expect(hasAccess("closer", "/equipo")).toBe(true);
  });

  it("closer cannot access admin-only or setter-only pages", () => {
    expect(hasAccess("closer", "/cola-trabajo")).toBe(false);
    expect(hasAccess("closer", "/confirmaciones")).toBe(false);
    expect(hasAccess("closer", "/setter-tracker")).toBe(false);
    expect(hasAccess("closer", "/team-summary")).toBe(false);
    expect(hasAccess("closer", "/diagnostico")).toBe(false);
    expect(hasAccess("closer", "/atribucion")).toBe(false);
    expect(hasAccess("closer", "/webhook")).toBe(false);
    expect(hasAccess("closer", "/api")).toBe(false);
    expect(hasAccess("closer", "/accesos")).toBe(false);
  });

  it("handles dynamic routes correctly", () => {
    expect(hasAccess("setter", "/rep-profile/setter/Juan")).toBe(true);
    expect(hasAccess("closer", "/rep-profile/closer/Maria")).toBe(true);
    expect(hasAccess("closer", "/auditoria/123")).toBe(true);
    expect(hasAccess("setter", "/auditoria/123")).toBe(false);
  });

  it("unlisted routes are accessible by all CRM roles", () => {
    expect(hasAccess("setter", "/some-unknown-route")).toBe(true);
    expect(hasAccess("closer", "/some-unknown-route")).toBe(true);
  });
});

describe("shared/permissions - getAccessibleRoutes", () => {
  it("admin gets all routes", () => {
    const routes = getAccessibleRoutes("admin");
    expect(routes.length).toBeGreaterThan(15);
  });

  it("setter gets fewer routes than admin", () => {
    const adminRoutes = getAccessibleRoutes("admin");
    const setterRoutes = getAccessibleRoutes("setter");
    expect(setterRoutes.length).toBeLessThan(adminRoutes.length);
    expect(setterRoutes.length).toBeGreaterThan(5);
  });

  it("closer gets fewer routes than admin", () => {
    const adminRoutes = getAccessibleRoutes("admin");
    const closerRoutes = getAccessibleRoutes("closer");
    expect(closerRoutes.length).toBeLessThan(adminRoutes.length);
    expect(closerRoutes.length).toBeGreaterThan(5);
  });
});

describe("shared/permissions - ROLE_LABELS", () => {
  it("has labels for all CRM roles", () => {
    expect(ROLE_LABELS.admin).toBe("Administrador");
    expect(ROLE_LABELS.setter).toBe("Setter");
    expect(ROLE_LABELS.closer).toBe("Closer");
  });
});

// ==================== tRPC Access Control Procedures Tests ====================

describe("access.checkAccess", () => {
  it("returns hasAccess=true for admin", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.access.checkAccess();
    expect(result.hasAccess).toBe(true);
    expect(result.role).toBe("admin");
  });

  it("returns hasAccess=true for setter", async () => {
    const ctx = createContext("setter");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.access.checkAccess();
    expect(result.hasAccess).toBe(true);
    expect(result.role).toBe("setter");
  });

  it("returns hasAccess=true for closer", async () => {
    const ctx = createContext("closer");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.access.checkAccess();
    expect(result.hasAccess).toBe(true);
    expect(result.role).toBe("closer");
  });

  it("returns hasAccess=false for regular user role", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.access.checkAccess();
    expect(result.hasAccess).toBe(false);
    expect(result.role).toBe("user");
  });

  it("returns hasAccess=false for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.access.checkAccess();
    expect(result.hasAccess).toBe(false);
    expect(result.role).toBeNull();
  });
});

describe("access.listAllowed - admin protection", () => {
  it("admin can list allowed emails", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    // This should not throw (it queries the DB, but the procedure itself should be accessible)
    await expect(caller.access.listAllowed()).resolves.toBeDefined();
  });

  it("setter cannot list allowed emails", async () => {
    const ctx = createContext("setter");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.access.listAllowed()).rejects.toThrow();
  });

  it("closer cannot list allowed emails", async () => {
    const ctx = createContext("closer");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.access.listAllowed()).rejects.toThrow();
  });

  it("regular user cannot list allowed emails", async () => {
    const ctx = createContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.access.listAllowed()).rejects.toThrow();
  });

  it("unauthenticated user cannot list allowed emails", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.access.listAllowed()).rejects.toThrow();
  });
});

describe("access.listUsers - admin protection", () => {
  it("admin can list users", async () => {
    const ctx = createContext("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.access.listUsers()).resolves.toBeDefined();
  });

  it("setter cannot list users", async () => {
    const ctx = createContext("setter");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.access.listUsers()).rejects.toThrow();
  });
});

describe("access.createAllowed - admin protection", () => {
  it("setter cannot create allowed emails", async () => {
    const ctx = createContext("setter");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.access.createAllowed({ email: "test@test.com", role: "setter" })
    ).rejects.toThrow();
  });

  it("closer cannot create allowed emails", async () => {
    const ctx = createContext("closer");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.access.createAllowed({ email: "test@test.com", role: "closer" })
    ).rejects.toThrow();
  });
});

describe("access.deleteAllowed - admin protection", () => {
  it("setter cannot delete allowed emails", async () => {
    const ctx = createContext("setter");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.access.deleteAllowed({ id: 1 })
    ).rejects.toThrow();
  });
});
