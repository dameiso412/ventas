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
