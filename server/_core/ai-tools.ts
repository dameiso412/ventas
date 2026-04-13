import type Anthropic from "@anthropic-ai/sdk";
import * as db from "../db";

// --- System Prompt ---

export const SYSTEM_PROMPT = `Eres el asistente de datos de SacaMedi CRM, la plataforma interna de una agencia de marketing para clinicas de medicina estetica en Chile.

## Tu rol
- Analista de datos del equipo de ventas
- Ayudas a identificar cuellos de botella, diagnosticar problemas y optimizar el funnel
- Respondes siempre en espanol

## Modelo de datos
- **Leads**: Prospectos que llegan via ads, referidos u organico. Tienen: nombre, correo, telefono, origen, scoreLabel (HOT/WARM/TIBIO/FRIO), estadoLead (NUEVO/CONTACTADO/CALIFICADO/DESCARTADO/CONVERTIDO_AGENDA)
- **Agendas**: Leads con cita agendada. Tienen: fecha, tipo (DEMO/INTRO), estadoConfirmacion (PENDIENTE/CONFIRMADA/CANCELADA), asistencia (PENDIENTE/ASISTIO/NO SHOW), outcome (PENDIENTE/VENTA/PERDIDA/SEGUIMIENTO)
- **Setters**: Contactan leads, califican, agendan demos. Metricas clave: tasa contacto, tiempo respuesta, intentos
- **Closers**: Hacen la demo/intro y cierran. Metricas clave: show rate, offer rate, close rate, ticket promedio, cash collected
- **Follow-ups**: Leads en seguimiento post-demo (HOT/WARM)
- **Financiero**: facturado, cashCollected, deposito, contractedRevenue, setupFee, recurrenciaMensual

## Filtros temporales
Los datos se organizan por mes (Enero, Febrero, ...) y semana (1-5). Cuando el usuario pregunte por "este mes" usa el mes actual. Cuando diga "esta semana" estima la semana del mes.

## Reglas
1. SIEMPRE usa herramientas para obtener datos reales antes de responder con numeros. Nunca inventes datos.
2. Cuando presentes datos, usa tablas markdown y formatos claros.
3. Para acciones (actualizar lead, crear follow-up), PRIMERO describe lo que vas a hacer y pide confirmacion al usuario antes de ejecutar.
4. Si el usuario pide algo que no puedes hacer con las herramientas disponibles, explicale que limitaciones tienes.
5. Se conciso pero completo. Usa bullet points y estructura clara.`;

// --- Tool Definitions ---

type Tool = Anthropic.Messages.Tool;

const filterParams = {
  mes: { type: "string" as const, description: "Mes: Enero, Febrero, Marzo, Abril, Mayo, Junio, Julio, Agosto, Septiembre, Octubre, Noviembre, Diciembre" },
  semana: { type: "number" as const, description: "Semana del mes (1-5)" },
};

