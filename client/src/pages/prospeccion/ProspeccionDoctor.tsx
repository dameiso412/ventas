/**
 * Prospección > Doctor — troubleshooting reactivo por KPI bajo umbral.
 *
 * Cada uno de los 5 KPIs (MSR, PRR, CSR, ABR, CAR) tiene un checklist de causas
 * probables derivado del doc 3 del Cold DM System. El setter marca las causas
 * que reviso, opcionalmente agrega notas, y envía → se persiste un review en
 * `prospecting_doctor_reviews` para audit trail y análisis posterior.
 *
 * UX:
 *   - Auto-selecciona tab desde `?metric=xxx` (navegación desde Tablero).
 *   - Si no hay param, auto-selecciona el KPI con peor gap vs umbral.
 *   - Header por tab muestra valor actual + umbral + badge semáforo.
 *   - History accordion al pie — últimos 20 reviews del setter seleccionado.
 *
 * Causas hard-coded (no viven en DB) — son los mismos items del doc, no están
 * sujetos a edición por usuario. Si en el futuro se quiere personalizar,
 * agregar tabla `prospectingDoctorCauses`.
 *
 * Gating: setterProcedure. Admin puede ver history de cualquier setter vía
 * dropdown; setter ve solo la suya.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Stethoscope, Save, TrendingDown, TrendingUp, Minus,
  Eye, MessageSquare, CalendarClock, CalendarCheck, UserPlus, History,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";

// ==================== Constants ====================

type MetricKey = "msr" | "prr" | "csr" | "abr" | "car";

type CauseItem = {
  id: string;
  label: string;
  description?: string;
};

const METRIC_META: Record<MetricKey, {
  label: string;
  icon: any;
  thresholdKey: string;
  shortDef: string;
  longDef: string;
}> = {
  msr: {
    label: "MSR — Message Seen Rate",
    icon: Eye,
    thresholdKey: "msr_min",
    shortDef: "MS / A",
    longDef: "Porcentaje de DMs que reciben ✓✓ azul. Mide visibilidad pura — si bajas aquí, tu DM nunca llega a ser leído.",
  },
  prr: {
    label: "PRR — Positive Reply Rate",
    icon: MessageSquare,
    thresholdKey: "prr_min",
    shortDef: "B / MS",
    longDef: "De los que leyeron tu DM, qué % respondió positivo (mostró interés, dio permiso). Mide calidad del Trojan Horse.",
  },
  csr: {
    label: "CSR — Calendly Sent Rate",
    icon: CalendarClock,
    thresholdKey: "csr_min",
    shortDef: "C / A",
    longDef: "Qué % de A (Initiated) terminan recibiendo un enlace Calendly. Mide la efectividad del VSL + permiso.",
  },
  abr: {
    label: "ABR — Appointment Booked Rate",
    icon: CalendarCheck,
    thresholdKey: "abr_min",
    shortDef: "D / A",
    longDef: "Qué % de A terminan agendando una cita. Mide el embudo completo — es la conversión final.",
  },
  car: {
    label: "CAR — Connection Accept Rate",
    icon: UserPlus,
    thresholdKey: "car_min",
    shortDef: "Aceptados / Enviados",
    longDef: "Qué % de tus follow-requests son aceptados. Mide calidad de niche + salud de tu cuenta IG.",
  },
};

/**
 * Causas hard-coded del doc 3 — "Doctor (DM)". Una lista por KPI. Las IDs son
 * las keys del jsonb en DB, pensadas para grep/análisis futuro.
 */
