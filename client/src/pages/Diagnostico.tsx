import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import {
  AlertTriangle, CheckCircle2, XCircle, Eye, TrendingDown,
  Zap, Target, ShieldAlert, DollarSign, Users, Phone,
  Megaphone, ArrowRight, Clock, Calendar, CalendarDays,
  Activity, BarChart3, ChevronDown, ChevronUp
} from "lucide-react";
import { useChartTheme } from "@/hooks/useChartTheme";
import { useStatusColors } from "@/hooks/useStatusColors";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const CATEGORY_ICONS: Record<string, any> = {
  marketing: Megaphone,
  sales_setter: Phone,
  sales_closer: Target,
  profitability: DollarSign,
};

const CATEGORY_COLORS: Record<string, string> = {
  marketing: "#60a5fa",
  sales_setter: "#34d399",
  sales_closer: "#a78bfa",
  profitability: "#fbbf24",
};

const OVERALL_HEALTH_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: any }> = {
  noData: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)", label: "SIN DATOS SUFICIENTES", icon: Eye },
  critical: { color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", label: "CRÍTICO", icon: XCircle },
  warning: { color: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.3)", label: "ALERTA", icon: AlertTriangle },
  caution: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", label: "PRECAUCIÓN", icon: Eye },
  healthy: { color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.3)", label: "SALUDABLE", icon: CheckCircle2 },
};

function formatValue(value: number, unit: string): string {
  if (unit === "usd") return `$${value.toFixed(2)}`;
  if (unit === "ratio") return `${value.toFixed(2)}x`;
  return `${value.toFixed(1)}%`;
}

function HealthBadge({ level, color }: { level: string; color: { bg: string; text: string; label: string } }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {color.label}
    </span>
  );
}

