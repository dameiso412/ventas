/**
 * Marketing > Creativos — Performance por Creativo
 *
 * Vista granular ad-por-ad: permite ver, para cada creativo pauteado en Meta,
 * cuánto gasto generó, cuántos leads trajo (según nuestro CRM, no según la
 * métrica "leads" de Meta que solo cuenta form-fills), cuántas agendas, cuántas
 * ventas y el ROAS real.
 *
 * El join ocurre vía `leads.metaAdId` — poblado en los 3 webhooks (lead form,
 * prospect, ManyChat) cuando el ad usa las URL macros {{ad.id}} en UTM content.
 * Los ads previos a que configuremos las macros no van a aparecer con leads
 * atribuidos, y está bien — el backfill histórico es out-of-scope por ahora.
 *
 * Orden por gasto descendente. Filas con 0 gasto y 0 leads no aparecen. KPIs
 * derivados (CPL/CPA/CPV/ROAS) se muestran como "—" cuando el denominador es 0,
 * no como "Infinity" o "0".
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Clapperboard,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Search,
  DollarSign,
  Video,
  ImageOff,
} from "lucide-react";

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all";

function computeRange(key: RangeKey): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  };
  switch (key) {
    case "7d":
      return { dateFrom: toISO(daysAgo(7)), dateTo: toISO(now) };
    case "30d":
      return { dateFrom: toISO(daysAgo(30)), dateTo: toISO(now) };
    case "90d":
      return { dateFrom: toISO(daysAgo(90)), dateTo: toISO(now) };
    case "ytd": {
      const jan1 = new Date(now.getFullYear(), 0, 1);
      return { dateFrom: toISO(jan1), dateTo: toISO(now) };
    }
    case "all":
    default: {
      // Meta mantiene 37 meses de retención. Pedimos 2 años como aproximación
      // a "todo" para no disparar queries que devuelvan 10k filas al pedir
      // desde epoch.
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 2);
      return { dateFrom: toISO(start), dateTo: toISO(now) };
    }
  }
}

const currencyFmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat("es-MX");
const pctFmt = new Intl.NumberFormat("es-MX", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

function fmtCurrency(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return currencyFmt.format(n);
}
function fmtInt(n: number | null | undefined): string {
  if (n == null) return "—";
  return numberFmt.format(n);
}
function fmtRoas(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return `${n.toFixed(2)}x`;
}
function fmtPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return pctFmt.format(n / 100);
}

type Creative = {
  adId: string;
  adName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  thumbnailUrl: string | null;
  videoId: string | null;
  videoSourceUrl: string | null;
  videoPermalinkUrl: string | null;
  imageUrl: string | null;
  creativeTitle: string | null;
  creativeBody: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  metaReportedLeads: number;
  leads: number;
  agendas: number;
  asistieron: number;
  ventas: number;
  revenue: number;
  cpl: number | null;
  cpa: number | null;
  cpv: number | null;
  roas: number | null;
  ctr: number | null;
};

export default function MarketingCreativos() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [search, setSearch] = useState("");
  const [previewAdId, setPreviewAdId] = useState<string | null>(null);
  const { dateFrom, dateTo } = useMemo(() => computeRange(range), [range]);

  const creativesQuery = trpc.metaAds.creativePerformance.useQuery(
    { dateFrom, dateTo },
    { staleTime: 5 * 60 * 1000 }
  );

  const creatives: Creative[] = useMemo(() => {
    const list = (creativesQuery.data ?? []) as Creative[];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) =>
      (c.adName ?? "").toLowerCase().includes(q) ||
      (c.campaignName ?? "").toLowerCase().includes(q) ||
      (c.creativeTitle ?? "").toLowerCase().includes(q) ||
      c.adId.includes(q)
    );
  }, [creativesQuery.data, search]);

  const totals = useMemo(() => {
    const base = { spend: 0, leads: 0, agendas: 0, ventas: 0, revenue: 0, impressions: 0 };
    for (const c of creatives) {
      base.spend += c.spend;
      base.leads += c.leads;
      base.agendas += c.agendas;
      base.ventas += c.ventas;
      base.revenue += c.revenue;
      base.impressions += c.impressions;
    }
    return {
      ...base,
      cpl: base.leads > 0 ? base.spend / base.leads : null,
      cpa: base.agendas > 0 ? base.spend / base.agendas : null,
      roas: base.spend > 0 ? base.revenue / base.spend : null,
    };
  }, [creatives]);

  const previewCreative = previewAdId ? creatives.find((c) => c.adId === previewAdId) : null;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-primary" /> Performance por Creativo
          </h1>
          <p className="text-sm text-muted-foreground">
            Qué anuncio trajo qué venta. Join por <span className="font-mono">metaAdId</span> (UTM content = <span className="font-mono">{"{{ad.id}}"}</span>).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="90d">Últimos 90 días</SelectItem>
              <SelectItem value="ytd">Año a la fecha</SelectItem>
              <SelectItem value="all">Todo (2 años)</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => creativesQuery.refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refrescar
          </Button>
        </div>
      </div>

      {/* Totals headline */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiTile label="Gasto" value={fmtCurrency(totals.spend)} icon={<DollarSign className="h-3.5 w-3.5" />} />
        <KpiTile label="Leads" value={fmtInt(totals.leads)} />
        <KpiTile label="Agendas" value={fmtInt(totals.agendas)} />
        <KpiTile label="Ventas" value={fmtInt(totals.ventas)} />
        <KpiTile label="Revenue" value={fmtCurrency(totals.revenue)} />
        <KpiTile label="ROAS" value={fmtRoas(totals.roas)} tone={totals.roas != null && totals.roas >= 1 ? "positive" : "negative"} />
      </div>

      {/* Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Ranking de creativos
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Ordenados por gasto. Filas con 0 gasto y 0 leads ocultas automáticamente.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por ad, campaña o adId…"
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {creativesQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : creatives.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {search
                  ? "Sin creativos que coincidan con la búsqueda."
                  : "Sin creativos con gasto o leads en el periodo."}
              </p>
              {!search && (
                <p className="text-xs text-muted-foreground">
                  Si los ads están activos pero no aparecen: verificá que tengan UTMs con{" "}
                  <span className="font-mono">utm_content={"{{ad.id}}"}</span> en Ads Manager.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium">Creativo</th>
                    <th className="py-2 px-2 font-medium text-right">Gasto</th>
                    <th className="py-2 px-2 font-medium text-right">Impr.</th>
                    <th className="py-2 px-2 font-medium text-right">Clicks</th>
                    <th className="py-2 px-2 font-medium text-right">Leads</th>
                    <th className="py-2 px-2 font-medium text-right">Agendas</th>
                    <th className="py-2 px-2 font-medium text-right">Asist.</th>
                    <th className="py-2 px-2 font-medium text-right">Ventas</th>
                    <th className="py-2 px-2 font-medium text-right">Revenue</th>
                    <th className="py-2 px-2 font-medium text-right">CPL</th>
                    <th className="py-2 px-2 font-medium text-right">CPA</th>
                    <th className="py-2 px-2 font-medium text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {creatives.map((c) => (
                    <tr
                      key={c.adId}
                      className="border-b border-border/30 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setPreviewAdId(c.adId)}
                    >
                      <td className="py-2 px-2 max-w-[360px]">
                        <div className="flex items-center gap-2">
                          <Thumbnail creative={c} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium text-xs truncate">{c.adName || c.creativeTitle || `Ad ${c.adId}`}</div>
                            <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                              {c.campaignName && <span className="truncate">{c.campaignName}</span>}
                              {c.videoId && <Video className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-medium">{fmtCurrency(c.spend)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmtInt(c.impressions)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmtInt(c.linkClicks)}</td>
                      <td className="py-2 px-2 text-right">{fmtInt(c.leads)}</td>
                      <td className="py-2 px-2 text-right">{fmtInt(c.agendas)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmtInt(c.asistieron)}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmtInt(c.ventas)}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmtCurrency(c.revenue)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmtCurrency(c.cpl)}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmtCurrency(c.cpa)}</td>
                      <td className="py-2 px-2 text-right">
                        <RoasBadge roas={c.roas} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreativePreviewModal
        creative={previewCreative || null}
        onClose={() => setPreviewAdId(null)}
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "positive" ? "text-emerald-500" : tone === "negative" ? "text-red-500" : "";
  return (
    <Card className="bg-card/50">
      <CardContent className="pt-4 pb-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          {icon}
          {label}
        </p>
        <p className={`text-lg font-semibold mt-0.5 ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function RoasBadge({ roas }: { roas: number | null }) {
  if (roas == null || !isFinite(roas)) {
    return <span className="text-muted-foreground">—</span>;
  }
  // Umbrales: >=3x verde (excelente), >=1x amarillo (rentable), <1x rojo (sangrado)
  const variant: "default" | "secondary" | "destructive" =
    roas >= 3 ? "default" : roas >= 1 ? "secondary" : "destructive";
  const Icon = roas >= 1 ? TrendingUp : TrendingDown;
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {roas.toFixed(2)}x
    </Badge>
  );
}

function Thumbnail({ creative, size }: { creative: Creative; size?: "sm" | "lg" }) {
  const url = creative.thumbnailUrl || creative.imageUrl;
  const dim = size === "lg" ? "w-32 h-32" : "w-10 h-10";
  if (!url) {
    return (
      <div className={`${dim} rounded-md bg-muted/40 border border-border/30 flex items-center justify-center shrink-0`}>
        <ImageOff className="h-4 w-4 text-muted-foreground/50" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={creative.adName ?? creative.adId}
      className={`${dim} rounded-md object-cover border border-border/30 shrink-0`}
      loading="lazy"
      onError={(e) => {
        // Meta's CDN tokens expire after a while — fall back to a placeholder.
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

function CreativePreviewModal({
  creative,
  onClose,
}: {
  creative: Creative | null;
  onClose: () => void;
}) {
  const open = creative !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4" />
            {creative?.adName || creative?.creativeTitle || `Ad ${creative?.adId ?? ""}`}
          </DialogTitle>
          {creative ? (
            <DialogDescription>
              {creative.campaignName || "—"} · <span className="font-mono text-[10px]">{creative.adId}</span>
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {creative ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Thumbnail creative={creative} size="lg" />
              <div className="flex-1 space-y-2 text-sm">
                {creative.creativeTitle && (
                  <div>
                    <span className="text-xs text-muted-foreground">Título</span>
                    <p className="font-medium">{creative.creativeTitle}</p>
                  </div>
                )}
                {creative.creativeBody && (
                  <div>
                    <span className="text-xs text-muted-foreground">Copy</span>
                    <p className="text-xs line-clamp-4">{creative.creativeBody}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <PreviewStat label="Gasto" value={fmtCurrency(creative.spend)} />
              <PreviewStat label="Impresiones" value={fmtInt(creative.impressions)} />
              <PreviewStat label="CTR" value={fmtPct(creative.ctr)} />
              <PreviewStat label="Leads (CRM)" value={fmtInt(creative.leads)} />
              <PreviewStat label="Meta leads" value={fmtInt(creative.metaReportedLeads)} />
              <PreviewStat label="Agendas" value={fmtInt(creative.agendas)} />
              <PreviewStat label="Asistieron" value={fmtInt(creative.asistieron)} />
              <PreviewStat label="Ventas" value={fmtInt(creative.ventas)} />
              <PreviewStat label="Revenue" value={fmtCurrency(creative.revenue)} />
              <PreviewStat label="CPL" value={fmtCurrency(creative.cpl)} />
              <PreviewStat label="CPA" value={fmtCurrency(creative.cpa)} />
              <PreviewStat label="ROAS" value={fmtRoas(creative.roas)} />
            </div>

            {(creative.videoPermalinkUrl || creative.videoSourceUrl) && (
              <div className="flex gap-2">
                {creative.videoPermalinkUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={creative.videoPermalinkUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Ver en Facebook
                    </a>
                  </Button>
                )}
                {creative.videoSourceUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={creative.videoSourceUrl} target="_blank" rel="noreferrer">
                      <Video className="h-3 w-3 mr-1" /> Video directo
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-md p-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