const CAUSES_BY_METRIC: Record<MetricKey, CauseItem[]> = {
  msr: [
    { id: "niche_uses_ig",       label: "¿Tu niche usa IG activamente?",
      description: "Profesiones/empresas con actividad real en IG — no están obligados a leer DMs." },
    { id: "lead_quality",        label: "Calidad de leads",
      description: "Perfiles recientes, activos, personales (no bot/inactive/business-only)." },
    { id: "account_health",      label: "Salud de cuenta",
      description: "¿Tu cuenta está warm? Friendship acceptance, límites de envío, historial spam-free." },
    { id: "ig_limitations",      label: "Limitaciones específicas de IG",
      description: "Shadow-ban, restricciones de mensajería, región bloqueada." },
    { id: "profile_setup",       label: "Setup del perfil",
      description: "Foto profesional, bio clara, lenguaje no-sales, autenticidad visible." },
  ],
  prr: [
    { id: "msr_above_min",       label: "MSR está en el mínimo",
      description: "Pre-requisito — si MSR está roto no vale la pena debugear PRR todavía." },
    { id: "trojan_video_quality", label: "Trojan Horse video",
      description: "Eye contact, confianza, entusiasmo, autenticidad. Re-grabar si hace falta." },
    { id: "trojan_script",       label: "Script del Trojan Horse",
      description: "Personalización real, yes/no question clara, permiso explícito, <20 segundos." },
  ],
  csr: [
    { id: "prr_above_min",       label: "PRR está en el mínimo",
      description: "Pre-requisito — si PRR está roto tu calendario no importa." },
    { id: "vsl_delivery",        label: "Calidad de delivery del VSL",
      description: "Autenticidad, claridad, ritmo. El VSL es lo que califica → Calendly." },
    { id: "vsl_content",         label: "Contenido del VSL",
      description: "Ofertas auditadas, risk reversal, especificidad, duración <2 min." },
  ],
  abr: [
    { id: "csr_above_min",       label: "CSR está en el mínimo",
      description: "Pre-requisito — sin Calendly enviado no hay cita posible." },
    { id: "calendly_setup",      label: "Calendly operativo",
      description: "Funcional, integra con tu calendario, avail. real <48h, zonas horarias OK." },
    { id: "followup_strategy",   label: "Estrategia de follow-up",
      description: "Timing (2 días), cadencia correcta, ángulos distintos por toque." },
  ],
  car: [
    { id: "niche_uses_ig",       label: "Tu niche usa IG",
      description: "Si tu niche no usa IG, las follow requests nunca serán aceptadas." },
    { id: "lead_quality_auth",   label: "Calidad de leads + autenticidad",
      description: "Perfiles personales activos, no business-only ni inactivos." },
    { id: "account_health",      label: "Salud de cuenta + warming",
      description: "Cuenta cálida, sin flags de spam, warmed de forma gradual." },
  ],
};

// ==================== Helpers ====================

type Semaforo = "verde" | "amarillo" | "rojo" | "gris";

function getSemaforo(value: number | null, threshold: number | null): Semaforo {
  if (value === null || threshold === null || threshold <= 0) return "gris";
  if (value >= threshold) return "verde";
  if (value >= threshold * 0.75) return "amarillo";
  return "rojo";
}

