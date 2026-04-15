import { useState, useRef, useCallback } from "react";
import {
  Upload, Loader2, CheckCircle2, AlertCircle, Headphones,
  FileText, ThumbsDown, Lightbulb, Star, MessageSquare,
  ChevronDown, ChevronUp, RefreshCw, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

const ACCEPTED = ".mp3,.mp4,.wav,.m4a,.webm";
const MAX_SIZE = 25 * 1024 * 1024;
type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

// ── Grading helpers ──
function GradingCircle({ grade }: { grade: number }) {
  let bg = "bg-red-500/20 text-red-400 border-red-500/40";
  if (grade >= 8) bg = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  else if (grade >= 6) bg = "bg-blue-500/20 text-blue-400 border-blue-500/40";
  else if (grade >= 4) bg = "bg-amber-500/20 text-amber-400 border-amber-500/40";
  return (
    <div className={`flex items-center justify-center h-11 w-11 rounded-full border-2 ${bg} font-bold text-sm shrink-0`}>
      {grade}
    </div>
  );
}

function GradingLabel({ grade }: { grade: number }) {
  if (grade >= 8) return <span className="text-emerald-400 font-semibold">Excelente</span>;
  if (grade >= 6) return <span className="text-blue-400 font-semibold">Buena</span>;
  if (grade >= 4) return <span className="text-amber-400 font-semibold">Mejorable</span>;
  return <span className="text-red-400 font-semibold">Deficiente</span>;
}

// ── Inline Audit Card ──
function AuditResultCard({ audit }: { audit: any }) {
  const [expanded, setExpanded] = useState(false);
  const [, setLocation] = useLocation();
  const reanalyzeMut = trpc.callAudits.reanalyze.useMutation({
    onSuccess: () => toast.success("Reanalizando..."),
    onError: (err) => toast.error(err.message),
  });

  const keyMoments = audit.aiKeyMoments
    ? audit.aiKeyMoments.split("|").map((m: string) => m.trim()).filter(Boolean)
    : [];

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-3 hover:bg-red-500/10 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Headphones className="h-4 w-4 text-red-400 shrink-0" />
        {audit.aiGrading !== null && <GradingCircle grade={audit.aiGrading} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Auditoría de Ventas</span>
            {audit.aiGrading !== null && (
              <span className="text-[10px]">— <GradingLabel grade={audit.aiGrading} /></span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
            {audit.aiFeedback}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-red-500/10 pt-3">
          {/* Feedback */}
          {audit.aiFeedback && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Auditoría</span>
              </div>
              <p className="text-xs leading-relaxed">{audit.aiFeedback}</p>
            </div>
          )}

          {/* Grading justification */}
          {audit.aiGradingJustification && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Justificación ({audit.aiGrading}/10)</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{audit.aiGradingJustification}</p>
            </div>
          )}

          {/* Why not closed */}
          {audit.aiWhyNotClosed && audit.aiWhyNotClosed !== "Venta cerrada exitosamente" && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <ThumbsDown className="h-3 w-3 text-red-400" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Por qué no cerró</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{audit.aiWhyNotClosed}</p>
            </div>
          )}

          {/* Key moments */}
          {keyMoments.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Momentos Clave</span>
              </div>
              <ul className="space-y-0.5">
                {keyMoments.map((m: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span>
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
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Transcripción</span>
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
              <ExternalLink className="h-3 w-3 mr-1" />
              Ver auditoría completa
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => reanalyzeMut.mutate({ id: audit.id })}
              disabled={reanalyzeMut.isPending}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${reanalyzeMut.isPending ? "animate-spin" : ""}`} />
              Reanalizar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ──
export function CallRecordingTriage({
  leadId,
  closer,
}: {
  leadId: number;
  closer?: string;
}) {
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [auditId, setAuditId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Query existing audits for this lead
  const { data: existingAudits, isLoading: loadingAudits } = trpc.callAudits.getByLeadId.useQuery(
    { leadId },
    { enabled: !!leadId },
  );

  // Poll for analysis completion during processing
  const { data: polledAudit } = trpc.callAudits.getById.useQuery(
    { id: auditId! },
    { enabled: state === "processing" && auditId !== null, refetchInterval: 5000 },
  );

  if (state === "processing" && polledAudit?.aiFeedback && !polledAudit.aiFeedback.startsWith("Error:")) {
    setState("done");
    toast.success("Análisis completado — revisa las notas del prospecto y la auditoría");
    utils.callAudits.getByLeadId.invalidate({ leadId });
    utils.prospectProfile.getByLeadId.invalidate({ leadId });
  } else if (state === "processing" && polledAudit?.aiFeedback?.startsWith("Error:")) {
    setState("error");
    setErrorMsg(polledAudit.aiFeedback);
  }

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) {
      setErrorMsg("Archivo muy grande. Máximo 25MB.");
      setState("error");
      return;
    }

    setFileName(file.name);
    setState("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("leadId", String(leadId));
      if (closer) formData.append("closer", closer);

      const resp = await fetch("/api/upload/recording", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      setAuditId(data.auditId);
      setState("processing");
      toast.info("Grabación subida. Transcribiendo y analizando...");
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message || "Error subiendo archivo");
      toast.error(err.message || "Error subiendo archivo");
    }
  }, [leadId, closer]);

  const hasExistingAudits = existingAudits && existingAudits.length > 0;
  const latestAudit = hasExistingAudits ? existingAudits[0] : null;
  const isProcessing = latestAudit && !latestAudit.aiFeedback;

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">
        Grabación de Llamada
      </p>

      {/* Upload area */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = "";
        }}
      />

      {state === "idle" && !isProcessing ? (
        <Button
          type="button"
          variant="outline"
          className="w-full h-16 border-dashed flex flex-col gap-0.5"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {hasExistingAudits ? "Subir nueva grabación" : "Subir grabación de la llamada"}
          </span>
          <span className="text-[9px] text-muted-foreground/50">
            mp3, mp4, wav, m4a, webm — máx. 25MB
          </span>
        </Button>
      ) : state === "uploading" || state === "processing" || isProcessing ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
          <Loader2 className={`h-4 w-4 animate-spin shrink-0 ${state === "uploading" ? "text-primary" : "text-amber-400"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{fileName || "Procesando..."}</p>
            <p className="text-[10px] text-muted-foreground">
              {state === "uploading" ? "Subiendo archivo..." : "Transcribiendo y analizando con IA..."}
            </p>
          </div>
        </div>
      ) : state === "done" ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400">Análisis completado</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[10px] shrink-0"
            onClick={() => { setState("idle"); setFileName(""); }}
          >
            <Upload className="h-3 w-3 mr-1" /> Otra
          </Button>
        </div>
      ) : null}

      {/* Error */}
      {state === "error" && (
        <div className="flex items-center gap-2 text-xs text-red-400 p-2 rounded bg-red-500/5 border border-red-500/20">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] shrink-0"
            onClick={() => { setState("idle"); setErrorMsg(""); }}
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Existing audit results */}
      {!loadingAudits && hasExistingAudits && latestAudit?.aiFeedback && !latestAudit.aiFeedback.startsWith("Error:") && (
        <AuditResultCard audit={latestAudit} />
      )}

      {/* Error in existing audit */}
      {!loadingAudits && latestAudit?.aiFeedback?.startsWith("Error:") && state === "idle" && (
        <div className="flex items-center gap-2 text-xs text-red-400 p-2 rounded bg-red-500/5 border border-red-500/20">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{latestAudit.aiFeedback}</span>
        </div>
      )}
    </div>
  );
}
