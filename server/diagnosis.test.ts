import { describe, expect, it } from "vitest";
import {
  evaluateMetric,
  COST_BENCHMARKS,
  RATE_BENCHMARKS,
  CONSTRAINT_SCENARIOS,
  HEALTH_COLORS,
  type HealthLevel,
  type BenchmarkRange,
} from "../shared/benchmarks";

// ============================================================
// evaluateMetric tests
// ============================================================
describe("evaluateMetric", () => {
  const cplBenchmark = COST_BENCHMARKS.find(b => b.metric === "cpl")!;
  const answerRateBenchmark = RATE_BENCHMARKS.find(b => b.metric === "answerRate")!;
  const closeRateBenchmark = RATE_BENCHMARKS.find(b => b.metric === "closeRate")!;
  const roasBenchmark = RATE_BENCHMARKS.find(b => b.metric === "roasFrontEnd")!;

  describe("cost metrics (lower is better)", () => {
    it("should rate CPL $3 as excellent", () => {
      expect(evaluateMetric(3, cplBenchmark)).toBe("excellent");
    });

    it("should rate CPL $7 as good", () => {
      expect(evaluateMetric(7, cplBenchmark)).toBe("good");
    });

    it("should rate CPL $12 as watch", () => {
      expect(evaluateMetric(12, cplBenchmark)).toBe("watch");
    });

    it("should rate CPL $18 as borderline", () => {
      expect(evaluateMetric(18, cplBenchmark)).toBe("borderline");
    });

    it("should rate CPL $22 as probCut", () => {
      expect(evaluateMetric(22, cplBenchmark)).toBe("probCut");
    });

    it("should rate CPL $30 as cut", () => {
      expect(evaluateMetric(30, cplBenchmark)).toBe("cut");
    });

    it("should rate CPL $0 as excellent", () => {
      expect(evaluateMetric(0, cplBenchmark)).toBe("excellent");
    });

    it("should rate CPL at exact boundary $5 as excellent", () => {
      expect(evaluateMetric(5, cplBenchmark)).toBe("excellent");
    });

    it("should rate CPL at exact boundary $10 as good", () => {
      expect(evaluateMetric(10, cplBenchmark)).toBe("good");
    });
  });

  describe("rate metrics (higher is better)", () => {
    it("should rate Answer Rate 90% as excellent", () => {
      expect(evaluateMetric(90, answerRateBenchmark)).toBe("excellent");
    });

    it("should rate Answer Rate 80% as good", () => {
      expect(evaluateMetric(80, answerRateBenchmark)).toBe("good");
    });

    it("should rate Answer Rate 70% as watch", () => {
      expect(evaluateMetric(70, answerRateBenchmark)).toBe("watch");
    });

    it("should rate Answer Rate 60% as borderline", () => {
      expect(evaluateMetric(60, answerRateBenchmark)).toBe("borderline");
    });

    it("should rate Answer Rate 50% as probCut", () => {
      expect(evaluateMetric(50, answerRateBenchmark)).toBe("probCut");
    });

    it("should rate Answer Rate 40% as cut", () => {
      expect(evaluateMetric(40, answerRateBenchmark)).toBe("cut");
    });

    it("should rate Answer Rate 0% as cut", () => {
      expect(evaluateMetric(0, answerRateBenchmark)).toBe("cut");
    });

    it("should rate Answer Rate 100% as excellent", () => {
      expect(evaluateMetric(100, answerRateBenchmark)).toBe("excellent");
    });
  });

  describe("close rate benchmarks", () => {
    it("should rate Close Rate 40% as excellent", () => {
      expect(evaluateMetric(40, closeRateBenchmark)).toBe("excellent");
    });

    it("should rate Close Rate 30% as good", () => {
      expect(evaluateMetric(30, closeRateBenchmark)).toBe("good");
    });

    it("should rate Close Rate 23% as watch", () => {
      expect(evaluateMetric(23, closeRateBenchmark)).toBe("watch");
    });

    it("should rate Close Rate 21% as borderline", () => {
      expect(evaluateMetric(21, closeRateBenchmark)).toBe("borderline");
    });

    it("should rate Close Rate 17% as probCut", () => {
      expect(evaluateMetric(17, closeRateBenchmark)).toBe("probCut");
    });

    it("should rate Close Rate 10% as cut", () => {
      expect(evaluateMetric(10, closeRateBenchmark)).toBe("cut");
    });
  });

  describe("ROAS benchmarks", () => {
    it("should rate ROAS 5x as excellent", () => {
      expect(evaluateMetric(5, roasBenchmark)).toBe("excellent");
    });

    it("should rate ROAS 3x as good", () => {
      expect(evaluateMetric(3, roasBenchmark)).toBe("good");
    });

    it("should rate ROAS 2.2x as watch", () => {
      expect(evaluateMetric(2.2, roasBenchmark)).toBe("watch");
    });

    it("should rate ROAS 1.7x as borderline", () => {
      expect(evaluateMetric(1.7, roasBenchmark)).toBe("borderline");
    });

    it("should rate ROAS 1.2x as probCut", () => {
      expect(evaluateMetric(1.2, roasBenchmark)).toBe("probCut");
    });

    it("should rate ROAS 0.5x as cut", () => {
      expect(evaluateMetric(0.5, roasBenchmark)).toBe("cut");
    });
  });
});

