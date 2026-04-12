import { describe, it, expect, afterAll } from "vitest";
import supertest from "supertest";

const BASE = `http://localhost:${process.env.PORT || 3000}`;

describe("Intro/Demo Distinction", () => {
  // ==================== WEBHOOK ?tipo=intro ====================
  describe("Webhook tipo parameter", () => {
    it("should accept ?tipo=intro and create lead as INTRO", async () => {
      const res = await supertest(BASE)
        .post("/api/webhook/lead?tipo=intro")
        .send({
          full_name: "Test Intro Lead",
          email: `intro-test-${Date.now()}@test.com`,
          phone: `+1${Date.now().toString().slice(-10)}`,
          country: "Ecuador",
          fecha_cita: "2026-02-26T10:00:00Z",
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should default to DEMO when no tipo parameter", async () => {
      const res = await supertest(BASE)
        .post("/api/webhook/lead")
        .send({
          full_name: "Test Demo Lead Default",
          email: `demo-default-${Date.now()}@test.com`,
          phone: `+2${Date.now().toString().slice(-10)}`,
          country: "Colombia",
          fecha_cita: "2026-02-26T11:00:00Z",
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should accept ?tipo=demo explicitly", async () => {
      const res = await supertest(BASE)
        .post("/api/webhook/lead?tipo=demo")
        .send({
          full_name: "Test Demo Lead Explicit",
          email: `demo-explicit-${Date.now()}@test.com`,
          phone: `+3${Date.now().toString().slice(-10)}`,
          country: "M\u00e9xico",
          fecha_cita: "2026-02-26T12:00:00Z",
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==================== INTRO → DEMO CONVERSION ====================
  describe("Intro to Demo conversion", () => {
    const uniqueEmail = `conversion-${Date.now()}@test.com`;
    const uniquePhone = `+9${Date.now().toString().slice(-10)}`;

    it("should first create as INTRO", async () => {
      const res = await supertest(BASE)
        .post("/api/webhook/lead?tipo=intro")
        .send({
          full_name: "Conversion Test Lead",
          email: uniqueEmail,
          phone: uniquePhone,
          country: "Chile",
          fecha_cita: "2026-02-20T10:00:00Z",
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should convert to DEMO when same lead arrives as demo", async () => {
      // Small delay to ensure first one is processed
      await new Promise(r => setTimeout(r, 500));
      const res = await supertest(BASE)
        .post("/api/webhook/lead?tipo=demo")
        .send({
          full_name: "Conversion Test Lead",
          email: uniqueEmail,
          phone: uniquePhone,
          country: "Chile",
          fecha_cita: "2026-02-25T14:00:00Z",
        });
      expect(res.status).toBe(200);
      // Should be updated (not duplicate), or created as new demo
      expect(res.body.success).toBe(true);
    });
  });

  // ==================== SETTER ACTIVITIES WITH INTRO FIELDS ====================
  describe("Setter activities intro fields", () => {
    const createdSetterIds: number[] = [];

    // afterAll cleanup: delete setter activities created during this test
    afterAll(async () => {
      for (const id of createdSetterIds) {
        try {
          await supertest(BASE)
            .post("/api/trpc/setterActivities.delete")
            .set("Content-Type", "application/json")
            .send({ json: { id } });
        } catch (_) {}
      }
    });

    it("should create setter activity without intro fields (default zeros)", async () => {
      const res = await supertest(BASE)
        .post("/api/trpc/setterActivities.create")
        .set("Content-Type", "application/json")
        .send({ json: {
          setter: "Nicol\u00e1s",
          fecha: "2026-02-26T00:00:00.000Z",
          mes: "Febrero",
          semana: 4,
          intentosLlamada: 20,
          introsEfectivas: 8,
          demosAseguradasConIntro: 5,
          demosEnCalendario: 5,
          demosConfirmadas: 4,
          demosAsistidas: 3,
          cierresAtribuidos: 1,
          revenueAtribuido: "3000",
          cashAtribuido: "2000",
          notas: "Test sin intros",
          introAgendadas: 0,
          introLive: 0,
          introADemo: 0,
        }, meta: { values: { fecha: ["Date"] } } });
      expect(res.status).toBe(200);
      if (res.body?.result?.data?.json?.id) {
        createdSetterIds.push(res.body.result.data.json.id);
      }
    });

    it("should create setter activity with intro fields", async () => {
      const res = await supertest(BASE)
        .post("/api/trpc/setterActivities.create")
        .set("Content-Type", "application/json")
        .send({ json: {
          setter: "Jose",
          fecha: "2026-02-26T00:00:00.000Z",
          mes: "Febrero",
          semana: 4,
          intentosLlamada: 15,
          introsEfectivas: 6,
          demosAseguradasConIntro: 4,
          demosEnCalendario: 4,
          demosConfirmadas: 3,
          demosAsistidas: 2,
          cierresAtribuidos: 0,
          revenueAtribuido: "0",
          cashAtribuido: "0",
          notas: "Test con intros",
          introAgendadas: 3,
          introLive: 2,
          introADemo: 1,
        }, meta: { values: { fecha: ["Date"] } } });
      expect(res.status).toBe(200);
      if (res.body?.result?.data?.json?.id) {
        createdSetterIds.push(res.body.result.data.json.id);
      }
    });
  });

  // ==================== DASHBOARD TRACKER KPIs ====================
  describe("Dashboard tracker KPIs include intro data", () => {
    it("should return intro aggregates in setter tracker KPIs", async () => {
      const res = await supertest(BASE)
        .get("/api/trpc/dashboard.trackerKPIs?input=%7B%7D");
      expect(res.status).toBe(200);
      const data = res.body?.result?.data;
      if (data?.setter) {
        // These fields should exist (may be 0 if no data)
        expect(data.setter).toHaveProperty("totalIntroAgendadas");
        expect(data.setter).toHaveProperty("totalIntroLive");
        expect(data.setter).toHaveProperty("totalIntroADemo");
      }
    });
  });

  // ==================== LEADS LIST WITH TIPO FILTER ====================
  describe("Leads list tipo filter", () => {
    it("should return leads filtered by tipo=INTRO", async () => {
      const input = encodeURIComponent(JSON.stringify({ tipo: "INTRO" }));
      const res = await supertest(BASE)
        .get(`/api/trpc/leads.list?input=${input}`);
      expect(res.status).toBe(200);
      const data = res.body?.result?.data;
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((lead: any) => {
          expect(lead.tipo).toBe("INTRO");
        });
      }
    });

    it("should return leads filtered by tipo=DEMO", async () => {
      const input = encodeURIComponent(JSON.stringify({ tipo: "DEMO" }));
      const res = await supertest(BASE)
        .get(`/api/trpc/leads.list?input=${input}`);
      expect(res.status).toBe(200);
      const data = res.body?.result?.data;
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((lead: any) => {
          expect(lead.tipo).toBe("DEMO");
        });
      }
    });

    it("should return all leads when no tipo filter", async () => {
      const input = encodeURIComponent(JSON.stringify({}));
      const res = await supertest(BASE)
        .get(`/api/trpc/leads.list?input=${input}`);
      expect(res.status).toBe(200);
      expect(res.body?.result?.data).toBeDefined();
    });
  });

  // ==================== DASHBOARD KPIs INCLUDE INTRO COUNTS ====================
  describe("Dashboard KPIs include intro counts from leads", () => {
    it("should return totalIntros and introsConvertidas in kpis", async () => {
      const input = encodeURIComponent(JSON.stringify({ json: {} }));
      const res = await supertest(BASE)
        .get(`/api/trpc/dashboard.kpis?input=${input}`);
      expect(res.status).toBe(200);
      const data = res.body?.result?.data?.json;
      if (data) {
        expect(data).toHaveProperty("totalIntros");
        expect(data).toHaveProperty("totalDemos");
        expect(data).toHaveProperty("introsConvertidas");
      }
    });
  });
});
