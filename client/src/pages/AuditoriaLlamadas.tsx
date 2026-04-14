import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import {
  Headphones, Star, Clock, CheckCircle2, AlertTriangle,
  ChevronLeft, ExternalLink, User, Phone, MessageSquare,
  ThumbsDown, Lightbulb, ListChecks, Plus, X, Save,
  Filter, Search, FileText, Mail, Upload, Loader2, AlertCircle, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { TeamMemberSelect } from "@/components/TeamMemberSelect";

// ==================== STAT CARD ====================
function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle?: string;
  icon: any; color: string;
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== GRADING BADGE ====================
function GradingBadge({ grade }: { grade: number | null }) {
  if (grade === null) return <Badge variant="outline" className="text-muted-foreground">Sin nota</Badge>;
  let color = "bg-red-500/20 text-red-400 border-red-500/30";
  let label = "Deficiente";
  if (grade >= 8) { color = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"; label = "Excelente"; }
  else if (grade >= 6) { color = "bg-blue-500/20 text-blue-400 border-blue-500/30"; label = "Buena"; }
  else if (grade >= 4) { color = "bg-amber-500/20 text-amber-400 border-amber-500/30"; label = "Mejorable"; }
  return (
    <Badge className={`${color} font-semibold`}>
      {grade}/10 — {label}
    </Badge>
  );
}

// ==================== REVIEW STATUS BADGE ====================
function ReviewBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDIENTE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    REVISADA: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    ACCIONADA: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  return <Badge className={styles[status] || "bg-muted text-muted-foreground"}>{status}</Badge>;
}

// ==================== UPLOAD DIALOG ====================
const ACCEPTED = ".mp3,.mp4,.wav,.m4a,.webm";
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

function UploadRecordingDialog({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [auditId, setAuditId] = useState<number | null>(null);
  const [closer, setCloser] = useState("");
  const [leadName, setLeadName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Poll for analysis completion
  const { data: polledAudit } = trpc.callAudits.getById.useQuery(
    { id: auditId! },
    { enabled: state === "processing" && auditId !== null, refetchInterval: 5000 },
  );

  if (state === "processing" && polledAudit?.aiFeedback && !polledAudit.aiFeedback.startsWith("Error:")) {
    setState("done");
    toast.success("Análisis de llamada completado");
    onUploaded();
  } else if (state === "processing" && polledAudit?.aiFeedback?.startsWith("Error:")) {
    setState("error");
    setErrorMsg(polledAudit.aiFeedback);
  }

  const resetForm = () => {
    setState("idle");
    setFileName("");
    setErrorMsg("");
    setAuditId(null);
    setCloser("");
    setLeadName("");
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.size > MAX_SIZE) {
      setErrorMsg("Archivo muy grande. Máximo 25MB.");
      setState("error");
      return;
    }

    if (!closer) {
      setErrorMsg("Selecciona un closer antes de subir el archivo.");
      setState("error");
      return;
    }

    setFileName(file.name);
    setState("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("closer", closer);
      if (leadName.trim()) formData.append("leadName", leadName.trim());

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
  }, [closer, leadName]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && state !== "processing") resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Subir Grabación
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Subir Grabación de Llamada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Closer selector */}
          <div>
            <Label className="text-sm">Closer *</Label>
            <TeamMemberSelect
              value={closer || "all"}
              onValueChange={(v) => setCloser(v === "all" ? "" : v)}
              role="CLOSER"
              includeAll
              allLabel="Seleccionar closer..."
              className="w-full mt-1"
            />
          </div>

          {/* Lead name (optional) */}
          <div>
            <Label className="text-sm">Nombre del Prospecto (opcional)</Label>
            <Input
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              placeholder="Ej: María García"
              className="mt-1"
            />
          </div>

          {/* File upload */}
          <div>
            <Label className="text-sm">Archivo de Audio/Video *</Label>
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

            {state === "idle" || state === "error" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full mt-1 h-20 border-dashed flex flex-col gap-1"
                onClick={() => {
                  if (!closer) {
                    setErrorMsg("Selecciona un closer primero.");
                    setState("error");
                    return;
                  }
                  fileRef.current?.click();
                }}
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Haz click para seleccionar archivo
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  mp3, mp4, wav, m4a, webm — máx. 25MB
                </span>
              </Button>
            ) : state === "done" ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mt-1">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  <p className="text-xs text-emerald-400">Análisis completado</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { resetForm(); }}
                >
                  Subir otra
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50 mt-1">
                <Loader2 className={`h-5 w-5 animate-spin shrink-0 ${state === "uploading" ? "text-primary" : "text-amber-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {state === "uploading" ? "Subiendo archivo..." : "Transcribiendo y analizando con IA..."}
                  </p>
                </div>
              </div>
            )}

            {state === "error" && errorMsg && (
              <div className="flex items-center gap-2 mt-2 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== AUDIT LIST VIEW ====================
function AuditListView() {
  const [, setLocation] = useLocation();
  const [filterCloser, setFilterCloser] = useState("");
  const [filterReview, setFilterReview] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: stats, refetch: refetchStats } = trpc.callAudits.stats.useQuery();
  const { data: audits, isLoading, refetch: refetchAudits } = trpc.callAudits.list.useQuery({
    closer: filterCloser || undefined,
    manualReview: filterReview || undefined,
    limit: 100,
  });

  const handleUploaded = () => {
    refetchAudits();
    refetchStats();
  };

  const filteredAudits = audits?.filter(a => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (a.closer?.toLowerCase().includes(term)) ||
      (a.aiFeedback?.toLowerCase().includes(term)) ||
      (a.aiWhyNotClosed?.toLowerCase().includes(term));
  });

  // Get unique closers for filter
  const closers = Array.from(new Set(audits?.map(a => a.closer).filter(Boolean) || []));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headphones className="h-6 w-6 text-primary" />
            Auditoría de Llamadas
          </h1>
          <p className="text-muted-foreground mt-1">
            Análisis automatizado y revisión manual de llamadas de venta
          </p>
        </div>
        <UploadRecordingDialog onUploaded={handleUploaded} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Auditadas"
          value={stats?.total ?? 0}
          icon={Headphones}
          color="bg-primary/20 text-primary"
        />
        <StatCard
          title="Nota Promedio"
          value={stats?.avgGrading ? `${stats.avgGrading}/10` : "—"}
          subtitle={stats?.gradingDistribution
            ? `${stats.gradingDistribution.excellent} excelentes`
            : undefined}
          icon={Star}
          color="bg-amber-500/20 text-amber-400"
        />
        <StatCard
          title="Pendientes"
          value={stats?.pendientes ?? 0}
          subtitle="Por revisar"
          icon={Clock}
          color="bg-orange-500/20 text-orange-400"
        />
        <StatCard
          title="Accionadas"
          value={stats?.accionadas ?? 0}
          subtitle={`${stats?.revisadas ?? 0} revisadas`}
          icon={CheckCircle2}
          color="bg-emerald-500/20 text-emerald-400"
        />
      </div>

      {/* Filters */}
      <Card className="border-border/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en auditorías..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <TeamMemberSelect value={filterCloser || "all"} onValueChange={v => setFilterCloser(v === "all" ? "" : v)} role="CLOSER" includeAll allLabel="Todos los closers" className="w-[180px]" />
              <select
                className="bg-background border border-border rounded-md px-3 py-2 text-sm"
                value={filterReview}
                onChange={e => setFilterReview(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="REVISADA">Revisada</option>
                <option value="ACCIONADA">Accionada</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando auditorías...</div>
      ) : !filteredAudits?.length ? (
        <Card className="border-border/40">
          <CardContent className="p-12 text-center">
            <Headphones className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No hay auditorías registradas</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Las auditorías se crean automáticamente cuando tu pipeline de automatización
              envía datos al webhook <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/api/webhook/call-audit</code>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAudits.map(audit => (
            <Card
              key={audit.id}
              className="border-border/40 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setLocation(`/auditoria/${audit.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Grading circle */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      audit.aiGrading === null ? "bg-muted text-muted-foreground" :
                      audit.aiGrading >= 8 ? "bg-emerald-500/20 text-emerald-400" :
                      audit.aiGrading >= 6 ? "bg-blue-500/20 text-blue-400" :
                      audit.aiGrading >= 4 ? "bg-amber-500/20 text-amber-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {audit.aiGrading ?? "—"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{audit.closer || "Sin closer"}</span>
                        <ReviewBadge status={audit.manualReview || "PENDIENTE"} />
                        {(audit.leadId || (audit as any).leadName) && (
                          <Badge variant="outline" className="text-xs">
                            <User className="h-3 w-3 mr-1" />
                            {(audit as any).leadName || `Lead #${audit.leadId}`}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {audit.aiFeedback
                          ? audit.aiFeedback.substring(0, 120) + (audit.aiFeedback.length > 120 ? "..." : "")
                          : "Sin feedback de IA"}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground/70">
                        <span>{audit.fechaLlamada ? new Date(audit.fechaLlamada).toLocaleDateString("es-CL") : "Sin fecha"}</span>
                        {audit.duracionMinutos && <span>{audit.duracionMinutos} min</span>}
                        {audit.linkGrabacion && (
                          <span className="flex items-center gap-1 text-primary/70">
                            <Phone className="h-3 w-3" /> Grabación
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronLeft className="h-5 w-5 text-muted-foreground rotate-180 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== AUDIT DETAIL VIEW ====================
function AuditDetailView({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const { data: audit, isLoading, refetch } = trpc.callAudits.getById.useQuery({ id });
  const updateReview = trpc.callAudits.updateReview.useMutation({
    onSuccess: () => {
      toast.success("Revisión guardada");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const reanalyzeMut = trpc.callAudits.reanalyze.useMutation({
    onSuccess: () => {
      toast.success("Reanalizando... los resultados aparecerán en unos segundos");
      setTimeout(() => refetch(), 5000);
    },
    onError: (err) => toast.error(err.message),
  });

  const [manualNotes, setManualNotes] = useState("");
  const [actionItems, setActionItems] = useState<{ text: string; done: boolean }[]>([]);
  const [newActionItem, setNewActionItem] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Initialize form state from audit data
  if (audit && !initialized) {
    setManualNotes((audit.manualNotes as string) || "");
    try {
      const raw = audit.actionItems as any;
      const items = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
      setActionItems(Array.isArray(items) ? items : []);
    } catch { setActionItems([]); }
    setInitialized(true);
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Cargando auditoría...</div>;
  if (!audit) return <div className="text-center py-12 text-muted-foreground">Auditoría no encontrada</div>;

  const handleSaveReview = (status: "PENDIENTE" | "REVISADA" | "ACCIONADA") => {
    updateReview.mutate({
      id: audit.id,
      manualReview: status,
      manualNotes,
      actionItems,
      reviewedBy: "Manager",
    });
  };

  const addActionItem = () => {
    if (!newActionItem.trim()) return;
    setActionItems([...actionItems, { text: newActionItem.trim(), done: false }]);
    setNewActionItem("");
  };

  const toggleActionItem = (idx: number) => {
    const updated = [...actionItems];
    updated[idx] = { ...updated[idx], done: !updated[idx].done };
    setActionItems(updated);
  };

  const removeActionItem = (idx: number) => {
    setActionItems(actionItems.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/auditoria")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            Auditoría #{audit.id}
            <ReviewBadge status={audit.manualReview || "PENDIENTE"} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {audit.closer || "Sin closer"} — {audit.fechaLlamada ? new Date(audit.fechaLlamada).toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Sin fecha"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {audit.recordingTranscript && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => reanalyzeMut.mutate({ id: audit.id })}
              disabled={reanalyzeMut.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${reanalyzeMut.isPending ? "animate-spin" : ""}`} />
              Reanalizar
            </Button>
          )}
          <GradingBadge grade={audit.aiGrading} />
        </div>
      </div>

      {/* Info cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Closer + Lead info */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Información
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Closer</span>
              <span className="font-medium">{audit.closer || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lead</span>
              <span className="font-medium">
                {audit.leadId ? (
                  <button
                    className="text-primary hover:underline flex items-center gap-1"
                    onClick={() => {
                      const searchParam = (audit as any).leadName || (audit as any).leadEmail || audit.leadId;
                      setLocation(`/citas?leadId=${audit.leadId}&search=${encodeURIComponent(String(searchParam))}`);
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    {(audit as any).leadName || `Lead #${audit.leadId}`}
                  </button>
                ) : (
                  <span className="text-muted-foreground/70">
                    {(audit as any).leadName || (audit as any).leadEmail || "No vinculado"}
                  </span>
                )}
              </span>
            </div>
            {(audit as any).leadEmail && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-xs">{(audit as any).leadEmail}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duración</span>
              <span className="font-medium">{audit.duracionMinutos ? `${audit.duracionMinutos} min` : "—"}</span>
            </div>
            {audit.linkGrabacion && (
              <a
                href={audit.linkGrabacion}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline text-sm mt-2"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Escuchar grabación
              </a>
            )}
          </CardContent>
        </Card>

        {/* AI Grading */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" /> Calificación IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${
                audit.aiGrading === null ? "bg-muted text-muted-foreground" :
                audit.aiGrading >= 8 ? "bg-emerald-500/20 text-emerald-400" :
                audit.aiGrading >= 6 ? "bg-blue-500/20 text-blue-400" :
                audit.aiGrading >= 4 ? "bg-amber-500/20 text-amber-400" :
                "bg-red-500/20 text-red-400"
              }`}>
                {audit.aiGrading ?? "—"}
              </div>
              <div className="text-sm text-muted-foreground">
                {(audit.aiGradingJustification as string) || "Sin justificación de la nota"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick status */}
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Estado de Revisión
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              {(["PENDIENTE", "REVISADA", "ACCIONADA"] as const).map(status => (
                <Button
                  key={status}
                  size="sm"
                  variant={audit.manualReview === status ? "default" : "outline"}
                  className={audit.manualReview === status ? "" : "opacity-60"}
                  onClick={() => handleSaveReview(status)}
                  disabled={updateReview.isPending}
                >
                  {status === "PENDIENTE" && <Clock className="h-3.5 w-3.5 mr-1" />}
                  {status === "REVISADA" && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                  {status === "ACCIONADA" && <ListChecks className="h-3.5 w-3.5 mr-1" />}
                  {status}
                </Button>
              ))}
            </div>
            {audit.reviewedAt && (
              <p className="text-xs text-muted-foreground">
                Revisada: {new Date(audit.reviewedAt).toLocaleDateString("es-CL")}
                {audit.reviewedBy && ` por ${audit.reviewedBy}`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Feedback */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Feedback de IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {(audit.aiFeedback as string) || "Sin feedback disponible"}
          </div>
        </CardContent>
      </Card>

      {/* Why Not Closed */}
      {(audit.aiWhyNotClosed as string) && (
        <Card className="border-border/40 border-l-4 border-l-amber-500/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-amber-400" /> Por qué no cerró
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-amber-500/5 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {audit.aiWhyNotClosed as string}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcripción */}
      {(audit as any).recordingTranscript && (
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-400" /> Transcripción de la Llamada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-violet-500/5 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
              {(audit as any).recordingTranscript}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Moments */}
      {(audit.aiKeyMoments as any) && (
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-400" /> Momentos Clave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-500/5 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {typeof audit.aiKeyMoments === "string"
                ? (audit.aiKeyMoments as string)
                : JSON.stringify(audit.aiKeyMoments, null, 2)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Review Section */}
      <Card className="border-border/40 border-l-4 border-l-primary/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" /> Revisión Manual del Equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Notas del Revisor
            </label>
            <Textarea
              value={manualNotes}
              onChange={e => setManualNotes(e.target.value)}
              placeholder="Escribe observaciones sobre la llamada, áreas de mejora, qué se hizo bien..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Action Items */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              Action Items
            </label>
            <div className="space-y-2">
              {actionItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <button
                    onClick={() => toggleActionItem(idx)}
                    className={`flex-shrink-0 w-5 h-5 rounded border ${
                      item.done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-border hover:border-primary"
                    } flex items-center justify-center transition-colors`}
                  >
                    {item.done && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => removeActionItem(idx)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newActionItem}
                  onChange={e => setNewActionItem(e.target.value)}
                  placeholder="Agregar action item..."
                  className="flex-1"
                  onKeyDown={e => e.key === "Enter" && addActionItem()}
                />
                <Button size="sm" variant="outline" onClick={addActionItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={() => handleSaveReview(audit.manualReview as any || "REVISADA")}
              disabled={updateReview.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateReview.isPending ? "Guardando..." : "Guardar Revisión"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAIN PAGE ====================
export default function AuditoriaLlamadas() {
  const [matchDetail, params] = useRoute("/auditoria/:id");

  if (matchDetail && params?.id) {
    const id = parseInt(params.id);
    if (!isNaN(id)) return <AuditDetailView id={id} />;
  }

  return <AuditListView />;
}
