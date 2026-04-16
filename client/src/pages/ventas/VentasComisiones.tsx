/**
 * Ventas > Comisiones — Closer commission report + rate editor.
 *
 * Calculates commissions per closer from the cashCollected of leads in the
 * period, multiplying PIF cash × pifRate and Setup+Monthly cash × smRate.
 * Rates are stored in `system_config.commissionRates` (JSON). Admin can
 * override rates per closer; everyone else sees the computed totals.
 */
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { MESES, getCurrentMes, getCurrentSemana } from "@shared/period";
import {
  DollarSign, Percent, Trophy, ChevronDown, ChevronUp, Save, Info, Users,
} from "lucide-react";
import { toast } from "sonner";

function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export default function VentasComisiones() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [mes, setMes] = useState<string>(() => getCurrentMes());
  const [semana, setSemana] = useState<string>(() => String(getCurrentSemana()));

  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
  }), [mes, semana]);

  const { data, isLoading } = trpc.sales.commissions.useQuery(filters);

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Comisiones de Closers</h1>
          <p className="text-sm text-muted-foreground">
            Cálculo automático: cash collected × tasa configurada (PIF vs Setup+Monthly).
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

      {/* Totals strip */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <TotalCard title="Cash PIF" value={formatUSD(totals?.pifCash ?? 0)} icon={DollarSign} tint="amber" />
          <TotalCard title="Comisión PIF" value={formatUSD(totals?.pifCommission ?? 0)} icon={Percent} tint="amber" />
          <TotalCard title="Cash Setup+Mo" value={formatUSD(totals?.smCash ?? 0)} icon={DollarSign} tint="blue" />
          <TotalCard title="Comisión Setup+Mo" value={formatUSD(totals?.smCommission ?? 0)} icon={Percent} tint="blue" />
        </div>
      )}

      {/* Commission table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Por closer</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ordenado por comisión total descendente.
            </p>
          </div>
          <Badge variant="outline" className="text-xs gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Total equipo: {formatUSD(totals?.totalCommission ?? 0)}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-sm text-muted-foreground">
              <Percent className="h-10 w-10 mb-2 opacity-40" />
              <p>No hay ventas con closer asignado en el periodo.</p>
              {totals && totals.totalCash === 0 && (
                <p className="text-xs mt-1">Registra cash collected en los leads para ver comisiones acá.</p>
              )}
            </div>
          ) : (
            <ScrollArea className="max-h-[560px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 sticky top-0 backdrop-blur">
                  <tr className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5 font-medium">Closer</th>
                    <th className="text-right px-3 py-2.5 font-medium">Ventas PIF</th>
                    <th className="text-right px-3 py-2.5 font-medium">Cash PIF</th>
                    <th className="text-right px-3 py-2.5 font-medium">% PIF</th>
                    <th className="text-right px-3 py-2.5 font-medium">Com. PIF</th>
                    <th className="text-right px-3 py-2.5 font-medium">Ventas S+M</th>
                    <th className="text-right px-3 py-2.5 font-medium">Cash S+M</th>
                    <th className="text-right px-3 py-2.5 font-medium">% S+M</th>
                    <th className="text-right px-3 py-2.5 font-medium">Com. S+M</th>
                    <th className="text-right px-4 py-2.5 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.closer} className="border-t border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                        {i === 0 && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                        {r.closer}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.pifCount}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatUSD(r.pifCash)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatPct(r.pifRate)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-500">{formatUSD(r.pifCommission)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.smCount}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatUSD(r.smCash)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatPct(r.smRate)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-500">{formatUSD(r.smCommission)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold">{formatUSD(r.totalCommission)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/60 bg-muted/20 font-semibold">
                    <td className="px-4 py-2.5 text-xs uppercase tracking-wider">
                      Total · {rows.length} closer{rows.length === 1 ? "" : "s"}
                    </td>
                    <td colSpan={1} className="px-3 py-2.5 text-right tabular-nums">
                      {rows.reduce((a, r) => a + r.pifCount, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatUSD(totals?.pifCash ?? 0)}</td>
                    <td />
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-500">{formatUSD(totals?.pifCommission ?? 0)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {rows.reduce((a, r) => a + r.smCount, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatUSD(totals?.smCash ?? 0)}</td>
                    <td />
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-500">{formatUSD(totals?.smCommission ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold">{formatUSD(totals?.totalCommission ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Rate editor (admin only) */}
      {isAdmin && <CommissionRatesEditor />}

      {/* Non-admin info strip */}
      {!isAdmin && data?.rates && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p>
                  Tasa por defecto: <span className="text-foreground font-medium">{formatPct(data.rates.default.pif)}</span> PIF · <span className="text-foreground font-medium">{formatPct(data.rates.default.setupMonthly)}</span> Setup+Monthly.
                </p>
                {Object.keys(data.rates.byCloser).length > 0 && (
                  <p className="mt-1">
                    {Object.keys(data.rates.byCloser).length} closer{Object.keys(data.rates.byCloser).length === 1 ? "" : "s"} con tasa custom.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TotalCard
// ---------------------------------------------------------------------------
function TotalCard({ title, value, icon: Icon, tint }: {
  title: string; value: string; icon: any; tint: "amber" | "blue" | "primary";
}) {
  const cls = tint === "amber"
    ? "bg-amber-500/10 text-amber-500"
    : tint === "blue"
    ? "bg-sky-500/10 text-sky-500"
    : "bg-primary/10 text-primary";
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
            <p className="text-2xl font-bold truncate">{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CommissionRatesEditor — admin-only, collapsible
// ---------------------------------------------------------------------------

type RatePair = { pif: number; setupMonthly: number };

function CommissionRatesEditor() {
  const utils = trpc.useUtils();
  const { closers } = useTeamMembers();
  const { data: rates } = trpc.sales.getCommissionRates.useQuery();
  const [open, setOpen] = useState(false);
  const [defaultPif, setDefaultPif] = useState("10");
  const [defaultSm, setDefaultSm] = useState("12");
  const [overrides, setOverrides] = useState<Record<string, RatePair>>({});

  // Sync from server once loaded
  useEffect(() => {
    if (!rates) return;
    setDefaultPif((rates.default.pif * 100).toFixed(1));
    setDefaultSm((rates.default.setupMonthly * 100).toFixed(1));
    setOverrides(rates.byCloser);
  }, [rates]);

  const setMutation = trpc.sales.setCommissionRates.useMutation({
    onSuccess: () => {
      toast.success("Tasas actualizadas");
      utils.sales.commissions.invalidate();
      utils.sales.getCommissionRates.invalidate();
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  const handleSave = () => {
    const defP = parseFloat(defaultPif) / 100;
    const defS = parseFloat(defaultSm) / 100;
    if (!Number.isFinite(defP) || defP < 0 || defP > 1) {
      toast.error("% PIF default inválido (0-100)");
      return;
    }
    if (!Number.isFinite(defS) || defS < 0 || defS > 1) {
      toast.error("% Setup+Mo default inválido (0-100)");
      return;
    }
    setMutation.mutate({
      default: { pif: defP, setupMonthly: defS },
      byCloser: overrides,
    });
  };

  const updateOverride = (closer: string, key: "pif" | "setupMonthly", pctString: string) => {
    const asNum = parseFloat(pctString) / 100;
    setOverrides(prev => ({
      ...prev,
      [closer]: {
        pif: key === "pif" ? (Number.isFinite(asNum) ? asNum : 0) : (prev[closer]?.pif ?? 0),
        setupMonthly: key === "setupMonthly" ? (Number.isFinite(asNum) ? asNum : 0) : (prev[closer]?.setupMonthly ?? 0),
      },
    }));
  };

  const removeOverride = (closer: string) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[closer];
      return next;
    });
  };

  const addableClosers = closers.filter(c => !(c in overrides));

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader
        onClick={() => setOpen(o => !o)}
        className="cursor-pointer flex flex-row items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Config de tasas de comisión</CardTitle>
          <Badge variant="outline" className="text-[10px]">admin</Badge>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          {/* Default rates */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasas default</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">% comisión PIF</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={defaultPif}
                    onChange={e => setDefaultPif(e.target.value)}
                    className="bg-background/50"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">% comisión Setup+Monthly</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={defaultSm}
                    onChange={e => setDefaultSm(e.target.value)}
                    className="bg-background/50"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-closer overrides */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overrides por closer</p>
              {addableClosers.length > 0 && (
                <Select
                  value=""
                  onValueChange={(c) => {
                    if (!c) return;
                    const defP = parseFloat(defaultPif) / 100;
                    const defS = parseFloat(defaultSm) / 100;
                    setOverrides(prev => ({ ...prev, [c]: { pif: defP, setupMonthly: defS } }));
                  }}
                >
                  <SelectTrigger className="h-8 w-[200px] bg-background/50 text-xs">
                    <SelectValue placeholder="+ Agregar closer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {addableClosers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {Object.keys(overrides).length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 text-xs text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Sin overrides — todos los closers usan la tasa default.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(overrides).map(([closer, r]) => (
                  <div key={closer} className="flex items-center gap-2 p-2 rounded-md bg-muted/20 border border-border/30">
                    <span className="font-medium text-sm flex-1 truncate">{closer}</span>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={(r.pif * 100).toFixed(1)}
                        onChange={e => updateOverride(closer, "pif", e.target.value)}
                        className="h-8 w-20 bg-background/50 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">% PIF</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={(r.setupMonthly * 100).toFixed(1)}
                        onChange={e => updateOverride(closer, "setupMonthly", e.target.value)}
                        className="h-8 w-20 bg-background/50 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">% S+M</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-muted-foreground hover:text-rose-500"
                      onClick={() => removeOverride(closer)}
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={setMutation.isPending}
              size="sm"
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {setMutation.isPending ? "Guardando..." : "Guardar tasas"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
