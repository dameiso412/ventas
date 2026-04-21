/**
 * Meta Ads API Service
 * Handles communication with the Meta Marketing API for ad insights,
 * campaign/adset/ad metadata, and UTM tag management.
 */
import { ENV } from "./_core/env";

const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface MetaApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
  };
}

async function metaFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("access_token", ENV.fbAccessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok || (data as MetaApiError).error) {
    const err = (data as MetaApiError).error;
    throw new Error(`Meta API Error: ${err?.message ?? response.statusText} (code: ${err?.code ?? response.status})`);
  }

  return data as T;
}

// ==================== CAMPAIGNS ====================

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
}

interface MetaPaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

export async function fetchCampaigns(): Promise<MetaCampaign[]> {
  const accountId = ENV.metaAdAccountId;
  const result = await metaFetch<MetaPaginatedResponse<MetaCampaign>>(
    `/${accountId}/campaigns`,
    { fields: "id,name,status,objective", limit: "500" }
  );
  return result.data;
}

// ==================== ADSETS ====================

interface MetaAdset {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  targeting?: { age_min?: number; age_max?: number; geo_locations?: any };
}

export async function fetchAdsets(campaignId?: string): Promise<MetaAdset[]> {
  const accountId = ENV.metaAdAccountId;
  const endpoint = campaignId
    ? `/${campaignId}/adsets`
    : `/${accountId}/adsets`;
  const result = await metaFetch<MetaPaginatedResponse<MetaAdset>>(
    endpoint,
    { fields: "id,name,status,campaign_id,targeting", limit: "500" }
  );
  return result.data;
}

// ==================== ADS ====================

interface MetaAd {
  id: string;
  name: string;
  status: string;
  adset_id?: string;
  campaign_id?: string;
  creative?: { id: string };
  tracking_specs?: any;
  url_tags?: string;
}

export async function fetchAds(adsetId?: string): Promise<MetaAd[]> {
  const accountId = ENV.metaAdAccountId;
  const endpoint = adsetId
    ? `/${adsetId}/ads`
    : `/${accountId}/ads`;
  const result = await metaFetch<MetaPaginatedResponse<MetaAd>>(
    endpoint,
    { fields: "id,name,status,adset_id,campaign_id,tracking_specs,url_tags", limit: "500" }
  );
  return result.data;
}

// ==================== INSIGHTS ====================

interface MetaInsightAction {
  action_type: string;
  value: string;
}

interface MetaInsight {
  campaign_id: string;
  campaign_name: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  ctr: string;
  cpc: string;
  actions?: MetaInsightAction[];
  cost_per_action_type?: MetaInsightAction[];
  date_start: string;
  date_stop: string;
}

export interface ParsedInsight {
  fecha: Date;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  adId: string;
  adName: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  leads: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  cpl: number;
  costPerResult: number; // cost_per_action_type for lead/result
}

/**
 * Fetch insights at the ad level with daily granularity for a given date range.
 * This gives us the most granular data for attribution.
 */
export async function fetchInsights(
  dateFrom: string,
  dateTo: string,
  level: "campaign" | "adset" | "ad" = "ad"
): Promise<ParsedInsight[]> {
  const accountId = ENV.metaAdAccountId;

  const fields = [
    "campaign_id", "campaign_name",
    "adset_id", "adset_name",
    "ad_id", "ad_name",
    "impressions", "clicks", "spend", "reach",
    "ctr", "cpc", "actions", "cost_per_action_type",
  ].join(",");

  const result = await metaFetch<MetaPaginatedResponse<MetaInsight>>(
    `/${accountId}/insights`,
    {
      fields,
      level,
      time_increment: "1",
      time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
      limit: "1000",
    }
  );

  return result.data.map(parseInsight);
}

function parseInsight(raw: MetaInsight): ParsedInsight {
  const leads = extractActionValue(raw.actions, [
    "lead", "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.lead_grouped",
  ]);
  const linkClicks = extractActionValue(raw.actions, ["link_click"]);
  const spend = parseFloat(raw.spend) || 0;

  // Extract cost per result (cost per lead/booking) from cost_per_action_type
  const costPerResult = extractActionValueFloat(raw.cost_per_action_type, [
    "lead", "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.lead_grouped",
  ]);

  return {
    fecha: new Date(raw.date_start),
    campaignId: raw.campaign_id,
    campaignName: raw.campaign_name,
    adsetId: raw.adset_id ?? "",
    adsetName: raw.adset_name ?? "",
    adId: raw.ad_id ?? "",
    adName: raw.ad_name ?? "",
    impressions: parseInt(raw.impressions) || 0,
    clicks: parseInt(raw.clicks) || 0,
    spend,
    reach: parseInt(raw.reach) || 0,
    leads,
    linkClicks,
    ctr: parseFloat(raw.ctr) || 0,
    cpc: parseFloat(raw.cpc) || 0,
    cpl: leads > 0 ? spend / leads : 0,
    costPerResult: costPerResult > 0 ? costPerResult : (leads > 0 ? spend / leads : 0),
  };
}

