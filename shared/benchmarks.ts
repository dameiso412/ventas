/**
 * Sacamedi CRM - Benchmarks LATAM Confirmados
 * Fuente: Documentos de diagnóstico de constraints + confirmación del CEO
 * Mercado: Latinoamérica (clínicas estéticas / med spas)
 */

// Color coding levels (matching document framework)
export type HealthLevel = "excellent" | "good" | "watch" | "borderline" | "probCut" | "cut";

export interface BenchmarkRange {
  metric: string;
  label: string;
  unit: "usd" | "percent" | "ratio";
  /** Higher is better (true for rates), Lower is better (true for costs) */
  higherIsBetter: boolean;
  excellent: [number, number]; // [min, max] — green
  good: [number, number];     // blue
  watch: [number, number];    // light blue
  borderline: [number, number]; // yellow
  probCut: [number, number];  // orange
  cut: number;                // red threshold (above or below depending on direction)
}

// ============================================================
// COST BENCHMARKS (USD) — Lower is better
// ============================================================
export const COST_BENCHMARKS: BenchmarkRange[] = [
  {
    metric: "cpl",
    label: "CPL (Costo por Lead)",
    unit: "usd",
    higherIsBetter: false,
    excellent: [0, 5],
    good: [5, 10],
    watch: [10, 15],
    borderline: [15, 20],
    probCut: [20, 25],
    cut: 25,
  },
  {
    metric: "cpb",
    label: "Costo por Agenda (CPB)",
    unit: "usd",
    higherIsBetter: false,
    excellent: [0, 10],
    good: [10, 15],
    watch: [15, 25],
    borderline: [25, 30],
    probCut: [30, 40],
    cut: 40,
  },
  {
    metric: "cpbc",
    label: "Costo por Intro (CPBC)",
    unit: "usd",
    higherIsBetter: false,
    excellent: [0, 20],
    good: [20, 30],
    watch: [30, 40],
    borderline: [40, 50],
    probCut: [50, 60],
    cut: 60,
  },
  {
    metric: "cps",
    label: "Costo por Show (CPS)",
    unit: "usd",
    higherIsBetter: false,
    excellent: [0, 30],
    good: [30, 40],
    watch: [40, 50],
    borderline: [50, 60],
    probCut: [60, 70],
    cut: 70,
  },
  {
    metric: "cpa",
    label: "CPA (Costo por Adquisición)",
    unit: "usd",
    higherIsBetter: false,
    excellent: [0, 100],
    good: [100, 130],
    watch: [130, 160],
    borderline: [160, 180],
    probCut: [180, 220],
    cut: 220,
  },
];

// ============================================================
// RATE BENCHMARKS (%) — Higher is better
// ============================================================
export const RATE_BENCHMARKS: BenchmarkRange[] = [
  {
    metric: "ctrUnico",
    label: "CTR Único",
    unit: "percent",
    higherIsBetter: true,
    excellent: [2, 100],
    good: [1.5, 2],
    watch: [1.2, 1.5],
    borderline: [1, 1.2],
    probCut: [0.7, 1],
    cut: 0.7,
  },
  {
    metric: "landingOptIn",
    label: "Landing Page Opt-In",
    unit: "percent",
    higherIsBetter: true,
    excellent: [15, 100],
    good: [10, 15],
    watch: [8, 10],
    borderline: [6, 8],
    probCut: [4, 6],
    cut: 4,
  },
  {
    metric: "leadToBooking",
    label: "Lead to Booking Rate",
    unit: "percent",
    higherIsBetter: true,
    excellent: [75, 100],
    good: [65, 75],
    watch: [55, 65],
    borderline: [45, 55],
    probCut: [35, 45],
    cut: 35,
  },
  {
    metric: "answerRate",
    label: "Answer Rate (Setter)",
    unit: "percent",
    higherIsBetter: true,
    excellent: [85, 100],
    good: [75, 85],
    watch: [65, 75],
    borderline: [55, 65],
    probCut: [45, 55],
    cut: 45,
  },
  {
    metric: "triageRate",
    label: "Triage → Demo (Confirmación)",
    unit: "percent",
    higherIsBetter: true,
    excellent: [80, 100],
    good: [70, 80],
    watch: [65, 70],
    borderline: [55, 65],
    probCut: [45, 55],
    cut: 45,
  },
  {
    metric: "showRate",
    label: "Demo Show Rate",
    unit: "percent",
    higherIsBetter: true,
    excellent: [80, 100],
    good: [75, 80],
    watch: [70, 75],
    borderline: [65, 70],
    probCut: [55, 65],
    cut: 55,
  },
  {
    metric: "closeRate",
    label: "Close Rate",
    unit: "percent",
    higherIsBetter: true,
    excellent: [35, 100],
    good: [25, 35],
    watch: [22, 25],
    borderline: [20, 22],
    probCut: [15, 20],
    cut: 15,
  },
  {
    metric: "ufCashPercent",
    label: "UF Cash %",
    unit: "percent",
    higherIsBetter: true,
    excellent: [80, 100],
    good: [60, 80],
    watch: [50, 60],
    borderline: [40, 50],
    probCut: [30, 40],
    cut: 30,
  },
  {
    metric: "roasFrontEnd",
    label: "ROAS Front End",
    unit: "ratio",
    higherIsBetter: true,
    excellent: [4, 100],
    good: [2.5, 4],
    watch: [2, 2.5],
    borderline: [1.5, 2],
    probCut: [1, 1.5],
    cut: 1,
  },
];

