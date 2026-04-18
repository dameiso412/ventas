/**
 * Prospección > Tablero — el cockpit del Cold DM System.
 *
 * Shows at a glance:
 *   1. Funnel visual (A → MS → B → C → D) con barras proporcionales.
 *   2. Actividad del período: Follows enviados/aceptados (CAR), likes, comentarios.
 *   3. Los 5 KPIs semaforizados (MSR, PRR, CSR, ABR, CAR) vs umbrales de prospecting_goals.
 *
 * Filtros:
 *   - Período: Hoy · Semana · Mes · Custom (rango arbitrario)
 *   - Setter: Todos (default) · un setter específico — admin-only dropdown.
 *
 * Semáforo logic (doc 2 — DM Metrics):
 *   verde   ≥ umbral
 *   ámbar   entre 75%-100% del umbral (aceptar varianza, escalar volumen)
 *   rojo    < 75% del umbral (abrir Doctor para troubleshoot)
 *
 * Todas las queries cuelgan de `trpc.prospecting.funnelMetrics` + `trpc.prospecting.listGoals`.
 * Los datos se recargan al cambiar cualquier filtro. No se persiste elección
 * de filtro entre sesiones (default es "Hoy" — fricción mínima para setters).
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  Activity, Stethoscope, Send, Eye, MessageSquare, CalendarClock, CalendarCheck,
  UserPlus, Heart, MessageCircle, CalendarIcon, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";

// ==================== Types ====================

type PeriodKey = "today" | "week" | "month" | "custom";

type Semaforo = "verde" | "amarillo" | "rojo" | "gris";

// ==================== Helpers ====================

/**
 * Compute date range for a given period, anchored to "now".
 * Uses start-of-day so comparisons with setter_activities.fecha
 * (which is stored at 00:00) are stable.
 */
function computeRange(period: PeriodKey, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);   endOfToday.setHours(23, 59, 59, 999);

  if (period === "today") return { from: startOfToday, to: endOfToday };
  if (period === "week") {
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 6); // rolling 7 días (hoy + 6 previos)
    return { from, to: endOfToday };
  }
  if (period === "month") {
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - 29); // rolling 30 días
    return { from, to: endOfToday };
  }
  // custom
  const from = customFrom ? new Date(customFrom) : startOfToday;
  from.setHours(0, 0, 0, 0);
  const to = customTo ? new Date(customTo) : endOfToday;
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

/**
 * Traffic-light classifier. Percent values are 0-100 (not 0-1).
 * null threshold means "no umbral configurado" → gris.
 */
function getSemaforo(value: number | null, threshold: number | null): Semaforo {
  if (value === null || threshold === null || threshold <= 0) return "gris";
  if (value >= threshold) return "verde";
  if (value >= threshold * 0.75) return "amarillo";
  return "rojo";
}

const SEMAFORO_STYLES: Record<Semaforo, { text: string; bg: string; border: string; label: string }> = {
  verde: {
    text: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    label: "OK",
  },
  amarillo: {
    text: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Varianza",
  },
  rojo: {
    text: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    label: "Bajo umbral",
  },
  gris: {
    text: "text-muted-foreground",
    bg: "bg-muted/30",
    border: "border-border/30",
    label: "Sin datos",
  },
};

function formatPercent(v: number | null): string {
  if (v === null) return "—";
  return `${v.toFixed(1)}%`;
}

function formatCount(v: number | undefined | null): string {
  if (v === null || v === undefined) return "0";
  return v.toLocaleString("es-CL");
}

// ==================== Subcomponents ====================

