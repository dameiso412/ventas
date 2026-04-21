import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AdCreativePreview from "@/components/AdCreativePreview";
import { toast } from "sonner";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
  DollarSign,
  Users,
  MousePointerClick,
  Eye,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Tag,
  Copy,
  AlertTriangle,
  Crosshair,
  BarChart3,
  Zap,
  Target,
  MessageCircle,
} from "lucide-react";

// ==================== HELPERS ====================

// CLP → USD conversion rate (Meta Ads account is in CLP, company operates in USD)
// Rate: ~870 CLP = 1 USD (Feb 2026 average)
const CLP_TO_USD_RATE = 1 / 870;

function clpToUsd(clp: number): number {
  return clp * CLP_TO_USD_RATE;
}

function formatCurrency(value: number | null | undefined, convertFromClp = true): string {
  if (value == null || isNaN(value)) return "$0";
  const amount = convertFromClp ? clpToUsd(Number(value)) : Number(value);
  if (amount >= 1000) {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0";
  return Number(value).toLocaleString("en-US");
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0%";
  return `${Number(value).toFixed(2)}%`;
}

function getDateRange(month: string, year: number) {
  const months: Record<string, number> = {
    Enero: 0, Febrero: 1, Marzo: 2, Abril: 3, Mayo: 4, Junio: 5,
    Julio: 6, Agosto: 7, Septiembre: 8, Octubre: 9, Noviembre: 10, Diciembre: 11,
  };
  const m = months[month] ?? new Date().getMonth();
  const from = new Date(year, m, 1);
  const to = new Date(year, m + 1, 0);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo: to.toISOString().split("T")[0],
  };
}

// ==================== MAIN COMPONENT ====================

