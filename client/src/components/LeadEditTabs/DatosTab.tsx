import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProspectProfile } from "@/components/ProspectProfile";
import AdCreativePreview from "@/components/AdCreativePreview";
import { ExternalLink, Clock, Target } from "lucide-react";
import { ORIGENES, type LeadForm } from "./leadEditState";

interface DatosTabProps {
  lead: any;
  form: LeadForm;
  setField: <K extends keyof LeadForm>(field: K, value: LeadForm[K]) => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{children}</Label>;
}

export function DatosTab({ lead, form, setField }: DatosTabProps) {
  const fechaAgendaStr = lead.fecha
    ? new Date(lead.fecha).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Sin fecha";

  return (
    <div className="space-y-5">
      {/* Datos de entrada editables */}
      <div>
        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-3">
          Datos de entrada del lead
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <FieldLabel>Nombre completo</FieldLabel>
            <Input
              value={form.nombre}
              onChange={(e) => setField("nombre", e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Correo</FieldLabel>
            <Input
              value={form.correo}
              onChange={(e) => setField("correo", e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Teléfono</FieldLabel>
            <Input
              value={form.telefono}
              onChange={(e) => setField("telefono", e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>País</FieldLabel>
            <Input
              value={form.pais}
              onChange={(e) => setField("pais", e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Instagram</FieldLabel>
            <Input
              value={form.instagram}
              onChange={(e) => setField("instagram", e.target.value)}
              className="bg-background/50"
              placeholder="@usuario"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Origen</FieldLabel>
            <Select value={form.origen} onValueChange={(v) => setField("origen", v)}>
              <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORIGENES.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Tipo de cita</FieldLabel>
            <Select value={form.tipo} onValueChange={(v) => setField("tipo", v)}>
              <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DEMO">Demo</SelectItem>
                <SelectItem value="INTRO">Intro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/10 rounded-md px-3 py-2 border border-border/30">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Fecha agenda: <span className="text-foreground/70">{fechaAgendaStr}</span>
            {lead.mes && <span> · {lead.mes}</span>}
            {lead.semana && <span> · Semana {lead.semana}</span>}
          </span>
        </div>
        {lead.linkCRM && (
          <a
            href={lead.linkCRM}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
          >
            <ExternalLink className="h-3 w-3" /> Abrir en CRM
          </a>
        )}
      </div>

      {/* Atribución del anuncio — muestra creativo (video/imagen) cuando utm_content mapea a un Meta adId */}
      <LeadAttributionSection lead={lead} />

      {/* ProspectProfile — formulario diagnóstico + cita agendada + UTMs (read-only, expandible) */}
      <div>
        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-2">
          Información del prospecto
        </p>
        <ProspectProfile leadId={lead.id} />
      </div>
    </div>
  );
}

/**
 * Show the Meta ad creative that originated this lead, when `utm_content`
 * matches the Meta template `{{ad.id}}`. Gracefully degrades to UTM-only text
 * when the match fails (manual leads, organic, corrupted utm_content, etc.).
 */
function LeadAttributionSection({ lead }: { lead: any }) {
  const hasAnyAttribution = Boolean(
    lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmContent || lead.utmTerm
  );
  if (!hasAnyAttribution) return null;

  // Convention from meta-ads.ts#getRecommendedUtmTags: utm_content={{ad.id}}.
  // Meta ad IDs are numeric strings; treat anything numeric as a candidate.
  const adId = lead.utmContent && /^\d{6,}$/.test(String(lead.utmContent).trim())
    ? String(lead.utmContent).trim()
    : null;

  return (
    <div>
      <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
        <Target className="h-3 w-3" /> Atribución del anuncio
      </p>
      <div className="rounded-md border border-border/30 bg-muted/10 p-3 space-y-2">
        {adId ? (
          <AdCreativePreview adId={adId} variant="inline" adName={lead.utmCampaign} />
        ) : (
          <div className="rounded-md border border-dashed border-border/50 p-3 text-[11px] text-muted-foreground">
            No hay creativo asociado — <span className="font-mono">utm_content</span>{" "}
            {lead.utmContent ? (
              <>= <span className="font-mono">{lead.utmContent}</span> no es un ad ID numérico.</>
            ) : (
              <>está vacío.</>
            )}
          </div>
        )}
        <dl className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px]">
          {[
            ["Source", lead.utmSource],
            ["Medium", lead.utmMedium],
            ["Campaign", lead.utmCampaign],
            ["Content", lead.utmContent],
            ["Term", lead.utmTerm],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="uppercase tracking-wider text-muted-foreground/70">{label}</dt>
              <dd className="truncate text-foreground/80 font-mono" title={value || undefined}>
                {value || <span className="text-muted-foreground/40">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