function MetricGauge({ metric, value, level, color, benchmark, unit }: {
  metric: string; value: number; level: string;
  color: { bg: string; text: string; label: string };
  benchmark: any; unit: string;
}) {
  // Calculate position on gauge (0-100%)
  let position = 50;
  if (benchmark.higherIsBetter) {
    const min = benchmark.cut;
    const max = benchmark.excellent[0];
    position = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 50;
  } else {
    const min = benchmark.excellent[1];
    const max = benchmark.cut;
    position = max > min ? Math.min(100, Math.max(0, 100 - ((value - min) / (max - min)) * 100)) : 50;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{benchmark.label}</span>
        <HealthBadge level={level} color={color} />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold min-w-[80px]" style={{ color: color.text }}>
          {formatValue(value, unit)}
        </span>
        <div className="flex-1">
          <div className="relative h-2.5 rounded-full overflow-hidden bg-muted">
            {/* Gradient bar: red → orange → yellow → green */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "linear-gradient(to right, #ef4444, #f97316, #fbbf24, #4ade80)",
                opacity: 0.3,
              }}
            />
            {/* Position indicator */}
            <div
              className="absolute top-0 h-full w-1 rounded-full transition-all"
              style={{
                left: `${position}%`,
                backgroundColor: color.text,
                boxShadow: `0 0 6px ${color.text}`,
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-muted-foreground">
              {benchmark.higherIsBetter ? "Cortar" : "Excelente"}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {benchmark.higherIsBetter ? "Excelente" : "Cortar"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConstraintCard({ constraint, index }: { constraint: any; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const Icon = CATEGORY_ICONS[constraint.category] || AlertTriangle;
  const catColor = CATEGORY_COLORS[constraint.category] || "#a78bfa";

  const layerLabels: Record<number, string> = { 1: "MACRO", 2: "MICRO", 3: "GRANULAR" };

  return (
    <Card
      className="border transition-all hover:border-primary/30 cursor-pointer"
      style={{ borderColor: `${catColor}30`, backgroundColor: `${catColor}05` }}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${catColor}20` }}
            >
              <Icon className="h-5 w-5" style={{ color: catColor }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground">{constraint.title}</h3>
                <Badge variant="outline" className="text-[10px] h-5" style={{ borderColor: catColor, color: catColor }}>
                  Capa {constraint.layer}: {layerLabels[constraint.layer]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{constraint.diagnosis}</p>
              {/* Affected metrics */}
              {constraint.affectedMetrics && constraint.affectedMetrics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {constraint.affectedMetrics.map((m: any) => (
                    <span
                      key={m.metric}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: m.level === "cut" ? "rgba(248,113,113,0.15)" :
                          m.level === "probCut" ? "rgba(251,146,60,0.15)" : "rgba(251,191,36,0.15)",
                        color: m.level === "cut" ? "#f87171" :
                          m.level === "probCut" ? "#fb923c" : "#fbbf24",
                      }}
                    >
                      {m.label}: {formatValue(m.value, m.metric.includes("Rate") || m.metric.includes("rate") || m.metric.includes("Cash") || m.metric.includes("Opt") || m.metric.includes("ctr") || m.metric.includes("Booking") ? "percent" : m.metric.includes("roas") ? "ratio" : "usd")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            {/* Actions: Today */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Hoy</span>
              </div>
              <ul className="space-y-1 ml-5">
                {constraint.actions.today.map((action: string, i: number) => (
                  <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Actions: This Week */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Esta Semana</span>
              </div>
              <ul className="space-y-1 ml-5">
                {constraint.actions.thisWeek.map((action: string, i: number) => (
                  <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Actions: This Month */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Este Mes</span>
              </div>
              <ul className="space-y-1 ml-5">
                {constraint.actions.thisMonth.map((action: string, i: number) => (
                  <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelVisualization({ metrics }: { metrics: any[] }) {
  // Build funnel stages from metrics
  const funnelStages = [
    { label: "CTR Único", metric: "ctrUnico" },
    { label: "Landing Opt-In", metric: "landingOptIn" },
    { label: "Booking Rate", metric: "leadToBooking" },
    { label: "Answer Rate", metric: "answerRate" },
    { label: "Triage Rate", metric: "triageRate" },
    { label: "Show Rate", metric: "showRate" },
    { label: "Close Rate", metric: "closeRate" },
  ];

  return (
    <div className="space-y-1">
      {funnelStages.map((stage, i) => {
        const m = metrics.find(mm => mm.metric === stage.metric);
        if (!m) return null;
        const width = Math.max(20, 100 - i * 10);
        return (
          <div key={stage.metric} className="flex items-center gap-3">
            <div className="w-28 text-right">
              <span className="text-[10px] text-muted-foreground font-medium">{stage.label}</span>
            </div>
            <div className="flex-1 relative">
              <div
                className="h-7 rounded-md flex items-center px-3 transition-all"
                style={{
                  width: `${width}%`,
                  backgroundColor: `${m.color.text}15`,
                  borderLeft: `3px solid ${m.color.text}`,
                }}
              >
                <span className="text-xs font-bold" style={{ color: m.color.text }}>
                  {formatValue(m.value, m.unit)}
                </span>
              </div>
            </div>
            <div className="w-24">
              <HealthBadge level={m.level} color={m.color} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Diagnostico() {
  const now = new Date();
  const [mesFilter, setMesFilter] = useState(MESES[now.getMonth()]);
  const sc = useStatusColors();

  const { data: diagnosis, isLoading } = trpc.diagnosis.run.useQuery(
    mesFilter ? { mes: mesFilter } : undefined
  );
  const { data: filterValues } = trpc.filters.distinctValues.useQuery();

  const costMetrics = useMemo(() =>
    diagnosis?.metrics?.filter((m: any) => m.unit === "usd") ?? [], [diagnosis]);
  const rateMetrics = useMemo(() =>
    diagnosis?.metrics?.filter((m: any) => m.unit === "percent") ?? [], [diagnosis]);
  const ratioMetrics = useMemo(() =>
    diagnosis?.metrics?.filter((m: any) => m.unit === "ratio") ?? [], [diagnosis]);

  const summary = diagnosis?.summary;
  const constraints = diagnosis?.constraints ?? [];

  const healthConfig = summary ? OVERALL_HEALTH_CONFIG[summary.overallHealth] : OVERALL_HEALTH_CONFIG.healthy;
  const HealthIcon = healthConfig.icon;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Diagnóstico de Constraints
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análisis automatizado del funnel de ventas vs benchmarks LATAM
          </p>
        </div>
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Overall Health Banner */}
      {summary && (
        <Card
          className="border-2 transition-all"
          style={{ borderColor: healthConfig.border, backgroundColor: healthConfig.bg }}
        >
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="h-14 w-14 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${healthConfig.color}20` }}
                >
                  <HealthIcon className="h-7 w-7" style={{ color: healthConfig.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold" style={{ color: healthConfig.color }}>
                      Estado: {healthConfig.label}
                    </h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {summary.overallHealth === 'noData'
                      ? "No hay datos suficientes para un diagnóstico preciso. Ingresa Ad Spend y espera a tener al menos 5 leads/agendas."
                      : constraints.length === 0
                      ? "No se detectaron cuellos de botella significativos. El funnel opera dentro de los benchmarks."
                      : `Se detectaron ${constraints.length} constraint${constraints.length > 1 ? "s" : ""} activo${constraints.length > 1 ? "s" : ""} en el funnel.`
                    }
                  </p>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                {Object.entries(summary.healthCounts).map(([level, count]) => {
                  if (count === 0) return null;
                  const colors: Record<string, string> = {
                    excellent: "#4ade80", good: "#60a5fa", watch: "#93c5fd",
                    borderline: "#fbbf24", probCut: "#fb923c", cut: "#f87171",
                  };
                  const labels: Record<string, string> = {
                    excellent: "Excelente", good: "Bueno", watch: "Vigilar",
                    borderline: "Borderline", probCut: "Prob. Cortar", cut: "Cortar",
                  };
                  return (
                    <div key={level} className="text-center">
                      <div className="text-xl font-bold" style={{ color: colors[level] }}>{count}</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{labels[level]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Raw data summary */}
            {summary.rawData && (
              <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {[
                  { label: "Ad Spend", value: `$${summary.rawData.adSpend.toLocaleString()}` },
                  { label: "Leads Raw", value: summary.rawData.totalLeadsRaw },
                  { label: "Agendas", value: summary.rawData.totalAgendas },
                  { label: "Contestados", value: summary.rawData.contestados },
                  { label: "Demos", value: summary.rawData.demosAsistidas },
                  { label: "Ventas", value: summary.rawData.ventas },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <div className="text-sm font-bold text-foreground">{item.value}</div>
                    <div className="text-[9px] text-muted-foreground uppercase">{item.label}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Funnel Health Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Salud del Funnel de Conversión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelVisualization metrics={diagnosis?.metrics ?? []} />
          </CardContent>
        </Card>

        {/* Cost Metrics */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Costos de Adquisición
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {costMetrics.map((m: any) => (
              <MetricGauge key={m.metric} {...m} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Rate Metrics Grid */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Tasas de Conversión — Detalle por Etapa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...rateMetrics, ...ratioMetrics].map((m: any) => (
              <div key={m.metric} className="p-3 rounded-lg" style={{ backgroundColor: `${m.color.text}08`, border: `1px solid ${m.color.text}20` }}>
                <MetricGauge {...m} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Constraints */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight">
            Constraints Detectados
            {constraints.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({constraints.length} activo{constraints.length > 1 ? "s" : ""})
              </span>
            )}
          </h2>
        </div>

        {constraints.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-green-400">Sin Constraints Activos</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Todas las métricas del funnel están dentro de los benchmarks LATAM.
                {summary?.rawData?.adSpend === 0 && (
                  <span className="block mt-2 text-amber-400">
                    Nota: No hay Ad Spend registrado para este período. Ingresa los datos en el Dashboard para un diagnóstico completo.
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {constraints.map((c: any, i: number) => (
              <ConstraintCard key={c.id} constraint={c} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Benchmark Reference Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Tabla de Referencia — Benchmarks LATAM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Métrica</th>
                  <th className="text-center py-2 px-2 font-medium" style={{ color: sc.excellent }}>Excelente</th>
                  <th className="text-center py-2 px-2 font-medium" style={{ color: sc.goodBlue }}>Bueno</th>
                  <th className="text-center py-2 px-2 font-medium" style={{ color: sc.watch }}>Vigilar</th>
                  <th className="text-center py-2 px-2 font-medium" style={{ color: sc.borderline }}>Borderline</th>
                  <th className="text-center py-2 px-2 font-medium" style={{ color: sc.probCut }}>Prob. Cortar</th>
                  <th className="text-center py-2 px-2 font-medium" style={{ color: sc.cut }}>Cortar</th>
                  <th className="text-center py-2 px-2 font-bold text-primary">Actual</th>
                </tr>
              </thead>
              <tbody>
                {(diagnosis?.metrics ?? []).map((m: any) => {
                  const bm = m.benchmark;
                  const fmt = (v: number) => {
                    if (m.unit === "usd") return `$${v}`;
                    if (m.unit === "ratio") return `${v}x`;
                    return `${v}%`;
                  };
                  const rangeStr = (range: [number, number]) => `${fmt(range[0])}–${fmt(range[1])}`;
                  return (
                    <tr key={m.metric} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                      <td className="py-2 px-2 font-medium text-foreground">{bm.label}</td>
                      <td className="text-center py-2 px-2" style={{ color: sc.excellent }}>{rangeStr(bm.excellent)}</td>
                      <td className="text-center py-2 px-2" style={{ color: sc.goodBlue }}>{rangeStr(bm.good)}</td>
                      <td className="text-center py-2 px-2" style={{ color: sc.watch }}>{rangeStr(bm.watch)}</td>
                      <td className="text-center py-2 px-2" style={{ color: sc.borderline }}>{rangeStr(bm.borderline)}</td>
                      <td className="text-center py-2 px-2" style={{ color: sc.probCut }}>{rangeStr(bm.probCut)}</td>
                      <td className="text-center py-2 px-2" style={{ color: sc.cut }}>
                        {bm.higherIsBetter ? `<${fmt(bm.cut)}` : `>${fmt(bm.cut)}`}
                      </td>
                      <td className="text-center py-2 px-2 font-bold" style={{ color: m.color.text }}>
                        {formatValue(m.value, m.unit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
