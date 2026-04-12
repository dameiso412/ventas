import { describe, it, expect, vi } from "vitest";
import * as db from "./db";

// ==================== Unit Tests for calculateFunnel ====================
describe("Calculator - calculateFunnel", () => {
  const baseInputs = {
    mode: "reverse" as const,
    revenueGoal: 65000,
    adSpendInput: 2000,
    ticketPromedio: 3300,
    upfrontCashPct: 60,
    closeRate: 25,
    showRate: 60,
    confirmationRate: 85,
    answerRate: 85,
    bookingRate: 10,
    landingConvRate: 30,
    ctr: 2,
    cpm: 8,
    setterCapacity: 100,
    closerCapacity: 80,
    setterMonthlyCost: 0,
    closerMonthlyCost: 0,
  };

  describe("Reverse mode (Revenue Goal → Ad Spend)", () => {
    it("should calculate correct number of clients from revenue goal", () => {
      const result = db.calculateFunnel(baseInputs);
      // 65000 / 3300 = 19.7 → ceil = 20
      expect(result.clientesNecesarios).toBe(20);
    });

    it("should calculate demos from clients and close rate", () => {
      const result = db.calculateFunnel(baseInputs);
      // 20 / 0.25 = 80
      expect(result.demosNecesarias).toBe(80);
    });

    it("should calculate confirmed agendas from demos and show rate", () => {
      const result = db.calculateFunnel(baseInputs);
      // 80 / 0.60 = 133.33 → ceil = 134
      expect(result.agendasConfirmadas).toBe(134);
    });

    it("should calculate total agendas from confirmed and confirmation rate", () => {
      const result = db.calculateFunnel(baseInputs);
      // 134 / 0.85 = 157.6 → ceil = 158
      expect(result.agendasTotales).toBe(158);
    });

    it("should calculate contacted leads from agendas and answer rate", () => {
      const result = db.calculateFunnel(baseInputs);
      // 158 / 0.85 = 185.9 → ceil = 186
      expect(result.leadsContactados).toBe(186);
    });

    it("should calculate total leads from contacted and booking rate", () => {
      const result = db.calculateFunnel(baseInputs);
      // 186 / 0.10 = 1860
      expect(result.leadsTotales).toBe(1860);
    });

    it("should calculate clicks from leads and landing conv rate", () => {
      const result = db.calculateFunnel(baseInputs);
      // 1860 / 0.30 = 6200
      expect(result.clicksNecesarios).toBe(6200);
    });

    it("should calculate impressions from clicks and CTR", () => {
      const result = db.calculateFunnel(baseInputs);
      // 6200 / 0.02 = 310000
      expect(result.impresionesNecesarias).toBe(310000);
    });

    it("should calculate ad spend from impressions and CPM", () => {
      const result = db.calculateFunnel(baseInputs);
      // (310000 / 1000) * 8 = 2480
      expect(result.adSpendCalculated).toBe(2480);
    });

    it("should calculate CPL correctly", () => {
      const result = db.calculateFunnel(baseInputs);
      // 2480 / 1860 ≈ 1.33
      expect(result.cpl).toBeCloseTo(1.33, 1);
    });

    it("should calculate CPB correctly", () => {
      const result = db.calculateFunnel(baseInputs);
      // 2480 / 158 ≈ 15.70
      expect(result.cpb).toBeCloseTo(15.70, 0);
    });

    it("should calculate CPA correctly", () => {
      const result = db.calculateFunnel(baseInputs);
      // 2480 / 20 = 124
      expect(result.cpa).toBe(124);
    });

    it("should calculate ROAS correctly", () => {
      const result = db.calculateFunnel(baseInputs);
      // 65000 / 2480 ≈ 26.21
      expect(result.roas).toBeCloseTo(26.21, 0);
    });

    it("should calculate cash collected correctly", () => {
      const result = db.calculateFunnel(baseInputs);
      // 65000 * 0.60 = 39000
      expect(result.cashCollected).toBe(39000);
    });

    it("should calculate contracted revenue correctly", () => {
      const result = db.calculateFunnel(baseInputs);
      // 65000 - 39000 = 26000
      expect(result.contractedRevenue).toBe(26000);
    });

    it("should calculate setters needed", () => {
      const result = db.calculateFunnel(baseInputs);
      // 186 / 100 = 1.86
      expect(result.settersNecesarios).toBeCloseTo(1.86, 1);
    });

    it("should calculate closers needed", () => {
      const result = db.calculateFunnel(baseInputs);
      // 80 / 80 = 1
      expect(result.closersNecesarios).toBe(1);
    });
  });

  describe("Forward mode (Ad Spend → Revenue)", () => {
    it("should calculate revenue from ad spend", () => {
      const forwardInputs = { ...baseInputs, mode: "forward" as const, adSpendInput: 2000 };
      const result = db.calculateFunnel(forwardInputs);
      // 2000 / 8 * 1000 = 250000 impressions
      expect(result.impresionesNecesarias).toBe(250000);
    });

    it("should calculate clicks from impressions", () => {
      const forwardInputs = { ...baseInputs, mode: "forward" as const, adSpendInput: 2000 };
      const result = db.calculateFunnel(forwardInputs);
      // 250000 * 0.02 = 5000
      expect(result.clicksNecesarios).toBe(5000);
    });

    it("should calculate leads from clicks", () => {
      const forwardInputs = { ...baseInputs, mode: "forward" as const, adSpendInput: 2000 };
      const result = db.calculateFunnel(forwardInputs);
      // 5000 * 0.30 = 1500
      expect(result.leadsTotales).toBe(1500);
    });

    it("should calculate final revenue from clients", () => {
      const forwardInputs = { ...baseInputs, mode: "forward" as const, adSpendInput: 2000 };
      const result = db.calculateFunnel(forwardInputs);
      // Full funnel: 2000 spend → clients * 3300 = revenue
      expect(result.revenueCalculated).toBeGreaterThan(0);
      expect(result.clientesNecesarios).toBeGreaterThan(0);
      expect(result.revenueCalculated).toBe(result.clientesNecesarios * 3300);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero revenue goal", () => {
      const result = db.calculateFunnel({ ...baseInputs, revenueGoal: 0 });
      expect(result.clientesNecesarios).toBe(0);
      expect(result.adSpendCalculated).toBe(0);
    });

    it("should handle very high close rate", () => {
      const result = db.calculateFunnel({ ...baseInputs, closeRate: 100 });
      // 20 / 1.0 = 20 demos needed
      expect(result.demosNecesarias).toBe(20);
    });

    it("should handle team cost in CAC calculation", () => {
      const result = db.calculateFunnel({
        ...baseInputs,
        setterMonthlyCost: 1000,
        closerMonthlyCost: 2000,
      });
      // CAC should be higher than CPA when team costs are included
      expect(result.cac).toBeGreaterThan(result.cpa);
    });

    it("should calculate daily budget correctly", () => {
      const result = db.calculateFunnel(baseInputs);
      expect(result.presupuestoDiario).toBeCloseTo(result.presupuestoMensual / 30, 1);
    });
  });
});
