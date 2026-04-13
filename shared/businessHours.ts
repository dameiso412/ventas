/**
 * Business Hours Calculator — Chile timezone (America/Santiago)
 *
 * Working hours: Monday–Saturday, 10:00–20:00 Chile time
 * Sunday is non-working.
 *
 * Handles DST transitions (CLT UTC-3 ↔ CLST UTC-4) via Intl.DateTimeFormat.
 */

const TZ = "America/Santiago";
const BIZ_START_HOUR = 10; // 10:00 AM Chile
const BIZ_END_HOUR = 20;   // 8:00 PM Chile
const BIZ_HOURS_PER_DAY = BIZ_END_HOUR - BIZ_START_HOUR; // 10 hours

/**
 * Get Chile-local date parts from a UTC Date.
 */
function getChileParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: parseInt(get("year")),
    month: parseInt(get("month")),
    day: parseInt(get("day")),
    hour: parseInt(get("hour") === "24" ? "0" : get("hour")),
    minute: parseInt(get("minute")),
    dayOfWeek: weekdayMap[get("weekday")] ?? 0,
  };
}

/**
 * Build a Date in Chile timezone from year/month/day/hour/minute.
 * Uses a binary-search approach to find the UTC instant that corresponds
 * to the given Chile local time.
 */
function chileLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Start with a rough estimate (UTC-3)
  const estimate = new Date(Date.UTC(year, month - 1, day, hour + 3, minute));
  // Refine: check what Chile time the estimate maps to, then adjust
  const parts = getChileParts(estimate);
  const targetMinutes = hour * 60 + minute;
  const actualMinutes = parts.hour * 60 + parts.minute;
  const diffMinutes = targetMinutes - actualMinutes;
  return new Date(estimate.getTime() + diffMinutes * 60000);
}

/**
 * Is the given day (0=Sun) a working day? (Mon–Sat)
 */
function isWorkingDay(dayOfWeek: number): boolean {
  return dayOfWeek >= 1 && dayOfWeek <= 6; // Mon=1 .. Sat=6
}

/**
 * Calculate the number of business hours between two UTC Date objects.
 * Business hours: Mon–Sat 10:00–20:00 America/Santiago.
 *
 * Returns decimal hours (e.g., 0.08 ≈ 5 minutes).
 */
export function calculateBusinessHours(from: Date, to: Date): number {
  if (from >= to) return 0;

  const fromParts = getChileParts(from);
  const toParts = getChileParts(to);

  // Build start-of-day (00:00 Chile) for the from-date
  let cursor = chileLocalToUtc(fromParts.year, fromParts.month, fromParts.day, 0, 0);
  const endMs = to.getTime();

  let totalMinutes = 0;

  // Iterate day by day (max ~365 days to prevent infinite loops)
  for (let i = 0; i < 400; i++) {
    const dayParts = getChileParts(cursor);
    const dayStart = chileLocalToUtc(dayParts.year, dayParts.month, dayParts.day, BIZ_START_HOUR, 0);
    const dayEnd = chileLocalToUtc(dayParts.year, dayParts.month, dayParts.day, BIZ_END_HOUR, 0);

    if (dayStart.getTime() >= endMs) break; // Past the 'to' date

    if (isWorkingDay(dayParts.dayOfWeek)) {
      // Effective window: clamp to [from, to]
      const effectiveStart = Math.max(dayStart.getTime(), from.getTime());
      const effectiveEnd = Math.min(dayEnd.getTime(), endMs);

      if (effectiveEnd > effectiveStart) {
        totalMinutes += (effectiveEnd - effectiveStart) / 60000;
      }
    }

    // Move cursor to next day
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimals
}
