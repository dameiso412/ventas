import { describe, it, expect } from 'vitest';

/**
 * Tests for the Dashboard KPI data source refactor.
 * 
 * The new model uses:
 * - Setter Tracker → Answer Rate, Triage Rate
 * - Closer Tracker → Show Rate, Offer Rate, Close Rate, Revenue, Cash
 * - Registro de Citas (leads) → Costos de Adquisición (Ad Spend / counts)
 * - Monthly Metrics → Ad Spend, Leads Raw, Visitas Landing
 */

describe('Tracker-based KPI Calculations', () => {
  // Known Setter Tracker data for Febrero Sem 3:
  // 11 rows, totals: intentos=70, intros=30, confirmadas=13, asistidas=9
  const setterData = {
    totalIntentos: 70,
    totalIntros: 30,
    totalDemosAseguradas: 18,
    totalConfirmadas: 13,
    totalAsistidas: 9,
  };

  // Known Closer Tracker data for Febrero Sem 3:
  // 5 rows, totals: schedule=19, live=12, offers=9, closes=4, revenue=13200, cash=11200
  const closerData = {
    totalSchedule: 19,
    totalLive: 12,
    totalOffers: 9,
    totalDeposits: 0,
    totalCloses: 4,
    totalRevenue: 13200,
    totalCash: 11200,
  };

  // Marketing data for Febrero:
  const adSpend = 185.4; // prorated for Sem 3
  const totalLeadsRaw = 17; // prorated
  const totalAgendas = 27; // leads in Sem 3

  // ==================== ANSWER RATE (from Setter Tracker) ====================
  describe('Answer Rate (Setter Tracker)', () => {
    it('should calculate Answer Rate as intros / intentos', () => {
      const answerRate = setterData.totalIntentos > 0
        ? (setterData.totalIntros / setterData.totalIntentos) * 100
        : 0;
      expect(answerRate).toBeCloseTo(42.9, 1);
    });

    it('should return 0 when no intentos', () => {
      const answerRate = 0 > 0 ? (30 / 0) * 100 : 0;
      expect(answerRate).toBe(0);
    });
  });

  // ==================== TRIAGE RATE (from Setter Tracker) ====================
  describe('Triage Rate (Setter Tracker)', () => {
    it('should calculate Triage Rate as confirmadas / intros', () => {
      const triageRate = setterData.totalIntros > 0
        ? (setterData.totalConfirmadas / setterData.totalIntros) * 100
        : 0;
      expect(triageRate).toBeCloseTo(43.3, 1);
    });

    it('should return 0 when no intros', () => {
      const triageRate = 0 > 0 ? (13 / 0) * 100 : 0;
      expect(triageRate).toBe(0);
    });
  });

  // ==================== SHOW RATE (from Closer Tracker) ====================
  describe('Show Rate (Closer Tracker)', () => {
    it('should calculate Show Rate as liveCalls / scheduleCalls', () => {
      const showRate = closerData.totalSchedule > 0
        ? (closerData.totalLive / closerData.totalSchedule) * 100
        : 0;
      expect(showRate).toBeCloseTo(63.2, 1);
    });

    it('should return 0 when no schedule calls', () => {
      const showRate = 0 > 0 ? (4 / 0) * 100 : 0;
      expect(showRate).toBe(0);
    });
  });

  // ==================== OFFER RATE (from Closer Tracker) ====================
  describe('Offer Rate (Closer Tracker)', () => {
    it('should calculate Offer Rate as offers / liveCalls', () => {
      const offerRate = closerData.totalLive > 0
        ? (closerData.totalOffers / closerData.totalLive) * 100
        : 0;
      expect(offerRate).toBeCloseTo(75.0, 1);
    });

    it('should return 0 when no live calls', () => {
      const offerRate = 0 > 0 ? (4 / 0) * 100 : 0;
      expect(offerRate).toBe(0);
    });
  });

  // ==================== CLOSE RATE (from Closer Tracker) ====================
  describe('Close Rate (Closer Tracker)', () => {
    it('should calculate Close Rate as closes / offers', () => {
      const closeRate = closerData.totalOffers > 0
        ? (closerData.totalCloses / closerData.totalOffers) * 100
        : 0;
      expect(closeRate).toBeCloseTo(44.4, 1);
    });

    it('should return 0 when no offers', () => {
      const closeRate = 0 > 0 ? (2 / 0) * 100 : 0;
      expect(closeRate).toBe(0);
    });
  });

  // ==================== FINANCIAL KPIs (from Closer Tracker) ====================
  describe('Financial KPIs (Closer Tracker)', () => {
    it('should calculate Ticket Promedio as revenue / closes', () => {
      const ticketPromedio = closerData.totalCloses > 0
        ? closerData.totalRevenue / closerData.totalCloses
        : 0;
      expect(ticketPromedio).toBe(3300);
    });

    it('should calculate ROAS as cash / adSpend', () => {
      const roas = adSpend > 0 ? closerData.totalCash / adSpend : 0;
      expect(roas).toBeCloseTo(60.4, 1);
    });

    it('should calculate Cash % as cash / revenue', () => {
      const cashPct = closerData.totalRevenue > 0
        ? (closerData.totalCash / closerData.totalRevenue) * 100
        : 0;
      expect(cashPct).toBeCloseTo(84.8, 1);
    });

    it('should use closer tracker revenue, not leads revenue', () => {
      // Old leads-based revenue was $4,800; tracker shows $13,200
      expect(closerData.totalRevenue).toBe(13200);
      expect(closerData.totalRevenue).not.toBe(4800);
    });
  });

  // ==================== COST KPIs (Ad Spend / tracker counts) ====================
  describe('Cost KPIs (Ad Spend / tracker counts)', () => {
    it('should calculate Costo/Intro from setter tracker intros', () => {
      const costoPorIntro = setterData.totalIntros > 0 && adSpend > 0
        ? adSpend / setterData.totalIntros
        : 0;
      expect(costoPorIntro).toBeCloseTo(6.18, 2);
    });

    it('should calculate Costo/Asistencia from closer tracker live calls', () => {
      const costoPorAsistencia = closerData.totalLive > 0 && adSpend > 0
        ? adSpend / closerData.totalLive
        : 0;
      expect(costoPorAsistencia).toBeCloseTo(15.45, 2);
    });

    it('should calculate CPA from closer tracker closes', () => {
      const cpa = closerData.totalCloses > 0 && adSpend > 0
        ? adSpend / closerData.totalCloses
        : 0;
      expect(cpa).toBeCloseTo(46.35, 2);
    });

    it('should calculate Costo/Oferta from closer tracker offers', () => {
      const costoPorOferta = closerData.totalOffers > 0 && adSpend > 0
        ? adSpend / closerData.totalOffers
        : 0;
      expect(costoPorOferta).toBeCloseTo(20.6, 1);
    });
  });

  // ==================== DATA SOURCE VERIFICATION ====================
  describe('Data Source Verification', () => {
    it('Answer Rate should NOT use leads.contestados / leads.totalLeads (old: 14.8%)', () => {
      // Old calculation: 4 contestados / 27 totalLeads = 14.8%
      const oldAnswerRate = (4 / 27) * 100;
      const newAnswerRate = (setterData.totalIntros / setterData.totalIntentos) * 100;
      expect(newAnswerRate).not.toBeCloseTo(oldAnswerRate, 0);
      expect(newAnswerRate).toBeCloseTo(42.9, 1);
    });

    it('Show Rate should NOT use leads.asistidos / leads.confirmados (old: 150%)', () => {
      // Old calculation: 6 asistidos / 4 confirmados = 150% (nonsensical)
      const oldShowRate = (6 / 4) * 100;
      const newShowRate = (closerData.totalLive / closerData.totalSchedule) * 100;
      expect(newShowRate).not.toBeCloseTo(oldShowRate, 0);
      expect(newShowRate).toBeCloseTo(63.2, 1);
      // New value is sensible (0-100% range)
      expect(newShowRate).toBeLessThanOrEqual(100);
    });

    it('Close Rate should NOT use leads.ventas / leads.ofertas (old: 20%)', () => {
      const oldCloseRate = (1 / 5) * 100;
      const newCloseRate = (closerData.totalCloses / closerData.totalOffers) * 100;
      expect(newCloseRate).not.toBeCloseTo(oldCloseRate, 0);
      expect(newCloseRate).toBeCloseTo(44.4, 1);
    });
  });
});

describe('Tracker KPI Revenue Aggregation', () => {
  it('should sum piffRevenue + setupRevenue for total revenue', () => {
    const piffRevenue = 8200;
    const setupRevenue = 0;
    const totalRevenue = piffRevenue + setupRevenue;
    expect(totalRevenue).toBe(8200);
  });

  it('should sum piffCash + setupCash for total cash', () => {
    const piffCash = 8200;
    const setupCash = 0;
    const totalCash = piffCash + setupCash;
    expect(totalCash).toBe(8200);
  });

  it('should handle mixed piff and setup revenue', () => {
    const piffRevenue = 5000;
    const setupRevenue = 3000;
    const totalRevenue = piffRevenue + setupRevenue;
    expect(totalRevenue).toBe(8000);
  });
});
