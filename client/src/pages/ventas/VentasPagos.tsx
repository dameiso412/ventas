/**
 * Ventas > Pagos — Registered payments report.
 *
 * Pulls from leads with cashCollected > 0. Shows per-payment rows (closer,
 * producto, cash, contracted) and aggregate totals (count, sum cash, avg
 * ticket, breakdown PIF vs Setup+Monthly).
 *
 * Derived view: the "payment date" is `updatedAt` of the lead (approx. when
 * the cashCollected value was set).
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LeadEditSheet } from "@/components/LeadEditSheet";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";
import { MESES, getCurrentMes, getCurrentSemana } from "@shared/period";
import {
  Receipt, DollarSign, Users as UsersIcon, Package, TrendingUp,
  Hash, CalendarDays, Repeat,
} from "lucide-react";

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function KPI({ title, value, subtitle, icon: Icon, tint }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  tint?: "primary" | "green" | "blue" | "violet" | "amber";
}) {
  const tintClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-emerald-500/10 text-emerald-500",
    blue: "bg-sky-500/10 text-sky-500",
    violet: "bg-violet-500/10 text-violet-500",
    amber: "bg-amber-500/10 text-amber-500",
  };
  const cls = tintClasses[tint ?? "primary"];
  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
            <p className="text-2xl font-bold truncate">{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VentasPagos() {
  const [mes, setMes] = useState<string>(() => getCurrentMes());
  const [semana, setSemana] = useState<string>(() => String(getCurrentSemana()));
  const [closer, setCloser] = useState<string>("all");
  const [editingLead, setEditingLead] = useState<any | null>(null);

  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
    closer: closer !== "all" ? closer : undefined,
  }), [mes, semana, closer]);

  const { data, isLoading } = trpc.sales.payments.useQuery(filters);
  const { data: rawLead } = trpc.leads.getById.useQuery(
    { id: editingLead?.id ?? 0 },
    { enabled: editingLead != null }
  );

  const t = data?.totals;
  const payments = data?.payments ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Registro de Pagos</h1>
          <p className="text-sm text-muted-foreground">
            Pagos registrados en el periodo — derivados de leads con cash collected.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <TeamMemberSelect
            value={closer}
            onValueChange={setCloser}
            role="CLOSER"
            includeAll
            allLabel="Todos los closers"
            className="w-[160px] bg-card/50"
          />
        </div>
      </div>

      {/* KPI Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KPI title="Pagos" value={t?.count ?? 0} icon={Hash} tint="primary" />
          <KPI title="Cash collected" value={formatUSD(t?.sumCash ?? 0)} icon={DollarSign} tint="green" />
          <KPI title="Contratado" value={formatUSD(t?.sumContracted ?? 0)} icon={TrendingUp} tint="blue" />
          <KPI title="Ticket prom." value={formatUSD(t?.avgTicket ?? 0)} icon={Receipt} tint="violet" />
          <KPI
            title="PIF"
            value={t?.pifCount ?? 0}
            subtitle={formatUSD(t?.pifCash ?? 0)}
            icon={Package}
            tint="amber"
          />
          <KPI
            title="Setup + Monthly"
            value={t?.setupMonthlyCount ?? 0}
            subtitle={formatUSD(t?.setupMonthlyCash ?? 0)}
            icon={Repeat}
            tint="blue"
          />
        </div>
      )}

      {/* Payments table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Pagos registrados</CardTitle>
          <p className="text-xs text-muted-foreground">
            Click en una fila para editar el lead. Fecha de pago ≈ última actualización del lead.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-sm text-muted-foreground">
              <Receipt className="h-10 w-10 mb-2 opacity-40" />
              <p>No hay pagos en el periodo seleccionado.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[560px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 sticky top-0 backdrop-blur">
                  <tr className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                    <th className="text-left px-3 py-2.5 font-medium">Contacto</th>
                    <th className="text-left px-3 py-2.5 font-medium">Closer</th>
                    <th className="text-left px-3 py-2.5 font-medium">Producto</th>
                    <th className="text-right px-3 py-2.5 font-medium">Cash</th>
                    <th className="text-right px-3 py-2.5 font-medium">Contratado</th>
                    <th className="text-right px-4 py-2.5 font-medium">Próximo cobro</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setEditingLead(p)}
                      className="cursor-pointer hover:bg-muted/40 border-t border-border/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(p.paymentDate)}
                      </td>
                      <td className="px-3 py-2.5 font-medium truncate max-w-[220px]">
                        {p.nombre || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {p.closer || <span className="italic text-amber-500">sin closer</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {p.productoTipo ? (
                          <Badge variant="outline" className={
                            p.productoTipo === "PIF"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                              : "bg-sky-500/10 text-sky-500 border-sky-500/30"
                          }>
                            {p.productoTipo === "PIF" ? "PIF" : "Setup+Mo"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-emerald-500 tabular-nums">
                        {formatUSD(p.cashCollected)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {p.contractedRevenue > 0 ? formatUSD(p.contractedRevenue) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {p.productoTipo === "SETUP_MONTHLY" && <CalendarDays className="h-3 w-3" />}
                          {p.fechaProximoCobro ? formatDate(p.fechaProximoCobro) : <span className="text-muted-foreground/60">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer with totals */}
                <tfoot>
                  <tr className="border-t-2 border-border/60 bg-muted/20 font-semibold">
                    <td colSpan={4} className="px-4 py-2.5 text-xs uppercase tracking-wider">
                      {payments.length} {payments.length === 1 ? "pago" : "pagos"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-500">
                      {formatUSD(t?.sumCash ?? 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatUSD(t?.sumContracted ?? 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Closer breakdown — small card */}
      {!isLoading && t && t.count > 0 && (t.pifCount > 0 || t.setupMonthlyCount > 0) && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Desglose por producto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">PIF (Pago en único)</p>
                    <p className="text-xs text-muted-foreground">{t.pifCount} {t.pifCount === 1 ? "pago" : "pagos"}</p>
                  </div>
                </div>
                <p className="text-lg font-bold tabular-nums">{formatUSD(t.pifCash)}</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-sky-500/5 border border-sky-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
                    <Repeat className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Setup + Monthly</p>
                    <p className="text-xs text-muted-foreground">{t.setupMonthlyCount} {t.setupMonthlyCount === 1 ? "contrato" : "contratos"}</p>
                  </div>
                </div>
                <p className="text-lg font-bold tabular-nums">{formatUSD(t.setupMonthlyCash)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lead Edit Sheet */}
      <LeadEditSheet
        lead={rawLead ?? editingLead}
        onOpenChange={(open) => { if (!open) setEditingLead(null); }}
      />
    </div>
  );
}
