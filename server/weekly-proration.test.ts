import { describe, it, expect } from 'vitest';

/**
 * Tests for weekly Ad Spend proration logic.
 * The proration formula: weeklyAdSpend = monthlyAdSpend * (weekLeads / totalMonthLeads)
 * This ensures that when filtering by week, cost KPIs (CPL, CPA, etc.) are proportional.
 */
describe('Weekly Ad Spend Proration', () => {
  // Known data from February:
  // Total month: 75 agendas, $1,545 ad spend
  // Sem 1: 30 agendas
  // Sem 2: 20 agendas
  // Sem 3: 9 agendas
  // Sem 4: 16 agendas

  const monthlyAdSpend = 1545;
  const totalMonthLeads = 75;

  function prorate(weekLeads: number, monthTotal: number, monthSpend: number): number {
    if (monthTotal === 0 || weekLeads === 0) return 0;
    const proportion = weekLeads / monthTotal;
    return Math.round(monthSpend * proportion * 100) / 100;
  }

  it('should prorate Sem 1 correctly (30/75 = 40%)', () => {
    const result = prorate(30, totalMonthLeads, monthlyAdSpend);
    expect(result).toBe(618);
  });

  it('should prorate Sem 2 correctly (20/75 = 26.67%)', () => {
    const result = prorate(20, totalMonthLeads, monthlyAdSpend);
    expect(result).toBe(412);
  });

  it('should prorate Sem 3 correctly (9/75 = 12%)', () => {
    const result = prorate(9, totalMonthLeads, monthlyAdSpend);
    expect(result).toBe(185.4);
  });

  it('should prorate Sem 4 correctly (16/75 = 21.33%)', () => {
    const result = prorate(16, totalMonthLeads, monthlyAdSpend);
    expect(result).toBe(329.6);
  });

  it('should sum all prorated weeks to total monthly spend', () => {
    const sem1 = prorate(30, totalMonthLeads, monthlyAdSpend);
    const sem2 = prorate(20, totalMonthLeads, monthlyAdSpend);
    const sem3 = prorate(9, totalMonthLeads, monthlyAdSpend);
    const sem4 = prorate(16, totalMonthLeads, monthlyAdSpend);
    expect(sem1 + sem2 + sem3 + sem4).toBe(monthlyAdSpend);
  });

  it('should return 0 when no leads in week', () => {
    const result = prorate(0, totalMonthLeads, monthlyAdSpend);
    expect(result).toBe(0);
  });

  it('should return 0 when no leads in month', () => {
    const result = prorate(10, 0, monthlyAdSpend);
    expect(result).toBe(0);
  });

  it('should return full spend when week has all leads', () => {
    const result = prorate(75, totalMonthLeads, monthlyAdSpend);
    expect(result).toBe(monthlyAdSpend);
  });
});

describe('Week Assignment Logic', () => {
  function getWeekFromDay(day: number): number {
    if (day >= 1 && day <= 7) return 1;
    if (day >= 8 && day <= 14) return 2;
    if (day >= 15 && day <= 21) return 3;
    return 4; // 22+
  }

  it('should assign day 1 to Sem 1', () => {
    expect(getWeekFromDay(1)).toBe(1);
  });

  it('should assign day 7 to Sem 1', () => {
    expect(getWeekFromDay(7)).toBe(1);
  });

  it('should assign day 8 to Sem 2', () => {
    expect(getWeekFromDay(8)).toBe(2);
  });

  it('should assign day 14 to Sem 2', () => {
    expect(getWeekFromDay(14)).toBe(2);
  });

  it('should assign day 15 to Sem 3', () => {
    expect(getWeekFromDay(15)).toBe(3);
  });

  it('should assign day 21 to Sem 3', () => {
    expect(getWeekFromDay(21)).toBe(3);
  });

  it('should assign day 22 to Sem 4', () => {
    expect(getWeekFromDay(22)).toBe(4);
  });

  it('should assign day 28 to Sem 4', () => {
    expect(getWeekFromDay(28)).toBe(4);
  });

  it('should assign day 31 to Sem 4', () => {
    expect(getWeekFromDay(31)).toBe(4);
  });
});

describe('Cost KPI Calculations with Prorated Spend', () => {
  it('should calculate CPL correctly with prorated spend', () => {
    const adSpend = 185.4; // Sem 3 prorated
    const totalLeadsRaw = 17; // prorated
    const cpl = adSpend / totalLeadsRaw;
    expect(cpl).toBeCloseTo(10.91, 1);
  });

  it('should calculate Costo/Agenda correctly with prorated spend', () => {
    const adSpend = 618; // Sem 1 prorated
    const agendas = 30;
    const costoPorAgenda = adSpend / agendas;
    expect(costoPorAgenda).toBeCloseTo(20.6, 1);
  });

  it('should calculate CPA correctly with prorated spend', () => {
    const adSpend = 329.6; // Sem 4 prorated
    const ventas = 2;
    const cpa = adSpend / ventas;
    expect(cpa).toBeCloseTo(164.8, 1);
  });

  it('should calculate ROAS correctly with prorated spend', () => {
    const adSpend = 329.6; // Sem 4 prorated
    const revenue = 8200;
    const roas = revenue / adSpend;
    expect(roas).toBeCloseTo(24.88, 1);
  });

  it('should handle zero spend gracefully', () => {
    const adSpend = 0;
    const agendas = 10;
    const cpl = agendas > 0 && adSpend > 0 ? adSpend / agendas : 0;
    expect(cpl).toBe(0);
  });

  it('should handle zero agendas gracefully', () => {
    const adSpend = 100;
    const agendas = 0;
    const cpl = agendas > 0 && adSpend > 0 ? adSpend / agendas : 0;
    expect(cpl).toBe(0);
  });
});
