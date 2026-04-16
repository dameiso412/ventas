/**
 * Contactos > Todos — unified contact database with per-lead journey timeline.
 *
 * Linear-style split view:
 *   - Left: filterable, searchable list of all leads (compact cards)
 *   - Right: detail panel for the selected lead with header, key metrics,
 *            and a vertical chronological timeline of everything that
 *            happened (lead creation, calls, comments, follow-ups,
 *            scoring, triage, confirmation, attendance, outcome).
 *
 * Timeline data is aggregated server-side in `contactos.getTimeline` to keep
 * the network chatter down.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadEditSheet } from "@/components/LeadEditSheet";
import {
  Search, Users, Mail, Phone as PhoneIcon, Instagram as IgIcon, Calendar,
  Pencil,
  // Timeline icons
  UserPlus, PhoneCall, MessageCircle, Mail as MailIcon,
  CheckCircle2, XCircle, RefreshCw, ClipboardCheck, AlertCircle,
  DollarSign, RotateCcw, Flame, MessageSquare, Star, FileText,
  Phone as PhoneFallback,
} from "lucide-react";

function scoreBadgeColor(label: string | null | undefined): string {
  switch (label) {
    case "HOT": return "bg-rose-500/15 text-rose-500 border-rose-500/30";
    case "WARM": return "bg-orange-500/15 text-orange-500 border-orange-500/30";
    case "TIBIO": return "bg-amber-500/15 text-amber-500 border-amber-500/30";
    case "FRÍO": return "bg-sky-500/15 text-sky-500 border-sky-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function confirmacionColor(estado: string | null | undefined): string {
  switch (estado) {
    case "CONFIRMADA": return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
    case "CANCELADA": return "bg-rose-500/15 text-rose-500 border-rose-500/30";
    case "REAGENDADA": return "bg-sky-500/15 text-sky-500 border-sky-500/30";
    case "NO CONFIRMADA": return "bg-amber-500/15 text-amber-500 border-amber-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function outcomeColor(outcome: string | null | undefined): string {
  switch (outcome) {
    case "VENTA": return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
    case "PERDIDA": return "bg-rose-500/15 text-rose-500 border-rose-500/30";
    case "SEGUIMIENTO": return "bg-sky-500/15 text-sky-500 border-sky-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

/** Map Lucide icon name (string) → component used for timeline event rendering. */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  UserPlus, PhoneCall, MessageCircle, Phone: PhoneFallback, Mail: MailIcon,
  Instagram: IgIcon, CheckCircle2, XCircle, RefreshCw, ClipboardCheck,
  AlertCircle, DollarSign, RotateCcw, Flame, MessageSquare, Star, FileText,
};

/** Event kind → accent color for the timeline bullet dot. */
const KIND_ACCENT: Record<string, string> = {
  lead_created: "bg-violet-500",
  first_contact: "bg-sky-500",
  contact_attempt: "bg-sky-500",
  confirmation: "bg-emerald-500",
  triage: "bg-amber-500",
  attendance: "bg-emerald-500",
  outcome: "bg-emerald-500",
  follow_up_created: "bg-rose-500",
  follow_up_log: "bg-rose-500",
  comment: "bg-slate-500",
  scoring: "bg-amber-500",
  data_entry: "bg-slate-500",
};

function formatUSD(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v === 0) return "—";
  return `$${Math.round(v).toLocaleString()}`;
}

function formatDate(iso: string | Date | null | undefined, opts?: { withTime?: boolean }): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (!Number.isFinite(d.getTime())) return "—";
  const datePart = d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  if (!opts?.withTime) return datePart;
  const timePart = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

