/**
 * Prospección > Rutina — reemplaza el doc 5 "Daily Workflow (DM)" con un
 * flujo interactivo que el setter abre 2× al día:
 *
 *   AM (inicio turno):
 *     - Checklist: revisar tablero, mover C→D, descartar, enviar Calendly,
 *       VSL, follow-ups a Initiated.
 *     - Inputs: follows enviados/aceptados, DMs Trojan Horse, likes, coments.
 *
 *   PM (cierre turno):
 *     - Checklist: revisar tablero del día, follow-ups cada 2 días, mover leads.
 *     - Inputs: mensajes vistos (MS), respuestas positivas (B), Calendly
 *       enviados (C), citas reservadas (D).
 *
 * Persistencia:
 *   - Checkboxes → localStorage keyed (setter, fecha, slot). Reset automático
 *     al cambiar día → cada día arranca con checklist en blanco.
 *   - Inputs numéricos → server vía `trpc.setterActivities.upsert` con
 *     merge por (fecha, setter) — AM y PM nunca se pisan.
 *
 * Gating: setterProcedure (admin + setter). Admin puede elegir cualquier setter
 * desde un dropdown; setter solo ve su propio name del user.name.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, CalendarIcon, Save, CheckCircle2, Circle, ClipboardList, UserPlus, Heart, MessageCircle, Send, Eye, MessageSquare, CalendarClock, CalendarCheck } from "lucide-react";
import { format, isToday, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { MESES, getSemanaFromDate } from "@shared/period";

// ==================== Checklist definitions (from doc 5) ====================

type ChecklistItem = {
  id: string;
  label: string;
  description?: string;
};

const AM_CHECKLIST: ChecklistItem[] = [
  { id: "am_review_tablero", label: "Revisar Tablero de ayer",
    description: "Ver qué KPIs quedaron en rojo y qué prospectos avanzaron." },
  { id: "am_move_c_to_d", label: "Actualizar prospectos C → D",
    description: "Los que agendaron desde el Calendly enviado ayer." },
  { id: "am_discard_cold", label: "Marcar desinteresados → DESCARTADO",
    description: "No-shows o rechazos explícitos." },
  { id: "am_send_calendly", label: "Enviar Calendly a interesados de ayer",
    description: "Los que quedaron en B (CALIFICADO) sin Calendly todavía." },
  { id: "am_share_vsl", label: "Compartir VSL a quienes levantaron mano",
    description: "Antes del Calendly — el VSL califica." },
  { id: "am_followup_initiated", label: "Follow-ups a Initiated sin respuesta >3 días",
    description: "Segundo toque con ángulo distinto." },
];

const PM_CHECKLIST: ChecklistItem[] = [
  { id: "pm_review_tablero", label: "Revisar Tablero del día",
    description: "¿Cumplí el mínimo diario? ¿Algún KPI cayó bajo umbral?" },
  { id: "pm_followup_interested", label: "Follow-ups cada 2 días a interesados",
    description: "B que no respondieron al Calendly." },
  { id: "pm_move_leads", label: "Mover leads al siguiente estado del funnel",
    description: "Ajustar el igFunnelStage manualmente si ManyChat no disparó la tag." },
];

// ==================== Local storage checklist state ====================

function checklistKey(setter: string, fecha: Date, slot: "am" | "pm"): string {
  const dateStr = format(fecha, "yyyy-MM-dd");
  return `prospeccion:rutina:${setter}:${dateStr}:${slot}`;
}

function loadChecklist(setter: string, fecha: Date, slot: "am" | "pm"): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(checklistKey(setter, fecha, slot));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveChecklist(setter: string, fecha: Date, slot: "am" | "pm", state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(checklistKey(setter, fecha, slot), JSON.stringify(state));
  } catch { /* quota exceeded — ignore, it's just a nudge */ }
}

// ==================== Form state ====================

type AmFields = {
  igFollowsEnviados: number;
  igFollowsAceptados: number;
  igConversacionesIniciadas: number; // DMs Trojan Horse = A
  igLikesEnviados: number;
  igComentariosEnviados: number;
};

