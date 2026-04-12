import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Calculator, TrendingUp, DollarSign, Users, Target, ArrowDown,
  Info, Save, Trash2, RotateCcw, Zap,
  Phone, CalendarCheck, Video, Handshake, Banknote, Megaphone
} from "lucide-react";

// ==================== BENCHMARKS ====================
const BENCHMARKS: Record<string, { poor: number; ok: number; good: number; excellent: number; unit: string; inverse?: boolean; description: string }> = {
  cpb: { poor: 40, ok: 25, good: 15, excellent: 10, unit: "$", inverse: true, description: "Costo por cada cita agendada en ads. Ideal: $10-15. Máximo tolerable: $35-40." },
  cpa: { poor: 500, ok: 300, good: 150, excellent: 80, unit: "$", inverse: true, description: "Costo de adquisición por cliente cerrado (Ad Spend / Clientes)" },
  closeRate: { poor: 15, ok: 20, good: 25, excellent: 30, unit: "%", description: "% de demos que se convierten en clientes" },
  showRate: { poor: 40, ok: 50, good: 60, excellent: 70, unit: "%", description: "% de agendas confirmadas que asisten a la demo" },
  answerRate: { poor: 60, ok: 75, good: 85, excellent: 90, unit: "%", description: "% de agendas que CONTESTAN el teléfono al primer contacto" },
  confirmationRate: { poor: 70, ok: 80, good: 85, excellent: 90, unit: "%", description: "% de las que contestan que se CONFIRMAN como agenda real" },
  upfrontCashPct: { poor: 40, ok: 60, good: 75, excellent: 80, unit: "%", description: "% del revenue cobrado al momento del cierre" },
  roas: { poor: 3, ok: 5, good: 8, excellent: 10, unit: "x", description: "Retorno por cada dólar invertido en ads (Revenue / Ad Spend)" },
};

function getBenchmarkLevel(metric: string, value: number): { level: string; color: string } {
  const b = BENCHMARKS[metric];
  if (!b) return { level: "—", color: "text-muted-foreground" };
  if (b.inverse) {
    if (value <= b.excellent) return { level: "Excelente", color: "text-emerald-400" };
    if (value <= b.good) return { level: "Bueno", color: "text-green-400" };
    if (value <= b.ok) return { level: "Aceptable", color: "text-yellow-400" };
    return { level: "Pobre", color: "text-red-400" };
  }
  if (value >= b.excellent) return { level: "Excelente", color: "text-emerald-400" };
  if (value >= b.good) return { level: "Bueno", color: "text-green-400" };
  if (value >= b.ok) return { level: "Aceptable", color: "text-yellow-400" };
  return { level: "Pobre", color: "text-red-400" };
}

// ==================== FUNNEL CALCULATION ====================
// Flujo simplificado de Sacamedi:
// Modo Inverso (Objetivo → Inversión):
//   Revenue Goal → Clientes = Revenue / Ticket → Demos = Clientes / CloseRate
//   → Agendas Confirmadas = Demos / ShowRate → Agendas que Contestan = Confirmadas / AnswerRate
//   → Agendas Totales = Contestan / ConfirmationRate → Ad Spend = Agendas * CPB
//
// Modo Directo (Inversión → Revenue):
//   Ad Spend → Agendas = AdSpend / CPB → Contestan = Agendas * ConfirmationRate
//   → Confirmadas = Contestan * AnswerRate → Demos = Confirmadas * ShowRate
//   → Clientes = Demos * CloseRate → Revenue = Clientes * Ticket

