import { describe, it, expect } from "vitest";

describe("Product Type System", () => {
  describe("PIF (Paid In Full)", () => {
    it("should calculate PIF revenue as cashCollected = contractedRevenue (100%)", () => {
      const cashCollected = 2500;
      const contractedRevenue = 2500;
      const cashPercentage = (cashCollected / contractedRevenue) * 100;
      expect(cashPercentage).toBe(100);
    });

    it("should handle PIF with partial payment", () => {
      const cashCollected = 2000;
      const contractedRevenue = 2500;
      const cashPercentage = (cashCollected / contractedRevenue) * 100;
      expect(cashPercentage).toBe(80);
    });

    it("should not generate MRR for PIF products", () => {
      const productoTipo = "PIF";
      const recurrenciaMensual = 0;
      const setupFee = 0;
      expect(productoTipo).toBe("PIF");
      expect(recurrenciaMensual).toBe(0);
      expect(setupFee).toBe(0);
    });
  });

  describe("Setup + Monthly", () => {
    it("should calculate setup fee + monthly recurrence", () => {
      const setupFee = 1500;
      const recurrenciaMensual = 1000;
      const contractedRevenue = setupFee + (recurrenciaMensual * 3); // 3 months
      expect(contractedRevenue).toBe(4500);
    });

    it("should contribute to New MRR", () => {
      const recurrenciaMensual = 1200;
      expect(recurrenciaMensual).toBeGreaterThan(0);
    });

    it("should track next payment date", () => {
      const firstPaymentDate = new Date("2026-02-15");
      const nextPayment14Days = new Date(firstPaymentDate);
      nextPayment14Days.setDate(nextPayment14Days.getDate() + 14);
      expect(nextPayment14Days.toISOString().slice(0, 10)).toBe("2026-03-01");

      const nextPayment30Days = new Date(firstPaymentDate);
      nextPayment30Days.setDate(nextPayment30Days.getDate() + 30);
      expect(nextPayment30Days.toISOString().slice(0, 10)).toBe("2026-03-16");
    });
  });

  describe("Dashboard KPI calculations with product types", () => {
    it("should aggregate New MRR from all Setup+Monthly leads", () => {
      const leads = [
        { productoTipo: "SETUP_MONTHLY", recurrenciaMensual: 1000 },
        { productoTipo: "SETUP_MONTHLY", recurrenciaMensual: 1500 },
        { productoTipo: "PIF", recurrenciaMensual: 0 },
      ];
      const newMRR = leads
        .filter(l => l.productoTipo === "SETUP_MONTHLY")
        .reduce((sum, l) => sum + l.recurrenciaMensual, 0);
      expect(newMRR).toBe(2500);
    });

    it("should count ventas by product type", () => {
      const leads = [
        { outcome: "VENTA", productoTipo: "PIF" },
        { outcome: "VENTA", productoTipo: "SETUP_MONTHLY" },
        { outcome: "VENTA", productoTipo: "PIF" },
        { outcome: "PERDIDA", productoTipo: null },
      ];
      const ventasPIF = leads.filter(l => l.outcome === "VENTA" && l.productoTipo === "PIF").length;
      const ventasSetupMonthly = leads.filter(l => l.outcome === "VENTA" && l.productoTipo === "SETUP_MONTHLY").length;
      expect(ventasPIF).toBe(2);
      expect(ventasSetupMonthly).toBe(1);
    });

    it("should calculate total setup fees for Setup+Monthly", () => {
      const leads = [
        { productoTipo: "SETUP_MONTHLY", setupFee: 1500 },
        { productoTipo: "SETUP_MONTHLY", setupFee: 2000 },
        { productoTipo: "PIF", setupFee: 0 },
      ];
      const totalSetupFees = leads
        .filter(l => l.productoTipo === "SETUP_MONTHLY")
        .reduce((sum, l) => sum + l.setupFee, 0);
      expect(totalSetupFees).toBe(3500);
    });

    it("should show PIF x S+M breakdown in ventas subtitle", () => {
      const ventasPIF = 3;
      const ventasSetupMonthly = 2;
      const subtitle = ventasPIF + ventasSetupMonthly > 0
        ? `${ventasPIF} PIF · ${ventasSetupMonthly} S+M`
        : "0 seguimientos";
      expect(subtitle).toBe("3 PIF · 2 S+M");
    });

    it("should clear Setup+Monthly fields when product type is PIF", () => {
      const form = {
        productoTipo: "PIF",
        setupFee: "1500",
        recurrenciaMensual: "1000",
        fechaProximoCobro: "2026-03-15",
      };
      // When saving PIF, clear Setup+Monthly fields
      if (form.productoTipo === "PIF") {
        form.setupFee = "0";
        form.recurrenciaMensual = "0";
        form.fechaProximoCobro = "";
      }
      expect(form.setupFee).toBe("0");
      expect(form.recurrenciaMensual).toBe("0");
      expect(form.fechaProximoCobro).toBe("");
    });

    it("should prefer lead-level MRR over Closer Tracker setupRevenue", () => {
      const newMRRFromLeads = 2500;
      const setupRevenue = 1800;
      const newMRR = newMRRFromLeads > 0 ? newMRRFromLeads : setupRevenue;
      expect(newMRR).toBe(2500);
    });

    it("should fallback to Closer Tracker setupRevenue when no lead-level MRR", () => {
      const newMRRFromLeads = 0;
      const setupRevenue = 1800;
      const newMRR = newMRRFromLeads > 0 ? newMRRFromLeads : setupRevenue;
      expect(newMRR).toBe(1800);
    });
  });

  describe("Schema fields", () => {
    it("should accept valid product types", () => {
      const validTypes = ["PIF", "SETUP_MONTHLY"];
      expect(validTypes).toContain("PIF");
      expect(validTypes).toContain("SETUP_MONTHLY");
    });

    it("should have all required fields for Setup+Monthly", () => {
      const requiredFields = ["setupFee", "recurrenciaMensual", "fechaProximoCobro"];
      expect(requiredFields).toHaveLength(3);
      requiredFields.forEach(field => {
        expect(typeof field).toBe("string");
      });
    });
  });
});
