import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCrmContext(overrides?: Partial<AuthenticatedUser>) {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@sacamedi.com",
    name: "Damaso",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };

  return { ctx, user };
}

describe("Lead Comments (ClickUp-style)", () => {
  let testLeadId: number;
  let firstCommentId: number;

  // Create a test lead first via webhook
  it("should create a test lead for comments", async () => {
    const supertest = (await import("supertest")).default;
    const BASE = "http://localhost:3000";
    const res = await supertest(BASE)
      .post("/api/webhook/lead")
      .send({
        nombre: "Test Comments Lead v2",
        correo: `test-comments-v2-${Date.now()}@test.com`,
        telefono: `+1${Date.now()}`,
        fecha: new Date().toISOString(),
        mes: "Marzo",
        semana: 1,
        origen: "ADS",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    testLeadId = res.body.leadId;
    expect(testLeadId).toBeGreaterThan(0);
  });

  it("should list empty comments for a new lead", async () => {
    const { ctx } = createCrmContext();
    const caller = appRouter.createCaller(ctx);
    const data = await caller.comments.list({ leadId: testLeadId });
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it("should create a comment with user profile", async () => {
    const { ctx } = createCrmContext({
      id: 2,
      name: "Josefa",
      role: "setter",
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.comments.create({
      leadId: testLeadId,
      texto: "Lead contestó, parece interesado en el servicio",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBeGreaterThan(0);
    firstCommentId = result.id;
  });

  it("should create a second comment from a different user", async () => {
    const { ctx } = createCrmContext({
      id: 3,
      name: "Nicolas",
      role: "closer",
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.comments.create({
      leadId: testLeadId,
      texto: "Agendé demo para el jueves a las 3pm",
    });
    expect(result.success).toBe(true);
  });

  it("should list 2 comments with author info", async () => {
    const { ctx } = createCrmContext();
    const caller = appRouter.createCaller(ctx);
    const data = await caller.comments.list({ leadId: testLeadId });
    expect(data).toHaveLength(2);
    const autores = data.map((c: any) => c.autor);
    expect(autores).toContain("Nicolas");
    expect(autores).toContain("Josefa");
    // Check that autorRole is included
    const roles = data.map((c: any) => c.autorRole);
    expect(roles).toContain("setter");
    expect(roles).toContain("closer");
  });

  it("should return latest comment for batch of leadIds", async () => {
    const { ctx } = createCrmContext();
    const caller = appRouter.createCaller(ctx);
    const data = await caller.comments.latestForLeads({ leadIds: [testLeadId] });
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].leadId).toBe(testLeadId);
  });

  it("should return empty array for empty leadIds", async () => {
    const { ctx } = createCrmContext();
    const caller = appRouter.createCaller(ctx);
    const data = await caller.comments.latestForLeads({ leadIds: [] });
    expect(data).toHaveLength(0);
  });

  it("should delete a comment", async () => {
    const { ctx } = createCrmContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.comments.delete({ id: firstCommentId });
    expect(result).toEqual({ success: true });
  });

  it("should have 1 comment after deletion", async () => {
    const { ctx } = createCrmContext();
    const caller = appRouter.createCaller(ctx);
    const data = await caller.comments.list({ leadId: testLeadId });
    expect(data).toHaveLength(1);
    expect((data[0] as any).autor).toBe("Nicolas");
  });

  it("should create a third comment from admin", async () => {
    const { ctx } = createCrmContext(); // admin, name="Damaso"
    const caller = appRouter.createCaller(ctx);
    const result = await caller.comments.create({
      leadId: testLeadId,
      texto: "Revisar si califica financieramente antes de la demo",
    });
    expect(result.success).toBe(true);
  });

  it("should show Damaso's comment as latest", async () => {
    const { ctx } = createCrmContext();
    const caller = appRouter.createCaller(ctx);
    const data = await caller.comments.latestForLeads({ leadIds: [testLeadId] });
    expect((data[0] as any).autor).toBe("Damaso");
    expect((data[0] as any).texto).toBe("Revisar si califica financieramente antes de la demo");
  });

  // Cleanup
  it("should clean up test lead", async () => {
    const { ctx } = createCrmContext();
    const caller = appRouter.createCaller(ctx);
    await caller.leads.delete({ id: testLeadId });
  });
});
