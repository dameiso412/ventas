import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/LeadBadges";
import {
  Mail,
  Phone,
  Globe,
  MessageCircle,
  Copy,
  CheckCircle2,
  Loader2,
  Megaphone,
  ExternalLink,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface LeadEditHeaderProps {
  lead: any;
  saveStatus: AutosaveStatus;
  lastSavedAt?: number | null;
  onClose: () => void;
}

function statusCopy(status: AutosaveStatus, lastSavedAt: number | null | undefined): string | null {
  if (status === "saving") return "Guardando...";
  if (status === "error") return "Error al guardar";
  if (status === "saved") {
    if (!lastSavedAt) return "Guardado";
    const secs = Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000));
    if (secs < 3) return "Guardado";
    if (secs < 60) return `Guardado hace ${secs}s`;
    const mins = Math.floor(secs / 60);
    return `Guardado hace ${mins} min`;
  }
  return null;
}

/**
 * Sticky top of the LeadEditSheet. Shows identity (avatar + name), contact
 * channels with one-click quick actions (WhatsApp / email / copy CRM link),
 * current score + origin, and the autosave indicator next to the close button.
 */
export function LeadEditHeader({ lead, saveStatus, lastSavedAt, onClose }: LeadEditHeaderProps) {
  // Pull live score — the parent Sheet also needs it internally but having it
  // here keeps this component self-contained and reflects updates from
  // scoring that happen outside the form (ex: after call recording analyzed).
  const { data: scoringByLeadId } = trpc.scoring.getByLeadId.useQuery(
    { leadId: lead.id },
    { enabled: !!lead.id }
  );
  const needsCorreoFallback = !scoringByLeadId?.p1Frustracion && !!lead.correo;
  const { data: scoringByCorreo } = trpc.scoring.getByCorreo.useQuery(
    { correo: lead.correo || "" },
    { enabled: needsCorreoFallback }
  );
  const scoringData =
    (scoringByLeadId?.p1Frustracion ? scoringByLeadId : scoringByCorreo) || scoringByLeadId;
  const effectiveScore = scoringData?.scoreFinal ?? lead.score;
  const effectiveLabel = scoringData?.scoreLabel ?? lead.scoreLabel;

  const initials = (lead.nombre || lead.correo || "?")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const whatsappHref = lead.telefono
    ? `https://wa.me/${lead.telefono.replace(/[^\d]/g, "")}`
    : null;
  const mailHref = lead.correo ? `mailto:${lead.correo}` : null;

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Copiado");
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const copy_ = copiedField;
  const saveLabel = statusCopy(saveStatus, lastSavedAt);

  return (
    <div className="border-b border-border/40 bg-background">
      <div className="px-5 py-4">
        {/* Top row: avatar + identity + save + close */}
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-primary">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground truncate">
                {lead.nombre || "Sin nombre"}
              </h2>
              <ScoreBadge label={effectiveLabel} />
              {lead.origen && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground font-medium">
                  {lead.origen}
                </span>
              )}
              {effectiveScore && (
                <span className="text-[10px] text-muted-foreground">
                  {effectiveScore}/4
                </span>
              )}
            </div>

            {/* Contact channels row */}
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
              {lead.correo && (
                <button
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                  onClick={() => copy(lead.correo, "correo")}
                  title="Clic para copiar"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[220px]">{lead.correo}</span>
                  {copy_ === "correo" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-40" />
                  )}
                </button>
              )}
              {lead.telefono && (
                <button
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                  onClick={() => copy(lead.telefono, "telefono")}
                  title="Clic para copiar"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>{lead.telefono}</span>
                  {copy_ === "telefono" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-40" />
                  )}
                </button>
              )}
              {lead.pais && (
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  {lead.pais}
                </span>
              )}
              {(lead.utmSource || lead.utmCampaign) && (
                <span className="inline-flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5" />
                  {lead.utmSource || lead.utmCampaign}
                </span>
              )}
            </div>
          </div>

          {/* Save status + close */}
          <div className="flex items-center gap-3 shrink-0">
            {saveLabel && (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-medium",
                  saveStatus === "saving" && "text-muted-foreground",
                  saveStatus === "saved" && "text-green-400",
                  saveStatus === "error" && "text-red-400"
                )}
              >
                {saveStatus === "saving" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saveStatus === "saved" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : null}
                <span>{saveLabel}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-2 mt-3">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
            >
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </a>
          )}
          {mailHref && (
            <a
              href={mailHref}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
            >
              <Mail className="h-3 w-3" /> Email
            </a>
          )}
          {lead.linkCRM && (
            <a
              href={lead.linkCRM}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-muted/40 text-muted-foreground border border-border/40 hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Abrir en CRM
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
