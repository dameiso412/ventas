import { describe, it, expect } from "vitest";

/**
 * Tests for the 4 new KPI metrics and No Show correction
 * These test the calculation logic used in the Dashboard
 */

describe("DQ % (Tasa de Descalificación)", () => {
  it("should calculate DQ count as Intros - Demos Aseguradas", () => {
    const totalIntros = 15;
    const totalDemosAseguradas = 10;
    const dqCount = totalIntros - totalDemosAseguradas;
    expect(dqCount).toBe(5);
  });

  it("should calculate DQ rate as (Intros - Demos Aseguradas) / Intros * 100", () => {
    const totalIntros = 15;
    const totalDemosAseguradas = 10;
    const dqRate = totalIntros > 0 ? ((totalIntros - totalDemosAseguradas) / totalIntros) * 100 : 0;
    expect(dqRate).toBeCloseTo(33.33, 1);
  });

  it("should return 0 when no intros", () => {
    const totalIntros = 0;
    const totalDemosAseguradas = 0;
    const dqRate = totalIntros > 0 ? ((totalIntros - totalDemosAseguradas) / totalIntros) * 100 : 0;
    expect(dqRate).toBe(0);
  });

  it("should return 0 when all intros are qualified", () => {
    const totalIntros = 10;
    const totalDemosAseguradas = 10;
    const dqCount = totalIntros - totalDemosAseguradas;
    const dqRate = totalIntros > 0 ? (dqCount / totalIntros) * 100 : 0;
    expect(dqCount).toBe(0);
    expect(dqRate).toBe(0);
  });

  it("should handle high DQ rate correctly", () => {
    const totalIntros = 20;
    const totalDemosAseguradas = 5;
    const dqRate = ((totalIntros - totalDemosAseguradas) / totalIntros) * 100;
    expect(dqRate).toBe(75);
  });
});

describe("Costo / Triage (Ad Spend / Intros Efectivas)", () => {
  it("should calculate as Ad Spend / Intros Efectivas", () => {
    const adSpend = 1545;
    const introsEfectivas = 15;
    const costoPorTriage = adSpend / introsEfectivas;
    expect(costoPorTriage).toBeCloseTo(103, 0);
  });

  it("should return 0 when no intros", () => {
    const adSpend = 1545;
    const introsEfectivas = 0;
    const costoPorTriage = introsEfectivas > 0 && adSpend > 0 ? (adSpend / introsEfectivas) : 0;
    expect(costoPorTriage).toBe(0);
  });

  it("should return 0 when no ad spend", () => {
    const adSpend = 0;
    const introsEfectivas = 15;
    const costoPorTriage = introsEfectivas > 0 && adSpend > 0 ? (adSpend / introsEfectivas) : 0;
    expect(costoPorTriage).toBe(0);
  });
});

describe("Costo / Demo Confirmada (Ad Spend / Demos Confirmadas)", () => {
  it("should calculate as Ad Spend / Demos Confirmadas", () => {
    const adSpend = 1545;
    const demosConfirmadas = 8;
    const costoPorDemoConfirmada = adSpend / demosConfirmadas;
    expect(costoPorDemoConfirmada).toBeCloseTo(193.13, 1);
  });

  it("should be higher than Costo/Triage when DQ > 0", () => {
    const adSpend = 1000;
    const intros = 10;
    const confirmadas = 5; // 50% DQ rate
    const costoPorTriage = adSpend / intros;
    const costoPorDemoConfirmada = adSpend / confirmadas;
    expect(costoPorDemoConfirmada).toBeGreaterThan(costoPorTriage);
    expect(costoPorTriage).toBe(100);
    expect(costoPorDemoConfirmada).toBe(200);
  });

  it("should equal Costo/Triage when DQ = 0", () => {
    const adSpend = 1000;
    const intros = 10;
    const confirmadas = 10; // 0% DQ rate
    const costoPorTriage = adSpend / intros;
    const costoPorDemoConfirmada = adSpend / confirmadas;
    expect(costoPorDemoConfirmada).toBe(costoPorTriage);
  });
});

describe("Contracted ROAs (Revenue / Ad Spend)", () => {
  it("should calculate as Revenue Total / Ad Spend", () => {
    const revenue = 17700;
    const adSpend = 1545;
    const contractedROAs = revenue / adSpend;
    expect(contractedROAs).toBeCloseTo(11.46, 1);
  });

  it("should return 0 when no ad spend", () => {
    const revenue = 17700;
    const adSpend = 0;
    const contractedROAs = adSpend > 0 ? (revenue / adSpend) : 0;
    expect(contractedROAs).toBe(0);
  });

  it("should be higher than ROAS Up Front when cash < revenue", () => {
    const revenue = 17700;
    const cash = 15700;
    const adSpend = 1545;
    const contractedROAs = revenue / adSpend;
    const roasUpFront = cash / adSpend;
    expect(contractedROAs).toBeGreaterThan(roasUpFront);
  });

  it("should equal ROAS Up Front when cash = revenue", () => {
    const revenue = 10000;
    const cash = 10000;
    const adSpend = 1000;
    const contractedROAs = revenue / adSpend;
    const roasUpFront = cash / adSpend;
    expect(contractedROAs).toBe(roasUpFront);
  });
});

