import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";

const BASE = "http://localhost:3000";

describe("Protocolo No-Show", () => {
  let testLeadId: number;
  let testFollowUpId: number;

  beforeAll(async () => {
    // Crear lead via webhook (que ya acepta los campos correctamente)
    const res = await supertest(BASE)
      .post("/api/webhook/lead")
      .send({
        Nombre: "Test No-Show Lead",
        Correo: `noshow-${Date.now()}@test.com`,
        Telefono: `+1${Date.now().toString().slice(-9)}`,
        Fecha_Agenda: "2026-03-10T15:00:00Z",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    testLeadId = res.body.leadId;
    expect(testLeadId).toBeDefined();
  });

  it("debería activar el protocolo No-Show y retornar un followUpId", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/followUps.noShow")
      .set("Content-Type", "application/json")
      .send({
        json: {
          leadId: testLeadId,
          closerAsignado: "Test Closer",
          notas: "Lead no contestó en ningún intento",
        },
      });

    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    expect(data).toBeDefined();
    expect(data.followUpId).toBeDefined();
    expect(typeof data.followUpId).toBe("number");
    testFollowUpId = data.followUpId;
  });

  it("debería marcar el lead con asistencia NO SHOW", async () => {
    const res = await supertest(BASE).get(
      `/api/trpc/leads.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: testLeadId } }))}`
    );
    expect(res.status).toBe(200);
    const lead = res.body.result?.data?.json;
    expect(lead).toBeDefined();
    expect(lead.asistencia).toBe("NO SHOW");
  });

  it("debería crear el follow-up con prioridad RED_HOT y estado ACTIVO", async () => {
    expect(testFollowUpId).toBeDefined();
    const res = await supertest(BASE).get("/api/trpc/followUps.list");
    expect(res.status).toBe(200);
    const followUps = res.body.result?.data?.json;
    const testFU = followUps?.find((fu: any) => fu.id === testFollowUpId);
    expect(testFU).toBeDefined();
    expect(testFU.prioridad).toBe("RED_HOT");
    expect(testFU.tipo).toBe("HOT");
    expect(testFU.estado).toBe("ACTIVO");
  });

  it("debería incluir nota [NO SHOW] en el follow-up", async () => {
    const res = await supertest(BASE).get("/api/trpc/followUps.list");
    const followUps = res.body.result?.data?.json;
    const testFU = followUps?.find((fu: any) => fu.id === testFollowUpId);
    expect(testFU?.notas).toContain("[NO SHOW]");
  });

  it("debería actualizar el follow-up existente (no crear duplicado) al llamar noShow de nuevo", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/followUps.noShow")
      .set("Content-Type", "application/json")
      .send({
        json: {
          leadId: testLeadId,
          notas: "Segundo intento de protocolo",
        },
      });
    expect(res.status).toBe(200);
    const data = res.body.result?.data?.json;
    // Debe retornar el mismo followUpId (actualiza, no crea nuevo)
    expect(data.followUpId).toBe(testFollowUpId);
  });

  it("debería fallar si el leadId no existe", async () => {
    const res = await supertest(BASE)
      .post("/api/trpc/followUps.noShow")
      .set("Content-Type", "application/json")
      .send({ json: { leadId: 999999999 } });
    expect(res.status).toBe(500);
  });
});
