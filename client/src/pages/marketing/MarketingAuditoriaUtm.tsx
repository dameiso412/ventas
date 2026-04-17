/**
 * Marketing > Auditoría UTM
 *
 * Measures attribution completeness so we know where leads are losing their
 * UTMs (mostly: ManyChat webhook today captures zero UTMs from IG ads).
 *
 * Sections:
 *  1. Headline: total leads × % with attribution × % without.
 *  2. Completeness matrix: origen × (source/medium/campaign/content/term).
 *     Rows with low coverage on ADS/INSTAGRAM get red highlight — those are
 *     the ones that should be poblados but aren't, as opposed to ORGANICO /
 *     REFERIDO where zero is expected.
 *  3. Sample of recent leads with missing UTMs — click "ver payload" to open
 *     the raw webhook_log in a modal. Lets the team diagnose whether the
 *     upstream payload actually carried UTMs we didn't parse.
 *  4. Ads sin URL tags (reuses existing metaAds.utmStatus) + copy-paste
 *     template of the recommended UTM string.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Crosshair,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSearch,
  RefreshCw,
  Wrench,
  Loader2,
} from "lucide-react";

type RangeKey = "7d" | "30d" | "90d" | "ytd" | "all";

function computeRange(key: RangeKey): { dateFrom?: string; dateTo?: string } {
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
    default:
      return {};
  }
}

/** Colour a completeness cell based on origen × coverage. */
function coverageClass(origen: string, pct: number): string {
  const isPaid = origen === "ADS" || origen === "INSTAGRAM";
  if (!isPaid) return "text-muted-foreground/60"; // organic/referral — zero is expected
  if (pct >= 90) return "text-emerald-500 font-medium";
  if (pct >= 60) return "text-amber-500 font-medium";
  return "text-red-500 font-semibold";
}