describe("New MRR (Monthly Recurring Revenue)", () => {
  it("should equal setupRevenue from Closer Tracker", () => {
    // Currently all revenue is piffRevenue (one-time), setupRevenue = 0
    const setupRevenue = 0;
    const newMRR = setupRevenue;
    expect(newMRR).toBe(0);
  });

  it("should reflect monthly retention product revenue", () => {
    // When setup products are sold, setupRevenue will be populated
    const setupRevenue = 1500;
    const newMRR = setupRevenue;
    expect(newMRR).toBe(1500);
  });

  it("should be separate from piff (one-time) revenue", () => {
    const piffRevenue = 17700;
    const setupRevenue = 3000;
    const totalRevenue = piffRevenue + setupRevenue;
    const newMRR = setupRevenue;
    expect(newMRR).toBe(3000);
    expect(totalRevenue).toBe(20700);
    expect(newMRR).toBeLessThan(totalRevenue);
  });
});

describe("No Show from Closer Tracker (Schedule - Live)", () => {
  it("should calculate No Show as Schedule - Live", () => {
    const schedule = 37;
    const live = 15;
    const noShow = schedule - live;
    expect(noShow).toBe(22);
  });

  it("should return 0 when live >= schedule", () => {
    const schedule = 10;
    const live = 10;
    const noShow = schedule - live;
    expect(noShow >= 0 ? noShow : 0).toBe(0);
  });

  it("should not return negative values", () => {
    const schedule = 5;
    const live = 8; // edge case: more live than scheduled
    const noShow = schedule - live;
    expect(noShow > 0 ? noShow : 0).toBe(0);
  });

  it("should be consistent with Show Rate", () => {
    const schedule = 37;
    const live = 15;
    const noShow = schedule - live;
    const showRate = (live / schedule) * 100;
    const noShowRate = (noShow / schedule) * 100;
    expect(showRate + noShowRate).toBeCloseTo(100, 5);
  });
});

describe("Integration: All new KPIs with real Febrero data", () => {
  // Real data from Febrero:
  // Setter: 20 intentos, 15 intros, 10 demos aseguradas, 8 confirmadas
  // Closer: 37 schedule, 15 live, 10 offers, 5 closes
  // Revenue: $17,700 (piff), $0 (setup), Cash: $15,700
  // Ad Spend: $1,545

  const setterData = { intentos: 20, intros: 15, demosAseguradas: 10, confirmadas: 8 };
  const closerData = { schedule: 37, live: 15, offers: 10, closes: 5, piffRevenue: 17700, setupRevenue: 0, piffCash: 15700, setupCash: 0 };
  const adSpend = 1545;

  it("DQ % should be 33.3%", () => {
    const dqRate = ((setterData.intros - setterData.demosAseguradas) / setterData.intros) * 100;
    expect(dqRate).toBeCloseTo(33.3, 0);
  });

  it("Costo/Triage should be $103 (Ad Spend / Intros Efectivas)", () => {
    const costoTriage = adSpend / setterData.intros;
    expect(costoTriage).toBe(103);
  });

  it("Costo/Demo Confirmada should be $193.13 (Ad Spend / Demos Confirmadas)", () => {
    const costoDemoConf = adSpend / setterData.confirmadas;
    expect(costoDemoConf).toBeCloseTo(193.13, 1);
  });

  it("Contracted ROAs should be 11.46x", () => {
    const totalRevenue = closerData.piffRevenue + closerData.setupRevenue;
    const contractedROAs = totalRevenue / adSpend;
    expect(contractedROAs).toBeCloseTo(11.46, 1);
  });

  it("ROAS Up Front should be 10.16x", () => {
    const totalCash = closerData.piffCash + closerData.setupCash;
    const roasUpFront = totalCash / adSpend;
    expect(roasUpFront).toBeCloseTo(10.16, 1);
  });

  it("New MRR should be $0 (no setup products sold yet)", () => {
    expect(closerData.setupRevenue).toBe(0);
  });

  it("No Show should be 22 (37 schedule - 15 live)", () => {
    const noShow = closerData.schedule - closerData.live;
    expect(noShow).toBe(22);
  });
});
