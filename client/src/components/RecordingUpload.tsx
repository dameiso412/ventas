import { useState, useRef, useCallback } from "react";
import { Upload, FileAudio, Loader2, CheckCircle2, AlertCircle, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const ACCEPTED = ".mp3,.mp4,.wav,.m4a,.webm";
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

export function RecordingUpload({
  leadId,
  closer,
  value,
  onChange,
}: {
  leadId: number;
  closer?: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [auditId, setAuditId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Poll for analysis completion
  const { data: audit } = trpc.callAudits.getById.useQuery(
    { id: auditId! },
    {
      enabled: state === "processing" && auditId !== null,
      refetchInterval: 5000,
    },
  );

  // When audit gets aiFeedback, mark as done
  if (state === "processing" && audit?.aiFeedback && !audit.aiFeedback.startsWith("Error:")) {
    setState("done");
    toast.success("Analisis de llamada completado");
    utils.callAudits.getByLeadId.invalidate({ leadId });
  } else if (state === "processing" && audit?.aiFeedback?.startsWith("Error:")) {
    setState("error");
    setErrorMsg(audit.aiFeedback);
  }

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) {
      setErrorMsg("Archivo muy grande. Maximo 25MB.");
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
      onChange(data.linkGrabacion);
      setState("processing");
      toast.info("Grabacion subida. Transcribiendo y analizando...");
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message || "Error subiendo archivo");
      toast.error(err.message || "Error subiendo archivo");
    }
  }, [leadId, closer, onChange]);

  const stateLabel: Record<UploadState, string> = {
    idle: "",
    uploading: "Subiendo archivo...",
    processing: "Transcribiendo y analizando con IA...",
    done: "Analisis completado",
    error: errorMsg || "Error",
  };

  return (
    <div className="space-y-2">
      {/* Link input (preserve existing functionality) */}
      <Label className="text-xs text-muted-foreground">Link Grabacion</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background/50"
        placeholder="URL de la grabacion de la demo"
      />

      {/* Upload section */}
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 my-1">
          <div className="flex-1 h-px bg-border/50" />
          <span>O SUBIR ARCHIVO</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

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

        {state === "idle" || state === "done" || state === "error" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-9 text-xs border-dashed"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Seleccionar archivo (mp3, mp4, wav, m4a, webm)
          </Button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/50">
            {state === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            {state === "processing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{fileName}</p>
              <p className="text-[10px] text-muted-foreground">{stateLabel[state]}</p>
            </div>
          </div>
        )}

        {/* Status messages */}
        {state === "done" && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            <span>{stateLabel.done}</span>
          </div>
        )}
        {state === "error" && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-red-400">
            <AlertCircle className="h-3 w-3" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