export default function ContactosTodos() {
  const [search, setSearch] = useState("");
  const [origenFilter, setOrigenFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);

  const listFilters = useMemo(() => ({
    origen: origenFilter !== "all" ? origenFilter : undefined,
    scoreLabel: scoreFilter !== "all" ? scoreFilter : undefined,
    outcome: outcomeFilter !== "all" ? outcomeFilter : undefined,
  }), [origenFilter, scoreFilter, outcomeFilter]);

  const { data: leadsList, isLoading: listLoading } = trpc.leads.list.useQuery(listFilters);

  // Client-side search filter on name/email/phone/instagram
  const filteredLeads = useMemo(() => {
    if (!leadsList) return [];
    const q = search.trim().toLowerCase();
    if (!q) return leadsList;
    return leadsList.filter((l: any) =>
      [l.nombre, l.correo, l.telefono, l.instagram]
        .filter(Boolean)
        .some((f: string) => String(f).toLowerCase().includes(q))
    );
  }, [leadsList, search]);

  // Auto-select the first lead when list loads
  const effectiveSelectedId = selectedId ?? filteredLeads[0]?.id ?? null;

  const { data: timelineData, isLoading: timelineLoading } = trpc.contactos.getTimeline.useQuery(
    { leadId: effectiveSelectedId! },
    { enabled: effectiveSelectedId != null }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Base de Contactos</h1>
          <p className="text-sm text-muted-foreground">
            Vista unificada de todos los leads con trayectoria, notas e historial de actividad.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {filteredLeads.length} {filteredLeads.length === 1 ? "contacto" : "contactos"}
        </Badge>
      </div>

      {/* Split-view container */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_2fr] gap-4 min-h-[calc(100vh-240px)]">
        {/* LEFT — contact list */}
        <Card className="bg-card/50 border-border/50 flex flex-col">
          {/* Filters */}
          <div className="p-3 border-b border-border/50 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nombre, correo, teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-background/50"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select value={origenFilter} onValueChange={setOrigenFilter}>
                <SelectTrigger className="h-8 bg-background/50 text-xs"><SelectValue placeholder="Origen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Origen</SelectItem>
                  <SelectItem value="ADS">Ads</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="REFERIDO">Referido</SelectItem>
                  <SelectItem value="ORGANICO">Orgánico</SelectItem>
                </SelectContent>
              </Select>
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger className="h-8 bg-background/50 text-xs"><SelectValue placeholder="Score" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Score</SelectItem>
                  <SelectItem value="HOT">HOT</SelectItem>
                  <SelectItem value="WARM">WARM</SelectItem>
                  <SelectItem value="TIBIO">TIBIO</SelectItem>
                  <SelectItem value="FRÍO">FRÍO</SelectItem>
                </SelectContent>
              </Select>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="h-8 bg-background/50 text-xs"><SelectValue placeholder="Outcome" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Outcome</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="VENTA">Venta</SelectItem>
                  <SelectItem value="PERDIDA">Pérdida</SelectItem>
                  <SelectItem value="SEGUIMIENTO">Seguimiento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            {listLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 text-sm text-muted-foreground p-4 text-center">
                <Users className="h-10 w-10 mb-2 opacity-40" />
                <p>No se encontraron contactos con esos filtros.</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredLeads.map((lead: any) => (
                  <ContactListItem
                    key={lead.id}
                    lead={lead}
                    active={effectiveSelectedId === lead.id}
                    onSelect={() => setSelectedId(lead.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* RIGHT — detail panel */}
        <Card className="bg-card/50 border-border/50 flex flex-col overflow-hidden">
          {effectiveSelectedId == null ? (
            <div className="flex flex-col items-center justify-center flex-1 text-sm text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p>Selecciona un contacto para ver su trayectoria.</p>
            </div>
          ) : timelineLoading || !timelineData ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-64" />
            </div>
          ) : (
            <ContactDetail
              data={timelineData}
              onEdit={() => setEditingLead(timelineData.lead)}
            />
          )}
        </Card>
      </div>

      {/* Lead Edit Sheet */}
      <LeadEditSheet
        lead={editingLead}
        onOpenChange={(open) => { if (!open) setEditingLead(null); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ContactListItem({ lead, active, onSelect }: {
  lead: any;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-2.5 rounded-md border transition-colors ${
        active
          ? "bg-primary/10 border-primary/40"
          : "bg-transparent border-transparent hover:bg-muted/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-medium text-sm truncate flex-1">{lead.nombre || "—"}</p>
        {lead.scoreLabel && (
          <Badge variant="outline" className={`${scoreBadgeColor(lead.scoreLabel)} text-[10px] px-1.5 py-0 shrink-0`}>
            {lead.scoreLabel}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
        {lead.origen && <span className="uppercase tracking-wide">{lead.origen}</span>}
        {lead.correo && <>· <span className="truncate">{lead.correo}</span></>}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {lead.estadoConfirmacion && lead.estadoConfirmacion !== "PENDIENTE" && (
          <Badge variant="outline" className={`${confirmacionColor(lead.estadoConfirmacion)} text-[9px] px-1.5 py-0`}>
            {lead.estadoConfirmacion}
          </Badge>
        )}
        {lead.outcome && lead.outcome !== "PENDIENTE" && (
          <Badge variant="outline" className={`${outcomeColor(lead.outcome)} text-[9px] px-1.5 py-0`}>
            {lead.outcome}
          </Badge>
        )}
      </div>
    </button>
  );
}

function ContactDetail({ data, onEdit }: {
  data: { lead: any; events: any[] };
  onEdit: () => void;
}) {
  const { lead, events } = data;

  return (
    <>
      {/* Header */}
      <div className="p-5 border-b border-border/50 shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-xl font-bold truncate">{lead.nombre || "—"}</h2>
              {lead.scoreLabel && (
                <Badge variant="outline" className={scoreBadgeColor(lead.scoreLabel)}>
                  {lead.scoreLabel}{lead.score != null ? ` · ${lead.score}` : ""}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {lead.origen && <span className="uppercase">{lead.origen}</span>}
              {lead.tipo && <>· <span>{lead.tipo}</span></>}
              {lead.fecha && <>· <span>Agenda: {formatDate(lead.fecha)}</span></>}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5 shrink-0">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>

        {/* Contact strip */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {lead.correo && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{lead.correo}</span>}
          {lead.telefono && <span className="flex items-center gap-1.5"><PhoneIcon className="h-3.5 w-3.5 text-muted-foreground" />{lead.telefono}</span>}
          {lead.instagram && <span className="flex items-center gap-1.5"><IgIcon className="h-3.5 w-3.5 text-muted-foreground" />@{lead.instagram}</span>}
          {lead.setterAsignado && <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" />Setter: {lead.setterAsignado}</span>}
          {lead.closer && <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" />Closer: {lead.closer}</span>}
        </div>

        {/* State chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {lead.estadoConfirmacion && (
            <Badge variant="outline" className={`${confirmacionColor(lead.estadoConfirmacion)} text-[10px]`}>
              Conf: {lead.estadoConfirmacion}
            </Badge>
          )}
          {lead.asistencia && lead.asistencia !== "PENDIENTE" && (
            <Badge variant="outline" className="text-[10px]">
              Asistencia: {lead.asistencia}
            </Badge>
          )}
          {lead.outcome && (
            <Badge variant="outline" className={`${outcomeColor(lead.outcome)} text-[10px]`}>
              {lead.outcome}
            </Badge>
          )}
          {Number(lead.cashCollected ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              Cash: {formatUSD(lead.cashCollected)}
            </Badge>
          )}
          {Number(lead.contractedRevenue ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px]">
              Contratado: {formatUSD(lead.contractedRevenue)}
            </Badge>
          )}
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Trayectoria</h3>
            <Badge variant="outline" className="text-[10px] ml-auto">
              {events.length} {events.length === 1 ? "evento" : "eventos"}
            </Badge>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Sin actividad registrada para este contacto.
            </div>
          ) : (
            <ol className="relative border-l border-border/60 space-y-5 ml-2 pl-6">
              {events.map((e, i) => {
                const Icon = (e.icon && ICON_MAP[e.icon]) || PhoneFallback;
                const dotClass = KIND_ACCENT[e.kind] || "bg-muted-foreground";
                return (
                  <li key={`${e.kind}-${i}-${e.timestamp}`} className="relative">
                    {/* Dot */}
                    <span className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${dotClass}`}>
                      <Icon className="h-2.5 w-2.5 text-white" />
                    </span>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-medium">{e.title}</p>
                        <time className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatDate(e.timestamp, { withTime: true })}
                        </time>
                      </div>
                      {e.detail && (
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {e.detail}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
