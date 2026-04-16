import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PhoneCall, Plus, Phone, MessageSquare, Mail, Instagram, MoreHorizontal } from "lucide-react";

const CANALES_CONTACTO = ["LLAMADA", "WHATSAPP", "SMS", "EMAIL", "DM_INSTAGRAM", "OTRO"] as const;
const RESULTADOS_INTENTO = ["CONTESTÓ", "NO CONTESTÓ", "BUZÓN", "NÚMERO INVÁLIDO", "WHATSAPP LIMPIADO"] as const;

const CANAL_ICONS: Record<string, typeof Phone> = {
  LLAMADA: PhoneCall,
  WHATSAPP: MessageSquare,
  SMS: MessageSquare,
  EMAIL: Mail,
  DM_INSTAGRAM: Instagram,
  OTRO: MoreHorizontal,
};

interface ContactAttemptsTrackerProps {
  leadId: number;
  /** Optional callback when the attempts count changes (parent may mirror it into its own state). */
  onCountChange?: (count: number) => void;
}

/**
 * Standalone tracker of contact attempts for a lead. Extracted from the inline
 * component originally defined in Citas.tsx so that the edit Sheet can embed it
 * in the "Llamadas" tab without pulling in the rest of Citas.
 */
export function ContactAttemptsTracker({ leadId, onCountChange }: ContactAttemptsTrackerProps) {
  const utils = trpc.useUtils();
  const { data: attempts, isLoading } = trpc.contactAttempts.list.useQuery({ leadId });
  const [showAdd, setShowAdd] = useState(false);
  const [canal, setCanal] = useState<string>("LLAMADA");
  const [resultado, setResultado] = useState<string>("NO CONTESTÓ");
  const [notas, setNotas] = useState("");
  const [fechaHora, setFechaHora] = useState<string>(() => new Date().toISOString().slice(0, 16));

  const addMutation = trpc.contactAttempts.create.useMutation({
    onSuccess: () => {
      utils.contactAttempts.list.invalidate({ leadId });
      utils.contactAttempts.firstForLeads.invalidate();
      utils.leads.list.invalidate();
      setShowAdd(false);
      setNotas("");
      setFechaHora(new Date().toISOString().slice(0, 16));
      toast.success("Intento registrado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const attemptsList = (attempts as unknown as any[]) || [];

  useEffect(() => {
    if (attempts && Array.isArray(attempts)) {
      onCountChange?.(attempts.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts]);

  return (
    <div className="rounded-lg border border-border/30 bg-muted/5 p-3">
      <div className="flex items-center justify-between mb-2">
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
          {attemptsList.length < 3 && <span className="text-[10px] text-amber-400">Meta: 3-5 intentos</span>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px] gap-1"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="h-3 w-3" />
          Registrar Intento
        </Button>
      </div>

      {showAdd && (
        <div className="mb-3 p-2.5 rounded-md bg-background/50 border border-border/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Canal</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANALES_CONTACTO.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-1.5">
                        {(() => {
                          const Icon = CANAL_ICONS[c] || Phone;
                          return <Icon className="h-3 w-3" />;
                        })()}
                        {c.replace("_", " ")}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Resultado</Label>
              <Select value={resultado} onValueChange={setResultado}>
                <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESULTADOS_INTENTO.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
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
              placeholder="Ej: Buzón lleno, dejé mensaje..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setShowAdd(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-[10px]"
              disabled={addMutation.isPending}
              onClick={() => {
                const ts = fechaHora ? new Date(fechaHora).toISOString() : new Date().toISOString();
                addMutation.mutate({
                  leadId,
                  timestamp: ts,
                  canal: canal as any,
                  resultado: resultado as any,
                  notas: notas || undefined,
                });
              }}
            >
              {addMutation.isPending ? "Guardando..." : "Registrar"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-3 text-xs text-muted-foreground">Cargando...</div>
      ) : attemptsList.length === 0 ? (
        <div className="text-center py-3 border border-dashed border-border/30 rounded-md">
          <p className="text-xs text-muted-foreground">Sin intentos registrados</p>
          <p className="text-[10px] text-red-400 mt-0.5">Se requieren mínimo 3 intentos en las primeras 48h</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
          {attemptsList.map((attempt: any, idx: number) => {
            const Icon = CANAL_ICONS[attempt.canal] || Phone;
            const isSuccess = attempt.resultado === "CONTESTÓ";
            return (
              <div
                key={attempt.id || idx}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
                  isSuccess ? "bg-green-500/10 border border-green-500/20" : "bg-muted/20 border border-border/20"
                }`}
              >
                <span className="text-muted-foreground font-mono text-[10px] w-5 text-center">{idx + 1}</span>
                <Icon className={`h-3.5 w-3.5 shrink-0 ${isSuccess ? "text-green-400" : "text-muted-foreground"}`} />
                <span className="font-medium text-foreground/80">{attempt.canal?.replace("_", " ")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isSuccess ? "bg-green-500/20 text-green-400" : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {attempt.resultado}
                </span>
                {attempt.notas && <span className="text-muted-foreground truncate flex-1">{attempt.notas}</span>}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ContactAttemptsTracker;
