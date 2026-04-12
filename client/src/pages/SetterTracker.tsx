import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { useState, useMemo } from "react";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, CalendarIcon, Users } from "lucide-react";
import { toast } from "sonner";
import { useStatusColors } from "@/hooks/useStatusColors";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function MetricCard({ title, value, subtitle, color }: { title: string; value: string | number; subtitle?: string; color?: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
      <p className="text-xl font-bold mt-1" style={color ? { color } : {}}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function getMesFromDate(d: Date): string {
  return MESES[d.getMonth()];
}

function getSemanaFromDate(d: Date): number {
  return Math.ceil(d.getDate() / 7);
}

const emptyForm = {
  setter: "",
  intentosLlamada: 0, introsEfectivas: 0, demosAseguradasConIntro: 0,
  demosEnCalendario: 0, demosConfirmadas: 0, demosAsistidas: 0,
  cierresAtribuidos: 0, revenueAtribuido: "0", cashAtribuido: "0", notas: "",
  // Intro fields
  introAgendadas: 0, introLive: 0, introADemo: 0,
};

export default function SetterTracker() {
  const [mes, setMes] = useState<string>("all");
  const [semana, setSemana] = useState<string>("all");
  const [setter, setSetter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [newActivity, setNewActivity] = useState(emptyForm);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newDateOpen, setNewDateOpen] = useState(false);
  const [editDateOpen, setEditDateOpen] = useState(false);
  // Conditional intro toggle for create and edit
  const [newHasIntros, setNewHasIntros] = useState(false);
  const [editHasIntros, setEditHasIntros] = useState(false);
  const sc = useStatusColors();

  const filters = useMemo(() => ({
    setter: setter !== "all" ? setter : undefined,
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
  }), [setter, mes, semana]);

  const { data: activities, isLoading } = trpc.setterActivities.list.useQuery(filters);
  const utils = trpc.useUtils();

  // Check if any activity in the current filtered period has intro data
  const hasIntroData = useMemo(() => {
    if (!activities) return false;
    return activities.some(a => (a.introAgendadas || 0) > 0 || (a.introLive || 0) > 0 || (a.introADemo || 0) > 0);
  }, [activities]);

  const createMutation = trpc.setterActivities.create.useMutation({
    onSuccess: () => {
      utils.setterActivities.list.invalidate();
      toast.success("Actividad registrada");
      setShowAdd(false);
      setNewActivity(emptyForm);
      setNewDate(new Date());
      setNewHasIntros(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.setterActivities.update.useMutation({
    onSuccess: () => {
      utils.setterActivities.list.invalidate();
      utils.dashboard.trackerKPIs.invalidate();
      toast.success("Registro actualizado");
      setEditingId(null);
      setEditHasIntros(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.setterActivities.delete.useMutation({
    onSuccess: () => { utils.setterActivities.list.invalidate(); utils.dashboard.trackerKPIs.invalidate(); toast.success("Registro eliminado"); },
  });

  const bulkDeleteMutation = trpc.setterActivities.bulkDelete.useMutation({
    onSuccess: (res) => { utils.setterActivities.list.invalidate(); utils.dashboard.trackerKPIs.invalidate(); bulk.clear(); toast.success(`${res.count} registro(s) eliminados`); },
    onError: (err) => toast.error(err.message),
  });

  const bulk = useBulkSelection(activities);

  // Aggregated metrics
  const totals = useMemo(() => {
    if (!activities || activities.length === 0) return null;
    return activities.reduce((acc, a) => ({
      intentos: acc.intentos + (a.intentosLlamada || 0),
      intros: acc.intros + (a.introsEfectivas || 0),
      aseguradas: acc.aseguradas + (a.demosAseguradasConIntro || 0),
      calendario: acc.calendario + (a.demosEnCalendario || 0),
      confirmadas: acc.confirmadas + (a.demosConfirmadas || 0),
      asistidas: acc.asistidas + (a.demosAsistidas || 0),
      cierres: acc.cierres + (a.cierresAtribuidos || 0),
      revenue: acc.revenue + Number(a.revenueAtribuido || 0),
      cash: acc.cash + Number(a.cashAtribuido || 0),
      introAgendadas: acc.introAgendadas + (a.introAgendadas || 0),
      introLive: acc.introLive + (a.introLive || 0),
      introADemo: acc.introADemo + (a.introADemo || 0),
    }), { intentos: 0, intros: 0, aseguradas: 0, calendario: 0, confirmadas: 0, asistidas: 0, cierres: 0, revenue: 0, cash: 0, introAgendadas: 0, introLive: 0, introADemo: 0 });
  }, [activities]);

  const tasaRespuesta = totals && totals.intentos > 0 ? ((totals.intros / totals.intentos) * 100).toFixed(1) : "0";
  const tasaConfirmacion = totals && totals.intros > 0 ? ((totals.aseguradas / totals.intros) * 100).toFixed(1) : "0";
  const tasaAsistencia = totals && totals.calendario > 0 ? ((totals.asistidas / totals.calendario) * 100).toFixed(1) : "0";

  // Intro rates
  const introShowRate = totals && totals.introAgendadas > 0 ? ((totals.introLive / totals.introAgendadas) * 100).toFixed(1) : "0";
  const introDemoRate = totals && totals.introLive > 0 ? ((totals.introADemo / totals.introLive) * 100).toFixed(1) : "0";

  const handleCreate = () => {
    const data = {
      ...newActivity,
      fecha: newDate,
      mes: getMesFromDate(newDate),
      semana: getSemanaFromDate(newDate),
    };
    // If no intros, zero out intro fields
    if (!newHasIntros) {
      data.introAgendadas = 0;
      data.introLive = 0;
      data.introADemo = 0;
    }
    createMutation.mutate(data);
  };

  const startEdit = (a: any) => {
    setEditingId(a.id);
    setEditDate(new Date(a.fecha));
    const hasIntro = (a.introAgendadas || 0) > 0 || (a.introLive || 0) > 0 || (a.introADemo || 0) > 0;
    setEditHasIntros(hasIntro);
    setEditForm({
      setter: a.setter || "",
      intentosLlamada: a.intentosLlamada || 0,
      introsEfectivas: a.introsEfectivas || 0,
      demosAseguradasConIntro: a.demosAseguradasConIntro || 0,
      demosEnCalendario: a.demosEnCalendario || 0,
      demosConfirmadas: a.demosConfirmadas || 0,
      demosAsistidas: a.demosAsistidas || 0,
      cierresAtribuidos: a.cierresAtribuidos || 0,
      revenueAtribuido: String(a.revenueAtribuido || "0"),
      cashAtribuido: String(a.cashAtribuido || "0"),
      notas: a.notas || "",
      introAgendadas: a.introAgendadas || 0,
      introLive: a.introLive || 0,
      introADemo: a.introADemo || 0,
    });
  };

  const handleUpdate = () => {
    if (editingId === null) return;
    const data: any = {
      fecha: editDate,
      mes: getMesFromDate(editDate),
      semana: getSemanaFromDate(editDate),
      setter: editForm.setter,
      intentosLlamada: editForm.intentosLlamada,
      introsEfectivas: editForm.introsEfectivas,
      demosAseguradasConIntro: editForm.demosAseguradasConIntro,
      demosEnCalendario: editForm.demosEnCalendario,
      demosConfirmadas: editForm.demosConfirmadas,
      demosAsistidas: editForm.demosAsistidas,
      cierresAtribuidos: editForm.cierresAtribuidos,
      revenueAtribuido: editForm.revenueAtribuido,
      cashAtribuido: editForm.cashAtribuido,
      notas: editForm.notas,
      introAgendadas: editHasIntros ? editForm.introAgendadas : 0,
      introLive: editHasIntros ? editForm.introLive : 0,
      introADemo: editHasIntros ? editForm.introADemo : 0,
    };
    updateMutation.mutate({ id: editingId, data });
  };

  const DatePicker = ({ date, onSelect, open, onOpenChange }: { date: Date; onSelect: (d: Date) => void; open: boolean; onOpenChange: (o: boolean) => void }) => (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left font-normal gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {format(date, "dd 'de' MMMM, yyyy", { locale: es })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { if (d) { onSelect(d); onOpenChange(false); } }}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  );

  const renderForm = (
    form: typeof emptyForm,
    setForm: (fn: (p: typeof emptyForm) => typeof emptyForm) => void,
    date: Date,
    onDateSelect: (d: Date) => void,
    dateOpen: boolean,
    onDateOpenChange: (o: boolean) => void,
    onSubmit: () => void,
    isPending: boolean,
    submitLabel: string,
    hasIntros: boolean,
    setHasIntros: (v: boolean) => void,
  ) => (
    <div className="space-y-3 mt-2">
      <div>
        <Label className="text-xs font-medium">Fecha</Label>
        <DatePicker date={date} onSelect={onDateSelect} open={dateOpen} onOpenChange={onDateOpenChange} />
        <p className="text-xs text-muted-foreground mt-1">
          {getMesFromDate(date)} — Semana {getSemanaFromDate(date)}
        </p>
      </div>
      <div>
        <Label className="text-xs">Setter</Label>
        <TeamMemberSelect value={form.setter} onValueChange={v => setForm(p => ({ ...p, setter: v }))} role="SETTER" placeholder="Seleccionar setter" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Intentos Llamada</Label><Input type="number" min={0} value={form.intentosLlamada} onChange={e => setForm(p => ({ ...p, intentosLlamada: parseInt(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Intros Efectivas</Label><Input type="number" min={0} value={form.introsEfectivas} onChange={e => setForm(p => ({ ...p, introsEfectivas: parseInt(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Demos Aseguradas</Label><Input type="number" min={0} value={form.demosAseguradasConIntro} onChange={e => setForm(p => ({ ...p, demosAseguradasConIntro: parseInt(e.target.value) || 0 }))} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">En Calendario</Label><Input type="number" min={0} value={form.demosEnCalendario} onChange={e => setForm(p => ({ ...p, demosEnCalendario: parseInt(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Confirmadas</Label><Input type="number" min={0} value={form.demosConfirmadas} onChange={e => setForm(p => ({ ...p, demosConfirmadas: parseInt(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Asistidas</Label><Input type="number" min={0} value={form.demosAsistidas} onChange={e => setForm(p => ({ ...p, demosAsistidas: parseInt(e.target.value) || 0 }))} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Cierres Atribuidos</Label><Input type="number" min={0} value={form.cierresAtribuidos} onChange={e => setForm(p => ({ ...p, cierresAtribuidos: parseInt(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Revenue ($)</Label><Input type="number" value={form.revenueAtribuido} onChange={e => setForm(p => ({ ...p, revenueAtribuido: e.target.value }))} /></div>
        <div><Label className="text-xs">Cash ($)</Label><Input type="number" value={form.cashAtribuido} onChange={e => setForm(p => ({ ...p, cashAtribuido: e.target.value }))} /></div>
      </div>
      <div><Label className="text-xs">Notas</Label><Input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} /></div>

      {/* Conditional Intro Section */}
      <div className="border-t border-border/40 pt-3 mt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" />
            <Label className="text-xs font-medium">¿Tuviste reuniones introductorias hoy?</Label>
          </div>
          <Switch checked={hasIntros} onCheckedChange={setHasIntros} />
        </div>
        {hasIntros && (
          <div className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
            <p className="text-xs text-blue-400 font-medium mb-2">Reuniones Introductorias</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Intro Agendadas</Label>
                <Input type="number" min={0} value={form.introAgendadas} onChange={e => setForm(p => ({ ...p, introAgendadas: parseInt(e.target.value) || 0 }))} className="border-blue-500/30" />
              </div>
              <div>
                <Label className="text-xs">Intro Live</Label>
                <Input type="number" min={0} value={form.introLive} onChange={e => setForm(p => ({ ...p, introLive: parseInt(e.target.value) || 0 }))} className="border-blue-500/30" />
              </div>
              <div>
                <Label className="text-xs">Intro → Demo</Label>
                <Input type="number" min={0} value={form.introADemo} onChange={e => setForm(p => ({ ...p, introADemo: parseInt(e.target.value) || 0 }))} className="border-blue-500/30" />
              </div>
            </div>
            {form.introAgendadas > 0 && (
              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                <span>Show Rate: <strong className="text-blue-400">{form.introAgendadas > 0 ? ((form.introLive / form.introAgendadas) * 100).toFixed(0) : 0}%</strong></span>
                <span>Intro→Demo: <strong className="text-blue-400">{form.introLive > 0 ? ((form.introADemo / form.introLive) * 100).toFixed(0) : 0}%</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      <Button onClick={onSubmit} className="w-full" disabled={isPending}>
        {isPending ? "Guardando..." : submitLabel}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Setter Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Registro diario de actividades de setters</p>
        </div>
        <div className="flex items-center gap-2">
          <TeamMemberSelect value={setter} onValueChange={setSetter} role="SETTER" includeAll allLabel="Todos" className="w-[130px] bg-card/50" />
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[120px] bg-card/50"><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={semana} onValueChange={setSemana}>
            <SelectTrigger className="w-[110px] bg-card/50"><SelectValue placeholder="Semana" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{[1,2,3,4,5].map(s => <SelectItem key={s} value={s.toString()}>Sem {s}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (open) { setNewDate(new Date()); setNewHasIntros(false); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Registrar</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Registrar Actividad de Setter</DialogTitle></DialogHeader>
              {renderForm(newActivity, setNewActivity, newDate, setNewDate, newDateOpen, setNewDateOpen, handleCreate, createMutation.isPending, "Registrar Actividad", newHasIntros, setNewHasIntros)}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Aggregated Metrics */}
      {totals && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-2">
            <MetricCard title="Intentos" value={totals.intentos} />
            <MetricCard title="Intros Efectivas" value={totals.intros} />
            <MetricCard title="Tasa Respuesta" value={`${tasaRespuesta}%`} color={Number(tasaRespuesta) >= 30 ? "#22c55e" : "#ef4444"} />
            <MetricCard title="Demos Aseguradas" value={totals.aseguradas} />
            <MetricCard title="Tasa Confirm." value={`${tasaConfirmacion}%`} color="#A855F7" />
            <MetricCard title="En Calendario" value={totals.calendario} />
            <MetricCard title="Asistidas" value={totals.asistidas} />
            <MetricCard title="Tasa Asistencia" value={`${tasaAsistencia}%`} color={Number(tasaAsistencia) >= 80 ? "#22c55e" : "#f59e0b"} />
            <MetricCard title="Cierres" value={totals.cierres} color="#F59E0B" />
          </div>

          {/* Conditional Intro Metrics - only shown if there's intro data */}
          {hasIntroData && (
            <div className="mt-2">
              <p className="text-xs text-blue-400 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Reuniones Introductorias
              </p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                <MetricCard title="Intro Agendadas" value={totals.introAgendadas} />
                <MetricCard title="Intro Live" value={totals.introLive} />
                <MetricCard title="Intro Show Rate" value={`${introShowRate}%`} color={Number(introShowRate) >= 70 ? "#22c55e" : "#f59e0b"} />
                <MetricCard title="Intro → Demo" value={totals.introADemo} />
                <MetricCard title="Intro→Demo Rate" value={`${introDemoRate}%`} color={Number(introDemoRate) >= 60 ? "#22c55e" : "#f59e0b"} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) { setEditingId(null); setEditHasIntros(false); } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Registro de Setter</DialogTitle></DialogHeader>
          {renderForm(editForm, setEditForm, editDate, setEditDate, editDateOpen, setEditDateOpen, handleUpdate, updateMutation.isPending, "Guardar Cambios", editHasIntros, setEditHasIntros)}
        </DialogContent>
      </Dialog>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClear={bulk.clear}
        onBulkDelete={() => bulkDeleteMutation.mutate({ ids: Array.from(bulk.selectedIds) })}
      />

      {/* Activity Table */}
      <Card className="bg-card/50 border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="p-3 w-8">
                  <Checkbox
                    checked={bulk.isAllSelected}
                    onCheckedChange={bulk.toggleAll}
                    aria-label="Seleccionar todos"
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Fecha</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Setter</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intentos</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Intros</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Aseguradas</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Calendario</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Confirmadas</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Asistidas</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Tasa Resp.</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Tasa Asist.</th>
                {hasIntroData && (
                  <>
                    <th className="text-center p-3 font-medium text-blue-400 text-xs border-l border-blue-500/20">Intro Agend.</th>
                    <th className="text-center p-3 font-medium text-blue-400 text-xs">Intro Live</th>
                    <th className="text-center p-3 font-medium text-blue-400 text-xs">Intro→Demo</th>
                    <th className="text-center p-3 font-medium text-blue-400 text-xs">Intro Show%</th>
                  </>
                )}
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Notas</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {(activities || []).map(a => {
                const tr = a.intentosLlamada && a.intentosLlamada > 0 ? ((a.introsEfectivas || 0) / a.intentosLlamada * 100).toFixed(0) : "-";
                const ta = a.demosEnCalendario && a.demosEnCalendario > 0 ? ((a.demosAsistidas || 0) / a.demosEnCalendario * 100).toFixed(0) : "-";
                const introSR = (a.introAgendadas || 0) > 0 ? (((a.introLive || 0) / a.introAgendadas!) * 100).toFixed(0) : "-";
                return (
                  <tr key={a.id} className={`border-b border-border/30 hover:bg-muted/20 ${bulk.selectedIds.has(a.id) ? 'bg-primary/5' : ''}`}>
                    <td className="p-3">
                      <Checkbox
                        checked={bulk.selectedIds.has(a.id)}
                        onCheckedChange={() => bulk.toggle(a.id)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </td>
                    <td className="p-3 text-xs">{new Date(a.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</td>
                    <td className="p-3 text-xs font-medium">{a.setter}</td>
                    <td className="p-3 text-center text-xs">{a.intentosLlamada}</td>
                    <td className="p-3 text-center text-xs">{a.introsEfectivas}</td>
                    <td className="p-3 text-center text-xs">{a.demosAseguradasConIntro}</td>
                    <td className="p-3 text-center text-xs">{a.demosEnCalendario}</td>
                    <td className="p-3 text-center text-xs">{a.demosConfirmadas}</td>
                    <td className="p-3 text-center text-xs">{a.demosAsistidas}</td>
                    <td className="p-3 text-center text-xs font-medium" style={{ color: tr !== "-" && Number(tr) >= 30 ? sc.good : sc.bad }}>{tr !== "-" ? `${tr}%` : "-"}</td>
                    <td className="p-3 text-center text-xs font-medium" style={{ color: ta !== "-" && Number(ta) >= 80 ? sc.good : sc.warning }}>{ta !== "-" ? `${ta}%` : "-"}</td>
                    {hasIntroData && (
                      <>
                        <td className="p-3 text-center text-xs border-l border-blue-500/10">{a.introAgendadas || 0}</td>
                        <td className="p-3 text-center text-xs">{a.introLive || 0}</td>
                        <td className="p-3 text-center text-xs">{a.introADemo || 0}</td>
                        <td className="p-3 text-center text-xs font-medium text-blue-400">{introSR !== "-" ? `${introSR}%` : "-"}</td>
                      </>
                    )}
                    <td className="p-3 text-xs text-muted-foreground max-w-[150px] truncate">{a.notas || "-"}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary/80" onClick={() => startEdit(a)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("¿Eliminar?")) deleteMutation.mutate({ id: a.id }); }}>
                          <span className="text-xs">✕</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!activities || activities.length === 0) && (
                <tr><td colSpan={hasIntroData ? 17 : 13} className="p-8 text-center text-muted-foreground">
                  {isLoading ? "Cargando..." : "Sin registros. Usa el botón 'Registrar' para agregar actividades."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
