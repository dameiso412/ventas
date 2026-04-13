import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User, Phone, Mail, Calendar, DollarSign, CheckCircle2, XCircle,
  MoreVertical, UserPlus, Eye, ShoppingCart, Clock, ArrowRight,
  AlertTriangle, Package,
} from "lucide-react";
import type { ClinicPatient } from "../../../../drizzle/schema";

interface PatientCardProps {
  patient: ClinicPatient;
  onAssignOwner: (patient: ClinicPatient) => void;
  onMarkAttendance: (patient: ClinicPatient, attended: boolean) => void;
  onUpsellDecision: (patient: ClinicPatient) => void;
  onComplete: (patient: ClinicPatient) => void;
  onEdit: (patient: ClinicPatient) => void;
  onViewLead: (leadId: number) => void;
  onNoSale: (patient: ClinicPatient) => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case "pending": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "incomplete": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "completed": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    default: return "bg-gray-500/10 text-gray-400 border-gray-500/30";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "pending": return "Pendiente";
    case "incomplete": return "En Proceso";
    case "completed": return "Completado";
    default: return status;
  }
}

function getUpsellLabel(decision: string | null) {
  switch (decision) {
    case "completed": return "Upsell Aceptado";
    case "declined": return "Upsell Rechazado";
    case "postponed": return "Upsell Pospuesto";
    case "pending": return "Upsell Pendiente";
    default: return null;
  }
}

export default function PatientCard({
  patient,
  onAssignOwner,
  onMarkAttendance,
  onUpsellDecision,
  onComplete,
  onEdit,
  onViewLead,
  onNoSale,
}: PatientCardProps) {
  const statusColor = getStatusColor(patient.status);
  const statusLabel = getStatusLabel(patient.status);
  const upsellLabel = getUpsellLabel(patient.upsellDecision);

  // Determine next action in the flow
  const needsOwner = !patient.ownerId;
  const needsAttendance = patient.ownerId && patient.attended === null;
  const needsUpsell = patient.attended === true && !patient.upsellDecision;
  const canComplete = patient.attended === true && patient.upsellDecision && patient.status !== "completed";

  return (
    <Card className="bg-card/50 border-border/50 hover:border-pink-500/30 transition-all duration-200">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-full bg-pink-500/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-pink-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{patient.patientName}</h3>
              {patient.treatmentType && (
                <p className="text-xs text-muted-foreground truncate">{patient.treatmentType}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
              {statusLabel}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(patient)}>
                  <Eye className="h-3.5 w-3.5 mr-2" /> Ver Detalles
                </DropdownMenuItem>
                {patient.leadId && (
                  <DropdownMenuItem onClick={() => onViewLead(patient.leadId!)}>
                    <ArrowRight className="h-3.5 w-3.5 mr-2" /> Ver Lead
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-1 mb-3 text-xs text-muted-foreground">
          {patient.patientEmail && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              <span className="truncate">{patient.patientEmail}</span>
            </div>
          )}
          {patient.patientPhone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              <span>{patient.patientPhone}</span>
            </div>
          )}
          {patient.scheduledDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              <span>{new Date(patient.scheduledDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          )}
        </div>

        {/* Financial info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1 text-xs">
            <DollarSign className="h-3 w-3 text-green-400" />
            <span className="font-medium">${Number(patient.initialAmount).toLocaleString()}</span>
          </div>
          {patient.upsellPrice && Number(patient.upsellPrice) > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <Package className="h-3 w-3 text-purple-400" />
              <span className="text-purple-400">+${Number(patient.upsellPrice).toLocaleString()}</span>
            </div>
          )}
          {patient.hasDeposit && (
            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30">
              Deposito
            </Badge>
          )}
        </div>

        {/* Owner */}
        {patient.ownerId && (
          <div className="flex items-center gap-1.5 mb-3 text-xs">
            <UserPlus className="h-3 w-3 text-sky-400" />
            <span className="text-sky-400">{patient.ownerId}</span>
          </div>
        )}

        {/* Upsell badge */}
        {upsellLabel && (
          <div className="mb-3">
            <Badge variant="outline" className={`text-[10px] ${
              patient.upsellDecision === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
              patient.upsellDecision === "declined" ? "bg-red-500/10 text-red-400 border-red-500/30" :
              "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}>
              {upsellLabel}
            </Badge>
          </div>
        )}

        {/* Action buttons based on flow state */}
        <div className="flex gap-2 flex-wrap">
          {needsOwner && (
            <Button size="sm" variant="outline" className="h-7 text-xs border-pink-500/30 text-pink-400 hover:bg-pink-500/10" onClick={() => onAssignOwner(patient)}>
              <UserPlus className="h-3 w-3 mr-1" /> Asignar
            </Button>
          )}
          {needsAttendance && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => onMarkAttendance(patient, true)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Asistio
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => onMarkAttendance(patient, false)}>
                <XCircle className="h-3 w-3 mr-1" /> No Show
              </Button>
            </>
          )}
          {patient.attended === false && !patient.lossReasonCaptured && (
            <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => onNoSale(patient)}>
              <AlertTriangle className="h-3 w-3 mr-1" /> Razon
            </Button>
          )}
          {needsUpsell && (
            <Button size="sm" variant="outline" className="h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={() => onUpsellDecision(patient)}>
              <ShoppingCart className="h-3 w-3 mr-1" /> Upsell
            </Button>
          )}
          {canComplete && (
            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => onComplete(patient)}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Completar
            </Button>
          )}
          {patient.status === "completed" && (
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>Completado</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
