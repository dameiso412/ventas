import { Badge } from "@/components/ui/badge";

export function ScoreBadge({ label }: { label: string | null }) {
  if (!label) return <Badge variant="outline" className="text-xs">Sin score</Badge>;
  const cls = label === "HOT" ? "score-hot" : label === "WARM" ? "score-warm" : label === "TIBIO" ? "score-tibio" : "score-frio";
  return <Badge className={`${cls} border text-xs font-semibold`}>{label}</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome || outcome === "PENDIENTE") return <Badge variant="outline" className="text-xs">Pendiente</Badge>;
  if (outcome === "VENTA") return <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-xs">Venta</Badge>;
  if (outcome === "PERDIDA") return <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-xs">Perdida</Badge>;
  return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs">Seguimiento</Badge>;
}

export function ContactoBadge({ resultado }: { resultado: string | null }) {
  if (!resultado || resultado === "PENDIENTE") return <span className="text-muted-foreground text-xs">Pendiente</span>;
  if (resultado === "CONTESTÓ") return <span className="text-green-400 text-xs font-medium">Contestó</span>;
  return <span className="text-red-400 text-xs font-medium">{resultado}</span>;
}

export function EstadoLeadBadge({ estado }: { estado: string | null }) {
  if (!estado || estado === "NUEVO") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px]">Nuevo</Badge>;
  if (estado === "CONTACTADO") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px]">Contactado</Badge>;
  if (estado === "CALIFICADO") return <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-[10px]">Calificado</Badge>;
  if (estado === "DESCARTADO") return <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[10px]">Descartado</Badge>;
  if (estado === "CONVERTIDO_AGENDA") return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/40 text-[10px]">Convertido</Badge>;
  return <Badge variant="outline" className="text-[10px]">{estado}</Badge>;
}
