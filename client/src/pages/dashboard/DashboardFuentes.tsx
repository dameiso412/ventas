/**
 * Dashboard > Fuentes — Lead sources breakdown sub-tab.
 *
 * Three stacked sections:
 *   1. By `origen` (ADS / REFERIDO / ORGANICO / INSTAGRAM) — pie + totals
 *   2. Instagram funnel breakdown (by igFunnelStage + ManyChat split)
 *   3. Ads breakdown by UTM (campaign × adset × ad)
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Megaphone, UsersRound, Globe, Instagram, Info } from "lucide-react";
import { MESES, getCurrentMes, getCurrentSemana } from "@shared/period";
import { useChartTheme } from "@/hooks/useChartTheme";
import AdCreativePreview from "@/components/AdCreativePreview";

const ORIGEN_COLORS: Record<string, string> = {
  ADS: "#3b82f6",
  REFERIDO: "#10b981",
  ORGANICO: "#a855f7",
  INSTAGRAM: "#ec4899",
};

const ORIGEN_ICON: Record<string, any> = {
  ADS: Megaphone,
  REFERIDO: UsersRound,
  ORGANICO: Globe,
  INSTAGRAM: Instagram,
};

const IG_STAGE_LABELS: Record<string, string> = {
  NUEVO_SEGUIDOR: "Nuevo seguidor",
  DM_ENVIADO: "DM enviado",
  EN_CONVERSACION: "En conversación",
  CALIFICADO: "Calificado",
  AGENDA_ENVIADA: "Agenda enviada",
  AGENDA_RESERVADA: "Agenda reservada",
  DESCARTADO: "Descartado",
};

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

export default function DashboardFuentes() {
  const [mes, setMes] = useState<string>(() => getCurrentMes());
  const [semana, setSemana] = useState<string>(() => String(getCurrentSemana()));
  const chartTheme = useChartTheme();

  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
  }), [mes, semana]);

  const { data, isLoading } = trpc.dashboard.sourceBreakdown.useQuery(filters);

  // Batch-fetch creatives for every numeric utm_content in the breakdown so the
  // ads table can render a thumbnail column without firing one query per row.
  const adIds = useMemo(() => {
    const ids = (data?.adsBreakdown ?? [])
      .map((r) => String(r.utmContent ?? "").trim())
      .filter((v) => /^\d{6,}$/.test(v));
    return Array.from(new Set(ids));
  }, [data?.adsBreakdown]);
  const creativesQuery = trpc.metaAds.creativesByAdIds.useQuery(
    { adIds },
    { enabled: adIds.length > 0, staleTime: 10 * 60_000 }
  );
  const creativesMap = (creativesQuery.data ?? {}) as Record<string, any>;

  const totalLeads = data?.byOrigen.reduce((sum, r) => sum + r.count, 0) ?? 0;
  const pieData = data?.byOrigen.map(r => ({
    name: r.origen,
    value: r.count,
    color: ORIGEN_COLORS[r.origen] ?? "#64748b",
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fuentes de Leads</h1>
          <p className="text-sm text-muted-foreground">Origen de cada lead: ads, Instagram, orgánico o referido.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[140px] bg-card/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={semana} onValueChange={setSemana}>
            <SelectTrigger className="w-[130px] bg-card/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {[1, 2, 3, 4, 5].map(s => <SelectItem key={s} value={String(s)}>Semana {s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SECTION 1 — Breakdown por origen */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Breakdown por origen</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Distribución de {totalLeads} leads del periodo por canal de adquisición.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : pieData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No hay leads en el periodo seleccionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={(e: any) => `${e.name}: ${((e.percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTheme.tooltip.contentStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.legendColor }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {data?.byOrigen.map(r => {
                  const Icon = ORIGEN_ICON[r.origen] ?? Globe;
                  const color = ORIGEN_COLORS[r.origen] ?? "#64748b";
                  const pct = totalLeads > 0 ? (r.count / totalLeads) * 100 : 0;
                  return (
                    <div key={r.origen} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20`, color }}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{r.origen}</p>
                          <p className="text-sm font-semibold">{r.count}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{pct.toFixed(1)}% · {r.ventas} ventas</span>
                          <span className="text-emerald-500">{formatUSD(r.revenue)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2 — Instagram funnel */}
      {data && data.igSources.total > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Instagram className="h-4 w-4 text-pink-500" />
              Instagram · funnel detallado
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Etapas del funnel de IG + split entre ManyChat y bio-link (estimación).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ManyChat vs bio-link split */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total IG</p>
                <p className="text-xl font-bold">{data.igSources.total}</p>
              </div>
              <div className="p-3 rounded-lg border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ManyChat</p>
                <p className="text-xl font-bold text-pink-500">{data.igSources.withManychat}</p>
                <p className="text-[10px] text-muted-foreground">con subscriberId</p>
              </div>
              <div className="p-3 rounded-lg border border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  Bio / otros
                  <span title="Estimación — no hay campo dedicado para bio link todavía">
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </span>
                </p>
                <p className="text-xl font-bold">{data.igSources.withoutManychat}</p>
                <p className="text-[10px] text-muted-foreground">sin ManyChat</p>
              </div>
            </div>

            {/* Funnel stages table */}
            {data.igByStage.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-muted-foreground">
                      <th className="py-2 px-2 font-medium">Etapa</th>
                      <th className="py-2 px-2 font-medium text-right">Leads</th>
                      <th className="py-2 px-2 font-medium text-right">ManyChat</th>
                      <th className="py-2 px-2 font-medium text-right">% del IG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.igByStage.map((r, i) => {
                      const label = r.stage ? (IG_STAGE_LABELS[r.stage] ?? r.stage) : "Sin etapa";
                      const pct = data.igSources.total > 0 ? (r.count / data.igSources.total) * 100 : 0;
                      return (
                        <tr key={i} className="border-b border-border/30">
                          <td className="py-2 px-2 font-medium">{label}</td>
                          <td className="py-2 px-2 text-right">{r.count}</td>
                          <td className="py-2 px-2 text-right text-pink-500">{r.hasManychat}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 3 — Ads breakdown by UTM */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-sky-500" />
            Ads · breakdown por UTM
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Campaña × adset × ad. Ordenado por cantidad de leads. Solo leads con UTM poblada.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !data || data.adsBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              No hay leads atribuidos a campañas de ads en el periodo.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium w-14">Creativo</th>
                    <th className="py-2 px-2 font-medium">Campaña</th>
                    <th className="py-2 px-2 font-medium">Adset</th>
                    <th className="py-2 px-2 font-medium">Ad</th>
                    <th className="py-2 px-2 font-medium text-right">Leads</th>
                    <th className="py-2 px-2 font-medium text-right">Agendas</th>
                    <th className="py-2 px-2 font-medium text-right">Ventas</th>
                    <th className="py-2 px-2 font-medium text-right">Close %</th>
                    <th className="py-2 px-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.adsBreakdown.map((r, i) => {
                    const closeRate = r.leads > 0 ? (r.ventas / r.leads) * 100 : 0;
                    const utmContent = String(r.utmContent ?? "").trim();
                    const adId = /^\d{6,}$/.test(utmContent) ? utmContent : null;
                    const creative = adId ? creativesMap[adId] : null;
                    return (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-2">
                          <AdCreativePreview
                            adId={adId}
                            preloaded={creative ?? null}
                            adName={r.utmCampaign}
                            variant="compact"
                          />
                        </td>
                        <td className="py-2 px-2 font-medium truncate max-w-[200px]">{r.utmCampaign || "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground truncate max-w-[150px]">{r.utmTerm || "—"}</td>
                        <td className="py-2 px-2 text-muted-foreground truncate max-w-[150px]">{r.utmContent || "—"}</td>
                        <td className="py-2 px-2 text-right">{r.leads}</td>
                        <td className="py-2 px-2 text-right">{r.agendas}</td>
                        <td className="py-2 px-2 text-right font-semibold">{r.ventas}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{closeRate.toFixed(1)}%</td>
                        <td className="py-2 px-2 text-right text-emerald-500 font-semibold">{formatUSD(r.revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
