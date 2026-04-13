import { integer, bigint, text, timestamp, varchar, decimal, json, jsonb, uniqueIndex, pgTable, pgEnum, serial, boolean, uuid } from "drizzle-orm/pg-core";

// ==================== Enums ====================

export const roleEnum = pgEnum("role", ["user", "admin", "setter", "closer"]);
export const tipoEnum = pgEnum("tipo", ["DEMO", "INTRO"]);
export const categoriaEnum = pgEnum("categoria", ["AGENDA", "LEAD"]);
export const origenEnum = pgEnum("origen", ["ADS", "REFERIDO", "ORGANICO", "INSTAGRAM"]);
export const igFunnelStageEnum = pgEnum("ig_funnel_stage", ["NUEVO_SEGUIDOR", "DM_ENVIADO", "EN_CONVERSACION", "CALIFICADO", "AGENDA_ENVIADA", "AGENDA_RESERVADA", "DESCARTADO"]);
export const estadoLeadEnum = pgEnum("estado_lead", ["NUEVO", "CONTACTADO", "CALIFICADO", "DESCARTADO", "CONVERTIDO_AGENDA"]);
export const resultadoContactoEnum = pgEnum("resultado_contacto", ["CONTESTÓ", "NO CONTESTÓ", "BUZÓN", "NÚMERO INVÁLIDO", "WHATSAPP LIMPIADO", "PENDIENTE"]);
export const siNoEnum = pgEnum("si_no", ["SÍ", "NO"]);
export const calificaEnum = pgEnum("califica", ["SÍ", "NO", "POR EVALUAR"]);
export const estadoConfirmacionEnum = pgEnum("estado_confirmacion", ["CONFIRMADA", "NO CONFIRMADA", "CANCELADA", "REAGENDADA", "PENDIENTE"]);
export const asistenciaEnum = pgEnum("asistencia", ["ASISTIÓ", "NO SHOW", "PENDIENTE"]);
export const ofertaHechaEnum = pgEnum("oferta_hecha", ["SÍ", "NO", "N/A"]);
export const outcomeEnum = pgEnum("outcome", ["VENTA", "PERDIDA", "SEGUIMIENTO", "PENDIENTE"]);
export const productoTipoEnum = pgEnum("producto_tipo", ["PIF", "SETUP_MONTHLY"]);
export const calificacionFinancieraEnum = pgEnum("calificacion_financiera", ["SÍ", "NO", "PARCIAL", "PENDIENTE"]);
export const scoreLabelEnum = pgEnum("score_label", ["HOT", "WARM", "TIBIO", "FRÍO"]);
export const manualReviewEnum = pgEnum("manual_review", ["PENDIENTE", "REVISADA", "ACCIONADA"]);
export const followUpTipoEnum = pgEnum("follow_up_tipo", ["HOT", "WARM"]);
export const prioridadEnum = pgEnum("prioridad", ["RED_HOT", "HOT", "WARM", "COLD"]);
export const followUpEstadoEnum = pgEnum("follow_up_estado", ["ACTIVO", "CERRADO_GANADO", "CERRADO_PERDIDO", "MOVIDO_A_WARM", "ARCHIVADO"]);
export const productoInteresEnum = pgEnum("producto_interes", ["PIF", "SETUP_MONTHLY", "POR_DEFINIR"]);
export const followUpAccionEnum = pgEnum("follow_up_accion", ["LLAMADA", "WHATSAPP", "EMAIL", "DM_INSTAGRAM", "DM_FACEBOOK", "NOTA", "CAMBIO_TIPO", "CAMBIO_ESTADO", "REAGENDADO"]);
export const webhookStatusEnum = pgEnum("webhook_status", ["RECEIVED", "PROCESSED", "DUPLICATE", "UPDATED", "ERROR"]);
export const canalEnum = pgEnum("canal", ["LLAMADA", "WHATSAPP", "SMS", "EMAIL", "DM_INSTAGRAM", "OTRO"]);
export const contactResultadoEnum = pgEnum("contact_resultado", ["CONTESTÓ", "NO CONTESTÓ", "BUZÓN", "NÚMERO INVÁLIDO", "MENSAJE ENVIADO", "WHATSAPP LIMPIADO"]);
export const notificationTypeEnum = pgEnum("notification_type", ["mention", "comment", "system"]);

// ==================== Clinica Enums ====================
export const patientStatusEnum = pgEnum("patient_status", ["pending", "incomplete", "completed"]);
export const upsellDecisionEnum = pgEnum("upsell_decision", ["pending", "completed", "declined", "postponed"]);
export const clinicRoleEnum = pgEnum("clinic_role", ["admin", "member"]);
export const syncStatusEnum = pgEnum("sync_status", ["success", "error", "running"]);
export const teamMemberRolEnum = pgEnum("team_member_rol", ["SETTER", "CLOSER", "SETTER_CLOSER"]);
export const allowedEmailRoleEnum = pgEnum("allowed_email_role", ["admin", "setter", "closer"]);
export const scenarioModeEnum = pgEnum("scenario_mode", ["reverse", "forward"]);
export const creadoDesdeEnum = pgEnum("creado_desde", ["MANUAL", "CITAS", "SCORING"]);

