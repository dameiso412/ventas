import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  Phone, MessageCircle, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, CalendarCheck, CalendarClock,
} from "lucide-react";
import { useLocation } from "wouter";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";

export default function Confirmaciones() {
  const [setter, setSetter] = useState<string>("all");
  const [, navigate] = useLocation();

  const { data: confirmations, isLoading } = trpc.confirmations.queue.useQuery(
    setter !== "all" ? { setter } : undefined,
    { refetchInterval: 30000 }
  );

  const { data: distinctValues } = trpc.filters.distinctValues.useQuery();
  const setters = useMemo(() => distinctValues?.setters ?? [], [distinctValues]);

  const stats = confirmations?.stats ?? { total: 0, confirmadas: 0, pendientes: 0, tasa: 0 };

  const handleGoToLead = (leadId: number) => {
    navigate(`/citas?lead=${leadId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Confirmaciones</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Workflow de confirmación de citas próximas
          </p>
        </div>
        <TeamMemberSelect value={setter} onValueChange={setSetter} role="SETTER" includeAll allLabel="Todos" className="w-[180px]" />
      </div>

      {/* Progress Bar */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-sm">Tasa de Confirmación</span>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{stats.tasa}%</span>
        </div>
        <Progress value={stats.tasa} className="h-2" />
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{stats.confirmadas} confirmadas</span>
          <span>{stats.pendientes} pendientes</span>
          <span>{stats.total} total</span>
        </div>
      </Card>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : stats.pendientes === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
          <p className="text-lg font-medium">Todas confirmadas</p>
          <p className="text-muted-foreground text-sm mt-1">No hay citas pendientes de confirmación</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* URGENTE: Demos Hoy */}
          {confirmations!.urgente.length > 0 && (
            <ConfirmationSection
              icon={AlertTriangle}
              title="Demos Hoy"
              subtitle="Confirmar inmediatamente"
              leads={confirmations!.urgente}
              color="red"
              onGoToLead={handleGoToLead}
            />
          )}

          {/* PRONTO: Demos Mañana */}
          {confirmations!.pronto.length > 0 && (
            <ConfirmationSection
              icon={CalendarCheck}
              title="Demos Mañana"
              subtitle="Confirmar antes de las 6pm"
              leads={confirmations!.pronto}
              color="amber"
              onGoToLead={handleGoToLead}
            />
          )}

          {/* PLANIFICAR: Demos en 2-3 días */}
          {confirmations!.planificar.length > 0 && (
            <ConfirmationSection
              icon={CalendarClock}
              title="Próximos Días"
              subtitle="Pre-confirmar para asegurar asistencia"
              leads={confirmations!.planificar}
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

function ConfirmationSection({ icon: Icon, title, subtitle, leads, color, onGoToLead }: {
  icon: typeof AlertTriangle;
  title: string;
  subtitle: string;
  leads: any[];
  color: "red" | "amber" | "purple";
  onGoToLead: (id: number) => void;
}) {
  const colorMap = {
    red: {
      iconColor: "text-red-400",
      borderColor: "border-red-500/20",
      bgColor: "bg-red-500/5",
      dotColor: "bg-red-500",
      badgeColor: "text-red-400",
    },
    amber: {
      iconColor: "text-amber-400",
      borderColor: "border-amber-500/20",
      bgColor: "bg-amber-500/5",
      dotColor: "bg-amber-500",
      badgeColor: "text-amber-400",
    },
    purple: {
      iconColor: "text-purple-400",
      borderColor: "border-purple-500/20",
      bgColor: "bg-purple-500/5",
      dotColor: "bg-purple-500",
      badgeColor: "text-purple-400",
    },
  };
  const c = colorMap[color];

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${c.iconColor}`} />
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="outline" className={`text-xs ${c.badgeColor} border-current/20`}>
          {leads.length}
        </Badge>
        <span className="text-xs text-muted-foreground ml-1">{subtitle}</span>
      </div>

      {/* Lead rows */}
      <div className="space-y-1.5">
        {leads.map((lead: any) => (
          <div
            key={lead.id}
            className={`group flex items-center gap-3 px-4 py-3 rounded-lg border ${c.borderColor} ${c.bgColor} cursor-pointer transition-all hover:border-primary/30`}
            onClick={() => onGoToLead(lead.id)}
          >
            {/* Status dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dotColor} ${color === "red" ? "animate-pulse" : ""}`} />

            {/* Name */}
            <span className="font-medium text-sm truncate flex-1 min-w-0">
              {lead.nombre || "Sin nombre"}
            </span>

            {/* Score */}
            {lead.scoreLabel && (
              <span className={`text-xs font-semibold flex-shrink-0 ${
                lead.scoreLabel === "HOT" ? "text-red-400" :
                lead.scoreLabel === "WARM" ? "text-orange-400" :
                lead.scoreLabel === "TIBIO" ? "text-yellow-400" : "text-blue-400"
              }`}>
                {lead.scoreLabel}
              </span>
            )}

            {/* Confirmation status */}
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {lead.estadoConfirmacion || "PENDIENTE"}
            </Badge>

            {/* Demo time */}
            <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
              {lead.fecha ? new Date(lead.fecha).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
            </span>

            {/* Quick actions */}
            {lead.telefono && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`tel:${lead.telefono}`}
                      className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>{lead.telefono}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`https://wa.me/${lead.telefono?.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-muted-foreground hover:text-emerald-400 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>WhatsApp</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Arrow */}
            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
