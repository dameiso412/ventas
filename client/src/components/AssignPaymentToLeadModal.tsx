/**
 * Modal to manually link a Stripe payment to a CRM lead.
 *
 * Flow: user clicks "Asociar" on an unmatched Stripe payment → this modal
 * opens with the payment summary at top + a search box. Query pulls all
 * leads, filters locally by nombre / correo / telefono (leads table is
 * small enough that this is fine). On confirm, calls
 * `stripe.assignPaymentToLead` which records matchMethod="manual".
 *
 * Consumers: VentasPagos "Sin asociar" tab.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, Link as LinkIcon, Mail, Phone, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export interface StripePaymentSummary {
  id: number;
  amount: number;
  amountNet: number;
  currency: string;
  status: string;
  paymentMethodBrand: string | null;
  last4: string | null;
  customerEmail: string | null;
  customerName: string | null;
  description: string | null;
  stripeCreatedAt: Date | string;
}

interface Props {
  payment: StripePaymentSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: () => void;
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

function formatDate(iso: Date | string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function AssignPaymentToLeadModal({ payment, open, onOpenChange, onAssigned }: Props) {
  const [query, setQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: leads = [], isLoading } = trpc.leads.list.useQuery(undefined, {
    // Pull once per opening; cache is fine because this typeahead is tolerant
    // of ~1min-stale lead list and the table isn't huge.
    staleTime: 60_000,
  });

  const assignMutation = trpc.stripe.assignPaymentToLead.useMutation({
    onSuccess: () => {
      toast.success("Pago asociado al lead");
      utils.stripe.listPayments.invalidate();
      utils.stripe.paymentsByLead.invalidate();
      utils.sales.payments.invalidate();
      utils.sales.commissions.invalidate();
      onAssigned?.();
      onOpenChange(false);
      setQuery("");
      setSelectedLeadId(null);
    },
    onError: (err: any) => {
      toast.error(`No se pudo asociar: ${err?.message ?? "error desconocido"}`);
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default: show leads matching the payment's email or name (if any),
      // falling back to the first 50 most recent leads so the list isn't empty.
      const paymentEmail = payment?.customerEmail?.toLowerCase();
      const paymentName = payment?.customerName?.toLowerCase();
      const suggested = (leads as any[]).filter((l) => {
        if (paymentEmail && l.correo?.toLowerCase() === paymentEmail) return true;
        if (paymentName && l.nombre?.toLowerCase().includes(paymentName)) return true;
        return false;
      });
      if (suggested.length > 0) return suggested.slice(0, 50);
      return (leads as any[]).slice(0, 50);
    }
    return (leads as any[]).filter((l) => {
      const n = (l.nombre ?? "").toLowerCase();
      const c = (l.correo ?? "").toLowerCase();
      const t = (l.telefono ?? "").toLowerCase();
      return n.includes(q) || c.includes(q) || t.includes(q);
    }).slice(0, 100);
  }, [query, leads, payment]);

  function handleConfirm() {
    if (!payment || !selectedLeadId) return;
    assignMutation.mutate({ paymentId: payment.id, leadId: selectedLeadId });
  }

  // Auto-highlight the top suggestion if the payment has an email match
  const suggestedLead = useMemo(() => {
    if (!payment?.customerEmail) return null;
    const email = payment.customerEmail.toLowerCase();
    return (leads as any[]).find((l) => l.correo?.toLowerCase() === email) ?? null;
  }, [payment, leads]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asociar pago a un lead</DialogTitle>
          <DialogDescription>
            Selecciona el lead del CRM que corresponde a este pago de Stripe.
            Esta acción registra el match como <span className="font-medium">manual</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Payment summary */}
        {payment && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-emerald-500 tabular-nums">
                {formatMoney(payment.amountNet, payment.currency)}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {payment.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
              <span>{formatDate(payment.stripeCreatedAt)}</span>
              {payment.paymentMethodBrand && (
                <span className="capitalize">
                  {payment.paymentMethodBrand}
                  {payment.last4 ? ` ····${payment.last4}` : ""}
                </span>
              )}
              {payment.customerEmail && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {payment.customerEmail}
                </span>
              )}
              {payment.customerName && (
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="h-3 w-3" /> {payment.customerName}
                </span>
              )}
            </div>
            {payment.description && (
              <p className="text-xs text-muted-foreground italic truncate">{payment.description}</p>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar por nombre, correo o teléfono…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>

        {/* Suggestion banner */}
        {suggestedLead && !query && (
          <p className="text-[11px] text-emerald-400 -mt-2">
            💡 Coincidencia por correo: <span className="font-medium">{suggestedLead.nombre || suggestedLead.correo}</span>
          </p>
        )}

        {/* Lead list */}
        <ScrollArea className="max-h-[280px] border border-border/40 rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando leads…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Sin coincidencias. Prueba otro término.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((lead: any) => {
                const isSelected = selectedLeadId === lead.id;
                return (
                  <li
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                      isSelected
                        ? "bg-primary/15 border-l-2 border-primary"
                        : "hover:bg-muted/40 border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {lead.nombre || <span className="italic text-muted-foreground">Sin nombre</span>}
                          <span className="text-[10px] text-muted-foreground ml-1.5">#{lead.id}</span>
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          {lead.correo && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {lead.correo}
                            </span>
                          )}
                          {lead.telefono && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {lead.telefono}
                            </span>
                          )}
                        </div>
                      </div>
                      {lead.closer && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {lead.closer}
                        </Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assignMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedLeadId || assignMutation.isPending}
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Asociando…
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4 mr-2" /> Asociar al lead seleccionado
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