function calculateFunnel(inputs: {
  mode: "reverse" | "forward";
  revenueGoal: number;
  adSpendInput: number;
  ticketPromedio: number;
  upfrontCashPct: number;
  closeRate: number;
  showRate: number;
  confirmationRate: number;
  answerRate: number;
  cpb: number;
  setterCapacity: number;
  closerCapacity: number;
  setterMonthlyCost: number;
  closerMonthlyCost: number;
}) {
  const { mode, ticketPromedio, upfrontCashPct, closeRate, showRate, confirmationRate, answerRate, cpb, setterCapacity, closerCapacity, setterMonthlyCost, closerMonthlyCost } = inputs;
  const cr = closeRate / 100;
  const sr = showRate / 100;
  const ar = answerRate / 100;
  const confR = confirmationRate / 100;
  const ucPct = upfrontCashPct / 100;

  let revenue: number, adSpend: number;
  let clientesNecesarios: number, demosNecesarias: number;
  let agendasConfirmadas: number, agendasQueContestan: number, agendasTotales: number;

  if (mode === "reverse") {
    // Dado un objetivo de facturación, calcular inversión necesaria
    revenue = inputs.revenueGoal || 0;
    clientesNecesarios = ticketPromedio > 0 ? Math.ceil(revenue / ticketPromedio) : 0;
    demosNecesarias = cr > 0 ? Math.ceil(clientesNecesarios / cr) : 0;
    agendasConfirmadas = sr > 0 ? Math.ceil(demosNecesarias / sr) : 0;
    agendasQueContestan = confR > 0 ? Math.ceil(agendasConfirmadas / confR) : 0;
    agendasTotales = ar > 0 ? Math.ceil(agendasQueContestan / ar) : 0;
    adSpend = agendasTotales * cpb;
  } else {
    // Dado un presupuesto de ads, calcular revenue proyectado
    adSpend = inputs.adSpendInput || 0;
    agendasTotales = cpb > 0 ? Math.floor(adSpend / cpb) : 0;
    agendasQueContestan = Math.floor(agendasTotales * ar);
    agendasConfirmadas = Math.floor(agendasQueContestan * confR);
    demosNecesarias = Math.floor(agendasConfirmadas * sr);
    clientesNecesarios = Math.floor(demosNecesarias * cr);
    revenue = clientesNecesarios * ticketPromedio;
  }

  const cpaCalc = clientesNecesarios > 0 ? adSpend / clientesNecesarios : 0;
  const settersNeeded = setterCapacity > 0 ? agendasTotales / setterCapacity : 0;
  const closersNeeded = closerCapacity > 0 ? demosNecesarias / closerCapacity : 0;
  const teamCost = (Math.ceil(settersNeeded) * setterMonthlyCost) + (Math.ceil(closersNeeded) * closerMonthlyCost);
  const cacCalc = clientesNecesarios > 0 ? (adSpend + teamCost) / clientesNecesarios : 0;
  const roasCalc = adSpend > 0 ? revenue / adSpend : 0;
  const cashCollected = revenue * ucPct;
  const contractedRevenue = revenue - cashCollected;

  // Tasa efectiva del funnel completo
  const funnelConversion = agendasTotales > 0 ? (clientesNecesarios / agendasTotales) * 100 : 0;

  return {
    clientesNecesarios,
    demosNecesarias,
    agendasConfirmadas,
    agendasQueContestan,
    agendasTotales,
    adSpendCalculated: Math.round(adSpend * 100) / 100,
    cpa: Math.round(cpaCalc * 100) / 100,
    cac: Math.round(cacCalc * 100) / 100,
    roas: Math.round(roasCalc * 100) / 100,
    cashCollected: Math.round(cashCollected * 100) / 100,
    contractedRevenue: Math.round(contractedRevenue * 100) / 100,
    revenueCalculated: Math.round(revenue * 100) / 100,
    settersNecesarios: Math.round(settersNeeded * 100) / 100,
    closersNecesarios: Math.round(closersNeeded * 100) / 100,
    presupuestoMensual: Math.round(adSpend * 100) / 100,
    presupuestoDiario: Math.round((adSpend / 30) * 100) / 100,
    teamCost: Math.round(teamCost * 100) / 100,
    funnelConversion: Math.round(funnelConversion * 100) / 100,
  };
}

