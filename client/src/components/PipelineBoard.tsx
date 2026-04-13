import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, CheckCircle2, XCircle, AlertTriangle, UserCheck, ArrowRightLeft, DollarSign, ChevronDown, Megaphone, User, Phone } from "lucide-react";
import { ScoreBadge, ContactoBadge } from "@/components/LeadBadges";

// --- Stage definitions ---

interface StageConfig {
  key: string;
  label: string;
  dot: string;   // tailwind bg color for the dot
  text: string;   // tailwind text color
  bg: string;     // tailwind bg for count badge
}

const AGENDAS_STAGES: StageConfig[] = [
  { key: "PENDIENTE",    label: "Pendiente",    dot: "bg-slate-400",   text: "text-slate-400",   bg: "bg-slate-500/20" },
  { key: "CONFIRMADA",   label: "Confirmada",   dot: "bg-blue-400",    text: "text-blue-400",    bg: "bg-blue-500/20" },
  { key: "CANCELADA",    label: "Cancelada",    dot: "bg-red-400",     text: "text-red-400",     bg: "bg-red-500/20" },
  { key: "NO_SHOW",      label: "No Show",      dot: "bg-orange-400",  text: "text-orange-400",  bg: "bg-orange-500/20" },
  { key: "ASISTIO",      label: "Asistio",      dot: "bg-green-400",   text: "text-green-400",   bg: "bg-green-500/20" },
  { key: "SEGUIMIENTO",  label: "Seguimiento",  dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-500/20" },
  { key: "VENTA",        label: "Venta",        dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/20" },
  { key: "PERDIDA",      label: "Perdida",      dot: "bg-red-400",     text: "text-red-400",     bg: "bg-red-500/20" },
];

const LEADS_STAGES: StageConfig[] = [
  { key: "NUEVO",              label: "Nuevo",      dot: "bg-blue-400",   text: "text-blue-400",   bg: "bg-blue-500/20" },
  { key: "CONTACTADO",         label: "Contactado", dot: "bg-amber-400",  text: "text-amber-400",  bg: "bg-amber-500/20" },
  { key: "CALIFICADO",         label: "Calificado", dot: "bg-green-400",  text: "text-green-400",  bg: "bg-green-500/20" },
  { key: "CONVERTIDO_AGENDA",  label: "Convertido", dot: "bg-purple-400", text: "text-purple-400", bg: "bg-purple-500/20" },
  { key: "DESCARTADO",         label: "Descartado", dot: "bg-red-400",    text: "text-red-400",    bg: "bg-red-500/20" },
];

// --- Helpers ---

function getAgendaPipelineStage(lead: any): string {
  if (lead.outcome === "VENTA") return "VENTA";
  if (lead.outcome === "PERDIDA") return "PERDIDA";
  if (lead.outcome === "SEGUIMIENTO") return "SEGUIMIENTO";
  if (lead.asistencia === "NO SHOW") return "NO_SHOW";
  if (lead.asistencia === "ASISTIÓ") return "ASISTIO";
  if (lead.estadoConfirmacion === "CANCELADA") return "CANCELADA";
  if (lead.estadoConfirmacion === "CONFIRMADA") return "CONFIRMADA";
  return "PENDIENTE";
}

function getLeadValue(lead: any): number {
  const cc = parseFloat(lead.cashCollected || "0");
  if (cc > 0) return cc;
  const cr = parseFloat(lead.contractedRevenue || "0");
  if (cr > 0) return cr;
  return parseFloat(lead.facturado || "0");
}

function formatUSD(amount: number): string {
  if (amount === 0) return "$0";
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const SCORE_BORDER: Record<string, string> = {
  HOT: "border-l-red-500",
  WARM: "border-l-orange-500",
  TIBIO: "border-l-amber-500",
  "FRÍO": "border-l-blue-500",
};

// --- Components ---

const INITIAL_VISIBLE = 20;

interface PipelineBoardProps {
  leads: any[];
  vista: "AGENDAS" | "LEADS";
  onEditLead: (lead: any) => void;
}

export function PipelineBoard({ leads, vista, onEditLead }: PipelineBoardProps) {
  const stages = vista === "AGENDAS" ? AGENDAS_STAGES : LEADS_STAGES;
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());

  const columnData = useMemo(() => {
    const grouped = new Map<string, any[]>();
    for (const stage of stages) {
      grouped.set(stage.key, []);
    }

    for (const lead of leads) {
      const stageKey = vista === "AGENDAS"
        ? getAgendaPipelineStage(lead)
        : (lead.estadoLead || "NUEVO");
      const arr = grouped.get(stageKey);
      if (arr) arr.push(lead);
      else grouped.get(stages[0].key)!.push(lead);
    }

    return stages.map(stage => {
      const stageLeads = grouped.get(stage.key) || [];
      const total = stageLeads.reduce((sum, lead) => sum + getLeadValue(lead), 0);
      return { ...stage, leads: stageLeads, count: stageLeads.length, total };
    });
  }, [leads, vista, stages]);

  const toggleExpand = (key: string) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max px-1">
        {columnData.map(col => (
          <PipelineColumn
            key={col.key}
            stage={col}
            leads={col.leads}
            count={col.count}
            total={col.total}
            vista={vista}
            expanded={expandedColumns.has(col.key)}
            onToggleExpand={() => toggleExpand(col.key)}
            onEditLead={onEditLead}
          />
        ))}
      </div>
    </div>
  );
}

interface PipelineColumnProps {
  stage: StageConfig;
  leads: any[];
  count: number;
  total: number;
  vista: "AGENDAS" | "LEADS";
  expanded: boolean;
  onToggleExpand: () => void;
  onEditLead: (lead: any) => void;
}

function PipelineColumn({ stage, leads, count, total, vista, expanded, onToggleExpand, onEditLead }: PipelineColumnProps) {
  const visibleLeads = expanded ? leads : leads.slice(0, INITIAL_VISIBLE);
  const hiddenCount = leads.length - visibleLeads.length;

  return (
    <div className="w-[280px] flex flex-col bg-muted/10 rounded-lg border border-border/30">
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/20">
        <div className={`h-2.5 w-2.5 rounded-full ${stage.dot} shrink-0`} />
        <span className="text-sm font-semibold text-foreground truncate">{stage.label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stage.bg} ${stage.text}`}>
          {count}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
          {formatUSD(total)}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-300px)] p-2 space-y-1.5">
        {visibleLeads.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/50 text-center py-6">Sin leads</p>
        ) : (
          visibleLeads.map(lead => (
            <PipelineCard key={lead.id} lead={lead} vista={vista} onEdit={onEditLead} />
          ))
        )}
        {hiddenCount > 0 && (
          <button
            onClick={onToggleExpand}
            className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1.5 flex items-center justify-center gap-1 transition-colors"
          >
            <ChevronDown className="h-3 w-3" />
            +{hiddenCount} mas
          </button>
        )}
        {expanded && leads.length > INITIAL_VISIBLE && (
          <button
            onClick={onToggleExpand}
            className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1.5 flex items-center justify-center gap-1 transition-colors"
          >
            Mostrar menos
          </button>
        )}
      </div>
    </div>
  );
}

interface PipelineCardProps {
  lead: any;
  vista: "AGENDAS" | "LEADS";
  onEdit: (lead: any) => void;
}

function PipelineCard({ lead, vista, onEdit }: PipelineCardProps) {
  const borderColor = SCORE_BORDER[lead.scoreLabel] || "border-l-border";
  const value = getLeadValue(lead);

  return (
    <div
      onClick={() => onEdit(lead)}
      className={`rounded-md border border-border/30 border-l-2 ${borderColor} bg-card/40 p-2.5 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-colors`}
    >
      {/* Line 1: Name + Score */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-medium text-foreground truncate flex-1">
          {lead.nombre || "Sin nombre"}
        </span>
        <div className="shrink-0 scale-90 origin-right">
          <ScoreBadge label={lead.scoreLabel} />
        </div>
      </div>

      {/* Line 2: Origin + Value */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
        <span className="truncate">{lead.origen || "—"}</span>
        {value > 0 && (
          <>
            <span>·</span>
            <span className="text-emerald-400 font-medium">${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          </>
        )}
      </div>

      {/* Line 3: Setter + Date/Badge */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {lead.setterAsignado ? (
          <span className="truncate">{lead.setterAsignado}</span>
        ) : (
          <span className="text-muted-foreground/40">Sin setter</span>
        )}
        <span className="ml-auto shrink-0">
          {vista === "AGENDAS" && lead.fecha ? (
            <span>{format(new Date(lead.fecha), "dd/MM HH:mm", { locale: es })}</span>
          ) : (
            <ContactoBadge resultado={lead.resultadoContacto} />
          )}
        </span>
      </div>
    </div>
  );
}
