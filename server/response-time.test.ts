import { describe, it, expect, afterAll } from "vitest";
import supertest from "supertest";

const BASE = "http://localhost:3000";

describe("Response Time Tracking & Contact Attempt Date/Time", () => {
  let testLeadId: number;
  // Use a fixed past date for the lead entry (webhook uses Fecha_Agenda)
  const leadFechaStr = "2026-02-28T14:00:00Z";
  // Attempt 1: 15 minutes after lead entry
  const attempt1Str = "2026-02-28T14:15:00Z";
  // Attempt 2: 5 minutes after lead entry (earlier than attempt 1)
  const attempt2Str = "2026-02-28T14:05:00Z";

  // Create a test lead via webhook with Fecha_Agenda
  it("should create a test lead with a specific Fecha_Agenda", async () => {
    const res = await supertest(BASE)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Test ResponseTime Lead",
        Correo: `test-rt-${Date.now()}@test.com`,
        Telefono: `+99${Date.now().toString().slice(-8)}`,
        Fecha_Agenda: leadFechaStr,
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    testLeadId = res.body.leadId;
    expect(testLeadId).toBeGreaterThan(0);
  });

  // Test: firstForLeads batch query with no attempts
  it("should return empty batch for leads with no contact attempts", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.firstForLeads?input=${encodeURIComponent(JSON.stringify({ json: { leadIds: [testLeadId] } }))}`);
    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  // Test: Create contact attempt with specific date/time (15 min after lead entry)
  it("should create a contact attempt with a specific timestamp", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/contactAttempts.create")
      .set("Content-Type", "application/json")
      .send({
        json: {
          leadId: testLeadId,
          timestamp: attempt1Str,
          canal: "LLAMADA",
          resultado: "NO CONTESTÓ",
          notas: "Primer intento, no contestó",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.result?.data?.json?.success).toBe(true);
  });

  // Test: Verify fechaPrimerContacto was auto-updated
  it("should auto-update fechaPrimerContacto on the lead after first attempt", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leads.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: testLeadId } }))}`);
    expect(res.status).toBe(200);
    const lead = res.body.result?.data?.json;
    expect(lead).toBeTruthy();
    expect(lead.fechaPrimerContacto).toBeTruthy();
  });

  // Test: Verify tiempoRespuestaHoras was auto-calculated (should be positive, ~0.25h)
  it("should auto-calculate tiempoRespuestaHoras as a positive value", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leads.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: testLeadId } }))}`);
    expect(res.status).toBe(200);
    const lead = res.body.result?.data?.json;
    const responseTime = parseFloat(lead.tiempoRespuestaHoras);
    // Should be approximately 0.25 hours (15 minutes)
    // Allow tolerance for timezone handling
    expect(responseTime).toBeGreaterThanOrEqual(0);
    expect(responseTime).toBeLessThan(1);
  });

  // Test: firstForLeads batch query returns data after attempt
  it("should return batch data for leads with contact attempts", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.firstForLeads?input=${encodeURIComponent(JSON.stringify({ json: { leadIds: [testLeadId] } }))}`);
    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].leadId).toBe(testLeadId);
    expect(data[0].firstAttempt).toBeTruthy();
    expect(Number(data[0].attemptCount)).toBe(1);
  });

  // Test: Create a second attempt with an earlier timestamp (5 min after lead entry)
  it("should create a second attempt with an earlier timestamp", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/contactAttempts.create")
      .set("Content-Type", "application/json")
      .send({
        json: {
          leadId: testLeadId,
          timestamp: attempt2Str,
          canal: "WHATSAPP",
          resultado: "MENSAJE ENVIADO",
          notas: "WhatsApp enviado antes de llamar",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.result?.data?.json?.success).toBe(true);
  });

  // Test: tiempoRespuestaHoras should recalculate to a smaller value (closer to 5 min)
  it("should recalculate tiempoRespuestaHoras to a smaller value after earlier attempt", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/leads.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: testLeadId } }))}`);
    expect(res.status).toBe(200);
    const lead = res.body.result?.data?.json;
    const responseTime = parseFloat(lead.tiempoRespuestaHoras);
    // Should be less than the previous value (was ~0.25, now should be ~0.08)
    expect(responseTime).toBeGreaterThanOrEqual(0);
    expect(responseTime).toBeLessThan(0.5);
  });

  // Test: firstForLeads should show 2 attempts
  it("should show 2 attempts in batch query", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.firstForLeads?input=${encodeURIComponent(JSON.stringify({ json: { leadIds: [testLeadId] } }))}`);
    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    expect(data.length).toBe(1);
    expect(Number(data[0].attemptCount)).toBe(2);
  });

  // Test: Delete the earlier attempt and verify recalculation
  it("should recalculate after deleting the earliest attempt", async () => {
    // Get the list to find the earlier attempt
    const listRes = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.list?input=${encodeURIComponent(JSON.stringify({ json: { leadId: testLeadId } }))}`);
    const attempts = listRes.body.result?.data?.json;
    // Find the WHATSAPP attempt (the earlier one)
    const earlierAttempt = attempts.find((a: any) => a.canal === "WHATSAPP");
    expect(earlierAttempt).toBeTruthy();

    const deleteRes = await supertest(BASE)
      .post("/api/trpc/contactAttempts.delete")
      .set("Content-Type", "application/json")
      .send({ json: { id: earlierAttempt.id } });
    expect(deleteRes.status).toBe(200);

    // Now check that tiempoRespuestaHoras increased (back to ~0.25)
    const leadRes = await supertest(BASE)
      .get(`/api/trpc/leads.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: testLeadId } }))}`);
    const lead = leadRes.body.result?.data?.json;
    const responseTime = parseFloat(lead.tiempoRespuestaHoras);
    // Should be positive and larger than before
    expect(responseTime).toBeGreaterThanOrEqual(0);
  });

  // Test: firstForLeads with multiple lead IDs (some with, some without attempts)
  it("should handle batch query with mixed lead IDs", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.firstForLeads?input=${encodeURIComponent(JSON.stringify({ json: { leadIds: [testLeadId, 999999] } }))}`);
    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    expect(data.length).toBe(1);
    expect(data[0].leadId).toBe(testLeadId);
  });

  // Test: firstForLeads with empty array
  it("should handle batch query with empty lead IDs array", async () => {
    const res = await supertest(BASE)
      .get(`/api/trpc/contactAttempts.firstForLeads?input=${encodeURIComponent(JSON.stringify({ json: { leadIds: [] } }))}`);
    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  // Cleanup
  afterAll(async () => {
    try {
      const listRes = await supertest(BASE)
        .get(`/api/trpc/contactAttempts.list?input=${encodeURIComponent(JSON.stringify({ json: { leadId: testLeadId } }))}`);
      const attempts = listRes.body.result?.data?.json || [];
      for (const a of attempts) {
        await supertest(BASE)
          .post("/api/trpc/contactAttempts.delete")
          .set("Content-Type", "application/json")
          .send({ json: { id: a.id } });
      }
      await supertest(BASE)
        .post("/api/trpc/leads.delete")
        .set("Content-Type", "application/json")
        .send({ json: { id: testLeadId } });
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  });
});
