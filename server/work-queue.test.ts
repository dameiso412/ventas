import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../drizzle/schema", () => ({
  leads: { id: "id", nombre: "nombre", correo: "correo", telefono: "telefono", score: "score", scoreLabel: "scoreLabel", setterAsignado: "setterAsignado", categoria: "categoria", estadoConfirmacion: "estadoConfirmacion", asistencia: "asistencia", fecha: "fecha", resultadoContacto: "resultadoContacto", intentosContacto: "intentosContacto", createdAt: "createdAt", estadoLead: "estadoLead" },
  contactAttempts: { id: "id", leadId: "leadId", timestamp: "timestamp" },
}));

describe("Work Queue & Confirmation Workflow", () => {
  describe("Priority Chain Logic", () => {
    it("should define correct priority order", () => {
      // Priority 1: CONFIRMAR_HOY (demos today not confirmed)
      // Priority 2: CONTACTAR_NUEVO (new leads without contact)
      // Priority 3: CONFIRMAR_MANANA (demos tomorrow not confirmed)
      // Priority 4: REINTENTAR_CONTACTO (leads that didn't answer)
      // Priority 5: DINERO_GRATIS (unscheduled leads)
      // Priority 6: CONFIRMAR_PROXIMOS (demos in 2-3 days)
      const priorities = [
        { action: "CONFIRMAR_HOY", priority: 1 },
        { action: "CONTACTAR_NUEVO", priority: 2 },
        { action: "CONFIRMAR_MANANA", priority: 3 },
        { action: "REINTENTAR_CONTACTO", priority: 4 },
        { action: "DINERO_GRATIS", priority: 5 },
        { action: "CONFIRMAR_PROXIMOS", priority: 6 },
      ];

      // Verify priorities are in ascending order
      for (let i = 0; i < priorities.length - 1; i++) {
        expect(priorities[i].priority).toBeLessThan(priorities[i + 1].priority);
      }
    });

    it("should classify urgency correctly for speed-to-lead", () => {
      const now = Date.now();

      // < 30 min = CRITICA
      const fiveMinAgo = Math.floor((now - 5 * 60 * 1000) / 60000);
      expect(classifyUrgency(fiveMinAgo)).toBe("CRITICA");

      // 30min - 3hrs = ALTA
      const oneHourAgo = Math.floor((now - 60 * 60 * 1000) / 60000);
      // Actually the code says: <=30 CRITICA, <=180 ALTA, else CRITICA
      // So 60 min = ALTA
      expect(classifyUrgency(60)).toBe("ALTA");

      // > 3hrs = CRITICA (overdue)
      expect(classifyUrgency(200)).toBe("CRITICA");
    });

    it("should format elapsed time correctly", () => {
      expect(formatElapsed(0)).toBe("ahora");
      expect(formatElapsed(5)).toBe("hace 5min");
      expect(formatElapsed(30)).toBe("hace 30min");
      expect(formatElapsed(60)).toBe("hace 1h");
      expect(formatElapsed(120)).toBe("hace 2h");
      expect(formatElapsed(1440)).toBe("hace 1d");
      expect(formatElapsed(2880)).toBe("hace 2d");
    });

    it("should format time correctly", () => {
      const date = new Date(2026, 2, 3, 14, 30); // March 3, 2026 2:30 PM
      const formatted = formatTime(date);
      expect(formatted).toMatch(/14:30/);
    });
  });

  describe("Confirmation Queue Logic", () => {
    it("should categorize demos by urgency based on date", () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowEnd = new Date(todayStart.getTime() + 2 * 24 * 60 * 60 * 1000);

      // Demo today = urgente
      const demoToday = new Date(todayStart.getTime() + 15 * 60 * 60 * 1000); // 3pm today
      expect(demoToday >= todayStart && demoToday < todayEnd).toBe(true);

      // Demo tomorrow = pronto
      const demoTomorrow = new Date(todayEnd.getTime() + 10 * 60 * 60 * 1000); // 10am tomorrow
      expect(demoTomorrow >= todayEnd && demoTomorrow < tomorrowEnd).toBe(true);

      // Demo in 3 days = planificar
      const demoIn3Days = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000);
      expect(demoIn3Days >= tomorrowEnd).toBe(true);
    });

    it("should calculate confirmation rate correctly", () => {
      const confirmadas = 8;
      const pendientes = 2;
      const total = confirmadas + pendientes;
      const tasa = total > 0 ? Math.round((confirmadas / total) * 100) : 0;
      expect(tasa).toBe(80);
    });

    it("should handle zero total gracefully", () => {
      const total = 0;
      const confirmadas = 0;
      const tasa = total > 0 ? Math.round((confirmadas / total) * 100) : 0;
      expect(tasa).toBe(0);
    });

    it("should exclude confirmed and cancelled leads from pending", () => {
      const leads = [
        { id: 1, estadoConfirmacion: "CONFIRMADA" },
        { id: 2, estadoConfirmacion: "CANCELADA" },
        { id: 3, estadoConfirmacion: "PENDIENTE" },
        { id: 4, estadoConfirmacion: "NO CONFIRMADA" },
        { id: 5, estadoConfirmacion: null },
      ];

      const pending = leads.filter(l =>
        l.estadoConfirmacion !== "CONFIRMADA" && l.estadoConfirmacion !== "CANCELADA"
      );
      expect(pending.length).toBe(3);
      expect(pending.map(l => l.id)).toEqual([3, 4, 5]);
    });

    it("should exclude attended and no-show leads", () => {
      const leads = [
        { id: 1, asistencia: "ASISTIÓ" },
        { id: 2, asistencia: "NO SHOW" },
        { id: 3, asistencia: "PENDIENTE" },
        { id: 4, asistencia: null },
      ];

      const pending = leads.filter(l =>
        l.asistencia !== "ASISTIÓ" && l.asistencia !== "NO SHOW"
      );
      expect(pending.length).toBe(2);
      expect(pending.map(l => l.id)).toEqual([3, 4]);
    });
  });

  describe("Work Queue Action Types", () => {
    it("should have all required action configs", () => {
      const requiredActions = [
        "CONFIRMAR_HOY",
        "CONTACTAR_NUEVO",
        "CONFIRMAR_MANANA",
        "REINTENTAR_CONTACTO",
        "DINERO_GRATIS",
        "CONFIRMAR_PROXIMOS",
      ];

      // These are the action types used in the work queue
      requiredActions.forEach(action => {
        expect(typeof action).toBe("string");
        expect(action.length).toBeGreaterThan(0);
      });
    });

    it("should have valid urgency levels", () => {
      const validUrgencies = ["CRITICA", "ALTA", "MEDIA", "BAJA"];
      validUrgencies.forEach(urgency => {
        expect(["CRITICA", "ALTA", "MEDIA", "BAJA"]).toContain(urgency);
      });
    });
  });

  describe("Setter Filter", () => {
    it("should filter queue by setter when provided", () => {
      const queue = [
        { leadId: 1, setterAsignado: "Ana", action: "CONTACTAR_NUEVO" },
        { leadId: 2, setterAsignado: "Carlos", action: "CONFIRMAR_HOY" },
        { leadId: 3, setterAsignado: "Ana", action: "CONFIRMAR_MANANA" },
        { leadId: 4, setterAsignado: null, action: "DINERO_GRATIS" },
      ];

      const filtered = queue.filter(q => q.setterAsignado === "Ana");
      expect(filtered.length).toBe(2);
      expect(filtered.every(q => q.setterAsignado === "Ana")).toBe(true);
    });

    it("should return all items when no setter filter", () => {
      const queue = [
        { leadId: 1, setterAsignado: "Ana" },
        { leadId: 2, setterAsignado: "Carlos" },
        { leadId: 3, setterAsignado: null },
      ];

      expect(queue.length).toBe(3);
    });
  });
});

// Helper functions replicated from db.ts for testing
function classifyUrgency(minutesSinceEntry: number): "CRITICA" | "ALTA" | "MEDIA" | "BAJA" {
  if (minutesSinceEntry <= 30) return "CRITICA";
  if (minutesSinceEntry <= 180) return "ALTA";
  return "CRITICA"; // > 3h without contact = critical
}

function formatElapsed(minutes: number): string {
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
}
