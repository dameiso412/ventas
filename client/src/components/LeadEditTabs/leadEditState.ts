/**
 * Shared types, constants, initial-state builder and sanitizer used by all
 * tabs of the lead edit Sheet. Extracted from the old inline EditLeadForm
 * (previously in client/src/pages/Citas.tsx) so every tab can consume the
 * same shape without prop-drilling individual fields.
 */

export const ORIGENES = ["ADS", "REFERIDO", "ORGANICO", "INSTAGRAM"] as const;
export const ESTADOS_CONFIRMACION = [
  "PENDIENTE",
  "CONFIRMADA",
  "NO CONFIRMADA",
  "CANCELADA",
  "REAGENDADA",
] as const;
export const ASISTENCIAS = ["PENDIENTE", "ASISTIÓ", "NO SHOW"] as const;
export const OUTCOMES = ["PENDIENTE", "VENTA", "PERDIDA", "SEGUIMIENTO"] as const;
export const OFERTAS = ["SÍ", "NO", "N/A"] as const;
export const CALIFICA_OPTIONS = ["SÍ", "NO", "POR EVALUAR"] as const;
export const VALIDO_OPTIONS = ["SÍ", "NO"] as const;
export const TRIAGE_OPTIONS = ["PENDIENTE", "COMPLETADO", "N/A"] as const;
export const RAZONES_NO_CALIFICA = [
  "Agencia",
  "Rubro No Válido",
  "Sin Presupuesto",
  "Clínica Muy Nueva",
  "No Es Propietario",
  "Otro",
] as const;
export const RAZONES_NO_CONVERSION = [
  "Sin Dinero",
  "Logística",
  "Era una agencia de MK no válido",
  "Necesita Consultarlo",
  "Quiere Comparar",
  "No Interesado",
  "Otro",
] as const;
export const CALIFICACION_FINANCIERA = ["SÍ", "NO", "PARCIAL"] as const;

export type LeadForm = {
  // Datos de entrada
  nombre: string;
  correo: string;
  telefono: string;
  pais: string;
  instagram: string;
  origen: string;
  tipo: string;
  // Proceso de contacto
  setterAsignado: string;
  // Calificación
  validoParaContacto: string;
  califica: string;
  razonNoCalifica: string;
  estadoConfirmacion: string;
  triage: string;
  calificacionFinanciera: string;
  respuestaFinanciera: string;
  // Demo y resultado
  asistencia: string;
  closer: string;
  ofertaHecha: string;
  outcome: string;
  razonNoConversion: string;
  linkGrabacion: string;
  // Financiero
  productoTipo: string;
  facturado: string;
  cashCollected: string;
  deposito: string;
  contractedRevenue: string;
  setupFee: string;
  recurrenciaMensual: string;
  fechaProximoCobro: string;
  notas: string;
};

export function buildInitialLeadForm(lead: any): LeadForm {
  return {
    nombre: lead.nombre || "",
    correo: lead.correo || "",
    telefono: lead.telefono || "",
    pais: lead.pais || "",
    instagram: lead.instagram || "",
    origen: lead.origen || "ADS",
    tipo: lead.tipo || "DEMO",
    setterAsignado: lead.setterAsignado || "",
    validoParaContacto: lead.validoParaContacto || "SÍ",
    califica: lead.califica || "POR EVALUAR",
    razonNoCalifica: lead.razonNoCalifica || "",
    estadoConfirmacion: lead.estadoConfirmacion || "PENDIENTE",
    triage: lead.triage || "PENDIENTE",
    calificacionFinanciera: lead.calificacionFinanciera || "",
    respuestaFinanciera: lead.respuestaFinanciera || "",
    asistencia: lead.asistencia || "PENDIENTE",
    closer: lead.closer || "",
    ofertaHecha: lead.ofertaHecha || "N/A",
    outcome: lead.outcome || "PENDIENTE",
    razonNoConversion: lead.razonNoConversion || "",
    linkGrabacion: lead.linkGrabacion || "",
    productoTipo: lead.productoTipo || "",
    facturado: lead.facturado || "0",
    cashCollected: lead.cashCollected || "0",
    deposito: lead.deposito || "0",
    contractedRevenue: lead.contractedRevenue || "0",
    setupFee: lead.setupFee || "0",
    recurrenciaMensual: lead.recurrenciaMensual || "0",
    fechaProximoCobro: (() => {
      if (!lead.fechaProximoCobro) return "";
      try {
        const d =
          lead.fechaProximoCobro instanceof Date
            ? lead.fechaProximoCobro
            : new Date(String(lead.fechaProximoCobro));
        return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
      } catch {
        return "";
      }
    })(),
    notas: lead.notas || "",
  };
}

const safeToISOString = (value: any): string | null => {
  if (!value || value === "" || value === "null") return null;
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return null;
    return String(d.toISOString());
  } catch {
    return null;
  }
};

/**
 * Produce the payload that gets sent to the `leads.update` mutation for a
 * partial set of changed fields. Strips read-only / derived fields and
 * normalizes decimals & dates.
 */
export function sanitizeLeadPatch(patch: Partial<LeadForm>): Record<string, any> {
  const data: any = { ...patch };

  // Fields derived from ContactAttemptsTracker — never sent from this form
  delete (data as any).intentosContacto;
  delete (data as any).fechaPrimerContacto;
  delete (data as any).resultadoContacto;
  delete (data as any).tiempoRespuestaHoras;

  if ("fechaProximoCobro" in data) {
    data.fechaProximoCobro = safeToISOString(data.fechaProximoCobro);
  }

  const decimalFields: (keyof LeadForm)[] = [
    "facturado",
    "cashCollected",
    "deposito",
    "contractedRevenue",
    "setupFee",
    "recurrenciaMensual",
  ];
  for (const field of decimalFields) {
    if (field in data) {
      const v = (data as any)[field];
      if (v === "" || v === undefined || v === null) (data as any)[field] = "0";
    }
  }

  if ("productoTipo" in data) {
    // Clear Setup+Monthly fields when switching to PIF or empty
    if (data.productoTipo === "PIF" || !data.productoTipo) {
      data.setupFee = "0";
      data.recurrenciaMensual = "0";
      data.fechaProximoCobro = null;
    }
    if (!data.productoTipo) data.productoTipo = null;
  }

  return data;
}
