import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PhoneCall,
  PhoneOff,
  Voicemail,
  Send,
  PhoneMissed,
  Trash2,
  ChevronDown,
  ChevronUp,
  Phone,
  MessageSquare,
  Mail,
  Instagram,
  MoreHorizontal,
  Loader2,
} from "lucide-react";

type Canal = "LLAMADA" | "WHATSAPP" | "SMS" | "EMAIL" | "DM_INSTAGRAM" | "OTRO";
type Resultado =
  | "CONTESTÓ"
  | "NO CONTESTÓ"
  | "BUZÓN"
  | "NÚMERO INVÁLIDO"
  | "MENSAJE ENVIADO"
  | "WHATSAPP LIMPIADO";

const CANALES_CONTACTO: Canal[] = ["LLAMADA", "WHATSAPP", "SMS", "EMAIL", "DM_INSTAGRAM", "OTRO"];
const RESULTADOS_INTENTO: Resultado[] = [
  "CONTESTÓ",
  "NO CONTESTÓ",
  "BUZÓN",
  "NÚMERO INVÁLIDO",
  "MENSAJE ENVIADO",
  "WHATSAPP LIMPIADO",
];

const CANAL_ICONS: Record<string, typeof Phone> = {
  LLAMADA: PhoneCall,
  WHATSAPP: MessageSquare,
  SMS: MessageSquare,
  EMAIL: Mail,
  DM_INSTAGRAM: Instagram,
  OTRO: MoreHorizontal,
};

/** Quick-action presets: canal + resultado combos that cover ~80% of flows. One click to register. */
const QUICK_ACTIONS: {
  key: string;
  canal: Canal;
  resultado: Resultado;
  label: string;
  icon: typeof Phone;
  toneClass: string;
}[] = [
  {
    key: "call-no-answer",
    canal: "LLAMADA",
    resultado: "NO CONTESTÓ",
    label: "No contestó",
    icon: PhoneMissed,
    toneClass:
      "border-amber-500/40 text-amber-300 hover:bg-amber-500/15 hover:border-amber-500/60",
  },
  {
    key: "call-answered",
    canal: "LLAMADA",
    resultado: "CONTESTÓ",
    label: "Contestó",
    icon: PhoneCall,
    toneClass:
      "border-green-500/40 text-green-300 hover:bg-green-500/15 hover:border-green-500/60",
  },
  {
    key: "call-voicemail",
    canal: "LLAMADA",
    resultado: "BUZÓN",
    label: "Buzón",
    icon: Voicemail,
    toneClass:
      "border-blue-500/40 text-blue-300 hover:bg-blue-500/15 hover:border-blue-500/60",
  },
  {
    key: "wa-sent",
    canal: "WHATSAPP",
    resultado: "MENSAJE ENVIADO",
    label: "WA enviado",
    icon: Send,
    toneClass:
      "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-500/60",
  },
  {
    key: "invalid",
    canal: "LLAMADA",
    resultado: "NÚMERO INVÁLIDO",
    label: "Nº inválido",
    icon: PhoneOff,
    toneClass:
      "border-red-500/40 text-red-300 hover:bg-red-500/15 hover:border-red-500/60",
  },
];

interface ContactAttemptsTrackerProps {
  leadId: number;
  /** Optional callback when the attempts count changes (parent may mirror it into its own state). */
  onCountChange?: (count: number) => void;
}

/**
 * Registro de intentos de contacto para un lead.
 *
 * UX:
 *  - Botones de "acción rápida" para los 5 casos más comunes (1 click).
 *  - Formulario avanzado colapsable para casos custom (canal alternativo,
 *    timestamp pasado, notas).
 *  - Borrado inline por intento (hover → icono trash).
 *  - Auto-popula `realizadoPor` con el nombre del usuario autenticado.
 *
 * Históricamente este componente tenía un bug grave: al registrar "NO CONTESTÓ"
 * el backend fallaba silenciosamente porque las queries SQL crudas usaban
 * identificadores camelCase sin comillas dobles (PostgreSQL los pasaba a
 * minúsculas → "column does not exist"). El fix vive en server/db.ts.
 */