type PmFields = {
  igMensajesVistos: number;    // MS
  igCalificados: number;       // B (positive reply)
  igAgendasEnviadas: number;   // C
  igAgendasReservadas: number; // D
};

const EMPTY_AM: AmFields = {
  igFollowsEnviados: 0, igFollowsAceptados: 0,
  igConversacionesIniciadas: 0, igLikesEnviados: 0, igComentariosEnviados: 0,
};
const EMPTY_PM: PmFields = {
  igMensajesVistos: 0, igCalificados: 0, igAgendasEnviadas: 0, igAgendasReservadas: 0,
};

// ==================== Main page ====================

export default function ProspeccionRutina() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const ownName = user?.name ?? "";
  const { setters } = useTeamMembers();

  // Setter selector — setters ven su propio name, admin puede elegir cualquiera
  const [selectedSetter, setSelectedSetter] = useState<string>("");
  useEffect(() => {
    if (selectedSetter) return;
    if (isAdmin) {
      // Admin prefiere un setter real del equipo si existe, sino su propio nombre
      if (setters.length > 0) setSelectedSetter(setters[0]);
      else if (ownName) setSelectedSetter(ownName);
    } else if (ownName) {
      setSelectedSetter(ownName);
    }
  }, [isAdmin, ownName, setters, selectedSetter]);

  // Fecha — default hoy, admin/setter puede elegir otra
  const [fecha, setFecha] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [fechaOpen, setFechaOpen] = useState(false);

  // Form state
  const [am, setAm] = useState<AmFields>(EMPTY_AM);
  const [pm, setPm] = useState<PmFields>(EMPTY_PM);
  const [amDirty, setAmDirty] = useState(false);
  const [pmDirty, setPmDirty] = useState(false);

  // Checklist state (localStorage-backed)
  const [amChecks, setAmChecks] = useState<Record<string, boolean>>({});
  const [pmChecks, setPmChecks] = useState<Record<string, boolean>>({});

  // Fetch current row
  const byDateInput = useMemo(() => ({
    setter: selectedSetter, fecha,
  }), [selectedSetter, fecha]);

  const { data: existing, isLoading, refetch } = trpc.setterActivities.byDate.useQuery(
    byDateInput,
    { enabled: Boolean(selectedSetter) }
  );

  // Hydrate form from DB whenever the (setter, fecha) changes
  useEffect(() => {
    if (!selectedSetter) return;
    setAm({
      igFollowsEnviados:        existing?.igFollowsEnviados ?? 0,
      igFollowsAceptados:       existing?.igFollowsAceptados ?? 0,
      igConversacionesIniciadas: existing?.igConversacionesIniciadas ?? 0,
      igLikesEnviados:          existing?.igLikesEnviados ?? 0,
      igComentariosEnviados:    existing?.igComentariosEnviados ?? 0,
    });
    setPm({
      igMensajesVistos:    existing?.igMensajesVistos ?? 0,
      igCalificados:       existing?.igCalificados ?? 0,
      igAgendasEnviadas:   existing?.igAgendasEnviadas ?? 0,
      igAgendasReservadas: existing?.igAgendasReservadas ?? 0,
    });
    setAmDirty(false);
    setPmDirty(false);
    // Load checklist from localStorage — keyed to (setter, fecha)
    setAmChecks(loadChecklist(selectedSetter, fecha, "am"));
    setPmChecks(loadChecklist(selectedSetter, fecha, "pm"));
  }, [existing, selectedSetter, fecha]);

  // Persist checklist changes
  useEffect(() => {
    if (selectedSetter) saveChecklist(selectedSetter, fecha, "am", amChecks);
  }, [amChecks, selectedSetter, fecha]);
  useEffect(() => {
    if (selectedSetter) saveChecklist(selectedSetter, fecha, "pm", pmChecks);
  }, [pmChecks, selectedSetter, fecha]);

  // Upsert mutation
  const utils = trpc.useUtils();
  const upsertMutation = trpc.setterActivities.upsert.useMutation({
    onSuccess: () => {
      utils.setterActivities.byDate.invalidate(byDateInput);
      utils.prospecting.funnelMetrics.invalidate();
    },
  });

  const saveSlot = useCallback(async (slot: "am" | "pm") => {
    if (!selectedSetter) {
      toast.error("Selecciona un setter primero.");
      return;
    }
    const fieldsForSlot = slot === "am" ? am : pm;
    const payload = {
      setter: selectedSetter,
      fecha,
      mes: MESES[fecha.getMonth()],
      semana: getSemanaFromDate(fecha),
      ...fieldsForSlot,
    };
    try {
      await upsertMutation.mutateAsync(payload as any);
      toast.success(`Rutina ${slot.toUpperCase()} guardada`);
      if (slot === "am") setAmDirty(false); else setPmDirty(false);
      refetch();
    } catch (err: any) {
      toast.error(`Error guardando: ${err?.message ?? "desconocido"}`);
    }
  }, [selectedSetter, fecha, am, pm, upsertMutation, refetch]);

  // Helpers
  const amCheckedCount = Object.values(amChecks).filter(Boolean).length;
  const pmCheckedCount = Object.values(pmChecks).filter(Boolean).length;
  const totalAm = AM_CHECKLIST.length;
  const totalPm = PM_CHECKLIST.length;

  const isToday_ = isToday(fecha);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Rutina diaria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inicio (AM) y cierre (PM) del turno. Los inputs se guardan por slot, no se pisan entre ellos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={fechaOpen} onOpenChange={setFechaOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(fecha, "d 'de' MMMM yyyy", { locale: es })}
                {isToday_ && <Badge variant="outline" className="ml-1 text-[10px] border-primary/40 text-primary">Hoy</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={fecha}
                onSelect={(d) => {
                  if (d) {
                    const day = new Date(d); day.setHours(0, 0, 0, 0);
                    setFecha(day);
                    setFechaOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
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
              {selectedSetter || "Sin nombre de setter"}
            </Badge>
          )}
        </div>
      </div>

      {!selectedSetter ? (
        <div className="text-sm text-muted-foreground bg-muted/20 border border-border/50 rounded-lg p-4">
          Tu usuario no tiene nombre de setter asignado. Pídele al admin que te añada al equipo en <code>/admin/equipo</code>.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ==================== AM CARD ==================== */}
          <Card className="bg-card/50 border-amber-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sun className="h-5 w-5 text-amber-500" />
                  AM — Inicio de turno
                </CardTitle>
                <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-xs">
                  {amCheckedCount}/{totalAm}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Enfoque: follow-up de ayer + arranque de outreach de hoy.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Checklist */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Checklist
                </p>
                <div className="space-y-2">
                  {AM_CHECKLIST.map((item) => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      checked={!!amChecks[item.id]}
                      onChange={(v) => setAmChecks((prev) => ({ ...prev, [item.id]: v }))}
                    />
                  ))}
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actividad de hoy
                </p>
                <InputRow
                  icon={UserPlus}
                  label="Follows enviados"
                  hint="Follow-requests nuevos hoy"
                  value={am.igFollowsEnviados}
                  onChange={(v) => { setAm({ ...am, igFollowsEnviados: v }); setAmDirty(true); }}
                />
                <InputRow
                  icon={UserPlus}
                  label="Follows aceptados"
                  hint="Aceptaciones recibidas hoy (contribuyen al CAR)"
                  value={am.igFollowsAceptados}
                  onChange={(v) => { setAm({ ...am, igFollowsAceptados: v }); setAmDirty(true); }}
                />
                <InputRow
                  icon={Send}
                  label="DMs Trojan Horse enviados (A)"
                  hint="Mensajes iniciadores del Cold DM System"
                  value={am.igConversacionesIniciadas}
                  onChange={(v) => { setAm({ ...am, igConversacionesIniciadas: v }); setAmDirty(true); }}
                />
                <InputRow
                  icon={Heart}
                  label="Likes enviados"
                  value={am.igLikesEnviados}
                  onChange={(v) => { setAm({ ...am, igLikesEnviados: v }); setAmDirty(true); }}
                />
                <InputRow
                  icon={MessageCircle}
                  label="Comentarios"
                  value={am.igComentariosEnviados}
                  onChange={(v) => { setAm({ ...am, igComentariosEnviados: v }); setAmDirty(true); }}
                />
              </div>

              {/* Save */}
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground">
                  {amDirty ? "Cambios sin guardar" : isLoading ? "Cargando…" : "Al día"}
                </div>
                <Button
                  size="sm"
                  onClick={() => saveSlot("am")}
                  disabled={!amDirty || upsertMutation.isPending}
                  className="gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  Guardar AM
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ==================== PM CARD ==================== */}
          <Card className="bg-card/50 border-indigo-500/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Moon className="h-5 w-5 text-indigo-400" />
                  PM — Cierre de turno
                </CardTitle>
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-400 text-xs">
                  {pmCheckedCount}/{totalPm}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Enfoque: cerrar conteo del día y dejar pipeline listo para mañana.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Checklist */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Checklist
                </p>
                <div className="space-y-2">
                  {PM_CHECKLIST.map((item) => (
                    <ChecklistRow
                      key={item.id}
                      item={item}
                      checked={!!pmChecks[item.id]}
                      onChange={(v) => setPmChecks((prev) => ({ ...prev, [item.id]: v }))}
                    />
                  ))}
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Conteo del día
                </p>
                <InputRow
                  icon={Eye}
                  label="Mensajes vistos (MS)"
                  hint="Cuenta las ✓✓ azules de los DMs de hoy"
                  value={pm.igMensajesVistos}
                  onChange={(v) => { setPm({ ...pm, igMensajesVistos: v }); setPmDirty(true); }}
                />
                <InputRow
                  icon={MessageSquare}
                  label="Respuestas positivas (B)"
                  hint="Prospectos que dieron 'sí' al permission message"
                  value={pm.igCalificados}
                  onChange={(v) => { setPm({ ...pm, igCalificados: v }); setPmDirty(true); }}
                />
                <InputRow
                  icon={CalendarClock}
                  label="Calendly enviados (C)"
                  value={pm.igAgendasEnviadas}
                  onChange={(v) => { setPm({ ...pm, igAgendasEnviadas: v }); setPmDirty(true); }}
                />
                <InputRow
                  icon={CalendarCheck}
                  label="Citas reservadas (D)"
                  value={pm.igAgendasReservadas}
                  onChange={(v) => { setPm({ ...pm, igAgendasReservadas: v }); setPmDirty(true); }}
                />
              </div>

              {/* Save */}
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground">
                  {pmDirty ? "Cambios sin guardar" : isLoading ? "Cargando…" : "Al día"}
                </div>
                <Button
                  size="sm"
                  onClick={() => saveSlot("pm")}
                  disabled={!pmDirty || upsertMutation.isPending}
                  className="gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  Guardar PM
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer nudge */}
      {!isSameDay(fecha, new Date()) && (
        <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          Estás editando <strong>{format(fecha, "d 'de' MMMM yyyy", { locale: es })}</strong>, no hoy.
          Los checkboxes se guardan por día, pero si este es un día pasado estás completando data histórica.
        </div>
      )}
    </div>
  );
}

// ==================== Subcomponents ====================

function ChecklistRow({
  item, checked, onChange,
}: {
  item: ChecklistItem;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/30 cursor-pointer transition-colors">
      <div className="pt-0.5">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onChange(!!v)}
          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-tight ${checked ? "line-through text-muted-foreground" : ""}`}>
          {checked ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-500" />
              {item.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Circle className="inline h-3.5 w-3.5 text-muted-foreground/50" />
              {item.label}
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.description}</p>
        )}
      </div>
    </label>
  );
}

function InputRow({
  icon: Icon, label, hint, value, onChange,
}: {
  icon: any;
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const inputId = `input-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <Label htmlFor={inputId} className="text-sm font-medium leading-tight block">
          {label}
        </Label>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
      </div>
      <Input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onChange(Number.isFinite(v) && v >= 0 ? v : 0);
        }}
        onFocus={(e) => e.target.select()}
        className="w-20 h-9 text-center font-semibold tabular-nums"
      />
    </div>
  );
}
