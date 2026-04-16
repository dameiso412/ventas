/**
 * Helpers for the business "period" used across the CRM:
 *   - `mes`: Spanish month name ("Enero", "Febrero", ..., "Diciembre")
 *   - `semana`: 1-5, computed as `ceil(day / 7)` of the current month
 *
 * All computations use Chile time (America/Santiago) — the business operates
 * on Santiago's calendar day, not the server's or the user's local one.
 *
 * Consumed by:
 *   - Every client page that has mes/semana filters so they open already
 *     scoped to the current period instead of "Todos".
 *   - Server code that would otherwise re-implement the same logic (cron,
 *     webhook).
 */

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export type Mes = (typeof MESES)[number];

const TZ = "America/Santiago";

/**
 * Month name in Chile timezone. Uses toLocaleDateString so the computation
 * remains correct on a server running in UTC or in the client running in a
 * different timezone than the business.
 */
export function getCurrentMes(): Mes {
  const monthIdx =
    parseInt(
      new Date().toLocaleDateString("en-US", { timeZone: TZ, month: "numeric" })
    ) - 1;
  return MESES[monthIdx];
}

/**
 * Week-of-month in Chile timezone, 1-5. Matches the formula used in the
 * webhook intake (`Math.ceil(day / 7)`), so filter values align with what the
 * backend stored for each lead.
 */
export function getCurrentSemana(): number {
  const day = parseInt(
    new Date().toLocaleDateString("en-US", { timeZone: TZ, day: "numeric" })
  );
  return Math.ceil(day / 7);
}

/**
 * Same formula applied to an arbitrary Date — useful when reasoning about
 * historical dates from other timezones.
 */
export function getSemanaFromDate(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}