function extractActionValue(actions: MetaInsightAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  let total = 0;
  for (const action of actions) {
    if (types.includes(action.action_type)) {
      total += parseInt(action.value) || 0;
    }
  }
  return total;
}

function extractActionValueFloat(actions: MetaInsightAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  for (const action of actions) {
    if (types.includes(action.action_type)) {
      return parseFloat(action.value) || 0;
    }
  }
  return 0;
}

// ==================== UTM TAG MANAGEMENT ====================

/**
 * Check which ads have UTM tags configured and which don't.
 */
export async function checkUtmStatus(): Promise<{
  withUtm: { id: string; name: string; urlTags: string }[];
  withoutUtm: { id: string; name: string }[];
}> {
  const ads = await fetchAds();
  const withUtm: { id: string; name: string; urlTags: string }[] = [];
  const withoutUtm: { id: string; name: string }[] = [];

  for (const ad of ads) {
    if (ad.url_tags && ad.url_tags.includes("utm_")) {
      withUtm.push({ id: ad.id, name: ad.name, urlTags: ad.url_tags });
    } else {
      withoutUtm.push({ id: ad.id, name: ad.name });
    }
  }

  return { withUtm, withoutUtm };
}

/**
 * Get the recommended UTM tag string for Meta Ads.
 * Uses dynamic macros that Meta replaces at serve time.
 */
export function getRecommendedUtmTags(): string {
  return [
    "utm_source=facebook",
    "utm_medium=paid_social",
    "utm_campaign={{campaign.id}}",
    "utm_content={{ad.id}}",
    "utm_term={{adset.id}}",
  ].join("&");
}

/**
 * Validate that the FB_ACCESS_TOKEN is working by making a simple API call.
 */
