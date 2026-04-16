import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo, useEffect, useRef } from "react";
import { format, isToday, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Edit2, Trash2, ExternalLink, User, Phone, Star, Target, DollarSign, ChevronRight, ChevronDown, Eye, Clock, CheckCircle2, Headphones, Flame, AlertTriangle, PhoneCall, MessageSquare, Mail, Instagram, MoreHorizontal, Send, MessageCircle, Megaphone, CalendarCheck, ArrowRightLeft, UserCheck, Zap, Calendar, List, LayoutGrid } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";
import { ProspectProfile } from "@/components/ProspectProfile";
import { PipelineBoard } from "@/components/PipelineBoard";
import { CallRecordingTriage } from "@/components/CallRecordingTriage";
import { ScoreBadge, OutcomeBadge, ContactoBadge, EstadoLeadBadge } from "@/components/LeadBadges";
import { calculateBusinessHours } from "@shared/businessHours";
import { LeadEditSheet } from "@/components/LeadEditSheet";
import { getCurrentMes, getCurrentSemana } from "@shared/period";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ORIGENES = ["ADS", "REFERIDO", "ORGANICO", "INSTAGRAM"];
const RESULTADOS_CONTACTO = ["CONTESTÓ", "NO CONTESTÓ", "BUZÓN", "NÚMERO INVÁLIDO", "WHATSAPP LIMPIADO", "PENDIENTE"];
const ESTADOS_CONFIRMACION = ["CONFIRMADA", "NO CONFIRMADA", "CANCELADA", "REAGENDADA", "PENDIENTE"];
const ASISTENCIAS = ["ASISTIÓ", "NO SHOW", "PENDIENTE"];
const OUTCOMES = ["VENTA", "PERDIDA", "SEGUIMIENTO", "PENDIENTE"];
const SCORE_LABELS = ["HOT", "WARM", "TIBIO", "FRÍO"];
const OFERTAS = ["SÍ", "NO", "N/A"];
const CALIFICA_OPTIONS = ["SÍ", "NO", "POR EVALUAR"];
const VALIDO_OPTIONS = ["SÍ", "NO"];
const TRIAGE_OPTIONS = ["COMPLETADO", "PENDIENTE", "N/A"];
const RAZONES_NO_CALIFICA = ["Agencia", "Rubro No Válido", "Sin Presupuesto", "Clínica Muy Nueva", "No Es Propietario", "Otro"];
const RAZONES_NO_CONVERSION = ["Sin Dinero", "Logística", "Era una agencia de MK no válido", "Necesita Consultarlo", "Quiere Comparar", "No Interesado", "Otro"];
const CANALES_CONTACTO = ["LLAMADA", "WHATSAPP", "SMS", "EMAIL", "DM_INSTAGRAM", "OTRO"] as const;
const RESULTADOS_INTENTO = ["CONTESTÓ", "NO CONTESTÓ", "BUZÓN", "NÚMERO INVÁLIDO", "WHATSAPP LIMPIADO"] as const;
const CALIFICACION_FINANCIERA = ["SÍ", "NO", "PARCIAL"] as const;

const CANAL_ICONS: Record<string, typeof Phone> = {
  LLAMADA: PhoneCall,
  WHATSAPP: MessageSquare,
  SMS: MessageSquare,
  EMAIL: Mail,
  DM_INSTAGRAM: Instagram,
  OTRO: MoreHorizontal,
};