// ==================== Tables ====================

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  authId: varchar("authId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Leads table - Central registry of all appointments/demos
 */
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  // Datos de entrada
  fecha: timestamp("fecha"),
  mes: varchar("mes", { length: 20 }),
  semana: integer("semana"),
  tipo: tipoEnum("tipo").default("DEMO").notNull(),
  categoria: categoriaEnum("categoria").default("AGENDA").notNull(),
  origen: origenEnum("origen").default("ADS").notNull(),
  nombre: varchar("nombre", { length: 255 }),
  correo: varchar("correo", { length: 320 }),
  telefono: varchar("telefono", { length: 50 }),
  pais: varchar("pais", { length: 50 }),
  instagram: varchar("instagram", { length: 255 }),
  rubro: varchar("rubro", { length: 255 }),
  // ManyChat / Instagram funnel
  manychatSubscriberId: varchar("manychatSubscriberId", { length: 100 }),
  igFunnelStage: igFunnelStageEnum("igFunnelStage"),
  patientId: varchar("patientId", { length: 100 }), // Links to clinic_patients.id
  // Estado del lead (para leads sin agendar)
  estadoLead: estadoLeadEnum("estadoLead").default("NUEVO"),
  // Proceso de contacto
  setterAsignado: varchar("setterAsignado", { length: 100 }),
  fechaPrimerContacto: timestamp("fechaPrimerContacto"),
  tiempoRespuestaHoras: decimal("tiempoRespuestaHoras", { precision: 10, scale: 2 }),
  intentosContacto: integer("intentosContacto").default(0),
  resultadoContacto: resultadoContactoEnum("resultadoContacto").default("PENDIENTE"),
  // Calificación
  validoParaContacto: siNoEnum("validoParaContacto").default("SÍ"),
  califica: calificaEnum("califica").default("POR EVALUAR"),
  razonNoCalifica: varchar("razonNoCalifica", { length: 255 }),
  estadoConfirmacion: estadoConfirmacionEnum("estadoConfirmacion").default("PENDIENTE"),
  triage: varchar("triage", { length: 255 }),
  // Demo y resultado
  asistencia: asistenciaEnum("asistencia").default("PENDIENTE"),
  closer: varchar("closer", { length: 100 }),
  ofertaHecha: ofertaHechaEnum("ofertaHecha").default("N/A"),
  outcome: outcomeEnum("outcome").default("PENDIENTE"),
  razonNoConversion: varchar("razonNoConversion", { length: 500 }),
  // Tipo de producto
  productoTipo: productoTipoEnum("productoTipo"),
  // Financiero
  facturado: decimal("facturado", { precision: 10, scale: 2 }).default("0"),
  cashCollected: decimal("cashCollected", { precision: 10, scale: 2 }).default("0"),
  deposito: decimal("deposito", { precision: 10, scale: 2 }).default("0"),
  contractedRevenue: decimal("contractedRevenue", { precision: 10, scale: 2 }).default("0"),
  // Setup + Monthly fields
  setupFee: decimal("setupFee", { precision: 10, scale: 2 }).default("0"),
  recurrenciaMensual: decimal("recurrenciaMensual", { precision: 10, scale: 2 }).default("0"),
  fechaProximoCobro: timestamp("fechaProximoCobro"),
  // Links y notas
  notas: text("notas"),
  linkCRM: varchar("linkCRM", { length: 500 }),
  linkGrabacion: varchar("linkGrabacion", { length: 500 }),
  // Calificación financiera
  calificacionFinanciera: calificacionFinancieraEnum("calificacionFinanciera").default("PENDIENTE"),
  respuestaFinanciera: text("respuestaFinanciera"),
  // Intro tracking
  fechaIntro: timestamp("fechaIntro"),
  // UTM Attribution
  utmSource: varchar("utmSource", { length: 100 }),
  utmMedium: varchar("utmMedium", { length: 100 }),
  utmCampaign: varchar("utmCampaign", { length: 255 }),
  utmContent: varchar("utmContent", { length: 255 }),
  utmTerm: varchar("utmTerm", { length: 255 }),
  // Scoring
  score: integer("score"),
  scoreLabel: scoreLabelEnum("scoreLabel"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Lead Scoring - Formulary responses and scoring details
 */
export const leadScoring = pgTable("lead_scoring", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId"),
  correo: varchar("correo", { length: 320 }),
  instagram: varchar("instagram", { length: 255 }),
  // Respuestas del formulario
  p1Frustracion: text("p1Frustracion"),
  p2MarketingPrevio: text("p2MarketingPrevio"),
  p3Urgencia: text("p3Urgencia"),
  p4TiempoOperando: text("p4TiempoOperando"),
  p5Tratamientos: text("p5Tratamientos"),
  p6Impedimento: text("p6Impedimento"),
  // Scores individuales
  scoreP1: integer("scoreP1"),
  scoreP2: integer("scoreP2"),
  scoreP3: integer("scoreP3"),
  scoreP4: integer("scoreP4"),
  scoreP6: integer("scoreP6"),
  scoreTotal: integer("scoreTotal"),
  // Score final (1-4)
  scoreFinal: integer("scoreFinal"),
  scoreLabel: scoreLabelEnum("scoreLabel"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadScoring = typeof leadScoring.$inferSelect;
export type InsertLeadScoring = typeof leadScoring.$inferInsert;

/**
 * Setter Activities - Daily tracking of setter performance
 */
export const setterActivities = pgTable("setter_activities", {
  id: serial("id").primaryKey(),
  fecha: timestamp("fecha").notNull(),
  mes: varchar("mes", { length: 20 }),
  semana: integer("semana"),
  setter: varchar("setter", { length: 100 }).notNull(),
  // Proceso de intro
  intentosLlamada: integer("intentosLlamada").default(0),
  introsEfectivas: integer("introsEfectivas").default(0),
  demosAseguradasConIntro: integer("demosAseguradasConIntro").default(0),
  // Demos del día
  demosEnCalendario: integer("demosEnCalendario").default(0),
  demosConfirmadas: integer("demosConfirmadas").default(0),
  demosAsistidas: integer("demosAsistidas").default(0),
  // Reuniones introductorias
  introAgendadas: integer("introAgendadas").default(0),
  introLive: integer("introLive").default(0),
  introADemo: integer("introADemo").default(0),
  // Resultados atribuidos
  cierresAtribuidos: integer("cierresAtribuidos").default(0),
  revenueAtribuido: decimal("revenueAtribuido", { precision: 10, scale: 2 }).default("0"),
  cashAtribuido: decimal("cashAtribuido", { precision: 10, scale: 2 }).default("0"),
  // Instagram DM metrics
  igConversacionesIniciadas: integer("igConversacionesIniciadas").default(0),
  igRespuestasRecibidas: integer("igRespuestasRecibidas").default(0),
  igCalificados: integer("igCalificados").default(0),
  igAgendasEnviadas: integer("igAgendasEnviadas").default(0),
  igAgendasReservadas: integer("igAgendasReservadas").default(0),
  // Notas
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SetterActivity = typeof setterActivities.$inferSelect;
export type InsertSetterActivity = typeof setterActivities.$inferInsert;

/**
 * Closer Activities - Daily tracking of closer performance
 */
export const closerActivities = pgTable("closer_activities", {
  id: serial("id").primaryKey(),
  fecha: timestamp("fecha").notNull(),
  mes: varchar("mes", { length: 20 }),
  semana: integer("semana"),
  closer: varchar("closer", { length: 100 }).notNull(),
  // Actividad
  scheduleCalls: integer("scheduleCalls").default(0),
  liveCalls: integer("liveCalls").default(0),
  offers: integer("offers").default(0),
  deposits: integer("deposits").default(0),
  closes: integer("closes").default(0),
  // Revenue por producto
  piffRevenue: decimal("piffRevenue", { precision: 10, scale: 2 }).default("0"),
  piffCash: decimal("piffCash", { precision: 10, scale: 2 }).default("0"),
  setupRevenue: decimal("setupRevenue", { precision: 10, scale: 2 }).default("0"),
  setupCash: decimal("setupCash", { precision: 10, scale: 2 }).default("0"),
  // Notas
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CloserActivity = typeof closerActivities.$inferSelect;
export type InsertCloserActivity = typeof closerActivities.$inferInsert;

/**
 * Monthly Metrics - Aggregated monthly KPIs
 */
export const monthlyMetrics = pgTable("monthly_metrics", {
  id: serial("id").primaryKey(),
  mes: varchar("mes", { length: 20 }).notNull(),
  anio: integer("anio").notNull(),
  adSpend: decimal("adSpend", { precision: 10, scale: 2 }).default("0"),
  totalLeadsRaw: integer("totalLeadsRaw").default(0),
  totalLeads: integer("totalLeads").default(0),
  visitasLandingPage: integer("visitasLandingPage").default(0),
  ctrUnico: decimal("ctrUnico", { precision: 5, scale: 2 }).default("0"),
  ctr: decimal("ctr", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  mesAnioIdx: uniqueIndex("idx_mes_anio").on(table.mes, table.anio),
}));

export type MonthlyMetric = typeof monthlyMetrics.$inferSelect;
export type InsertMonthlyMetric = typeof monthlyMetrics.$inferInsert;

/**
 * API Keys - Authentication for external API access
 */
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  keyHash: varchar("keyHash", { length: 128 }).notNull().unique(),
  keyPrefix: varchar("keyPrefix", { length: 30 }).notNull(),
  isActive: integer("isActive").default(1).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * Closer Projections - Weekly sales projections for closers
 */
export const closerProjections = pgTable("closer_projections", {
  id: serial("id").primaryKey(),
  closer: varchar("closer", { length: 100 }).notNull(),
  semana: integer("semana").notNull(),
  mes: varchar("mes", { length: 20 }).notNull(),
  anio: integer("anio").notNull(),
  weekStarting: timestamp("weekStarting"),
  weekEnding: timestamp("weekEnding"),
  // Targets
  scheduledCallsTarget: integer("scheduledCallsTarget").default(0),
  showRateTarget: decimal("showRateTarget", { precision: 5, scale: 2 }).default("0"),
  offerRateTarget: decimal("offerRateTarget", { precision: 5, scale: 2 }).default("0"),
  closeRateTarget: decimal("closeRateTarget", { precision: 5, scale: 2 }).default("0"),
  // Calculated projections
  projectedLiveCalls: integer("projectedLiveCalls").default(0),
  projectedOffers: integer("projectedOffers").default(0),
  projectedCloses: integer("projectedCloses").default(0),
  // Blood Goal
  bloodGoalCloses: integer("bloodGoalCloses").default(0),
  bloodGoalRevenue: decimal("bloodGoalRevenue", { precision: 10, scale: 2 }).default("0"),
  bloodGoalCash: decimal("bloodGoalCash", { precision: 10, scale: 2 }).default("0"),
  // Stretch Goal
  stretchGoalCloses: integer("stretchGoalCloses").default(0),
  stretchGoalRevenue: decimal("stretchGoalRevenue", { precision: 10, scale: 2 }).default("0"),
  stretchGoalCash: decimal("stretchGoalCash", { precision: 10, scale: 2 }).default("0"),
  // Results
  bloodHit: integer("bloodHit"),
  stretchHit: integer("stretchHit"),
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CloserProjection = typeof closerProjections.$inferSelect;
export type InsertCloserProjection = typeof closerProjections.$inferInsert;

/**
 * Closer Projection Daily Tracking
 */
export const closerProjectionDaily = pgTable("closer_projection_daily", {
  id: serial("id").primaryKey(),
  projectionId: integer("projectionId").notNull(),
  dayOfWeek: varchar("dayOfWeek", { length: 20 }).notNull(),
  fecha: timestamp("fecha").notNull(),
  scheduleCalls: integer("scheduleCalls").default(0),
  liveCalls: integer("liveCalls").default(0),
  offers: integer("offers").default(0),
  deposits: integer("deposits").default(0),
  closes: integer("closes").default(0),
  piffRevenue: decimal("piffRevenue", { precision: 10, scale: 2 }).default("0"),
  piffCash: decimal("piffCash", { precision: 10, scale: 2 }).default("0"),
  setupRevenue: decimal("setupRevenue", { precision: 10, scale: 2 }).default("0"),
  setupCash: decimal("setupCash", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CloserProjectionDaily = typeof closerProjectionDaily.$inferSelect;
export type InsertCloserProjectionDaily = typeof closerProjectionDaily.$inferInsert;

/**
 * Setter Projections - Weekly activity projections for setters
 */
export const setterProjections = pgTable("setter_projections", {
  id: serial("id").primaryKey(),
  setter: varchar("setter", { length: 100 }).notNull(),
  semana: integer("semana").notNull(),
  mes: varchar("mes", { length: 20 }).notNull(),
  anio: integer("anio").notNull(),
  weekStarting: timestamp("weekStarting"),
  weekEnding: timestamp("weekEnding"),
  // Daily targets
  intentosLlamadaTarget: integer("intentosLlamadaTarget").default(0),
  introsEfectivasTarget: integer("introsEfectivasTarget").default(0),
  demosAseguradasTarget: integer("demosAseguradasTarget").default(0),
  demosCalendarioTarget: integer("demosCalendarioTarget").default(0),
  demosConfirmadasTarget: integer("demosConfirmadasTarget").default(0),
  demosAsistidasTarget: integer("demosAsistidasTarget").default(0),
  // Blood Goal
  bloodGoalDemosAsistidas: integer("bloodGoalDemosAsistidas").default(0),
  bloodGoalCierres: integer("bloodGoalCierres").default(0),
  bloodGoalRevenue: decimal("bloodGoalRevenue", { precision: 10, scale: 2 }).default("0"),
  bloodGoalCash: decimal("bloodGoalCash", { precision: 10, scale: 2 }).default("0"),
  // Stretch Goal
  stretchGoalDemosAsistidas: integer("stretchGoalDemosAsistidas").default(0),
  stretchGoalCierres: integer("stretchGoalCierres").default(0),
  stretchGoalRevenue: decimal("stretchGoalRevenue", { precision: 10, scale: 2 }).default("0"),
  stretchGoalCash: decimal("stretchGoalCash", { precision: 10, scale: 2 }).default("0"),
  // Results
  bloodHit: integer("bloodHit"),
  stretchHit: integer("stretchHit"),
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SetterProjection = typeof setterProjections.$inferSelect;
export type InsertSetterProjection = typeof setterProjections.$inferInsert;

/**
 * Setter Projection Daily Tracking
 */
export const setterProjectionDaily = pgTable("setter_projection_daily", {
  id: serial("id").primaryKey(),
  projectionId: integer("projectionId").notNull(),
  dayOfWeek: varchar("dayOfWeek", { length: 20 }).notNull(),
  fecha: timestamp("fecha").notNull(),
  intentosLlamada: integer("intentosLlamada").default(0),
  introsEfectivas: integer("introsEfectivas").default(0),
  demosAseguradasConIntro: integer("demosAseguradasConIntro").default(0),
  demosEnCalendario: integer("demosEnCalendario").default(0),
  demosConfirmadas: integer("demosConfirmadas").default(0),
  demosAsistidas: integer("demosAsistidas").default(0),
  cierresAtribuidos: integer("cierresAtribuidos").default(0),
  revenueAtribuido: decimal("revenueAtribuido", { precision: 10, scale: 2 }).default("0"),
  cashAtribuido: decimal("cashAtribuido", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SetterProjectionDaily = typeof setterProjectionDaily.$inferSelect;
export type InsertSetterProjectionDaily = typeof setterProjectionDaily.$inferInsert;

/**
 * Call Audits - Sales call audit records from GPT automation pipeline
 */
export const callAudits = pgTable("call_audits", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId"),
  closer: varchar("closer", { length: 100 }),
  fechaLlamada: timestamp("fechaLlamada"),
  linkGrabacion: text("linkGrabacion"),
  recordingTranscript: text("recordingTranscript"),
  leadName: varchar("leadName", { length: 200 }),
  leadEmail: varchar("leadEmail", { length: 320 }),
  duracionMinutos: integer("duracionMinutos"),
  // AI Analysis
  aiFeedback: text("aiFeedback"),
  aiGrading: integer("aiGrading"),
  aiGradingJustification: text("aiGradingJustification"),
  aiWhyNotClosed: text("aiWhyNotClosed"),
  aiKeyMoments: text("aiKeyMoments"),
  // Team Review
  manualReview: manualReviewEnum("manualReview").default("PENDIENTE").notNull(),
  manualNotes: text("manualNotes"),
  actionItems: json("actionItems"),
  reviewedBy: varchar("reviewedBy", { length: 100 }),
  reviewedAt: timestamp("reviewedAt"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CallAudit = typeof callAudits.$inferSelect;
export type InsertCallAudit = typeof callAudits.$inferInsert;

/**
 * Follow-Ups - Hot/Warm list management
 */
export const followUps = pgTable("follow_ups", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId"),
  nombre: varchar("nombre", { length: 255 }),
  correo: varchar("correo", { length: 320 }),
  telefono: varchar("telefono", { length: 50 }),
  instagram: varchar("instagram", { length: 255 }),
  facebook: varchar("facebook", { length: 255 }),
  // E-ID Classification
  tipo: followUpTipoEnum("tipo").default("HOT").notNull(),
  prioridad: prioridadEnum("prioridad").default("HOT").notNull(),
  estado: followUpEstadoEnum("estado").default("ACTIVO").notNull(),
  // Follow-up context
  ultimaObjecion: text("ultimaObjecion"),
  montoEstimado: decimal("montoEstimado", { precision: 10, scale: 2 }).default("0"),
  productoInteres: productoInteresEnum("productoInteres").default("POR_DEFINIR"),
  // Cadence tracking
  ultimoFollowUp: timestamp("ultimoFollowUp"),
  proximoFollowUp: timestamp("proximoFollowUp"),
  totalFollowUps: integer("totalFollowUps").default(0),
  // Assignment
  closerAsignado: varchar("closerAsignado", { length: 100 }),
  notas: text("notas"),
  linkCRM: varchar("linkCRM", { length: 500 }),
  // Source
  creadoDesde: creadoDesdeEnum("creadoDesde").default("MANUAL").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = typeof followUps.$inferInsert;

/**
 * Follow-Up Activity Log
 */
export const followUpLogs = pgTable("follow_up_logs", {
  id: serial("id").primaryKey(),
  followUpId: integer("followUpId").notNull(),
  accion: followUpAccionEnum("accion").notNull(),
  detalle: text("detalle"),
  realizadoPor: varchar("realizadoPor", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FollowUpLog = typeof followUpLogs.$inferSelect;
export type InsertFollowUpLog = typeof followUpLogs.$inferInsert;

/**
 * Webhook Logs - Persistent logging of all incoming webhook events
 */
export const webhookLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  endpoint: varchar("endpoint", { length: 100 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  status: webhookStatusEnum("status").default("RECEIVED").notNull(),
  leadId: integer("leadId"),
  nombre: varchar("nombre", { length: 255 }),
  correo: varchar("correo", { length: 320 }),
  telefono: varchar("telefono", { length: 50 }),
  rawPayload: text("rawPayload"),
  processingNotes: text("processingNotes"),
  errorMessage: text("errorMessage"),
  processingTimeMs: integer("processingTimeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = typeof webhookLogs.$inferInsert;

/**
 * Contact Attempts - Detailed log of each contact attempt per lead
 */
export const contactAttempts = pgTable("contact_attempts", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  canal: canalEnum("canal").default("LLAMADA").notNull(),
  resultado: contactResultadoEnum("resultado").default("NO CONTESTÓ"),
  notas: text("notas"),
  realizadoPor: varchar("realizadoPor", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContactAttempt = typeof contactAttempts.$inferSelect;
export type InsertContactAttempt = typeof contactAttempts.$inferInsert;

/**
 * Lead Comments - Team communication threads per lead
 */
export const leadComments = pgTable("lead_comments", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").notNull(),
  userId: integer("userId"),
  autor: varchar("autor", { length: 100 }).notNull(),
  autorRole: varchar("autorRole", { length: 20 }),
  texto: text("texto").notNull(),
  mentions: text("mentions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type LeadComment = typeof leadComments.$inferSelect;
export type InsertLeadComment = typeof leadComments.$inferInsert;

/**
 * Notifications - In-app notifications for mentions and team activity
 */
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: notificationTypeEnum("type").default("mention").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  leadId: integer("leadId"),
  commentId: integer("commentId"),
  fromUserId: integer("fromUserId"),
  fromUserName: varchar("fromUserName", { length: 100 }),
  isRead: integer("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Ad Campaigns - Meta Ads campaign metadata cache
 */
export const adCampaigns = pgTable("ad_campaigns", {
  id: serial("id").primaryKey(),
  campaignId: varchar("campaignId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 500 }),
  status: varchar("status", { length: 50 }),
  objective: varchar("objective", { length: 100 }),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AdCampaign = typeof adCampaigns.$inferSelect;
export type InsertAdCampaign = typeof adCampaigns.$inferInsert;

/**
 * Ad Adsets - Meta Ads adset metadata cache
 */
export const adAdsets = pgTable("ad_adsets", {
  id: serial("id").primaryKey(),
  adsetId: varchar("adsetId", { length: 64 }).notNull().unique(),
  campaignId: varchar("campaignId", { length: 64 }).notNull(),
  name: varchar("name", { length: 500 }),
  status: varchar("status", { length: 50 }),
  targetingDescription: text("targetingDescription"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AdAdset = typeof adAdsets.$inferSelect;
export type InsertAdAdset = typeof adAdsets.$inferInsert;

/**
 * Ad Ads - Meta Ads individual ad metadata cache
 */
export const adAds = pgTable("ad_ads", {
  id: serial("id").primaryKey(),
  adId: varchar("adId", { length: 64 }).notNull().unique(),
  adsetId: varchar("adsetId", { length: 64 }),
  campaignId: varchar("campaignId", { length: 64 }),
  name: varchar("name", { length: 500 }),
  status: varchar("status", { length: 50 }),
  creativePreviewUrl: text("creativePreviewUrl"),
  urlTags: text("urlTags"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AdAd = typeof adAds.$inferSelect;
export type InsertAdAd = typeof adAds.$inferInsert;

/**
 * Ad Metrics Daily - Daily performance metrics from Meta Ads API
 */
export const adMetricsDaily = pgTable("ad_metrics_daily", {
  id: serial("id").primaryKey(),
  fecha: timestamp("fecha").notNull(),
  campaignId: varchar("campaignId", { length: 64 }).notNull(),
  campaignName: varchar("campaignName", { length: 500 }),
  adsetId: varchar("adsetId", { length: 64 }),
  adsetName: varchar("adsetName", { length: 500 }),
  adId: varchar("adId", { length: 64 }),
  adName: varchar("adName", { length: 500 }),
  // Performance metrics
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  spend: decimal("spend", { precision: 10, scale: 2 }).default("0"),
  reach: integer("reach").default(0),
  leads: integer("leads").default(0),
  linkClicks: integer("linkClicks").default(0),
  // Calculated
  ctr: decimal("ctr", { precision: 8, scale: 4 }).default("0"),
  cpc: decimal("cpc", { precision: 10, scale: 2 }).default("0"),
  cpl: decimal("cpl", { precision: 10, scale: 2 }).default("0"),
  costPerResult: decimal("costPerResult", { precision: 10, scale: 2 }).default("0"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  fechaCampaignIdx: uniqueIndex("idx_fecha_campaign_adset_ad").on(table.fecha, table.campaignId, table.adsetId, table.adId),
}));

export type AdMetricDaily = typeof adMetricsDaily.$inferSelect;
export type InsertAdMetricDaily = typeof adMetricsDaily.$inferInsert;

/**
 * Sync log - Tracks automatic and manual sync operations
 */
export const syncLog = pgTable("sync_log", {
  id: serial("id").primaryKey(),
  syncType: varchar("syncType", { length: 50 }).notNull(),
  status: syncStatusEnum("status").default("running").notNull(),
  details: text("details"),
  campaignsSynced: integer("campaignsSynced").default(0),
  adsetsSynced: integer("adsetsSynced").default(0),
  adsSynced: integer("adsSynced").default(0),
  insightsSynced: integer("insightsSynced").default(0),
  dateFrom: varchar("dateFrom", { length: 10 }),
  dateTo: varchar("dateTo", { length: 10 }),
  durationMs: integer("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SyncLog = typeof syncLog.$inferSelect;
export type InsertSyncLog = typeof syncLog.$inferInsert;

/**
 * Team Members - Defined profiles for setters and closers
 */
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  rol: teamMemberRolEnum("rol").notNull(),
  activo: integer("activo").default(1).notNull(),
  correo: varchar("correo", { length: 320 }),
  telefono: varchar("telefono", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

/**
 * Allowed Emails - Whitelist of emails authorized to access the CRM
 */
export const allowedEmails = pgTable("allowed_emails", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  role: allowedEmailRoleEnum("role").default("setter").notNull(),
  nombre: varchar("nombre", { length: 255 }),
  activo: integer("activo").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AllowedEmail = typeof allowedEmails.$inferSelect;
export type InsertAllowedEmail = typeof allowedEmails.$inferInsert;

/**
 * Revenue Calculator - Scenarios
 */
export const revenueScenarios = pgTable("revenue_scenarios", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  name: varchar("name", { length: 200 }).notNull(),
  mode: scenarioModeEnum("mode").default("reverse").notNull(),
  // Primary Inputs
  revenueGoal: decimal("revenueGoal", { precision: 12, scale: 2 }),
  adSpendInput: decimal("adSpendInput", { precision: 12, scale: 2 }),
  // Funnel Rates
  ticketPromedio: decimal("ticketPromedio", { precision: 10, scale: 2 }).notNull(),
  upfrontCashPct: decimal("upfrontCashPct", { precision: 5, scale: 2 }).default("60.00").notNull(),
  closeRate: decimal("closeRate", { precision: 5, scale: 2 }).notNull(),
  showRate: decimal("showRate", { precision: 5, scale: 2 }).notNull(),
  confirmationRate: decimal("confirmationRate", { precision: 5, scale: 2 }).default("85.00").notNull(),
  answerRate: decimal("answerRate", { precision: 5, scale: 2 }).default("85.00").notNull(),
  bookingRate: decimal("bookingRate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  landingConvRate: decimal("landingConvRate", { precision: 5, scale: 2 }).default("30.00").notNull(),
  ctr: decimal("ctr", { precision: 5, scale: 2 }).default("2.00").notNull(),
  cpm: decimal("cpm", { precision: 8, scale: 2 }).default("8.00").notNull(),
  // Team Capacity
  setterCapacity: integer("setterCapacity").default(100),
  closerCapacity: integer("closerCapacity").default(80),
  setterMonthlyCost: decimal("setterMonthlyCost", { precision: 10, scale: 2 }).default("0.00"),
  closerMonthlyCost: decimal("closerMonthlyCost", { precision: 10, scale: 2 }).default("0.00"),
  // Calculated Funnel Volumes
  clientesNecesarios: integer("clientesNecesarios"),
  demosNecesarias: integer("demosNecesarias"),
  agendasConfirmadas: integer("agendasConfirmadas"),
  agendasTotales: integer("agendasTotales"),
  leadsContactados: integer("leadsContactados"),
  leadsTotales: integer("leadsTotales"),
  clicksNecesarios: integer("clicksNecesarios"),
  impresionesNecesarias: bigint("impresionesNecesarias", { mode: "number" }),
  // Calculated Costs
  adSpendCalculated: decimal("adSpendCalculated", { precision: 12, scale: 2 }),
  cpl: decimal("cpl", { precision: 8, scale: 2 }),
  cpb: decimal("cpb", { precision: 8, scale: 2 }),
  cpa: decimal("cpa", { precision: 8, scale: 2 }),
  cac: decimal("cac", { precision: 10, scale: 2 }),
  roas: decimal("roas", { precision: 8, scale: 2 }),
  // Calculated Revenue
  cashCollected: decimal("cashCollected", { precision: 12, scale: 2 }),
  contractedRevenue: decimal("contractedRevenue", { precision: 12, scale: 2 }),
  revenueCalculated: decimal("revenueCalculated", { precision: 12, scale: 2 }),
  // Calculated Team
  settersNecesarios: decimal("settersNecesarios", { precision: 5, scale: 2 }),
  closersNecesarios: decimal("closersNecesarios", { precision: 5, scale: 2 }),
  // Calculated Budgets
  presupuestoMensual: decimal("presupuestoMensual", { precision: 12, scale: 2 }),
  presupuestoDiario: decimal("presupuestoDiario", { precision: 10, scale: 2 }),
  // Meta
  isActive: integer("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type RevenueScenario = typeof revenueScenarios.$inferSelect;
export type InsertRevenueScenario = typeof revenueScenarios.$inferInsert;

/**
 * Lead Data Entries - Universal prospect profile data (form-agnostic)
 * Each row = one data submission from any source (form, webhook, manual)
 */
export const leadDataEntries = pgTable("lead_data_entries", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").notNull(),
  source: varchar("source", { length: 50 }).notNull(),
  formId: varchar("formId", { length: 100 }),
  data: jsonb("data").notNull(),
  scoreFinal: integer("scoreFinal"),
  scoreLabel: scoreLabelEnum("scoreLabel"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadDataEntry = typeof leadDataEntries.$inferSelect;
export type InsertLeadDataEntry = typeof leadDataEntries.$inferInsert;

/**
 * ManyChat Events - Webhook event log for Instagram funnel tracking
 */
export const manychatEvents = pgTable("manychat_events", {
  id: serial("id").primaryKey(),
  subscriberId: varchar("subscriberId", { length: 100 }).notNull(),
  eventType: varchar("eventType", { length: 50 }).notNull(),
  eventData: jsonb("eventData"),
  tagName: varchar("tagName", { length: 100 }),
  leadId: integer("leadId"),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ManychatEvent = typeof manychatEvents.$inferSelect;
export type InsertManychatEvent = typeof manychatEvents.$inferInsert;

// ==================== CLINICA TABLES ====================

/**
 * Clinic Organizations - Multi-tenant org for clinics
 */
export const clinicOrganizations = pgTable("clinic_organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  webhookToken: varchar("webhook_token", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicOrganization = typeof clinicOrganizations.$inferSelect;
export type InsertClinicOrganization = typeof clinicOrganizations.$inferInsert;

/**
 * Clinic Patients - Post-sale patient management
 */
export const clinicPatients = pgTable("clinic_patients", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  patientEmail: varchar("patient_email", { length: 255 }),
  patientPhone: varchar("patient_phone", { length: 50 }),
  treatmentType: varchar("treatment_type", { length: 255 }),
  initialAmount: decimal("initial_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  attended: boolean("attended"),
  purchased: boolean("purchased"),
  upsellProductId: uuid("upsell_product_id"),
  upsellPrice: decimal("upsell_price", { precision: 10, scale: 2 }),
  upsellNote: text("upsell_note"),
  upsellDecision: upsellDecisionEnum("upsell_decision"),
  upsellNotes: text("upsell_notes"),
  baseTreatmentPrice: decimal("base_treatment_price", { precision: 10, scale: 2 }),
  status: patientStatusEnum("status").default("pending").notNull(),
  ownerId: varchar("owner_id", { length: 100 }),
  leadId: integer("lead_id"), // Links to leads.id in ventas CRM
  scheduledDate: timestamp("scheduled_date"),
  scheduledNotes: text("scheduled_notes"),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  depositDate: timestamp("deposit_date"),
  hasDeposit: boolean("has_deposit"),
  depositProductId: uuid("deposit_product_id"),
  lossReasonCaptured: boolean("loss_reason_captured"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicPatient = typeof clinicPatients.$inferSelect;
export type InsertClinicPatient = typeof clinicPatients.$inferInsert;

/**
 * Clinic Products - Treatment/product catalog
 */
export const clinicProducts = pgTable("clinic_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).default("0").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicProduct = typeof clinicProducts.$inferSelect;
export type InsertClinicProduct = typeof clinicProducts.$inferInsert;

/**
 * Clinic User Profiles - User display info scoped to org
 */
export const clinicUserProfiles = pgTable("clinic_user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  organizationId: uuid("organization_id"),
  displayName: varchar("display_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicUserProfile = typeof clinicUserProfiles.$inferSelect;
export type InsertClinicUserProfile = typeof clinicUserProfiles.$inferInsert;

/**
 * Clinic User Roles - Role assignments per org
 */
export const clinicUserRoles = pgTable("clinic_user_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  organizationId: uuid("organization_id").notNull(),
  role: clinicRoleEnum("role").default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicUserRole = typeof clinicUserRoles.$inferSelect;
export type InsertClinicUserRole = typeof clinicUserRoles.$inferInsert;

/**
 * Clinic Loss Reasons - Why patients didn't convert
 */
export const clinicLossReasons = pgTable("clinic_loss_reasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }).notNull(),
  lossType: varchar("loss_type", { length: 50 }).notNull(), // no_show, no_sale, cancelled
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicLossReason = typeof clinicLossReasons.$inferSelect;
export type InsertClinicLossReason = typeof clinicLossReasons.$inferInsert;

/**
 * Loss Subcategories - Category taxonomy for loss reasons
 */
export const lossSubcategories = pgTable("loss_subcategories", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: varchar("category", { length: 100 }).notNull(),
  subcategoryKey: varchar("subcategory_key", { length: 100 }).notNull(),
  subcategoryLabelEs: varchar("subcategory_label_es", { length: 255 }).notNull(),
  subcategoryLabelEn: varchar("subcategory_label_en", { length: 255 }).notNull(),
  groupName: varchar("group_name", { length: 100 }),
  displayOrder: integer("display_order"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export type LossSubcategory = typeof lossSubcategories.$inferSelect;

/**
 * Clinic Payment Notifications - Payment events
 */
export const clinicPaymentNotifications = pgTable("clinic_payment_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientId: uuid("patient_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentData: jsonb("payment_data"),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export type ClinicPaymentNotification = typeof clinicPaymentNotifications.$inferSelect;

/**
 * Clinic Analytics Alerts - Metric monitoring
 */
export const clinicAnalyticsAlerts = pgTable("clinic_analytics_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  alertTitle: varchar("alert_title", { length: 255 }).notNull(),
  alertDescription: text("alert_description"),
  alertType: varchar("alert_type", { length: 50 }).notNull(),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  conditionType: varchar("condition_type", { length: 50 }).notNull(),
  thresholdValue: decimal("threshold_value", { precision: 10, scale: 2 }).notNull(),
  thresholdUnit: varchar("threshold_unit", { length: 20 }).default("absolute"),
  comparisonPeriod: varchar("comparison_period", { length: 20 }).default("previous_period"),
  notificationChannels: jsonb("notification_channels").default("{}"),
  isActive: boolean("is_active").default(true).notNull(),
  triggerCount: integer("trigger_count").default(0).notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicAnalyticsAlert = typeof clinicAnalyticsAlerts.$inferSelect;

/**
 * Clinic Analytics Alert Logs - Alert trigger history
 */
export const clinicAnalyticsAlertLogs = pgTable("clinic_analytics_alert_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  alertId: uuid("alert_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  metricValue: decimal("metric_value", { precision: 10, scale: 2 }).notNull(),
  thresholdValue: decimal("threshold_value", { precision: 10, scale: 2 }).notNull(),
  alertData: jsonb("alert_data"),
  notificationStatus: jsonb("notification_status"),
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
});

export type ClinicAnalyticsAlertLog = typeof clinicAnalyticsAlertLogs.$inferSelect;

/**
 * Clinic Slack Integrations - Per-org Slack connections
 */
export const clinicSlackIntegrations = pgTable("clinic_slack_integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  accessToken: text("access_token"),
  teamId: varchar("team_id", { length: 100 }),
  teamName: varchar("team_name", { length: 255 }),
  selectedChannelId: varchar("selected_channel_id", { length: 100 }),
  selectedChannelName: varchar("selected_channel_name", { length: 255 }),
  webhookUrl: text("webhook_url"),
  botUserId: varchar("bot_user_id", { length: 100 }),
  scope: text("scope"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicSlackIntegration = typeof clinicSlackIntegrations.$inferSelect;

/**
 * Clinic Report Templates - Custom analytics report templates
 */
export const clinicReportTemplates = pgTable("clinic_report_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  contentConfig: jsonb("content_config").default("{}"),
  brandingConfig: jsonb("branding_config").default("{}"),
  isActive: boolean("is_active").default(true).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicReportTemplate = typeof clinicReportTemplates.$inferSelect;

/**
 * Clinic Notification Schedules - Scheduled report delivery
 */
export const clinicNotificationSchedules = pgTable("clinic_notification_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  reportType: varchar("report_type", { length: 50 }).notNull(),
  templateId: uuid("template_id"),
  scheduleTime: varchar("schedule_time", { length: 10 }).default("09:00"),
  timezone: varchar("timezone", { length: 50 }).default("America/Santiago"),
  channelId: varchar("channel_id", { length: 100 }).notNull(),
  channelName: varchar("channel_name", { length: 255 }).notNull(),
  deliveryFormat: varchar("delivery_format", { length: 20 }).default("slack"),
  recipientsConfig: jsonb("recipients_config").default("{}"),
  isActive: boolean("is_active").default(true).notNull(),
  lastSentAt: timestamp("last_sent_at"),
  lastExecutionAt: timestamp("last_execution_at"),
  lastExecutionStatus: varchar("last_execution_status", { length: 20 }),
  nextExecutionAt: timestamp("next_execution_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicNotificationSchedule = typeof clinicNotificationSchedules.$inferSelect;

/**
 * Clinic Webhook Logs - Patient creation webhook audit
 */
export const clinicWebhookLogs = pgTable("clinic_webhook_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(), // created, updated, error
  patientData: jsonb("patient_data"),
  status: varchar("status", { length: 20 }).default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ClinicWebhookLog = typeof clinicWebhookLogs.$inferSelect;

/**
 * Clinic Failed Webhooks - Retry queue
 */
export const clinicFailedWebhooks = pgTable("clinic_failed_webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  webhookLogId: uuid("webhook_log_id").notNull(),
  webhookData: jsonb("webhook_data").notNull(),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
  maxRetries: integer("max_retries").default(5).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  nextRetryAt: timestamp("next_retry_at").notNull(),
  lastRetryAt: timestamp("last_retry_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClinicFailedWebhook = typeof clinicFailedWebhooks.$inferSelect;

/**
 * Clinic Onboarding Checklist - Track onboarding progress
 */
export const clinicOnboardingChecklist = pgTable("clinic_onboarding_checklist", {
  organizationId: uuid("organization_id").notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  addedProduct: boolean("added_product").default(false).notNull(),
  addedProductAt: timestamp("added_product_at"),
  completedPatient: boolean("completed_patient").default(false).notNull(),
  completedPatientAt: timestamp("completed_patient_at"),
  invitedMember: boolean("invited_member").default(false).notNull(),
  invitedMemberAt: timestamp("invited_member_at"),
  viewedAnalytics: boolean("viewed_analytics").default(false).notNull(),
  viewedAnalyticsAt: timestamp("viewed_analytics_at"),
  completedAt: timestamp("completed_at"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
});

/**
 * User Dashboard Layouts - Custom analytics dashboard config
 */
export const userDashboardLayouts = pgTable("user_dashboard_layouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  organizationId: uuid("organization_id").notNull(),
  layoutName: varchar("layout_name", { length: 255 }).default("Default"),
  layoutConfig: jsonb("layout_config").default("{}"),
  isDefault: boolean("is_default").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserDashboardLayout = typeof userDashboardLayouts.$inferSelect;

/**
 * Currency Config - Multi-currency support
 */
export const currencyConfig = pgTable("currency_config", {
  code: varchar("code", { length: 10 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  locale: varchar("locale", { length: 20 }).notNull(),
  decimals: integer("decimals").default(2).notNull(),
});

export type CurrencyConfigRow = typeof currencyConfig.$inferSelect;
