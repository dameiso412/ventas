import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, Clock } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { ScoreBadge, ContactoBadge } from "@/components/LeadBadges";
import { calculateBusinessHours } from "@shared/businessHours";
import {
  AGENDAS_STAGES,
  LEADS_STAGES,
  getAgendaPipelineStage,
  getLeadsPipelineStage,
  getTransitionFields,
  type StageConfig,
} from "@/lib/pipeline-stages";

// --- Helpers ---

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
  onStageDrop?: (leadId: number, fields: Record<string, any>, revert: () => void) => void;
}

export function PipelineBoard({ leads, vista, onEditLead, onStageDrop }: PipelineBoardProps) {
  const stages = vista === "AGENDAS" ? AGENDAS_STAGES : LEADS_STAGES;
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());
  const [optimisticOverrides, setOptimisticOverrides] = useState<Map<number, Record<string, any>>>(new Map());

  // Build a lead lookup for quick access during drag
  const leadMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const lead of leads) map.set(lead.id, lead);
    return map;
  }, [leads]);

  // Apply optimistic overrides to leads before deriving stages
  const effectiveLeads = useMemo(() => {
    if (optimisticOverrides.size === 0) return leads;
    return leads.map(lead => {
      const override = optimisticOverrides.get(lead.id);
      return override ? { ...lead, ...override } : lead;
    });
  }, [leads, optimisticOverrides]);

  const columnData = useMemo(() => {
    const grouped = new Map<string, any[]>();
    for (const stage of stages) grouped.set(stage.key, []);

    for (const lead of effectiveLeads) {
      const stageKey = vista === "AGENDAS"
        ? getAgendaPipelineStage(lead)
        : getLeadsPipelineStage(lead);
      const arr = grouped.get(stageKey);
      if (arr) arr.push(lead);
      else grouped.get(stages[0].key)!.push(lead);
    }

    return stages.map(stage => {
      const stageLeads = grouped.get(stage.key) || [];
      const total = stageLeads.reduce((sum, lead) => sum + getLeadValue(lead), 0);
      return { ...stage, leads: stageLeads, count: stageLeads.length, total };
    });
  }, [effectiveLeads, vista, stages]);

  const toggleExpand = (key: string) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDragEnd = useCallback((result: DropResult) => {
    const { draggableId, source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    if (!onStageDrop) return;

    const leadId = parseInt(draggableId, 10);
    const lead = leadMap.get(leadId);
    if (!lead) return;

    const transition = getTransitionFields(vista, source.droppableId, destination.droppableId, lead);

    if (!transition.allowed) {
      toast.error(transition.reason || "Transición no permitida");
      return;
    }

    // Apply optimistic override
    const fields = transition.fields!;
    setOptimisticOverrides(prev => {
      const next = new Map(prev);
      next.set(leadId, fields);
      return next;
    });

    // Revert function clears the override
    const revert = () => {
      setOptimisticOverrides(prev => {
        const next = new Map(prev);
        next.delete(leadId);
        return next;
      });
    };

    onStageDrop(leadId, fields, revert);
  }, [vista, leadMap, onStageDrop]);

  // Clear overrides when leads prop changes (server data refreshed)
  const prevLeadsRef = useRef(leads);
  if (leads !== prevLeadsRef.current) {
    prevLeadsRef.current = leads;
    if (optimisticOverrides.size > 0) {
      setOptimisticOverrides(new Map());
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4 scrollbar-hide">
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
    </DragDropContext>
  );
}

interface PipelineColumnProps {
  stage: StageConfig & { leads: any[]; count: number; total: number };
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
    <div className="w-[260px] flex flex-col bg-muted/10 rounded-lg border border-border/30">
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/20">
        <div className={`h-2.5 w-2.5 rounded-full ${stage.dot} shrink-0`} />
        <span className="text-xs font-semibold text-foreground truncate">{stage.label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stage.bg} ${stage.text}`}>
          {count}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
          {formatUSD(total)}
        </span>
      </div>

      {/* Cards — Droppable area */}
      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto max-h-[calc(100vh-300px)] p-2 space-y-1.5 transition-colors scrollbar-hide ${
              snapshot.isDraggingOver ? "bg-primary/5 ring-1 ring-inset ring-primary/20 rounded-b-lg" : ""
            }`}
          >
            {visibleLeads.length === 0 && !snapshot.isDraggingOver ? (
              <p className="text-[10px] text-muted-foreground/50 text-center py-6">Sin leads</p>
            ) : (
              visibleLeads.map((lead, index) => (
                <PipelineCard key={lead.id} lead={lead} vista={vista} onEdit={onEditLead} index={index} stageKey={stage.key} />
              ))
            )}
            {provided.placeholder}
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
        )}
      </Droppable>
    </div>
  );
}

interface PipelineCardProps {
  lead: any;
  vista: "AGENDAS" | "LEADS";
  onEdit: (lead: any) => void;
  index: number;
  stageKey: string;
}

function PipelineCard({ lead, vista, onEdit, index, stageKey }: PipelineCardProps) {
  const borderColor = SCORE_BORDER[lead.scoreLabel] || "border-l-border";
  const value = getLeadValue(lead);

  return (
    <Draggable draggableId={String(lead.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onEdit(lead)}
          className={`rounded-md border border-border/30 border-l-2 ${borderColor} bg-card/40 p-2.5 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-card/80 transition-all select-none ${
            snapshot.isDragging ? "opacity-80 shadow-xl ring-2 ring-primary/40 scale-[1.02] z-50" : ""
          }`}
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

          {/* Line 3: Setter + Date/Badge/Timer */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {lead.setterAsignado ? (
              <span className="truncate">{lead.setterAsignado}</span>
            ) : (
              <span className="text-muted-foreground/40">Sin setter</span>
            )}
            <span className="ml-auto shrink-0">
              {stageKey === "DEMO_CALL_REQUESTED" && lead.createdAt ? (
                <ElapsedBadge createdAt={lead.createdAt} />
              ) : vista === "AGENDAS" && lead.fecha ? (
                <span>{format(new Date(lead.fecha), "dd/MM HH:mm", { locale: es })}</span>
              ) : (
                <ContactoBadge resultado={lead.resultadoContacto} />
              )}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
}

// Elapsed time badge for uncontacted leads (DEMO_CALL_REQUESTED)
function ElapsedBadge({ createdAt }: { createdAt: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const leadDate = new Date(createdAt);
  const elapsed = calculateBusinessHours(leadDate, new Date(now));
  if (elapsed <= 0) return <span className="text-muted-foreground/40">—</span>;

  const minutes = elapsed * 60;
  const colorClass = minutes <= 30
    ? "text-green-400 bg-green-500/10 border-green-500/30"
    : elapsed <= 3
    ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
    : "text-red-400 bg-red-500/10 border-red-500/30";

  const label = minutes < 60
    ? `${Math.round(minutes)}m`
    : elapsed < 24
    ? `${elapsed.toFixed(1)}h`
    : `${Math.floor(elapsed / 24)}d`;

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border animate-pulse ${colorClass}`}>
      <Clock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