// ============================================================
// Benchmark data integrity tests
// ============================================================
describe("benchmark data integrity", () => {
  it("should have all cost benchmarks defined", () => {
    const expectedMetrics = ["cpl", "cpb", "cpbc", "cps", "cpa"];
    const actualMetrics = COST_BENCHMARKS.map(b => b.metric);
    expect(actualMetrics).toEqual(expectedMetrics);
  });

  it("should have all rate benchmarks defined", () => {
    const expectedMetrics = [
      "ctrUnico", "landingOptIn", "leadToBooking",
      "answerRate", "triageRate", "showRate", "closeRate",
      "ufCashPercent", "roasFrontEnd",
    ];
    const actualMetrics = RATE_BENCHMARKS.map(b => b.metric);
    expect(actualMetrics).toEqual(expectedMetrics);
  });

  it("all cost benchmarks should have higherIsBetter = false", () => {
    COST_BENCHMARKS.forEach(bm => {
      expect(bm.higherIsBetter).toBe(false);
    });
  });

  it("all rate benchmarks should have higherIsBetter = true", () => {
    RATE_BENCHMARKS.forEach(bm => {
      expect(bm.higherIsBetter).toBe(true);
    });
  });

  it("all benchmarks should have valid ranges (excellent < good < watch < borderline < probCut < cut for costs)", () => {
    COST_BENCHMARKS.forEach(bm => {
      expect(bm.excellent[1]).toBeLessThanOrEqual(bm.good[1]);
      expect(bm.good[1]).toBeLessThanOrEqual(bm.watch[1]);
      expect(bm.watch[1]).toBeLessThanOrEqual(bm.borderline[1]);
      expect(bm.borderline[1]).toBeLessThanOrEqual(bm.probCut[1]);
      expect(bm.probCut[1]).toBeLessThanOrEqual(bm.cut);
    });
  });

  it("all benchmarks should have valid ranges for rates (excellent > good > watch > borderline > probCut > cut)", () => {
    RATE_BENCHMARKS.forEach(bm => {
      expect(bm.excellent[0]).toBeGreaterThanOrEqual(bm.good[0]);
      expect(bm.good[0]).toBeGreaterThanOrEqual(bm.watch[0]);
      expect(bm.watch[0]).toBeGreaterThanOrEqual(bm.borderline[0]);
      expect(bm.borderline[0]).toBeGreaterThanOrEqual(bm.probCut[0]);
      expect(bm.probCut[0]).toBeGreaterThanOrEqual(bm.cut);
    });
  });

  it("HEALTH_COLORS should have entries for all 6 levels", () => {
    const levels: HealthLevel[] = ["excellent", "good", "watch", "borderline", "probCut", "cut"];
    levels.forEach(level => {
      expect(HEALTH_COLORS[level]).toBeDefined();
      expect(HEALTH_COLORS[level].bg).toBeTruthy();
      expect(HEALTH_COLORS[level].text).toBeTruthy();
      expect(HEALTH_COLORS[level].label).toBeTruthy();
    });
  });
});

