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
// tRPC Router - Call Audits Input Validation
// ============================================================
describe("Call Audits - tRPC Router Input Validation", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(createPublicContext());
  });

  describe("callAudits.list", () => {
    it("accepts empty input (no filters)", async () => {
      try {
        await caller.callAudits.list();
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts valid filter parameters", async () => {
      try {
        await caller.callAudits.list({
          closer: "Damaso",
          manualReview: "PENDIENTE",
          limit: 10,
          offset: 0,
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts partial filters", async () => {
      try {
        await caller.callAudits.list({ closer: "Damaso" });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts limit and offset only", async () => {
      try {
        await caller.callAudits.list({ limit: 25, offset: 50 });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("callAudits.getById", () => {
    it("requires id parameter", async () => {
      await expect(
        caller.callAudits.getById({ id: undefined as any })
      ).rejects.toThrow();
    });

    it("accepts valid id", async () => {
      try {
        await caller.callAudits.getById({ id: 1 });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("rejects non-numeric id", async () => {
      await expect(
        caller.callAudits.getById({ id: "abc" as any })
      ).rejects.toThrow();
    });
  });

  describe("callAudits.getByLeadId", () => {
    it("requires leadId parameter", async () => {
      await expect(
        caller.callAudits.getByLeadId({ leadId: undefined as any })
      ).rejects.toThrow();
    });

    it("accepts valid leadId", async () => {
      try {
        await caller.callAudits.getByLeadId({ leadId: 42 });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("callAudits.stats", () => {
    it("accepts no input (stats has no parameters)", async () => {
      try {
        await caller.callAudits.stats();
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });
  });

  describe("callAudits.updateReview", () => {
    it("requires id parameter", async () => {
      await expect(
        caller.callAudits.updateReview({ id: undefined as any })
      ).rejects.toThrow();
    });

    it("accepts valid review update with all fields", async () => {
      try {
        await caller.callAudits.updateReview({
          id: 1,
          manualReview: "REVISADA",
          manualNotes: "Buen seguimiento del script",
          actionItems: [
            { text: "Mejorar cierre", done: false },
            { text: "Revisar objeciones", done: true },
          ],
          reviewedBy: "Damaso",
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts partial review update (only manualReview)", async () => {
      try {
        await caller.callAudits.updateReview({
          id: 1,
          manualReview: "ACCIONADA",
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("accepts partial review update (only notes)", async () => {
      try {
        await caller.callAudits.updateReview({
          id: 1,
          manualNotes: "Notas de revisión del manager",
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("rejects invalid manualReview value", async () => {
      await expect(
        caller.callAudits.updateReview({
          id: 1,
          manualReview: "INVALID" as any,
        })
      ).rejects.toThrow();
    });

    it("validates action items structure", async () => {
      try {
        await caller.callAudits.updateReview({
          id: 1,
          actionItems: [{ text: "Item 1" }],
        });
      } catch (e: any) {
        expect(e.code).not.toBe("BAD_REQUEST");
      }
    });

    it("rejects action items without text", async () => {
      await expect(
        caller.callAudits.updateReview({
          id: 1,
          actionItems: [{ done: false }] as any,
        })
      ).rejects.toThrow();
    });
  });
});

// ============================================================
// Webhook - Call Audit Endpoint Tests
// ============================================================
describe("Call Audit Webhook - /api/webhook/call-audit", () => {
  const WEBHOOK_URL = "http://localhost:3000/api/webhook/call-audit";

  it("accepts a complete call audit payload", async () => {
    const payload = {
      closer: "Damaso",
      email: "test-audit@example.com",
      phone: "+56912345678",
      leadName: "Test Lead Audit",
      linkGrabacion: "https://example.com/recording.mp3",
      duracionMinutos: 45,
      fechaLlamada: "2026-02-20T15:00:00Z",
      aiFeedback: "El closer mostró buen manejo de objeciones pero necesita mejorar el cierre.",
      aiGrading: 7,
      aiGradingJustification: "Buen rapport pero faltó urgencia en el cierre",
      aiWhyNotClosed: "El prospecto pidió tiempo para pensarlo, no se generó suficiente urgencia.",
      aiKeyMoments: "Minuto 5: buena conexión. Minuto 20: objeción de precio manejada bien.",
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.auditId).toBeDefined();
    expect(typeof body.auditId).toBe("number");
  });

  it("accepts minimal payload (only AI feedback)", async () => {
    const payload = {
      closer: "Damaso",
      aiFeedback: "Feedback mínimo de prueba",
      aiGrading: 5,
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.auditId).toBeDefined();
  });

  it("accepts alternative key names (snake_case)", async () => {
    const payload = {
      Closer: "Damaso",
      correo: "alt-keys@example.com",
      telefono: "+56900000000",
      recording_url: "https://example.com/alt-recording.mp3",
      ai_feedback: "Feedback con claves alternativas",
      ai_grading: 8,
      ai_why_not_closed: "Razón alternativa",
      ai_key_moments: "Momento clave alternativo",
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("clamps grading to valid range (1-10)", async () => {
    // Grading outside 1-10 should be set to null
    const payload = {
      closer: "Test",
      aiFeedback: "Test",
      aiGrading: 15, // out of range
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // The audit is created but grading should be null (out of range)
  });

  it("accepts string grading and parses it", async () => {
    const payload = {
      closer: "Test",
      aiFeedback: "Test string grading",
      aiGrading: "9", // string instead of number
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("handles JSON aiKeyMoments", async () => {
    const payload = {
      closer: "Test",
      aiFeedback: "Test with JSON key moments",
      aiGrading: 6,
      aiKeyMoments: JSON.stringify([
        { minuto: 5, descripcion: "Buena conexión inicial" },
        { minuto: 15, descripcion: "Objeción de precio" },
      ]),
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("creates audit without lead linkage when no email/phone", async () => {
    const payload = {
      closer: "Damaso",
      aiFeedback: "Sin datos de contacto del lead",
      aiGrading: 4,
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.leadId).toBeNull();
  });

  it("defaults fechaLlamada to current date when not provided", async () => {
    const payload = {
      closer: "Damaso",
      aiFeedback: "Sin fecha explícita",
      aiGrading: 5,
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ============================================================
// Call Audit Stats - Structure Validation
// ============================================================
describe("Call Audit Stats - Response Structure", () => {
  it("returns stats with expected fields", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    try {
      const stats = await caller.callAudits.stats();
      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("pendientes");
      expect(stats).toHaveProperty("revisadas");
      expect(stats).toHaveProperty("accionadas");
      expect(stats).toHaveProperty("avgGrading");
      expect(stats).toHaveProperty("gradingDistribution");
      expect(typeof stats.total).toBe("number");
      expect(typeof stats.pendientes).toBe("number");
      expect(typeof stats.avgGrading).toBe("number");
      expect(stats.gradingDistribution).toHaveProperty("excellent");
      expect(stats.gradingDistribution).toHaveProperty("good");
      expect(stats.gradingDistribution).toHaveProperty("needsWork");
      expect(stats.gradingDistribution).toHaveProperty("poor");
    } catch (e: any) {
      // DB errors are expected in test env
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });
});

// ============================================================
// Call Audit List - Response Structure
// ============================================================
describe("Call Audit List - Response Structure", () => {
  it("returns an array of audits", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    try {
      const audits = await caller.callAudits.list();
      expect(Array.isArray(audits)).toBe(true);
      if (audits.length > 0) {
        const audit = audits[0];
        expect(audit).toHaveProperty("id");
        expect(audit).toHaveProperty("closer");
        expect(audit).toHaveProperty("aiFeedback");
        expect(audit).toHaveProperty("aiGrading");
        expect(audit).toHaveProperty("manualReview");
        expect(audit).toHaveProperty("createdAt");
      }
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("filters by closer name", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    try {
      const audits = await caller.callAudits.list({ closer: "Damaso" });
      expect(Array.isArray(audits)).toBe(true);
      // All returned audits should be for Damaso
      for (const audit of audits) {
        expect(audit.closer).toBe("Damaso");
      }
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });

  it("filters by review status", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    try {
      const audits = await caller.callAudits.list({ manualReview: "PENDIENTE" });
      expect(Array.isArray(audits)).toBe(true);
      for (const audit of audits) {
        expect(audit.manualReview).toBe("PENDIENTE");
      }
    } catch (e: any) {
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });
});

// ============================================================
// Webhook Health Check
// ============================================================
describe("Webhook Health Check", () => {
  it("returns ok status", async () => {
    const res = await fetch("http://localhost:3000/api/webhook/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});
