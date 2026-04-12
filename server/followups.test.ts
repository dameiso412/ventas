import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
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

describe("followUps", () => {
  const ctx = createPublicContext();
  const caller = appRouter.createCaller(ctx);
  let createdId: number;

  describe("create", () => {
    it("creates a follow-up with minimal data", async () => {
      const result = await caller.followUps.create({
        nombre: "Test Lead",
        tipo: "HOT",
        prioridad: "HOT",
        closerAsignado: "Damaso",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
      createdId = result.id;
    });

    it("creates a follow-up with full data", async () => {
      const result = await caller.followUps.create({
        nombre: "Full Data Lead",
        correo: "test@example.com",
        telefono: "+521234567890",
        instagram: "@testlead",
        facebook: "https://facebook.com/testlead",
        tipo: "WARM",
        prioridad: "WARM",
        ultimaObjecion: "Necesita consultarlo con su socio",
        montoEstimado: "6000",
        productoInteres: "PIF",
        proximoFollowUp: new Date("2026-03-01T10:00:00Z"),
        closerAsignado: "Alejandro",
        notas: "Tiene clínica en CDMX",
        linkCRM: "https://app.gohighlevel.com/test",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });
  });

  describe("list", () => {
    it("lists all active follow-ups", async () => {
      const results = await caller.followUps.list({ estado: "ACTIVO" });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("filters by tipo HOT", async () => {
      const results = await caller.followUps.list({ tipo: "HOT" });
      expect(Array.isArray(results)).toBe(true);
      results.forEach((fu: any) => {
        expect(fu.tipo).toBe("HOT");
      });
    });

    it("filters by tipo WARM", async () => {
      const results = await caller.followUps.list({ tipo: "WARM" });
      expect(Array.isArray(results)).toBe(true);
      results.forEach((fu: any) => {
        expect(fu.tipo).toBe("WARM");
      });
    });

    it("filters by closer", async () => {
      const results = await caller.followUps.list({ closerAsignado: "Damaso" });
      expect(Array.isArray(results)).toBe(true);
      results.forEach((fu: any) => {
        expect(fu.closerAsignado).toBe("Damaso");
      });
    });
  });

  describe("stats", () => {
    it("returns follow-up statistics", async () => {
      const stats = await caller.followUps.stats();
      expect(stats).toHaveProperty("hotCount");
      expect(stats).toHaveProperty("warmCount");
      expect(stats).toHaveProperty("totalActivos");
      expect(stats).toHaveProperty("cerradosGanados");
      expect(stats).toHaveProperty("cerradosPerdidos");
      expect(stats).toHaveProperty("vencidos");
      expect(typeof stats.hotCount).toBe("number");
      expect(typeof stats.warmCount).toBe("number");
      expect(typeof stats.totalActivos).toBe("number");
    });
  });

  describe("update", () => {
    it("updates a follow-up's objection and notes", async () => {
      const result = await caller.followUps.update({
        id: createdId,
        data: {
          ultimaObjecion: "Quiere comparar precios",
          notas: "Llamar el lunes a las 10am",
        },
      });
      expect(result).toHaveProperty("success", true);
    });

    it("changes priority to RED_HOT", async () => {
      const result = await caller.followUps.update({
        id: createdId,
        data: {
          prioridad: "RED_HOT",
        },
      });
      expect(result).toHaveProperty("success", true);
    });

    it("moves from HOT to WARM", async () => {
      const result = await caller.followUps.update({
        id: createdId,
        data: {
          tipo: "WARM",
          estado: "MOVIDO_A_WARM",
        },
      });
      expect(result).toHaveProperty("success", true);
    });

    it("marks as closed won", async () => {
      const result = await caller.followUps.update({
        id: createdId,
        data: {
          estado: "CERRADO_GANADO",
        },
      });
      expect(result).toHaveProperty("success", true);
    });
  });

  describe("logActivity", () => {
    it("logs a call activity", async () => {
      const result = await caller.followUps.logActivity({
        followUpId: createdId,
        accion: "LLAMADA",
        detalle: "Contestó, dice que lo piensa esta semana",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("logs a WhatsApp activity", async () => {
      const result = await caller.followUps.logActivity({
        followUpId: createdId,
        accion: "WHATSAPP",
        detalle: "Envié mensaje de seguimiento",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("logs a note", async () => {
      const result = await caller.followUps.logActivity({
        followUpId: createdId,
        accion: "NOTA",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });
  });

  describe("delete", () => {
    it("deletes a follow-up", async () => {
      const result = await caller.followUps.delete({ id: createdId });
      expect(result).toHaveProperty("success", true);
    });
  });
});