// ============================================================
// Constraint scenario tests
// ============================================================
describe("constraint scenarios", () => {
  it("should have at least 8 scenarios defined", () => {
    expect(CONSTRAINT_SCENARIOS.length).toBeGreaterThanOrEqual(8);
  });

  it("all scenarios should have valid structure", () => {
    CONSTRAINT_SCENARIOS.forEach(scenario => {
      expect(scenario.id).toBeTruthy();
      expect(scenario.title).toBeTruthy();
      expect(scenario.category).toBeTruthy();
      expect([1, 2, 3]).toContain(scenario.layer);
      expect(scenario.conditions.length).toBeGreaterThan(0);
      expect(scenario.diagnosis).toBeTruthy();
      expect(scenario.actions.today.length).toBeGreaterThan(0);
      expect(scenario.actions.thisWeek.length).toBeGreaterThan(0);
      expect(scenario.actions.thisMonth.length).toBeGreaterThan(0);
    });
  });

  it("all scenario conditions should reference valid metrics", () => {
    const allMetrics = [...COST_BENCHMARKS, ...RATE_BENCHMARKS].map(b => b.metric);
    CONSTRAINT_SCENARIOS.forEach(scenario => {
      scenario.conditions.forEach(cond => {
        expect(allMetrics).toContain(cond.metric);
      });
    });
  });

  it("all scenario conditions should reference valid health levels", () => {
    const validLevels: HealthLevel[] = ["excellent", "good", "watch", "borderline", "probCut", "cut"];
    CONSTRAINT_SCENARIOS.forEach(scenario => {
      scenario.conditions.forEach(cond => {
        cond.level.forEach(level => {
          expect(validLevels).toContain(level);
        });
      });
    });
  });

  it("should have scenarios covering all 4 categories", () => {
    const categories = new Set(CONSTRAINT_SCENARIOS.map(s => s.category));
    expect(categories.has("marketing")).toBe(true);
    expect(categories.has("sales_setter")).toBe(true);
    expect(categories.has("sales_closer")).toBe(true);
    expect(categories.has("profitability")).toBe(true);
  });

  it("CPL high scenario should trigger when CPL is in borderline/probCut/cut", () => {
    const cplScenario = CONSTRAINT_SCENARIOS.find(s => s.id === "micro_cpl_high");
    expect(cplScenario).toBeDefined();
    expect(cplScenario!.conditions[0].metric).toBe("cpl");
    expect(cplScenario!.conditions[0].level).toContain("borderline");
    expect(cplScenario!.conditions[0].level).toContain("probCut");
    expect(cplScenario!.conditions[0].level).toContain("cut");
  });

  it("close rate low scenario should trigger when close rate is in borderline/probCut/cut", () => {
    const closeScenario = CONSTRAINT_SCENARIOS.find(s => s.id === "micro_close_rate_low");
    expect(closeScenario).toBeDefined();
    expect(closeScenario!.conditions[0].metric).toBe("closeRate");
    expect(closeScenario!.conditions[0].level).toContain("borderline");
    expect(closeScenario!.conditions[0].level).toContain("probCut");
    expect(closeScenario!.conditions[0].level).toContain("cut");
  });
});

