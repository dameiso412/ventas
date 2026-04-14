import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Headphones, ChevronDown, ChevronUp, Star, MessageSquare,
  ThumbsDown, Lightbulb, Loader2, RefreshCw, FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function GradingCircle({ grade }: { grade: number }) {
  let bg = "bg-red-500/20 text-red-400 border-red-500/40";
  if (grade >= 8) bg = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  else if (grade >= 6) bg = "bg-blue-500/20 text-blue-400 border-blue-500/40";
  else if (grade >= 4) bg = "bg-amber-500/20 text-amber-400 border-amber-500/40";

  return (
    <div className={`flex items-center justify-center h-10 w-10 rounded-full border-2 ${bg} font-bold text-sm shrink-0`}>
      {grade}
    </div>
  );
}

function GradingLabel({ grade }: { grade: number }) {
  if (grade >= 8) return <span className="text-emerald-400">Excelente</span>;
  if (grade >= 6) return <span className="text-blue-400">Buena</span>;
  if (grade >= 4) return <span className="text-amber-400">Mejorable</span>;
  return <span className="text-red-400">Deficiente</span>;
}

export function CallAuditInline({ leadId }: { leadId: number }) {
  const [expanded, setExpanded] = useState(false);
  const [, setLocation] = useLocation();

  const { data: audits, isLoading } = trpc.callAudits.getByLeadId.useQuery(
    { leadId },
    { enabled: !!leadId },
  );

  const reanalyzeMut = trpc.callAudits.reanalyze.useMutation({
    onSuccess: () => {
      toast.success("Reanalizando... espera unos segundos");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading || !audits || audits.length === 0) return null;

  // Show the most recent audit
  const audit = audits[0];

  // Still processing — show skeleton
  if (!audit.aiFeedback) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/20 p-3 animate-pulse">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Analizando grabacion con IA...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (audit.aiFeedback.startsWith("Error:")) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-red-400">{audit.aiFeedback}</p>
          {audit.recordingTranscript && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => reanalyzeMut.mutate({ id: audit.id })}
              disabled={reanalyzeMut.isPending}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  const keyMoments = audit.aiKeyMoments
    ? audit.aiKeyMoments.split("|").map((m: string) => m.trim()).filter(Boolean)
    : [];

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Headphones className="h-4 w-4 text-primary shrink-0" />

        {audit.aiGrading !== null && <GradingCircle grade={audit.aiGrading} />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Analisis IA de Llamada</span>
            {audit.aiGrading !== null && (
              <span className="text-[10px] font-medium">
                — <GradingLabel grade={audit.aiGrading} />
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
            {audit.aiFeedback}
          </p>
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
          {/* Feedback */}
          {audit.aiFeedback && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Resumen</span>
              </div>
              <p className="text-xs leading-relaxed">{audit.aiFeedback}</p>
            </div>
          )}

          {/* Grading justification */}
          {audit.aiGradingJustification && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Justificacion ({audit.aiGrading}/10)</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{audit.aiGradingJustification}</p>
            </div>
          )}

          {/* Why not closed */}
          {audit.aiWhyNotClosed && audit.aiWhyNotClosed !== "Venta cerrada exitosamente" && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <ThumbsDown className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Por que no cerro</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{audit.aiWhyNotClosed}</p>
            </div>
          )}

          {/* Key moments */}
          {keyMoments.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Momentos Clave</span>
              </div>
              <ul className="space-y-0.5">
                {keyMoments.map((m: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript preview */}
          {audit.recordingTranscript && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Transcripcion</span>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground/70 line-clamp-4 bg-muted/30 rounded p-2">
                {audit.recordingTranscript}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => setLocation(`/auditoria/${audit.id}`)}
            >
              Ver analisis completo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => reanalyzeMut.mutate({ id: audit.id })}
              disabled={reanalyzeMut.isPending}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reanalizar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
