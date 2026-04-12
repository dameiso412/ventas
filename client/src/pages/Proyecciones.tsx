import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import { Plus, Target, TrendingUp, ChevronDown, ChevronUp, Trash2, Flame, Zap, CheckCircle2, XCircle, Clock, Activity } from "lucide-react";
import { toast } from "sonner";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function fmt$(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }
function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

function PaceIcon({ status }: { status: string }) {
  if (status === "on_track") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === "off_track") return <XCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function PaceBadge({ status }: { status: string }) {
  if (status === "on_track") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">On Track</Badge>;
  if (status === "off_track") return <Badge variant="destructive" className="text-[10px]">Off Track</Badge>;
  return <Badge variant="outline" className="text-[10px] text-muted-foreground">Pendiente</Badge>;
}

function ProgressBar({ actual, target, label, isCurrency }: { actual: number; target: number; label: string; isCurrency?: boolean }) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 150) : 0;
  const isOver = actual >= target && target > 0;
  const displayActual = isCurrency ? fmt$(actual) : actual;
  const displayTarget = isCurrency ? fmt$(target) : target;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${isOver ? "text-emerald-400" : "text-foreground"}`}>
          {displayActual} <span className="text-muted-foreground font-normal">/ {displayTarget}</span>
        </span>
      </div>
      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isOver ? "bg-emerald-500" : pct > 60 ? "bg-primary" : pct > 30 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ==================== CLOSER PROJECTIONS TAB ====================

const emptyCloserForm = {
  closer: "",
  semana: 1,
  mes: MESES[new Date().getMonth()],
  anio: new Date().getFullYear(),
  weekStarting: "",
  weekEnding: "",
  scheduledCallsTarget: 0,
  showRateTarget: "80",
  offerRateTarget: "80",
  closeRateTarget: "30",
  bloodGoalCloses: 0,
  bloodGoalRevenue: "0",
  bloodGoalCash: "0",
  stretchGoalCloses: 0,
  stretchGoalRevenue: "0",
  stretchGoalCash: "0",
  notas: "",
};

function CloserProjectionsTab() {
  const [mes, setMes] = useState<string>(MESES[new Date().getMonth()]);
  const [closer, setCloser] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyCloserForm);

  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    anio: new Date().getFullYear(),
    closer: closer !== "all" ? closer : undefined,
  }), [mes, closer]);

  const { data: projections, isLoading } = trpc.closerProjections.list.useQuery(filters);
  const utils = trpc.useUtils();

  const createMutation = trpc.closerProjections.create.useMutation({
    onSuccess: () => {
      utils.closerProjections.list.invalidate();
      toast.success("Proyección creada");
      setShowAdd(false);
      setForm(emptyCloserForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.closerProjections.delete.useMutation({
    onSuccess: () => {
      utils.closerProjections.list.invalidate();
      toast.success("Proyección eliminada");
    },
  });

  const projected = useMemo(() => {
    const sc = form.scheduledCallsTarget;
    const sr = Number(form.showRateTarget) / 100;
    const or2 = Number(form.offerRateTarget) / 100;
    const cr = Number(form.closeRateTarget) / 100;
    const live = Math.round(sc * sr);
    const offers = Math.round(live * or2);
    const closes = Math.round(offers * cr);
    return { live, offers, closes };
  }, [form.scheduledCallsTarget, form.showRateTarget, form.offerRateTarget, form.closeRateTarget]);

  const handleCreate = () => {
    createMutation.mutate({
      ...form,
      weekStarting: form.weekStarting ? new Date(form.weekStarting) : undefined,
      weekEnding: form.weekEnding ? new Date(form.weekEnding) : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TeamMemberSelect value={closer} onValueChange={setCloser} role="CLOSER" includeAll allLabel="Todos" className="w-[140px] bg-card/50" />
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[130px] bg-card/50"><SelectValue /></SelectTrigger>
          <SelectContent>{MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 ml-auto"><Plus className="h-4 w-4" /> Nueva Proyección</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nueva Proyección de Closer</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Closer</Label>
                  <TeamMemberSelect value={form.closer} onValueChange={v => setForm(p => ({ ...p, closer: v }))} role="CLOSER" placeholder="Seleccionar closer" />
                </div>
                <div>
                  <Label className="text-xs">Semana</Label>
                  <Select value={String(form.semana)} onValueChange={v => setForm(p => ({ ...p, semana: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5].map(s => <SelectItem key={s} value={String(s)}>Semana {s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Inicio Semana</Label><Input type="date" value={form.weekStarting} onChange={e => setForm(p => ({ ...p, weekStarting: e.target.value }))} /></div>
                <div><Label className="text-xs">Fin Semana</Label><Input type="date" value={form.weekEnding} onChange={e => setForm(p => ({ ...p, weekEnding: e.target.value }))} /></div>
              </div>

              <div className="border-t border-border/50 pt-3">
                <p className="text-sm font-semibold text-primary mb-2">Targets de la Semana (KPIs del Closer Tracker)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Schedule Calls (Agendadas)</Label><Input type="number" min={0} value={form.scheduledCallsTarget} onChange={e => setForm(p => ({ ...p, scheduledCallsTarget: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Show Rate % Esperado</Label><Input type="number" min={0} max={100} value={form.showRateTarget} onChange={e => setForm(p => ({ ...p, showRateTarget: e.target.value }))} /></div>
                  <div><Label className="text-xs">Offer Rate % Esperado</Label><Input type="number" min={0} max={100} value={form.offerRateTarget} onChange={e => setForm(p => ({ ...p, offerRateTarget: e.target.value }))} /></div>
                  <div><Label className="text-xs">Close Rate % Esperado</Label><Input type="number" min={0} max={100} value={form.closeRateTarget} onChange={e => setForm(p => ({ ...p, closeRateTarget: e.target.value }))} /></div>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                <p className="text-xs text-muted-foreground font-medium mb-2">Proyección Calculada</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-xs text-muted-foreground">Live Calls</p><p className="text-lg font-bold">{projected.live}</p></div>
                  <div><p className="text-xs text-muted-foreground">Offers</p><p className="text-lg font-bold">{projected.offers}</p></div>
                  <div><p className="text-xs text-muted-foreground">Closes</p><p className="text-lg font-bold">{projected.closes}</p></div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-3">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Flame className="h-4 w-4 text-red-400" /><span className="text-red-400">Blood Goal</span> (Mínimo Aceptable)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Closes</Label><Input type="number" min={0} value={form.bloodGoalCloses} onChange={e => setForm(p => ({ ...p, bloodGoalCloses: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Revenue ($)</Label><Input type="number" value={form.bloodGoalRevenue} onChange={e => setForm(p => ({ ...p, bloodGoalRevenue: e.target.value }))} /></div>
                  <div><Label className="text-xs">Cash ($)</Label><Input type="number" value={form.bloodGoalCash} onChange={e => setForm(p => ({ ...p, bloodGoalCash: e.target.value }))} /></div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-3">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">Stretch Goal</span> (Objetivo Ambicioso)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Closes</Label><Input type="number" min={0} value={form.stretchGoalCloses} onChange={e => setForm(p => ({ ...p, stretchGoalCloses: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Revenue ($)</Label><Input type="number" value={form.stretchGoalRevenue} onChange={e => setForm(p => ({ ...p, stretchGoalRevenue: e.target.value }))} /></div>
                  <div><Label className="text-xs">Cash ($)</Label><Input type="number" value={form.stretchGoalCash} onChange={e => setForm(p => ({ ...p, stretchGoalCash: e.target.value }))} /></div>
                </div>
              </div>

              <div><Label className="text-xs">Notas</Label><Textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} placeholder="Notas de performance, reflexiones..." /></div>
              <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creando..." : "Crear Proyección"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando proyecciones...</div>
      ) : !projections || projections.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No hay proyecciones para este período</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Crea una nueva proyección para comenzar el ejercicio semanal</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projections.map((p: any) => (
            <CloserProjectionCard
              key={p.id}
              projection={p}
              expanded={expandedId === p.id}
              onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              onDelete={() => {
                if (confirm("¿Eliminar esta proyección?")) deleteMutation.mutate({ id: p.id });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CloserProjectionCard({ projection: p, expanded, onToggle, onDelete }: {
  projection: any;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  // Use getWithActuals to read real tracker data instead of manual daily tracking
  const { data: result, isLoading: loadingActuals } = trpc.closerProjections.getWithActuals.useQuery(
    { id: p.id },
    { enabled: expanded, refetchInterval: 60000 }
  );

  const bloodCloses = p.bloodGoalCloses ?? 0;
  const stretchCloses = p.stretchGoalCloses ?? 0;
  const bloodRevenue = Number(p.bloodGoalRevenue ?? 0);
  const bloodCash = Number(p.bloodGoalCash ?? 0);
  const stretchRevenue = Number(p.stretchGoalRevenue ?? 0);
  const stretchCash = Number(p.stretchGoalCash ?? 0);

  return (
    <Card className="bg-card/50 border-border/50">
      <div className="p-4 cursor-pointer hover:bg-muted/20 transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {p.closer?.charAt(0)}
            </div>
            <div>
              <p className="font-semibold">{p.closer}</p>
              <p className="text-xs text-muted-foreground">Semana {p.semana} · {p.mes} {p.anio}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="flex gap-4 text-xs">
                <span>Schedule: <strong>{p.scheduledCallsTarget}</strong></span>
                <span>Show: <strong>{fmtPct(Number(p.showRateTarget))}</strong></span>
                <span>Close: <strong>{fmtPct(Number(p.closeRateTarget))}</strong></span>
              </div>
              <div className="flex gap-3 mt-1 text-xs">
                <span className="text-red-400"><Flame className="h-3 w-3 inline" /> {bloodCloses} closes · {fmt$(bloodCash)}</span>
                <span className="text-emerald-400"><Zap className="h-3 w-3 inline" /> {stretchCloses} closes · {fmt$(stretchCash)}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 p-4 space-y-4">
          {loadingActuals ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Cargando datos del tracker...</div>
          ) : !result ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No se pudieron cargar los datos</div>
          ) : (
            <>
              {/* Pace Status Overview */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{result.daysWithData} de 5 días con datos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Closes:</span>
                  <PaceBadge status={result.paceStatus.closes} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Revenue:</span>
                  <PaceBadge status={result.paceStatus.revenue} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Cash:</span>
                  <PaceBadge status={result.paceStatus.cash} />
                </div>
                {result.bloodHit && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs gap-1">
                    <Flame className="h-3 w-3" /> Blood Goal Alcanzado
                  </Badge>
                )}
                {result.stretchHit && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs gap-1">
                    <Zap className="h-3 w-3" /> Stretch Goal Alcanzado
                  </Badge>
                )}
              </div>

              {/* Progress Bars: Blood Goal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/20 rounded-lg p-4 border border-border/30 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><Flame className="h-4 w-4 text-red-400" /> Blood Goal</p>
                  <ProgressBar label="Closes" actual={result.totals.closes} target={bloodCloses} />
                  <ProgressBar label="Revenue" actual={result.totalRevenue} target={bloodRevenue} isCurrency />
                  <ProgressBar label="Cash" actual={result.totalCash} target={bloodCash} isCurrency />
                </div>
                <div className="bg-muted/20 rounded-lg p-4 border border-border/30 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-400" /> Stretch Goal</p>
                  <ProgressBar label="Closes" actual={result.totals.closes} target={stretchCloses} />
                  <ProgressBar label="Revenue" actual={result.totalRevenue} target={stretchRevenue} isCurrency />
                  <ProgressBar label="Cash" actual={result.totalCash} target={stretchCash} isCurrency />
                </div>
              </div>

              {/* KPI Summary from Tracker */}
              <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                <MetricMini label="Schedule" actual={result.totals.scheduleCalls} target={p.scheduledCallsTarget} />
                <MetricMini label="Live Calls" actual={result.totals.liveCalls} target={p.projectedLiveCalls} />
                <MetricMini label="Offers" actual={result.totals.offers} target={p.projectedOffers} />
                <MetricMini label="Deposits" actual={result.totals.deposits} />
                <MetricMini label="Closes" actual={result.totals.closes} target={bloodCloses} />
                <MetricMini label="Revenue" actual={result.totalRevenue} target={bloodRevenue} isCurrency />
                <MetricMini label="Cash" actual={result.totalCash} target={bloodCash} isCurrency />
              </div>

              {/* Daily Activity from Tracker (read-only) */}
              {result.actuals.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Actividad Diaria (datos del Closer Tracker)
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Fecha</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Schedule</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Live</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Offers</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Deposits</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Closes</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Revenue</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Cash</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Pace</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.actuals.map((d: any, idx: number) => {
                        const accCloses = result.actuals.slice(0, idx + 1).reduce((s: number, r: any) => s + r.closes, 0);
                        const expectedCloses = ((idx + 1) / 5) * bloodCloses;
                        const accCash = result.actuals.slice(0, idx + 1).reduce((s: number, r: any) => s + r.piffCash + r.setupCash, 0);
                        const expectedCash = ((idx + 1) / 5) * bloodCash;
                        const onTrack = accCloses >= expectedCloses || accCash >= expectedCash;

                        return (
                          <tr key={idx} className="border-b border-border/30 hover:bg-muted/10">
                            <td className="p-2 font-medium text-xs">{fmtDate(d.fecha)}</td>
                            <td className="p-2 text-center text-xs">{d.scheduleCalls}</td>
                            <td className="p-2 text-center text-xs">{d.liveCalls}</td>
                            <td className="p-2 text-center text-xs">{d.offers}</td>
                            <td className="p-2 text-center text-xs">{d.deposits}</td>
                            <td className="p-2 text-center text-xs font-semibold">{d.closes}</td>
                            <td className="p-2 text-center text-xs">{fmt$(d.piffRevenue + d.setupRevenue)}</td>
                            <td className="p-2 text-center text-xs">{fmt$(d.piffCash + d.setupCash)}</td>
                            <td className="p-2 text-center">
                              <PaceBadge status={onTrack ? "on_track" : "off_track"} />
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr className="border-t-2 border-border/50 bg-muted/30 font-semibold">
                        <td className="p-2 text-xs">TOTAL</td>
                        <td className="p-2 text-center text-xs">{result.totals.scheduleCalls}</td>
                        <td className="p-2 text-center text-xs">{result.totals.liveCalls}</td>
                        <td className="p-2 text-center text-xs">{result.totals.offers}</td>
                        <td className="p-2 text-center text-xs">{result.totals.deposits}</td>
                        <td className="p-2 text-center text-xs">{result.totals.closes}</td>
                        <td className="p-2 text-center text-xs">{fmt$(result.totalRevenue)}</td>
                        <td className="p-2 text-center text-xs">{fmt$(result.totalCash)}</td>
                        <td className="p-2 text-center">
                          <PaceBadge status={result.paceStatus.closes} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {result.actuals.length === 0 && (
                <div className="bg-muted/20 rounded-lg p-6 text-center border border-border/30">
                  <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Sin actividad registrada en el Closer Tracker para esta semana</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Los datos aparecerán automáticamente cuando se registren actividades en el tracker</p>
                </div>
              )}

              {p.notas && (
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Notas de Performance</p>
                  <p className="text-sm">{p.notas}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ==================== SETTER PROJECTIONS TAB ====================

const emptySetterForm = {
  setter: "",
  semana: 1,
  mes: MESES[new Date().getMonth()],
  anio: new Date().getFullYear(),
  weekStarting: "",
  weekEnding: "",
  intentosLlamadaTarget: 0,
  introsEfectivasTarget: 0,
  demosAseguradasTarget: 0,
  demosCalendarioTarget: 0,
  demosConfirmadasTarget: 0,
  demosAsistidasTarget: 0,
  bloodGoalDemosAsistidas: 0,
  bloodGoalCierres: 0,
  bloodGoalRevenue: "0",
  bloodGoalCash: "0",
  stretchGoalDemosAsistidas: 0,
  stretchGoalCierres: 0,
  stretchGoalRevenue: "0",
  stretchGoalCash: "0",
  notas: "",
};

function SetterProjectionsTab() {
  const [mes, setMes] = useState<string>(MESES[new Date().getMonth()]);
  const [setter, setSetter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptySetterForm);

  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    anio: new Date().getFullYear(),
    setter: setter !== "all" ? setter : undefined,
  }), [mes, setter]);

  const { data: projections, isLoading } = trpc.setterProjections.list.useQuery(filters);
  const utils = trpc.useUtils();

  const createMutation = trpc.setterProjections.create.useMutation({
    onSuccess: () => {
      utils.setterProjections.list.invalidate();
      toast.success("Proyección creada");
      setShowAdd(false);
      setForm(emptySetterForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.setterProjections.delete.useMutation({
    onSuccess: () => {
      utils.setterProjections.list.invalidate();
      toast.success("Proyección eliminada");
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      ...form,
      weekStarting: form.weekStarting ? new Date(form.weekStarting) : undefined,
      weekEnding: form.weekEnding ? new Date(form.weekEnding) : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TeamMemberSelect value={setter} onValueChange={setSetter} role="SETTER" includeAll allLabel="Todos" className="w-[140px] bg-card/50" />
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[130px] bg-card/50"><SelectValue /></SelectTrigger>
          <SelectContent>{MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 ml-auto"><Plus className="h-4 w-4" /> Nueva Proyección</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nueva Proyección de Setter</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Setter</Label>
                  <TeamMemberSelect value={form.setter} onValueChange={v => setForm(p => ({ ...p, setter: v }))} role="SETTER" placeholder="Seleccionar setter" />
                </div>
                <div>
                  <Label className="text-xs">Semana</Label>
                  <Select value={String(form.semana)} onValueChange={v => setForm(p => ({ ...p, semana: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5].map(s => <SelectItem key={s} value={String(s)}>Semana {s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Inicio Semana</Label><Input type="date" value={form.weekStarting} onChange={e => setForm(p => ({ ...p, weekStarting: e.target.value }))} /></div>
                <div><Label className="text-xs">Fin Semana</Label><Input type="date" value={form.weekEnding} onChange={e => setForm(p => ({ ...p, weekEnding: e.target.value }))} /></div>
              </div>

              <div className="border-t border-border/50 pt-3">
                <p className="text-sm font-semibold text-primary mb-2">Targets Semanales (KPIs del Setter Tracker)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">Intentos Llamada</Label><Input type="number" min={0} value={form.intentosLlamadaTarget} onChange={e => setForm(p => ({ ...p, intentosLlamadaTarget: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Intros Efectivas</Label><Input type="number" min={0} value={form.introsEfectivasTarget} onChange={e => setForm(p => ({ ...p, introsEfectivasTarget: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Demos Aseguradas</Label><Input type="number" min={0} value={form.demosAseguradasTarget} onChange={e => setForm(p => ({ ...p, demosAseguradasTarget: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Demos Calendario</Label><Input type="number" min={0} value={form.demosCalendarioTarget} onChange={e => setForm(p => ({ ...p, demosCalendarioTarget: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Demos Confirmadas</Label><Input type="number" min={0} value={form.demosConfirmadasTarget} onChange={e => setForm(p => ({ ...p, demosConfirmadasTarget: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Demos Asistidas</Label><Input type="number" min={0} value={form.demosAsistidasTarget} onChange={e => setForm(p => ({ ...p, demosAsistidasTarget: parseInt(e.target.value) || 0 }))} /></div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-3">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Flame className="h-4 w-4 text-red-400" /><span className="text-red-400">Blood Goal</span> (Mínimo Aceptable)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Demos Asistidas</Label><Input type="number" min={0} value={form.bloodGoalDemosAsistidas} onChange={e => setForm(p => ({ ...p, bloodGoalDemosAsistidas: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Cierres Atribuidos</Label><Input type="number" min={0} value={form.bloodGoalCierres} onChange={e => setForm(p => ({ ...p, bloodGoalCierres: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Revenue ($)</Label><Input type="number" value={form.bloodGoalRevenue} onChange={e => setForm(p => ({ ...p, bloodGoalRevenue: e.target.value }))} /></div>
                  <div><Label className="text-xs">Cash ($)</Label><Input type="number" value={form.bloodGoalCash} onChange={e => setForm(p => ({ ...p, bloodGoalCash: e.target.value }))} /></div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-3">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">Stretch Goal</span> (Objetivo Ambicioso)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Demos Asistidas</Label><Input type="number" min={0} value={form.stretchGoalDemosAsistidas} onChange={e => setForm(p => ({ ...p, stretchGoalDemosAsistidas: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Cierres Atribuidos</Label><Input type="number" min={0} value={form.stretchGoalCierres} onChange={e => setForm(p => ({ ...p, stretchGoalCierres: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs">Revenue ($)</Label><Input type="number" value={form.stretchGoalRevenue} onChange={e => setForm(p => ({ ...p, stretchGoalRevenue: e.target.value }))} /></div>
                  <div><Label className="text-xs">Cash ($)</Label><Input type="number" value={form.stretchGoalCash} onChange={e => setForm(p => ({ ...p, stretchGoalCash: e.target.value }))} /></div>
                </div>
              </div>

              <div><Label className="text-xs">Notas</Label><Textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} placeholder="Notas de performance, reflexiones..." /></div>
              <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creando..." : "Crear Proyección"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando proyecciones...</div>
      ) : !projections || projections.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No hay proyecciones para este período</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Crea una nueva proyección para comenzar el ejercicio semanal</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {projections.map((p: any) => (
            <SetterProjectionCard
              key={p.id}
              projection={p}
              expanded={expandedId === p.id}
              onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
              onDelete={() => {
                if (confirm("¿Eliminar esta proyección?")) deleteMutation.mutate({ id: p.id });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SetterProjectionCard({ projection: p, expanded, onToggle, onDelete }: {
  projection: any;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { data: result, isLoading: loadingActuals } = trpc.setterProjections.getWithActuals.useQuery(
    { id: p.id },
    { enabled: expanded, refetchInterval: 60000 }
  );

  const bloodDemos = p.bloodGoalDemosAsistidas ?? 0;
  const bloodCierres = p.bloodGoalCierres ?? 0;
  const bloodRevenue = Number(p.bloodGoalRevenue ?? 0);
  const bloodCash = Number(p.bloodGoalCash ?? 0);
  const stretchDemos = p.stretchGoalDemosAsistidas ?? 0;
  const stretchCierres = p.stretchGoalCierres ?? 0;

  return (
    <Card className="bg-card/50 border-border/50">
      <div className="p-4 cursor-pointer hover:bg-muted/20 transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-chart-2/20 flex items-center justify-center text-chart-2 font-bold text-sm">
              {p.setter?.charAt(0)}
            </div>
            <div>
              <p className="font-semibold">{p.setter}</p>
              <p className="text-xs text-muted-foreground">Semana {p.semana} · {p.mes} {p.anio}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="flex gap-3 text-xs">
                <span>Intentos: <strong>{p.intentosLlamadaTarget}</strong></span>
                <span>Intros: <strong>{p.introsEfectivasTarget}</strong></span>
                <span>Demos: <strong>{p.demosAsistidasTarget}</strong></span>
              </div>
              <div className="flex gap-3 mt-1 text-xs">
                <span className="text-red-400"><Flame className="h-3 w-3 inline" /> {bloodDemos} demos · {bloodCierres} cierres</span>
                <span className="text-emerald-400"><Zap className="h-3 w-3 inline" /> {stretchDemos} demos · {stretchCierres} cierres</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 p-4 space-y-4">
          {loadingActuals ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Cargando datos del tracker...</div>
          ) : !result ? (
            <div className="text-center py-4 text-muted-foreground text-sm">No se pudieron cargar los datos</div>
          ) : (
            <>
              {/* Pace Status Overview */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{result.daysWithData} de 5 días con datos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Demos:</span>
                  <PaceBadge status={result.paceStatus.demosAsistidas} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Cierres:</span>
                  <PaceBadge status={result.paceStatus.cierres} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Revenue:</span>
                  <PaceBadge status={result.paceStatus.revenue} />
                </div>
                {result.bloodHit && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs gap-1">
                    <Flame className="h-3 w-3" /> Blood Goal Alcanzado
                  </Badge>
                )}
                {result.stretchHit && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs gap-1">
                    <Zap className="h-3 w-3" /> Stretch Goal Alcanzado
                  </Badge>
                )}
              </div>

              {/* Progress Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/20 rounded-lg p-4 border border-border/30 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><Flame className="h-4 w-4 text-red-400" /> Blood Goal</p>
                  <ProgressBar label="Demos Asistidas" actual={result.totals.demosAsistidas} target={bloodDemos} />
                  <ProgressBar label="Cierres Atribuidos" actual={result.totals.cierresAtribuidos} target={bloodCierres} />
                  <ProgressBar label="Revenue" actual={result.totals.revenueAtribuido} target={bloodRevenue} isCurrency />
                  <ProgressBar label="Cash" actual={result.totals.cashAtribuido} target={bloodCash} isCurrency />
                </div>
                <div className="bg-muted/20 rounded-lg p-4 border border-border/30 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-400" /> Stretch Goal</p>
                  <ProgressBar label="Demos Asistidas" actual={result.totals.demosAsistidas} target={stretchDemos} />
                  <ProgressBar label="Cierres Atribuidos" actual={result.totals.cierresAtribuidos} target={stretchCierres} />
                  <ProgressBar label="Revenue" actual={result.totals.revenueAtribuido} target={Number(p.stretchGoalRevenue ?? 0)} isCurrency />
                  <ProgressBar label="Cash" actual={result.totals.cashAtribuido} target={Number(p.stretchGoalCash ?? 0)} isCurrency />
                </div>
              </div>

              {/* KPI Summary */}
              <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                <MetricMini label="Intentos" actual={result.totals.intentosLlamada} target={p.intentosLlamadaTarget} />
                <MetricMini label="Intros" actual={result.totals.introsEfectivas} target={p.introsEfectivasTarget} />
                <MetricMini label="Aseguradas" actual={result.totals.demosAseguradasConIntro} target={p.demosAseguradasTarget} />
                <MetricMini label="Calendario" actual={result.totals.demosEnCalendario} target={p.demosCalendarioTarget} />
                <MetricMini label="Confirmadas" actual={result.totals.demosConfirmadas} target={p.demosConfirmadasTarget} />
                <MetricMini label="Asistidas" actual={result.totals.demosAsistidas} target={bloodDemos} />
                <MetricMini label="Cierres" actual={result.totals.cierresAtribuidos} target={bloodCierres} />
                <MetricMini label="Revenue" actual={result.totals.revenueAtribuido} target={bloodRevenue} isCurrency />
                <MetricMini label="Cash" actual={result.totals.cashAtribuido} target={bloodCash} isCurrency />
              </div>

              {/* Daily Activity from Tracker (read-only) */}
              {result.actuals.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Actividad Diaria (datos del Setter Tracker)
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <th className="text-left p-2 text-xs font-medium text-muted-foreground">Fecha</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Intentos</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Intros</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Aseguradas</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Calendario</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Confirmadas</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Asistidas</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Cierres</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Revenue</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Cash</th>
                        <th className="text-center p-2 text-xs font-medium text-muted-foreground">Pace</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.actuals.map((d: any, idx: number) => {
                        const accAsistidas = result.actuals.slice(0, idx + 1).reduce((s: number, r: any) => s + r.demosAsistidas, 0);
                        const expectedAsistidas = ((idx + 1) / 5) * bloodDemos;
                        const onTrack = accAsistidas >= expectedAsistidas;

                        return (
                          <tr key={idx} className="border-b border-border/30 hover:bg-muted/10">
                            <td className="p-2 font-medium text-xs">{fmtDate(d.fecha)}</td>
                            <td className="p-2 text-center text-xs">{d.intentosLlamada}</td>
                            <td className="p-2 text-center text-xs">{d.introsEfectivas}</td>
                            <td className="p-2 text-center text-xs">{d.demosAseguradasConIntro}</td>
                            <td className="p-2 text-center text-xs">{d.demosEnCalendario}</td>
                            <td className="p-2 text-center text-xs">{d.demosConfirmadas}</td>
                            <td className="p-2 text-center text-xs font-semibold">{d.demosAsistidas}</td>
                            <td className="p-2 text-center text-xs">{d.cierresAtribuidos}</td>
                            <td className="p-2 text-center text-xs">{fmt$(d.revenueAtribuido)}</td>
                            <td className="p-2 text-center text-xs">{fmt$(d.cashAtribuido)}</td>
                            <td className="p-2 text-center">
                              <PaceBadge status={onTrack ? "on_track" : "off_track"} />
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-border/50 bg-muted/30 font-semibold">
                        <td className="p-2 text-xs">TOTAL</td>
                        <td className="p-2 text-center text-xs">{result.totals.intentosLlamada}</td>
                        <td className="p-2 text-center text-xs">{result.totals.introsEfectivas}</td>
                        <td className="p-2 text-center text-xs">{result.totals.demosAseguradasConIntro}</td>
                        <td className="p-2 text-center text-xs">{result.totals.demosEnCalendario}</td>
                        <td className="p-2 text-center text-xs">{result.totals.demosConfirmadas}</td>
                        <td className="p-2 text-center text-xs">{result.totals.demosAsistidas}</td>
                        <td className="p-2 text-center text-xs">{result.totals.cierresAtribuidos}</td>
                        <td className="p-2 text-center text-xs">{fmt$(result.totals.revenueAtribuido)}</td>
                        <td className="p-2 text-center text-xs">{fmt$(result.totals.cashAtribuido)}</td>
                        <td className="p-2 text-center">
                          <PaceBadge status={result.paceStatus.demosAsistidas} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {result.actuals.length === 0 && (
                <div className="bg-muted/20 rounded-lg p-6 text-center border border-border/30">
                  <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Sin actividad registrada en el Setter Tracker para esta semana</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Los datos aparecerán automáticamente cuando se registren actividades en el tracker</p>
                </div>
              )}

              {p.notas && (
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Notas de Performance</p>
                  <p className="text-sm">{p.notas}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ==================== SHARED COMPONENTS ====================

function MetricMini({ label, actual, target, isCurrency }: { label: string; actual: number; target?: number; isCurrency?: boolean }) {
  const isAbove = target !== undefined && actual >= target && target > 0;
  const displayActual = isCurrency ? fmt$(actual) : actual;
  const displayTarget = target !== undefined ? (isCurrency ? fmt$(target) : target) : null;

  return (
    <div className="bg-muted/30 rounded p-2 border border-border/30 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${target !== undefined ? (isAbove ? "text-emerald-400" : "text-amber-400") : ""}`}>
        {displayActual}
      </p>
      {displayTarget !== null && (
        <p className="text-[10px] text-muted-foreground">meta: {displayTarget}</p>
      )}
    </div>
  );
}

// ==================== MAIN PAGE ====================

export default function Proyecciones() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Proyecciones Semanales</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ejercicio semanal de proyección con Blood Goal y Stretch Goal. Los datos reales se leen automáticamente del Setter/Closer Tracker.
        </p>
      </div>

      <Tabs defaultValue="closers" className="w-full">
        <TabsList className="bg-muted/30 border border-border/30">
          <TabsTrigger value="closers" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Closers
          </TabsTrigger>
          <TabsTrigger value="setters" className="gap-2">
            <Target className="h-4 w-4" /> Setters
          </TabsTrigger>
        </TabsList>
        <TabsContent value="closers" className="mt-4">
          <CloserProjectionsTab />
        </TabsContent>
        <TabsContent value="setters" className="mt-4">
          <SetterProjectionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
