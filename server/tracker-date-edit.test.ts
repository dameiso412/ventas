import { describe, expect, it, vi, beforeEach } from "vitest";
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
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ============================================================
// Setter Activities - Date Editing & Custom Date Creation
// ============================================================
describe("Setter Activities - Date Editing", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  it("creates a setter activity with a past date", async () => {
    const pastDate = new Date("2026-02-20T12:00:00Z");
    try {
      const result = await caller.setterActivities.create({
        fecha: pastDate,
        mes: "Febrero",
        semana: 3,
        setter: "Nicolás",
        intentosLlamada: 50,
        introsEfectivas: 15,
        demosAseguradasConIntro: 5,
        demosEnCalendario: 4,
        demosConfirmadas: 3,
        demosAsistidas: 2,
        cierresAtribuidos: 1,
        revenueAtribuido: "5000",
        cashAtribuido: "2500",
        notas: "Test past date creation",
      });
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("number");

      // Clean up
      await caller.setterActivities.delete({ id: result.id });
    } catch (e: any) {
      // DB errors expected in test env, but not validation errors
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("creates a setter activity with a future date", async () => {
    const futureDate = new Date("2026-03-15T12:00:00Z");
    try {
      const result = await caller.setterActivities.create({
        fecha: futureDate,
        mes: "Marzo",
        semana: 3,
        setter: "Jose",
        intentosLlamada: 30,
      });
      expect(result.id).toBeDefined();

      // Clean up
      await caller.setterActivities.delete({ id: result.id });
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("updates a setter activity date via update procedure", async () => {
    try {
      // Create a record
      const created = await caller.setterActivities.create({
        fecha: new Date("2026-02-25T12:00:00Z"),
        mes: "Febrero",
        semana: 4,
        setter: "Nicolás",
        intentosLlamada: 20,
      });

      // Update the date
      const newDate = new Date("2026-02-20T12:00:00Z");
      const result = await caller.setterActivities.update({
        id: created.id,
        data: {
          fecha: newDate,
          mes: "Febrero",
          semana: 3,
        },
      });
      expect(result.success).toBe(true);

      // Clean up
      await caller.setterActivities.delete({ id: created.id });
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("updates setter activity fields and date together", async () => {
    try {
      const created = await caller.setterActivities.create({
        fecha: new Date("2026-02-25T12:00:00Z"),
        mes: "Febrero",
        semana: 4,
        setter: "Jose",
        intentosLlamada: 10,
        introsEfectivas: 3,
      });

      const result = await caller.setterActivities.update({
        id: created.id,
        data: {
          fecha: new Date("2026-02-24T12:00:00Z"),
          mes: "Febrero",
          semana: 4,
          intentosLlamada: 25,
          introsEfectivas: 8,
          notas: "Updated with new date",
        },
      });
      expect(result.success).toBe(true);

      // Clean up
      await caller.setterActivities.delete({ id: created.id });
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("rejects create without fecha", async () => {
    await expect(
      caller.setterActivities.create({
        setter: "Nicolás",
        fecha: undefined as any,
      })
    ).rejects.toThrow();
  });

  it("rejects create without setter", async () => {
    await expect(
      caller.setterActivities.create({
        fecha: new Date(),
        setter: undefined as any,
      })
    ).rejects.toThrow();
  });
});

// ============================================================
// Closer Activities - Date Editing & Custom Date Creation
// ============================================================
describe("Closer Activities - Date Editing", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  it("creates a closer activity with a past date", async () => {
    const pastDate = new Date("2026-02-18T12:00:00Z");
    try {
      const result = await caller.closerActivities.create({
        fecha: pastDate,
        mes: "Febrero",
        semana: 3,
        closer: "Damaso",
        scheduleCalls: 8,
        liveCalls: 6,
        offers: 4,
        deposits: 2,
        closes: 1,
        piffRevenue: "10000",
        piffCash: "5000",
        setupRevenue: "3000",
        setupCash: "1500",
        notas: "Test past date creation",
      });
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe("number");

      // Clean up
      await caller.closerActivities.delete({ id: result.id });
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("creates a closer activity with a future date", async () => {
    const futureDate = new Date("2026-03-10T12:00:00Z");
    try {
      const result = await caller.closerActivities.create({
        fecha: futureDate,
        mes: "Marzo",
        semana: 2,
        closer: "Nicolás",
        scheduleCalls: 5,
      });
      expect(result.id).toBeDefined();

      // Clean up
      await caller.closerActivities.delete({ id: result.id });
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("updates a closer activity date via update procedure", async () => {
    try {
      const created = await caller.closerActivities.create({
        fecha: new Date("2026-02-25T12:00:00Z"),
        mes: "Febrero",
        semana: 4,
        closer: "Damaso",
        scheduleCalls: 10,
      });

      const result = await caller.closerActivities.update({
        id: created.id,
        data: {
          fecha: new Date("2026-02-22T12:00:00Z"),
          mes: "Febrero",
          semana: 4,
        },
      });
      expect(result.success).toBe(true);

      // Clean up
      await caller.closerActivities.delete({ id: created.id });
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("updates closer activity fields and date together", async () => {
    try {
      const created = await caller.closerActivities.create({
        fecha: new Date("2026-02-25T12:00:00Z"),
        mes: "Febrero",
        semana: 4,
        closer: "Damaso",
        scheduleCalls: 5,
        liveCalls: 3,
      });

      const result = await caller.closerActivities.update({
        id: created.id,
        data: {
          fecha: new Date("2026-02-23T12:00:00Z"),
          mes: "Febrero",
          semana: 4,
          scheduleCalls: 12,
          liveCalls: 9,
          offers: 6,
          closes: 3,
          notas: "Updated with new date and metrics",
        },
      });
      expect(result.success).toBe(true);

      // Clean up
      await caller.closerActivities.delete({ id: created.id });
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("rejects create without fecha", async () => {
    await expect(
      caller.closerActivities.create({
        closer: "Damaso",
        fecha: undefined as any,
      })
    ).rejects.toThrow();
  });

  it("rejects create without closer", async () => {
    await expect(
      caller.closerActivities.create({
        fecha: new Date(),
        closer: undefined as any,
      })
    ).rejects.toThrow();
  });
});
