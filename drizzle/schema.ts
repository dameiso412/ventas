import { integer, bigint, text, timestamp, varchar, decimal, json, jsonb, uniqueIndex, index, pgTable, pgEnum, serial } from "drizzle-orm/pg-core";

// ==================== Enums ====================

export const roleEnum = pgEnum("role", ["user", "admin", "setter", "closer"]);
export const tipoEnum = pgEnum("tipo", ["DEMO", "INTRO"]);
export const categoriaEnum = pgEnum("categoria", ["AGENDA", "LEAD"]);
export const origenEnum = pgEnum("origen", ["ADS", "REFERIDO", "ORGANICO", "INSTAGRAM"]);
// DM_VISTO ("Message Seen") sits between DM_ENVIADO and EN_CONVERSACION — it's
// the ✓✓ double-blue state from the Cold DM System methodology, required so we
// can compute MSR (Message Seen Rate) as MS / A at the lead level.
export const igFunnelStageEnum = pgEnum("ig_funnel_stage", ["NUEVO_SEGUIDOR", "DM_ENVIADO", "DM_VISTO", "EN_CONVERSACION", "CALIFICADO", "AGENDA_ENVIADA", "AGENDA_RESERVADA", "DESCARTADO"]);
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
  // Click IDs (useful when the query string is stripped but Meta/Google
  // still append their own click identifier — lets us match back to ads
  // via Conversions API even when utm_* fails)
  fbclid: varchar("fbclid", { length: 500 }),
  gclid: varchar("gclid", { length: 500 }),
  /** Landing URL where the lead aterrizó (before conversion). */
  landingUrl: text("landingUrl"),
  /**
   * Normalized landing slug (EVTS-IN | DIAGNOSTICO | HOME | OTRO). Populated
   * either from `landing_slug` in the GHL webhook payload (preferred — set as
   * a custom field on each landing's automation) or derived from `landingUrl`
   * via `deriveLandingSlug()` in server/_core/landings.ts. NULL when neither
   * is available, which surfaces in the UI as "Sin landing" — acts as an
   * alarm that GHL config is missing for some source.
   */
  landingSlug: varchar("landingSlug", { length: 50 }),
  /** Referrer header at time of webhook capture — populated when webhook carries it. */
  attributionReferrer: varchar("attributionReferrer", { length: 500 }),
  // Creative-level attribution (resolved at webhook ingestion from UTM values).
  // When Meta's UTM macros (`{{ad.id}}`, `{{adset.id}}`, `{{campaign.id}}`) are
  // configured on the ad, they land here verbatim — giving us a 1-to-1 join to
  // ad_ads / ad_adsets / ad_campaigns without doing fuzzy name matching. Nullable
  // because older leads and non-Meta sources won't have them.
  metaAdId: varchar("metaAdId", { length: 50 }),
  metaAdsetId: varchar("metaAdsetId", { length: 50 }),
  metaCampaignId: varchar("metaCampaignId", { length: 50 }),
  // Scoring
  score: integer("score"),
  scoreLabel: scoreLabelEnum("scoreLabel"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  mesSemanaIdx: index("idx_leads_mes_semana").on(table.mes, table.semana),
  setterIdx: index("idx_leads_setter").on(table.setterAsignado),
  closerIdx: index("idx_leads_closer").on(table.closer),
  outcomeIdx: index("idx_leads_outcome").on(table.outcome),
  asistenciaIdx: index("idx_leads_asistencia").on(table.asistencia),
  scoreLabelIdx: index("idx_leads_score_label").on(table.scoreLabel),
  categoriaIdx: index("idx_leads_categoria").on(table.categoria),
  createdAtIdx: index("idx_leads_created_at").on(table.createdAt),
  fechaIdx: index("idx_leads_fecha").on(table.fecha),
  metaAdIdx: index("idx_leads_meta_ad_id").on(table.metaAdId),
  metaAdsetIdx: index("idx_leads_meta_adset_id").on(table.metaAdsetId),
  metaCampaignIdx: index("idx_leads_meta_campaign_id").on(table.metaCampaignId),
}));

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
  // Instagram DM metrics — Cold DM System funnel A→MS→B→C→D
  // igConversacionesIniciadas = A  (DMs Trojan Horse enviados)
  // igMensajesVistos          = MS (✓✓ azul / double-blue seen)
  // igRespuestasRecibidas     = respuestas totales (positivas + negativas, uso interno)
  // igCalificados             = B  (respuesta positiva / permiso)
  // igAgendasEnviadas         = C  (Calendly enviado)
  // igAgendasReservadas       = D  (cita reservada)
  igConversacionesIniciadas: integer("igConversacionesIniciadas").default(0),
  igMensajesVistos: integer("igMensajesVistos").default(0),
  igRespuestasRecibidas: integer("igRespuestasRecibidas").default(0),
  igCalificados: integer("igCalificados").default(0),
  igAgendasEnviadas: integer("igAgendasEnviadas").default(0),
  igAgendasReservadas: integer("igAgendasReservadas").default(0),
  // Warming activity (sanity-check vs IG daily limits) + CAR (Connection Accept Rate)
  igFollowsEnviados: integer("igFollowsEnviados").default(0),
  igFollowsAceptados: integer("igFollowsAceptados").default(0),
  igLikesEnviados: integer("igLikesEnviados").default(0),
  igComentariosEnviados: integer("igComentariosEnviados").default(0),
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
}, (table) => ({
  userUnreadIdx: index("idx_notifications_user_unread").on(table.userId, table.isRead),
}));

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
 * Ad Creatives - Cached creative media (video, thumbnail, image) for each ad.
 *
 * One row per adId. Fed by `fetchAdCreatives()` during `metaAds.syncStructure`.
 * Lets the CRM show the actual video/image that brought each lead, inline in
 * Atribucion drill-downs and lead detail sheets — instead of forcing the team
 * to open Meta Ads Manager and search by adId.
 */
