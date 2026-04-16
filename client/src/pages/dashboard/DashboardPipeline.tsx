/**
 * Dashboard > Pipeline — Pipeline value sub-tab.
 *
 * Shows the aggregate dollar value of open opportunities (confirmed demos
 * that haven't been attended + outcome still pending), average ticket, closed
 * value, and a table of the top 10 open opportunities by ticket size.
 *
 * Admin can edit the global default ticket value (used when a lead doesn't
 * have `contractedRevenue` set).
 */
import { useMemo, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeadEditSheet } from "@/components/LeadEditSheet";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DollarSign, TrendingUp, Target, CheckCircle2, Hash, Percent, Save,
} from "lucide-react";
import { MESES, getCurrentMes, getCurrentSemana } from "@shared/period";
import { toast } from "sonner";

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

function scoreBadgeColor(label: string | null | undefined): string {
  switch (label) {
    case "HOT": return "bg-rose-500/15 text-rose-500 border-rose-500/30";
    case "WARM": return "bg-orange-500/15 text-orange-500 border-orange-500/30";
    case "TIBIO": return "bg-amber-500/15 text-amber-500 border-amber-500/30";
    case "FRÍO": return "bg-sky-500/15 text-sky-500 border-sky-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function DashboardPipeline() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [mes, setMes] = useState<string>(() => getCurrentMes());
  const [semana, setSemana] = useState<string>(() => String(getCurrentSemana()));
  const [editingLead, setEditingLead] = useState<any>(null);

  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
  }), [mes, semana]);

  const { data, isLoading } = trpc.dashboard.pipelineValue.useQuery(filters);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Valor del Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Oportunidades abiertas × ticket, ticket promedio y valor cerrado del periodo.
          </p>
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

      {/* KPI Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Pipeline Value</p>
                  <p className="text-2xl font-bold text-emerald-500 truncate">{formatUSD(data?.pipelineValue ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{data?.pipelineCount ?? 0} citas confirmadas</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Oportunidades abiertas</p>
                  <p className="text-2xl font-bold truncate">{data?.openOpportunities ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground truncate">Total: {formatUSD(data?.openValue ?? 0)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ticket promedio</p>
                  <p className="text-2xl font-bold truncate">{formatUSD(data?.avgTicket ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">contratado o default</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Valor cerrado</p>
                  <p className="text-2xl font-bold text-sky-500 truncate">{formatUSD(data?.closedValue ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{data?.closedCount ?? 0} ventas (cash)</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-sky-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tasa de cierre</p>
                  <p className="text-2xl font-bold truncate">{(data?.conversionRate ?? 0).toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground truncate">Cerrado / (Cerrado + Pipeline)</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Percent className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ticket default</p>
                  <p className="text-2xl font-bold truncate">{formatUSD(data?.defaultTicket ?? 3150)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">fallback global</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top opportunities table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Top oportunidades abiertas</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Citas confirmadas pendientes, ordenadas por ticket. Click para abrir/editar.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !data || data.topOpps.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No hay oportunidades abiertas en el periodo seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="py-2 px-2 font-medium">Nombre</th>
                    <th className="py-2 px-2 font-medium">Score</th>
                    <th className="py-2 px-2 font-medium">Closer</th>
                    <th className="py-2 px-2 font-medium">Periodo</th>
                    <th className="py-2 px-2 font-medium text-right">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topOpps.map(o => (
                    <tr
                      key={o.id}
                      className="border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setEditingLead(o)}
                    >
                      <td className="py-2 px-2 font-medium">{o.nombre || "—"}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={scoreBadgeColor(o.scoreLabel)}>
                          {o.scoreLabel || "—"}{o.score != null ? ` · ${o.score}` : ""}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{o.closer || "—"}</td>
                      <td className="py-2 px-2 text-muted-foreground">{o.mes ?? ""}{o.semana ? ` · S${o.semana}` : ""}</td>
                      <td className="py-2 px-2 text-right font-semibold text-emerald-500">{formatUSD(o.effectiveTicket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Default ticket config (admin only) */}
      {isAdmin && <DefaultTicketConfig />}

      {/* Lead Edit Sheet */}
      <LeadEditSheet
        lead={editingLead}
        onOpenChange={(open) => { if (!open) setEditingLead(null); }}
      />
    </div>
  );
}

/**
 * Admin-only editor for the global default ticket value. Persists to
 * `system_config` via tRPC mutation and invalidates the pipeline query.
 */
function DefaultTicketConfig() {
  const utils = trpc.useUtils();
  const { data: current, isLoading } = trpc.systemConfig.getDefaultTicket.useQuery();
  const [value, setValue] = useState<string>("");

  // Sync local state when the server value loads / changes
  useEffect(() => {
    if (current != null && !value) setValue(String(current));
  }, [current, value]);

  const mutation = trpc.systemConfig.set.useMutation({
    onSuccess: () => {
      toast.success("Ticket default actualizado");
      utils.systemConfig.getDefaultTicket.invalidate();
      utils.dashboard.pipelineValue.invalidate();
    },
    onError: (e) => toast.error(`Error al guardar: ${e.message}`),
  });

  const handleSave = () => {
    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Valor inválido — debe ser un número mayor a 0");
      return;
    }
    mutation.mutate({
      key: "defaultTicketValue",
      value: String(parsed),
      description: "Valor default del ticket por lead (USD) cuando contractedRevenue está vacío",
    });
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Configuración: ticket default</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Valor fallback usado cuando un lead no tiene <code className="text-xs bg-muted px-1 rounded">contractedRevenue</code> ni
          {" "}<code className="text-xs bg-muted px-1 rounded">setupFee</code>. Afecta el cálculo del Pipeline Value.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 max-w-md">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={isLoading || mutation.isPending}
                className="pl-7"
                placeholder="3150"
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={mutation.isPending || isLoading}>
            <Save className="h-4 w-4 mr-2" />
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
