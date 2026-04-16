import { SegmentedControl } from "@/components/SegmentedControl";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, HelpCircle, DollarSign } from "lucide-react";
import {
  CALIFICACION_FINANCIERA,
  ESTADOS_CONFIRMACION,
  OUTCOMES,
  ASISTENCIAS,
  OFERTAS,
  RAZONES_NO_CALIFICA,
  RAZONES_NO_CONVERSION,
  TRIAGE_OPTIONS,
  type LeadForm,
} from "./leadEditState";

interface PipelineTabProps {
  form: LeadForm;
  setField: <K extends keyof LeadForm>(field: K, value: LeadForm[K]) => void;
  onNoShow?: () => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{children}</Label>;
}

/**
 * Pipeline tab: the day-to-day editing surface. Status-like fields rendered
 * as segmented controls (single click) instead of dropdowns (two clicks).
 * Color semantics: green=positive, red=negative, amber=pending, muted=N/A.
 */
export function PipelineTab({ form, setField, onNoShow }: PipelineTabProps) {
  const greenClass = "text-green-400";
  const redClass = "text-red-400";
  const amberClass = "text-amber-400";
  const mutedClass = "text-muted-foreground";

  return (
    <div className="space-y-5">
      {/* Row 1: Válido / Califica */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <FieldLabel>Válido para contacto</FieldLabel>
          <SegmentedControl
            value={form.validoParaContacto}
            onChange={(v) => setField("validoParaContacto", v)}
            fullWidth
            options={[
              { value: "SÍ", label: "Sí", activeClass: greenClass, icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
              { value: "NO", label: "No", activeClass: redClass, icon: <XCircle className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>¿Califica?</FieldLabel>
          <SegmentedControl
            value={form.califica}
            onChange={(v) => setField("califica", v)}
            fullWidth
            options={[
              { value: "SÍ", label: "Sí", activeClass: greenClass },
              { value: "NO", label: "No", activeClass: redClass },
              { value: "POR EVALUAR", label: "Por evaluar", activeClass: amberClass, icon: <HelpCircle className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>
      </div>

      {form.califica === "NO" && (
        <div className="space-y-1.5">
          <FieldLabel>Razón no califica</FieldLabel>
          <Select
            value={form.razonNoCalifica || "Otro"}
            onValueChange={(v) => setField("razonNoCalifica", v)}
          >
            <SelectTrigger className="bg-background/50 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RAZONES_NO_CALIFICA.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Row 2: Confirmación (full width, 5 options) */}
      <div className="space-y-1.5">
        <FieldLabel>Estado de confirmación</FieldLabel>
        <SegmentedControl
          value={form.estadoConfirmacion}
          onChange={(v) => setField("estadoConfirmacion", v)}
          fullWidth
          options={[
            { value: "PENDIENTE", label: "Pendiente", activeClass: mutedClass },
            { value: "CONFIRMADA", label: "Confirmada", activeClass: greenClass },
            { value: "NO CONFIRMADA", label: "No conf.", activeClass: redClass },
            { value: "CANCELADA", label: "Cancelada", activeClass: redClass },
            { value: "REAGENDADA", label: "Reagendada", activeClass: amberClass },
          ]}
        />
      </div>

      {/* Row 3: Triage + Asistencia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <FieldLabel>Triage</FieldLabel>
          <SegmentedControl
            value={form.triage}
            onChange={(v) => setField("triage", v)}
            fullWidth
            options={TRIAGE_OPTIONS.map((t) => ({
              value: t,
              label: t === "PENDIENTE" ? "Pendiente" : t === "COMPLETADO" ? "Completado" : "N/A",
              activeClass: t === "COMPLETADO" ? greenClass : t === "PENDIENTE" ? amberClass : mutedClass,
            }))}
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Asistencia</FieldLabel>
          <SegmentedControl
            value={form.asistencia}
            onChange={(v) => {
              setField("asistencia", v);
              if (v === "NO SHOW" && onNoShow) {
                // Delay so form state is committed before modal opens
                setTimeout(() => onNoShow(), 100);
              }
            }}
            fullWidth
            options={ASISTENCIAS.map((a) => ({
              value: a,
              label: a === "PENDIENTE" ? "Pendiente" : a === "ASISTIÓ" ? "Asistió" : "No show",
              activeClass: a === "ASISTIÓ" ? greenClass : a === "NO SHOW" ? redClass : mutedClass,
            }))}
          />
        </div>
      </div>

      {/* Row 4: Outcome */}
      <div className="space-y-1.5">
        <FieldLabel>Outcome</FieldLabel>
        <SegmentedControl
          value={form.outcome}
          onChange={(v) => setField("outcome", v)}
          fullWidth
          options={OUTCOMES.map((o) => ({
            value: o,
            label: o === "PENDIENTE" ? "Pendiente" : o === "VENTA" ? "Venta" : o === "PERDIDA" ? "Pérdida" : "Seguimiento",
            activeClass:
              o === "VENTA"
                ? greenClass
                : o === "PERDIDA"
                ? redClass
                : o === "SEGUIMIENTO"
                ? amberClass
                : mutedClass,
          }))}
        />
      </div>

      {form.outcome === "PERDIDA" && (
        <div className="space-y-1.5">
          <FieldLabel>Razón no conversión</FieldLabel>
          <Select
            value={form.razonNoConversion || "Otro"}
            onValueChange={(v) => setField("razonNoConversion", v)}
          >
            <SelectTrigger className="bg-background/50 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RAZONES_NO_CONVERSION.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Row 5: Oferta */}
      <div className="space-y-1.5">
        <FieldLabel>Oferta presentada</FieldLabel>
        <SegmentedControl
          value={form.ofertaHecha}
          onChange={(v) => setField("ofertaHecha", v)}
          fullWidth
          options={OFERTAS.map((o) => ({
            value: o,
            label: o === "SÍ" ? "Sí" : o === "NO" ? "No" : "N/A",
            activeClass: o === "SÍ" ? greenClass : o === "NO" ? redClass : mutedClass,
          }))}
        />
      </div>

      {/* Calificación financiera (condicional al triage completado) */}
      {form.triage === "COMPLETADO" && (
        <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-3">
          <p className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Calificación financiera (obligatorio en triage)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">¿Calificado?</Label>
              <SegmentedControl
                value={form.calificacionFinanciera || "PENDIENTE"}
                onChange={(v) => setField("calificacionFinanciera", v)}
                fullWidth
                options={CALIFICACION_FINANCIERA.map((c) => ({
                  value: c,
                  label: c === "SÍ" ? "Sí" : c === "NO" ? "No" : "Parcial",
                  activeClass:
                    c === "SÍ" ? "text-green-400" : c === "NO" ? "text-red-400" : "text-amber-400",
                }))}
              />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Respuesta del lead sobre su situación</Label>
              <Input
                value={form.respuestaFinanciera || ""}
                onChange={(e) => setField("respuestaFinanciera", e.target.value)}
                className="bg-background/50 h-9"
                placeholder="Ej: 'Puede invertir en 2 meses', 'Sin presupuesto ahora'..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Notas */}
      <div className="space-y-1.5">
        <FieldLabel>Notas</FieldLabel>
        <Textarea
          value={form.notas}
          onChange={(e) => setField("notas", e.target.value)}
          className="bg-background/50 min-h-[90px]"
          placeholder="Notas, contexto, próximos pasos..."
        />
      </div>
    </div>
  );
}