export const adCreatives = pgTable("ad_creatives", {
  id: serial("id").primaryKey(),
  adId: varchar("adId", { length: 64 }).notNull().unique(),
  creativeId: varchar("creativeId", { length: 64 }),
  // Media
  videoId: varchar("videoId", { length: 64 }),
  videoSourceUrl: text("videoSourceUrl"),
  videoPermalinkUrl: text("videoPermalinkUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  imageUrl: text("imageUrl"),
  // Copy
  title: varchar("title", { length: 500 }),
  body: text("body"),
  callToActionType: varchar("callToActionType", { length: 50 }),
  // Destination
  destinationUrl: text("destinationUrl"),
  instagramPermalinkUrl: text("instagramPermalinkUrl"),
  // Meta
  effectiveObjectStoryId: varchar("effectiveObjectStoryId", { length: 128 }),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AdCreative = typeof adCreatives.$inferSelect;
export type InsertAdCreative = typeof adCreatives.$inferInsert;

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

// ==================== STRIPE ====================
//
// Stripe is the source of truth for payments. We cache every charge we see
// (via sync or webhook) here in `stripe_payments` and link it to a lead
// via `leadId`. `cashCollected` on the lead is re-derived from these rows
// minus refunds/disputes, so commissions stay honest automatically.

export const stripePaymentStatusEnum = pgEnum("stripe_payment_status", [
  "succeeded",
  "pending",
  "failed",
  "refunded",
  "partially_refunded",
  "disputed",
  "canceled",
]);

export const stripePayments = pgTable("stripe_payments", {
  id: serial("id").primaryKey(),

  // Stripe identifiers (source of truth — at least one is always set)
  stripeChargeId: varchar("stripeChargeId", { length: 64 }).unique(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 64 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 64 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 128 }),

  // Money (stored in the currency-native unit, not cents)
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  amountRefunded: decimal("amountRefunded", { precision: 12, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 10 }).notNull(),
  status: stripePaymentStatusEnum("status").notNull(),

  // Payment method metadata for display
  paymentMethodBrand: varchar("paymentMethodBrand", { length: 50 }),
  last4: varchar("last4", { length: 4 }),
  receiptUrl: text("receiptUrl"),

  // Customer info as seen by Stripe
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerName: varchar("customerName", { length: 255 }),
  description: text("description"),

  // CRM link
  leadId: integer("leadId"),
  matchMethod: varchar("matchMethod", { length: 30 }),  // "metadata" | "email_auto" | "manual" | "ambiguous" | null
  matchedAt: timestamp("matchedAt"),
  matchedBy: varchar("matchedBy", { length: 255 }),

  // Full Stripe metadata object, untouched
  rawMetadata: jsonb("rawMetadata"),
  // Timestamp from Stripe (used for ordering + date filters)
  stripeCreatedAt: timestamp("stripeCreatedAt").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  leadIdx: index("idx_stripe_payments_lead").on(table.leadId),
  statusIdx: index("idx_stripe_payments_status").on(table.status),
  createdIdx: index("idx_stripe_payments_created").on(table.stripeCreatedAt),
  emailIdx: index("idx_stripe_payments_email").on(table.customerEmail),
}));

export type StripePayment = typeof stripePayments.$inferSelect;
export type InsertStripePayment = typeof stripePayments.$inferInsert;

/**
 * Every Stripe event we receive goes here. Unique on eventId so Stripe
 * replays (common during endpoint retries) are idempotent — we insert
 * once, then skip the handler on subsequent hits.
 */
export const stripeWebhookLogs = pgTable("stripe_webhook_logs", {
  id: serial("id").primaryKey(),
  eventId: varchar("eventId", { length: 128 }).notNull().unique(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  status: varchar("status", { length: 30 }).notNull(),  // "received" | "processed" | "skipped" | "error"
  errorMessage: text("errorMessage"),
  rawPayload: text("rawPayload"),
  processingTimeMs: integer("processingTimeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("idx_stripe_webhook_logs_type").on(table.eventType),
  createdIdx: index("idx_stripe_webhook_logs_created").on(table.createdAt),
}));

export type StripeWebhookLog = typeof stripeWebhookLogs.$inferSelect;
export type InsertStripeWebhookLog = typeof stripeWebhookLogs.$inferInsert;

// ==================== SYSTEM CONFIG ====================
/**
 * Global key/value config for platform-wide settings that aren't per-lead.
 *
 * Used by:
 *   - Dashboard/Pipeline — `defaultTicketValue` (fallback when a lead's
 *     `contractedRevenue` or `ticket` is null).
 *   - Future features (Ventas/Comisiones — commission rates per closer).
 *
 * The value is stored as text — JSON.stringify/parse on the consumer side.
 * Kept deliberately small (no typed columns per feature) so new settings
 * don't need a migration.
 */
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedBy: varchar("updatedBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

/**
 * Prospecting goals — global, admin-editable configuration for the IG Cold DM
 * System. Drives the Tablero semáforo (traffic-light KPI status) and the daily
 * volume targets shown in the Rutina page. Seeded with the doc's recommended
 * minimums (MSR ≥40%, PRR ≥6%, etc.) and daily limits (30 DMs, 50 follows, …).
 *
 * `unit`:     "count" for absolute daily targets, "percent" for KPI thresholds
 *             (stored as whole numbers — 40 means 40%, not 0.4).
 * `category`: "daily_volume" | "kpi_threshold" — drives the UI grouping in
 *             /prospeccion/metas.
 */
export const prospectingGoals = pgTable("prospecting_goals", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  category: varchar("category", { length: 30 }).notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 255 }),
});

