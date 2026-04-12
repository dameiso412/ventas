CREATE TYPE "public"."allowed_email_role" AS ENUM('admin', 'setter', 'closer');--> statement-breakpoint
CREATE TYPE "public"."asistencia" AS ENUM('ASISTIÓ', 'NO SHOW', 'PENDIENTE');--> statement-breakpoint
CREATE TYPE "public"."califica" AS ENUM('SÍ', 'NO', 'POR EVALUAR');--> statement-breakpoint
CREATE TYPE "public"."calificacion_financiera" AS ENUM('SÍ', 'NO', 'PARCIAL', 'PENDIENTE');--> statement-breakpoint
CREATE TYPE "public"."canal" AS ENUM('LLAMADA', 'WHATSAPP', 'SMS', 'EMAIL', 'DM_INSTAGRAM', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."categoria" AS ENUM('AGENDA', 'LEAD');--> statement-breakpoint
CREATE TYPE "public"."contact_resultado" AS ENUM('CONTESTÓ', 'NO CONTESTÓ', 'BUZÓN', 'NÚMERO INVÁLIDO', 'MENSAJE ENVIADO');--> statement-breakpoint
CREATE TYPE "public"."creado_desde" AS ENUM('MANUAL', 'CITAS', 'SCORING');--> statement-breakpoint
CREATE TYPE "public"."estado_confirmacion" AS ENUM('CONFIRMADA', 'NO CONFIRMADA', 'CANCELADA', 'REAGENDADA', 'PENDIENTE');--> statement-breakpoint
CREATE TYPE "public"."estado_lead" AS ENUM('NUEVO', 'CONTACTADO', 'CALIFICADO', 'DESCARTADO', 'CONVERTIDO_AGENDA');--> statement-breakpoint
CREATE TYPE "public"."follow_up_accion" AS ENUM('LLAMADA', 'WHATSAPP', 'EMAIL', 'DM_INSTAGRAM', 'DM_FACEBOOK', 'NOTA', 'CAMBIO_TIPO', 'CAMBIO_ESTADO', 'REAGENDADO');--> statement-breakpoint
CREATE TYPE "public"."follow_up_estado" AS ENUM('ACTIVO', 'CERRADO_GANADO', 'CERRADO_PERDIDO', 'MOVIDO_A_WARM', 'ARCHIVADO');--> statement-breakpoint
CREATE TYPE "public"."follow_up_tipo" AS ENUM('HOT', 'WARM');--> statement-breakpoint
CREATE TYPE "public"."manual_review" AS ENUM('PENDIENTE', 'REVISADA', 'ACCIONADA');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('mention', 'comment', 'system');--> statement-breakpoint
CREATE TYPE "public"."oferta_hecha" AS ENUM('SÍ', 'NO', 'N/A');--> statement-breakpoint
CREATE TYPE "public"."origen" AS ENUM('ADS', 'REFERIDO', 'ORGANICO');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('VENTA', 'PERDIDA', 'SEGUIMIENTO', 'PENDIENTE');--> statement-breakpoint
CREATE TYPE "public"."prioridad" AS ENUM('RED_HOT', 'HOT', 'WARM', 'COLD');--> statement-breakpoint
CREATE TYPE "public"."producto_interes" AS ENUM('PIF', 'SETUP_MONTHLY', 'POR_DEFINIR');--> statement-breakpoint
CREATE TYPE "public"."producto_tipo" AS ENUM('PIF', 'SETUP_MONTHLY');--> statement-breakpoint
CREATE TYPE "public"."resultado_contacto" AS ENUM('CONTESTÓ', 'NO CONTESTÓ', 'BUZÓN', 'NÚMERO INVÁLIDO', 'WHATSAPP LIMPIADO', 'PENDIENTE');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin', 'setter', 'closer');--> statement-breakpoint
CREATE TYPE "public"."scenario_mode" AS ENUM('reverse', 'forward');--> statement-breakpoint
CREATE TYPE "public"."score_label" AS ENUM('HOT', 'WARM', 'TIBIO', 'FRÍO');--> statement-breakpoint
CREATE TYPE "public"."si_no" AS ENUM('SÍ', 'NO');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('success', 'error', 'running');--> statement-breakpoint
CREATE TYPE "public"."team_member_rol" AS ENUM('SETTER', 'CLOSER', 'SETTER_CLOSER');--> statement-breakpoint
CREATE TYPE "public"."tipo" AS ENUM('DEMO', 'INTRO');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('RECEIVED', 'PROCESSED', 'DUPLICATE', 'UPDATED', 'ERROR');--> statement-breakpoint
CREATE TABLE "ad_ads" (
	"id" serial PRIMARY KEY NOT NULL,
	"adId" varchar(64) NOT NULL,
	"adsetId" varchar(64),
	"campaignId" varchar(64),
	"name" varchar(500),
	"status" varchar(50),
	"creativePreviewUrl" text,
	"urlTags" text,
	"lastSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_ads_adId_unique" UNIQUE("adId")
);
--> statement-breakpoint
CREATE TABLE "ad_adsets" (
	"id" serial PRIMARY KEY NOT NULL,
	"adsetId" varchar(64) NOT NULL,
	"campaignId" varchar(64) NOT NULL,
	"name" varchar(500),
	"status" varchar(50),
	"targetingDescription" text,
	"lastSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_adsets_adsetId_unique" UNIQUE("adsetId")
);
--> statement-breakpoint
CREATE TABLE "ad_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" varchar(64) NOT NULL,
	"name" varchar(500),
	"status" varchar(50),
	"objective" varchar(100),
	"lastSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_campaigns_campaignId_unique" UNIQUE("campaignId")
);
--> statement-breakpoint
CREATE TABLE "ad_metrics_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp NOT NULL,
	"campaignId" varchar(64) NOT NULL,
	"campaignName" varchar(500),
	"adsetId" varchar(64),
	"adsetName" varchar(500),
	"adId" varchar(64),
	"adName" varchar(500),
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"spend" numeric(10, 2) DEFAULT '0',
	"reach" integer DEFAULT 0,
	"leads" integer DEFAULT 0,
	"linkClicks" integer DEFAULT 0,
	"ctr" numeric(8, 4) DEFAULT '0',
	"cpc" numeric(10, 2) DEFAULT '0',
	"cpl" numeric(10, 2) DEFAULT '0',
	"costPerResult" numeric(10, 2) DEFAULT '0',
	"lastSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allowed_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "allowed_email_role" DEFAULT 'setter' NOT NULL,
	"nombre" varchar(255),
	"activo" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_emails_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"keyHash" varchar(128) NOT NULL,
	"keyPrefix" varchar(30) NOT NULL,
	"isActive" integer DEFAULT 1 NOT NULL,
	"lastUsedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_keyHash_unique" UNIQUE("keyHash")
);
--> statement-breakpoint
CREATE TABLE "call_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"leadId" integer,
	"closer" varchar(100),
	"fechaLlamada" timestamp,
	"linkGrabacion" text,
	"recordingTranscript" text,
	"leadName" varchar(200),
	"leadEmail" varchar(320),
	"duracionMinutos" integer,
	"aiFeedback" text,
	"aiGrading" integer,
	"aiGradingJustification" text,
	"aiWhyNotClosed" text,
	"aiKeyMoments" text,
	"manualReview" "manual_review" DEFAULT 'PENDIENTE' NOT NULL,
	"manualNotes" text,
	"actionItems" json,
	"reviewedBy" varchar(100),
	"reviewedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closer_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp NOT NULL,
	"mes" varchar(20),
	"semana" integer,
	"closer" varchar(100) NOT NULL,
	"scheduleCalls" integer DEFAULT 0,
	"liveCalls" integer DEFAULT 0,
	"offers" integer DEFAULT 0,
	"deposits" integer DEFAULT 0,
	"closes" integer DEFAULT 0,
	"piffRevenue" numeric(10, 2) DEFAULT '0',
	"piffCash" numeric(10, 2) DEFAULT '0',
	"setupRevenue" numeric(10, 2) DEFAULT '0',
	"setupCash" numeric(10, 2) DEFAULT '0',
	"notas" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closer_projection_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectionId" integer NOT NULL,
	"dayOfWeek" varchar(20) NOT NULL,
	"fecha" timestamp NOT NULL,
	"scheduleCalls" integer DEFAULT 0,
	"liveCalls" integer DEFAULT 0,
	"offers" integer DEFAULT 0,
	"deposits" integer DEFAULT 0,
	"closes" integer DEFAULT 0,
	"piffRevenue" numeric(10, 2) DEFAULT '0',
	"piffCash" numeric(10, 2) DEFAULT '0',
	"setupRevenue" numeric(10, 2) DEFAULT '0',
	"setupCash" numeric(10, 2) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closer_projections" (
	"id" serial PRIMARY KEY NOT NULL,
	"closer" varchar(100) NOT NULL,
	"semana" integer NOT NULL,
	"mes" varchar(20) NOT NULL,
	"anio" integer NOT NULL,
	"weekStarting" timestamp,
	"weekEnding" timestamp,
	"scheduledCallsTarget" integer DEFAULT 0,
	"showRateTarget" numeric(5, 2) DEFAULT '0',
	"offerRateTarget" numeric(5, 2) DEFAULT '0',
	"closeRateTarget" numeric(5, 2) DEFAULT '0',
	"projectedLiveCalls" integer DEFAULT 0,
	"projectedOffers" integer DEFAULT 0,
	"projectedCloses" integer DEFAULT 0,
	"bloodGoalCloses" integer DEFAULT 0,
	"bloodGoalRevenue" numeric(10, 2) DEFAULT '0',
	"bloodGoalCash" numeric(10, 2) DEFAULT '0',
	"stretchGoalCloses" integer DEFAULT 0,
	"stretchGoalRevenue" numeric(10, 2) DEFAULT '0',
	"stretchGoalCash" numeric(10, 2) DEFAULT '0',
	"bloodHit" integer,
	"stretchHit" integer,
	"notas" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"leadId" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"canal" "canal" DEFAULT 'LLAMADA' NOT NULL,
	"resultado" "contact_resultado" DEFAULT 'NO CONTESTÓ',
	"notas" text,
	"realizadoPor" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"followUpId" integer NOT NULL,
	"accion" "follow_up_accion" NOT NULL,
	"detalle" text,
	"realizadoPor" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"leadId" integer,
	"nombre" varchar(255),
	"correo" varchar(320),
	"telefono" varchar(50),
	"instagram" varchar(255),
	"facebook" varchar(255),
	"tipo" "follow_up_tipo" DEFAULT 'HOT' NOT NULL,
	"prioridad" "prioridad" DEFAULT 'HOT' NOT NULL,
	"estado" "follow_up_estado" DEFAULT 'ACTIVO' NOT NULL,
	"ultimaObjecion" text,
	"montoEstimado" numeric(10, 2) DEFAULT '0',
	"productoInteres" "producto_interes" DEFAULT 'POR_DEFINIR',
	"ultimoFollowUp" timestamp,
	"proximoFollowUp" timestamp,
	"totalFollowUps" integer DEFAULT 0,
	"closerAsignado" varchar(100),
	"notas" text,
	"linkCRM" varchar(500),
	"creadoDesde" "creado_desde" DEFAULT 'MANUAL' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"leadId" integer NOT NULL,
	"userId" integer,
	"autor" varchar(100) NOT NULL,
	"autorRole" varchar(20),
	"texto" text NOT NULL,
	"mentions" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_scoring" (
	"id" serial PRIMARY KEY NOT NULL,
	"leadId" integer,
	"correo" varchar(320),
	"instagram" varchar(255),
	"p1Frustracion" text,
	"p2MarketingPrevio" text,
	"p3Urgencia" text,
	"p4TiempoOperando" text,
	"p5Tratamientos" text,
	"p6Impedimento" text,
	"scoreP1" integer,
	"scoreP2" integer,
	"scoreP3" integer,
	"scoreP4" integer,
	"scoreP6" integer,
	"scoreTotal" integer,
	"scoreFinal" integer,
	"scoreLabel" "score_label",
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp,
	"mes" varchar(20),
	"semana" integer,
	"tipo" "tipo" DEFAULT 'DEMO' NOT NULL,
	"categoria" "categoria" DEFAULT 'AGENDA' NOT NULL,
	"origen" "origen" DEFAULT 'ADS' NOT NULL,
	"nombre" varchar(255),
	"correo" varchar(320),
	"telefono" varchar(50),
	"pais" varchar(50),
	"instagram" varchar(255),
	"rubro" varchar(255),
	"estadoLead" "estado_lead" DEFAULT 'NUEVO',
	"setterAsignado" varchar(100),
	"fechaPrimerContacto" timestamp,
	"tiempoRespuestaHoras" numeric(10, 2),
	"intentosContacto" integer DEFAULT 0,
	"resultadoContacto" "resultado_contacto" DEFAULT 'PENDIENTE',
	"validoParaContacto" "si_no" DEFAULT 'SÍ',
	"califica" "califica" DEFAULT 'POR EVALUAR',
	"razonNoCalifica" varchar(255),
	"estadoConfirmacion" "estado_confirmacion" DEFAULT 'PENDIENTE',
	"triage" varchar(255),
	"asistencia" "asistencia" DEFAULT 'PENDIENTE',
	"closer" varchar(100),
	"ofertaHecha" "oferta_hecha" DEFAULT 'N/A',
	"outcome" "outcome" DEFAULT 'PENDIENTE',
	"razonNoConversion" varchar(500),
	"productoTipo" "producto_tipo",
	"facturado" numeric(10, 2) DEFAULT '0',
	"cashCollected" numeric(10, 2) DEFAULT '0',
	"deposito" numeric(10, 2) DEFAULT '0',
	"contractedRevenue" numeric(10, 2) DEFAULT '0',
	"setupFee" numeric(10, 2) DEFAULT '0',
	"recurrenciaMensual" numeric(10, 2) DEFAULT '0',
	"fechaProximoCobro" timestamp,
	"notas" text,
	"linkCRM" varchar(500),
	"linkGrabacion" varchar(500),
	"calificacionFinanciera" "calificacion_financiera" DEFAULT 'PENDIENTE',
	"respuestaFinanciera" text,
	"fechaIntro" timestamp,
	"utmSource" varchar(100),
	"utmMedium" varchar(100),
	"utmCampaign" varchar(255),
	"utmContent" varchar(255),
	"utmTerm" varchar(255),
	"score" integer,
	"scoreLabel" "score_label",
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" varchar(20) NOT NULL,
	"anio" integer NOT NULL,
	"adSpend" numeric(10, 2) DEFAULT '0',
	"totalLeadsRaw" integer DEFAULT 0,
	"totalLeads" integer DEFAULT 0,
	"visitasLandingPage" integer DEFAULT 0,
	"ctrUnico" numeric(5, 2) DEFAULT '0',
	"ctr" numeric(5, 2) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "notification_type" DEFAULT 'mention' NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"leadId" integer,
	"commentId" integer,
	"fromUserId" integer,
	"fromUserName" varchar(100),
	"isRead" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"name" varchar(200) NOT NULL,
	"mode" "scenario_mode" DEFAULT 'reverse' NOT NULL,
	"revenueGoal" numeric(12, 2),
	"adSpendInput" numeric(12, 2),
	"ticketPromedio" numeric(10, 2) NOT NULL,
	"upfrontCashPct" numeric(5, 2) DEFAULT '60.00' NOT NULL,
	"closeRate" numeric(5, 2) NOT NULL,
	"showRate" numeric(5, 2) NOT NULL,
	"confirmationRate" numeric(5, 2) DEFAULT '85.00' NOT NULL,
	"answerRate" numeric(5, 2) DEFAULT '85.00' NOT NULL,
	"bookingRate" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"landingConvRate" numeric(5, 2) DEFAULT '30.00' NOT NULL,
	"ctr" numeric(5, 2) DEFAULT '2.00' NOT NULL,
	"cpm" numeric(8, 2) DEFAULT '8.00' NOT NULL,
	"setterCapacity" integer DEFAULT 100,
	"closerCapacity" integer DEFAULT 80,
	"setterMonthlyCost" numeric(10, 2) DEFAULT '0.00',
	"closerMonthlyCost" numeric(10, 2) DEFAULT '0.00',
	"clientesNecesarios" integer,
	"demosNecesarias" integer,
	"agendasConfirmadas" integer,
	"agendasTotales" integer,
	"leadsContactados" integer,
	"leadsTotales" integer,
	"clicksNecesarios" integer,
	"impresionesNecesarias" bigint,
	"adSpendCalculated" numeric(12, 2),
	"cpl" numeric(8, 2),
	"cpb" numeric(8, 2),
	"cpa" numeric(8, 2),
	"cac" numeric(10, 2),
	"roas" numeric(8, 2),
	"cashCollected" numeric(12, 2),
	"contractedRevenue" numeric(12, 2),
	"revenueCalculated" numeric(12, 2),
	"settersNecesarios" numeric(5, 2),
	"closersNecesarios" numeric(5, 2),
	"presupuestoMensual" numeric(12, 2),
	"presupuestoDiario" numeric(10, 2),
	"isActive" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setter_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp NOT NULL,
	"mes" varchar(20),
	"semana" integer,
	"setter" varchar(100) NOT NULL,
	"intentosLlamada" integer DEFAULT 0,
	"introsEfectivas" integer DEFAULT 0,
	"demosAseguradasConIntro" integer DEFAULT 0,
	"demosEnCalendario" integer DEFAULT 0,
	"demosConfirmadas" integer DEFAULT 0,
	"demosAsistidas" integer DEFAULT 0,
	"introAgendadas" integer DEFAULT 0,
	"introLive" integer DEFAULT 0,
	"introADemo" integer DEFAULT 0,
	"cierresAtribuidos" integer DEFAULT 0,
	"revenueAtribuido" numeric(10, 2) DEFAULT '0',
	"cashAtribuido" numeric(10, 2) DEFAULT '0',
	"notas" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setter_projection_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectionId" integer NOT NULL,
	"dayOfWeek" varchar(20) NOT NULL,
	"fecha" timestamp NOT NULL,
	"intentosLlamada" integer DEFAULT 0,
	"introsEfectivas" integer DEFAULT 0,
	"demosAseguradasConIntro" integer DEFAULT 0,
	"demosEnCalendario" integer DEFAULT 0,
	"demosConfirmadas" integer DEFAULT 0,
	"demosAsistidas" integer DEFAULT 0,
	"cierresAtribuidos" integer DEFAULT 0,
	"revenueAtribuido" numeric(10, 2) DEFAULT '0',
	"cashAtribuido" numeric(10, 2) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setter_projections" (
	"id" serial PRIMARY KEY NOT NULL,
	"setter" varchar(100) NOT NULL,
	"semana" integer NOT NULL,
	"mes" varchar(20) NOT NULL,
	"anio" integer NOT NULL,
	"weekStarting" timestamp,
	"weekEnding" timestamp,
	"intentosLlamadaTarget" integer DEFAULT 0,
	"introsEfectivasTarget" integer DEFAULT 0,
	"demosAseguradasTarget" integer DEFAULT 0,
	"demosCalendarioTarget" integer DEFAULT 0,
	"demosConfirmadasTarget" integer DEFAULT 0,
	"demosAsistidasTarget" integer DEFAULT 0,
	"bloodGoalDemosAsistidas" integer DEFAULT 0,
	"bloodGoalCierres" integer DEFAULT 0,
	"bloodGoalRevenue" numeric(10, 2) DEFAULT '0',
	"bloodGoalCash" numeric(10, 2) DEFAULT '0',
	"stretchGoalDemosAsistidas" integer DEFAULT 0,
	"stretchGoalCierres" integer DEFAULT 0,
	"stretchGoalRevenue" numeric(10, 2) DEFAULT '0',
	"stretchGoalCash" numeric(10, 2) DEFAULT '0',
	"bloodHit" integer,
	"stretchHit" integer,
	"notas" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"syncType" varchar(50) NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"details" text,
	"campaignsSynced" integer DEFAULT 0,
	"adsetsSynced" integer DEFAULT 0,
	"adsSynced" integer DEFAULT 0,
	"insightsSynced" integer DEFAULT 0,
	"dateFrom" varchar(10),
	"dateTo" varchar(10),
	"durationMs" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"rol" "team_member_rol" NOT NULL,
	"activo" integer DEFAULT 1 NOT NULL,
	"correo" varchar(320),
	"telefono" varchar(50),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"authId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_authId_unique" UNIQUE("authId")
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" varchar(100) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status" "webhook_status" DEFAULT 'RECEIVED' NOT NULL,
	"leadId" integer,
	"nombre" varchar(255),
	"correo" varchar(320),
	"telefono" varchar(50),
	"rawPayload" text,
	"processingNotes" text,
	"errorMessage" text,
	"processingTimeMs" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_fecha_campaign_adset_ad" ON "ad_metrics_daily" USING btree ("fecha","campaignId","adsetId","adId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mes_anio" ON "monthly_metrics" USING btree ("mes","anio");