export async function validateToken(): Promise<{
  valid: boolean;
  accountName?: string;
  error?: string;
}> {
  try {
    const accountId = ENV.metaAdAccountId;
    const result = await metaFetch<{ id: string; name: string; account_status: number }>(
      `/${accountId}`,
      { fields: "id,name,account_status" }
    );
    return { valid: true, accountName: result.name };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

// ==================== AD CREATIVES ====================

/**
 * Parsed creative used to upsert into `ad_creatives`. Normalised across
 * video / image / link / Instagram ads so the UI can render a single
 * component regardless of the original format.
 */
export interface ParsedCreative {
  adId: string;
  creativeId: string | null;
  videoId: string | null;
  videoSourceUrl: string | null;
  videoPermalinkUrl: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  title: string | null;
  body: string | null;
  callToActionType: string | null;
  destinationUrl: string | null;
  instagramPermalinkUrl: string | null;
  effectiveObjectStoryId: string | null;
}

/** Raw creative payload returned by Meta Graph (partial fields we care about). */
interface MetaCreative {
  id: string;
  title?: string;
  name?: string;
  body?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  effective_object_story_id?: string;
  effective_instagram_media_id?: string;
  instagram_permalink_url?: string;
  call_to_action_type?: string;
  url_tags?: string;
  object_story_spec?: {
    link_data?: {
      link?: string;
      message?: string;
      name?: string;
      description?: string;
      call_to_action?: { type?: string };
      image_hash?: string;
    };
    video_data?: {
      video_id?: string;
      title?: string;
      message?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
    };
  };
}

interface MetaVideo {
  id: string;
  source?: string;
  permalink_url?: string;
  picture?: string;
}

const CREATIVE_FIELDS = [
  "id",
  "title",
  "name",
  "body",
  "thumbnail_url",
  "image_url",
  "video_id",
  "effective_object_story_id",
  "effective_instagram_media_id",
  "instagram_permalink_url",
  "call_to_action_type",
  "url_tags",
  "object_story_spec{link_data{link,message,name,description,call_to_action,image_hash},video_data{video_id,title,message,call_to_action}}",
].join(",");

/**
 * Fetch ad creatives from the Meta Ads account.
 *
 * Uses `/{accountId}/ads?fields=id,creative{...}` with cursor pagination —
 * the standard account-level ads endpoint. This is more reliable than the
 * `?ids=` batch lookup, which silently omits the `creative` expansion for
 * many ad types.
 *
 * Optional `adIds` set: when provided, only ads whose IDs are in that set are
 * processed (so we sync just what syncStructure already fetched). When omitted,
 * all ads in the account are fetched.
 *
 * Does a second pass to expand video source URLs (Graph returns only
 * `video_id`; we need the mp4 to render `<video src>`).
 */
export interface FetchCreativesResult {
  creatives: ParsedCreative[];
  stats: {
    adsSeen: number;
    adsWithCreative: number;
    creativesParsed: number;
    videosExpanded: number;
    firstAdSample: unknown;
    lastError: string | null;
  };
}

export async function fetchAdCreatives(adIds?: string[]): Promise<ParsedCreative[]> {
  const res = await fetchAdCreativesWithStats(adIds);
  return res.creatives;
}

/**
 * Same as fetchAdCreatives but also returns diagnostic stats. The sync
 * endpoint uses these so operators see exactly where the pipeline dropped
 * off (e.g., "236 ads seen, 0 with creative field" → token permission issue).
 */
export async function fetchAdCreativesWithStats(adIds?: string[]): Promise<FetchCreativesResult> {
  const accountId = ENV.metaAdAccountId;
  const adIdSet = adIds && adIds.length ? new Set(adIds.filter(Boolean)) : null;

  const creatives: ParsedCreative[] = [];
  const videoIds = new Set<string>();
  const stats: FetchCreativesResult["stats"] = {
    adsSeen: 0,
    adsWithCreative: 0,
    creativesParsed: 0,
    videosExpanded: 0,
    firstAdSample: null,
    lastError: null,
  };

  let after: string | undefined;
  // Hard cap: 20 pages × 100 ads = 2 000 ads — enough for any realistic account.
  for (let page = 0; page < 20; page++) {
    const params: Record<string, string> = {
      fields: `id,creative{${CREATIVE_FIELDS}}`,
      limit: "100",
    };
    if (after) params.after = after;

    let resp: MetaPaginatedResponse<{ id: string; creative?: MetaCreative }>;
    try {
      resp = await metaFetchWithRetry(`/${accountId}/ads`, params);
    } catch (err: any) {
      stats.lastError = err?.message ?? "unknown";
      console.error(`[MetaAds:fetchAdCreatives] page ${page} failed:`, stats.lastError);
      break;
    }

    for (const ad of resp.data) {
      stats.adsSeen += 1;
      if (!stats.firstAdSample) stats.firstAdSample = ad;
      // Skip ads not in the requested set (when filtering by pre-fetched adIds).
      if (adIdSet && !adIdSet.has(ad.id)) continue;
      if (!ad.creative) continue;

      stats.adsWithCreative += 1;
      const parsed = parseCreative(ad.id, ad.creative);
      creatives.push(parsed);
      stats.creativesParsed += 1;
      if (parsed.videoId) videoIds.add(parsed.videoId);
    }

    // Paginate: stop when there's no next cursor or the page is empty.
    const nextCursor = resp.paging?.cursors?.after;
    if (!nextCursor || !resp.paging?.next || resp.data.length === 0) break;
    after = nextCursor;
  }

  // Fallback: when the account-level batch returns nothing useful (e.g., token
  // permission gap silently strips the `creative` object), iterate per ad.
  // This is slower (one request per ad) but uses a different Graph path that
  // some token scopes allow even when the batch expansion doesn't.
  if (stats.adsWithCreative === 0 && adIdSet && adIdSet.size > 0) {
    console.warn(
      `[MetaAds:fetchAdCreatives] batch returned 0 creatives for ${adIdSet.size} ads — falling back to per-ad requests.`
    );
    for (const adId of Array.from(adIdSet)) {
      try {
        const single = await metaFetchWithRetry<MetaCreative>(`/${adId}/adcreatives`, {
          fields: CREATIVE_FIELDS,
          limit: "1",
        });
        const data = (single as any)?.data?.[0];
        if (!data) continue;
        stats.adsWithCreative += 1;
        const parsed = parseCreative(adId, data);
        creatives.push(parsed);
        stats.creativesParsed += 1;
        if (parsed.videoId) videoIds.add(parsed.videoId);
      } catch (err: any) {
        stats.lastError = err?.message ?? stats.lastError;
      }
    }
  }

  // Second pass: expand video metadata so we have a playable source URL.
  if (videoIds.size) {
    const videoMap = await fetchVideoMetadata(Array.from(videoIds));
    for (const c of creatives) {
      if (c.videoId && videoMap[c.videoId]) {
        const v = videoMap[c.videoId];
        c.videoSourceUrl = v.source ?? c.videoSourceUrl;
        c.videoPermalinkUrl = v.permalink_url ?? c.videoPermalinkUrl;
        // Keep the existing thumbnail if Meta already returned one for the creative;
        // fall back to the video's `picture` frame otherwise.
        if (!c.thumbnailUrl && v.picture) c.thumbnailUrl = v.picture;
        stats.videosExpanded += 1;
      }
    }
  }

  return { creatives, stats };
}

/**
 * Diagnostic endpoint — hits Meta with a tiny, isolated request so operators
 * can inspect the raw response when syncs return empty. Returns the literal
 * JSON from Graph so we can see:
 *  - whether `creative` is being expanded (permission/scope issue),
 *  - whether nested fields like `object_story_spec` are rejected,
 *  - whether the account has no ads at all.
 */
export async function debugFetchCreatives(singleAdId?: string): Promise<{
  accountEndpoint: unknown;
  singleAdEndpoint: unknown;
  singleAdCreativesEndpoint: unknown;
}> {
  const accountId = ENV.metaAdAccountId;
  const accountEndpoint = await metaFetch<unknown>(`/${accountId}/ads`, {
    fields: `id,name,status,creative{${CREATIVE_FIELDS}}`,
    limit: "3",
  }).catch((e: any) => ({ error: e?.message ?? String(e) }));

  let singleAdEndpoint: unknown = null;
  let singleAdCreativesEndpoint: unknown = null;
  if (singleAdId) {
    singleAdEndpoint = await metaFetch<unknown>(`/${singleAdId}`, {
      fields: `id,name,status,creative{${CREATIVE_FIELDS}}`,
    }).catch((e: any) => ({ error: e?.message ?? String(e) }));
    singleAdCreativesEndpoint = await metaFetch<unknown>(`/${singleAdId}/adcreatives`, {
      fields: CREATIVE_FIELDS,
      limit: "5",
    }).catch((e: any) => ({ error: e?.message ?? String(e) }));
  }

  return { accountEndpoint, singleAdEndpoint, singleAdCreativesEndpoint };
}

/**
 * Fetch source+permalink for each video ID. Batched the same way as creatives.
 * Returns a map keyed by videoId.
 */
async function fetchVideoMetadata(videoIds: string[]): Promise<Record<string, MetaVideo>> {
  if (!videoIds.length) return {};
  const chunks: string[][] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const result: Record<string, MetaVideo> = {};
  for (const chunk of chunks) {
    try {
      const batch = await metaFetchWithRetry<Record<string, MetaVideo>>("", {
        ids: chunk.join(","),
        fields: "source,permalink_url,picture",
      });
      for (const [vid, v] of Object.entries(batch)) {
        if (v && typeof v === "object") result[vid] = v;
      }
    } catch (err: any) {
      console.error(`[MetaAds:fetchVideoMetadata] chunk failed, skipping:`, err?.message);
    }
  }
  return result;
}

/** Normalise a Meta creative into the shape we persist. */
function parseCreative(adId: string, c: MetaCreative): ParsedCreative {
  const linkData = c.object_story_spec?.link_data;
  const videoData = c.object_story_spec?.video_data;

  const videoId = c.video_id || videoData?.video_id || null;
  const title = c.title || c.name || linkData?.name || videoData?.title || null;
  const body = c.body || linkData?.message || videoData?.message || null;
  const callToActionType =
    c.call_to_action_type ||
    linkData?.call_to_action?.type ||
    videoData?.call_to_action?.type ||
    null;

  const destinationUrl =
    linkData?.link ||
    videoData?.call_to_action?.value?.link ||
    null;

  // Build IG permalink from the effective story ID when Graph doesn't hand it directly.
  let instagramPermalinkUrl = c.instagram_permalink_url || null;
  if (!instagramPermalinkUrl && c.effective_instagram_media_id) {
    // `effective_instagram_media_id` is an IG post ID; Graph can't turn it into a
    // public URL without an IG Business token. We leave null and let the UI
    // fall back to `videoPermalinkUrl` / thumbnail.
  }

  return {
    adId,
    creativeId: c.id ?? null,
    videoId,
    videoSourceUrl: null, // filled by fetchVideoMetadata() pass
    videoPermalinkUrl: null,
    thumbnailUrl: c.thumbnail_url ?? null,
    imageUrl: c.image_url ?? null,
    title,
    body,
    callToActionType,
    destinationUrl,
    instagramPermalinkUrl,
    effectiveObjectStoryId: c.effective_object_story_id ?? null,
  };
}

/**
 * Exponential backoff wrapper around `metaFetch` for the creative fetches.
 * Meta's rate limiter returns specific error codes (4, 17, 613) — we retry up
 * to 3 times with 1s, 2s, 4s waits. Token/permission errors (190, 200) fail
 * fast because retrying won't help.
 */
async function metaFetchWithRetry<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await metaFetch<T>(endpoint, params);
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message ?? "");
      // Don't retry auth / permission errors
      if (msg.includes("code: 190") || msg.includes("code: 200") || msg.includes("code: 10")) {
        throw err;
      }
      const wait = 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