export type ProspectingGoal = typeof prospectingGoals.$inferSelect;
export type InsertProspectingGoal = typeof prospectingGoals.$inferInsert;

/**
 * Prospecting doctor reviews — each time a setter (or admin) consults the
 * Doctor for a KPI that fell below threshold, we persist the troubleshooting
 * session here. Gives us:
 *   1. An audit trail of "I checked why MSR was low on 2026-04-18 and marked
 *      these 3 causes — here are my notes."
 *   2. Data for a future insight: which causes correlate with KPI recovery?
 *
 * `metric`:         one of "msr" | "prr" | "csr" | "abr" | "car"
 * `valueAtReview`:  the KPI value at the moment of review (0-100 percent).
 *                   Stored so we know the severity without recomputing.
 * `causesChecked`:  jsonb map of { causeId: boolean } derived from the
 *                   hard-coded checklist per KPI (doc 3). Keys like
 *                   "niche_active", "lead_quality", "account_health", etc.
 * `notes`:          free-text notes from the setter ("switched to a new
 *                   niche last week, account is 3 days warm").
 */
export const prospectingDoctorReviews = pgTable("prospecting_doctor_reviews", {
  id: serial("id").primaryKey(),
  setterName: varchar("setterName", { length: 255 }).notNull(),
  metric: varchar("metric", { length: 10 }).notNull(),
  valueAtReview: decimal("valueAtReview", { precision: 6, scale: 2 }),
  thresholdAtReview: decimal("thresholdAtReview", { precision: 6, scale: 2 }),
  causesChecked: jsonb("causesChecked").notNull(),
  notes: text("notes"),
  reviewedAt: timestamp("reviewedAt").defaultNow().notNull(),
}, (table) => ({
  setterIdx: index("idx_doctor_reviews_setter").on(table.setterName),
  metricIdx: index("idx_doctor_reviews_metric").on(table.metric),
  reviewedAtIdx: index("idx_doctor_reviews_reviewed_at").on(table.reviewedAt),
}));

export type ProspectingDoctorReview = typeof prospectingDoctorReviews.$inferSelect;
export type InsertProspectingDoctorReview = typeof prospectingDoctorReviews.$inferInsert;

/**
 * Round-Robin de asignaciones automáticas.
 *
 * Tres tablas relacionadas:
 *   1. round_robin_rules     — una regla por tipo de evento (hoy: AGENDA_NUEVA).
 *   2. round_robin_targets   — los setters y su % por regla. Σ % activos = 100.
 *   3. round_robin_assignments — log inmutable. Es el "estado" del algoritmo:
 *      el algoritmo de Weighted Round-Robin determinístico calcula expected vs
 *      actual contando filas aquí. No hay un counter mutable separado.
 *
 * Por qué setterName es texto y no FK a teamMembers:
 *   - leads.setterAsignado ya es texto libre. Mantenemos consistencia.
 *   - Renombrar un setter en team_members no invalida assignments históricas.
 *   - El admin UI muestra warning si un setterName ya no existe en team_members.
 */