export function ContactAttemptsTracker({ leadId, onCountChange }: ContactAttemptsTrackerProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: attempts, isLoading } = trpc.contactAttempts.list.useQuery({ leadId });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [canal, setCanal] = useState<Canal>("LLAMADA");
  const [resultado, setResultado] = useState<Resultado>("NO CONTESTÓ");
  const [notas, setNotas] = useState("");
  const [fechaHora, setFechaHora] = useState<string>(() => toLocalInputValue(new Date()));
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  const invalidateAll = () => {
    utils.contactAttempts.list.invalidate({ leadId });
    utils.contactAttempts.firstForLeads.invalidate();
    utils.leads.list.invalidate();
  };

  const addMutation = trpc.contactAttempts.create.useMutation({
    onSuccess: () => {
      invalidateAll();
      setPendingActionKey(null);
    },
    onError: (err: any) => {
      setPendingActionKey(null);
      toast.error(err?.message || "No se pudo registrar el intento");
    },
  });

  const deleteMutation = trpc.contactAttempts.delete.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Intento eliminado");
    },
    onError: (err: any) => toast.error(err?.message || "No se pudo eliminar"),
  });

  const attemptsList = (attempts as unknown as any[]) || [];

  useEffect(() => {
    if (attempts && Array.isArray(attempts)) {
      onCountChange?.(attempts.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts]);

  const realizadoPor = user?.name || undefined;

  /** 1-click registration — canal + resultado preset, timestamp = now. */
  const handleQuickAction = (action: (typeof QUICK_ACTIONS)[number]) => {
    if (addMutation.isPending) return;
    setPendingActionKey(action.key);
    addMutation.mutate(
      {
        leadId,
        timestamp: new Date().toISOString(),
        canal: action.canal,
        resultado: action.resultado,
        realizadoPor,
      },
      {
        onSuccess: () => {
          toast.success(`${action.label} registrado`);
        },
      },
    );
  };

  /** Full-form registration — used for custom canal / past timestamp / notes. */
  const handleAdvancedSubmit = () => {
    if (addMutation.isPending) return;
    const ts = fechaHora ? new Date(fechaHora).toISOString() : new Date().toISOString();
    addMutation.mutate(
      {
        leadId,
        timestamp: ts,
        canal,
        resultado,
        notas: notas || undefined,
        realizadoPor,
      },
      {
        onSuccess: () => {
          toast.success("Intento registrado");
          setNotas("");
          setFechaHora(toLocalInputValue(new Date()));
          setShowAdvanced(false);
        },
      },
    );
  };

  return (
    <div className="rounded-lg border border-border/30 bg-muted/5 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-foreground/80">Historial de Intentos</span>
          <Badge
            className={`text-[10px] ${
              attemptsList.length >= 3
                ? "bg-green-500/20 text-green-400 border-green-500/40"
                : attemptsList.length >= 1
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-red-500/20 text-red-400 border-red-500/40"
            }`}
          >
            {attemptsList.length} {attemptsList.length >= 3 ? "✓" : attemptsList.length === 0 ? "⚠" : ""}
          </Badge>
          {attemptsList.length < 3 && (
            <span className="text-[10px] text-amber-400">Meta: 3-5 intentos</span>
          )}
        </div>
      </div>

      {/* Acciones rápidas (1 click) */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          const isPending = pendingActionKey === action.key && addMutation.isPending;
          return (
            <Button
              key={action.key}
              type="button"
              size="sm"
              variant="outline"
              disabled={addMutation.isPending}
              onClick={() => handleQuickAction(action)}
              className={`h-7 text-[10px] gap-1.5 px-2.5 bg-background/50 ${action.toneClass}`}
              title={`Registrar ${action.label} (${action.canal.toLowerCase()})`}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              {action.label}
            </Button>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? (
            <>
              <ChevronUp className="h-3 w-3" /> Menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Más opciones
            </>
          )}
        </Button>
      </div>

      {/* Form avanzado (canal distinto / fecha pasada / notas) */}
      {showAdvanced && (
        <div className="mb-3 p-2.5 rounded-md bg-background/50 border border-border/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Canal</Label>
              <Select value={canal} onValueChange={(v) => setCanal(v as Canal)}>
                <SelectTrigger className="h-8 text-xs bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANALES_CONTACTO.map((c) => {
                    const Icon = CANAL_ICONS[c] || Phone;
                    return (
                      <SelectItem key={c} value={c}>
                        <span className="flex items-center gap-1.5">
                          <Icon className="h-3 w-3" />
                          {c.replace("_", " ")}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Resultado</Label>
              <Select value={resultado} onValueChange={(v) => setResultado(v as Resultado)}>
                <SelectTrigger className="h-8 text-xs bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESULTADOS_INTENTO.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Fecha y Hora del Intento</Label>
            <Input
              type="datetime-local"
              value={fechaHora}
              onChange={(e) => setFechaHora(e.target.value)}
              className="h-8 text-xs bg-background/50"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Notas (opcional)</Label>
            <Input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="h-8 text-xs bg-background/50"
              placeholder="Ej: Buzón lleno, dejé mensaje…"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setShowAdvanced(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-[10px]"
              disabled={addMutation.isPending}
              onClick={handleAdvancedSubmit}
            >
              {addMutation.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Guardando…
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de intentos */}
      {isLoading ? (
        <div className="text-center py-3 text-xs text-muted-foreground">Cargando…</div>
      ) : attemptsList.length === 0 ? (
        <div className="text-center py-3 border border-dashed border-border/30 rounded-md">
          <p className="text-xs text-muted-foreground">Sin intentos registrados</p>
          <p className="text-[10px] text-red-400 mt-0.5">
            Se requieren mínimo 3 intentos en las primeras 48h
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
          {attemptsList.map((attempt: any, idx: number) => {
            const Icon = CANAL_ICONS[attempt.canal] || Phone;
            const isSuccess = attempt.resultado === "CONTESTÓ";
            const isDeleting =
              deleteMutation.isPending && deleteMutation.variables?.id === attempt.id;
            return (
              <div
                key={attempt.id || idx}
                className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
                  isSuccess
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-muted/20 border border-border/20"
                }`}
              >
                <span className="text-muted-foreground font-mono text-[10px] w-5 text-center">
                  {idx + 1}
                </span>
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isSuccess ? "text-green-400" : "text-muted-foreground"
                  }`}
                />
                <span className="font-medium text-foreground/80">
                  {attempt.canal?.replace("_", " ")}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isSuccess
                      ? "bg-green-500/20 text-green-400"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {attempt.resultado}
                </span>
                {attempt.notas && (
                  <span className="text-muted-foreground truncate flex-1">{attempt.notas}</span>
                )}
                <span className="text-[10px] text-muted-foreground/60 shrink-0 ml-auto">
                  {attempt.timestamp
                    ? new Date(attempt.timestamp).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
                {attempt.realizadoPor && (
                  <span
                    className="text-[10px] text-muted-foreground/60 shrink-0"
                    title={`Registrado por ${attempt.realizadoPor}`}
                  >
                    · {attempt.realizadoPor}
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Eliminar intento"
                  title="Eliminar intento"
                  disabled={isDeleting}
                  onClick={() => {
                    if (
                      typeof window !== "undefined" &&
                      !window.confirm("¿Eliminar este intento de contacto?")
                    ) {
                      return;
                    }
                    deleteMutation.mutate({ id: attempt.id });
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded p-1 hover:bg-red-500/15 text-muted-foreground hover:text-red-400 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Format a Date as "YYYY-MM-DDTHH:mm" in the browser's local tz — what
 * <input type="datetime-local"> expects. Plain `.toISOString().slice(0,16)`
 * uses UTC and shows the wrong hour for non-UTC users.
 */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default ContactAttemptsTracker;
