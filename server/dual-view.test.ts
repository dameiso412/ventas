import { describe, it, expect } from "vitest";
import supertest from "supertest";

const BASE = "http://localhost:3000";

describe("Dual View: Agendas + Dinero Gratis (Leads)", () => {
  let prospectLeadId: number;
  let agendaLeadId: number;

  // 1. Create a prospect via the new webhook
  it("should create a prospect via /api/webhook/prospect", async () => {
    const res = await supertest(BASE)
      .post("/api/webhook/prospect")
      .send({
        Nombre: "Test Prospect DualView",
        Correo: `prospect-dv-${Date.now()}@test.com`,
        Telefono: `+55${Date.now().toString().slice(-8)}`,
        Origen: "ADS",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.leadId).toBeGreaterThan(0);
    prospectLeadId = res.body.leadId;
  });

  // 2. Create an agenda via the existing webhook
  it("should create an agenda via /api/webhook/lead", async () => {
    const res = await supertest(BASE)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Test Agenda DualView",
        Correo: `agenda-dv-${Date.now()}@test.com`,
        Telefono: `+55${Date.now().toString().slice(-8)}`,
        Fecha_Agenda: "2026-03-03T15:00:00Z",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    agendaLeadId = res.body.leadId;
  });

  // 3. Verify prospect has categoria=LEAD
  it("should have categoria LEAD for prospect", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leads.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: prospectLeadId } }))}`);
    expect(res.status).toBe(200);
    const lead = res.body.result?.data?.json;
    expect(lead).toBeTruthy();
    expect(lead.categoria).toBe("LEAD");
    expect(lead.estadoLead).toBe("NUEVO");
  });

  // 4. Verify agenda has categoria=AGENDA
  it("should have categoria AGENDA for agenda lead", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leads.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: agendaLeadId } }))}`);
    expect(res.status).toBe(200);
    const lead = res.body.result?.data?.json;
    expect(lead).toBeTruthy();
    expect(lead.categoria).toBe("AGENDA");
  });

  // 5. Filter by categoria=LEAD should return prospect but not agenda
  it("should filter leads by categoria LEAD", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leads.list?input=${encodeURIComponent(JSON.stringify({ json: { categoria: "LEAD" } }))}`);
    expect(res.status).toBe(200);
    const leads = res.body.result?.data?.json;
    expect(Array.isArray(leads)).toBe(true);
    const prospectFound = leads.some((l: any) => l.id === prospectLeadId);
    const agendaFound = leads.some((l: any) => l.id === agendaLeadId);
    expect(prospectFound).toBe(true);
    expect(agendaFound).toBe(false);
  });

  // 6. Filter by categoria=AGENDA should return agenda but not prospect
  it("should filter leads by categoria AGENDA", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leads.list?input=${encodeURIComponent(JSON.stringify({ json: { categoria: "AGENDA" } }))}`);
    expect(res.status).toBe(200);
    const leads = res.body.result?.data?.json;
    expect(Array.isArray(leads)).toBe(true);
    const agendaFound = leads.some((l: any) => l.id === agendaLeadId);
    const prospectFound = leads.some((l: any) => l.id === prospectLeadId);
    expect(agendaFound).toBe(true);
    expect(prospectFound).toBe(false);
  });

  // 7. Filter by estadoLead should work
  it("should filter leads by estadoLead NUEVO", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leads.list?input=${encodeURIComponent(JSON.stringify({ json: { categoria: "LEAD", estadoLead: "NUEVO" } }))}`);
    expect(res.status).toBe(200);
    const leads = res.body.result?.data?.json;
    expect(Array.isArray(leads)).toBe(true);
    const found = leads.some((l: any) => l.id === prospectLeadId);
    expect(found).toBe(true);
  });

  // 8. Convert prospect to agenda
  it("should convert a prospect to agenda via update", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/leads.update")
      .set("Content-Type", "application/json")
      .send({
        json: {
          id: prospectLeadId,
          data: {
            categoria: "AGENDA",
            estadoLead: "CONVERTIDO_AGENDA",
          },
        },
      });
    expect(res.status).toBe(200);
  });

  // 9. Verify converted prospect now has categoria=AGENDA
  it("should have categoria AGENDA after conversion", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leads.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: prospectLeadId } }))}`);
    expect(res.status).toBe(200);
    const lead = res.body.result?.data?.json;
    expect(lead.categoria).toBe("AGENDA");
    expect(lead.estadoLead).toBe("CONVERTIDO_AGENDA");
  });

  // 10. Prospect webhook should handle duplicate by correo
  it("should handle duplicate prospect by correo", async () => {
    const correo = `prospect-dup-${Date.now()}@test.com`;
    // First create
    const res1 = await supertest(BASE)
      .post("/api/webhook/prospect")
      .send({ Nombre: "Dup Prospect 1", Correo: correo, Telefono: "+5500000001" });
    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);

    // Second create with same correo
    const res2 = await supertest(BASE)
      .post("/api/webhook/prospect")
      .send({ Nombre: "Dup Prospect 2", Correo: correo, Telefono: "+5500000002" });
    expect(res2.status).toBe(200);
    // Should succeed (either as new or updated)
  });

  // 11. Prospect webhook health check
  it("should return health status for prospect webhook", async () => {
    const res = await supertest(BASE).get("/api/webhook/health");
    expect(res.status).toBe(200);
    expect(res.body.endpoints).toContain("/api/webhook/prospect");
  });

  // Cleanup: delete test leads
  it("should cleanup test leads", async () => {
    if (prospectLeadId) {
      await supertest(BASE)
        .post("/api/trpc/leads.delete")
        .set("Content-Type", "application/json")
        .send({ json: { id: prospectLeadId } });
    }
    if (agendaLeadId) {
      await supertest(BASE)
        .post("/api/trpc/leads.delete")
        .set("Content-Type", "application/json")
        .send({ json: { id: agendaLeadId } });
    }
  });
});