function FunnelBar({
  label, value, max, icon: Icon, color = "primary",
}: {
  label: string;
  value: number;
  max: number;
  icon: any;
  color?: "primary" | "blue" | "violet" | "amber" | "emerald";
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const colorMap: Record<string, string> = {
    primary: "bg-primary",
    blue:    "bg-sky-500",
    violet:  "bg-violet-500",
    amber:   "bg-amber-500",
    emerald: "bg-emerald-500",
  };
  const barColor = colorMap[color];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{label}</span>
        </div>
        <span className="font-bold tabular-nums">{formatCount(value)}</span>
      </div>
      <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500 rounded-full`}
          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
        />
      </div>
    </div>
  );
}

function KpiSemaforoCard({
  label, value, threshold, unit, description, onOpenDoctor,
}: {
  label: string;
  value: number | null;
  threshold: number | null;
  unit: "percent" | "count";
  description?: string;
  onOpenDoctor?: () => void;
}) {
  const sem = getSemaforo(value, threshold);
  const style = SEMAFORO_STYLES[sem];
  const displayValue = unit === "percent" ? formatPercent(value) : formatCount(value ?? 0);
  const thresholdDisplay = threshold !== null
    ? (unit === "percent" ? `${threshold}%` : formatCount(threshold))
    : "—";

  const Icon = sem === "verde" ? TrendingUp : sem === "rojo" ? TrendingDown : Minus;

  return (
    <Card className={`relative overflow-hidden bg-card/50 ${style.border} border transition-colors`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${sem === "verde" ? "bg-emerald-500" : sem === "amarillo" ? "bg-amber-500" : sem === "rojo" ? "bg-rose-500" : "bg-muted"}`} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            {description && <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">{description}</p>}
          </div>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${style.bg}`}>
            <Icon className={`h-4 w-4 ${style.text}`} />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums ${style.text}`}>{displayValue}</span>
          <span className="text-xs text-muted-foreground">min {thresholdDisplay}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge variant="outline" className={`text-[10px] ${style.bg} ${style.border} ${style.text}`}>
            {style.label}
          </Badge>
          {sem === "rojo" && onOpenDoctor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenDoctor}
              className="h-6 px-2 text-[10px] gap-1 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
            >
              <Stethoscope className="h-3 w-3" />
              Abrir Doctor
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityMetric({
  label, value, icon: Icon, tint, hint,
}: {
  label: string;
  value: number;
  icon: any;
  tint?: "primary" | "blue" | "violet" | "amber" | "emerald" | "rose";
  hint?: string;
}) {
  const tintMap: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    blue:    "text-sky-500 bg-sky-500/10",
    violet:  "text-violet-500 bg-violet-500/10",
    amber:   "text-amber-500 bg-amber-500/10",
    emerald: "text-emerald-500 bg-emerald-500/10",
    rose:    "text-rose-500 bg-rose-500/10",
  };
  const cls = tintMap[tint ?? "primary"];
  return (
    <div className="flex items-center gap-3 bg-muted/20 rounded-lg p-3 border border-border/40">
      <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${cls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold tabular-nums leading-tight">{formatCount(value)}</p>
        {hint && <p className="text-[10px] text-muted-foreground/80 truncate">{hint}</p>}
      </div>
    </div>
  );
}

// ==================== Main page ====================

export default function ProspeccionTablero() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Filters
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [customFromOpen, setCustomFromOpen] = useState(false);
  const [customToOpen, setCustomToOpen] = useState(false);
  const [selectedSetter, setSelectedSetter] = useState<string>("all");

  const { setters } = useTeamMembers();

  // Compute date range from period + custom overrides
  const range = useMemo(
    () => computeRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  // Fetch metrics
  const metricsInput = useMemo(() => ({
    setter: selectedSetter !== "all" ? selectedSetter : undefined,
    dateFrom: range.from,
    dateTo: range.to,
  }), [selectedSetter, range.from, range.to]);

  const { data: metrics, isLoading: metricsLoading } = trpc.prospecting.funnelMetrics.useQuery(metricsInput);
  const { data: goals = [], isLoading: goalsLoading } = trpc.prospecting.listGoals.useQuery();

  // Build a lookup: goalKey → numeric value
  const goalsMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of goals) {
      const v = parseFloat(String(g.value));
      if (Number.isFinite(v)) m[g.key] = v;
    }
    return m;
  }, [goals]);

  const isLoading = metricsLoading || goalsLoading;
  const funnelMax = Math.max(
    metrics?.a ?? 0, metrics?.ms ?? 0, metrics?.b ?? 0, metrics?.c ?? 0, metrics?.d ?? 0, 1
  );

  const periodLabel = useMemo(() => {
    if (period === "today") return "Hoy";
    if (period === "week") return "Últimos 7 días";
    if (period === "month") return "Últimos 30 días";
    if (customFrom && customTo) {
      return `${format(customFrom, "d MMM", { locale: es })} – ${format(customTo, "d MMM", { locale: es })}`;
    }
    return "Rango personalizado";
  }, [period, customFrom, customTo]);

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send className="h-6 w-6 text-primary" />
            Tablero de Prospección
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cold DM System — funnel, actividad y los 5 KPIs con semáforo vs umbrales del sistema.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<PeriodKey>
            value={period}
            onChange={setPeriod}
            options={[
              { value: "today", label: "Hoy" },
              { value: "week", label: "7 días" },
              { value: "month", label: "30 días" },
              { value: "custom", label: "Custom" },
            ]}
          />
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <Popover open={customFromOpen} onOpenChange={setCustomFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {customFrom ? format(customFrom, "d MMM yy", { locale: es }) : "Desde"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={(d) => { setCustomFrom(d); setCustomFromOpen(false); }} />
                </PopoverContent>
              </Popover>
              <Popover open={customToOpen} onOpenChange={setCustomToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {customTo ? format(customTo, "d MMM yy", { locale: es }) : "Hasta"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={(d) => { setCustomTo(d); setCustomToOpen(false); }} />
                </PopoverContent>
              </Popover>
            </div>
          )}
          {isAdmin && (
            <Select value={selectedSetter} onValueChange={setSelectedSetter}>
              <SelectTrigger className="w-[180px] bg-card/50 h-9">
                <SelectValue placeholder="Setter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los setters</SelectItem>
                {setters.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Period summary chip */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="border-primary/30 text-primary">
          {periodLabel}
        </Badge>
        {selectedSetter !== "all" && (
          <Badge variant="outline">{selectedSetter}</Badge>
        )}
      </div>

      {/* Funnel + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel visual */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Funnel del período
            </CardTitle>
            <p className="text-xs text-muted-foreground">A → MS → B → C → D (volumen absoluto)</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : (
              <>
                <FunnelBar label="Initiated (A)"      value={metrics?.a ?? 0}  max={funnelMax} icon={Send}          color="primary" />
                <FunnelBar label="Message Seen (MS)"  value={metrics?.ms ?? 0} max={funnelMax} icon={Eye}           color="blue" />
                <FunnelBar label="Interested (B)"     value={metrics?.b ?? 0}  max={funnelMax} icon={MessageSquare} color="violet" />
                <FunnelBar label="Calendly Sent (C)"  value={metrics?.c ?? 0}  max={funnelMax} icon={CalendarClock} color="amber" />
                <FunnelBar label="Booked (D)"         value={metrics?.d ?? 0}  max={funnelMax} icon={CalendarCheck} color="emerald" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Actividad de warming + CAR
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Límites IG/día: {goalsMap.follows_daily ?? 50} follows · {goalsMap.likes_daily ?? 50} likes · {goalsMap.comments_daily ?? 20} comentarios
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <ActivityMetric
                  label="Follows enviados"
                  value={metrics?.followsSent ?? 0}
                  icon={UserPlus}
                  tint="primary"
                />
                <ActivityMetric
                  label="Follows aceptados"
                  value={metrics?.followsAccepted ?? 0}
                  icon={UserPlus}
                  tint="emerald"
                  hint={metrics?.car !== null && metrics?.car !== undefined ? `CAR ${formatPercent(metrics.car)}` : undefined}
                />
                <ActivityMetric
                  label="Likes enviados"
                  value={metrics?.likes ?? 0}
                  icon={Heart}
                  tint="rose"
                />
                <ActivityMetric
                  label="Comentarios"
                  value={metrics?.comments ?? 0}
                  icon={MessageCircle}
                  tint="violet"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPIs con semáforo */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          Los 5 KPIs con umbral del Cold DM System
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <DoctorLinkWrapper metric="msr">
              <KpiSemaforoCard
                label="MSR · Message Seen"
                description="MS / A"
                value={metrics?.msr ?? null}
                threshold={goalsMap.msr_min ?? null}
                unit="percent"
              />
            </DoctorLinkWrapper>
            <DoctorLinkWrapper metric="prr">
              <KpiSemaforoCard
                label="PRR · Positive Reply"
                description="B / MS"
                value={metrics?.prr ?? null}
                threshold={goalsMap.prr_min ?? null}
                unit="percent"
              />
            </DoctorLinkWrapper>
            <DoctorLinkWrapper metric="csr">
              <KpiSemaforoCard
                label="CSR · Calendly Sent"
                description="C / A"
                value={metrics?.csr ?? null}
                threshold={goalsMap.csr_min ?? null}
                unit="percent"
              />
            </DoctorLinkWrapper>
            <DoctorLinkWrapper metric="abr">
              <KpiSemaforoCard
                label="ABR · Booked"
                description="D / A"
                value={metrics?.abr ?? null}
                threshold={goalsMap.abr_min ?? null}
                unit="percent"
              />
            </DoctorLinkWrapper>
            <DoctorLinkWrapper metric="car">
              <KpiSemaforoCard
                label="CAR · Connection Accept"
                description="Aceptados / Enviados"
                value={metrics?.car ?? null}
                threshold={goalsMap.car_min ?? null}
                unit="percent"
              />
            </DoctorLinkWrapper>
          </div>
        )}
      </div>

      {/* Low-volume hint — if A < 100 the ratios are unreliable per doc 2 */}
      {!isLoading && metrics && metrics.a < 100 && metrics.a > 0 && (
        <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          <strong>Atención:</strong> con menos de 100 mensajes iniciados (A),
          las ratios tienen alta varianza. El doc recomienda ≥100 A antes de
          cambiar la estrategia basándote en estos KPIs.
        </div>
      )}
    </div>
  );
}

/**
 * Wrap a KPI card with a link to the Doctor view when the KPI is below
 * threshold. For Fase 2 the Doctor is still a placeholder — the link
 * navigates but lands on the ComingSoon screen. Fase 5 will fill it in.
 */
function DoctorLinkWrapper({
  metric, children,
}: {
  metric: "msr" | "prr" | "csr" | "abr" | "car";
  children: React.ReactNode;
}) {
  return (
    <Link href={`/prospeccion/doctor?metric=${metric}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
      {children}
    </Link>
  );
}
