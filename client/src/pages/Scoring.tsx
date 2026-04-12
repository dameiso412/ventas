import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { Flame, Sun, CloudSun, Snowflake } from "lucide-react";
import { useStatusColors } from "@/hooks/useStatusColors";
import { ProspectProfile } from "@/components/ProspectProfile";

function useScoreConfig() {
  const sc = useStatusColors();
  return useMemo(() => ({
    HOT: { label: "HOT", icon: Flame, color: sc.bad, bg: "bg-red-500/10", border: "border-red-500/30", desc: "Lead perfecto, alta urgencia, autoridad y presupuesto" },
    WARM: { label: "WARM", icon: Sun, color: sc.isDark ? "#f97316" : "#c2410c", bg: "bg-orange-500/10", border: "border-orange-500/30", desc: "Buen lead, algo de urgencia, probable decisor" },
    TIBIO: { label: "TIBIO", icon: CloudSun, color: sc.warning, bg: "bg-amber-500/10", border: "border-amber-500/30", desc: "Potencial pero sin urgencia o poder de decisión claro" },
    "FRÍO": { label: "FRÍO", icon: Snowflake, color: sc.info, bg: "bg-blue-500/10", border: "border-blue-500/30", desc: "No califica, sin urgencia, no en posición de comprar" },
  }), [sc]);
}

type ScoreConfigType = ReturnType<typeof useScoreConfig>;

function ScoreBadge({ label, scoreConfig }: { label: string | null; scoreConfig: ScoreConfigType }) {
  if (!label) return <Badge variant="outline" className="text-xs">Sin score</Badge>;
  const config = scoreConfig[label as keyof ScoreConfigType];
  if (!config) return <Badge variant="outline" className="text-xs">{label}</Badge>;
  const Icon = config.icon;
  return (
    <Badge className={`${config.bg} ${config.border} border text-xs font-semibold gap-1`} style={{ color: config.color }}>
      <Icon className="h-3 w-3" /> {config.label}
    </Badge>
  );
}

export default function Scoring() {
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const SCORE_CONFIG = useScoreConfig();

  const { data: scoringRecords, isLoading } = trpc.scoring.list.useQuery(
    scoreFilter !== "all" ? { scoreLabel: scoreFilter } : undefined
  );
  const { data: leads } = trpc.leads.list.useQuery(
    scoreFilter !== "all" ? { scoreLabel: scoreFilter } : undefined
  );

  // Count by score
  const counts = useMemo(() => {
    if (!leads) return { HOT: 0, WARM: 0, TIBIO: 0, "FRÍO": 0 };
    return leads.reduce((acc, l) => {
      if (l.scoreLabel && acc[l.scoreLabel as keyof typeof acc] !== undefined) {
        acc[l.scoreLabel as keyof typeof acc]++;
      }
      return acc;
    }, { HOT: 0, WARM: 0, TIBIO: 0, "FRÍO": 0 });
  }, [leads]);

  // Merge scoring data with leads
  const enrichedLeads = useMemo(() => {
    if (!leads) return [];
    const scoringMap = new Map((scoringRecords || []).map(s => [s.leadId, s]));
    return leads.filter(l => l.scoreLabel).map(l => ({
      ...l,
      scoring: scoringMap.get(l.id) || null,
    }));
  }, [leads, scoringRecords]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Score de Calificación</h1>
          <p className="text-sm text-muted-foreground mt-1">Evaluación automática de leads basada en formulario de 6 preguntas</p>
        </div>
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-[140px] bg-card/50"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="HOT">HOT (4)</SelectItem>
            <SelectItem value="WARM">WARM (3)</SelectItem>
            <SelectItem value="TIBIO">TIBIO (2)</SelectItem>
            <SelectItem value="FRÍO">FRÍO (1)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Score Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(SCORE_CONFIG) as Array<keyof ScoreConfigType>).map(key => {
          const config = SCORE_CONFIG[key];
          const Icon = config.icon;
          const count = counts[key] || 0;
          return (
            <Card key={key} className={`${config.bg} ${config.border} border cursor-pointer hover:scale-[1.02] transition-transform`}
              onClick={() => setScoreFilter(scoreFilter === key ? "all" : key)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider" style={{ color: config.color }}>{config.label}</p>
                    <p className="text-3xl font-bold mt-1" style={{ color: config.color }}>{count}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{config.desc}</p>
                  </div>
                  <Icon className="h-8 w-8 opacity-50" style={{ color: config.color }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Leads with Scoring Details */}
      <div className="space-y-3">
        {enrichedLeads.map(lead => (
          <Card key={lead.id} className="bg-card/50 border-border/50 hover:border-primary/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Lead Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{lead.nombre || "Sin nombre"}</h3>
                    <ScoreBadge label={lead.scoreLabel} scoreConfig={SCORE_CONFIG} />
                    <Badge variant="outline" className="text-xs">{lead.origen}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {lead.correo && <span>{lead.correo}</span>}
                    {lead.telefono && <span>{lead.telefono}</span>}
                    {lead.instagram && <span>@{lead.instagram}</span>}
                    {lead.pais && <span>{lead.pais}</span>}
                  </div>
                </div>

                {/* Score Number */}
                <div className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="text-3xl font-bold" style={{ color: SCORE_CONFIG[lead.scoreLabel as keyof ScoreConfigType]?.color || "var(--muted-foreground)" }}>
                      {lead.score || "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">/4</div>
                  </div>
                </div>
              </div>

              {/* Universal Prospect Profile */}
              <div className="mt-3 pt-3 border-t border-border/30">
                <ProspectProfile leadId={lead.id} />
              </div>
            </CardContent>
          </Card>
        ))}

        {enrichedLeads.length === 0 && !isLoading && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>No hay leads con scoring disponible.</p>
              <p className="text-xs mt-1">Los leads recibidos por webhook con respuestas del formulario serán evaluados automáticamente.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