export const roundRobinRules = pgTable("round_robin_rules", {
  id: serial("id").primaryKey(),
  /** Identificador del evento que dispara la regla. Hoy: "AGENDA_NUEVA". Extensible: "LEAD_HOT", etc. */
  eventType: varchar("eventType", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  activo: integer("activo").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type RoundRobinRule = typeof roundRobinRules.$inferSelect;
export type InsertRoundRobinRule = typeof roundRobinRules.$inferInsert;

export const roundRobinTargets = pgTable("round_robin_targets", {
  id: serial("id").primaryKey(),
  ruleId: integer("ruleId").notNull().references(() => roundRobinRules.id, { onDelete: "cascade" }),
  /** Match contra leads.setterAsignado y team_members.nombre. Texto libre. */
  setterName: varchar("setterName", { length: 100 }).notNull(),
  /** Peso 0-100. La suma de pesos activos por rule debe ser 100 (validado en backend). */
  percentage: integer("percentage").notNull(),
  activo: integer("activo").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  ruleIdx: index("idx_rr_targets_rule").on(table.ruleId),
}));

export type RoundRobinTarget = typeof roundRobinTargets.$inferSelect;
export type InsertRoundRobinTarget = typeof roundRobinTargets.$inferInsert;

export const roundRobinAssignments = pgTable("round_robin_assignments", {
  id: serial("id").primaryKey(),
  ruleId: integer("ruleId").notNull().references(() => roundRobinRules.id),
  leadId: integer("leadId").notNull().references(() => leads.id),
  setterName: varchar("setterName", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ruleIdx: index("idx_rr_assignments_rule").on(table.ruleId),
  setterIdx: index("idx_rr_assignments_setter").on(table.setterName),
  createdAtIdx: index("idx_rr_assignments_created").on(table.createdAt),
}));

export type RoundRobinAssignment = typeof roundRobinAssignments.$inferSelect;
export type InsertRoundRobinAssignment = typeof roundRobinAssignments.$inferInsert;

/**
 * Slack interactivity tables.
 *
 * `slack_alert_snoozes` lets a setter silence a recurring alert (ej.
 * "speed-to-lead") por un rato sin perderlo permanentemente — el cron
 * consulta esta tabla antes de mandar y suprime si hay un row con
 * expiresAt > NOW() para esa key.
 *
 * `slack_actions_log` es audit trail inmutable de cada button click
 * recibido en /api/slack/interactive. Útil para debug y reportes.
 */
export const slackAlertSnoozes = pgTable("slack_alert_snoozes", {
  id: serial("id").primaryKey(),
  /** Match contra la key del dedup map en cron-kpi-monitor (ej. "speed-to-lead"). */
  alertKey: varchar("alertKey", { length: 80 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  snoozedBySlackUserId: varchar("snoozedBySlackUserId", { length: 50 }),
  snoozedByEmail: varchar("snoozedByEmail", { length: 320 }),
  snoozedByName: varchar("snoozedByName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  keyExpiresIdx: index("idx_slack_snoozes_key_expires").on(table.alertKey, table.expiresAt),
}));

export type SlackAlertSnooze = typeof slackAlertSnoozes.$inferSelect;
export type InsertSlackAlertSnooze = typeof slackAlertSnoozes.$inferInsert;

export const slackActionsLog = pgTable("slack_actions_log", {
  id: serial("id").primaryKey(),
  /** Format: "lead_contactado:1234" — action + target id. */
  actionId: varchar("actionId", { length: 120 }).notNull(),
  /** Type of CRM entity targeted (lead, follow_up, alert_key). Null for snoozes. */
  targetType: varchar("targetType", { length: 40 }),
  targetId: integer("targetId"),
  slackUserId: varchar("slackUserId", { length: 50 }).notNull(),
  slackUserName: varchar("slackUserName", { length: 255 }),
  crmUserEmail: varchar("crmUserEmail", { length: 320 }),
  crmUserName: varchar("crmUserName", { length: 255 }),
  result: varchar("result", { length: 40 }).default("success").notNull(),
  errorMessage: text("errorMessage"),
  rawPayload: jsonb("rawPayload"),
  processingTimeMs: integer("processingTimeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  actionIdIdx: index("idx_slack_actions_action_id").on(table.actionId),
  targetIdx: index("idx_slack_actions_target").on(table.targetType, table.targetId),
  createdAtIdx: index("idx_slack_actions_created").on(table.createdAt),
}));

export type SlackActionLog = typeof slackActionsLog.$inferSelect;
export type InsertSlackActionLog = typeof slackActionsLog.$inferInsert;
