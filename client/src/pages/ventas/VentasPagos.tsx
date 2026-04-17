/**
 * Ventas > Pagos — Unified payments workspace.
 *
 * Three tabs:
 *  - "CRM (legacy)" → payments derived from leads.cashCollected, the
 *    historical manual-entry flow. Left intact so nothing breaks the day
 *    Stripe starts flowing.
 *  - "Stripe · asociados" → charges pulled from Stripe that are already
 *    linked to a lead (auto-match by email/metadata or manual assignment).
 *  - "Stripe · sin asociar" → charges Stripe received but no lead matched.
 *    The "Asociar" button opens a modal for manual linking.
 *
 * Admin-only action: "Sync Stripe (N días)" runs a one-shot historical
 * backfill against the Stripe API. Webhook keeps things fresh after that.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LeadEditSheet } from "@/components/LeadEditSheet";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";
import { AssignPaymentToLeadModal, type StripePaymentSummary } from "@/components/AssignPaymentToLeadModal";
import { MESES, getCurrentMes, getCurrentSemana } from "@shared/period";
import { toast } from "sonner";
import {
  Receipt, DollarSign, Package, TrendingUp,
  Hash, CalendarDays, Repeat, Link2, ExternalLink, RefreshCw,
  CheckCircle2, AlertTriangle, Loader2, CircleDollarSign,
} from "lucide-react";

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatMoney(n: number, currency: string): string {
  const code = (currency || "usd").toUpperCase();
  const locale = code === "CLP" ? "es-CL" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: code === "CLP" ? 0 : 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)} ${code}`;
  }
}

function formatDate(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    succeeded:           { label: "Exitoso",     cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
    pending:             { label: "Pendiente",   cls: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
    failed:              { label: "Falló",       cls: "bg-rose-500/10 text-rose-500 border-rose-500/30" },
    refunded:            { label: "Reembolsado", cls: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    partially_refunded:  { label: "Parcial",     cls: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    disputed:            { label: "Disputado",   cls: "bg-red-500/10 text-red-500 border-red-500/30" },
    canceled:            { label: "Cancelado",   cls: "bg-muted/30 text-muted-foreground border-border" },
  };
  const e = map[status] ?? { label: status, cls: "bg-muted/30 text-muted-foreground border-border" };
  return <Badge variant="outline" className={`text-[10px] ${e.cls}`}>{e.label}</Badge>;
}

function StripePaymentRow({
  row,
  onAssign,
  onOpenLead,
}: {
  row: any;
  onAssign?: (p: StripePaymentSummary) => void;
  onOpenLead?: (leadId: number) => void;
}) {
  return (
    <tr className="border-t border-border/30 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(row.stripeCreatedAt)}
      </td>
      <td className="px-3 py-2.5">
        <div className="font-medium text-sm truncate max-w-[200px]">
          {row.customerName || row.customerEmail || <span className="italic text-muted-foreground">Sin datos</span>}
        </div>
        {row.customerEmail && row.customerName && (
          <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{row.customerEmail}</div>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[220px]">
        {row.description || "—"}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {row.paymentMethodBrand && (
            <span className="text-[11px] capitalize text-muted-foreground">
              {row.paymentMethodBrand}
            </span>
          )}
          {row.last4 && <span className="text-[11px] text-muted-foreground tabular-nums">··{row.last4}</span>}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        <div className="text-sm font-semibold text-emerald-500">
          {formatMoney(row.amountNet, row.currency)}
        </div>
        {row.amountRefunded > 0 && (
          <div className="text-[10px] text-orange-400">
            −{formatMoney(row.amountRefunded, row.currency)} refund
          </div>
        )}
      </td>
      <td className="px-3 py-2.5">
        {row.leadId ? (
          <button
            onClick={() => onOpenLead?.(row.leadId)}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <Link2 className="h-3 w-3" />
            {row.leadNombre || `Lead #${row.leadId}`}
          </button>
        ) : (
          <span className="text-[11px] italic text-muted-foreground">Sin asociar</span>
        )}
        {row.matchMethod && (
          <div className="text-[10px] text-muted-foreground/70 mt-0.5">via {row.matchMethod}</div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {!row.leadId && onAssign && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={() => onAssign({
                id: row.id,
                amount: row.amount,
                amountNet: row.amountNet,
                currency: row.currency,
                status: row.status,
                paymentMethodBrand: row.paymentMethodBrand,
                last4: row.last4,
                customerEmail: row.customerEmail,
                customerName: row.customerName,
                description: row.description,
                stripeCreatedAt: row.stripeCreatedAt,
              })}
            >
              <Link2 className="h-3 w-3 mr-1" /> Asociar
            </Button>
          )}
          {row.receiptUrl && (
            <a
              href={row.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border hover:bg-muted/40"
              title="Ver recibo en Stripe"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

function StripeStatusIndicator() {
  const { data, isLoading } = trpc.stripe.status.useQuery(undefined, { staleTime: 30_000 });
  if (isLoading) {
    return <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" /> Verificando Stripe…
    </span>;
  }
  if (!data) return null;
  if (!data.configured) {
    return (
      <span className="text-[11px] text-amber-500 inline-flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> Stripe no configurado
      </span>
    );
  }
  if (!data.connected) {
    return (
      <span className="text-[11px] text-rose-500 inline-flex items-center gap-1" title={data.error ?? ""}>
        <AlertTriangle className="h-3 w-3" /> Stripe error
      </span>
    );
  }
  return (
    <span className="text-[11px] text-emerald-500 inline-flex items-center gap-1">
      <CheckCircle2 className="h-3 w-3" /> Stripe conectado
      {data.accountId && <span className="text-muted-foreground/70">· {data.accountId}</span>}
    </span>
  );
}

function StripePaymentsTable({
  kind,
  onAssign,
  onOpenLead,
}: {
  kind: "assigned" | "unassigned";
  onAssign?: (p: StripePaymentSummary) => void;
  onOpenLead?: (leadId: number) => void;
}) {
  const { data = [], isLoading } = trpc.stripe.listPayments.useQuery({ kind, limit: 200 });

  const totals = useMemo(() => {
    const rows = data as any[];
    let sumNet = 0;
    let sumRefund = 0;
    for (const r of rows) {
      sumNet += Number(r.amountNet ?? 0);
      sumRefund += Number(r.amountRefunded ?? 0);
    }
    return { count: rows.length, sumNet, sumRefund };
  }, [data]);

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">
            {kind === "assigned" ? "Pagos Stripe — asociados a lead" : "Pagos Stripe — sin asociar"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kind === "assigned"
              ? "Match automático por metadata.leadId o correo, o vinculación manual."
              : "Charges recibidos desde Stripe que aún no tienen un lead en el CRM."}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{totals.count} {totals.count === 1 ? "pago" : "pagos"}</div>
          <div className="font-semibold text-emerald-500 tabular-nums">
            {formatUSD(totals.sumNet)} neto
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : totals.count === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-sm text-muted-foreground">
            {kind === "assigned" ? (
              <>
                <CircleDollarSign className="h-10 w-10 mb-2 opacity-40" />
                <p>Aún no hay pagos de Stripe asociados a leads.</p>
                <p className="text-xs mt-1">Corre el sync histórico para importar charges anteriores.</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-10 w-10 mb-2 text-emerald-500/60" />
                <p>Todo asociado — no hay pagos sin lead.</p>
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[560px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0 backdrop-blur z-10">
                <tr className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                  <th className="text-left px-3 py-2.5 font-medium">Cliente</th>
                  <th className="text-left px-3 py-2.5 font-medium">Descripción</th>
                  <th className="text-left px-3 py-2.5 font-medium">Método</th>
                  <th className="text-left px-3 py-2.5 font-medium">Estado</th>
                  <th className="text-right px-3 py-2.5 font-medium">Monto</th>
                  <th className="text-left px-3 py-2.5 font-medium">Lead</th>
                  <th className="text-right px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(data as any[]).map((row) => (
                  <StripePaymentRow
                    key={row.id}
                    row={row}
                    onAssign={onAssign}
                    onOpenLead={onOpenLead}
                  />
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default function VentasPagos() {
  const [mes, setMes] = useState<string>(() => getCurrentMes());
  const [semana, setSemana] = useState<string>(() => String(getCurrentSemana()));
  const [closer, setCloser] = useState<string>("all");
  const [editingLead, setEditingLead] = useState<any | null>(null);

  // Stripe state
  const [assigningPayment, setAssigningPayment] = useState<StripePaymentSummary | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const utils = trpc.useUtils();

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

  // Count unassigned for tab badge
  const { data: unassignedList = [] } = trpc.stripe.listPayments.useQuery(
    { kind: "unassigned", limit: 500 },
    { staleTime: 30_000 }
  );
  const unassignedCount = (unassignedList as any[]).length;

  const syncMutation = trpc.stripe.syncHistorical.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Sync Stripe: ${res.total} charges · ${res.inserted} nuevos · ${res.updated} actualizados · ${res.matched} auto-asociados`
      );
      utils.stripe.listPayments.invalidate();
      utils.sales.payments.invalidate();
    },
    onError: (err: any) => {
      toast.error(`Sync falló: ${err?.message ?? "error desconocido"}`);
    },
  });

  function handleOpenLead(leadId: number) {
    setEditingLead({ id: leadId });
  }

  function handleAssign(p: StripePaymentSummary) {
    setAssigningPayment(p);
    setAssignOpen(true);
  }

  const t = data?.totals;
  const payments = data?.payments ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Registro de Pagos</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Pagos del CRM + Stripe en una sola vista.
            </p>
            <StripeStatusIndicator />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate({ sinceDays: 180 })}
            disabled={syncMutation.isPending}
            title="Importa los charges de Stripe de los últimos 180 días"
          >
            {syncMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sincronizando…</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Sync Stripe (180d)</>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="crm" className="space-y-6">
        <TabsList>
          <TabsTrigger value="crm">
            <Receipt className="h-4 w-4 mr-1.5" /> CRM (legacy)
          </TabsTrigger>
          <TabsTrigger value="stripe-assigned">
            <CheckCircle2 className="h-4 w-4 mr-1.5" /> Stripe · asociados
          </TabsTrigger>
          <TabsTrigger value="stripe-unassigned" className="relative">
            <AlertTriangle className="h-4 w-4 mr-1.5" /> Stripe · sin asociar
            {unassignedCount > 0 && (
              <Badge variant="outline" className="ml-2 h-5 px-1.5 bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">
                {unassignedCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CRM legacy view */}
        <TabsContent value="crm" className="space-y-6 mt-0">
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
        </TabsContent>

        {/* TAB 2: Stripe asociados */}
        <TabsContent value="stripe-assigned" className="mt-0">
          <StripePaymentsTable
            kind="assigned"
            onOpenLead={handleOpenLead}
          />
        </TabsContent>

        {/* TAB 3: Stripe sin asociar */}
        <TabsContent value="stripe-unassigned" className="mt-0">
          <StripePaymentsTable
            kind="unassigned"
            onAssign={handleAssign}
          />
        </TabsContent>
      </Tabs>

      {/* Lead Edit Sheet */}
      <LeadEditSheet
        lead={rawLead ?? editingLead}
        onOpenChange={(open) => { if (!open) setEditingLead(null); }}
      />

      {/* Assign to lead modal */}
      <AssignPaymentToLeadModal
        payment={assigningPayment}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </div>
  );
}