// ============================================================
// Integration: Simulated constraint detection
// ============================================================
describe("constraint detection logic", () => {
  function simulateDiagnosis(metricValues: Record<string, number>) {
    const allBenchmarks = [...COST_BENCHMARKS, ...RATE_BENCHMARKS];
    const metrics = allBenchmarks.map(bm => {
      const value = metricValues[bm.metric] ?? 0;
      const level = evaluateMetric(value, bm);
      return { metric: bm.metric, label: bm.label, unit: bm.unit, value, level };
    });

    const constraints = CONSTRAINT_SCENARIOS.filter(scenario => {
      return scenario.conditions.every(cond => {
        const metricResult = metrics.find(m => m.metric === cond.metric);
        if (!metricResult) return false;
        return cond.level.includes(metricResult.level);
      });
    });

    return { metrics, constraints };
  }

  it("should detect no constraints when all metrics are excellent", () => {
    const excellentValues = {
      cpl: 3, cpb: 8, cpbc: 15, cps: 25, cpa: 80,
      ctrUnico: 3, landingOptIn: 20, leadToBooking: 80,
      answerRate: 90, triageRate: 85, showRate: 85, closeRate: 40,
      ufCashPercent: 85, roasFrontEnd: 5,
    };
    const { constraints } = simulateDiagnosis(excellentValues);
    expect(constraints.length).toBe(0);
  });

  it("should detect CPL constraint when CPL is $30", () => {
    const values = {
      cpl: 30, cpb: 8, cpbc: 15, cps: 25, cpa: 80,
      ctrUnico: 3, landingOptIn: 20, leadToBooking: 80,
      answerRate: 90, triageRate: 85, showRate: 85, closeRate: 40,
      ufCashPercent: 85, roasFrontEnd: 5,
    };
    const { constraints } = simulateDiagnosis(values);
    const cplConstraint = constraints.find(c => c.id === "micro_cpl_high");
    expect(cplConstraint).toBeDefined();
  });

  it("should detect answer rate constraint when answer rate is 40%", () => {
    const values = {
      cpl: 3, cpb: 8, cpbc: 15, cps: 25, cpa: 80,
      ctrUnico: 3, landingOptIn: 20, leadToBooking: 80,
      answerRate: 40, triageRate: 85, showRate: 85, closeRate: 40,
      ufCashPercent: 85, roasFrontEnd: 5,
    };
    const { constraints } = simulateDiagnosis(values);
    const answerConstraint = constraints.find(c => c.id === "micro_answer_rate_low");
    expect(answerConstraint).toBeDefined();
  });

  it("should detect close rate constraint when close rate is 10%", () => {
    const values = {
      cpl: 3, cpb: 8, cpbc: 15, cps: 25, cpa: 80,
      ctrUnico: 3, landingOptIn: 20, leadToBooking: 80,
      answerRate: 90, triageRate: 85, showRate: 85, closeRate: 10,
      ufCashPercent: 85, roasFrontEnd: 5,
    };
    const { constraints } = simulateDiagnosis(values);
    const closeConstraint = constraints.find(c => c.id === "micro_close_rate_low");
    expect(closeConstraint).toBeDefined();
  });

  it("should detect ROAS + CPA macro constraint when both are bad", () => {
    const values = {
      cpl: 3, cpb: 8, cpbc: 15, cps: 25, cpa: 250,
      ctrUnico: 3, landingOptIn: 20, leadToBooking: 80,
      answerRate: 90, triageRate: 85, showRate: 85, closeRate: 40,
      ufCashPercent: 85, roasFrontEnd: 0.8,
    };
    const { constraints } = simulateDiagnosis(values);
    const macroConstraint = constraints.find(c => c.id === "macro_roas_low_cpa_high");
    expect(macroConstraint).toBeDefined();
  });

  it("should NOT detect ROAS macro constraint when only ROAS is bad but CPA is good", () => {
    const values = {
      cpl: 3, cpb: 8, cpbc: 15, cps: 25, cpa: 80,
      ctrUnico: 3, landingOptIn: 20, leadToBooking: 80,
      answerRate: 90, triageRate: 85, showRate: 85, closeRate: 40,
      ufCashPercent: 85, roasFrontEnd: 0.8,
    };
    const { constraints } = simulateDiagnosis(values);
    const macroConstraint = constraints.find(c => c.id === "macro_roas_low_cpa_high");
    expect(macroConstraint).toBeUndefined();
  });

  it("should detect multiple constraints simultaneously", () => {
    const badValues = {
      cpl: 30, cpb: 50, cpbc: 70, cps: 80, cpa: 250,
      ctrUnico: 0.5, landingOptIn: 3, leadToBooking: 30,
      answerRate: 40, triageRate: 40, showRate: 50, closeRate: 10,
      ufCashPercent: 25, roasFrontEnd: 0.5,
    };
    const { constraints } = simulateDiagnosis(badValues);
    expect(constraints.length).toBeGreaterThanOrEqual(5);
  });

  it("should detect show rate constraint when show rate is 50%", () => {
    const values = {
      cpl: 3, cpb: 8, cpbc: 15, cps: 25, cpa: 80,
      ctrUnico: 3, landingOptIn: 20, leadToBooking: 80,
      answerRate: 90, triageRate: 85, showRate: 50, closeRate: 40,
      ufCashPercent: 85, roasFrontEnd: 5,
    };
    const { constraints } = simulateDiagnosis(values);
    const showConstraint = constraints.find(c => c.id === "micro_show_rate_low");
    expect(showConstraint).toBeDefined();
  });

  it("should detect cash percent constraint when cash is 25%", () => {
    const values = {
      cpl: 3, cpb: 8, cpbc: 15, cps: 25, cpa: 80,
      ctrUnico: 3, landingOptIn: 20, leadToBooking: 80,
      answerRate: 90, triageRate: 85, showRate: 85, closeRate: 40,
      ufCashPercent: 25, roasFrontEnd: 5,
    };
    const { constraints } = simulateDiagnosis(values);
    const cashConstraint = constraints.find(c => c.id === "micro_cash_percent_low");
    expect(cashConstraint).toBeDefined();
  });
});