// ============================================================
// UTILITY: Evaluate a metric value against its benchmark
// ============================================================
export function evaluateMetric(value: number, benchmark: BenchmarkRange): HealthLevel {
  if (benchmark.higherIsBetter) {
    // Higher is better: excellent is the highest range
    if (value >= benchmark.excellent[0]) return "excellent";
    if (value >= benchmark.good[0]) return "good";
    if (value >= benchmark.watch[0]) return "watch";
    if (value >= benchmark.borderline[0]) return "borderline";
    if (value >= benchmark.probCut[0]) return "probCut";
    return "cut";
  } else {
    // Lower is better: excellent is the lowest range
    if (value <= benchmark.excellent[1]) return "excellent";
    if (value <= benchmark.good[1]) return "good";
    if (value <= benchmark.watch[1]) return "watch";
    if (value <= benchmark.borderline[1]) return "borderline";
    if (value <= benchmark.probCut[1]) return "probCut";
    return "cut";
  }
}

export const HEALTH_COLORS: Record<HealthLevel, { bg: string; text: string; label: string; emoji: string }> = {
  excellent: { bg: "#166534", text: "#4ade80", label: "Excelente", emoji: "🟢" },
  good:      { bg: "#1e3a5f", text: "#60a5fa", label: "Bueno", emoji: "🔵" },
  watch:     { bg: "#1e3a5f", text: "#93c5fd", label: "Vigilar", emoji: "🔷" },
  borderline:{ bg: "#713f12", text: "#fbbf24", label: "Borderline", emoji: "🟡" },
  probCut:   { bg: "#7c2d12", text: "#fb923c", label: "Prob. Cortar", emoji: "🟠" },
  cut:       { bg: "#7f1d1d", text: "#f87171", label: "Cortar", emoji: "🔴" },
};

// ============================================================
// CONSTRAINT CATEGORIES
// ============================================================
export type ConstraintCategory = "marketing" | "sales_setter" | "sales_closer" | "profitability";

export const CONSTRAINT_LABELS: Record<ConstraintCategory, { label: string; description: string }> = {
  marketing: {
    label: "Marketing / Adquisición",
    description: "El cuello de botella está en la generación de leads o calidad de tráfico (CPL alto, CTR bajo, Landing Opt-In bajo, Booking Rate bajo)",
  },
  sales_setter: {
    label: "Ventas - Setter",
    description: "El cuello de botella está en el proceso de contacto y calificación (Answer Rate bajo, Triage Rate bajo, confirmaciones bajas)",
  },
  sales_closer: {
    label: "Ventas - Closer",
    description: "El cuello de botella está en el cierre de ventas (Show Rate bajo, Close Rate bajo, Offer Rate bajo)",
  },
  profitability: {
    label: "Rentabilidad",
    description: "El cuello de botella está en la monetización (ROAS bajo, CPA alto, Cash % bajo, Ticket bajo)",
  },
};

