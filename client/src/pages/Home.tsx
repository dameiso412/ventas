import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataValidationAlert } from "@/components/DataValidationAlert";
import { useState, useMemo } from "react";
import { useChartTheme } from "@/hooks/useChartTheme";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, Phone, Target, DollarSign,
  CalendarCheck, Eye, Zap, BarChart3, Megaphone, Save, ArrowRight,
  Percent, CreditCard, MousePointerClick, Globe, UserCheck, Info, UsersRound
} from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const SCORE_COLORS = {
  HOT: "#ef4444",
  WARM: "#f97316",
  TIBIO: "#f59e0b",
  "FRÍO": "#3b82f6",
};

function KPICard({ title, value, subtitle, icon: Icon, color, small, tooltip }: {
  title: string; value: string | number; subtitle?: string;
  icon: any; color?: string; small?: boolean; tooltip?: string;
}) {
  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
      <CardContent className={small ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
              {tooltip && (
                <TooltipProvider delayDuration={200}>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/50 hover:text-primary cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed bg-popover text-popover-foreground border-border">
                      <p>{tooltip}</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              )}
            </div>
            <p className={`${small ? "text-lg" : "text-2xl"} font-bold truncate`} style={color ? { color } : {}}>{value}</p>
            {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className={`${small ? "h-8 w-8" : "h-10 w-10"} rounded-lg bg-primary/10 flex items-center justify-center shrink-0`}>
            <Icon className={`${small ? "h-4 w-4" : "h-5 w-5"} text-primary`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CostKPICard({ title, value, benchmark, icon: Icon, color, tooltip }: {
  title: string; value: string; benchmark?: string;
  icon: any; color?: string; tooltip?: string;
}) {
  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
              {tooltip && (
                <TooltipProvider delayDuration={200}>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/50 hover:text-primary cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed bg-popover text-popover-foreground border-border">
                      <p>{tooltip}</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              )}
            </div>
            <p className="text-lg font-bold truncate" style={color ? { color } : {}}>{value}</p>
            {benchmark && <p className="text-[10px] text-muted-foreground/70 truncate">{benchmark}</p>}
          </div>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [mes, setMes] = useState<string>(() => {
    const now = new Date();
    return MESES[now.getMonth()];
  });
  const [semana, setSemana] = useState<string>("all");


  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
  }), [mes, semana]);

  const { data: kpis, isLoading, isError, error } = trpc.dashboard.kpis.useQuery(filters);
  const { data: mktKpis } = trpc.dashboard.marketingKPIs.useQuery(filters);
  const { data: trackerKpis } = trpc.dashboard.trackerKPIs.useQuery(filters);
  const { data: filterValues } = trpc.filters.distinctValues.useQuery();

  // MTD Ad Spend editable
  const [adSpendInput, setAdSpendInput] = useState<string>("");
  const [leadsRawInput, setLeadsRawInput] = useState<string>("");
  const [visitasInput, setVisitasInput] = useState<string>("");
  const [ctrUnicoInput, setCtrUnicoInput] = useState<string>("");
  const [isEditingAd, setIsEditingAd] = useState(false);

  const chartTheme = useChartTheme();
  const utils = trpc.useUtils();
  const upsertMetrics = trpc.dashboard.upsertMonthlyMetrics.useMutation({
    onSuccess: () => {
      utils.dashboard.marketingKPIs.invalidate();
      utils.dashboard.currentMonthMetrics.invalidate();
      setIsEditingAd(false);
      toast.success("Métricas actualizadas", { description: "Los datos de marketing se guardaron correctamente." });
    },
  });

  // Derived values from leads (pipeline counts, score distribution)
  const totalLeads = Number(kpis?.totalLeads || 0);
  const seguimientos = Number(kpis?.seguimientos || 0);

  // Marketing KPIs derived (Ad Spend, leads raw, visitas, etc.)
  const adSpend = Number(mktKpis?.adSpend || 0);
  const totalAgendas = Number(mktKpis?.totalAgendas || 0);
  const totalLeadsRaw = Number(mktKpis?.totalLeadsRaw || 0);
  const visitasLanding = Number(mktKpis?.visitasLandingPage || 0);
  const ctrUnico = Number(mktKpis?.ctrUnico || 0);

  // === DATA SOURCE DETECTION ===
  const setterSource = trackerKpis?.source?.setter || "tracker";
  const closerSource = trackerKpis?.source?.closer || "tracker";

  // === SETTER: Tracker primary, Registro de Citas fallback ===
  const stIntentos = Number(trackerKpis?.setter?.totalIntentos || 0);
  const stIntros = Number(trackerKpis?.setter?.totalIntros || 0);
  const stConfirmadas = Number(trackerKpis?.setter?.totalConfirmadas || 0);
  const stAsistidas = Number(trackerKpis?.setter?.totalAsistidas || 0);

  // === CLOSER: Tracker primary, Registro de Citas fallback ===
  const ctSchedule = Number(trackerKpis?.closer?.totalSchedule || 0);
  const ctLive = Number(trackerKpis?.closer?.totalLive || 0);
  const ctOffers = Number(trackerKpis?.closer?.totalOffers || 0);
  const ctDeposits = Number(trackerKpis?.closer?.totalDeposits || 0);
  const ctCloses = Number(trackerKpis?.closer?.totalCloses || 0);

  // === FINANCIAL KPIs: Prefer tracker revenue, fallback to leads ===
  const trackerRevenue = Number(trackerKpis?.closer?.totalRevenue || 0);
  const trackerCash = Number(trackerKpis?.closer?.totalCash || 0);
  const leadsRevenue = Number(mktKpis?.totalRevenue || 0);
  const leadsCash = Number(mktKpis?.totalCash || 0);
  // Use whichever has data (tracker takes priority)
  const bestRevenue = trackerRevenue > 0 ? trackerRevenue : leadsRevenue;
  const bestCash = trackerCash > 0 ? trackerCash : leadsCash;
  const leadsVentas = Number(mktKpis?.ventas || 0);
  const bestVentas = ctCloses > 0 ? ctCloses : leadsVentas;

  // DQ %
  const dqRate = Number(trackerKpis?.setter?.dqRate || 0);
  const dqCount = Number(trackerKpis?.setter?.dqCount || 0);

  // === INTRO METRICS (from Setter Tracker + Leads) ===
  const stIntroAgendadas = Number(trackerKpis?.setter?.totalIntroAgendadas || 0);
  const stIntroLive = Number(trackerKpis?.setter?.totalIntroLive || 0);
  const stIntroADemo = Number(trackerKpis?.setter?.totalIntroADemo || 0);
  const introShowRate = stIntroAgendadas > 0 ? ((stIntroLive / stIntroAgendadas) * 100) : 0;
  const introDemoRate = stIntroLive > 0 ? ((stIntroADemo / stIntroLive) * 100) : 0;
  const hasIntroData = stIntroAgendadas > 0 || stIntroLive > 0 || stIntroADemo > 0;
  // From leads table
  const totalIntroLeads = Number(kpis?.totalIntros || 0);
  const introsConvertidas = Number(kpis?.introsConvertidas || 0);

  // No Show from Closer Tracker (Schedule - Live)
  const noShowCT = Number(trackerKpis?.closer?.noShow || 0);

  // Product type data from leads
  const ventasPIF = Number(kpis?.ventasPIF || 0);
  const ventasSetupMonthly = Number(kpis?.ventasSetupMonthly || 0);
  const totalSetupFees = Number(kpis?.totalSetupFees || 0);
  const newMRRFromLeads = Number(kpis?.totalRecurrenciaMensual || 0);

  // Revenue breakdown from Closer Tracker
  const setupRevenue = Number(trackerKpis?.closer?.totalSetupRevenue || 0);
  const setupCash = Number(trackerKpis?.closer?.totalSetupCash || 0);
  const piffRevenue = Number(trackerKpis?.closer?.totalPiffRevenue || 0);

  // Cost KPIs (Ad Spend / leads-based counts from Registro de Citas)
  const cpl = totalLeadsRaw > 0 && adSpend > 0 ? (adSpend / totalLeadsRaw) : 0;
  const costoPorAgenda = totalAgendas > 0 && adSpend > 0 ? (adSpend / totalAgendas) : 0;
  // Costo / Triage = Ad Spend / Intros Efectivas (costo por conversación del setter)
  const costoPorTriage = stIntros > 0 && adSpend > 0 ? (adSpend / stIntros) : 0;
  // Costo / Demo Confirmada = Ad Spend / Demos Confirmadas (costo de pasar filtro de calificación)
  const costoPorDemoConfirmada = stConfirmadas > 0 && adSpend > 0 ? (adSpend / stConfirmadas) : 0;
  const costoPorAsistencia = ctLive > 0 && adSpend > 0 ? (adSpend / ctLive) : 0;
  const costoPorOferta = ctOffers > 0 && adSpend > 0 ? (adSpend / ctOffers) : 0;
  const cpa = ctCloses > 0 && adSpend > 0 ? (adSpend / ctCloses) : 0;

  // Rate KPIs — from Setter Tracker
  const answerRate = stIntentos > 0 ? ((stIntros / stIntentos) * 100) : 0;
  const triageRate = stIntros > 0 ? ((stConfirmadas / stIntros) * 100) : 0;
  // Rate KPIs — from Closer Tracker
  const showRate = ctSchedule > 0 ? ((ctLive / ctSchedule) * 100) : 0;
  const offerRate = ctLive > 0 ? ((ctOffers / ctLive) * 100) : 0;
  const closeRate = ctOffers > 0 ? ((ctCloses / ctOffers) * 100) : 0;
  // Marketing rates (from leads/monthly metrics)
  const landingOptIn = visitasLanding > 0 && totalLeadsRaw > 0 ? ((totalLeadsRaw / visitasLanding) * 100) : 0;
  const bookingRate = totalLeadsRaw > 0 && totalAgendas > 0 ? ((totalAgendas / totalLeadsRaw) * 100) : 0;

  // Financial KPIs — best available source
  const ticketPromedioFE = bestVentas > 0 ? (bestRevenue / bestVentas) : 0;
  const roasUpFront = adSpend > 0 ? (bestCash / adSpend) : 0;
  const cashPercentage = bestRevenue > 0 ? ((bestCash / bestRevenue) * 100) : 0;
  const contractedROAs = adSpend > 0 ? (bestRevenue / adSpend) : 0;
  const newMRR = newMRRFromLeads > 0 ? newMRRFromLeads : setupRevenue;

  // Funnel data
  const funnelData = [
    { name: "Intentos", value: stIntentos, fill: "#A855F7" },
    { name: "Intros", value: stIntros, fill: "#8B5CF6" },
    { name: "Schedule", value: ctSchedule, fill: "#7C3AED" },
    { name: "Live", value: ctLive, fill: "#6D28D9" },
    { name: "Ofertas", value: ctOffers, fill: "#5B21B6" },
    { name: "Ventas", value: ctCloses, fill: "#F59E0B" },
  ];

  // Score distribution
  const scoreData = [
    { name: "HOT", value: Number(kpis?.hot || 0), fill: SCORE_COLORS.HOT },
    { name: "WARM", value: Number(kpis?.warm || 0), fill: SCORE_COLORS.WARM },
    { name: "TIBIO", value: Number(kpis?.tibio || 0), fill: SCORE_COLORS.TIBIO },
    { name: "FRÍO", value: Number(kpis?.frio || 0), fill: SCORE_COLORS["FRÍO"] },
  ].filter(d => d.value > 0);

  const handleSaveAdMetrics = () => {
    const mesTarget = mes !== "all" ? mes : MESES[new Date().getMonth()];
    upsertMetrics.mutate({
      mes: mesTarget,
      anio: new Date().getFullYear(),
      adSpend: adSpendInput || String(adSpend),
      totalLeadsRaw: leadsRawInput ? parseInt(leadsRawInput) : (totalLeadsRaw || undefined),
      visitasLandingPage: visitasInput ? parseInt(visitasInput) : (visitasLanding || undefined),
      ctrUnico: ctrUnicoInput || (ctrUnico ? String(ctrUnico) : undefined),
    });
  };

  const fmt = (n: number) => {
    if (n >= 10000) return `$${(n / 1000).toFixed(1)}k`;
    if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    return `$${n.toFixed(2)}`;
  };
  const fmtFull = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const pct = (n: number, hasData: boolean) => hasData ? `${n.toFixed(1)}%` : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">KPIs comerciales y rendimiento de marketing</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[140px] bg-card/50">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {MESES.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={semana} onValueChange={setSemana}>
            <SelectTrigger className="w-[130px] bg-card/50">
              <SelectValue placeholder="Semana" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {[1, 2, 3, 4, 5].map(s => (
                <SelectItem key={s} value={s.toString()}>Semana {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Connection Error Banner */}
      {isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <span className="text-red-400 text-lg">!</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">Error de conexion a la base de datos</p>
            <p className="text-xs text-muted-foreground mt-0.5">{(error as any)?.message || "No se pudieron cargar los datos. Intenta recargar la pagina."}</p>
          </div>
        </div>
      )}

      {/* Data Validation Alerts */}
      <DataValidationAlert filters={filters} />

      {/* ==================== MTD AD SPEND + AD METRICS ==================== */}
      <Card className="bg-gradient-to-r from-purple-900/40 to-card/50 border-primary/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Inversión Publicitaria MTD — {mes !== "all" ? mes : MESES[new Date().getMonth()]} {new Date().getFullYear()}
              </h2>
            </div>
            {!isEditingAd ? (
              <Button variant="outline" size="sm" onClick={() => {
                setAdSpendInput(String(adSpend || ""));
                setLeadsRawInput(String(totalLeadsRaw || ""));
                setVisitasInput(String(visitasLanding || ""));
                setCtrUnicoInput(String(ctrUnico || ""));
                setIsEditingAd(true);
              }}>
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsEditingAd(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleSaveAdMetrics} disabled={upsertMetrics.isPending}>
                  <Save className="h-4 w-4 mr-1" /> Guardar
                </Button>
              </div>
            )}
          </div>

          {isEditingAd ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Ad Spend (USD)</label>
                <Input type="number" value={adSpendInput} onChange={e => setAdSpendInput(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Total Leads (Raw)</label>
                <Input type="number" value={leadsRawInput} onChange={e => setLeadsRawInput(e.target.value)} placeholder="0" className="mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">Visitas Landing</label>
                <Input type="number" value={visitasInput} onChange={e => setVisitasInput(e.target.value)} placeholder="0" className="mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase">CTR Único (%)</label>
                <Input type="number" step="0.01" value={ctrUnicoInput} onChange={e => setCtrUnicoInput(e.target.value)} placeholder="0.00" className="mt-1" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-card/60 rounded-lg p-3 border border-primary/20">
                <p className="text-[10px] text-muted-foreground uppercase">Ad Spend MTD (USD)</p>
                <p className="text-xl font-bold text-primary">{adSpend > 0 ? fmt(adSpend) : "$0"}</p>
              </div>
              <div className="bg-card/60 rounded-lg p-3 border border-border/30">
                <p className="text-[10px] text-muted-foreground uppercase">Total Leads Raw</p>
                <p className="text-xl font-bold">{totalLeadsRaw}</p>
              </div>
              <div className="bg-card/60 rounded-lg p-3 border border-border/30">
                <p className="text-[10px] text-muted-foreground uppercase">Visitas Landing</p>
                <p className="text-xl font-bold">{visitasLanding}</p>
              </div>
              <div className="bg-card/60 rounded-lg p-3 border border-border/30">
                <p className="text-[10px] text-muted-foreground uppercase">CTR Único</p>
                <p className="text-xl font-bold">{ctrUnico}%</p>
              </div>
              <div className="bg-card/60 rounded-lg p-3 border border-border/30">
                <p className="text-[10px] text-muted-foreground uppercase">Agendas (Bookings)</p>
                <p className="text-xl font-bold">{totalAgendas}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== COST KPIs (Ad Spend Based) ==================== */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5" /> Costos de Adquisición
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <CostKPICard title="CPL" value={cpl > 0 ? fmt(cpl) : "—"} benchmark="Ideal: < $1 · Max: $5" icon={MousePointerClick} color={cpl > 0 && cpl <= 5 ? "#22c55e" : cpl > 5 ? "#ef4444" : undefined} tooltip="Costo por Lead. Cuánto cuesta que una persona deje sus datos después de ver el anuncio. Mide la eficiencia de la inversión publicitaria para generar interés inicial." />
          <CostKPICard title="Costo / Agenda" value={costoPorAgenda > 0 ? fmt(costoPorAgenda) : "—"} benchmark="Ideal: $10-15 · Max: $35" icon={CalendarCheck} color={costoPorAgenda > 0 && costoPorAgenda <= 35 ? "#22c55e" : costoPorAgenda > 35 ? "#ef4444" : undefined} tooltip="Cuánto cuesta que un prospecto agende una demo en el calendario. Refleja la capacidad del funnel (VSL + encuesta) para convertir leads en citas reales." />
          <CostKPICard title="Costo / Triage" value={costoPorTriage > 0 ? fmt(costoPorTriage) : "—"} benchmark="Ad Spend / Intros Efectivas" icon={Phone} tooltip="Cuánto cuesta que un setter logre tener una conversación telefónica con un prospecto. Mide la eficiencia del equipo de setters para contactar y hablar con las agendas." />
          <CostKPICard title="Costo / Demo Conf." value={costoPorDemoConfirmada > 0 ? fmt(costoPorDemoConfirmada) : "—"} benchmark="Ad Spend / Demos Confirmadas" icon={CalendarCheck} tooltip="Cuánto cuesta que una triage resulte en una demo confirmada. Mide la capacidad del setter de calificar al prospecto y asegurar su compromiso para asistir a la demo." />
          <CostKPICard title="Costo / Asistencia" value={costoPorAsistencia > 0 ? fmt(costoPorAsistencia) : "—"} benchmark="Demo asistida" icon={Eye} tooltip="Cuánto cuesta que un prospecto efectivamente se presente a la demo. Refleja la calidad de la confirmación y el compromiso real del prospecto." />
          <CostKPICard title="Costo / Oferta" value={costoPorOferta > 0 ? fmt(costoPorOferta) : "—"} benchmark="Oferta presentada" icon={Target} tooltip="Cuánto cuesta llegar a presentar una oferta comercial. Mide la eficiencia del closer para llevar la demo hasta el punto de propuesta de venta." />
          <CostKPICard title="CPA" value={cpa > 0 ? fmt(cpa) : "—"} benchmark="Costo por adquisición" icon={UserCheck} color="#F59E0B" tooltip="Costo por Adquisición. Cuánto cuesta cerrar un cliente nuevo. Es el KPI más importante de costos: resume toda la eficiencia del funnel desde el anuncio hasta la venta." />
        </div>
      </div>

      {/* ==================== RATE KPIs ==================== */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Percent className="h-3.5 w-3.5" /> Tasas de Conversión
          {(setterSource === "leads" || closerSource === "leads") && (
            <span className="text-[9px] font-normal text-amber-400/70 ml-2">
              Fuente: Registro de Citas {closerSource === "leads" ? "(closer)" : ""}{setterSource === "leads" ? "(setter)" : ""}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-3">
          <KPICard small title="Landing Opt-In" value={landingOptIn > 0 ? `${landingOptIn.toFixed(1)}%` : "—"} subtitle={`${totalLeadsRaw} / ${visitasLanding}`} icon={Globe} tooltip="Porcentaje de visitantes de la landing page que dejan sus datos. Mide qué tan persuasiva es la página y la VSL para generar interés." />
          <KPICard small title="Booking Rate" value={bookingRate > 0 ? `${bookingRate.toFixed(1)}%` : "—"} subtitle={`${totalAgendas} / ${totalLeadsRaw} leads`} icon={CalendarCheck} tooltip="Porcentaje de leads que efectivamente agendan una demo. Mide la capacidad de la encuesta de calificación y el calendario para convertir el interés en una cita concreta." />
          <KPICard small title="Answer Rate" value={pct(answerRate, stIntentos > 0)} subtitle={`${stIntros} / ${stIntentos} intentos`} icon={Phone} color={stIntentos > 0 ? (answerRate < 30 ? "#ef4444" : "#22c55e") : undefined} tooltip="Tasa de contestación. De todos los intentos de llamada del setter, cuántos prospectos contestaron y se logró tener una conversación. Mide la eficiencia del setter para conectar con las agendas." />
          <KPICard small title="DQ %" value={pct(dqRate, stIntros > 0)} subtitle={`${dqCount} descalificados / ${stIntros} intros`} icon={TrendingDown} color={stIntros > 0 ? (dqRate > 50 ? "#ef4444" : dqRate > 30 ? "#f59e0b" : "#22c55e") : undefined} tooltip="Tasa de Descalificación. De las conversaciones que tuvo el setter, cuántas no pasaron el filtro de calificación. Un DQ% alto puede indicar mala calidad de leads o targeting incorrecto en ads." />
          <KPICard small title="Triage Rate" value={pct(triageRate, stIntros > 0)} subtitle={`${stConfirmadas} / ${stIntros} intros`} icon={UserCheck} tooltip="Tasa de calificación y confirmación. De las conversaciones del setter, cuántas resultaron en una demo confirmada. Mide la capacidad del setter de pre-vender y asegurar el compromiso del prospecto." />
          <KPICard small title="Show Rate" value={pct(showRate, ctSchedule > 0)} subtitle={`${ctLive} / ${ctSchedule} schedule`} icon={Eye} color={ctSchedule > 0 ? (showRate >= 80 ? "#22c55e" : "#f59e0b") : undefined} tooltip="Tasa de asistencia a demos. De las demos agendadas en el calendario del closer, cuántas personas realmente se presentaron. Refleja la calidad de la confirmación del setter y el nivel de compromiso del prospecto." />
          <KPICard small title="Offer Rate" value={pct(offerRate, ctLive > 0)} subtitle={`${ctOffers} / ${ctLive} live`} icon={Target} color={ctLive > 0 ? (offerRate >= 70 ? "#22c55e" : "#f59e0b") : undefined} tooltip="Tasa de oferta. De las demos que se llevaron a cabo, en cuántas el closer llegó a presentar la oferta comercial. Mide la habilidad del closer para llevar la conversación al punto de cierre." />
          <KPICard small title="Close Rate" value={pct(closeRate, ctOffers > 0)} subtitle={`${ctCloses} / ${ctOffers} ofertas`} icon={Zap} color={ctOffers > 0 ? (closeRate >= 30 ? "#22c55e" : "#f59e0b") : undefined} tooltip="Tasa de cierre. De las ofertas presentadas, cuántas se convirtieron en venta. Es el indicador más directo de la efectividad del closer para convertir oportunidades en clientes." />
        </div>
      </div>

      {/* ==================== FINANCIAL KPIs ==================== */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" /> KPIs Financieros
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <KPICard small title="Revenue Total" value={bestRevenue > 0 ? fmtFull(bestRevenue) : "$0"} icon={DollarSign} color="#F59E0B" tooltip="Ingreso total facturado desde leads con venta cerrada." />
          <KPICard small title="Cash Collected" value={bestCash > 0 ? fmtFull(bestCash) : "$0"} icon={CreditCard} color="#22c55e" tooltip="Dinero efectivamente cobrado desde leads con venta cerrada." />
          <KPICard small title="Ticket Promedio FE" value={ticketPromedioFE > 0 ? fmtFull(ticketPromedioFE) : "—"} subtitle={`${bestVentas} ventas`} icon={TrendingUp} tooltip="Valor promedio por venta (Front-End). Cuánto genera en promedio cada cliente nuevo. Ayuda a evaluar si el pricing y la oferta están alineados con los objetivos de revenue." />
          <KPICard small title="ROAS Up Front" value={roasUpFront > 0 ? `${roasUpFront.toFixed(2)}x` : "—"} subtitle={`Cash / Ad Spend`} icon={TrendingUp} color={roasUpFront >= 3 ? "#22c55e" : roasUpFront >= 1 ? "#f59e0b" : "#ef4444"} tooltip="Retorno sobre inversión publicitaria inmediato. Por cada dólar invertido en ads, cuántos dólares ya cobraste. Un ROAS >3x es excelente; <1x significa que aún no recuperas la inversión." />
          <KPICard small title="Contracted ROAs" value={contractedROAs > 0 ? `${contractedROAs.toFixed(2)}x` : "—"} subtitle="Revenue / Ad Spend" icon={TrendingUp} color={contractedROAs >= 5 ? "#22c55e" : contractedROAs >= 2 ? "#f59e0b" : "#ef4444"} tooltip="Retorno contratado sobre inversión. Incluye todo el revenue comprometido (no solo el cash cobrado). Muestra el valor total que generará la inversión publicitaria a medida que se cobren los contratos." />
          <KPICard small title="Cash %" value={cashPercentage > 0 ? `${cashPercentage.toFixed(1)}%` : "—"} subtitle="Cash / Revenue" icon={Percent} tooltip="Porcentaje de cobro inmediato. Qué proporción del revenue contratado ya se cobró. Ideal >80%. Un Cash% bajo indica mucho revenue pendiente de cobro o planes de pago extendidos." />
          <KPICard small title="New MRR" value={newMRR > 0 ? fmtFull(newMRR) : "—"} subtitle={ventasSetupMonthly > 0 ? `${ventasSetupMonthly} Setup+Monthly` : "Retención mensual"} icon={CreditCard} color="#8B5CF6" tooltip="Nuevo ingreso recurrente mensual. La suma de las recurrencias mensuales de clientes con producto Setup+Monthly. Representa el ingreso predecible que se generará cada mes." />
          <KPICard small title="Ventas" value={bestVentas} subtitle={ventasPIF + ventasSetupMonthly > 0 ? `${ventasPIF} PIF · ${ventasSetupMonthly} S+M` : `${seguimientos} seguimientos`} icon={Zap} color="#22c55e" tooltip="Total de ventas cerradas en el período. Desglosado por tipo de producto: PIF (pago único) y S+M (Setup + Mensualidad). Es el resultado final de todo el proceso comercial." />
        </div>
      </div>

      {/* ==================== REUNIONES INTRODUCTORIAS (Conditional) ==================== */}
      {hasIntroData && (
        <div>
          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <UsersRound className="h-3.5 w-3.5" /> Reuniones Introductorias
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard small title="Intro Agendadas" value={stIntroAgendadas} icon={CalendarCheck} tooltip="Reuniones introductorias agendadas en el calendario del setter. Estas son para leads que no están tan cualificados financieramente y necesitan una conversación previa antes de pasar a demo." />
            <KPICard small title="Intro Live" value={stIntroLive} icon={Eye} tooltip="Reuniones introductorias que realmente se llevaron a cabo. El prospecto se presentó a la reunión introductoria." />
            <KPICard small title="Intro Show Rate" value={`${introShowRate.toFixed(1)}%`} subtitle={`${stIntroLive} / ${stIntroAgendadas}`} icon={Percent} color={introShowRate >= 70 ? "#22c55e" : "#f59e0b"} tooltip="Porcentaje de asistencia a reuniones introductorias. De las intros agendadas, cuántas personas se presentaron." />
            <KPICard small title="Intro → Demo" value={stIntroADemo} icon={Target} tooltip="Reuniones introductorias que resultaron en una demo agendada. El setter logró cualificar al prospecto y pasarlo al siguiente paso del embudo." />
            <KPICard small title="Intro→Demo Rate" value={`${introDemoRate.toFixed(1)}%`} subtitle={`${stIntroADemo} / ${stIntroLive} live`} icon={Zap} color={introDemoRate >= 60 ? "#22c55e" : "#f59e0b"} tooltip="Tasa de conversión de intro a demo. De las reuniones introductorias que se dieron, qué porcentaje pasó a demo. Mide la efectividad del setter para cualificar y avanzar prospectos." />
            <KPICard small title="Intros en Pipeline" value={totalIntroLeads} subtitle={introsConvertidas > 0 ? `${introsConvertidas} ya pasaron a demo` : undefined} icon={UsersRound} color="#3b82f6" tooltip="Total de leads que entraron como intro en el registro de citas. Muestra cuántos prospectos están en el camino alternativo del embudo." />
          </div>
        </div>
      )}

      {/* ==================== PIPELINE COUNTS ==================== */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" /> Pipeline Comercial
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard small title="Total Agendas" value={totalLeads} icon={Users} tooltip="Número total de prospectos que agendaron una demo en el calendario. Es el punto de entrada del proceso comercial." />
          <KPICard small title="Demos Confirmadas" value={stConfirmadas} icon={CalendarCheck} tooltip="Agendas que pasaron el filtro de calificación del setter y confirmaron asistencia a la demo. Son los prospectos con mayor probabilidad de convertir." />
          <KPICard small title="No Show" value={noShowCT} subtitle={`${ctSchedule} schedule - ${ctLive} live`} icon={TrendingDown} color="#ef4444" tooltip="Prospectos que tenían demo agendada pero no se presentaron. Un No Show alto indica problemas en la confirmación o bajo compromiso del prospecto." />
          <KPICard small title="Seguimientos" value={seguimientos} icon={BarChart3} color="#f59e0b" tooltip="Prospectos en proceso de seguimiento activo. Aún no se ha cerrado la venta pero siguen siendo oportunidades válidas que requieren atención del equipo." />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funnel Chart */}
        <Card className="lg:col-span-2 bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Embudo de Ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                <XAxis type="number" tick={{ fill: chartTheme.tickFill, fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: chartTheme.tickFill, fontSize: 12 }} width={90} />
                <Tooltip
                  contentStyle={chartTheme.tooltip.contentStyle}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Score de Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scoreData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={scoreData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                    {scoreData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTheme.tooltip.contentStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px", color: chartTheme.legendColor }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos de scoring
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acquisition Funnel Visual */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Embudo de Adquisición (Marketing → Ventas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-1 overflow-x-auto py-2">
            {[
              { label: "Visitas", value: visitasLanding, color: "#6366f1" },
              { label: "Leads Raw", value: totalLeadsRaw, color: "#8B5CF6" },
              { label: "Agendas", value: totalAgendas, color: "#A855F7" },
              { label: "Intros", value: stIntros, color: "#7C3AED" },
              { label: "Live Calls", value: ctLive, color: "#6D28D9" },
              { label: "Ofertas", value: ctOffers, color: "#5B21B6" },
              { label: "Ventas", value: ctCloses, color: "#F59E0B" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-1">
                <div className="text-center min-w-[70px]">
                  <div className="text-lg font-bold" style={{ color: step.color }}>{step.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{step.label}</div>
                  {i > 0 && arr[i - 1].value > 0 && (
                    <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                      {((step.value / arr[i - 1].value) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
