import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Calendar, ClipboardCheck, UserPlus, Phone, Edit, ChevronDown, ChevronRight, Star } from "lucide-react";
import { useState } from "react";

interface DataField {
  key: string;
  label: string;
  value: string | null;
  category?: string;
}

interface DataEntry {
  id: number;
  leadId: number;
  source: string;
  formId: string | null;
  data: { fields: DataField[] };
  scoreFinal: number | null;
  scoreLabel: string | null;
  createdAt: string | Date;
}

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Calendar; color: string }> = {
  appointment: { label: "Cita Agendada", icon: Calendar, color: "text-blue-400" },
  diagnostic_form: { label: "Formulario Diagnóstico", icon: ClipboardCheck, color: "text-emerald-400" },
  prospect: { label: "Prospecto", icon: UserPlus, color: "text-purple-400" },
  call_audit: { label: "Auditoría de Llamada", icon: Phone, color: "text-amber-400" },
  manual: { label: "Entrada Manual", icon: Edit, color: "text-pink-400" },
};

function getSourceConfig(source: string) {
  return SOURCE_CONFIG[source] || { label: source, icon: ClipboardCheck, color: "text-muted-foreground" };
}

function ScoreBadgeInline({ score }: { score: number }) {
  const config = score >= 4 ? { label: "HOT", cls: "bg-red-500/20 text-red-400 border-red-500/40" }
    : score >= 3 ? { label: "WARM", cls: "bg-orange-500/20 text-orange-400 border-orange-500/40" }
    : score >= 2 ? { label: "TIBIO", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" }
    : { label: "FRÍO", cls: "bg-blue-500/20 text-blue-400 border-blue-500/40" };
  return <Badge className={`text-[10px] h-5 px-2 ${config.cls}`}>{config.label} ({score}/4)</Badge>;
}

const CATEGORY_ORDER = ["qualification", "financial", "contact", "business", "appointment", "attribution", "audit", "team", "general"];

function groupByCategory(fields: DataField[]) {
  const groups: Record<string, DataField[]> = {};
  for (const f of fields) {
    const cat = f.category || "general";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  }
  return CATEGORY_ORDER
    .filter(c => groups[c])
    .map(c => ({ category: c, fields: groups[c] }));
}

const CATEGORY_LABELS: Record<string, string> = {
  qualification: "Calificación",
  financial: "Financiero",
  contact: "Contacto",
  business: "Negocio",
  appointment: "Cita",
  attribution: "Atribución",
  audit: "Auditoría",
  team: "Equipo",
  general: "General",
};

function EntrySection({ entry }: { entry: DataEntry }) {
  const [open, setOpen] = useState(true);
  const config = getSourceConfig(entry.source);
  const Icon = config.icon;
  const fields = entry.data?.fields || [];
  const grouped = groupByCategory(fields);
  const date = new Date(entry.createdAt);

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/20 hover:bg-muted/30 transition-colors"
      >
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        <span className="text-xs font-medium text-foreground/90 flex-1 text-left">{config.label}</span>
        {entry.scoreFinal && <ScoreBadgeInline score={entry.scoreFinal} />}
        <span className="text-[10px] text-muted-foreground">
          {date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} {date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </span>
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2">
          {grouped.map(({ category, fields: catFields }) => (
            <div key={category}>
              {grouped.length > 1 && (
                <p className="text-[9px] uppercase font-medium text-muted-foreground/60 tracking-wider mb-1">
                  {CATEGORY_LABELS[category] || category}
                </p>
              )}
              {catFields.map((f, i) => (
                <div key={i} className="flex items-start gap-2 py-1 border-b border-border/10 last:border-0">
                  <span className="text-[11px] text-muted-foreground shrink-0 w-[40%]">{f.label}</span>
                  <span className="text-[11px] text-foreground/90 break-words flex-1">
                    {f.value || <span className="text-muted-foreground/40 italic">—</span>}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Legacy fallback: renders data from old lead_scoring table
function LegacyScoringView({ leadId }: { leadId: number }) {
  const { data: scoringData, isLoading } = trpc.scoring.getByLeadId.useQuery({ leadId });
  const { data: scoringByCorreo } = trpc.scoring.getByCorreo.useQuery(
    { correo: "" }, // placeholder — will be overridden
    { enabled: false }
  );

  if (isLoading) return <div className="text-center py-4 text-xs text-muted-foreground">Cargando...</div>;

  const data = scoringData;
  if (!data) return null;

  const questions = [
    { label: "Frustración con captación", value: data.p1Frustracion, score: data.scoreP1 },
    { label: "Marketing previo", value: data.p2MarketingPrevio, score: data.scoreP2 },
    { label: "Urgencia / pérdida mensual", value: data.p3Urgencia, score: data.scoreP3 },
    { label: "Tiempo operando", value: data.p4TiempoOperando, score: data.scoreP4 },
    { label: "Tratamientos", value: data.p5Tratamientos, score: null },
    { label: "Impedimento", value: data.p6Impedimento, score: data.scoreP6 },
  ].filter(q => q.value);

  if (questions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider">Formulario Diagnóstico (histórico)</p>
      {questions.map((q, i) => (
        <div key={i} className="bg-muted/20 rounded-lg px-3 py-2 border border-border/30">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] font-medium text-foreground/80">{q.label}</span>
            {q.score != null && (
              <Badge className={`text-[10px] h-4 px-1.5 ${
                q.score >= 4 ? "bg-red-500/20 text-red-400 border-red-500/40"
                : q.score >= 3 ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                : q.score >= 2 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                : "bg-blue-500/20 text-blue-400 border-blue-500/40"
              }`}>{q.score}/4</Badge>
            )}
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed">{q.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ProspectProfile({ leadId }: { leadId: number }) {
  const { data: entries, isLoading } = trpc.prospectProfile.getByLeadId.useQuery({ leadId });

  if (isLoading) {
    return <div className="text-center py-4 text-xs text-muted-foreground">Cargando perfil...</div>;
  }

  const validEntries = (entries || []).filter((e: any) => {
    const d = e.data as any;
    return d?.fields?.length > 0;
  }) as unknown as DataEntry[];

  // If no universal entries exist, fall back to legacy scoring
  if (validEntries.length === 0) {
    return (
      <div className="space-y-3">
        <LegacyScoringView leadId={leadId} />
        <div className="bg-muted/10 rounded-lg px-3 py-4 border border-dashed border-border/40 text-center">
          <Star className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Datos adicionales aparecerán aquí automáticamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {validEntries.map((entry) => (
        <EntrySection key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