// ============================================================
// DIAGNOSTIC SCENARIOS (from documents)
// ============================================================
export interface ConstraintScenario {
  id: string;
  title: string;
  category: ConstraintCategory;
  layer: 1 | 2 | 3; // Macro, Micro, Granular
  conditions: { metric: string; level: HealthLevel[] }[];
  diagnosis: string;
  actions: {
    today: string[];
    thisWeek: string[];
    thisMonth: string[];
  };
}

export const CONSTRAINT_SCENARIOS: ConstraintScenario[] = [
  // LAYER 1 — MACRO (ROAS, CPA)
  {
    id: "macro_roas_low_cpa_high",
    title: "ROAS bajo + CPA alto",
    category: "profitability",
    layer: 1,
    conditions: [
      { metric: "roasFrontEnd", level: ["borderline", "probCut", "cut"] },
      { metric: "cpa", level: ["borderline", "probCut", "cut"] },
    ],
    diagnosis: "El negocio no es rentable a nivel macro. El costo de adquirir un cliente es demasiado alto en relación al revenue generado. Esto puede ser un problema de oferta, pricing, o un leak acumulado en múltiples etapas del funnel.",
    actions: {
      today: ["Revisar si el pricing actual cubre el CPA", "Auditar las últimas 5 llamadas de cierre"],
      thisWeek: ["Evaluar si la oferta necesita reestructuración", "Analizar qué etapa del funnel tiene el mayor leak"],
      thisMonth: ["Considerar cambio de oferta o pricing", "Implementar upsells para aumentar ticket promedio"],
    },
  },
  // LAYER 2 — MICRO: Marketing
  {
    id: "micro_cpl_high",
    title: "CPL alto — Problema de tráfico",
    category: "marketing",
    layer: 2,
    conditions: [
      { metric: "cpl", level: ["borderline", "probCut", "cut"] },
    ],
    diagnosis: "El costo por lead está por encima del benchmark. Esto indica problemas en los anuncios (creativos, copy, targeting) o fatiga de audiencia.",
    actions: {
      today: ["Revisar frecuencia de anuncios (si >2.5, hay fatiga)", "Verificar CTR de los anuncios activos"],
      thisWeek: ["Crear 2-3 nuevos creativos con diferentes hooks", "Probar nueva audiencia o segmentación"],
      thisMonth: ["Rotar completamente los creativos", "Evaluar si el mensaje de la landing coincide con el anuncio"],
    },
  },
  {
    id: "micro_landing_optin_low",
    title: "Landing Page Opt-In bajo",
    category: "marketing",
    layer: 2,
    conditions: [
      { metric: "landingOptIn", level: ["borderline", "probCut", "cut"] },
    ],
    diagnosis: "La landing page no está convirtiendo visitantes en leads. Puede ser un problema de congruencia entre el anuncio y la landing, velocidad de carga, o propuesta de valor poco clara.",
    actions: {
      today: ["Verificar que el headline de la landing coincida con el anuncio", "Revisar velocidad de carga"],
      thisWeek: ["A/B test del headline principal", "Simplificar el formulario (menos campos)"],
      thisMonth: ["Rediseñar la landing con nueva propuesta de valor", "Agregar prueba social y testimonios"],
    },
  },
  {
    id: "micro_booking_rate_low",
    title: "Booking Rate bajo — Leads no agendan",
    category: "marketing",
    layer: 2,
    conditions: [
      { metric: "leadToBooking", level: ["borderline", "probCut", "cut"] },
    ],
    diagnosis: "Los leads llegan pero no agendan. Puede ser un problema de calidad de lead, proceso de agendamiento complicado, o falta de seguimiento automatizado.",
    actions: {
      today: ["Revisar el flujo de agendamiento (¿cuántos pasos tiene?)", "Verificar que los SMS/emails de confirmación estén activos"],
      thisWeek: ["Simplificar el proceso de booking", "Implementar o mejorar la secuencia de nurturing post-opt-in"],
      thisMonth: ["Evaluar si el setter debe hacer booking manual para leads que no auto-agendan", "Considerar cambiar la oferta del anuncio para atraer leads más calificados"],
    },
  },
  // LAYER 2 — MICRO: Setter
  {
    id: "micro_answer_rate_low",
    title: "Answer Rate bajo — Setter no conecta",
    category: "sales_setter",
    layer: 2,
    conditions: [
      { metric: "answerRate", level: ["borderline", "probCut", "cut"] },
    ],
    diagnosis: "El setter no está logrando contactar a los leads. Puede ser un problema de velocidad de respuesta (speed-to-lead), horarios de contacto, o calidad del número telefónico.",
    actions: {
      today: ["Verificar tiempo promedio de respuesta (debe ser <5 min)", "Revisar si se está llamando en horarios óptimos"],
      thisWeek: ["Implementar protocolo de 5 intentos en 48h", "Agregar contacto por WhatsApp además de llamada"],
      thisMonth: ["Automatizar primer contacto inmediato post-agenda", "Evaluar si necesitas más setters para cubrir volumen"],
    },
  },
  {
    id: "micro_triage_rate_low",
    title: "Triage Rate bajo — Intros no confirman demo",
    category: "sales_setter",
    layer: 2,
    conditions: [
      { metric: "triageRate", level: ["borderline", "probCut", "cut"] },
    ],
    diagnosis: "Los leads contactados no están confirmando la demo. Puede ser un problema de calificación (leads fríos), pitch del setter, o falta de urgencia en la conversación.",
    actions: {
      today: ["Auditar las últimas 3 llamadas de intro del setter", "Verificar si el setter está usando el script correctamente"],
      thisWeek: ["Roleplay con el setter para mejorar el pitch", "Revisar si los leads que no confirman son mayormente FRÍOS"],
      thisMonth: ["Reevaluar criterios de calificación", "Implementar seguimiento post-intro para leads tibios"],
    },
  },
  // LAYER 2 — MICRO: Closer
  {
    id: "micro_show_rate_low",
    title: "Show Rate bajo — Demos no asisten",
    category: "sales_closer",
    layer: 2,
    conditions: [
      { metric: "showRate", level: ["borderline", "probCut", "cut"] },
    ],
    diagnosis: "Los leads confirmados no están asistiendo a la demo. Problema de confirmación, recordatorios, o el lead perdió interés entre la confirmación y la demo.",
    actions: {
      today: ["Verificar que los recordatorios automáticos estén funcionando (24h, 1h antes)", "Llamar personalmente a los que tienen demo hoy"],
      thisWeek: ["Implementar confirmación por WhatsApp 24h antes", "Reducir el tiempo entre confirmación y demo"],
      thisMonth: ["Crear secuencia de nurturing pre-demo con contenido de valor", "Evaluar si el tiempo de espera promedio es demasiado largo"],
    },
  },
  {
    id: "micro_close_rate_low",
    title: "Close Rate bajo — No se cierran ventas",
    category: "sales_closer",
    layer: 2,
    conditions: [
      { metric: "closeRate", level: ["borderline", "probCut", "cut"] },
    ],
    diagnosis: "El closer no está convirtiendo demos en ventas. Puede ser un problema de habilidad de cierre, objeciones no manejadas, pricing, o calidad de leads que llegan a demo.",
    actions: {
      today: ["Auditar la última demo grabada del closer", "Revisar las objeciones más comunes de la última semana"],
      thisWeek: ["Roleplay intensivo con el closer", "Crear banco de respuestas a objeciones frecuentes"],
      thisMonth: ["Evaluar si el pricing necesita ajuste", "Considerar ofrecer opciones de pago más flexibles", "Revisar si los leads que llegan a demo están realmente calificados"],
    },
  },
  // LAYER 2 — MICRO: Profitability
  {
    id: "micro_cash_percent_low",
    title: "Cash % bajo — Poco efectivo upfront",
    category: "profitability",
    layer: 2,
    conditions: [
      { metric: "ufCashPercent", level: ["borderline", "probCut", "cut"] },
    ],
    diagnosis: "Se está cerrando pero con poco cash upfront. Demasiados planes de pago o depósitos bajos. Esto afecta el flujo de caja y la capacidad de reinvertir en ads.",
    actions: {
      today: ["Revisar los últimos 5 cierres: ¿cuántos fueron PIF vs planes?", "Verificar si el closer está ofreciendo PIF primero"],
      thisWeek: ["Implementar incentivo para PIF (descuento o bonus)", "Entrenar al closer en pitch de PIF"],
      thisMonth: ["Reestructurar opciones de pago para favorecer PIF", "Evaluar si el pricing permite ofrecer descuento PIF atractivo"],
    },
  },
];
