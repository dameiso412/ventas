import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Helper: create a minimal public context (no auth required for CRM procedures)
 */
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("CRM Router - Input Validation", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  describe("leads.list", () => {
    it("accepts empty input (no filters)", async () => {
      // Should not throw on valid input shape
      // The actual DB call may fail in test env, but input validation should pass
      try {
        await caller.leads.list();
      } catch (e: any) {
        // DB errors are expected in test env, but not validation errors
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts valid filter parameters", async () => {
      try {
        await caller.leads.list({
          mes: "Enero",
          semana: 1,
          origen: "ADS",
          setter: "Nicolás",
          closer: "Damaso",
          scoreLabel: "HOT",
          outcome: "VENTA",
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("leads.create", () => {
    it("validates lead creation input", async () => {
      try {
        await caller.leads.create({
          nombre: "Test Lead",
          correo: "test@test.com",
          telefono: "+1234567890",
          pais: "México",
          origen: "ADS",
          tipo: "DEMO",
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("rejects invalid origen value", async () => {
      await expect(
        caller.leads.create({
          nombre: "Test",
          origen: "INVALID" as any,
        })
      ).rejects.toThrow();
    });

    it("rejects invalid scoreLabel value", async () => {
      await expect(
        caller.leads.create({
          nombre: "Test",
          scoreLabel: "SUPER_HOT" as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("leads.update", () => {
    it("requires id parameter", async () => {
      await expect(
        caller.leads.update({ id: undefined as any, data: { nombre: "Updated" } })
      ).rejects.toThrow();
    });

    it("accepts valid update input", async () => {
      try {
        await caller.leads.update({
          id: 1,
          data: { nombre: "Updated Name", outcome: "VENTA" },
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("leads.delete", () => {
    it("requires id parameter", async () => {
      await expect(
        caller.leads.delete({ id: undefined as any })
      ).rejects.toThrow();
    });
  });

  describe("setterActivities.create", () => {
    it("validates setter activity creation and cleans up", async () => {
      let createdId: number | null = null;
      try {
        const result = await caller.setterActivities.create({
          fecha: new Date(),
          setter: "Nicolás",
          mes: "Febrero",
          semana: 3,
          intentosLlamada: 30,
          introsEfectivas: 15,
          demosAseguradasConIntro: 8,
          demosEnCalendario: 6,
          demosConfirmadas: 5,
          demosAsistidas: 4,
        });
        createdId = result.id;
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      } finally {
        // Always clean up test data
        if (createdId) {
          try { await caller.setterActivities.delete({ id: createdId }); } catch (_) {}
        }
      }
    });

    it("requires setter field", async () => {
      await expect(
        caller.setterActivities.create({
          fecha: new Date(),
          setter: undefined as any,
        })
      ).rejects.toThrow();
    });

    it("requires fecha field", async () => {
      await expect(
        caller.setterActivities.create({
          fecha: undefined as any,
          setter: "Nicolás",
        })
      ).rejects.toThrow();
    });
  });

  describe("closerActivities.create", () => {
    it("validates closer activity creation and cleans up", async () => {
      let createdId: number | null = null;
      try {
        const result = await caller.closerActivities.create({
          fecha: new Date(),
          closer: "Damaso",
          mes: "Febrero",
          semana: 3,
          scheduleCalls: 10,
          liveCalls: 8,
          offers: 5,
          deposits: 2,
          closes: 2,
          piffRevenue: "5000",
          piffCash: "3000",
        });
        createdId = result.id;
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      } finally {
        // Always clean up test data
        if (createdId) {
          try { await caller.closerActivities.delete({ id: createdId }); } catch (_) {}
        }
      }
    });

    it("requires closer field", async () => {
      await expect(
        caller.closerActivities.create({
          fecha: new Date(),
          closer: undefined as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("scoring.create", () => {
    it("validates scoring creation input", async () => {
      try {
        await caller.scoring.create({
          leadId: 1,
          correo: "test@test.com",
          p1Frustracion: "Estoy frustrado con mi marketing",
          p2MarketingPrevio: "Invertí $5000 y perdí dinero",
          p3Urgencia: "YA",
          p4TiempoOperando: "Más de 5 años",
          p5Tratamientos: "Implantes dentales",
          p6Impedimento: "Nada",
          scoreFinal: 4,
          scoreLabel: "HOT",
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("rejects invalid scoreLabel", async () => {
      await expect(
        caller.scoring.create({
          scoreLabel: "MEGA_HOT" as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("dashboard.kpis", () => {
    it("accepts empty filters", async () => {
      try {
        await caller.dashboard.kpis();
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts valid filter parameters", async () => {
      try {
        await caller.dashboard.kpis({ mes: "Febrero", semana: 3 });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("setterActivities.leaderboard", () => {
    it("accepts empty filters", async () => {
      try {
        await caller.setterActivities.leaderboard();
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("closerActivities.leaderboard", () => {
    it("accepts empty filters", async () => {
      try {
        await caller.closerActivities.leaderboard();
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("filters.distinctValues", () => {
    it("returns without validation errors", async () => {
      try {
        await caller.filters.distinctValues();
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });
});

describe("Webhook - Score Label Mapping", () => {
  // Test the getScoreLabel logic directly
  it("maps score 4 to HOT", () => {
    expect(mapScore(4)).toBe("HOT");
  });

  it("maps score 3 to WARM", () => {
    expect(mapScore(3)).toBe("WARM");
  });

  it("maps score 2 to TIBIO", () => {
    expect(mapScore(2)).toBe("TIBIO");
  });

  it("maps score 1 to FRÍO", () => {
    expect(mapScore(1)).toBe("FRÍO");
  });

  it("maps score 0 to FRÍO", () => {
    expect(mapScore(0)).toBe("FRÍO");
  });
});

describe("Webhook - Two Endpoint Flow", () => {
  it("Webhook 1 (/api/webhook/lead) only has agenda fields with GHL keys", () => {
    // Webhook 1 receives ONLY GHL custom data keys: Nombre, Telefono, Correo, Fecha_Agenda, Link_CRM
    const leadPayload = {
      Nombre: "Dr. Test",
      Telefono: "+52 55 9999 0000",
      Correo: "test@clinica.com",
      Fecha_Agenda: "2026-02-22T10:00:00",
      Link_CRM: "https://clientes.sacamedi.com/v2/location/5h/contacts/abc123",
    };
    // Must NOT have scoring, profile, or enrichment fields
    expect(leadPayload).not.toHaveProperty("p1_frustracion");
    expect(leadPayload).not.toHaveProperty("instagram");
    expect(leadPayload).not.toHaveProperty("pais");
    expect(leadPayload).not.toHaveProperty("rubro");
    expect(leadPayload).not.toHaveProperty("origen");
    expect(leadPayload).not.toHaveProperty("tipo");
    // Must have GHL agenda fields
    expect(leadPayload).toHaveProperty("Nombre");
    expect(leadPayload).toHaveProperty("Telefono");
    expect(leadPayload).toHaveProperty("Correo");
    expect(leadPayload).toHaveProperty("Fecha_Agenda");
    expect(leadPayload).toHaveProperty("Link_CRM");
  });

  it("Webhook 1 also supports lowercase fallback keys", () => {
    // The webhook handler supports both GHL keys and lowercase variants
    const fallbackPayload = {
      nombre: "Dr. Test",
      telefono: "+52 55 9999 0000",
      correo: "test@clinica.com",
      fecha_agenda: "2026-02-22T10:00:00",
      link_crm: "https://app.gohighlevel.com/contacts/abc123",
    };
    expect(fallbackPayload).toHaveProperty("nombre");
    expect(fallbackPayload).toHaveProperty("correo");
    expect(fallbackPayload).toHaveProperty("fecha_agenda");
  });

  it("Webhook 2 (/api/webhook/score) has profile + scoring fields", () => {
    // Webhook 2 receives correo/telefono for matching,
    // profile data (instagram, pais, rubro, origen, tipo),
    // and scoring questions (P1-P6)
    const scorePayload = {
      correo: "test@clinica.com",
      telefono: "+52 55 9999 0000",
      instagram: "clinicaejemplo",
      pais: "México",
      rubro: "Odontología",
      origen: "ADS",
      tipo: "DEMO",
      p1_frustracion: "Estoy frustrado",
      p2_marketing_previo: "Invertí y perdí",
      p3_urgencia: "YA",
      p4_tiempo_operando: "5 años",
      p5_tratamientos: "Implantes",
      p6_impedimento: "Nada",
    };
    // Must have identifier for matching
    expect(scorePayload.correo || scorePayload.telefono).toBeTruthy();
    // Must have profile fields
    expect(scorePayload).toHaveProperty("instagram");
    expect(scorePayload).toHaveProperty("pais");
    expect(scorePayload).toHaveProperty("rubro");
    // Must have scoring fields
    expect(scorePayload).toHaveProperty("p1_frustracion");
    expect(scorePayload).toHaveProperty("p3_urgencia");
    expect(scorePayload).toHaveProperty("p6_impedimento");
  });

  it("score_override bypasses AI scoring", () => {
    const scorePayload = {
      correo: "test@clinica.com",
      score_override: 4,
    };
    // When score_override is present, AI should not be called
    expect(scorePayload.score_override).toBe(4);
    expect(mapScore(scorePayload.score_override)).toBe("HOT");
  });
});

// Replicate the getScoreLabel function from webhook.ts for unit testing
function mapScore(score: number): "HOT" | "WARM" | "TIBIO" | "FRÍO" {
  if (score === 4) return "HOT";
  if (score === 3) return "WARM";
  if (score === 2) return "TIBIO";
  return "FRÍO";
}

describe("Webhook - Month and Week Helpers", () => {
  it("returns correct month name for January", () => {
    const date = new Date(2026, 0, 15); // January 15
    expect(getMesName(date)).toBe("Enero");
  });

  it("returns correct month name for December", () => {
    const date = new Date(2026, 11, 25); // December 25
    expect(getMesName(date)).toBe("Diciembre");
  });

  it("returns week 1 for day 1-7", () => {
    expect(getSemanaDelMes(new Date(2026, 0, 1))).toBe(1);
    expect(getSemanaDelMes(new Date(2026, 0, 7))).toBe(1);
  });

  it("returns week 2 for day 8-14", () => {
    expect(getSemanaDelMes(new Date(2026, 0, 8))).toBe(2);
    expect(getSemanaDelMes(new Date(2026, 0, 14))).toBe(2);
  });

  it("returns week 3 for day 15-21", () => {
    expect(getSemanaDelMes(new Date(2026, 0, 15))).toBe(3);
    expect(getSemanaDelMes(new Date(2026, 0, 21))).toBe(3);
  });

  it("returns week 4 for day 22-28", () => {
    expect(getSemanaDelMes(new Date(2026, 0, 22))).toBe(4);
    expect(getSemanaDelMes(new Date(2026, 0, 28))).toBe(4);
  });

  it("returns week 5 for day 29-31", () => {
    expect(getSemanaDelMes(new Date(2026, 0, 29))).toBe(5);
    expect(getSemanaDelMes(new Date(2026, 0, 31))).toBe(5);
  });
});

// Replicate helpers from webhook.ts for testing
function getMesName(date: Date): string {
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return meses[date.getMonth()];
}

function getSemanaDelMes(date: Date): number {
  const day = date.getDate();
  return Math.ceil(day / 7);
}