// Pipeline step indicator
const PIPELINE_STEPS = [
  { key: "entrada", label: "Entrada", icon: User, color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/40" },
  { key: "contacto", label: "Contacto", icon: Phone, color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/40" },
  { key: "calificacion", label: "Calificación", icon: Star, color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/40" },
  { key: "demo", label: "Demo", icon: Target, color: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/40" },
  { key: "financiero", label: "Financiero", icon: DollarSign, color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/40" },
];

const ESTADOS_LEAD = ["NUEVO", "CONTACTADO", "CALIFICADO", "DESCARTADO", "CONVERTIDO_AGENDA"] as const;

export default function Citas() {
  // View toggle: AGENDAS (original) vs LEADS (dinero gratis)
  const [vista, setVista] = useState<"AGENDAS" | "LEADS">("AGENDAS");
  // View mode: lista (cards) vs pipeline (kanban)
  const [viewMode, setViewMode] = useState<"lista" | "pipeline">("lista");
  // Sub-filter for AGENDAS: upcoming vs past appointments
  const [timeFilter, setTimeFilter] = useState<"proximas" | "pasadas">("proximas");
  // Default filters: current Chile month + week so every page opens
  // scoped to "this period" instead of "todos los tiempos".
  const [mes, setMes] = useState<string>(() => getCurrentMes());
  const [semana, setSemana] = useState<string>(() => String(getCurrentSemana()));
  const [origen, setOrigen] = useState<string>("all");
  const [setter, setSetter] = useState<string>("all");
  const [closer, setCloser] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [estadoLeadFilter, setEstadoLeadFilter] = useState<string>("all");
  // Read ?search= or ?leadId= from URL to auto-filter
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const initialSearch = urlParams.get("search") || urlParams.get("leadId") || "";
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const highlightLeadId = urlParams.get("leadId") ? parseInt(urlParams.get("leadId")!) : null;

  // Update search if URL changes
  useEffect(() => {
    if (initialSearch) setSearchTerm(initialSearch);
  }, [initialSearch]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [scorePopupLead, setScorePopupLead] = useState<any>(null);
  const [noShowLead, setNoShowLead] = useState<any>(null); // Lead para protocolo No-Show
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filters = useMemo(() => ({
    mes: mes !== "all" ? mes : undefined,
    semana: semana !== "all" ? parseInt(semana) : undefined,
    origen: origen !== "all" ? origen : undefined,
    setter: setter !== "all" ? setter : undefined,
    closer: closer !== "all" ? closer : undefined,
    scoreLabel: scoreFilter !== "all" ? scoreFilter : undefined,
    outcome: outcomeFilter !== "all" ? outcomeFilter : undefined,
    tipo: tipoFilter !== "all" ? tipoFilter : undefined,
    categoria: vista === "LEADS" ? "LEAD" : "AGENDA",
    estadoLead: vista === "LEADS" && estadoLeadFilter !== "all" ? estadoLeadFilter : undefined,
    timeFilter: vista === "AGENDAS" ? timeFilter : undefined,
  }), [mes, semana, origen, setter, closer, scoreFilter, outcomeFilter, tipoFilter, vista, estadoLeadFilter, timeFilter]);

  const { data: leads, isLoading, isError, error } = trpc.leads.list.useQuery(filters);

  // Count of leads in each view for the toggle badges
  const { data: agendaCountData } = trpc.leads.list.useQuery({ categoria: "AGENDA" }, { select: (d) => d?.length || 0 });
  const { data: leadsCountData } = trpc.leads.list.useQuery({ categoria: "LEAD" }, { select: (d) => d?.length || 0 });
  // Counts for Próximas / Pasadas sub-tabs
  const { data: proximasCount } = trpc.leads.list.useQuery({ categoria: "AGENDA", timeFilter: "proximas" }, { select: (d) => d?.length || 0 });
  const { data: pasadasCount } = trpc.leads.list.useQuery({ categoria: "AGENDA", timeFilter: "pasadas" }, { select: (d) => d?.length || 0 });
  const { data: filterValues } = trpc.filters.distinctValues.useQuery();
  const { data: auditStats } = trpc.callAudits.list.useQuery({ limit: 500 });
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();

  // Build a set of leadIds that have audits
  const leadsWithAudits = useMemo(() => {
    if (!auditStats) return new Set<number>();
    return new Set(auditStats.filter(a => a.leadId).map(a => a.leadId as number));
  }, [auditStats]);

  // Batch fetch latest comments for all visible leads
  const leadIds = useMemo(() => (leads || []).map(l => l.id), [leads]);
  const { data: latestComments } = trpc.comments.latestForLeads.useQuery(
    { leadIds },
    { enabled: leadIds.length > 0 }
  );
  const latestCommentMap = useMemo(() => {
    const map = new Map<number, { texto: string; autor: string; createdAt: Date | string }>();
    if (latestComments) {
      for (const c of latestComments as any[]) {
        map.set(c.leadId, { texto: c.texto, autor: c.autor, createdAt: c.createdAt });
      }
    }
    return map;
  }, [latestComments]);

  // Batch fetch first contact attempt for all visible leads (for response time column)
  const { data: firstAttempts } = trpc.contactAttempts.firstForLeads.useQuery(
    { leadIds },
    { enabled: leadIds.length > 0 }
  );
  const responseTimeMap = useMemo(() => {
    const map = new Map<number, { firstAttempt: Date | string | null; attemptCount: number }>();
    if (firstAttempts) {
      for (const a of firstAttempts as any[]) {
        map.set(a.leadId, { firstAttempt: a.firstAttempt, attemptCount: Number(a.attemptCount) });
      }
    }
    return map;
  }, [firstAttempts]);

  const createMutation = trpc.leads.create.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); utils.dashboard.kpis.invalidate(); toast.success("Lead creado"); setShowAddDialog(false); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); utils.dashboard.kpis.invalidate(); toast.success("Lead actualizado"); setEditingLead(null); },
    onError: (err) => toast.error(err.message),
  });

  // Inline mutation for card actions (no toast, no dialog close)
  const inlineUpdateMutation = trpc.leads.update.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); utils.dashboard.kpis.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  // Pipeline drag-and-drop mutation
  const pipelineDropMutation = trpc.leads.update.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); utils.dashboard.kpis.invalidate(); },
    onError: (err) => toast.error(`Error al mover: ${err.message}`),
  });

  const deleteMutation = trpc.leads.delete.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); utils.dashboard.kpis.invalidate(); toast.success("Lead eliminado"); },
    onError: (err) => toast.error(err.message),
  });

  const createFollowUpMutation = trpc.followUps.create.useMutation({
    onSuccess: () => { toast.success("Follow-up creado. Revisa la sección Follow-Ups."); },
    onError: (err) => toast.error(err.message),
  });

  const noShowMutation = trpc.followUps.noShow.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.followUps.list.invalidate();
      toast.success("Protocolo No-Show activado. Lead movido a Follow-Ups RED_HOT.");
      setNoShowLead(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Convert lead to agenda (schedule an appointment)
  const convertToAgendaMutation = trpc.leads.update.useMutation({
    onSuccess: () => { utils.leads.list.invalidate(); toast.success("Lead convertido a Agenda exitosamente"); },
    onError: (err) => toast.error(err.message),
  });

  // Leads needing attention (48h alert)
  const { data: leadsNeedingAttention } = trpc.leadsAlert.needingAttention.useQuery(
    { mes: mes !== "all" ? mes : undefined, semana: semana !== "all" ? parseInt(semana) : undefined },
  );
  const alertLeadIds = useMemo(() => {
    if (!leadsNeedingAttention) return new Set<number>();
    return new Set((leadsNeedingAttention as unknown as any[]).map((l: any) => l.id));
  }, [leadsNeedingAttention]);

  const bulkDeleteMutation = trpc.leads.bulkDelete.useMutation({
    onSuccess: (res) => { utils.leads.list.invalidate(); utils.dashboard.kpis.invalidate(); bulk.clear(); toast.success(`${res.count} lead(s) eliminados`); },
    onError: (err) => toast.error(err.message),
  });

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    if (!searchTerm) return leads;
    const term = searchTerm.toLowerCase();
    return leads.filter(l =>
      l.nombre?.toLowerCase().includes(term) ||
      l.correo?.toLowerCase().includes(term) ||
      l.telefono?.includes(term) ||
      l.instagram?.toLowerCase().includes(term)
    );
  }, [leads, searchTerm]);

  const bulk = useBulkSelection(filteredLeads);

  const [newLead, setNewLead] = useState({
    nombre: "", correo: "", telefono: "", pais: "", instagram: "", rubro: "",
    origen: "ADS" as "ADS" | "REFERIDO" | "ORGANICO",
    tipo: "DEMO" as "DEMO" | "INTRO",
    setterAsignado: "", closer: "", notas: "",
  });

  const handleCreate = () => {
    const now = new Date();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    createMutation.mutate({
      ...newLead,
      fecha: now,
      mes: meses[now.getMonth()],
      semana: Math.ceil(now.getDate() / 7),
      categoria: vista === "LEADS" ? "LEAD" as const : "AGENDA" as const,
      estadoLead: vista === "LEADS" ? "NUEVO" as const : undefined,
    });
  };

  const handleConvertToAgenda = (leadId: number) => {
    convertToAgendaMutation.mutate({
      id: leadId,
      data: {
        categoria: "AGENDA",
        estadoLead: "CONVERTIDO_AGENDA",
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with view toggle */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {vista === "AGENDAS" ? "Registro de Citas" : "Dinero Gratis"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredLeads.length} {vista === "AGENDAS" ? "citas" : "leads"} encontrados
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-muted/30 rounded-lg p-1 border border-border/50">
              <button
                onClick={() => setVista("AGENDAS")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  vista === "AGENDAS"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarCheck className="h-3.5 w-3.5" />
                Agendas
                {typeof agendaCountData === "number" && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    vista === "AGENDAS" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted/50 text-muted-foreground"
                  }`}>{agendaCountData}</span>
                )}
              </button>
              <button
                onClick={() => setVista("LEADS")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  vista === "LEADS"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                Dinero Gratis
                {typeof leadsCountData === "number" && leadsCountData > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    vista === "LEADS" ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-400"
                  }`}>{leadsCountData}</span>
                )}
              </button>
            </div>
            {/* View Mode Toggle: Lista / Pipeline */}
            <div className="flex items-center bg-muted/30 rounded-lg p-1 border border-border/50">
              <button
                onClick={() => setViewMode("lista")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === "lista"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Vista lista"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("pipeline")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === "pipeline"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Vista pipeline"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> {vista === "LEADS" ? "Nuevo Prospecto" : "Nuevo Lead"}</Button>
              </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Agregar Nuevo Lead</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div><Label className="text-xs">Nombre</Label><Input value={newLead.nombre} onChange={e => setNewLead(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div><Label className="text-xs">Correo</Label><Input value={newLead.correo} onChange={e => setNewLead(p => ({ ...p, correo: e.target.value }))} /></div>
              <div><Label className="text-xs">Teléfono</Label><Input value={newLead.telefono} onChange={e => setNewLead(p => ({ ...p, telefono: e.target.value }))} /></div>
              <div><Label className="text-xs">País</Label><Input value={newLead.pais} onChange={e => setNewLead(p => ({ ...p, pais: e.target.value }))} /></div>
              <div><Label className="text-xs">Instagram</Label><Input value={newLead.instagram} onChange={e => setNewLead(p => ({ ...p, instagram: e.target.value }))} /></div>
              <div>
                <Label className="text-xs">Origen</Label>
                <Select value={newLead.origen} onValueChange={v => setNewLead(p => ({ ...p, origen: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ORIGENES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Setter</Label>
                <TeamMemberSelect value={newLead.setterAsignado} onValueChange={v => setNewLead(p => ({ ...p, setterAsignado: v }))} role="SETTER" placeholder="Seleccionar setter" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={newLead.tipo} onValueChange={v => setNewLead(p => ({ ...p, tipo: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEMO">DEMO</SelectItem>
                    <SelectItem value="INTRO">INTRO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-2"><Label className="text-xs">Notas</Label><Input value={newLead.notas} onChange={e => setNewLead(p => ({ ...p, notas: e.target.value }))} /></div>
            <Button onClick={handleCreate} className="mt-3 w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Guardando..." : "Crear Lead"}
            </Button>
          </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Sub-tabs: Próximas / Pasadas (only for AGENDAS view) */}
      {vista === "AGENDAS" && (
        <div className="flex items-center gap-1 bg-muted/20 rounded-lg p-1 border border-border/40 w-fit">
          <button
            onClick={() => setTimeFilter("proximas")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              timeFilter === "proximas"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Próximas
            {typeof proximasCount === "number" && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                timeFilter === "proximas" ? "bg-white/20 text-white" : "bg-blue-500/15 text-blue-400"
              }`}>{proximasCount}</span>
            )}
          </button>
          <button
            onClick={() => setTimeFilter("pasadas")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              timeFilter === "pasadas"
                ? "bg-slate-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Pasadas
            {typeof pasadasCount === "number" && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                timeFilter === "pasadas" ? "bg-white/20 text-white" : "bg-slate-500/15 text-slate-400"
              }`}>{pasadasCount}</span>
            )}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, correo, teléfono..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 bg-background/50 h-9" />
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[120px] h-9 bg-background/50"><SelectValue placeholder="Mes" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={semana} onValueChange={setSemana}>
          <SelectTrigger className="w-[110px] h-9 bg-background/50"><SelectValue placeholder="Semana" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{[1,2,3,4,5].map(s => <SelectItem key={s} value={s.toString()}>Sem {s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={origen} onValueChange={setOrigen}>
          <SelectTrigger className="w-[110px] h-9 bg-background/50"><SelectValue placeholder="Origen" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{ORIGENES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
        <TeamMemberSelect value={setter} onValueChange={setSetter} role="SETTER" includeAll allLabel="Todos" className="w-[120px] h-9 bg-background/50" />
        <TeamMemberSelect value={closer} onValueChange={setCloser} role="CLOSER" includeAll allLabel="Todos" className="w-[120px] h-9 bg-background/50" />
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-[100px] h-9 bg-background/50"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{SCORE_LABELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[100px] h-9 bg-background/50"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="DEMO">Demo</SelectItem>
            <SelectItem value="INTRO">Intro</SelectItem>
          </SelectContent>
        </Select>
        {vista === "AGENDAS" && (
          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger className="w-[120px] h-9 bg-background/50"><SelectValue placeholder="Outcome" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {vista === "LEADS" && (
          <Select value={estadoLeadFilter} onValueChange={setEstadoLeadFilter}>
            <SelectTrigger className="w-[130px] h-9 bg-background/50"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ESTADOS_LEAD.map(e => <SelectItem key={e} value={e}>{e.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={bulk.selectedCount}
        onClear={bulk.clear}
        onBulkDelete={() => bulkDeleteMutation.mutate({ ids: Array.from(bulk.selectedIds) })}
      />

      {/* Lead Cards / Pipeline Board */}
      {isError ? (
        <div className="text-center py-8 space-y-3">
          <AlertTriangle className="h-10 w-10 mx-auto text-red-400" />
          <p className="text-sm text-red-400 font-medium">Error al cargar datos</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">{(error as any)?.message || "No se pudo conectar a la base de datos"}</p>
          <Button variant="outline" size="sm" onClick={() => { utils.leads.list.invalidate(); }}>Reintentar</Button>
        </div>
      ) : isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {vista === "LEADS" ? (
            <div className="space-y-2">
              <Zap className="h-8 w-8 mx-auto text-emerald-500/30" />
              <p className="text-sm">No hay leads sin agendar</p>
              <p className="text-[10px] text-muted-foreground/60">Los leads llegarán automáticamente vía webhook o puedes agregarlos manualmente</p>
            </div>
          ) : <p className="text-sm">No se encontraron registros</p>}
        </div>
      ) : viewMode === "pipeline" ? (
        <PipelineBoard
          leads={filteredLeads}
          vista={vista}
          onEditLead={setEditingLead}
          onStageDrop={(leadId, fields, revert) => {
            pipelineDropMutation.mutate(
              { id: leadId, data: fields },
              { onError: () => revert() }
            );
          }}
        />
      ) : (
        <div className="space-y-1">
          {/* Select All */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground">
            <Checkbox
              checked={bulk.isAllSelected}
              onCheckedChange={bulk.toggleAll}
              aria-label="Seleccionar todos"
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span>Seleccionar todos ({filteredLeads.length})</span>
          </div>

          {filteredLeads.map((lead) => {
            const isExpanded = expandedId === lead.id;
            return (
              <div
                key={lead.id}
                className={`rounded-lg border transition-colors ${
                  highlightLeadId === lead.id ? 'ring-1 ring-primary/30 bg-primary/5 border-primary/30' :
                  bulk.selectedIds.has(lead.id) ? 'bg-primary/5 border-primary/30' :
                  'border-border/30 bg-card/30 hover:bg-card/50'
                }`}
              >
                {/* Primary Row */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <Checkbox
                    checked={bulk.selectedIds.has(lead.id)}
                    onCheckedChange={() => bulk.toggle(lead.id)}
                    aria-label={`Seleccionar ${lead.nombre}`}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                  />

                  {vista === "AGENDAS" ? (
                    <span className={`shrink-0 text-[9px] font-bold ${lead.tipo === "INTRO" ? "text-blue-400" : "text-purple-400"}`}>
                      {lead.tipo === "INTRO" ? "I" : "D"}
                    </span>
                  ) : (
                    <div className={`shrink-0 h-2 w-2 rounded-full ${
                      !lead.estadoLead || lead.estadoLead === "NUEVO" ? "bg-blue-400 animate-pulse" :
                      lead.estadoLead === "CONTACTADO" ? "bg-amber-400" :
                      lead.estadoLead === "CALIFICADO" ? "bg-green-400" :
                      lead.estadoLead === "DESCARTADO" ? "bg-red-400" : "bg-purple-400"
                    }`} />
                  )}

                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-xs text-foreground truncate block">{lead.nombre || "Sin nombre"}</span>
                  </div>

                  {vista === "AGENDAS" && lead.fecha && (
                    <span className={`text-[11px] shrink-0 ${isToday(new Date(lead.fecha)) ? "text-blue-400 font-semibold" : "text-muted-foreground"}`}>
                      {format(new Date(lead.fecha), "dd/MM HH:mm", { locale: es })}
                    </span>
                  )}

                  {lead.setterAsignado && (
                    <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">{lead.setterAsignado}</span>
                  )}

                  {/* Inline Outcome (AGENDAS) */}
                  {vista === "AGENDAS" && (
                    <Select
                      value={lead.outcome || "PENDIENTE"}
                      onValueChange={(v) => inlineUpdateMutation.mutate({ id: lead.id, data: { outcome: v } })}
                    >
                      <SelectTrigger className={`h-6 w-[100px] text-[10px] font-medium shrink-0 ${
                        lead.outcome === "VENTA" ? "text-green-500 border-green-500/30 bg-green-500/10" :
                        lead.outcome === "PERDIDA" ? "text-red-500 border-red-500/30 bg-red-500/10" :
                        lead.outcome === "SEGUIMIENTO" ? "text-amber-500 border-amber-500/30 bg-amber-500/10" :
                        "text-muted-foreground border-border/50"
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Estado Lead Badge (LEADS) */}
                  {vista === "LEADS" && <EstadoLeadBadge estado={lead.estadoLead} />}

                  {/* Confirmation toggle (AGENDAS) */}
                  {vista === "AGENDAS" && (
                    <button
                      onClick={() => {
                        const next = lead.estadoConfirmacion === "CONFIRMADA" ? "CANCELADA"
                          : lead.estadoConfirmacion === "CANCELADA" ? "PENDIENTE" : "CONFIRMADA";
                        inlineUpdateMutation.mutate({ id: lead.id, data: { estadoConfirmacion: next } });
                      }}
                      className={`shrink-0 h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors ${
                        lead.estadoConfirmacion === "CONFIRMADA" ? "text-green-500 bg-green-500/10" :
                        lead.estadoConfirmacion === "CANCELADA" ? "text-red-500 bg-red-500/10" :
                        "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                      title={`Confirmación: ${lead.estadoConfirmacion || "PENDIENTE"}`}
                    >
                      {lead.estadoConfirmacion === "CONFIRMADA" ? "✓" : lead.estadoConfirmacion === "CANCELADA" ? "✗" : "—"}
                    </button>
                  )}

                  {/* Attendance toggle (AGENDAS) */}
                  {vista === "AGENDAS" && (
                    <button
                      onClick={() => {
                        const next = lead.asistencia === "ASISTIÓ" ? "NO SHOW"
                          : lead.asistencia === "NO SHOW" ? "PENDIENTE" : "ASISTIÓ";
                        inlineUpdateMutation.mutate({ id: lead.id, data: { asistencia: next } });
                      }}
                      className={`shrink-0 h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors ${
                        lead.asistencia === "ASISTIÓ" ? "text-green-500 bg-green-500/10" :
                        lead.asistencia === "NO SHOW" ? "text-red-500 bg-red-500/10" :
                        "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                      title={`Asistencia: ${lead.asistencia || "PENDIENTE"}`}
                    >
                      {lead.asistencia === "ASISTIÓ" ? "✓" : lead.asistencia === "NO SHOW" ? "NS" : "—"}
                    </button>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => setEditingLead(lead)} className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (confirm("¿Eliminar este lead?")) deleteMutation.mutate({ id: lead.id }); }} className="p-1.5 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors" title="Eliminar">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Secondary Row */}
                <div className="flex items-center gap-3 px-3 pb-2 pl-9">
                  <span className="text-[10px] text-muted-foreground truncate">
                    {lead.correo || ""}{lead.correo && lead.telefono ? " · " : ""}{lead.telefono || ""}
                  </span>
                  <button onClick={() => setScorePopupLead(lead)} className="hover:opacity-80 shrink-0">
                    <ScoreBadge label={lead.scoreLabel} />
                  </button>
                  <ResponseTimeCell lead={lead} responseData={responseTimeMap.get(lead.id)} />
                  {alertLeadIds.has(lead.id) && (
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="Alerta: <3 intentos después de 48h" />
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                    className="ml-auto text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 shrink-0"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Más
                  </button>
                </div>

                {/* Expandable Panel */}
                {isExpanded && (
                  <div className="border-t border-border/20 px-3 py-3 space-y-3 bg-muted/5 rounded-b-lg">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">Contacto: </span>
                        <ContactoBadge resultado={lead.resultadoContacto} />
                      </div>
                      {vista === "AGENDAS" && (
                        <div>
                          <span className="text-muted-foreground">Closer: </span>
                          <span className="text-foreground/80">{lead.closer || "—"}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Origen: </span>
                        <span className="text-foreground/80">{lead.origen || "—"}</span>
                      </div>
                      {lead.mes && (
                        <div>
                          <span className="text-muted-foreground">{lead.mes} · Sem {lead.semana}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {lead.linkCRM && (
                        <a href={lead.linkCRM} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> CRM
                        </a>
                      )}
                      <AdPreviewCell lead={lead} />
                      <LeadCommentCell leadId={lead.id} leadName={lead.nombre || "Lead"} latestComment={latestCommentMap.get(lead.id)} />
                      {leadsWithAudits.has(lead.id) && (
                        <button onClick={() => navigate(`/auditoria?lead=${lead.id}`)} className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                          <Headphones className="h-3 w-3" /> Auditoría
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {vista === "LEADS" && lead.estadoLead !== "CONVERTIDO_AGENDA" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-[10px] gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={() => { if (confirm("¿Convertir este lead en una Agenda?")) handleConvertToAgenda(lead.id); }}
                        >
                          <CalendarCheck className="h-3 w-3" /> Convertir a Agenda
                        </Button>
                      )}
                      {vista === "AGENDAS" && lead.asistencia === "NO SHOW" && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => setNoShowLead(lead)}>
                          <AlertTriangle className="h-3 w-3" /> No-Show
                        </Button>
                      )}
                      {vista === "AGENDAS" && (lead.outcome === "SEGUIMIENTO" || lead.outcome === "PENDIENTE") && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-[10px] gap-1 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                          onClick={() => createFollowUpMutation.mutate({
                            leadId: lead.id,
                            nombre: lead.nombre || undefined,
                            correo: lead.correo || undefined,
                            telefono: lead.telefono || undefined,
                            instagram: lead.instagram || undefined,
                            closerAsignado: lead.closer || undefined,
                            tipo: "HOT",
                            prioridad: lead.scoreLabel === "HOT" ? "RED_HOT" : "HOT",
                          })}
                        >
                          <Flame className="h-3 w-3" /> Follow-Up
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Lead Sheet (side drawer with tabs + autosave) */}
      <LeadEditSheet
        lead={editingLead}
        onOpenChange={(open) => {
          if (!open) setEditingLead(null);
        }}
        onNoShow={(lead) => setNoShowLead(lead)}
      />

      {/* ── PROTOCOLO NO-SHOW MODAL ── */}
      {noShowLead && (
        <NoShowProtocolModal
          lead={noShowLead}
          onConfirm={(notas) => noShowMutation.mutate({ leadId: noShowLead.id, closerAsignado: noShowLead.closer, notas })}
          onClose={() => setNoShowLead(null)}
          isPending={noShowMutation.isPending}
        />
      )}

      {/* Score Detail Popup */}
      {scorePopupLead && (
        <Dialog open={!!scorePopupLead} onOpenChange={() => setScorePopupLead(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-400" />
                Score de Calificación
              </DialogTitle>
            </DialogHeader>
            <ScoreDetailPopup lead={scorePopupLead} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
// ============================================================
// SCORE DETAIL POPUP
// ============================================================
function ScoreDetailPopup({ lead }: { lead: any }) {
  // Try by leadId first
  const { data: scoringByLeadId, isLoading: loadingById } = trpc.scoring.getByLeadId.useQuery(
    { leadId: lead.id },
    { enabled: !!lead.id }
  );
  // Fallback: search by correo if leadId didn't return data with answers
  const needsCorreoFallback = !loadingById && (!scoringByLeadId || !scoringByLeadId.p1Frustracion) && !!lead.correo;
  const { data: scoringByCorreo, isLoading: loadingByCorreo } = trpc.scoring.getByCorreo.useQuery(
    { correo: lead.correo || "" },
    { enabled: needsCorreoFallback }
  );
  const isLoading = loadingById || (needsCorreoFallback && loadingByCorreo);
  const scoringData = (scoringByLeadId?.p1Frustracion ? scoringByLeadId : scoringByCorreo) || scoringByLeadId;
  const effectiveScore = scoringData?.scoreFinal ?? lead.score;
  const effectiveLabel = scoringData?.scoreLabel ?? lead.scoreLabel;

  const scoreColorClass = (label: string | null) => {
    if (label === "HOT") return "from-red-500/20 to-red-600/10 border-red-500/40";
    if (label === "WARM") return "from-orange-500/20 to-orange-600/10 border-orange-500/40";
    if (label === "TIBIO") return "from-yellow-500/20 to-yellow-600/10 border-yellow-500/40";
    return "from-blue-500/20 to-blue-600/10 border-blue-500/40";
  };

  return (
    <div className="space-y-4 mt-2">
      {/* Lead Info Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{lead.nombre || "Lead sin nombre"}</p>
          <p className="text-xs text-muted-foreground">{lead.correo || lead.telefono || "Sin contacto"}</p>
        </div>
        <div className="text-right">
          <ScoreBadge label={effectiveLabel} />
          {effectiveScore && <p className="text-[10px] text-muted-foreground mt-1">Puntuación: {effectiveScore}/4</p>}
        </div>
      </div>

      {/* Score Visual Bar */}
      <div className={`rounded-lg border bg-gradient-to-r ${scoreColorClass(effectiveLabel)} p-4`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nivel de Calificación</span>
          <span className="text-lg font-bold">{effectiveLabel || "Sin score"}</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={`h-2 flex-1 rounded-full transition-all ${
                effectiveScore && effectiveScore >= level
                  ? level === 4 ? "bg-red-500" : level === 3 ? "bg-orange-500" : level === 2 ? "bg-yellow-500" : "bg-blue-500"
                  : "bg-muted/30"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">FRÍO</span>
          <span className="text-[9px] text-muted-foreground">TIBIO</span>
          <span className="text-[9px] text-muted-foreground">WARM</span>
          <span className="text-[9px] text-muted-foreground">HOT</span>
        </div>
      </div>

      {/* Universal Prospect Profile */}
      <ProspectProfile leadId={lead.id} />
    </div>
  );
}


// ============================================================
// LEAD COMMENT CELL (ClickUp-style inline comments)
// ============================================================
// AD PREVIEW CELL - Shows which ad brought the lead
// ============================================================
function AdPreviewCell({ lead }: { lead: any }) {
  const hasUtm = lead.utmCampaign || lead.utmContent;
  
  if (!hasUtm) {
    return (
      <span className="text-muted-foreground/30">
        <Megaphone className="h-3.5 w-3.5 mx-auto" />
      </span>
    );
  }

  // Try to get ad name from the cached ads
  const adName = lead.utmContent ? `Ad ${lead.utmContent.slice(-6)}` : null;
  const campaignName = lead.utmCampaign || "";
  const adsetName = lead.utmTerm || "";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="relative p-1 rounded-md text-primary hover:bg-primary/15 transition-colors">
          <Megaphone className="h-3.5 w-3.5" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-[280px] p-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-foreground/90 uppercase tracking-wider">Origen del Lead</p>
        {campaignName && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0 w-14">Campaña:</span>
            <span className="text-[10px] text-foreground font-medium break-words">{campaignName}</span>
          </div>
        )}
        {adsetName && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0 w-14">Adset:</span>
            <span className="text-[10px] text-foreground font-medium break-words">{adsetName}</span>
          </div>
        )}
        {lead.utmContent && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0 w-14">Anuncio:</span>
            <span className="text-[10px] text-foreground font-medium break-words">{lead.utmContent}</span>
          </div>
        )}
        {lead.utmSource && (
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] text-muted-foreground shrink-0 w-14">Fuente:</span>
            <span className="text-[10px] text-foreground font-medium">{lead.utmSource}</span>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================
// LEAD COMMENT CELL
// ============================================================
const ROLE_COLORS: Record<string, string> = {
  admin: "text-purple-400",
  setter: "text-blue-400",
  closer: "text-emerald-400",
};

const ROLE_LABELS_COMMENT: Record<string, string> = {
  admin: "Admin",
  setter: "Setter",
  closer: "Closer",
};

/** Render comment text with @mentions highlighted */
function CommentText({ text }: { text: string }) {
  // Match @[Name](id) pattern
  const parts = text.split(/(@\[[^\]]+\]\(\d+\))/);
  return (
    <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, i) => {
        const mentionMatch = part.match(/@\[([^\]]+)\]\(\d+\)/);
        if (mentionMatch) {
          return (
            <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">
              @{mentionMatch[1]}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function LeadCommentCell({ leadId, leadName, latestComment }: {
  leadId: number;
  leadName: string;
  latestComment?: { texto: string; autor: string; createdAt: Date | string };
}) {
  const [open, setOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  // Fetch full comment thread when popover is open
  const { data: comments, isLoading } = trpc.comments.list.useQuery(
    { leadId },
    { enabled: open }
  );

  // Fetch CRM users for @mention autocomplete
  const { data: crmUsers = [] } = trpc.comments.users.useQuery(undefined, {
    enabled: open,
  });

  const createMutation = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ leadId });
      utils.comments.latestForLeads.invalidate();
      utils.notifications.unreadCount.invalidate();
      setNewComment("");
      toast.success("Comentario agregado");
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.list.invalidate({ leadId });
      utils.comments.latestForLeads.invalidate();
      toast.success("Comentario eliminado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createMutation.mutate({
      leadId,
      texto: newComment.trim(),
      leadName,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);
    // Check if user is typing @mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^@\s]*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
      setMentionFilter("");
    }
  };

  const insertMention = (user: { id: number; name: string | null }) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = newComment.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex === -1) return;
    const userName = user.name || "Usuario";
    const mention = `@[${userName}](${user.id}) `;
    const newText = newComment.slice(0, atIndex) + mention + newComment.slice(cursorPos);
    setNewComment(newText);
    setShowMentions(false);
    setMentionFilter("");
    // Refocus textarea
    setTimeout(() => {
      textarea.focus();
      const newPos = atIndex + mention.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const filteredUsers = (crmUsers as any[]).filter((u: any) =>
    !mentionFilter || (u.name || u.email || "").toLowerCase().includes(mentionFilter)
  );

  const commentsList = (comments as any[] || []).slice().reverse(); // oldest first
  const hasComments = !!latestComment;
  const previewText = latestComment?.texto || "";

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.[0] || "?").toUpperCase();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`relative p-1.5 rounded-md transition-colors ${
            hasComments
              ? "text-primary hover:bg-primary/15"
              : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30"
          }`}
          title={hasComments ? `Último: ${previewText.slice(0, 60)}...` : "Agregar comentario"}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {hasComments && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="left"
        className="w-[340px] p-0 bg-popover text-popover-foreground border-border shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
          <MessageCircle className="h-4 w-4 text-primary" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate block">{leadName}</span>
            <span className="text-[10px] text-muted-foreground">Conversación del equipo</span>
          </div>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0">
            {isLoading ? "..." : commentsList.length}
          </Badge>
        </div>

        {/* Comments thread */}
        <div ref={scrollRef} className="max-h-[320px] overflow-y-auto px-3 py-2 space-y-2.5">
          {isLoading ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Cargando...</div>
          ) : commentsList.length === 0 ? (
            <div className="text-center py-6">
              <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground">Sin comentarios aún</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Usa @nombre para mencionar a alguien</p>
            </div>
          ) : (
            commentsList.map((comment: any) => (
              <div key={comment.id} className="group relative flex gap-2">
                {/* Avatar */}
                <div className="shrink-0 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center mt-0.5">
                  <span className={`text-[10px] font-bold ${ROLE_COLORS[comment.autorRole] || "text-primary"}`}>
                    {getInitials(comment.autor)}
                  </span>
                </div>
                {/* Message bubble */}
                <div className="flex-1 min-w-0 rounded-lg bg-muted/20 border border-border/20 px-2.5 py-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-foreground/80">{comment.autor}</span>
                      {comment.autorRole && (
                        <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${ROLE_COLORS[comment.autorRole] || "text-muted-foreground"} bg-muted/40`}>
                          {ROLE_LABELS_COMMENT[comment.autorRole] || comment.autorRole}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(comment.createdAt).toLocaleString("es-ES", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                      <button
                        onClick={() => { if (confirm("¿Eliminar este comentario?")) deleteMutation.mutate({ id: comment.id }); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-muted-foreground/40 hover:text-red-400 transition-all"
                        title="Eliminar comentario"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                  <CommentText text={comment.texto} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* New comment input with @mention autocomplete */}
        <div className="border-t border-border/50 px-3 py-2 relative">
          {/* @Mention dropdown */}
          {showMentions && filteredUsers.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-[140px] overflow-y-auto z-50">
              {filteredUsers.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => insertMention(u)}
                  className="w-full text-left px-3 py-1.5 hover:bg-accent/50 flex items-center gap-2 transition-colors"
                >
                  <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className={`text-[9px] font-bold ${ROLE_COLORS[u.role] || "text-primary"}`}>
                      {getInitials(u.name || u.email || "?")}
                    </span>
                  </div>
                  <span className="text-xs text-foreground truncate">{u.name || u.email}</span>
                  <span className={`text-[9px] ml-auto ${ROLE_COLORS[u.role] || "text-muted-foreground"}`}>
                    {ROLE_LABELS_COMMENT[u.role] || u.role}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un comentario... Usa @ para mencionar"
              className="flex-1 resize-none text-xs bg-muted/20 border border-border/30 rounded-md px-2.5 py-1.5 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 min-h-[32px] max-h-[80px]"
              rows={1}
            />
            <button
              onClick={handleSubmit}
              disabled={!newComment.trim() || createMutation.isPending}
              className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Enviar comentario (Enter)"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1">Enter para enviar · @ para mencionar · Shift+Enter nueva línea</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
// ============================================================
// RESPONSE TIME CELL - Visual indicator in table
// Green: 0-30min, Yellow: 30min-3hrs, Red: 3+ hrs
// Shows live timer for leads without contact attempts
// ============================================================
function ResponseTimeCell({ lead, responseData }: { lead: any; responseData?: { firstAttempt: Date | string | null; attemptCount: number } }) {
  const [now, setNow] = useState(() => Date.now());
  
  // Determine if this lead has been contacted:
  // 1. Has a registered contact attempt (firstAttempt)
  // 2. Has fechaPrimerContacto set
  // 3. Has resultadoContacto != PENDIENTE (historical data where result was set directly)
  const CONTACTED_RESULTS = ["CONTEST\u00d3", "NO CONTEST\u00d3", "BUZ\u00d3N", "N\u00daMERO INV\u00c1LIDO", "WHATSAPP LIMPIADO", "MENSAJE ENVIADO"];
  const hasResultadoContacto = lead.resultadoContacto && CONTACTED_RESULTS.includes(lead.resultadoContacto);
  const hasContact = responseData?.firstAttempt != null || lead.fechaPrimerContacto != null || hasResultadoContacto;
  const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
  
  // Live timer: update every 30 seconds for uncontacted leads
  useEffect(() => {
    if (hasContact || !leadDate) return;
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [hasContact, leadDate]);
  
  if (!leadDate) return <span className="text-muted-foreground/40 text-[10px]">—</span>;
  
  // If contacted, calculate response time from lead date to first contact
  if (hasContact) {
    // Priority: registered attempt > fechaPrimerContacto > resultadoContacto (no timestamp available)
    const firstContactDate = responseData?.firstAttempt 
      ? new Date(responseData.firstAttempt) 
      : lead.fechaPrimerContacto 
        ? new Date(lead.fechaPrimerContacto) 
        : null;
    
    // If contacted but no timestamp (historical data with only resultadoContacto set)
    // Show a neutral "contactado" badge without time
    if (!firstContactDate) {
      const resultLabel = lead.resultadoContacto === "CONTEST\u00d3" ? "Contest\u00f3" 
        : lead.resultadoContacto === "NO CONTEST\u00d3" ? "No contest\u00f3"
        : lead.resultadoContacto === "BUZ\u00d3N" ? "Buz\u00f3n"
        : "Contactado";
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border text-blue-400 bg-blue-500/10 border-blue-500/30">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {resultLabel}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>Resultado: {lead.resultadoContacto}</p>
            <p className="text-muted-foreground">Sin registro de hora exacta de contacto</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    
    if (firstContactDate <= leadDate) return <span className="text-muted-foreground/40 text-[10px]">—</span>;

    const hours = calculateBusinessHours(leadDate, firstContactDate);
    const minutes = hours * 60;
    
    // Color coding: green ≤30min, yellow 30min-3hrs, red >3hrs
    const colorClass = minutes <= 30 ? "text-green-400 bg-green-500/10 border-green-500/30" 
      : hours <= 3 ? "text-amber-400 bg-amber-500/10 border-amber-500/30" 
      : "text-red-400 bg-red-500/10 border-red-500/30";
    
    const label = minutes < 60 ? `${Math.round(minutes)}m` : `${hours.toFixed(1)}h`;
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${colorClass}`}>
            <CheckCircle2 className="h-2.5 w-2.5" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>Tiempo de respuesta (hábil): {minutes < 60 ? `${Math.round(minutes)} minutos` : `${hours.toFixed(1)} horas`}</p>
          <p className="text-muted-foreground">1er contacto: {firstContactDate.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          {responseData?.attemptCount && <p className="text-muted-foreground">{responseData.attemptCount} intento(s) total</p>}
        </TooltipContent>
      </Tooltip>
    );
  }
  
  // Not contacted yet: show live elapsed timer (business hours)
  const elapsedHours = calculateBusinessHours(leadDate, new Date(now));
  if (elapsedHours <= 0) return <span className="text-muted-foreground/40 text-[10px]">—</span>;

  const elapsedMinutes = elapsedHours * 60;
  
  // Color coding for live timer
  const colorClass = elapsedMinutes <= 30 ? "text-green-400 bg-green-500/10 border-green-500/30" 
    : elapsedHours <= 3 ? "text-amber-400 bg-amber-500/10 border-amber-500/30" 
    : "text-red-400 bg-red-500/10 border-red-500/30";
  
  const label = elapsedMinutes < 60 ? `${Math.round(elapsedMinutes)}m` 
    : elapsedHours < 24 ? `${elapsedHours.toFixed(1)}h` 
    : `${Math.floor(elapsedHours / 24)}d`;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border animate-pulse ${colorClass}`}>
          <Clock className="h-2.5 w-2.5" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">Sin contactar</p>
        <p>Tiempo hábil transcurrido: {elapsedMinutes < 60 ? `${Math.round(elapsedMinutes)} minutos` : `${elapsedHours.toFixed(1)} horas`}</p>
        <p className="text-muted-foreground">Entrada: {leadDate.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================
// NO-SHOW PROTOCOL MODAL
// Checklist interactivo para el protocolo de No-Show
// ============================================================
const NO_SHOW_STEPS = [
  { id: 1, icon: "⏱️", label: "Esperar 3 minutos", desc: "Dale tiempo al lead antes de actuar" },
  { id: 2, icon: "📞", label: "Llamar al número registrado", desc: "Primera llamada directa" },
  { id: 3, icon: "🔁", label: "Double dial", desc: "Llamar nuevamente si no contestó" },
  { id: 4, icon: "💬", label: "Enviar texto de seguimiento", desc: "WhatsApp o SMS: '¿Sigues disponible?'" },
  { id: 5, icon: "📱", label: "Llamar desde número personal", desc: "Intentar desde otro número" },
  { id: 6, icon: "✉️", label: "Mensaje final de re-enganche", desc: "Ofrecer reagendar la demo" },
];

function NoShowProtocolModal({
  lead,
  onConfirm,
  onClose,
  isPending,
}: {
  lead: any;
  onConfirm: (notas: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [notas, setNotas] = useState("");

  const toggle = (id: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progress = Math.round((checked.size / NO_SHOW_STEPS.length) * 100);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Protocolo No-Show — {lead.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Barra de progreso */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Pasos completados</span>
              <span className="font-medium">{checked.size}/{NO_SHOW_STEPS.length}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {NO_SHOW_STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => toggle(step.id)}
                className={`w-full flex items-start gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  checked.has(step.id)
                    ? "bg-green-500/10 border-green-500/30 text-foreground"
                    : "bg-muted/20 border-border/50 hover:bg-muted/40"
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                  checked.has(step.id) ? "bg-green-500 border-green-500" : "border-muted-foreground/40"
                }`}>
                  {checked.has(step.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{step.icon}</span>
                    <span className={`text-xs font-medium ${checked.has(step.id) ? "line-through text-muted-foreground" : ""}`}>
                      {step.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Notas opcionales */}
          <div>
            <Label className="text-xs text-muted-foreground">Notas del protocolo (opcional)</Label>
            <Textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Ej: No contestó en ninguno de los intentos, envié mensaje de reagendamiento..."
              className="mt-1 text-xs resize-none h-16 bg-background/50"
            />
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1 text-xs" disabled={isPending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => onConfirm(notas)}
              disabled={isPending}
              className="flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isPending ? "Procesando..." : "Confirmar No-Show → Follow-Up"}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            El lead será movido a Follow-Ups con prioridad <span className="text-red-400 font-semibold">RED_HOT</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
