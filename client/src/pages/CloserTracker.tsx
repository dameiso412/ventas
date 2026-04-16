import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState, useMemo } from "react";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useStatusColors } from "@/hooks/useStatusColors";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";
import { getCurrentMes, getCurrentSemana } from "@shared/period";

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
  closer: "",
  scheduleCalls: 0, liveCalls: 0, offers: 0, deposits: 0, closes: 0,
  piffRevenue: "0", piffCash: "0", setupRevenue: "0", setupCash: "0", notas: "",
};

export default function CloserTracker() {
  // Default to current Chile period
  const [mes, setMes] = useState<string>(() => getCurrentMes());
  const [semana, setSemana] = useState<string>(() => String(getCurrentSemana()));
  const [closer, setCloser] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [newActivity, setNewActivity] = useState(emptyForm);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newDateOpen, setNewDateOpen] = useState(false);
  const [editDateOpen, setEditDateOpen] = useState(false);
  const sc = useStatusColors();

  const filters = useMemo(() => ({
    closer: closer !== "all" ? closer : undefined,
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
  }), [closer, mes, semana]);

  const { data: activities, isLoading } = trpc.closerActivities.list.useQuery(filters);
  const utils = trpc.useUtils();

  const createMutation = trpc.closerActivities.create.useMutation({
    onSuccess: () => { utils.closerActivities.list.invalidate(); toast.success("Actividad registrada"); setShowAdd(false); setNewActivity(emptyForm); setNewDate(new Date()); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.closerActivities.update.useMutation({
    onSuccess: () => {
      utils.closerActivities.list.invalidate();
      utils.dashboard.trackerKPIs.invalidate();
      toast.success("Registro actualizado");
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.closerActivities.delete.useMutation({
    onSuccess: () => { utils.closerActivities.list.invalidate(); utils.dashboard.trackerKPIs.invalidate(); toast.success("Registro eliminado"); },
  });

  const bulkDeleteMutation = trpc.closerActivities.bulkDelete.useMutation({
    onSuccess: (res) => { utils.closerActivities.list.invalidate(); utils.dashboard.trackerKPIs.invalidate(); bulk.clear(); toast.success(`${res.count} registro(s) eliminados`); },
    onError: (err) => toast.error(err.message),
  });

  const bulk = useBulkSelection(activities);

  const totals = useMemo(() => {
    if (!activities || activities.length === 0) return null;
    return activities.reduce((acc, a) => ({
      schedule: acc.schedule + (a.scheduleCalls || 0),
      live: acc.live + (a.liveCalls || 0),
      offers: acc.offers + (a.offers || 0),
      deposits: acc.deposits + (a.deposits || 0),
      closes: acc.closes + (a.closes || 0),
      piffRevenue: acc.piffRevenue + Number(a.piffRevenue || 0),
      piffCash: acc.piffCash + Number(a.piffCash || 0),
      setupRevenue: acc.setupRevenue + Number(a.setupRevenue || 0),
      setupCash: acc.setupCash + Number(a.setupCash || 0),
    }), { schedule: 0, live: 0, offers: 0, deposits: 0, closes: 0, piffRevenue: 0, piffCash: 0, setupRevenue: 0, setupCash: 0 });
  }, [activities]);

  const showRate = totals && totals.schedule > 0 ? ((totals.live / totals.schedule) * 100).toFixed(1) : "0";
  const offerRate = totals && totals.live > 0 ? ((totals.offers / totals.live) * 100).toFixed(1) : "0";
  const closeRate = totals && totals.offers > 0 ? ((totals.closes / totals.offers) * 100).toFixed(1) : "0";
  const totalRevenue = totals ? totals.piffRevenue + totals.setupRevenue : 0;
  const totalCash = totals ? totals.piffCash + totals.setupCash : 0;

  const handleCreate = () => {
    createMutation.mutate({
      ...newActivity,
      fecha: newDate,
      mes: getMesFromDate(newDate),
      semana: getSemanaFromDate(newDate),
    });
  };

  const startEdit = (a: any) => {
    setEditingId(a.id);
    setEditDate(new Date(a.fecha));
    setEditForm({
      closer: a.closer || "",
      scheduleCalls: a.scheduleCalls || 0,
      liveCalls: a.liveCalls || 0,
      offers: a.offers || 0,
      deposits: a.deposits || 0,
      closes: a.closes || 0,
      piffRevenue: String(a.piffRevenue || "0"),
      piffCash: String(a.piffCash || "0"),
      setupRevenue: String(a.setupRevenue || "0"),
      setupCash: String(a.setupCash || "0"),
      notas: a.notas || "",
    });
  };

  const handleUpdate = () => {
    if (editingId === null) return;
    updateMutation.mutate({
      id: editingId,
      data: {
        fecha: editDate,
        mes: getMesFromDate(editDate),
        semana: getSemanaFromDate(editDate),
        closer: editForm.closer,
        scheduleCalls: editForm.scheduleCalls,
        liveCalls: editForm.liveCalls,
        offers: editForm.offers,
        deposits: editForm.deposits,
        closes: editForm.closes,
        piffRevenue: editForm.piffRevenue,
        piffCash: editForm.piffCash,
        setupRevenue: editForm.setupRevenue,
        setupCash: editForm.setupCash,
        notas: editForm.notas,
      },
    });
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
    submitLabel: string
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
        <Label className="text-xs">Closer</Label>
        <TeamMemberSelect value={form.closer} onValueChange={v => setForm(p => ({ ...p, closer: v }))} role="CLOSER" placeholder="Seleccionar closer" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Schedule Calls</Label><Input type="number" min={0} value={form.scheduleCalls} onChange={e => setForm(p => ({ ...p, scheduleCalls: parseInt(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Live Calls</Label><Input type="number" min={0} value={form.liveCalls} onChange={e => setForm(p => ({ ...p, liveCalls: parseInt(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Offers</Label><Input type="number" min={0} value={form.offers} onChange={e => setForm(p => ({ ...p, offers: parseInt(e.target.value) || 0 }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Deposits</Label><Input type="number" min={0} value={form.deposits} onChange={e => setForm(p => ({ ...p, deposits: parseInt(e.target.value) || 0 }))} /></div>
        <div><Label className="text-xs">Closes</Label><Input type="number" min={0} value={form.closes} onChange={e => setForm(p => ({ ...p, closes: parseInt(e.target.value) || 0 }))} /></div>
      </div>
      <p className="text-xs text-muted-foreground font-medium mt-2">Revenue por Producto</p>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">PIFF Revenue ($)</Label><Input type="number" value={form.piffRevenue} onChange={e => setForm(p => ({ ...p, piffRevenue: e.target.value }))} /></div>
        <div><Label className="text-xs">PIFF Cash ($)</Label><Input type="number" value={form.piffCash} onChange={e => setForm(p => ({ ...p, piffCash: e.target.value }))} /></div>
        <div><Label className="text-xs">SETUP Revenue ($)</Label><Input type="number" value={form.setupRevenue} onChange={e => setForm(p => ({ ...p, setupRevenue: e.target.value }))} /></div>
        <div><Label className="text-xs">SETUP Cash ($)</Label><Input type="number" value={form.setupCash} onChange={e => setForm(p => ({ ...p, setupCash: e.target.value }))} /></div>
      </div>
      <div><Label className="text-xs">Notas</Label><Input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} /></div>
      <Button onClick={onSubmit} className="w-full" disabled={isPending}>
        {isPending ? "Guardando..." : submitLabel}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Closer Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">Registro diario de actividades de closers</p>
        </div>
        <div className="flex items-center gap-2">
          <TeamMemberSelect value={closer} onValueChange={setCloser} role="CLOSER" includeAll allLabel="Todos" className="w-[130px] bg-card/50" />
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[120px] bg-card/50"><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={semana} onValueChange={setSemana}>
            <SelectTrigger className="w-[110px] bg-card/50"><SelectValue placeholder="Semana" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{[1,2,3,4,5].map(s => <SelectItem key={s} value={s.toString()}>Sem {s}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (open) setNewDate(new Date()); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Registrar</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Actividad de Closer</DialogTitle></DialogHeader>
              {renderForm(newActivity, setNewActivity, newDate, setNewDate, newDateOpen, setNewDateOpen, handleCreate, createMutation.isPending, "Registrar Actividad")}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Aggregated Metrics */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
          <MetricCard title="Schedule" value={totals.schedule} />
          <MetricCard title="Live Calls" value={totals.live} />
          <MetricCard title="Show Rate" value={`${showRate}%`} color={Number(showRate) >= 80 ? "#22c55e" : "#f59e0b"} />
          <MetricCard title="Offers" value={totals.offers} />
          <MetricCard title="Offer Rate" value={`${offerRate}%`} color="#A855F7" />
          <MetricCard title="Deposits" value={totals.deposits} />
          <MetricCard title="Closes" value={totals.closes} color="#22c55e" />
          <MetricCard title="Close Rate" value={`${closeRate}%`} color={Number(closeRate) >= 30 ? "#22c55e" : "#f59e0b"} />
          <MetricCard title="Revenue" value={`$${totalRevenue.toLocaleString()}`} color="#F59E0B" />
          <MetricCard title="Cash" value={`$${totalCash.toLocaleString()}`} color="#22c55e" />
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Registro de Closer</DialogTitle></DialogHeader>
          {renderForm(editForm, setEditForm, editDate, setEditDate, editDateOpen, setEditDateOpen, handleUpdate, updateMutation.isPending, "Guardar Cambios")}
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
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Closer</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Schedule</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Live</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Offers</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Deposits</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Closes</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Show%</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Close%</th>
                <th className="text-right p-3 font-medium text-muted-foreground text-xs">Revenue</th>
                <th className="text-right p-3 font-medium text-muted-foreground text-xs">Cash</th>
                <th className="text-center p-3 font-medium text-muted-foreground text-xs">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {(activities || []).map(a => {
                const sr = a.scheduleCalls && a.scheduleCalls > 0 ? ((a.liveCalls || 0) / a.scheduleCalls * 100).toFixed(0) : "-";
                const cr = a.offers && a.offers > 0 ? ((a.closes || 0) / a.offers * 100).toFixed(0) : "-";
                const rev = Number(a.piffRevenue || 0) + Number(a.setupRevenue || 0);
                const cash = Number(a.piffCash || 0) + Number(a.setupCash || 0);
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
                    <td className="p-3 text-xs font-medium">{a.closer}</td>
                    <td className="p-3 text-center text-xs">{a.scheduleCalls}</td>
                    <td className="p-3 text-center text-xs">{a.liveCalls}</td>
                    <td className="p-3 text-center text-xs">{a.offers}</td>
                    <td className="p-3 text-center text-xs">{a.deposits}</td>
                    <td className="p-3 text-center text-xs font-medium text-green-400">{a.closes}</td>
                    <td className="p-3 text-center text-xs" style={{ color: sr !== "-" && Number(sr) >= 80 ? sc.good : sc.warning }}>{sr !== "-" ? `${sr}%` : "-"}</td>
                    <td className="p-3 text-center text-xs" style={{ color: cr !== "-" && Number(cr) >= 30 ? sc.good : sc.warning }}>{cr !== "-" ? `${cr}%` : "-"}</td>
                    <td className="p-3 text-right text-xs font-medium text-amber-400">{rev > 0 ? `$${rev.toLocaleString()}` : "-"}</td>
                    <td className="p-3 text-right text-xs font-medium text-green-400">{cash > 0 ? `$${cash.toLocaleString()}` : "-"}</td>
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
                <tr><td colSpan={13} className="p-8 text-center text-muted-foreground">
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