export default function Atribucion() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.toLocaleString("es", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())
  );
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [expandedAdset, setExpandedAdset] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingStructure, setIsSyncingStructure] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugPayload, setDebugPayload] = useState<unknown>(null);

  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const years = [2025, 2026];

  const { dateFrom, dateTo } = useMemo(() => getDateRange(selectedMonth, selectedYear), [selectedMonth, selectedYear]);

  // ==================== QUERIES ====================

  const tokenStatus = trpc.metaAds.validateToken.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const campaignMetrics = trpc.metaAds.metricsByCampaign.useQuery(
    { dateFrom, dateTo },
    { enabled: !!tokenStatus.data?.valid }
  );

  const spendTrend = trpc.metaAds.spendTrend.useQuery(
    { dateFrom, dateTo },
    { enabled: !!tokenStatus.data?.valid }
  );

  const utmStatus = trpc.metaAds.utmStatus.useQuery(undefined, {
    enabled: !!tokenStatus.data?.valid,
    staleTime: 10 * 60 * 1000,
  });

  const recommendedUtm = trpc.metaAds.recommendedUtmTags.useQuery(undefined, {
    enabled: !!tokenStatus.data?.valid,
  });

  // Sync status
  const lastSyncQuery = trpc.metaAds.lastSync.useQuery(undefined, {
    staleTime: 60 * 1000, // refresh every minute
  });

  // Instagram funnel queries
  const igFunnelKpis = trpc.instagramFunnel.kpis.useQuery({
    mes: selectedMonth !== months[currentDate.getMonth()] ? selectedMonth : undefined,
  });
  const igSetterPerf = trpc.instagramFunnel.setterPerformance.useQuery({
    mes: selectedMonth !== months[currentDate.getMonth()] ? selectedMonth : undefined,
  });

  // Drill-down queries
  const adsetMetrics = trpc.metaAds.metricsByAdset.useQuery(
    { campaignId: expandedCampaign ?? "", dateFrom, dateTo },
    { enabled: !!expandedCampaign }
  );

  const adMetrics = trpc.metaAds.metricsByAd.useQuery(
    { adsetId: expandedAdset ?? "", dateFrom, dateTo },
    { enabled: !!expandedAdset }
  );

  // ==================== MUTATIONS ====================

  const utils = trpc.useUtils();

  const syncStructure = trpc.metaAds.syncStructure.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Estructura sincronizada: ${data.campaigns} campañas, ${data.adsets} adsets, ${data.ads} anuncios, ${data.creatives} creativos`
      );
      // fetchAdCreatives corre en un try/catch interno — si falla, la estructura
      // se guarda igual pero la metadata visual queda vacía. Mostramos el error
      // explícito para que el operador sepa que debe arreglar permisos del token.
      if (data.creativesError) {
        toast.error(
          `Creativos no sincronizados: ${data.creativesError}. La metadata visual (video/thumbnail) no está disponible hasta arreglar el token.`,
          { duration: 10000 }
        );
      } else if (data.creatives === 0 && data.ads > 0) {
        const s = data.creativesStats;
        const detail = s
          ? ` (${s.adsSeen} ads vistos, ${s.adsWithCreative} con creative expandido${s.lastError ? `, último error: ${s.lastError}` : ""})`
          : "";
        toast.warning(
          `Se sincronizaron ${data.ads} anuncios pero 0 creativos${detail}. Corré "Diagnóstico de creativos" para ver el payload crudo.`,
          { duration: 15000 }
        );
      }
      setIsSyncingStructure(false);
      utils.metaAds.utmStatus.invalidate();
    },
    onError: (err) => {
      toast.error(`Error sincronizando estructura: ${err.message}`);
      setIsSyncingStructure(false);
    },
  });

  const debugCreatives = trpc.metaAds.debugCreatives.useMutation({
    onSuccess: (data) => {
      setDebugPayload(data);
      setDebugOpen(true);
    },
    onError: (err) => {
      toast.error(`Error en diagnóstico: ${err.message}`);
    },
  });

  const syncInsights = trpc.metaAds.syncInsights.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced} registros de métricas sincronizados`);
      setIsSyncing(false);
      utils.metaAds.metricsByCampaign.invalidate();
      utils.metaAds.spendTrend.invalidate();
      utils.metaAds.metricsByAdset.invalidate();
      utils.metaAds.metricsByAd.invalidate();
    },
    onError: (err) => {
      toast.error(`Error sincronizando métricas: ${err.message}`);
      setIsSyncing(false);
    },
  });

  const fullSync = trpc.metaAds.fullSync.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(
          `Sync completo: ${data.campaigns} campañas, ${data.ads} anuncios, ${data.creatives} creativos, ${data.insights} insights (${(data.durationMs / 1000).toFixed(1)}s)`
        );
        // Si la sync de creativos devolvió 0 pese a tener ads, surface el por qué:
        // o bien el token no expande `creative` (creativesError), o el batch
        // devolvió ads vacíos (stats.adsWithCreative = 0). Si no, el operador
        // cree que todo salió bien y luego no entiende por qué no ve videos.
        if (data.creativesError) {
          toast.error(
            `Creativos no sincronizados: ${data.creativesError}. La metadata visual (video/thumbnail) no está disponible hasta arreglar el token.`,
            { duration: 10000 }
          );
        } else if (data.creatives === 0 && data.ads > 0) {
          const s = data.creativesStats;
          const detail = s
            ? ` (${s.adsSeen} ads vistos, ${s.adsWithCreative} con creative expandido${s.lastError ? `, último error: ${s.lastError}` : ""})`
            : "";
          toast.warning(
            `Se sincronizaron ${data.ads} anuncios pero 0 creativos${detail}. Corré "Diagnóstico de creativos" para ver el payload crudo.`,
            { duration: 15000 }
          );
        }
      } else {
        toast.error(`Error: ${data.error}`);
      }
      setIsSyncing(false);
      setIsSyncingStructure(false);
      utils.metaAds.metricsByCampaign.invalidate();
      utils.metaAds.spendTrend.invalidate();
      utils.metaAds.metricsByAdset.invalidate();
      utils.metaAds.metricsByAd.invalidate();
      utils.metaAds.utmStatus.invalidate();
      utils.metaAds.lastSync.invalidate();
    },
    onError: (err) => {
      toast.error(`Error sincronizando: ${err.message}`);
      setIsSyncing(false);
      setIsSyncingStructure(false);
    },
  });

  const handleSyncAll = () => {
    setIsSyncing(true);
    setIsSyncingStructure(true);
    fullSync.mutate();
  };

  // Format relative time for last sync
  const formatRelativeTime = (date: Date | string | null | undefined) => {
    if (!date) return "Nunca";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffMin < 1) return "Hace un momento";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHrs < 24) return `Hace ${diffHrs}h`;
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  // ==================== AGGREGATED METRICS ====================

  const totals = useMemo(() => {
    if (!campaignMetrics.data) return null;
    const data = campaignMetrics.data;
    const totalSpend = data.reduce((s, c) => s + Number(c.totalSpend || 0), 0);
    const totalImpressions = data.reduce((s, c) => s + Number(c.totalImpressions || 0), 0);
    const totalClicks = data.reduce((s, c) => s + Number(c.totalClicks || 0), 0);
    const totalReach = data.reduce((s, c) => s + Number(c.totalReach || 0), 0);
    const totalLeads = data.reduce((s, c) => s + Number(c.totalLeads || 0), 0);
    const totalLinkClicks = data.reduce((s, c) => s + Number(c.totalLinkClicks || 0), 0);
    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalReach,
      totalLeads,
      totalLinkClicks,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      avgCostPerResult: data.reduce((s, c) => s + Number((c as any).avgCostPerResult || 0), 0) / Math.max(data.filter(c => Number((c as any).avgCostPerResult || 0) > 0).length, 1),
      campaigns: data.length,
    };
  }, [campaignMetrics.data]);

  // ==================== RENDER ====================

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Crosshair className="h-6 w-6 text-primary" />
            Atribución de Anuncios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trazabilidad completa: Anuncio → Lead → Demo → Venta
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month/Year Filters */}
          <select
            className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {/* Sync Button */}
          <Button
            onClick={handleSyncAll}
            disabled={isSyncing || isSyncingStructure || !tokenStatus.data?.valid}
            size="sm"
            className="gap-2"
          >
            {isSyncing || isSyncingStructure ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sincronizar Meta
          </Button>
          {/* Debug Button — shows raw Meta API response so we can diagnose
              why ad_creatives stays empty after a "successful" sync. */}
          <Button
            onClick={() => debugCreatives.mutate({})}
            disabled={debugCreatives.isPending || !tokenStatus.data?.valid}
            size="sm"
            variant="outline"
            className="gap-2"
            title="Llama a Meta Graph con un sample y muestra el payload crudo"
          >
            {debugCreatives.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Diagnóstico creativos
          </Button>
        </div>
      </div>

      {/* Debug Dialog — shows the raw Meta Graph response for investigation */}
      {debugOpen && debugPayload ? (
        <Card className="border-amber-500/50 bg-amber-50/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Diagnóstico de Meta Graph (respuesta cruda)
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDebugOpen(false)}
            >
              Cerrar
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              Si <code>accountEndpoint.data[].creative</code> es <code>undefined</code>,
              el token no tiene permisos para expandir <code>creative&#123;...&#125;</code>.
              Probá regenerar el System User Token con <code>ads_management</code> +{" "}
              <code>business_management</code> además de <code>ads_read</code>.
            </p>
            <pre className="text-[10px] font-mono bg-card border border-border rounded p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(debugPayload, null, 2)}
            </pre>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2));
                  toast.success("Payload copiado");
                }}
              >
                <Copy className="h-3 w-3 mr-1" /> Copiar JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Connection Status */}
      <Card className="border-border/50">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {tokenStatus.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : tokenStatus.data?.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  Meta Ads API
                </span>
              </div>
              {tokenStatus.data?.valid && tokenStatus.data.accountName && (
                <Badge variant="outline" className="text-xs">
                  {tokenStatus.data.accountName}
                </Badge>
              )}
              {tokenStatus.data && !tokenStatus.data.valid && (
                <span className="text-xs text-red-400">{tokenStatus.data.error}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">CLP → USD</Badge>
              {lastSyncQuery.data?.lastAny && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-help">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span className="text-emerald-400">Auto-sync activo</span>
                      <span className="text-muted-foreground">·</span>
                      <span>{formatRelativeTime(lastSyncQuery.data.lastAny.createdAt)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1 text-xs">
                      <p className="font-medium">Sincronización automática diaria a las 6:00 AM (Chile)</p>
                      {lastSyncQuery.data.autoSync && (
                        <p>Última auto: {new Date(lastSyncQuery.data.autoSync.createdAt).toLocaleString("es-CL")} — {lastSyncQuery.data.autoSync.insightsSynced} insights</p>
                      )}
                      {lastSyncQuery.data.manualSync && (
                        <p>Última manual: {new Date(lastSyncQuery.data.manualSync.createdAt).toLocaleString("es-CL")} — {lastSyncQuery.data.manualSync.insightsSynced} insights</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              {!lastSyncQuery.data?.lastAny && (
                <span className="text-amber-400">Sin sincronización aún</span>
              )}
              <span className="text-muted-foreground">·</span>
              <span>{dateFrom} → {dateTo}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary Cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Ad Spend (USD)"
            value={formatCurrency(totals.totalSpend)}
            color="text-red-400"
          />
          <KpiCard
            icon={<Eye className="h-4 w-4" />}
            label="Impresiones"
            value={formatNumber(totals.totalImpressions)}
            color="text-blue-400"
          />
          <KpiCard
            icon={<MousePointerClick className="h-4 w-4" />}
            label="Clicks"
            value={formatNumber(totals.totalClicks)}
            sub={`CTR: ${formatPercent(totals.ctr)}`}
            color="text-amber-400"
          />
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Leads (Meta)"
            value={formatNumber(totals.totalLeads)}
            sub={`CPL: ${formatCurrency(totals.cpl)} USD`}
            color="text-emerald-400"
          />
          <KpiCard
            icon={<Target className="h-4 w-4" />}
            label="Costo/Cita (USD)"
            value={totals.avgCostPerResult > 0 ? formatCurrency(totals.avgCostPerResult) : "—"}
            sub="Meta cost_per_result"
            color="text-orange-400"
          />
          <KpiCard
            icon={<Zap className="h-4 w-4" />}
            label="Link Clicks"
            value={formatNumber(totals.totalLinkClicks)}
            sub={`CPC: ${formatCurrency(totals.cpc)} USD`}
            color="text-purple-400"
          />
          <KpiCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="Campañas"
            value={String(totals.campaigns)}
            color="text-cyan-400"
          />
        </div>
      )}

      {/* Campaign Metrics Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Métricas por Campaña
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground w-8"></th>
                  <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Campaña</th>
                  <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Spend</th>
                  <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Impresiones</th>
                  <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Clicks</th>
                  <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">CTR</th>
                  <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">CPC</th>
                  <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Leads</th>
                  <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">CPL</th>
                </tr>
              </thead>
              <tbody>
                {campaignMetrics.isLoading && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Cargando métricas...
                    </td>
                  </tr>
                )}
                {!campaignMetrics.isLoading && (!campaignMetrics.data || campaignMetrics.data.length === 0) && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Sin datos de métricas para este período</p>
                      <p className="text-xs mt-1">Haz clic en "Sincronizar Meta" para obtener datos</p>
                    </td>
                  </tr>
                )}
                {campaignMetrics.data?.map((campaign) => {
                  const isExpanded = expandedCampaign === campaign.campaignId;
                  const spend = Number(campaign.totalSpend || 0);
                  const leads = Number(campaign.totalLeads || 0);
                  const clicks = Number(campaign.totalClicks || 0);
                  const impressions = Number(campaign.totalImpressions || 0);
                  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
                  const cpc = clicks > 0 ? spend / clicks : 0;
                  const cpl = leads > 0 ? spend / leads : 0;

                  return (
                    <CampaignRow
                      key={campaign.campaignId}
                      campaignId={campaign.campaignId}
                      campaignName={campaign.campaignName ?? "Sin nombre"}
                      spend={spend}
                      impressions={impressions}
                      clicks={clicks}
                      ctr={ctr}
                      cpc={cpc}
                      leads={leads}
                      cpl={cpl}
                      isExpanded={isExpanded}
                      onToggle={() => {
                        setExpandedCampaign(isExpanded ? null : campaign.campaignId);
                        setExpandedAdset(null);
                      }}
                      adsetMetrics={isExpanded ? adsetMetrics.data : undefined}
                      adsetLoading={isExpanded && adsetMetrics.isLoading}
                      expandedAdset={expandedAdset}
                      onToggleAdset={(id) => setExpandedAdset(expandedAdset === id ? null : id)}
                      adMetrics={expandedAdset ? adMetrics.data : undefined}
                      adLoading={!!expandedAdset && adMetrics.isLoading}
                    />
                  );
                })}
                {/* Totals Row */}
                {totals && campaignMetrics.data && campaignMetrics.data.length > 0 && (
                  <tr className="border-t-2 border-primary/30 bg-primary/5 font-semibold">
                    <td className="py-2.5 px-3"></td>
                    <td className="py-2.5 px-3 text-foreground">TOTAL</td>
                    <td className="text-right py-2.5 px-3 text-red-400">{formatCurrency(totals.totalSpend)}</td>
                    <td className="text-right py-2.5 px-3">{formatNumber(totals.totalImpressions)}</td>
                    <td className="text-right py-2.5 px-3">{formatNumber(totals.totalClicks)}</td>
                    <td className="text-right py-2.5 px-3">{formatPercent(totals.ctr)}</td>
                    <td className="text-right py-2.5 px-3">{formatCurrency(totals.cpc)}</td>
                    <td className="text-right py-2.5 px-3 text-emerald-400">{formatNumber(totals.totalLeads)}</td>
                    <td className="text-right py-2.5 px-3 text-amber-400">{formatCurrency(totals.cpl)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* UTM Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Configuración UTM
            {utmStatus.data && (
              <Badge variant={utmStatus.data.withoutUtm.length > 0 ? "destructive" : "outline"} className="text-xs ml-2">
                {utmStatus.data.withoutUtm.length > 0
                  ? `${utmStatus.data.withoutUtm.length} sin UTM`
                  : "Todos configurados"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <p className="text-sm text-muted-foreground mb-2">
              Para la trazabilidad completa, cada anuncio necesita parámetros UTM en su URL.
              Agrega estos tags en el campo <strong>"URL Parameters"</strong> de cada anuncio en Meta Ads Manager:
            </p>
            <div className="flex items-center gap-2 mt-3">
              <code className="flex-1 bg-background/80 text-xs p-3 rounded border border-border font-mono text-emerald-400 break-all">
                {recommendedUtm.data?.tags ?? "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}"}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(recommendedUtm.data?.tags ?? "");
                  toast.success("UTM tags copiados al portapapeles");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {utmStatus.data && utmStatus.data.withoutUtm.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Anuncios sin UTM configurado ({utmStatus.data.withoutUtm.length}):</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {utmStatus.data.withoutUtm.map((ad) => (
                  <div key={ad.id} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded px-3 py-1.5">
                    <XCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                    <span className="truncate">{ad.name}</span>
                    <span className="text-muted-foreground/50 ml-auto flex-shrink-0">ID: {ad.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {utmStatus.data && utmStatus.data.withUtm.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Anuncios con UTM ({utmStatus.data.withUtm.length}):</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {utmStatus.data.withUtm.slice(0, 5).map((ad) => (
                  <div key={ad.id} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded px-3 py-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{ad.name}</span>
                    <code className="text-[10px] text-muted-foreground/50 ml-auto flex-shrink-0 max-w-[200px] truncate">{ad.urlTags}</code>
                  </div>
                ))}
                {utmStatus.data.withUtm.length > 5 && (
                  <p className="text-xs text-muted-foreground/50 px-3">...y {utmStatus.data.withUtm.length - 5} más</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">¿Cómo funciona la trazabilidad?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FunnelStep label="Anuncio Meta" icon={<Eye className="h-3.5 w-3.5" />} color="text-blue-400" />
            <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
            <FunnelStep label="Click + UTM" icon={<MousePointerClick className="h-3.5 w-3.5" />} color="text-amber-400" />
            <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
            <FunnelStep label="Landing Page" icon={<Zap className="h-3.5 w-3.5" />} color="text-purple-400" />
            <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
            <FunnelStep label="Lead + UTM" icon={<Users className="h-3.5 w-3.5" />} color="text-emerald-400" />
            <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
            <FunnelStep label="Demo" icon={<Crosshair className="h-3.5 w-3.5" />} color="text-cyan-400" />
            <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
            <FunnelStep label="Venta" icon={<DollarSign className="h-3.5 w-3.5" />} color="text-green-400" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Los parámetros UTM viajan con el lead desde el anuncio hasta el CRM, permitiendo saber exactamente qué campaña, adset y anuncio generó cada venta.
            Para activar la trazabilidad completa, tu landing page debe capturar los UTMs de la URL y enviarlos al webhook del CRM.
          </p>
        </CardContent>
      </Card>

      {/* ==================== INSTAGRAM ORGÁNICO ==================== */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-pink-400" />
            Instagram Orgánico — Funnel
          </CardTitle>
          <p className="text-xs text-muted-foreground">Seguidores → DMs → Calificados → Agendas → Demos → Ventas</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {igFunnelKpis.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando funnel IG...</span>
            </div>
          ) : igFunnelKpis.data ? (
            <>
              {/* Funnel bars */}
              <InstagramFunnelBars data={igFunnelKpis.data} />

              {/* Revenue attribution */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <KpiCard icon={<Users className="h-4 w-4" />} label="Total Leads IG" value={formatNumber(igFunnelKpis.data.totalIgLeads)} color="text-pink-400" />
                <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Cash IG" value={`$${Number(igFunnelKpis.data.cashFromIg || 0).toLocaleString()}`} color="text-green-400" />
                <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Revenue IG" value={`$${Number(igFunnelKpis.data.revenueFromIg || 0).toLocaleString()}`} color="text-emerald-400" />
                <KpiCard icon={<Target className="h-4 w-4" />} label="Ventas IG" value={formatNumber(igFunnelKpis.data.ventas)} color="text-amber-400" />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Sin datos de funnel Instagram para este período</p>
          )}

          {/* Setter IG Performance Table */}
          {igSetterPerf.data && igSetterPerf.data.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Performance de Setters en IG
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left p-2 font-medium text-muted-foreground">Setter</th>
                      <th className="text-center p-2 font-medium text-pink-400">Conv.</th>
                      <th className="text-center p-2 font-medium text-pink-400">Resp.</th>
                      <th className="text-center p-2 font-medium text-pink-400">% Resp</th>
                      <th className="text-center p-2 font-medium text-pink-400">Calif.</th>
                      <th className="text-center p-2 font-medium text-pink-400">Ag.Env</th>
                      <th className="text-center p-2 font-medium text-pink-400">Ag.Res</th>
                    </tr>
                  </thead>
                  <tbody>
                    {igSetterPerf.data.map((s: any) => {
                      const conv = Number(s.igConversacionesIniciadas || 0);
                      const resp = Number(s.igRespuestasRecibidas || 0);
                      const respRate = conv > 0 ? ((resp / conv) * 100).toFixed(0) : "-";
                      return (
                        <tr key={s.setter} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-2 font-medium">{s.setter}</td>
                          <td className="p-2 text-center">{conv}</td>
                          <td className="p-2 text-center">{resp}</td>
                          <td className="p-2 text-center font-medium text-pink-400">{respRate !== "-" ? `${respRate}%` : "-"}</td>
                          <td className="p-2 text-center">{Number(s.igCalificados || 0)}</td>
                          <td className="p-2 text-center">{Number(s.igAgendasEnviadas || 0)}</td>
                          <td className="p-2 text-center">{Number(s.igAgendasReservadas || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== SUB-COMPONENTS ====================

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="border-border/30">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={color}>{icon}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function InstagramFunnelBars({ data }: { data: any }) {
  const stages = [
    { label: "Nuevos Seguidores", value: Number(data.nuevosSeguidores || 0), color: "bg-pink-500" },
    { label: "DMs Enviados", value: Number(data.dmsEnviados || 0), color: "bg-pink-400" },
    { label: "En Conversación", value: Number(data.enConversacion || 0), color: "bg-fuchsia-400" },
    { label: "Calificados", value: Number(data.calificados || 0), color: "bg-purple-400" },
    { label: "Agendas Enviadas", value: Number(data.agendasEnviadas || 0), color: "bg-violet-400" },
    { label: "Agendas Reservadas", value: Number(data.agendasReservadas || 0), color: "bg-blue-400" },
    { label: "Ventas", value: Number(data.ventas || 0), color: "bg-green-400" },
  ];
  const max = Math.max(...stages.map(s => s.value), 1);
  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const pct = (stage.value / max) * 100;
        const prevValue = i > 0 ? stages[i - 1].value : 0;
        const convRate = prevValue > 0 ? ((stage.value / prevValue) * 100).toFixed(0) : null;
        return (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="w-[140px] text-xs text-muted-foreground text-right shrink-0">{stage.label}</div>
            <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden relative">
              <div className={`h-full ${stage.color} rounded transition-all duration-500`} style={{ width: `${Math.max(pct, 2)}%` }} />
              <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-foreground">
                {stage.value}
              </span>
            </div>
            {convRate && (
              <span className="text-[10px] text-muted-foreground w-[40px] shrink-0">{convRate}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FunnelStep({ label, icon, color }: { label: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 bg-muted/30 rounded-full px-3 py-1 ${color}`}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function CampaignRow({
  campaignId,
  campaignName,
  spend,
  impressions,
  clicks,
  ctr,
  cpc,
  leads,
  cpl,
  isExpanded,
  onToggle,
  adsetMetrics,
  adsetLoading,
  expandedAdset,
  onToggleAdset,
  adMetrics,
  adLoading,
}: {
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  cpl: number;
  isExpanded: boolean;
  onToggle: () => void;
  adsetMetrics?: any[];
  adsetLoading?: boolean;
  expandedAdset: string | null;
  onToggleAdset: (id: string) => void;
  adMetrics?: any[];
  adLoading?: boolean;
}) {
  // Batch-fetch creative thumbnails for the currently expanded adset. Keeps
  // the request count down to O(1) per drill-down regardless of how many ads
  // it contains, and tRPC cache means re-opening the same adset is free.
  const adIds = useMemo(
    () => (adMetrics ?? []).map((a: any) => a.adId).filter(Boolean) as string[],
    [adMetrics]
  );
  const creativesQuery = trpc.metaAds.creativesByAdIds.useQuery(
    { adIds },
    { enabled: adIds.length > 0, staleTime: 10 * 60_000 }
  );
  const creativesMap = (creativesQuery.data ?? {}) as Record<string, any>;

  return (
    <>
      <tr
        className={`border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors ${isExpanded ? "bg-muted/10" : ""}`}
        onClick={onToggle}
      >
        <td className="py-2.5 px-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-primary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="py-2.5 px-3">
          <div className="max-w-[300px]">
            <p className="text-foreground font-medium truncate">{campaignName}</p>
            <p className="text-[10px] text-muted-foreground/50">{campaignId}</p>
          </div>
        </td>
        <td className="text-right py-2.5 px-3 text-red-400 font-medium">{formatCurrency(spend)}</td>
        <td className="text-right py-2.5 px-3">{formatNumber(impressions)}</td>
        <td className="text-right py-2.5 px-3">{formatNumber(clicks)}</td>
        <td className="text-right py-2.5 px-3">{formatPercent(ctr)}</td>
        <td className="text-right py-2.5 px-3">{formatCurrency(cpc)}</td>
        <td className="text-right py-2.5 px-3 text-emerald-400 font-medium">{formatNumber(leads)}</td>
        <td className="text-right py-2.5 px-3 text-amber-400 font-medium">{formatCurrency(cpl)}</td>
      </tr>

      {/* Adset drill-down */}
      {isExpanded && (
        <>
          {adsetLoading && (
            <tr>
              <td colSpan={9} className="py-3 text-center">
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
              </td>
            </tr>
          )}
          {adsetMetrics?.map((adset) => {
            const asSpend = Number(adset.totalSpend || 0);
            const asClicks = Number(adset.totalClicks || 0);
            const asImpressions = Number(adset.totalImpressions || 0);
            const asLeads = Number(adset.totalLeads || 0);
            const asCtr = asImpressions > 0 ? (asClicks / asImpressions) * 100 : 0;
            const asCpc = asClicks > 0 ? asSpend / asClicks : 0;
            const asCpl = asLeads > 0 ? asSpend / asLeads : 0;
            const isAdsetExpanded = expandedAdset === adset.adsetId;

            return (
              <React.Fragment key={`adset-${adset.adsetId}`}>
                <tr
                  className={`border-b border-border/20 hover:bg-muted/15 cursor-pointer transition-colors ${isAdsetExpanded ? "bg-primary/5" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onToggleAdset(adset.adsetId ?? ""); }}
                >
                  <td className="py-2 px-3 pl-8">
                    {isAdsetExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <p className="text-foreground/80 text-xs truncate max-w-[280px] pl-4">
                      ↳ {adset.adsetName ?? "Sin nombre"}
                    </p>
                  </td>
                  <td className="text-right py-2 px-3 text-xs text-red-400/80">{formatCurrency(asSpend)}</td>
                  <td className="text-right py-2 px-3 text-xs">{formatNumber(asImpressions)}</td>
                  <td className="text-right py-2 px-3 text-xs">{formatNumber(asClicks)}</td>
                  <td className="text-right py-2 px-3 text-xs">{formatPercent(asCtr)}</td>
                  <td className="text-right py-2 px-3 text-xs">{formatCurrency(asCpc)}</td>
                  <td className="text-right py-2 px-3 text-xs text-emerald-400/80">{formatNumber(asLeads)}</td>
                  <td className="text-right py-2 px-3 text-xs text-amber-400/80">{formatCurrency(asCpl)}</td>
                </tr>

                {/* Ad drill-down */}
                {isAdsetExpanded && (
                  <>
                    {adLoading && (
                      <tr key={`ad-loading-${adset.adsetId}`}>
                        <td colSpan={9} className="py-2 text-center">
                          <Loader2 className="h-3 w-3 animate-spin mx-auto text-muted-foreground" />
                        </td>
                      </tr>
                    )}
                    {adMetrics?.map((ad) => {
                      const adSpend = Number(ad.totalSpend || 0);
                      const adClicks = Number(ad.totalClicks || 0);
                      const adImpressions = Number(ad.totalImpressions || 0);
                      const adLeads = Number(ad.totalLeads || 0);
                      const adCtr = adImpressions > 0 ? (adClicks / adImpressions) * 100 : 0;
                      const adCpc = adClicks > 0 ? adSpend / adClicks : 0;
                      const adCpl = adLeads > 0 ? adSpend / adLeads : 0;

                      const creative = ad.adId ? creativesMap[ad.adId] : null;
                      return (
                        <tr
                          key={`ad-${ad.adId}`}
                          className="border-b border-border/10 hover:bg-muted/10 transition-colors"
                        >
                          <td className="py-1.5 px-3 pl-12"></td>
                          <td className="py-1.5 px-3">
                            <div className="flex items-center gap-2 pl-8">
                              <AdCreativePreview
                                adId={ad.adId ?? null}
                                preloaded={creative ?? null}
                                adName={ad.adName}
                                variant="compact"
                              />
                              <p className="text-foreground/60 text-[11px] truncate max-w-[220px]">
                                ↳ {ad.adName ?? "Sin nombre"}
                              </p>
                            </div>
                          </td>
                          <td className="text-right py-1.5 px-3 text-[11px] text-red-400/60">{formatCurrency(adSpend)}</td>
                          <td className="text-right py-1.5 px-3 text-[11px]">{formatNumber(adImpressions)}</td>
                          <td className="text-right py-1.5 px-3 text-[11px]">{formatNumber(adClicks)}</td>
                          <td className="text-right py-1.5 px-3 text-[11px]">{formatPercent(adCtr)}</td>
                          <td className="text-right py-1.5 px-3 text-[11px]">{formatCurrency(adCpc)}</td>
                          <td className="text-right py-1.5 px-3 text-[11px] text-emerald-400/60">{formatNumber(adLeads)}</td>
                          <td className="text-right py-1.5 px-3 text-[11px] text-amber-400/60">{formatCurrency(adCpl)}</td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </React.Fragment>
            );
          })}
          {!adsetLoading && adsetMetrics && adsetMetrics.length === 0 && (
            <tr>
              <td colSpan={9} className="py-3 text-center text-xs text-muted-foreground">
                Sin adsets con datos para este período
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}
