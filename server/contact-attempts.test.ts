import { describe, it, expect } from "vitest";
import supertest from "supertest";

const BASE = "http://localhost:3000";

describe("Contact Attempts & Financial Qualification", () => {
  let testLeadId: number;

  // Create a test lead first
  it("should create a test lead for contact attempts", async () => {
    const res = await supertest(BASE)
      .post("/api/webhook/lead")
      .send({
        nombre: "Test ContactAttempts Lead",
        correo: "test-attempts@test.com",
        telefono: "+1234567890",
        fecha: new Date().toISOString(),
        mes: "Febrero",
        semana: 4,
        origen: "ADS",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    testLeadId = res.body.leadId;
    expect(testLeadId).toBeGreaterThan(0);
  });

  // Contact Attempts CRUD
  it("should list empty contact attempts for a new lead", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.list?input=${encodeURIComponent(JSON.stringify({ json: { leadId: testLeadId } }))}`);
    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it("should create a contact attempt (LLAMADA)", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/contactAttempts.create")
      .set("Content-Type", "application/json")
      .send({
        json: {
          leadId: testLeadId,
          timestamp: new Date().toISOString(),
          canal: "LLAMADA",
          resultado: "NO CONTESTÓ",
          notas: "Buzón de voz",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.result?.data?.json?.success).toBe(true);
  });

  it("should create a second attempt (WHATSAPP)", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/contactAttempts.create")
      .set("Content-Type", "application/json")
      .send({
        json: {
          leadId: testLeadId,
          timestamp: new Date().toISOString(),
          canal: "WHATSAPP",
          resultado: "MENSAJE ENVIADO",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.result?.data?.json?.success).toBe(true);
  });

  it("should list 2 contact attempts", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.list?input=${encodeURIComponent(JSON.stringify({ json: { leadId: testLeadId } }))}`);
    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    expect(data.length).toBe(2);
    expect(data[0].canal).toBe("LLAMADA");
    expect(data[0].resultado).toBe("NO CONTESTÓ");
    expect(data[1].canal).toBe("WHATSAPP");
  });

  it("should create a third attempt (CONTESTÓ)", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/contactAttempts.create")
      .set("Content-Type", "application/json")
      .send({
        json: {
          leadId: testLeadId,
          timestamp: new Date().toISOString(),
          canal: "LLAMADA",
          resultado: "CONTESTÓ",
          notas: "Lead contestó, se agendó demo",
        },
      });
    expect(res.status).toBe(200);
  });

  it("should list 3 contact attempts now", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.list?input=${encodeURIComponent(JSON.stringify({ json: { leadId: testLeadId } }))}`);
    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    expect(data.length).toBe(3);
  });

  it("should delete a contact attempt", async () => {
    // Get the list first
    const listRes = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.list?input=${encodeURIComponent(JSON.stringify({ json: { leadId: testLeadId } }))}`);
    const attempts = listRes.body.result?.data?.json;
    const idToDelete = attempts[0].id;

    const res = await supertest(BASE)
      .post("/api/trpc/contactAttempts.delete")
      .set("Content-Type", "application/json")
      .send({ json: { id: idToDelete } });
    expect(res.status).toBe(200);
  });

  it("should have 2 attempts after deletion", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.list?input=${encodeURIComponent(JSON.stringify({ json: { leadId: testLeadId } }))}`);
    const data = res.body.result?.data?.json;
    expect(data.length).toBe(2);
  });

  // Financial Qualification
  it("should update lead with financial qualification fields", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/leads.update")
      .set("Content-Type", "application/json")
      .send({
        json: {
          id: testLeadId,
          data: {
            calificacionFinanciera: "SÍ",
            respuestaFinanciera: "Tiene presupuesto de $5,000 disponible inmediatamente",
            triage: "COMPLETADO",
          },
        },
      });
    expect(res.status).toBe(200);
  });

  it("should update lead with PARCIAL financial qualification", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/leads.update")
      .set("Content-Type", "application/json")
      .send({
        json: {
          id: testLeadId,
          data: {
            calificacionFinanciera: "PARCIAL",
            respuestaFinanciera: "Puede invertir en 2 meses, ahora solo tiene $2,000",
          },
        },
      });
    expect(res.status).toBe(200);
  });

  // Leads needing attention (48h alert)
  it("should query leads needing attention endpoint", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leadsAlert.needingAttention?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`);
    expect(res.status).toBe(200);
    // The test lead should NOT be in the alert list since it has 2 attempts
    // (it was created just now, so 48h haven't passed)
  });

  // Cleanup
  it("should clean up test lead", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/leads.delete")
      .set("Content-Type", "application/json")
      .send({ json: { id: testLeadId } });
    expect(res.status).toBe(200);
  });
});
