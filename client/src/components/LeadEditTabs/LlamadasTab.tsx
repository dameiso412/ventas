import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";
import { CallRecordingTriage } from "@/components/CallRecordingTriage";
import { ContactAttemptsTracker } from "@/components/ContactAttemptsTracker";
import { calculateBusinessHours } from "@shared/businessHours";
import type { LeadForm } from "./leadEditState";

interface LlamadasTabProps {
  lead: any;
  form: LeadForm;
  setField: <K extends keyof LeadForm>(field: K, value: LeadForm[K]) => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{children}</Label>;
}

function ReadOnly({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border/50 bg-background/30">
      {children}
    </div>
  );
}

export function LlamadasTab({ lead, form, setField }: LlamadasTabProps) {
  const tiempoRespuesta = useMemo(() => {
    if (!lead.createdAt || !lead.fechaPrimerContacto) return null;
    const entryDate = new Date(lead.createdAt);
    const contactDate = new Date(lead.fechaPrimerContacto);
    if (contactDate <= entryDate) return null;
    return calculateBusinessHours(entryDate, contactDate);
  }, [lead.createdAt, lead.fechaPrimerContacto]);

  return (
    <div className="space-y-5">
      {/* Setter / Closer row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>Setter asignado</FieldLabel>
          <TeamMemberSelect
            value={form.setterAsignado}
            onValueChange={(v) => setField("setterAsignado", v)}
            role="SETTER"
            placeholder="Seleccionar setter"
            className="bg-background/50"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Closer</FieldLabel>
          <TeamMemberSelect
            value={form.closer}
            onValueChange={(v) => setField("closer", v)}
            role="CLOSER"
            placeholder="Seleccionar closer"
            className="bg-background/50"
          />
        </div>
      </div>

      {/* Contact metrics — read-only derived */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>1er contacto</FieldLabel>
          <ReadOnly>
            {lead.fechaPrimerContacto ? (
              <span className="text-xs text-foreground/80">
                {new Date(lead.fechaPrimerContacto).toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground italic">Auto (vía intentos)</span>
            )}
          </ReadOnly>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Tiempo respuesta</FieldLabel>
          <ReadOnly>
            {tiempoRespuesta !== null ? (
              <span
                className={`text-xs font-medium ${
                  tiempoRespuesta <= 1
                    ? "text-green-400"
                    : tiempoRespuesta <= 4
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {tiempoRespuesta < 1
                  ? `${Math.round(tiempoRespuesta * 60)} min`
                  : `${tiempoRespuesta.toFixed(1)} hrs`}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground italic">—</span>
            )}
          </ReadOnly>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Resultado contacto</FieldLabel>
          <ReadOnly>
            <span
              className={`text-xs font-medium ${
                lead.resultadoContacto === "CONTESTÓ"
                  ? "text-green-400"
                  : lead.resultadoContacto && lead.resultadoContacto !== "PENDIENTE"
                  ? "text-amber-400"
                  : "text-muted-foreground"
              }`}
            >
              {lead.resultadoContacto || "PENDIENTE"}
            </span>
          </ReadOnly>
        </div>
      </div>

      {/* Contact Attempts Tracker */}
      <ContactAttemptsTracker leadId={lead.id} />

      {/* Call Recording + AI Triage */}
      <CallRecordingTriage leadId={lead.id} closer={form.closer} />

      {/* External recording link (fallback) */}
      <div className="space-y-1.5">
        <FieldLabel>Link grabación externo (opcional)</FieldLabel>
        <Input
          value={form.linkGrabacion}
          onChange={(e) => setField("linkGrabacion", e.target.value)}
          className="bg-background/50"
          placeholder="https://..."
        />
      </div>
    </div>
  );
}
