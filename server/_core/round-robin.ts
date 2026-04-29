/**
 * Weighted Round-Robin determinístico para asignar agendas a setters.
 *
 * Algoritmo (test-coverable, sin estado mutable propio):
 *   1. Lee la regla activa por eventType + sus targets activos. Si no hay
 *      regla, está inactiva, o no tiene targets, retorna null (no asigna,
 *      el webhook sigue su flujo legacy con setterAsignado=NULL).
 *   2. Cuenta cuántas asignaciones tiene cada target en la tabla de
 *      assignments (esa tabla ES el estado del algoritmo).
 *   3. Para cada target, calcula deficit = expected − actual donde
 *      expected = (totalAssignments + 1) * (percentage / 100). Sumamos +1
 *      al total porque queremos saber el deficit DESPUÉS de la próxima
 *      asignación; sin eso, en la primera asignación todos los deficits
 *      son 0 y el desempate decide siempre a favor del de mayor %.
 *   4. Asigna al target con MAYOR deficit. Empate: el de mayor percentage
 *      gana (más estable cuando arrancás de cero).
 *   5. Inserta en round_robin_assignments y devuelve { setterName, ruleId }.
 *
 * Por qué este algoritmo (vs random ponderado):
 *   - 100 asignaciones con 70/30 → distribución exacta 70/30 ± 1.
 *   - Predecible: dado el estado actual, podés calcular el siguiente.
 *   - No necesita un counter o seed mutable separado.
 *
 * Race conditions:
 *   - Si dos webhooks llegan en paralelo y ambos calculan antes de insertar,
 *     pueden terminar dándole al mismo setter (1 lead de overshoot).
 *   - El algoritmo se autocorrige en las próximas asignaciones porque el
 *     siguiente deficit recalcula. Aceptable trade-off vs una row-lock
 *     pesado en el path crítico del webhook.
 */
import * as db from "../db";
import { sendSlackAlert, crmUrls } from "./slack";

export interface RoundRobinResult {
  setterName: string;
  ruleId: number;
}

/**
 * Calcula y persiste la próxima asignación para el evento dado.
 * Devuelve null cuando no hay regla activa o no hay targets — en ese caso
 * el caller debe tratarlo como "no se pudo asignar" (el lead queda sin
 * setter, comportamiento legacy).
 */
export async function assignViaRoundRobin(
  eventType: string,
  leadId: number,
): Promise<RoundRobinResult | null> {
  const config = await db.getActiveRoundRobinRule(eventType);
  if (!config) return null;

  const target = await pickNextTarget(config);
  if (!target) return null;

  await db.recordRoundRobinAssignment({
    ruleId: config.rule.id,
    leadId,
    setterName: target.setterName,
  });

  return { setterName: target.setterName, ruleId: config.rule.id };
}

/**
 * Variante read-only: calcula a quién le tocaría sin insertar nada.
 * Usado por la UI admin ("si llegara una agenda ahora, le tocaría a X").
 */
export async function previewNextAssignment(
  eventType: string,
): Promise<RoundRobinResult | null> {
  const config = await db.getActiveRoundRobinRule(eventType);
  if (!config) return null;
  const target = await pickNextTarget(config);
  if (!target) return null;
  return { setterName: target.setterName, ruleId: config.rule.id };
}

/**
 * Núcleo del algoritmo — separado para testabilidad. Calcula deficit por
 * target y devuelve el ganador. NO escribe en la DB.
 */
async function pickNextTarget(config: {
  rule: { id: number };
  targets: Array<{ setterName: string; percentage: number; activo: number }>;
}): Promise<{ setterName: string; percentage: number } | null> {
  const counts = await db.getRoundRobinAssignmentCounts(config.rule.id);
  return computeNextTarget(config.targets, counts);
}

/**
 * Función pura — toda la matemática del algoritmo. Exportada para tests
 * unitarios sin tocar la DB.
 *
 * @param targets   Lista de targets activos (filtrar antes de pasarlos).
 * @param counts    Map de setterName → count actual de asignaciones.
 * @returns         El target ganador, o null si la lista está vacía.
 */
export function computeNextTarget(
  targets: Array<{ setterName: string; percentage: number }>,
  counts: Record<string, number>,
): { setterName: string; percentage: number } | null {
  if (targets.length === 0) return null;
  const totalActual = Object.values(counts).reduce((a, b) => a + b, 0);
  // +1 = "después de esta nueva asignación, ¿quién está más por debajo
  // de su % esperado?". Sin el +1, en la primera asignación todos los
  // deficits son 0 y el resultado depende solo del tiebreaker.
  const totalExpected = totalActual + 1;

  let bestTarget = targets[0];
  let bestDeficit = -Infinity;
  for (const t of targets) {
    const expected = totalExpected * (t.percentage / 100);
    const actual = counts[t.setterName] ?? 0;
    const deficit = expected - actual;
    if (
      deficit > bestDeficit
      || (deficit === bestDeficit && t.percentage > bestTarget.percentage)
    ) {
      bestDeficit = deficit;
      bestTarget = t;
    }
  }
  return { setterName: bestTarget.setterName, percentage: bestTarget.percentage };
}

/**
 * Slack notif al canal del equipo cuando una agenda nueva fue asignada
 * (o no, si la regla está inactiva). Texto plano sin @-mention real —
 * decisión consciente para no mantener Slack User IDs por persona.
 *
 * Fire-and-forget: el caller la llama sin await crítico. Si Slack está
 * caído, la agenda se crea igual (sendSlackAlert ya falla silente y
 * loggea console.error internamente).
 */
export async function notifyAgendaAssigned(args: {
  leadId: number;
  setterName: string | null;
  nombre: string;
  correo?: string | null;
  telefono?: string | null;
  fecha: Date;
  tipoCita: "DEMO" | "INTRO";
  linkCRM?: string | null;
}): Promise<void> {
  const setterText = args.setterName ?? "Sin asignar";
  const fechaStr = args.fecha.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "short",
    timeStyle: "short",
  });

  const fields: Array<{ label: string; value: string }> = [
    { label: "👤 Setter", value: args.setterName ? `*${args.setterName}*` : "_sin asignar_" },
    { label: "📋 Tipo", value: args.tipoCita },
    { label: "🗓️ Fecha", value: fechaStr },
    { label: "🆔 Lead", value: `#${args.leadId}` },
  ];
  if (args.correo) fields.push({ label: "✉️ Correo", value: args.correo });
  if (args.telefono) fields.push({ label: "📱 Teléfono", value: args.telefono });

  // Action buttons: GHL link first (where the conversation lives) when
  // available, then deep link to the lead in our CRM.
  const actions: Array<{ label: string; url: string; emoji?: string; style?: "primary" | "danger" }> = [
    { label: "Abrir en CRM", url: crmUrls.lead(args.leadId), emoji: "🔗", style: "primary" },
  ];
  if (args.linkCRM) {
    actions.push({ label: "Abrir en GHL", url: args.linkCRM, emoji: "📞" });
  }
  actions.push({ label: "Round-Robin", url: crmUrls.roundRobin(), emoji: "🔀" });

  await sendSlackAlert({
    severity: args.setterName ? "success" : "warning",
    title: `Nueva agenda ${args.tipoCita} → ${setterText}`,
    body: `${args.nombre || "_lead sin nombre_"} agendó una cita para el *${fechaStr}*.`,
    emoji: args.setterName ? "🎯" : "⚠️",
    fields,
    actions,
  });
}
