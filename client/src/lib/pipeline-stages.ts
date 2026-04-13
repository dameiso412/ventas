// Pipeline stage configurations, derivation logic, and transition maps

export interface StageConfig {
  key: string;
  label: string;
  dot: string;
  text: string;
  bg: string;
}

// --- AGENDAS Pipeline (10 stages) ---

export const AGENDAS_STAGES: StageConfig[] = [
  { key: "DEMO_CALL_REQUESTED",        label: "Demo Call Requested",        dot: "bg-slate-400",   text: "text-slate-400",   bg: "bg-slate-500/20" },
  { key: "CONTACTADAS_CONFIRMADAS",     label: "Contactadas y Confirmadas",  dot: "bg-blue-400",    text: "text-blue-400",    bg: "bg-blue-500/20" },
  { key: "CONTACTADAS_NO_CONFIRMADAS",  label: "Contactadas No Confirmadas", dot: "bg-amber-400",   text: "text-amber-400",   bg: "bg-amber-500/20" },
  { key: "NO_CALIFICADAS",             label: "No Calificadas",             dot: "bg-gray-400",    text: "text-gray-400",    bg: "bg-gray-500/20" },
  { key: "TRIAGE_CANCELO",             label: "Triage → Canceló",           dot: "bg-red-400",     text: "text-red-400",     bg: "bg-red-500/20" },
  { key: "NO_SHOW",                    label: "No Show",                    dot: "bg-orange-400",  text: "text-orange-400",  bg: "bg-orange-500/20" },
  { key: "DEMO_SHOW_NO_CERRO",         label: "Demo Show, No Cerró",        dot: "bg-purple-400",  text: "text-purple-400",  bg: "bg-purple-500/20" },
  { key: "CLOSED_VENTA",               label: "Closed (Venta)",             dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/20" },
  { key: "DESCALIFICADAS",             label: "Descalificadas",             dot: "bg-rose-400",    text: "text-rose-400",    bg: "bg-rose-500/20" },
  { key: "BTC",                        label: "BTC",                        dot: "bg-cyan-400",    text: "text-cyan-400",    bg: "bg-cyan-500/20" },
];

// --- LEADS Pipeline (5 stages) ---

export const LEADS_STAGES: StageConfig[] = [
  { key: "NUEVO",              label: "Nuevo",      dot: "bg-blue-400",   text: "text-blue-400",   bg: "bg-blue-500/20" },
  { key: "CONTACTADO",         label: "Contactado", dot: "bg-amber-400",  text: "text-amber-400",  bg: "bg-amber-500/20" },
  { key: "CALIFICADO",         label: "Calificado", dot: "bg-green-400",  text: "text-green-400",  bg: "bg-green-500/20" },
  { key: "CONVERTIDO_AGENDA",  label: "Convertido", dot: "bg-purple-400", text: "text-purple-400", bg: "bg-purple-500/20" },
  { key: "DESCARTADO",         label: "Descartado", dot: "bg-red-400",    text: "text-red-400",    bg: "bg-red-500/20" },
];

// --- Stage derivation ---

export function getAgendaPipelineStage(lead: any): string {
  if (lead.outcome === "VENTA") return "CLOSED_VENTA";
  if (lead.asistencia === "ASISTIÓ" && lead.califica === "NO") return "DESCALIFICADAS";
  if (lead.outcome === "SEGUIMIENTO") return "BTC";
  if (lead.asistencia === "ASISTIÓ" && lead.outcome === "PERDIDA") return "DEMO_SHOW_NO_CERRO";
  if (lead.asistencia === "ASISTIÓ" && lead.outcome === "PENDIENTE") return "DEMO_SHOW_NO_CERRO";
  if (lead.asistencia === "NO SHOW") return "NO_SHOW";
  if (lead.estadoConfirmacion === "CANCELADA" && lead.triage && lead.triage !== "PENDIENTE" && lead.triage !== "N/A") return "TRIAGE_CANCELO";
  if (lead.califica === "NO" || lead.estadoLead === "DESCARTADO") return "NO_CALIFICADAS";
  if (lead.estadoConfirmacion === "CONFIRMADA") return "CONTACTADAS_CONFIRMADAS";
  const contactado = lead.resultadoContacto && lead.resultadoContacto !== "PENDIENTE";
  if (contactado) return "CONTACTADAS_NO_CONFIRMADAS";
  return "DEMO_CALL_REQUESTED";
}

export function getLeadsPipelineStage(lead: any): string {
  return lead.estadoLead || "NUEVO";
}

// --- Transition maps ---

// Post-demo stages that cannot revert to pre-demo
const POST_DEMO_STAGES = new Set(["NO_SHOW", "DEMO_SHOW_NO_CERRO", "CLOSED_VENTA", "DESCALIFICADAS", "BTC"]);
const PRE_DEMO_STAGES = new Set(["DEMO_CALL_REQUESTED", "CONTACTADAS_CONFIRMADAS", "CONTACTADAS_NO_CONFIRMADAS"]);

interface TransitionResult {
  allowed: boolean;
  fields?: Record<string, any>;
  reason?: string;
}

function getAgendaTransition(source: string, target: string, lead: any): TransitionResult {
  // From CLOSED_VENTA: only BTC allowed
  if (source === "CLOSED_VENTA" && target !== "BTC") {
    return { allowed: false, reason: "No se puede revertir una venta. Usa el formulario de edición." };
  }

  // From post-demo stages: cannot go back to pre-demo
  if (POST_DEMO_STAGES.has(source) && PRE_DEMO_STAGES.has(target)) {
    return { allowed: false, reason: "No se puede volver a una etapa pre-demo desde una etapa post-demo." };
  }

  // Build fields based on target
  const fields: Record<string, any> = {};

  switch (target) {
    case "DEMO_CALL_REQUESTED":
      fields.estadoConfirmacion = "PENDIENTE";
      fields.resultadoContacto = "PENDIENTE";
      fields.asistencia = "PENDIENTE";
      fields.outcome = "PENDIENTE";
      break;
    case "CONTACTADAS_CONFIRMADAS":
      fields.estadoConfirmacion = "CONFIRMADA";
      break;
    case "CONTACTADAS_NO_CONFIRMADAS":
      fields.estadoConfirmacion = "PENDIENTE";
      if (!lead.resultadoContacto || lead.resultadoContacto === "PENDIENTE") {
        fields.resultadoContacto = "NO CONTESTÓ";
      }
      break;
    case "NO_CALIFICADAS":
      fields.califica = "NO";
      break;
    case "TRIAGE_CANCELO":
      fields.estadoConfirmacion = "CANCELADA";
      if (!lead.triage || lead.triage === "PENDIENTE" || lead.triage === "N/A") {
        fields.triage = "COMPLETADO";
      }
      break;
    case "NO_SHOW":
      fields.asistencia = "NO SHOW";
      break;
    case "DEMO_SHOW_NO_CERRO":
      fields.asistencia = "ASISTIÓ";
      fields.outcome = "PERDIDA";
      break;
    case "CLOSED_VENTA":
      fields.outcome = "VENTA";
      break;
    case "DESCALIFICADAS":
      fields.califica = "NO";
      fields.asistencia = "ASISTIÓ";
      break;
    case "BTC":
      fields.outcome = "SEGUIMIENTO";
      break;
  }

  return { allowed: true, fields };
}

// LEADS transitions: direct estadoLead mapping, all allowed
const LEADS_STAGE_MAP: Record<string, string> = {
  NUEVO: "NUEVO",
  CONTACTADO: "CONTACTADO",
  CALIFICADO: "CALIFICADO",
  CONVERTIDO_AGENDA: "CONVERTIDO_AGENDA",
  DESCARTADO: "DESCARTADO",
};

function getLeadsTransition(target: string): TransitionResult {
  const estadoLead = LEADS_STAGE_MAP[target];
  if (!estadoLead) return { allowed: false, reason: "Etapa no reconocida." };
  return { allowed: true, fields: { estadoLead } };
}

// --- Public API ---

export function getTransitionFields(
  vista: "AGENDAS" | "LEADS",
  source: string,
  target: string,
  lead: any,
): TransitionResult {
  if (vista === "LEADS") return getLeadsTransition(target);
  return getAgendaTransition(source, target, lead);
}
