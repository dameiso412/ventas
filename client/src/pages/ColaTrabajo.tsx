import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Phone, MessageCircle, Clock, ChevronRight, AlertTriangle,
  CalendarCheck, UserPlus, RotateCcw, DollarSign, CalendarClock,
  Flame, Zap, Timer,
} from "lucide-react";
import { useLocation } from "wouter";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";

// Action config: icon, color, label
const ACTION_CONFIG: Record<string, { icon: typeof Phone; label: string; color: string; bgColor: string }> = {
  CONFIRMAR_HOY: { icon: AlertTriangle, label: "Confirmar Hoy", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20" },
  CONTACTAR_NUEVO: { icon: Zap, label: "Contactar", color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20" },
  CONFIRMAR_MANANA: { icon: CalendarCheck, label: "Confirmar Mañana", color: "text-orange-400", bgColor: "bg-orange-500/10 border-orange-500/20" },
  REINTENTAR_CONTACTO: { icon: RotateCcw, label: "Reintentar", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20" },
  DINERO_GRATIS: { icon: DollarSign, label: "Dinero Gratis", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  CONFIRMAR_PROXIMOS: { icon: CalendarClock, label: "Pre-confirmar", color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20" },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  CRITICA: { label: "Crítica", color: "text-red-400", dot: "bg-red-500" },
  ALTA: { label: "Alta", color: "text-amber-400", dot: "bg-amber-500" },
  MEDIA: { label: "Media", color: "text-blue-400", dot: "bg-blue-500" },
  BAJA: { label: "Baja", color: "text-muted-foreground", dot: "bg-muted-foreground" },
};

const SCORE_COLORS: Record<string, string> = {
  HOT: "text-red-400",
  WARM: "text-orange-400",
  TIBIO: "text-yellow-400",
  FRÍO: "text-blue-400",
};

export default function ColaTrabajo() {
  const [setter, setSetter] = useState<string>("all");
  const [, navigate] = useLocation();

  const { data: queue = [], isLoading } = trpc.workQueue.list.useQuery(
    setter !== "all" ? { setter } : undefined,
    { refetchInterval: 30000 } // Refresh every 30s
  );

  const { data: confirmations } = trpc.confirmations.queue.useQuery(
    setter !== "all" ? { setter } : undefined,
    { refetchInterval: 30000 }
  );

  const { data: distinctValues } = trpc.filters.distinctValues.useQuery();
  const setters = useMemo(() => distinctValues?.setters ?? [], [distinctValues]);

  // Group by action type for summary
  const summary = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const item of queue) {
      groups[item.action] = (groups[item.action] || 0) + 1;
    }
    return groups;
  }, [queue]);

  const handleGoToLead = (leadId: number) => {
    navigate(`/citas?lead=${leadId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cola de Trabajo</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acciones priorizadas — trabaja de arriba hacia abajo
          </p>
        </div>
        <TeamMemberSelect value={setter} onValueChange={setSetter} role="SETTER" includeAll allLabel="Todos" className="w-[180px]" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={Flame}
          label="Acciones Pendientes"
          value={queue.length}
          color="text-primary"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Urgentes"
          value={queue.filter(q => q.urgency === "CRITICA").length}
          color="text-red-400"
        />
        <SummaryCard
          icon={CalendarCheck}
          label="Tasa Confirmación"
          value={`${confirmations?.stats.tasa ?? 0}%`}
          color="text-emerald-400"
        />
        <SummaryCard
          icon={Timer}
          label="Sin Contactar"
          value={summary["CONTACTAR_NUEVO"] || 0}
          color="text-amber-400"
        />
      </div>

      {/* Queue List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <CalendarCheck className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
          <p className="text-lg font-medium">Todo al día</p>
          <p className="text-muted-foreground text-sm mt-1">No hay acciones pendientes en este momento</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {queue.map((item, index) => {
            const config = ACTION_CONFIG[item.action] || ACTION_CONFIG.CONTACTAR_NUEVO;
            const urgencyConfig = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.MEDIA;
            const Icon = config.icon;

            return (
              <div
                key={`${item.leadId}-${item.action}`}
                className={`group flex flex-row items-center gap-3 px-4 py-3 bg-card text-card-foreground rounded-xl border cursor-pointer transition-all hover:border-primary/40 hover:bg-accent/30 ${
                  index === 0 ? "ring-1 ring-primary/30 border-primary/20" : ""
                }`}
                onClick={() => handleGoToLead(item.leadId)}
              >
                {/* Priority number */}
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-bold text-muted-foreground">{index + 1}</span>
                </div>

                {/* Action icon */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center ${config.bgColor}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>

                {/* Lead info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{item.nombre || "Sin nombre"}</span>
                    {item.scoreLabel && (
                      <span className={`text-xs font-semibold ${SCORE_COLORS[item.scoreLabel] || "text-muted-foreground"}`}>
                        {item.scoreLabel}
                      </span>
                    )}
                    {/* Urgency dot */}
                    <Tooltip>
                      <TooltipTrigger>
                        <span className={`w-2 h-2 rounded-full ${urgencyConfig.dot} ${item.urgency === "CRITICA" ? "animate-pulse" : ""}`} />
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <span className="text-xs">Urgencia: {urgencyConfig.label}</span>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                </div>

                {/* Action badge */}
                <Badge variant="outline" className={`flex-shrink-0 text-xs ${config.color} border-current/20`}>
                  {config.label}
                </Badge>

                {/* Time info */}
                {item.timeInfo && (
                  <span className="flex-shrink-0 text-xs text-muted-foreground font-mono">
                    {item.timeInfo}
                  </span>
                )}

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Workflow Section */}
      {confirmations && confirmations.stats.pendientes > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Workflow de Confirmación</h2>
            <Badge variant="outline" className="ml-auto">
              {confirmations.stats.confirmadas}/{confirmations.stats.total} confirmadas
            </Badge>
          </div>

          {/* Urgente: Hoy */}
          {confirmations.urgente.length > 0 && (
            <ConfirmationGroup
              title="Hoy"
              leads={confirmations.urgente}
              color="red"
              onGoToLead={handleGoToLead}
            />
          )}

          {/* Pronto: Mañana */}
          {confirmations.pronto.length > 0 && (
            <ConfirmationGroup
              title="Mañana"
              leads={confirmations.pronto}
              color="amber"
              onGoToLead={handleGoToLead}
            />
          )}

          {/* Planificar: 2-3 días */}
          {confirmations.planificar.length > 0 && (
            <ConfirmationGroup
              title="Próximos días"
              leads={confirmations.planificar}
              color="purple"
              onGoToLead={handleGoToLead}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: typeof Phone;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </Card>
  );
}

function ConfirmationGroup({ title, leads, color, onGoToLead }: {
  title: string;
  leads: any[];
  color: "red" | "amber" | "purple";
  onGoToLead: (id: number) => void;
}) {
  const colorMap = {
    red: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", dot: "bg-red-500" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", dot: "bg-amber-500" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", dot: "bg-purple-500" },
  };
  const c = colorMap[color];

  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${c.dot} ${color === "red" ? "animate-pulse" : ""}`} />
        <span className={`text-sm font-semibold ${c.text}`}>{title}</span>
        <Badge variant="outline" className={`text-xs ${c.text} border-current/20`}>
          {leads.length}
        </Badge>
      </div>
      <div className="space-y-1">
        {leads.map((lead: any) => (
          <div
            key={lead.id}
            className="flex items-center gap-3 px-3 py-2 rounded-md bg-card/50 hover:bg-card cursor-pointer transition-colors"
            onClick={() => onGoToLead(lead.id)}
          >
            <span className="text-sm font-medium truncate flex-1">{lead.nombre || "Sin nombre"}</span>
            {lead.telefono && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`tel:${lead.telefono}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>{lead.telefono}</TooltipContent>
              </Tooltip>
            )}
            {lead.telefono && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`https://wa.me/${lead.telefono?.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-emerald-400 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>WhatsApp</TooltipContent>
              </Tooltip>
            )}
            <span className="text-xs text-muted-foreground font-mono">
              {lead.estadoConfirmacion || "PENDIENTE"}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  );
}
