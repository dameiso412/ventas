/**
 * Cron Job: Automatic Meta Ads Sync
 * 
 * Runs daily at 6:00 AM Chile time (UTC-3) to sync:
 * 1. Campaign/adset/ad structure (metadata)
 * 2. Daily insights for the current month
 * 
 * Also runs on server startup if the last sync was >12 hours ago.
 */
import * as metaAds from "./meta-ads";
import * as db from "./db";
import { ENV } from "./_core/env";

// Chile timezone offset: UTC-3 (CLT) / UTC-4 (CLST)
// We use a simple approach: check every hour if it's time to sync
const SYNC_HOUR_UTC = 9; // 6:00 AM Chile (UTC-3) = 9:00 UTC
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const MIN_SYNC_INTERVAL_MS = 10 * 60 * 60 * 1000; // Minimum 10 hours between syncs

let cronTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

/**
 * Perform a full Meta Ads sync: structure + insights for current month
 */
export async function performFullSync(syncType: "meta_ads_auto" | "meta_ads_manual" = "meta_ads_auto"): Promise<{
  success: boolean;
  logId: number;
  campaigns: number;
  adsets: number;
  ads: number;
  insights: number;
  creatives: number;
  creativesError: string | null;
  creativesStats: {
    adsSeen: number;
    adsWithCreative: number;
    creativesParsed: number;
    videosExpanded: number;
    lastError: string | null;
  } | null;
  durationMs: number;
  error?: string;
}> {
  const emptyCreatives = { creatives: 0, creativesError: null, creativesStats: null };
  if (isSyncing) {
    return { success: false, logId: 0, campaigns: 0, adsets: 0, ads: 0, insights: 0, ...emptyCreatives, durationMs: 0, error: "Sync already in progress" };
  }

  if (!ENV.fbAccessToken || !ENV.metaAdAccountId) {
    return { success: false, logId: 0, campaigns: 0, adsets: 0, ads: 0, insights: 0, ...emptyCreatives, durationMs: 0, error: "Missing FB_ACCESS_TOKEN or META_AD_ACCOUNT_ID" };
  }

  isSyncing = true;
  const startTime = Date.now();

  // Calculate date range: first day of current month to today
  const now = new Date();
  const dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const dateTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Create sync log entry
  const logId = await db.createSyncLog({
    syncType,
    status: "running",
    dateFrom,
    dateTo,
  });

  let campaignCount = 0;
  let adsetCount = 0;
  let adCount = 0;
  let insightCount = 0;
  let creativesSynced = 0;
  let creativesError: string | null = null;
  let creativesStats: {
    adsSeen: number;
    adsWithCreative: number;
    creativesParsed: number;
    videosExpanded: number;
    lastError: string | null;
  } | null = null;

  try {
    // Step 1: Sync structure (campaigns, adsets, ads)
    console.log(`[CronSync] Starting ${syncType} sync for ${dateFrom} to ${dateTo}...`);

    const campaigns = await metaAds.fetchCampaigns();
    for (const c of campaigns) {
      await db.upsertAdCampaign({ campaignId: c.id, name: c.name, status: c.status, objective: c.objective });
    }
    campaignCount = campaigns.length;

    const adsets = await metaAds.fetchAdsets();
    for (const a of adsets) {
      await db.upsertAdAdset({ adsetId: a.id, campaignId: a.campaign_id, name: a.name, status: a.status });
    }
    adsetCount = adsets.length;

    const ads = await metaAds.fetchAds();
    for (const ad of ads) {
      await db.upsertAdAd({ adId: ad.id, adsetId: ad.adset_id, campaignId: ad.campaign_id, name: ad.name, status: ad.status, urlTags: ad.url_tags });
    }
    adCount = ads.length;

    // Step 1b: Sync creatives (thumbnail/video/copy) for the ads we just upserted.
    // Wrapped in its own try so a creative-fetch failure doesn't abort the whole
    // sync — spend/insights data is more critical than creative metadata.
    try {
      const adIds = ads.map((a) => a.id).filter(Boolean);
      const result = await metaAds.fetchAdCreativesWithStats(adIds);
      creativesStats = {
        adsSeen: result.stats.adsSeen,
        adsWithCreative: result.stats.adsWithCreative,
        creativesParsed: result.stats.creativesParsed,
        videosExpanded: result.stats.videosExpanded,
        lastError: result.stats.lastError,
      };
      for (const c of result.creatives) {
        await db.upsertAdCreative(c);
        creativesSynced += 1;
      }
      if (result.stats.lastError && creativesSynced === 0) {
        creativesError = result.stats.lastError;
      }
      console.log(`[CronSync] Creatives: ${result.stats.adsSeen} seen, ${result.stats.adsWithCreative} with creative, ${creativesSynced} upserted`);
    } catch (err: any) {
      creativesError = err?.message ?? "fetchAdCreatives failed";
      console.error("[CronSync] Creative sync failed:", creativesError);
    }

    // Step 2: Sync insights at ad level for current month
    const insights = await metaAds.fetchInsights(dateFrom, dateTo, "ad");
    for (const row of insights) {
      await db.upsertAdMetricDaily({
        fecha: row.fecha,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        adsetId: row.adsetId,
        adsetName: row.adsetName,
        adId: row.adId,
        adName: row.adName,
        impressions: row.impressions,
        clicks: row.clicks,
        spend: String(row.spend),
        reach: row.reach,
        leads: row.leads,
        linkClicks: row.linkClicks,
        ctr: String(row.ctr),
        cpc: String(row.cpc),
        cpl: String(row.cpl),
        costPerResult: String(row.costPerResult),
      });
    }
    insightCount = insights.length;

    // Auto-aggregate monthly metrics from freshly synced daily data
    const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentMes = MESES[now.getMonth()];
    const currentAnio = now.getFullYear();
    const aggregated = await db.aggregateAdMetricsForMonth(currentMes, currentAnio);
    if (aggregated && aggregated.adSpend > 0) {
      await db.upsertMonthlyMetrics({
        mes: currentMes,
        anio: currentAnio,
        adSpend: String(aggregated.adSpend),
        totalLeadsRaw: aggregated.totalLeadsRaw,
        ctr: String(aggregated.ctr),
      });
      console.log(`[CronSync] Updated monthly_metrics for ${currentMes} ${currentAnio}: $${aggregated.adSpend} spend, ${aggregated.totalLeadsRaw} leads`);
    }

    const durationMs = Date.now() - startTime;

    // Update sync log as success
    await db.updateSyncLog(logId, {
      status: "success",
      campaignsSynced: campaignCount,
      adsetsSynced: adsetCount,
      adsSynced: adCount,
      insightsSynced: insightCount,
      durationMs,
      details: JSON.stringify({ campaigns: campaignCount, adsets: adsetCount, ads: adCount, insights: insightCount }),
    });

    console.log(`[CronSync] ✅ Sync complete: ${campaignCount} campaigns, ${adsetCount} adsets, ${adCount} ads, ${creativesSynced} creatives, ${insightCount} insights (${durationMs}ms)`);

    return {
      success: true,
      logId,
      campaigns: campaignCount,
      adsets: adsetCount,
      ads: adCount,
      insights: insightCount,
      creatives: creativesSynced,
      creativesError,
      creativesStats,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err.message || "Unknown error";

    await db.updateSyncLog(logId, {
      status: "error",
      campaignsSynced: campaignCount,
      adsetsSynced: adsetCount,
      adsSynced: adCount,
      insightsSynced: insightCount,
      durationMs,
      details: JSON.stringify({ error: errorMsg }),
    });

    console.error(`[CronSync] ❌ Sync failed after ${durationMs}ms: ${errorMsg}`);

    return {
      success: false,
      logId,
      campaigns: campaignCount,
      adsets: adsetCount,
      ads: adCount,
      insights: insightCount,
      creatives: creativesSynced,
      creativesError,
      creativesStats,
      durationMs,
      error: errorMsg,
    };
  } finally {
    isSyncing = false;
  }
}

/**
 * Check if enough time has passed since the last successful sync
 */
async function shouldSync(): Promise<boolean> {
  const lastSync = await db.getLastSyncLog("meta_ads_auto");
  if (!lastSync) return true;

  const timeSinceLastSync = Date.now() - new Date(lastSync.createdAt).getTime();
  return timeSinceLastSync >= MIN_SYNC_INTERVAL_MS;
}

/**
 * Hourly check: if it's the right hour and enough time has passed, sync
 */
async function cronCheck() {
  const nowUtc = new Date();
  const currentHourUtc = nowUtc.getUTCHours();

  // Only trigger at the designated sync hour (6 AM Chile = 9 UTC)
  if (currentHourUtc !== SYNC_HOUR_UTC) return;

  if (await shouldSync()) {
    console.log("[CronSync] Scheduled daily sync triggered");
    await performFullSync("meta_ads_auto");
  }
}

/**
 * Start the cron job scheduler.
 * Also performs an initial sync if the last one was >12 hours ago.
 */
export function startCronSync() {
  console.log("[CronSync] Cron scheduler started (daily at 6:00 AM Chile time)");

  // Check on startup if we need an initial sync (with a small delay to let server boot)
  setTimeout(async () => {
    try {
      if (await shouldSync()) {
        console.log("[CronSync] Initial sync triggered (last sync was >10 hours ago or never)");
        await performFullSync("meta_ads_auto");
      } else {
        const lastSync = await db.getLastSyncLog("meta_ads_auto");
        if (lastSync) {
          console.log(`[CronSync] Last sync was at ${lastSync.createdAt}, skipping initial sync`);
        }
      }
    } catch (err) {
      console.error("[CronSync] Initial sync check failed:", err);
    }
  }, 10_000); // 10 second delay after server start

  // Set up hourly check
  cronTimer = setInterval(async () => {
    try {
      await cronCheck();
    } catch (err) {
      console.error("[CronSync] Cron check failed:", err);
    }
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the cron job scheduler (for testing/cleanup)
 */
export function stopCronSync() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log("[CronSync] Cron scheduler stopped");
  }
}