const SEMAFORO_STYLES: Record<Semaforo, { text: string; bg: string; border: string; label: string }> = {
  verde:    { text: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", label: "OK" },
  amarillo: { text: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   label: "Varianza" },
  rojo:     { text: "text-rose-500",    bg: "bg-rose-500/10",    border: "border-rose-500/30",    label: "Bajo umbral" },
  gris:     { text: "text-muted-foreground", bg: "bg-muted/30",  border: "border-border/30",      label: "Sin datos" },
};

function formatPercent(v: number | null): string {
  if (v === null) return "—";
  return `${v.toFixed(1)}%`;
}

function parseMetric(raw: string | null | undefined): MetricKey | null {
  if (!raw) return null;
  const low = raw.toLowerCase();
  if (["msr", "prr", "csr", "abr", "car"].includes(low)) return low as MetricKey;
  return null;
}

/**
 * Worst KPI selector — compute ratio (value / threshold) and pick the lowest.
 * Used when no `?metric=` param is present. Returns `msr` as default fallback.
 */
function pickWorstMetric(
  values: Record<MetricKey, number | null>,
  thresholds: Record<string, number>,
): MetricKey {
  let worst: MetricKey = "msr";
  let worstRatio = Infinity;
  for (const m of Object.keys(METRIC_META) as MetricKey[]) {
    const v = values[m];
    const t = thresholds[METRIC_META[m].thresholdKey];
    if (v === null || !t || t <= 0) continue;
    const ratio = v / t;
    if (ratio < worstRatio) { worst = m; worstRatio = ratio; }
  }
  return worst;
}

// ==================== Main page ====================

export default function ProspeccionDoctor() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const ownName = user?.name ?? "";
  const { setters } = useTeamMembers();
  const searchStr = useSearch();

  // URL param → metric
  const urlMetric = useMemo(() => {
    const params = new URLSearchParams(searchStr);
    return parseMetric(params.get("metric"));
  }, [searchStr]);

  // Setter to review for — admin picks, setter sees their own
  const [selectedSetter, setSelectedSetter] = useState<string>("");
  useEffect(() => {
    if (selectedSetter) return;
    if (isAdmin) {
      if (setters.length > 0) setSelectedSetter(setters[0]);
      else if (ownName) setSelectedSetter(ownName);
    } else if (ownName) {
      setSelectedSetter(ownName);
    }
  }, [isAdmin, ownName, setters, selectedSetter]);

  // Pull rolling-30d metrics for this setter (period where troubleshooting makes sense)
  const dateFrom = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const dateTo = useMemo(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  }, []);

  const { data: metrics, isLoading: metricsLoading } = trpc.prospecting.funnelMetrics.useQuery(
    { setter: selectedSetter || undefined, dateFrom, dateTo },
    { enabled: Boolean(selectedSetter) }
  );

  const { data: goals } = trpc.prospecting.listGoals.useQuery();

  const thresholdMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of goals ?? []) {
      const v = parseFloat(String(g.value));
      if (Number.isFinite(v)) map[g.key] = v;
    }
    return map;
  }, [goals]);

  const kpiValues: Record<MetricKey, number | null> = useMemo(() => ({
    msr: metrics?.msr ?? null,
    prr: metrics?.prr ?? null,
    csr: metrics?.csr ?? null,
    abr: metrics?.abr ?? null,
    car: metrics?.car ?? null,
  }), [metrics]);

  // Active tab — URL param wins, fallback to worst KPI, fallback to msr
  const [activeMetric, setActiveMetric] = useState<MetricKey>("msr");
  useEffect(() => {
    if (urlMetric) {
      setActiveMetric(urlMetric);
      return;
    }
    if (metrics && Object.keys(thresholdMap).length > 0) {
      setActiveMetric(pickWorstMetric(kpiValues, thresholdMap));
    }
  }, [urlMetric, metrics, thresholdMap, kpiValues]);

  // Per-metric form state — each tab has its own checks + notes.
  const [checksByMetric, setChecksByMetric] = useState<Record<MetricKey, Record<string, boolean>>>({
    msr: {}, prr: {}, csr: {}, abr: {}, car: {},
  });
  const [notesByMetric, setNotesByMetric] = useState<Record<MetricKey, string>>({
    msr: "", prr: "", csr: "", abr: "", car: "",
  });

  const utils = trpc.useUtils();
  const submitMutation = trpc.prospecting.doctor.submit.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Review de ${vars.metric.toUpperCase()} guardado`);
      // Reset this tab only
      setChecksByMetric((prev) => ({ ...prev, [vars.metric]: {} }));
      setNotesByMetric((prev) => ({ ...prev, [vars.metric]: "" }));
      utils.prospecting.doctor.history.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleSubmit = (metric: MetricKey) => {
    if (!selectedSetter) {
      toast.error("Selecciona un setter primero");
      return;
    }
    const checks = checksByMetric[metric];
    if (!checks || Object.values(checks).filter(Boolean).length === 0) {
      toast.error("Marca al menos una causa antes de guardar el review");
      return;
    }
    submitMutation.mutate({
      setterName: selectedSetter,
      metric,
      valueAtReview: kpiValues[metric],
      thresholdAtReview: thresholdMap[METRIC_META[metric].thresholdKey] ?? null,
      causesChecked: checks,
      notes: notesByMetric[metric] || undefined,
    });
  };

  // History
  const { data: history } = trpc.prospecting.doctor.history.useQuery(
    { setterName: selectedSetter || undefined, limit: 20 },
    { enabled: Boolean(selectedSetter) }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            Doctor — Troubleshooting
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cuando un KPI cae bajo umbral, diagnosticá la causa y dejá registro para que el equipo aprenda. Ventana: últimos 30 días.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Select value={selectedSetter} onValueChange={setSelectedSetter}>
              <SelectTrigger className="w-[200px] h-9 bg-card/50">
                <SelectValue placeholder="Setter..." />
              </SelectTrigger>
              <SelectContent>
                {setters.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                {ownName && !setters.includes(ownName) && (
                  <SelectItem value={ownName}>{ownName} (admin)</SelectItem>
                )}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline" className="h-9 px-3 text-sm border-primary/30">
              {selectedSetter || "Sin nombre"}
            </Badge>
          )}
        </div>
      </div>

      {!selectedSetter ? (
        <div className="text-sm text-muted-foreground bg-muted/20 border border-border/50 rounded-lg p-4">
          Tu usuario no tiene nombre de setter asignado. Pídele al admin que te añada al equipo en <code>/admin/equipo</code>.
        </div>
      ) : (
        <>
          <Tabs value={activeMetric} onValueChange={(v) => setActiveMetric(v as MetricKey)}>
            <TabsList className="grid w-full grid-cols-5">
              {(Object.keys(METRIC_META) as MetricKey[]).map((m) => {
                const meta = METRIC_META[m];
                const threshold = thresholdMap[meta.thresholdKey] ?? null;
                const sem = getSemaforo(kpiValues[m], threshold);
                const style = SEMAFORO_STYLES[sem];
                return (
                  <TabsTrigger key={m} value={m} className="flex-col gap-0.5 py-2 h-auto">
                    <div className="flex items-center gap-1.5">
                      <meta.icon className="h-3.5 w-3.5" />
                      <span className="font-semibold">{m.toUpperCase()}</span>
                    </div>
                    <span className={`text-[10px] ${style.text} tabular-nums`}>
                      {formatPercent(kpiValues[m])}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(Object.keys(METRIC_META) as MetricKey[]).map((m) => {
              const meta = METRIC_META[m];
              const Icon = meta.icon;
              const threshold = thresholdMap[meta.thresholdKey] ?? null;
              const value = kpiValues[m];
              const sem = getSemaforo(value, threshold);
              const style = SEMAFORO_STYLES[sem];
              const TrendIcon = sem === "verde" ? TrendingUp : sem === "rojo" ? TrendingDown : Minus;

              const causes = CAUSES_BY_METRIC[m];
              const checks = checksByMetric[m];
              const notes = notesByMetric[m];
              const checkedCount = Object.values(checks).filter(Boolean).length;

              return (
                <TabsContent key={m} value={m} className="space-y-5 mt-5">
                  {/* Metric summary card */}
                  <Card className={`bg-card/50 ${style.border} border`}>
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${style.bg}`}>
                            <Icon className={`h-5 w-5 ${style.text}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-lg font-bold">{meta.label}</h2>
                              <Badge variant="outline" className={`text-[10px] ${style.bg} ${style.border} ${style.text}`}>
                                <TrendIcon className="h-3 w-3 mr-1" />
                                {style.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xl">{meta.longDef}</p>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-3 shrink-0">
                          <div className="text-right">
                            <div className={`text-3xl font-bold tabular-nums ${style.text}`}>
                              {metricsLoading ? "—" : formatPercent(value)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">actual · {meta.shortDef}</div>
                          </div>
                          <div className="h-10 w-px bg-border/60" />
                          <div className="text-right">
                            <div className="text-2xl font-bold tabular-nums text-muted-foreground">
                              {threshold !== null ? `${threshold}%` : "—"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">umbral mínimo</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Causes checklist */}
                  <Card className="bg-card/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>Causas probables (doc 3)</span>
                        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                          {checkedCount}/{causes.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {causes.map((c) => (
                        <label
                          key={c.id}
                          htmlFor={`${m}-${c.id}`}
                          className="flex items-start gap-3 p-3 rounded-md border border-border/40 bg-card/30 hover:bg-muted/20 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            id={`${m}-${c.id}`}
                            checked={!!checks[c.id]}
                            onCheckedChange={(v) =>
                              setChecksByMetric((prev) => ({
                                ...prev,
                                [m]: { ...prev[m], [c.id]: Boolean(v) },
                              }))
                            }
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{c.label}</div>
                            {c.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>
                            )}
                          </div>
                        </label>
                      ))}

                      {/* Notes */}
                      <div className="pt-3 space-y-2">
                        <label htmlFor={`${m}-notes`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Notas del review (opcional)
                        </label>
                        <Textarea
                          id={`${m}-notes`}
                          placeholder="Ej: 'Cambié de niche hace 3 días, todavía en fase de warming'. O qué acción correctiva vas a tomar."
                          value={notes}
                          onChange={(e) =>
                            setNotesByMetric((prev) => ({ ...prev, [m]: e.target.value }))
                          }
                          className="min-h-[72px] bg-card/50"
                        />
                      </div>

                      {/* Submit */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="text-xs text-muted-foreground">
                          {checkedCount === 0
                            ? "Marca al menos una causa para guardar"
                            : `${checkedCount} causa${checkedCount > 1 ? "s" : ""} seleccionada${checkedCount > 1 ? "s" : ""}`}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSubmit(m)}
                          disabled={checkedCount === 0 || submitMutation.isPending}
                          className="gap-1.5"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Guardar review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>

          {/* History accordion */}
          <Card className="bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Historial de reviews · {selectedSetter}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!history ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : history.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Sin reviews previos. El primero que guardes aparecerá acá.
                </div>
              ) : (
                <Accordion type="single" collapsible className="px-2">
                  {history.map((r) => {
                    const causes = (r.causesChecked ?? {}) as Record<string, boolean>;
                    const tickedIds = Object.entries(causes).filter(([, v]) => v).map(([k]) => k);
                    const metric = r.metric as MetricKey;
                    const meta = METRIC_META[metric];
                    const val = r.valueAtReview === null ? null : parseFloat(String(r.valueAtReview));
                    const thr = r.thresholdAtReview === null ? null : parseFloat(String(r.thresholdAtReview));
                    const sem = getSemaforo(val, thr);
                    const style = SEMAFORO_STYLES[sem];
                    return (
                      <AccordionItem key={r.id} value={`r-${r.id}`} className="border-b border-border/30">
                        <AccordionTrigger className="hover:no-underline px-2 py-3">
                          <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${style.bg} ${style.border} ${style.text}`}>
                              {metric.toUpperCase()}
                            </Badge>
                            <span className={`text-xs font-mono tabular-nums ${style.text}`}>
                              {formatPercent(val)} / {thr !== null ? `${thr}%` : "—"}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(r.reviewedAt), "d MMM yyyy · HH:mm", { locale: es })}
                            </span>
                            <span className="text-xs text-muted-foreground truncate flex-1">
                              · {tickedIds.length} causa{tickedIds.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3 space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {meta?.label}
                          </div>
                          <ul className="space-y-1">
                            {(meta ? meta.thresholdKey : null) && CAUSES_BY_METRIC[metric].map((c) => {
                              const isTicked = !!causes[c.id];
                              return (
                                <li
                                  key={c.id}
                                  className={`text-xs flex items-center gap-2 ${isTicked ? "text-foreground" : "text-muted-foreground/60 line-through"}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${isTicked ? "bg-primary" : "bg-muted-foreground/30"}`} />
                                  {c.label}
                                </li>
                              );
                            })}
                          </ul>
                          {r.notes && (
                            <div className="mt-2 p-2 rounded bg-muted/30 border border-border/30 text-xs text-foreground/90 whitespace-pre-wrap">
                              {r.notes}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
