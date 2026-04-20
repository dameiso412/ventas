/**
 * CampaignFilter — popover multi-select para excluir campañas Meta del agregado de ads.
 *
 * Semántica:
 *   - Por default TODAS las campañas están incluidas (excludedIds = []).
 *   - Al destildar un checkbox, ese campaignId pasa a `excludedIds` y se propaga
 *     al backend via el parámetro `excludedCampaignIds` del query marketingKPIs.
 *   - El filtro afecta adSpend, leads, CTR y todos los KPIs derivados (CPL, CPA, ROAS).
 *
 * Caso de uso principal: el CRM sincroniza TODAS las campañas del ad account
 * (tráfico, awareness, leads paralelos, call funnel), pero el dashboard debe
 * reflejar solo el gasto del call funnel para que los costos-por-etapa sean reales.
 *
 * Persistencia: el caller persiste `excludedIds` en localStorage por browser/user.
 *
 * Quick actions: Todas / Ninguna / Solo ventas / Solo leads + reset.
 */
import { useMemo, useState } from "react";
import { Filter, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Props {
  excludedIds: string[];
  onChange: (excludedIds: string[]) => void;
  className?: string;
}

// Mapeo de los objetivos Meta a etiquetas cortas en español + un flag `isSalesFunnel`
// para las quick actions "Solo ventas" / "Solo leads".
const OBJECTIVE_LABELS: Record<string, { short: string; isSales: boolean; isLeads: boolean }> = {
  OUTCOME_SALES:       { short: "Ventas",       isSales: true,  isLeads: false },
  OUTCOME_LEADS:       { short: "Leads",        isSales: false, isLeads: true  },
  OUTCOME_TRAFFIC:     { short: "Tráfico",      isSales: false, isLeads: false },
  OUTCOME_AWARENESS:   { short: "Awareness",    isSales: false, isLeads: false },
  OUTCOME_ENGAGEMENT:  { short: "Engagement",   isSales: false, isLeads: false },
  OUTCOME_APP_PROMOTION: { short: "App",        isSales: false, isLeads: false },
};

function objectiveMeta(objective: string | null | undefined) {
  if (!objective) return { short: "—", isSales: false, isLeads: false };
  return OBJECTIVE_LABELS[objective] ?? { short: objective.replace("OUTCOME_", ""), isSales: false, isLeads: false };
}

export default function CampaignFilter({ excludedIds, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: campaigns, isLoading } = trpc.metaAds.campaigns.useQuery(undefined, {
    // Las campañas rara vez cambian — cachea agresivo para no refetchear cada vez
    // que se abre el popover.
    staleTime: 5 * 60 * 1000,
  });

  // Orden: ACTIVE primero, luego PAUSED, luego resto. Dentro de cada grupo por updatedAt DESC (viene así del backend).
  const sortedCampaigns = useMemo(() => {
    if (!campaigns) return [];
    const statusRank = (s: string | null | undefined) => {
      if (s === "ACTIVE") return 0;
      if (s === "PAUSED") return 1;
      return 2;
    };
    return [...campaigns].sort((a, b) => statusRank(a.status) - statusRank(b.status));
  }, [campaigns]);

  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds]);
  const totalCount = sortedCampaigns.length;
  const includedCount = totalCount - excludedSet.size;

  const toggle = (campaignId: string) => {
    if (excludedSet.has(campaignId)) {
      onChange(excludedIds.filter((id) => id !== campaignId));
    } else {
      onChange([...excludedIds, campaignId]);
    }
  };

  const selectAll = () => onChange([]);
  const selectNone = () => onChange(sortedCampaigns.map((c) => c.campaignId));
  const selectByObjective = (predicate: (o: ReturnType<typeof objectiveMeta>) => boolean) => {
    const excluded = sortedCampaigns
      .filter((c) => !predicate(objectiveMeta(c.objective)))
      .map((c) => c.campaignId);
    onChange(excluded);
  };

  // Label del botón: si hay exclusiones muestra "N / M campañas", sino "Todas las campañas"
  const buttonLabel =
    excludedSet.size === 0
      ? `Todas (${totalCount})`
      : `${includedCount}/${totalCount} campañas`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          data-testid="campaign-filter-trigger"
        >
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          <span className="text-xs">{buttonLabel}</span>
          {excludedSet.size > 0 && (
            <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
              {excludedSet.size} oculta{excludedSet.size === 1 ? "" : "s"}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Campañas incluidas en el gasto</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Desmarca campañas de tráfico, awareness o leads paralelos para que el gasto refleje solo tu call funnel.
          </p>
        </div>

        {/* Quick actions */}
        <div className="px-3 py-2 border-b bg-muted/30 flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>
            Todas
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectNone}>
            Ninguna
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => selectByObjective((m) => m.isSales)}
          >
            Solo Ventas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => selectByObjective((m) => m.isSales || m.isLeads)}
          >
            Ventas + Leads
          </Button>
        </div>

        <ScrollArea className="max-h-80">
          <div className="p-2">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Cargando campañas…</div>
            ) : sortedCampaigns.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No hay campañas sincronizadas todavía.
              </div>
            ) : (
              sortedCampaigns.map((c) => {
                const meta = objectiveMeta(c.objective);
                const isExcluded = excludedSet.has(c.campaignId);
                const isIncluded = !isExcluded;
                return (
                  <label
                    key={c.campaignId}
                    htmlFor={`camp-${c.campaignId}`}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      id={`camp-${c.campaignId}`}
                      checked={isIncluded}
                      onCheckedChange={() => toggle(c.campaignId)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs font-medium truncate ${isIncluded ? "" : "text-muted-foreground line-through"}`}
                        >
                          {c.name || c.campaignId}
                        </span>
                        {c.status === "ACTIVE" && (
                          <Badge variant="default" className="h-4 px-1.5 text-[9px] bg-emerald-600 hover:bg-emerald-600">
                            Activa
                          </Badge>
                        )}
                        {c.status === "PAUSED" && (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                            Pausada
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{meta.short}</span>
                        {meta.isSales && (
                          <Check className="h-2.5 w-2.5 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </ScrollArea>

        <Separator />
        <div className="p-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{includedCount} de {totalCount} incluidas</span>
          {excludedSet.size > 0 && (
            <button
              type="button"
              onClick={selectAll}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Restablecer
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