export const TOOLS: Tool[] = [
  {
    name: "get_dashboard_kpis",
    description: "KPIs generales del dashboard: total leads, contestados, demos confirmadas, asistidas, ofertas, ventas, seguimientos, no-shows, revenue, cash collected. Filtra por mes y semana.",
    input_schema: { type: "object", properties: filterParams },
  },
  {
    name: "get_setter_kpis",
    description: "KPIs de setters: tasa de contacto, tasa de respuesta, intentos promedio, triage completado, demos agendadas. Filtra por mes y semana.",
    input_schema: { type: "object", properties: filterParams },
  },
  {
    name: "get_closer_kpis",
    description: "KPIs de closers: show rate, offer rate, close rate, revenue total, cash collected, ticket promedio, depositos. Filtra por mes y semana.",
    input_schema: { type: "object", properties: filterParams },
  },
  {
    name: "get_marketing_kpis",
    description: "KPIs de marketing: leads por fuente (ADS/REFERIDO/ORGANICO), funnel de conversion, metricas de ads. Filtra por mes y semana.",
    input_schema: { type: "object", properties: filterParams },
  },
  {
    name: "get_setter_leaderboard",
    description: "Ranking de setters con metricas individuales: leads asignados, contactados, demos agendadas, tasa de contacto. Filtra por mes y semana.",
    input_schema: { type: "object", properties: filterParams },
  },
  {
    name: "get_closer_leaderboard",
    description: "Ranking de closers con metricas individuales: demos asignadas, asistencias, ofertas, ventas, close rate, revenue. Filtra por mes y semana.",
    input_schema: { type: "object", properties: filterParams },
  },
  {
    name: "get_leads",
    description: "Buscar leads con filtros. Retorna maximo 50 leads con todos sus datos. Usa filtros para acotar la busqueda.",
    input_schema: {
      type: "object",
      properties: {
        ...filterParams,
        origen: { type: "string", description: "Fuente: ADS, REFERIDO, ORGANICO" },
        setter: { type: "string", description: "Nombre del setter asignado" },
        closer: { type: "string", description: "Nombre del closer asignado" },
        scoreLabel: { type: "string", description: "Score: HOT, WARM, TIBIO, FRIO" },
        outcome: { type: "string", description: "Resultado: VENTA, PERDIDA, SEGUIMIENTO, PENDIENTE" },
        tipo: { type: "string", description: "Tipo de cita: DEMO, INTRO" },
        categoria: { type: "string", description: "AGENDA (con cita) o LEAD (sin agendar)" },
        estadoLead: { type: "string", description: "Estado: NUEVO, CONTACTADO, CALIFICADO, DESCARTADO, CONVERTIDO_AGENDA" },
      },
    },
  },
  {
    name: "get_speed_to_lead_alerts",
    description: "Leads con tiempo de respuesta lento (sin primer contacto despues del umbral). Devuelve leads que necesitan atencion urgente.",
    input_schema: {
      type: "object",
      properties: {
        threshold_minutes: { type: "number", description: "Umbral en minutos (default 30)" },
      },
    },
  },
  {
    name: "get_unassigned_leads",
    description: "Leads que no tienen setter asignado. Requieren asignacion inmediata.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_stale_seguimientos",
    description: "Seguimientos estancados sin actividad reciente. Indica cuellos de botella en el follow-up.",
    input_schema: {
      type: "object",
      properties: {
        hours_threshold: { type: "number", description: "Umbral en horas (default 72)" },
      },
    },
  },
  {
    name: "get_data_validation",
    description: "Validacion de integridad de datos del CRM: inconsistencias, campos faltantes, datos que no cuadran entre tracker y leads.",
    input_schema: { type: "object", properties: filterParams },
  },
  {
    name: "update_lead",
    description: "Actualizar campos de un lead. SOLO usar despues de que el usuario confirme la accion. Campos permitidos: estadoLead, outcome, asistencia, estadoConfirmacion, setterAsignado, closer, notas, ofertaHecha, califica, validoParaContacto, triage.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID del lead a actualizar" },
        estadoLead: { type: "string" },
        outcome: { type: "string" },
        asistencia: { type: "string" },
        estadoConfirmacion: { type: "string" },
        setterAsignado: { type: "string" },
        closer: { type: "string" },
        notas: { type: "string" },
        ofertaHecha: { type: "string" },
        califica: { type: "string" },
        validoParaContacto: { type: "string" },
        triage: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_follow_up",
    description: "Crear un follow-up para un lead. SOLO usar despues de que el usuario confirme la accion.",
    input_schema: {
      type: "object",
      properties: {
        leadId: { type: "number", description: "ID del lead" },
        nombre: { type: "string" },
        correo: { type: "string" },
        telefono: { type: "string" },
        tipo: { type: "string", description: "HOT o WARM" },
        prioridad: { type: "string", description: "RED_HOT, HOT, WARM, COLD" },
        closerAsignado: { type: "string" },
        notas: { type: "string" },
      },
      required: ["leadId", "tipo", "prioridad"],
    },
  },
];

// --- Tool Execution ---

const ALLOWED_UPDATE_FIELDS = new Set([
  "estadoLead", "outcome", "asistencia", "estadoConfirmacion",
  "setterAsignado", "closer", "notas", "ofertaHecha",
  "califica", "validoParaContacto", "triage",
]);

export async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  try {
    let result: any;

    switch (name) {
      case "get_dashboard_kpis":
        result = await db.getDashboardKPIs(input);
        break;
      case "get_setter_kpis":
        result = await db.getSetterTrackerKPIs(input);
        break;
      case "get_closer_kpis":
        result = await db.getCloserTrackerKPIs(input);
        break;
      case "get_marketing_kpis":
        result = await db.getMarketingKPIs(input);
        break;
      case "get_setter_leaderboard":
        result = await db.getSetterLeaderboard(input);
        break;
      case "get_closer_leaderboard":
        result = await db.getCloserLeaderboard(input);
        break;
      case "get_leads": {
        const leads = await db.getLeads(input);
        result = (leads || []).slice(0, 50);
        break;
      }
      case "get_speed_to_lead_alerts":
        result = await db.getSpeedToLeadAlerts(input.threshold_minutes ?? 30);
        break;
      case "get_unassigned_leads":
        result = await db.getUnassignedLeads();
        break;
      case "get_stale_seguimientos":
        result = await db.getStaleSeguimientos(input.hours_threshold ?? 72);
        break;
      case "get_data_validation":
        result = await db.getDataValidation(input);
        break;
      case "update_lead": {
        const { id, ...fields } = input;
        const safeFields: Record<string, any> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (ALLOWED_UPDATE_FIELDS.has(k) && v !== undefined) safeFields[k] = v;
        }
        if (Object.keys(safeFields).length === 0) return "Error: No se proporcionaron campos validos para actualizar.";
        await db.updateLead(id, safeFields);
        result = { success: true, id, updatedFields: Object.keys(safeFields) };
        break;
      }
      case "create_follow_up": {
        const fuId = await db.createFollowUp(input as any);
        result = { success: true, followUpId: fuId };
        break;
      }
      default:
        return `Error: Herramienta "${name}" no reconocida.`;
    }

    const json = JSON.stringify(result, null, 2);
    if (json.length > 15000) {
      return json.slice(0, 15000) + "\n\n[TRUNCADO: resultado demasiado largo. Usa filtros mas especificos.]";
    }
    return json;
  } catch (err: any) {
    return `Error ejecutando ${name}: ${err.message}`;
  }
}
