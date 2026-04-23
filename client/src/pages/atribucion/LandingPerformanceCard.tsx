/**
 * Landing Performance Card — aggregates lead conversion by landing page.
 *
 * Data source: `trpc.attribution.byLanding` (one row per `landingSlug`, plus
 * a "Sin landing" bucket for NULL). The landing slug is either set explicitly
 * by GHL (custom field on the automation per landing) or derived from the
 * landing URL at webhook time — see docs/landing-tracking-ghl.md.
 *
 * Why NOT a tab inside the Campaign/Adset/Ad drilldown: landings answer a
 * different question (what page converted the lead — Lovable side) than
 * Meta's campaign/adset/ad hierarchy (what ad paid for the click). A
 * standalone section keeps the comparison clean.
 */
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, LayoutDashboard } from "lucide-react";

// USD formatting (cashCollected is already USD, not CLP — this section
// reports ventas in the currency the business operates in).
function formatUsd(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "$0";
  const n = Number(value);
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(num: number, den: number): string {
  if (!den) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function slugLabel(slug: string | null): string {
  if (!slug) return "Sin landing";
  return slug;
}

export default function LandingPerformanceCard({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  const landingQuery = trpc.attribution.byLanding.useQuery(
    { dateFrom, dateTo },
    { staleTime: 60 * 1000 }
  );

  const rows = landingQuery.data ?? [];
  const totalLeads = rows.reduce((acc, r) => acc + Number(r.totalLeads || 0), 0);
  const sinLandingRow = rows.find((r) => !r.landingSlug);
  const sinLandingPct = totalLeads > 0 && sinLandingRow
    ? (Number(sinLandingRow.totalLeads) / totalLeads) * 100
    : 0;

  // Show a subtle GHL-config warning when more than 20% of leads lack a slug.
  // Below that threshold it's noise (some leads will always come from ad-hoc
  // sources like direct ManyChat DMs without landing). See plan Fase 4.
  const showGhlWarning = sinLandingPct > 20;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          Performance por Landing
          {showGhlWarning && (
            <Badge variant="destructive" className="text-[10px] ml-2">
              ⚠️ Config GHL
            </Badge>
          )}
        </CardTitle>
        <div className="text-xs text-muted-foreground">
          {totalLeads} leads en el período
        </div>
      </CardHeader>

      {showGhlWarning && (
        <div className="mx-6 mb-3 rounded border border-amber-500/40 bg-amber-50/5 px-3 py-2 text-xs text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>{sinLandingPct.toFixed(0)}% de los leads</strong> llegaron sin <code>landing_slug</code>.
            Revisá la config GHL (doc: <code>docs/landing-tracking-ghl.md</code>) — cada
            automatización por landing debe setear el custom field antes del webhook.
          </div>
        </div>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Landing</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Leads</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Citas</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">%Cita</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Demos</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Ventas</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">%Close</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Cash</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">HOT</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">WARM</th>
              </tr>
            </thead>
            <tbody>
              {landingQuery.isLoading && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Cargando landings...
                  </td>
                </tr>
              )}
              {!landingQuery.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-muted-foreground">
                    Sin leads en este período
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const isSinLanding = !row.landingSlug;
                // Highlight "Sin landing" row only when it's a meaningful share
                // (>10%) — small NULL slices are expected from ad-hoc sources.
                const highlight = isSinLanding && totalLeads > 0
                  && Number(row.totalLeads) / totalLeads > 0.10;
                const leads = Number(row.totalLeads);
                const citas = Number(row.citas);
                const ventas = Number(row.ventas);
                const demos = Number(row.demosAsistidas);
                return (
                  <tr
                    key={row.landingSlug ?? "__null__"}
                    className={`border-b border-border/30 ${highlight ? "bg-amber-500/5" : ""}`}
                  >
                    <td className="py-2.5 px-3">
                      <span className={isSinLanding ? "text-muted-foreground italic" : "font-medium"}>
                        {slugLabel(row.landingSlug)}
                      </span>
                      {highlight && <span className="ml-2 text-amber-400">⚠️</span>}
                    </td>
                    <td className="text-right py-2.5 px-3">{leads.toLocaleString()}</td>
                    <td className="text-right py-2.5 px-3">{citas.toLocaleString()}</td>
                    <td className="text-right py-2.5 px-3 text-muted-foreground">{formatPct(citas, leads)}</td>
                    <td className="text-right py-2.5 px-3">{demos.toLocaleString()}</td>
                    <td className="text-right py-2.5 px-3 text-emerald-400">{ventas.toLocaleString()}</td>
                    <td className="text-right py-2.5 px-3 text-muted-foreground">{formatPct(ventas, demos)}</td>
                    <td className="text-right py-2.5 px-3 text-emerald-400">{formatUsd(Number(row.totalCashCollected))}</td>
                    <td className="text-right py-2.5 px-3 text-red-400">{Number(row.hot).toLocaleString()}</td>
                    <td className="text-right py-2.5 px-3 text-orange-300">{Number(row.warm).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