function pct(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export default function MarketingAuditoriaUtm() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { dateFrom, dateTo } = useMemo(() => computeRange(range), [range]);

  const completeness = trpc.attribution.utmCompleteness.useQuery({ dateFrom, dateTo });
  const missing = trpc.attribution.sampleMissing.useQuery({ limit: 20, dateFrom, dateTo });
  const utmStatus = trpc.metaAds.utmStatus.useQuery(undefined, { staleTime: 60_000 });
  const recommendedUtm = trpc.metaAds.recommendedUtmTags.useQuery(undefined, { staleTime: 60_000 });

  const totals = useMemo(() => {
    const rows = completeness.data ?? [];
    const total = rows.reduce((s, r) => s + r.total, 0);
    const withAnyAttribution = rows.reduce((s, r) => s + (r.total - r.completelyMissing), 0);
    return {
      total,
      withAttribution: withAnyAttribution,
      withoutAttribution: total - withAnyAttribution,
    };
  }, [completeness.data]);

  const [inspectLogId, setInspectLogId] = useState<number | null>(null);
  const [pendingRepairId, setPendingRepairId] = useState<number | null>(null);

  // Re-parse a lead's stored webhook_log payloads with the current parser,
  // filling in any missing UTM / click-id fields. Safe — never overwrites.
  const repairMutation = trpc.attribution.repairMissing.useMutation({
    onSuccess: (results: any) => {
      setPendingRepairId(null);
      const list = Array.isArray(results) ? results : [];
      const repaired = list.filter((r: any) => r.repaired);
      if (repaired.length === 0) {
        const reason = list[0]?.reason ?? "Sin datos recuperables";
        toast.info(`Sin cambios: ${reason}`);
      } else {
        const totalFields = repaired.reduce((s: number, r: any) => s + (r.fieldsSet?.length ?? 0), 0);
        toast.success(`Reparados ${repaired.length} lead(s) · ${totalFields} campos rellenados`);
        missing.refetch();
        completeness.refetch();
      }
    },
    onError: (e: any) => {
      setPendingRepairId(null);
      toast.error(`Error reparando: ${e.message}`);
    },
  });

  const repairBatchMutation = trpc.attribution.repairMissing.useMutation({
    onSuccess: (results: any) => {
      const list = Array.isArray(results) ? results : [];
      const repaired = list.filter((r: any) => r.repaired);
      const totalFields = repaired.reduce((s: number, r: any) => s + (r.fieldsSet?.length ?? 0), 0);
      if (repaired.length === 0) {
        toast.info("Nada por reparar — todos los leads del batch ya tenían UTMs o sin payload recuperable.");
      } else {
        toast.success(`Batch: ${repaired.length} leads reparados · ${totalFields} campos`);
      }
      missing.refetch();
      completeness.refetch();
    },
    onError: (e: any) => toast.error(`Batch falló: ${e.message}`),
  });

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" /> Auditoría UTM
          </h1>
          <p className="text-sm text-muted-foreground">
            Cuánta atribución estamos perdiendo, en qué fuentes, y qué webhook la drop-ea.
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
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              completeness.refetch();
              missing.refetch();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refrescar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={repairBatchMutation.isPending}
            onClick={() => repairBatchMutation.mutate({ limit: 50 })}
            title="Re-parsea los payloads almacenados de los 50 leads más recientes sin atribución"
          >
            {repairBatchMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Wrench className="h-3.5 w-3.5 mr-1" />
            )}
            Reparar últimos 50
          </Button>
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total leads</p>
            <p className="text-2xl font-semibold mt-1">{totals.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-emerald-500/30">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Con atribución</p>
            <p className="text-2xl font-semibold mt-1 text-emerald-500">
              {totals.withAttribution}{" "}
              <span className="text-sm text-muted-foreground">
                ({pct(totals.withAttribution, totals.total)}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Sin atribución</p>
            <p className="text-2xl font-semibold mt-1 text-red-500">
              {totals.withoutAttribution}{" "}
              <span className="text-sm text-muted-foreground">
                ({pct(totals.withoutAttribution, totals.total)}%)
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Completeness matrix */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-sky-500" />
            Matriz de completitud por origen
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Para fuentes pagadas (ADS / INSTAGRAM), rojo = {"<60%"} indica fuga de atribución.
            Para ORGANICO / REFERIDO, cero es esperable.
          </p>
        </CardHeader>
        <CardContent>
          {completeness.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !completeness.data || completeness.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin leads en el periodo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium">Origen</th>
                    <th className="py-2 px-2 font-medium text-right">Total</th>
                    <th className="py-2 px-2 font-medium text-right">Source</th>
                    <th className="py-2 px-2 font-medium text-right">Medium</th>
                    <th className="py-2 px-2 font-medium text-right">Campaign</th>
                    <th className="py-2 px-2 font-medium text-right">Content</th>
                    <th className="py-2 px-2 font-medium text-right">Term</th>
                    <th className="py-2 px-2 font-medium text-right">Sin nada</th>
                  </tr>
                </thead>
                <tbody>
                  {completeness.data.map((row) => (
                    <tr key={row.origen} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium">{row.origen}</td>
                      <td className="py-2 px-2 text-right">{row.total}</td>
                      <td className={`py-2 px-2 text-right ${coverageClass(row.origen, pct(row.hasSource, row.total))}`}>
                        {pct(row.hasSource, row.total)}%
                      </td>
                      <td className={`py-2 px-2 text-right ${coverageClass(row.origen, pct(row.hasMedium, row.total))}`}>
                        {pct(row.hasMedium, row.total)}%
                      </td>
                      <td className={`py-2 px-2 text-right ${coverageClass(row.origen, pct(row.hasCampaign, row.total))}`}>
                        {pct(row.hasCampaign, row.total)}%
                      </td>
                      <td className={`py-2 px-2 text-right ${coverageClass(row.origen, pct(row.hasContent, row.total))}`}>
                        {pct(row.hasContent, row.total)}%
                      </td>
                      <td className={`py-2 px-2 text-right ${coverageClass(row.origen, pct(row.hasTerm, row.total))}`}>
                        {pct(row.hasTerm, row.total)}%
                      </td>
                      <td className="py-2 px-2 text-right text-red-400">
                        {row.completelyMissing}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sample of missing UTM leads */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Leads con atribución perdida
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Últimos {missing.data?.length ?? 0} leads sin <span className="font-mono">utm_source</span> ni
            <span className="font-mono"> utm_campaign</span>. Revisá el payload crudo para descubrir si
            el webhook upstream sí trajo atribución que nuestro parser ignoró.
          </p>
        </CardHeader>
        <CardContent>
          {missing.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !missing.data || missing.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin leads sin atribución 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium">Lead</th>
                    <th className="py-2 px-2 font-medium">Origen</th>
                    <th className="py-2 px-2 font-medium">Fuente webhook</th>
                    <th className="py-2 px-2 font-medium">Creado</th>
                    <th className="py-2 px-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {missing.data.map((l) => (
                    <tr key={l.leadId} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="py-2 px-2">
                        <div className="flex flex-col">
                          <span className="font-medium">{l.nombre || "—"}</span>
                          <span className="text-xs text-muted-foreground">{l.correo || l.telefono || `#${l.leadId}`}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant={l.origen === "INSTAGRAM" ? "destructive" : "secondary"}>
                          {l.origen || "—"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground font-mono">
                        {l.webhookEndpoint || "—"}
                      </td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        {new Date(l.createdAt).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {l.webhookLogId && l.hasRawPayload ? (
                            <Button size="sm" variant="outline" onClick={() => setInspectLogId(l.webhookLogId)}>
                              Ver payload
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">sin payload</span>
                          )}
                          {l.hasRawPayload ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={repairMutation.isPending && pendingRepairId === l.leadId}
                              onClick={() => {
                                setPendingRepairId(l.leadId);
                                repairMutation.mutate({ leadId: l.leadId });
                              }}
                              title="Re-parsea el payload crudo con el parser actual"
                            >
                              {repairMutation.isPending && pendingRepairId === l.leadId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Wrench className="h-3 w-3" />
                              )}
                              <span className="ml-1 hidden md:inline">Reparar</span>
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ads without URL tags */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Ads activos sin URL tags
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Estos anuncios no tienen UTMs configuradas en Meta. Usá el template de abajo.
          </p>
        </CardHeader>
        <CardContent>
          {utmStatus.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : utmStatus.data ? (
            <>
              <div className="flex items-center gap-3 text-sm mb-3">
                <div>
                  <span className="text-emerald-500 font-semibold">{utmStatus.data.withUtm.length}</span>
                  <span className="text-muted-foreground"> con UTMs</span>
                </div>
                <div>
                  <span className={utmStatus.data.withoutUtm.length > 0 ? "text-red-500 font-semibold" : "text-muted-foreground"}>
                    {utmStatus.data.withoutUtm.length}
                  </span>
                  <span className="text-muted-foreground"> sin UTMs</span>
                </div>
              </div>
              {utmStatus.data.withoutUtm.length > 0 && (
                <details className="mb-3">
                  <summary className="cursor-pointer text-xs text-primary hover:underline mb-2">
                    Ver lista de ads sin UTMs
                  </summary>
                  <div className="rounded-md border border-border/30 max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {utmStatus.data.withoutUtm.map((ad) => (
                          <tr key={ad.id} className="border-b border-border/20">
                            <td className="py-1.5 px-2 font-mono text-muted-foreground">{ad.id}</td>
                            <td className="py-1.5 px-2 truncate max-w-[400px]">{ad.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
              {recommendedUtm.data?.tags && (
                <div className="rounded-md border border-border/30 bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    <code className="flex-1 text-[11px] break-all font-mono text-foreground/80">
                      {recommendedUtm.data.tags}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(recommendedUtm.data!.tags);
                        toast.success("Template copiado");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Pegá este string en "URL Parameters" de cada anuncio de Meta (Business Manager → Anuncio → Tracking → URL Parameters).
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No se pudo consultar el estado UTM (revisá el token de Meta).</p>
          )}
        </CardContent>
      </Card>

      <WebhookPayloadModal logId={inspectLogId} onClose={() => setInspectLogId(null)} />
    </div>
  );
}

/**
 * Modal that renders the raw webhook_log payload. Only fires the query when
 * `logId` is non-null so we don't hit the DB until the user actually asks.
 */
function WebhookPayloadModal({ logId, onClose }: { logId: number | null; onClose: () => void }) {
  const { data, isLoading } = trpc.attribution.webhookLog.useQuery(
    { id: logId ?? 0 },
    { enabled: logId !== null }
  );
  const open = logId !== null;

  const prettyPayload = useMemo(() => {
    if (!data?.rawPayload) return "";
    try {
      return JSON.stringify(JSON.parse(data.rawPayload), null, 2);
    } catch {
      return data.rawPayload;
    }
  }, [data?.rawPayload]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" /> Webhook payload
          </DialogTitle>
          {data ? (
            <DialogDescription>
              <span className="font-mono">{data.endpoint}</span> ·{" "}
              {new Date(data.createdAt).toLocaleString("es-ES")}
              {data.leadId ? ` · Lead #${data.leadId}` : ""}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Log no encontrado.</p>
        ) : (
          <div className="flex-1 overflow-auto rounded-md border border-border/30 bg-muted/30 p-3">
            <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{prettyPayload || "(sin payload)"}</pre>
          </div>
        )}
        {data?.rawPayload ? (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(prettyPayload);
                toast.success("Payload copiado al portapapeles");
              }}
            >
              <Copy className="h-3 w-3 mr-1" /> Copiar
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