// ==================== HELPER COMPONENTS ====================
function MetricInfo({ metric }: { metric: string }) {
  const b = BENCHMARKS[metric];
  if (!b) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs">{b.description}</p>
        <p className="text-xs mt-1 text-muted-foreground">
          Pobre: {b.inverse ? ">" : "<"}{b.poor}{b.unit} | Bueno: {b.inverse ? "<" : ">"}{b.good}{b.unit} | Excelente: {b.inverse ? "<" : ">"}{b.excellent}{b.unit}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function RateInput({ label, metric, value, onChange, suffix = "%", min = 0, max = 100, step = 0.5, description }: {
  label: string; metric: string; value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number; step?: number; description?: string;
}) {
  const bench = getBenchmarkLevel(metric, value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground flex items-center">
          {label}<MetricInfo metric={metric} />
        </Label>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${bench.color} border-current/30`}>{bench.level}</Badge>
      </div>
      {description && <p className="text-[10px] text-muted-foreground/70 -mt-0.5">{description}</p>}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className="h-9 text-sm font-medium"
        />
        <span className="text-xs text-muted-foreground w-4">{suffix}</span>
      </div>
    </div>
  );
}

function FunnelStep({ icon: Icon, label, value, rate, rateName, rateLabel, isLast, highlight }: {
  icon: any; label: string; value: number; rate?: number; rateName?: string; rateLabel?: string; isLast?: boolean; highlight?: boolean;
}) {
  const bench = rateName ? getBenchmarkLevel(rateName, rate || 0) : null;
  return (
    <div className="flex flex-col items-center">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border w-full ${highlight ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
        <Icon className={`h-5 w-5 shrink-0 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
            {typeof value === "number" ? value.toLocaleString("es-CL") : value}
          </p>
        </div>
      </div>
      {!isLast && rate !== undefined && (
        <div className="flex flex-col items-center py-1">
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
          <span className={`text-[10px] font-medium ${bench?.color || "text-muted-foreground"}`}>
            {rateLabel || `${rate}%`} {rateName && <MetricInfo metric={rateName} />}
          </span>
        </div>
      )}
    </div>
  );
}

function CostCard({ label, value, metric, prefix = "$" }: { label: string; value: number; metric?: string; prefix?: string }) {
  const bench = metric ? getBenchmarkLevel(metric, value) : null;
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground flex items-center">{label}{metric && <MetricInfo metric={metric} />}</span>
        {bench && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${bench.color} border-current/30`}>{bench.level}</Badge>}
      </div>
      <p className="text-xl font-bold">
        {prefix === "$" ? `$${value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${value.toFixed(1)}${prefix}`}
      </p>
    </div>
  );
}

// ==================== DEFAULT VALUES ====================
const DEFAULTS = {
  mode: "reverse" as "reverse" | "forward",
  revenueGoal: 65000,
  adSpendInput: 2000,
  ticketPromedio: 3300,
  upfrontCashPct: 60,
  closeRate: 25,
  showRate: 60,
  confirmationRate: 85,
  answerRate: 85,
  cpb: 15,
  setterCapacity: 100,
  closerCapacity: 80,
  setterMonthlyCost: 0,
  closerMonthlyCost: 0,
};

type CalcInputs = typeof DEFAULTS;

// ==================== MAIN COMPONENT ====================
export default function Calculadora() {
  const [mode, setMode] = useState<"reverse" | "forward">(DEFAULTS.mode);
  const [inputs, setInputs] = useState<CalcInputs>(DEFAULTS);
  const [scenarioName, setScenarioName] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");

  const scenariosQuery = trpc.calculator.list.useQuery();
  const saveMutation = trpc.calculator.save.useMutation({
    onSuccess: () => {
      toast.success("Escenario guardado");
      scenariosQuery.refetch();
      setScenarioName("");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMutation = trpc.calculator.delete.useMutation({
    onSuccess: () => {
      toast.success("Escenario eliminado");
      scenariosQuery.refetch();
      setSelectedScenarioId("");
    },
  });

  const updateInput = useCallback((key: string, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const results = useMemo(() => calculateFunnel({ ...inputs, mode }), [inputs, mode]);

  const handleReset = () => {
    setInputs(DEFAULTS);
    setMode("reverse");
  };

  const handleSave = () => {
    if (!scenarioName.trim()) {
      toast.error("Ingresa un nombre para el escenario");
      return;
    }
    saveMutation.mutate({
      name: scenarioName.trim(),
      mode,
      revenueGoal: mode === "reverse" ? inputs.revenueGoal : undefined,
      adSpendInput: mode === "forward" ? inputs.adSpendInput : undefined,
      ticketPromedio: inputs.ticketPromedio,
      upfrontCashPct: inputs.upfrontCashPct,
      closeRate: inputs.closeRate,
      showRate: inputs.showRate,
      confirmationRate: inputs.confirmationRate,
      answerRate: inputs.answerRate,
      bookingRate: 0,
      landingConvRate: 0,
      ctr: 0,
      cpm: inputs.cpb,
      setterCapacity: inputs.setterCapacity,
      closerCapacity: inputs.closerCapacity,
      setterMonthlyCost: inputs.setterMonthlyCost,
      closerMonthlyCost: inputs.closerMonthlyCost,
    });
  };

  const handleLoadScenario = (id: string) => {
    setSelectedScenarioId(id);
    const scenario = scenariosQuery.data?.find(s => s.id === parseInt(id));
    if (!scenario) return;
    setMode(scenario.mode as "reverse" | "forward");
    setInputs({
      mode: (scenario.mode as "reverse" | "forward"),
      revenueGoal: parseFloat(scenario.revenueGoal || "65000"),
      adSpendInput: parseFloat(scenario.adSpendInput || "2000"),
      ticketPromedio: parseFloat(scenario.ticketPromedio),
      upfrontCashPct: parseFloat(scenario.upfrontCashPct),
      closeRate: parseFloat(scenario.closeRate),
      showRate: parseFloat(scenario.showRate),
      confirmationRate: parseFloat(scenario.confirmationRate),
      answerRate: parseFloat(scenario.answerRate),
      cpb: parseFloat(scenario.cpm || "15"),
      setterCapacity: scenario.setterCapacity || 100,
      closerCapacity: scenario.closerCapacity || 80,
      setterMonthlyCost: parseFloat(scenario.setterMonthlyCost || "0"),
      closerMonthlyCost: parseFloat(scenario.closerMonthlyCost || "0"),
    });
    setScenarioName(scenario.name);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Calculadora de Revenue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Proyecta tu inversión y facturación mensual con el funnel de ventas de Sacamedi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Mode Selector + Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Modo de Cálculo</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "reverse" | "forward")}>
              <TabsList className="w-full">
                <TabsTrigger value="reverse" className="flex-1 text-xs">
                  <Target className="h-3.5 w-3.5 mr-1" /> Objetivo → Inversión
                </TabsTrigger>
                <TabsTrigger value="forward" className="flex-1 text-xs">
                  <DollarSign className="h-3.5 w-3.5 mr-1" /> Inversión → Revenue
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="mt-3">
              {mode === "reverse" ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Objetivo de Facturación Mensual</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">$</span>
                    <Input type="number" value={inputs.revenueGoal} onChange={(e) => updateInput("revenueGoal", parseFloat(e.target.value) || 0)} className="h-10 text-lg font-bold" />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Presupuesto Mensual de Ads</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">$</span>
                    <Input type="number" value={inputs.adSpendInput} onChange={(e) => updateInput("adSpendInput", parseFloat(e.target.value) || 0)} className="h-10 text-lg font-bold" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Escenarios Guardados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Select value={selectedScenarioId} onValueChange={handleLoadScenario}>
                <SelectTrigger className="h-9 text-xs flex-1">
                  <SelectValue placeholder="Cargar escenario..." />
                </SelectTrigger>
                <SelectContent>
                  {scenariosQuery.data?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name} ({s.mode === "reverse" ? "Obj" : "Inv"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedScenarioId && (
                <Button variant="outline" size="sm" className="h-9" onClick={() => deleteMutation.mutate({ id: parseInt(selectedScenarioId) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Nombre del escenario..." value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} className="h-9 text-xs" />
              <Button size="sm" className="h-9" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Inputs + Funnel + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Inputs */}
        <div className="lg:col-span-4 space-y-4">
          {/* Ads Input - CPB */}
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-yellow-400" /> Costo por Agendamiento (CPB)
              </CardTitle>
              <CardDescription className="text-xs">
                Lo que pagas en ads por cada cita agendada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RateInput
                label="CPB (Costo por Booking)"
                metric="cpb"
                value={inputs.cpb}
                onChange={(v) => updateInput("cpb", v)}
                suffix="$"
                min={0}
                max={500}
                step={0.5}
                description="Ideal: $10-15 | Máximo tolerable: $35-40"
              />
            </CardContent>
          </Card>

          {/* Revenue Inputs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-400" /> Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ticket Promedio</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs">$</span>
                  <Input type="number" value={inputs.ticketPromedio} onChange={(e) => updateInput("ticketPromedio", parseFloat(e.target.value) || 1)} className="h-9 text-sm font-medium" />
                </div>
              </div>
              <RateInput label="Upfront Cash %" metric="upfrontCashPct" value={inputs.upfrontCashPct} onChange={(v) => updateInput("upfrontCashPct", v)} description="% del revenue cobrado al momento del cierre" />
            </CardContent>
          </Card>

          {/* Sales Funnel Rates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-400" /> Tasas del Funnel de Ventas
              </CardTitle>
              <CardDescription className="text-xs">
                Ajusta cada tasa según tu operación real
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RateInput
                label="Answer Rate"
                metric="answerRate"
                value={inputs.answerRate}
                onChange={(v) => updateInput("answerRate", v)}
                description="% de agendas que CONTESTAN el teléfono al primer contacto"
              />
              <Separator />
              <RateInput
                label="Confirmation Rate"
                metric="confirmationRate"
                value={inputs.confirmationRate}
                onChange={(v) => updateInput("confirmationRate", v)}
                description="% de las que contestan que se CONFIRMAN como agenda real"
              />
              <Separator />
              <RateInput
                label="Show Rate"
                metric="showRate"
                value={inputs.showRate}
                onChange={(v) => updateInput("showRate", v)}
                description="% de agendas confirmadas que ASISTEN a la demo"
              />
              <Separator />
              <RateInput
                label="Close Rate"
                metric="closeRate"
                value={inputs.closeRate}
                onChange={(v) => updateInput("closeRate", v)}
                description="% de demos que se convierten en VENTA"
              />
            </CardContent>
          </Card>

          {/* Team Capacity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" /> Capacidad del Equipo
              </CardTitle>
              <CardDescription className="text-xs">Opcional: para calcular equipo necesario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Capacidad Setter (agendas/mes)</Label>
                <Input type="number" value={inputs.setterCapacity} onChange={(e) => updateInput("setterCapacity", parseInt(e.target.value) || 1)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Capacidad Closer (demos/mes)</Label>
                <Input type="number" value={inputs.closerCapacity} onChange={(e) => updateInput("closerCapacity", parseInt(e.target.value) || 1)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costo Mensual Setter</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs">$</span>
                  <Input type="number" value={inputs.setterMonthlyCost} onChange={(e) => updateInput("setterMonthlyCost", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Costo Mensual Closer</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs">$</span>
                  <Input type="number" value={inputs.closerMonthlyCost} onChange={(e) => updateInput("closerMonthlyCost", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CENTER: Funnel Visualization */}
        <div className="lg:col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Funnel Completo
              </CardTitle>
              <CardDescription className="text-xs">
                {mode === "reverse" ? "De objetivo de facturación a inversión requerida" : "De inversión a revenue proyectado"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0">
              {mode === "reverse" ? (
                <>
                  <FunnelStep icon={Banknote} label="Revenue Objetivo" value={inputs.revenueGoal} highlight />
                  <FunnelStep icon={Handshake} label="Clientes Necesarios" value={results.clientesNecesarios} rate={inputs.closeRate} rateName="closeRate" rateLabel={`${inputs.closeRate}% Close Rate`} />
                  <FunnelStep icon={Video} label="Demos (Shows)" value={results.demosNecesarias} rate={inputs.showRate} rateName="showRate" rateLabel={`${inputs.showRate}% Show Rate`} />
                  <FunnelStep icon={CalendarCheck} label="Agendas Confirmadas" value={results.agendasConfirmadas} rate={inputs.confirmationRate} rateName="confirmationRate" rateLabel={`${inputs.confirmationRate}% Confirmation Rate`} />
                  <FunnelStep icon={Phone} label="Agendas que Contestan" value={results.agendasQueContestan} rate={inputs.answerRate} rateName="answerRate" rateLabel={`${inputs.answerRate}% Answer Rate`} />
                  <FunnelStep icon={CalendarCheck} label="Agendas Totales" value={results.agendasTotales} rate={inputs.cpb} rateLabel={`$${inputs.cpb} CPB`} rateName="cpb" />
                  <FunnelStep icon={Megaphone} label="Inversión en Ads" value={results.adSpendCalculated} highlight isLast />
                </>
              ) : (
                <>
                  <FunnelStep icon={Megaphone} label="Inversión en Ads" value={inputs.adSpendInput} highlight />
                  <FunnelStep icon={CalendarCheck} label="Agendas Totales" value={results.agendasTotales} rate={inputs.cpb} rateLabel={`$${inputs.cpb} CPB`} rateName="cpb" />
                  <FunnelStep icon={Phone} label="Agendas que Contestan" value={results.agendasQueContestan} rate={inputs.answerRate} rateName="answerRate" rateLabel={`${inputs.answerRate}% Answer Rate`} />
                  <FunnelStep icon={CalendarCheck} label="Agendas Confirmadas" value={results.agendasConfirmadas} rate={inputs.confirmationRate} rateName="confirmationRate" rateLabel={`${inputs.confirmationRate}% Confirmation Rate`} />
                  <FunnelStep icon={Video} label="Demos (Shows)" value={results.demosNecesarias} rate={inputs.showRate} rateName="showRate" rateLabel={`${inputs.showRate}% Show Rate`} />
                  <FunnelStep icon={Handshake} label="Clientes" value={results.clientesNecesarios} rate={inputs.closeRate} rateName="closeRate" rateLabel={`${inputs.closeRate}% Close Rate`} />
                  <FunnelStep icon={Banknote} label="Revenue Proyectado" value={results.revenueCalculated} highlight isLast />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Results */}
        <div className="lg:col-span-4 space-y-4">
          {/* Key Result */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {mode === "reverse" ? "Inversión Requerida en Ads" : "Revenue Proyectado"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                ${mode === "reverse"
                  ? results.adSpendCalculated.toLocaleString("es-CL", { minimumFractionDigits: 2 })
                  : results.revenueCalculated.toLocaleString("es-CL", { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Diario: ${results.presupuestoDiario.toLocaleString("es-CL", { minimumFractionDigits: 2 })}</span>
                <span>Mensual: ${results.presupuestoMensual.toLocaleString("es-CL", { minimumFractionDigits: 2 })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-400" /> Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Facturación Total</span>
                <span className="text-sm font-bold">${results.revenueCalculated.toLocaleString("es-CL", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Cash Collected ({inputs.upfrontCashPct}%)</span>
                <span className="text-sm font-bold text-emerald-400">${results.cashCollected.toLocaleString("es-CL", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Contracted Revenue</span>
                <span className="text-sm font-bold text-yellow-400">${results.contractedRevenue.toLocaleString("es-CL", { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Conversión total del funnel</span>
                <span className="text-sm font-bold">{results.funnelConversion}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Cost Metrics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-red-400" /> Costos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <CostCard label="CPB" value={inputs.cpb} metric="cpb" />
              <CostCard label="CPA" value={results.cpa} metric="cpa" />
              <CostCard label="CAC (con equipo)" value={results.cac} />
              <CostCard label="Costo Equipo" value={results.teamCost} />
            </CardContent>
          </Card>

          {/* ROAS */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Retorno
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CostCard label="ROAS" value={results.roas} metric="roas" prefix="x" />
            </CardContent>
          </Card>

          {/* Team Requirements */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" /> Equipo Necesario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Setters</span>
                <span className="text-sm font-bold">{results.settersNecesarios} <span className="text-xs text-muted-foreground font-normal">({results.agendasTotales} agendas)</span></span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Closers</span>
                <span className="text-sm font-bold">{results.closersNecesarios} <span className="text-xs text-muted-foreground font-normal">({results.demosNecesarias} demos)</span></span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
