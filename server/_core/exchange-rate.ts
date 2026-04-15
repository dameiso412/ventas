/**
 * Real-time exchange rate service.
 * Fetches the ad account currency → USD rate from free APIs (no key needed).
 * Caches the rate in memory with a 6-hour TTL.
 * Falls back to AD_SPEND_DIVISOR env var if APIs are unreachable.
 *
 * Activated by setting AD_CURRENCY=CLP in environment.
 * If AD_CURRENCY=USD (default), no conversion is applied.
 */

import { ENV } from "./env";

interface CachedRate {
  rate: number;       // 1 USD = X units of account currency
  fetchedAt: number;
}

let cached: CachedRate | null = null;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const FALLBACK_RATES: Record<string, number> = {
  CLP: 950,
  MXN: 17,
  COP: 4200,
  ARS: 900,
  BRL: 5,
  EUR: 0.92,
};

/**
 * Get the divisor to convert ad spend from account currency to USD.
 *
 * Priority:
 * 1. No conversion needed (AD_CURRENCY=USD or unset) → returns 1
 * 2. Cached real-time rate (if fresh)
 * 3. Fresh API call → cache it
 * 4. Stale cache (if API fails)
 * 5. AD_SPEND_DIVISOR env var
 * 6. Hardcoded fallback for known currencies
 */
export async function getAdSpendDivisor(): Promise<number> {
  const currency = ENV.adCurrency;

  // No conversion needed
  if (currency === "USD") return 1;

  // Check cache
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
    return cached.rate;
  }

  // Try fetching fresh rate
  try {
    const rate = await fetchRate(currency);
    if (rate && rate > 0) {
      cached = { rate, fetchedAt: Date.now() };
      console.log(`[ExchangeRate] Live ${currency}/USD rate: ${rate.toFixed(2)}`);
      return rate;
    }
  } catch (err: any) {
    console.warn(`[ExchangeRate] API failed: ${err.message}`);
  }

  // Fallback: stale cache
  if (cached) {
    console.log(`[ExchangeRate] Using stale cache: ${cached.rate.toFixed(2)}`);
    return cached.rate;
  }

  // Fallback: env var
  if (ENV.adSpendDivisor > 1) {
    console.log(`[ExchangeRate] Using AD_SPEND_DIVISOR fallback: ${ENV.adSpendDivisor}`);
    return ENV.adSpendDivisor;
  }

  // Last resort: known currencies
  const fallback = FALLBACK_RATES[currency] || 1;
  console.warn(`[ExchangeRate] All sources failed, using hardcoded ${currency}/USD: ${fallback}`);
  return fallback;
}

/**
 * Fetch rate from free APIs. Tries multiple providers for resilience.
 */
async function fetchRate(currency: string): Promise<number | null> {
  // Provider 1: Open ER-API (free, no key, reliable)
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.[currency];
      if (typeof rate === "number" && rate > 0) return rate;
    }
  } catch { /* try next */ }

  // Provider 2: frankfurter (ECB data)
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.[currency];
      if (typeof rate === "number" && rate > 0) return rate;
    }
  } catch { /* all failed */ }

  return null;
}

/** Pre-warm the cache on server startup */
export async function initExchangeRate(): Promise<void> {
  if (ENV.adCurrency === "USD") {
    console.log("[ExchangeRate] AD_CURRENCY=USD, no conversion needed");
    return;
  }
  try {
    const rate = await getAdSpendDivisor();
    console.log(`[ExchangeRate] Ready: 1 USD = ${rate.toFixed(2)} ${ENV.adCurrency}`);
  } catch {
    // Non-fatal
  }
}
