/**
 * Landing page slug resolution.
 *
 * Lovable hosts 2-3 stable landings (EVTS-IN, DIAGNOSTICO, HOME). Each
 * redirects to a GHL survey which fires our webhook at /api/webhook/lead. We
 * want to aggregate conversion metrics per landing in /atribucion, so we
 * normalize whatever the webhook gives us to a small set of canonical slugs.
 *
 * Two sources, in priority order:
 *   1. `landing_slug` explicit custom field from GHL (preferred — zero
 *      ambiguity, marketer sets it per landing in the automation).
 *   2. Derived from `landing_url` via regex matching on URL path below.
 *
 * Why a static array instead of a DB table:
 *   - User has only 2-3 landings and they rename rarely.
 *   - An admin-editable mapping would add moving parts (UI + API + cache
 *     invalidation) for a list that changes quarterly at most.
 *   - If the list grows past ~5 stable landings, migrate to a table then.
 */

const LANDING_PATTERNS: ReadonlyArray<{ slug: string; match: RegExp }> = [
  // "evts-in" / "events-in" / "evtsin" / "eventsin" — any casing.
  { slug: "EVTS-IN", match: /evts-?in|events?-?in/i },
  // "diagnostico" (Spanish) or "diagnosis" (English fallback).
  { slug: "DIAGNOSTICO", match: /diagn[oó]stico|diagnosis/i },
  // Root path or explicit /index — treat as HOME.
  { slug: "HOME", match: /^\/?$|^\/index(\.html?)?$/i },
];

/**
 * Derive a canonical landing slug from a URL. Returns:
 *   - a matched slug (EVTS-IN, DIAGNOSTICO, HOME) when a pattern matches,
 *   - "OTRO" when the URL is valid but doesn't match any known landing,
 *   - null when the URL is absent.
 *
 * We match on `url.pathname` when the input is a full URL; otherwise fall
 * back to the raw string so that GHL payloads like `/evts-in?foo=bar` or
 * just `"EVTS-IN"` also resolve correctly.
 */
export function deriveLandingSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;

  let path = raw;
  try {
    // Accept full URLs (https://example.com/evts-in?utm=...) and extract path.
    path = new URL(raw).pathname;
  } catch {
    // Not a full URL — match against raw (covers "/evts-in", "EVTS-IN", etc.).
  }

  for (const { slug, match } of LANDING_PATTERNS) {
    if (match.test(path)) return slug;
  }
  return "OTRO";
}

/**
 * Resolve a landing slug from webhook input. Prefers an explicit slug in the
 * payload (GHL custom field or query param) and falls back to URL derivation.
 *
 * Accepts case-sensitive slugs verbatim when they match our known set; for
 * arbitrary user input we uppercase and check against known slugs to avoid
 * polluting the column with weird casing ("evts-in" vs "EVTS-IN"). Anything
 * unknown still passes through as-is (normalized to upper), since a new
 * landing might come online before the LANDING_PATTERNS list is updated.
 */
export function resolveLandingSlug(opts: {
  explicitSlug?: string | null;
  landingUrl?: string | null;
}): string | null {
  const { explicitSlug, landingUrl } = opts;

  if (explicitSlug && String(explicitSlug).trim()) {
    const normalized = String(explicitSlug).trim().toUpperCase();
    // Cap length at 50 (matches varchar(50) on the column) to avoid DB errors
    // if GHL ever sends something pathological.
    return normalized.slice(0, 50);
  }

  return deriveLandingSlug(landingUrl);
}

/** Exported for tests / admin UI — the canonical list of known slugs. */
export const KNOWN_LANDING_SLUGS = LANDING_PATTERNS.map((p) => p.slug);
