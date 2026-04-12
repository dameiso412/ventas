import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { webhookRouter } from "./webhook";

// Create a minimal Express app for testing the webhook endpoints
function createTestApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(webhookRouter);
  return app;
}

// ============================================================
// Webhook Lead Endpoint - Robustness Tests
// ============================================================
describe("Webhook Lead - Robustness", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  it("POST /api/webhook/lead returns 200 even with empty body", async () => {
    const res = await request(app)
      .post("/api/webhook/lead")
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    // Should create a lead even with no data (graceful handling)
    expect(res.body.leadId).toBeDefined();
  });

  it("POST /api/webhook/lead creates a new lead with GHL data", async () => {
    const uniqueEmail = `test-robustness-${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Test Robustness Lead",
        Correo: uniqueEmail,
        Telefono: "+529991234567",
        Fecha_Agenda: "2026-03-01T15:00:00Z",
        Link_CRM: "https://app.gohighlevel.com/test123",
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe("created");
    expect(res.body.leadId).toBeDefined();
    expect(typeof res.body.leadId).toBe("number");
  });

  it("POST /api/webhook/lead detects duplicate by email and updates date", async () => {
    const uniqueEmail = `test-dup-${Date.now()}@test.com`;

    // First call: create the lead
    const res1 = await request(app)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Duplicate Test Lead",
        Correo: uniqueEmail,
        Fecha_Agenda: "2026-03-01T15:00:00Z",
      })
      .expect(200);

    expect(res1.body.success).toBe(true);
    expect(res1.body.action).toBe("created");
    const originalLeadId = res1.body.leadId;

    // Second call: same email, different date (reschedule)
    const res2 = await request(app)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Duplicate Test Lead",
        Correo: uniqueEmail,
        Fecha_Agenda: "2026-03-05T18:00:00Z",
      })
      .expect(200);

    expect(res2.body.success).toBe(true);
    expect(res2.body.action).toBe("updated");
    expect(res2.body.leadId).toBe(originalLeadId);
    expect(res2.body.message).toContain("already existed");
  });

  it("POST /api/webhook/lead detects duplicate by phone", async () => {
    const uniquePhone = `+52999${Date.now().toString().slice(-7)}`;

    // First call
    const res1 = await request(app)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Phone Dup Test",
        Telefono: uniquePhone,
        Fecha_Agenda: "2026-03-01T15:00:00Z",
      })
      .expect(200);

    expect(res1.body.action).toBe("created");
    const originalLeadId = res1.body.leadId;

    // Second call: same phone
    const res2 = await request(app)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Phone Dup Test",
        Telefono: uniquePhone,
        Fecha_Agenda: "2026-03-10T20:00:00Z",
      })
      .expect(200);

    expect(res2.body.action).toBe("updated");
    expect(res2.body.leadId).toBe(originalLeadId);
  });

  it("POST /api/webhook/lead handles customData nesting from GHL", async () => {
    const uniqueEmail = `test-custom-${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/webhook/lead")
      .send({
        full_name: "Custom Data Test",
        email: uniqueEmail,
        phone: "+529998887766",
        customData: {
          "Link_CRM": "https://app.gohighlevel.com/custom",
          "Fecha_Agenda": "2026-03-15T14:00:00Z",
        },
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.action).toBe("created");
  });

  it("POST /api/webhook/lead never returns 500", async () => {
    // Even with malformed data, should return 200
    const res = await request(app)
      .post("/api/webhook/lead")
      .send("this is not json")
      .set("Content-Type", "text/plain")
      .expect(200);

    // The body parser may reject this, but Express should still handle it
    // The key point is we never get a 500
    expect(res.status).toBeLessThan(500);
  });

  it("POST /api/webhook/lead handles invalid date gracefully", async () => {
    const uniqueEmail = `test-baddate-${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Bad Date Test",
        Correo: uniqueEmail,
        Fecha_Agenda: "not-a-valid-date",
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    // Should fall back to current date
    expect(res.body.leadId).toBeDefined();
  });

  it("POST /api/webhook/lead response includes action field", async () => {
    const uniqueEmail = `test-action-${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Action Field Test",
        Correo: uniqueEmail,
      })
      .expect(200);

    expect(res.body.action).toBeDefined();
    expect(["created", "updated"]).toContain(res.body.action);
  });
});

// ============================================================
// Webhook Score Endpoint - Robustness Tests
// ============================================================
describe("Webhook Score - Robustness", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  it("POST /api/webhook/score returns 200 with valid data", async () => {
    const uniqueEmail = `test-score-${Date.now()}@test.com`;
    const res = await request(app)
      .post("/api/webhook/score")
      .send({
        correo: uniqueEmail,
        nombre: "Score Test Lead",
        score_override: "3",
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.leadId).toBeDefined();
  });

  it("POST /api/webhook/score never returns 500 on error", async () => {
    // Send empty body - should handle gracefully
    const res = await request(app)
      .post("/api/webhook/score")
      .send({})
      .expect(200);

    // Even if it fails, should return 200
    expect(res.status).toBeLessThan(500);
  });
});

// ============================================================
// Webhook Health Check Tests
// ============================================================
describe("Webhook Health Check", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  it("GET /api/webhook/health returns status and endpoints", async () => {
    const res = await request(app)
      .get("/api/webhook/health")
      .expect(200);

    expect(res.body.status).toBeDefined();
    expect(["ok", "degraded"]).toContain(res.body.status);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.endpoints).toBeDefined();
    expect(Array.isArray(res.body.endpoints)).toBe(true);
    expect(res.body.endpoints).toContain("/api/webhook/lead");
    expect(res.body.endpoints).toContain("/api/webhook/score");
    expect(res.body.endpoints).toContain("/api/webhook/call-audit");
  });

  it("GET /api/webhook/health includes database status", async () => {
    const res = await request(app)
      .get("/api/webhook/health")
      .expect(200);

    expect(res.body.database).toBeDefined();
    expect(["connected", "disconnected", "error"]).toContain(res.body.database);
  });
});

// ============================================================
// Webhook Logs Endpoint Tests
// ============================================================
describe("Webhook Logs", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  it("GET /api/webhook/logs returns array of logs", async () => {
    const res = await request(app)
      .get("/api/webhook/logs")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.count).toBeDefined();
  });

  it("GET /api/webhook/logs respects limit parameter", async () => {
    const res = await request(app)
      .get("/api/webhook/logs?limit=5")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.logs.length).toBeLessThanOrEqual(5);
  });

  it("GET /api/webhook/logs caps limit at 200", async () => {
    const res = await request(app)
      .get("/api/webhook/logs?limit=999")
      .expect(200);

    expect(res.body.success).toBe(true);
    // Should not return more than 200
    expect(res.body.logs.length).toBeLessThanOrEqual(200);
  });
});

// ============================================================
// Call Audit Webhook - Ping Tests
// ============================================================
describe("Webhook Call Audit - Connectivity", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  it("GET /api/webhook/call-audit/ping returns ok", async () => {
    const res = await request(app)
      .get("/api/webhook/call-audit/ping")
      .expect(200);

    expect(res.body.status).toBe("ok");
    expect(res.body.endpoint).toBe("call-audit");
    expect(res.body.timestamp).toBeDefined();
  });

  it("OPTIONS /api/webhook/call-audit returns CORS headers", async () => {
    const res = await request(app)
      .options("/api/webhook/call-audit")
      .expect(204);

    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });
});
