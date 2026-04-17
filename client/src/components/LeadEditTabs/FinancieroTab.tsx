import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/SegmentedControl";
import { trpc } from "@/lib/trpc";
import { CreditCard, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";
import type { LeadForm } from "./leadEditState";

interface FinancieroTabProps {
  form: LeadForm;
  setField: <K extends keyof LeadForm>(field: K, value: LeadForm[K]) => void;
  lead?: { id?: number } | null;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{children}</Label>;
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background/50 pl-6"
        placeholder={placeholder ?? "0.00"}
      />
    </div>
  );
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

function formatDate(iso: Date | string | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function StripePaymentsSection({ leadId }: { leadId: number }) {
  const { data = [], isLoading } = trpc.stripe.paymentsByLead.useQuery({ leadId });
  const rows = data as any[];

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/40 bg-muted/10 p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando pagos en Stripe…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <CreditCard className="h-3.5 w-3.5" />
        Sin pagos de Stripe asociados a este lead.
      </div>
    );
  }

  const totalNet = rows.reduce((s, r) => s + Number(r.amountNet ?? 0), 0);
  const totalRefunded = rows.reduce((s, r) => s + Number(r.amountRefunded ?? 0), 0);
  const hasAlerts = rows.some((r) => r.status === "refunded" || r.status === "partially_refunded" || r.status === "disputed");
  const currency = rows[0]?.currency ?? "usd";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-medium">Pagos Stripe</span>
          <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
          {hasAlerts && (
            <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-500 border-orange-500/30">
              <AlertTriangle className="h-2.5 w-2.5 mr-1" /> refund/dispute
            </Badge>
          )}
        </div>
        <div className="text-right text-xs">
          <div className="font-semibold text-emerald-500 tabular-nums">
            {formatMoney(totalNet, currency)}
          </div>
          {totalRefunded > 0 && (
            <div className="text-[10px] text-orange-400">
              −{formatMoney(totalRefunded, currency)} reembolsado
            </div>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr className="text-[10px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-3 py-2 font-medium">Fecha</th>
              <th className="text-left px-3 py-2 font-medium">Método</th>
              <th className="text-left px-3 py-2 font-medium">Estado</th>
              <th className="text-right px-3 py-2 font-medium">Monto</th>
              <th className="text-right px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const statusLabel = p.status === "succeeded" ? "Exitoso"
                : p.status === "refunded" ? "Reembolsado"
                : p.status === "partially_refunded" ? "Parcial"
                : p.status === "disputed" ? "Disputado"
                : p.status;
              const statusCls = p.status === "succeeded" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                : p.status === "disputed" ? "bg-red-500/10 text-red-500 border-red-500/30"
                : (p.status === "refunded" || p.status === "partially_refunded") ? "bg-orange-500/10 text-orange-500 border-orange-500/30"
                : "bg-muted/30 text-muted-foreground border-border";
              return (
                <tr key={p.id} className="border-t border-border/30">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {formatDate(p.stripeCreatedAt)}
                  </td>
                  <td className="px-3 py-2">
                    {p.paymentMethodBrand ? (
                      <span className="capitalize text-muted-foreground">
                        {p.paymentMethodBrand}
                        {p.last4 ? ` ··${p.last4}` : ""}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] ${statusCls}`}>
                      {statusLabel}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <div className="font-medium text-emerald-500">
                      {formatMoney(Number(p.amountNet ?? 0), p.currency)}
                    </div>
                    {Number(p.amountRefunded ?? 0) > 0 && (
                      <div className="text-[10px] text-orange-400">
                        −{formatMoney(Number(p.amountRefunded), p.currency)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {p.receiptUrl ? (
                      <a
                        href={p.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Recibo
                      </a>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FinancieroTab({ form, setField, lead }: FinancieroTabProps) {
  const leadId = lead?.id;
  return (
    <div className="space-y-5">
      {/* Tipo de producto */}
      <div className="space-y-1.5">
        <FieldLabel>Tipo de producto</FieldLabel>
        <SegmentedControl
          value={form.productoTipo || "NONE"}
          onChange={(v) => setField("productoTipo", v === "NONE" ? "" : v)}
          fullWidth
          options={[
            { value: "NONE", label: "Sin especificar", activeClass: "text-muted-foreground" },
            { value: "PIF", label: "PIF (pago completo)", activeClass: "text-green-400" },
            { value: "SETUP_MONTHLY", label: "Setup + Monthly", activeClass: "text-purple-400" },
          ]}
        />
      </div>

      {form.productoTipo === "PIF" && (
        <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5 space-y-3">
          <p className="text-xs text-green-400 font-medium">Pago completo por adelantado (2+ meses)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Cash Collected (USD)</FieldLabel>
              <MoneyInput value={form.cashCollected} onChange={(v) => setField("cashCollected", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Contracted Revenue (USD)</FieldLabel>
              <MoneyInput value={form.contractedRevenue} onChange={(v) => setField("contractedRevenue", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Depósito (USD)</FieldLabel>
              <MoneyInput value={form.deposito} onChange={(v) => setField("deposito", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Facturado (USD)</FieldLabel>
              <MoneyInput value={form.facturado} onChange={(v) => setField("facturado", v)} />
            </div>
          </div>
        </div>
      )}

      {form.productoTipo === "SETUP_MONTHLY" && (
        <div className="p-4 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-3">
          <p className="text-xs text-purple-400 font-medium">Implementación + recurrencia mensual</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Setup Fee (USD)</FieldLabel>
              <MoneyInput value={form.setupFee} onChange={(v) => setField("setupFee", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Recurrencia Mensual (USD)</FieldLabel>
              <MoneyInput value={form.recurrenciaMensual} onChange={(v) => setField("recurrenciaMensual", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Cash Collected (USD)</FieldLabel>
              <MoneyInput value={form.cashCollected} onChange={(v) => setField("cashCollected", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Contracted Revenue (USD)</FieldLabel>
              <MoneyInput value={form.contractedRevenue} onChange={(v) => setField("contractedRevenue", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Depósito (USD)</FieldLabel>
              <MoneyInput value={form.deposito} onChange={(v) => setField("deposito", v)} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Fecha próximo cobro</FieldLabel>
              <Input
                type="date"
                value={form.fechaProximoCobro}
                onChange={(e) => setField("fechaProximoCobro", e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <FieldLabel>Facturado (USD)</FieldLabel>
              <MoneyInput value={form.facturado} onChange={(v) => setField("facturado", v)} />
            </div>
          </div>
        </div>
      )}

      {!form.productoTipo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Facturado (USD)</FieldLabel>
            <MoneyInput value={form.facturado} onChange={(v) => setField("facturado", v)} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Cash Collected (USD)</FieldLabel>
            <MoneyInput value={form.cashCollected} onChange={(v) => setField("cashCollected", v)} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Depósito (USD)</FieldLabel>
            <MoneyInput value={form.deposito} onChange={(v) => setField("deposito", v)} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Contracted Revenue (USD)</FieldLabel>
            <MoneyInput value={form.contractedRevenue} onChange={(v) => setField("contractedRevenue", v)} />
          </div>
        </div>
      )}

      {/* Stripe payments (read-only, source of truth) */}
      {typeof leadId === "number" && leadId > 0 && (
        <div className="pt-2 border-t border-border/40">
          <StripePaymentsSection leadId={leadId} />
        </div>
      )}
    </div>
  );
}
