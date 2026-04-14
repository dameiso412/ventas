import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, adminProcedure, crmProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { createApiKey, listApiKeys, revokeApiKey, deleteApiKey } from "./api-v1";
import * as metaAds from "./meta-ads";
import { reanalyzeTranscript } from "./_core/transcription";
import { performFullSync } from "./cron-meta-sync";
import {
  COST_BENCHMARKS, RATE_BENCHMARKS, evaluateMetric,
  CONSTRAINT_SCENARIOS, HEALTH_COLORS,
  type HealthLevel, type BenchmarkRange, type ConstraintCategory
} from "../shared/benchmarks";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== LEADS ====================
  leads: router({
    list: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
        origen: z.string().optional(),
        setter: z.string().optional(),
        closer: z.string().optional(),
        scoreLabel: z.string().optional(),
        outcome: z.string().optional(),
        tipo: z.string().optional(),
        categoria: z.string().optional(),
        estadoLead: z.string().optional(),
        timeFilter: z.enum(["proximas", "pasadas"]).optional(),
      }).optional())
      .query(({ input }) => db.getLeads(input ?? undefined)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getLeadById(input.id)),

    create: publicProcedure
      .input(z.object({
        fecha: z.date().optional(),
        mes: z.string().optional(),
        semana: z.number().optional(),
        tipo: z.enum(["DEMO", "INTRO"]).optional(),
        origen: z.enum(["ADS", "REFERIDO", "ORGANICO", "INSTAGRAM"]).optional(),
        nombre: z.string().optional(),
        correo: z.string().optional(),
        telefono: z.string().optional(),
        pais: z.string().optional(),
        instagram: z.string().optional(),
        manychatSubscriberId: z.string().optional(),
        igFunnelStage: z.string().optional(),
        rubro: z.string().optional(),
        setterAsignado: z.string().optional(),
        closer: z.string().optional(),
        notas: z.string().optional(),
        score: z.number().optional(),
        scoreLabel: z.enum(["HOT", "WARM", "TIBIO", "FRÍO"]).optional(),
        categoria: z.enum(["AGENDA", "LEAD"]).optional(),
        estadoLead: z.enum(["NUEVO", "CONTACTADO", "CALIFICADO", "DESCARTADO", "CONVERTIDO_AGENDA"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createLead(input as any);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ input }) => {
        await db.updateLead(input.id, input.data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLead(input.id);
        return { success: true };
      }),
    bulkDelete: publicProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ input }) => {
        await db.bulkDeleteLeads(input.ids);
        return { success: true, count: input.ids.length };
      }),
  }),

  // ==================== CONTACT ATTEMPTS ====================
  contactAttempts: router({
    list: publicProcedure
      .input(z.object({ leadId: z.number() }))
      .query(({ input }) => db.getContactAttempts(input.leadId)),

    firstForLeads: publicProcedure
      .input(z.object({ leadIds: z.array(z.number()) }))
      .query(({ input }) => db.getFirstContactAttemptForLeads(input.leadIds)),

    create: publicProcedure
      .input(z.object({
        leadId: z.number(),
        timestamp: z.string(),
        canal: z.enum(["LLAMADA", "WHATSAPP", "SMS", "EMAIL", "DM_INSTAGRAM", "OTRO"]),
        resultado: z.enum(["CONTESTÓ", "NO CONTESTÓ", "BUZÓN", "NÚMERO INVÁLIDO", "MENSAJE ENVIADO", "WHATSAPP LIMPIADO"]).optional(),
        notas: z.string().optional(),
        realizadoPor: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createContactAttempt({
          ...input,
          timestamp: new Date(input.timestamp),
        });
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteContactAttempt(input.id)),
  }),

  // ==================== LEADS NEEDING ATTENTION (48h alert) ====================
  leadsAlert: router({
    needingAttention: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(({ input }) => db.getLeadsNeedingAttention(input ?? undefined)),
  }),

  // ==================== LEAD COMMENTS (Team Communication) ====================
  comments: router({
    list: crmProcedure
      .input(z.object({ leadId: z.number() }))
      .query(({ input }) => db.getLeadComments(input.leadId)),

    latestForLeads: crmProcedure
      .input(z.object({ leadIds: z.array(z.number()) }))
      .query(({ input }) => db.getLatestCommentsForLeads(input.leadIds)),

    create: crmProcedure
      .input(z.object({
        leadId: z.number(),
        texto: z.string().min(1),
        leadName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = ctx.user!;
        // Parse @mentions from text
        const mentionRegex = /@\[([^\]]+)\]\((\d+)\)/g;
        const mentionedUserIds: number[] = [];
        let match;
        while ((match = mentionRegex.exec(input.texto)) !== null) {
          mentionedUserIds.push(parseInt(match[2]));
        }

        const commentId = await db.createLeadComment({
          leadId: input.leadId,
          userId: user.id,
          autor: user.name || user.email || "Usuario",
          autorRole: user.role,
          texto: input.texto,
          mentions: mentionedUserIds.length > 0 ? JSON.stringify(mentionedUserIds) : undefined,
        });

        // Create notifications for mentioned users
        if (mentionedUserIds.length > 0) {
          const leadLabel = input.leadName || `Lead #${input.leadId}`;
          const senderName = user.name || user.email || "Alguien";
          // Clean text for notification preview (remove mention markup)
          const cleanText = input.texto.replace(/@\[([^\]]+)\]\(\d+\)/g, "@$1");
          const preview = cleanText.length > 80 ? cleanText.slice(0, 80) + "..." : cleanText;

          for (const mentionedId of mentionedUserIds) {
            if (mentionedId !== user.id) { // Don't notify yourself
              await db.createNotification({
                userId: mentionedId,
                type: "mention",
                title: `${senderName} te mencionó en ${leadLabel}`,
                message: preview,
                leadId: input.leadId,
                commentId,
                fromUserId: user.id,
                fromUserName: senderName,
              });
            }
          }
        }

        return { success: true, id: commentId };
      }),

    update: crmProcedure
      .input(z.object({
        id: z.number(),
        texto: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        await db.updateLeadComment(input.id, input.texto);
        return { success: true };
      }),

    delete: crmProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLeadComment(input.id);
        return { success: true };
      }),

    /** Get all CRM users for @mention autocomplete */
    users: crmProcedure.query(() => db.getCrmUsers()),
  }),

  // ==================== NOTIFICATIONS ====================
  notifications: router({
    list: crmProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(({ ctx, input }) => db.getNotificationsForUser(ctx.user!.id, input?.limit ?? 50)),

    unreadCount: crmProcedure
      .query(({ ctx }) => db.getUnreadNotificationCount(ctx.user!.id)),

    markRead: crmProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.markNotificationRead(input.id, ctx.user!.id);
        return { success: true };
      }),

    markAllRead: crmProcedure
      .mutation(async ({ ctx }) => {
        await db.markAllNotificationsRead(ctx.user!.id);
        return { success: true };
      }),

    /** Poll for new notifications since a given timestamp */
    pollNew: crmProcedure
      .input(z.object({ since: z.string() })) // ISO date string
      .query(async ({ ctx, input }) => {
        const sinceDate = new Date(input.since);
        return db.getNewNotificationsSince(ctx.user!.id, sinceDate);
      }),
  }),

  // ==================== LEAD SCORING ====================
  scoring: router({
    list: publicProcedure
      .input(z.object({ scoreLabel: z.string().optional() }).optional())
      .query(({ input }) => db.getAllLeadScoring(input ?? undefined)),

    getByLeadId: publicProcedure
      .input(z.object({ leadId: z.number() }))
      .query(({ input }) => db.getLeadScoringByLeadId(input.leadId)),

    getByCorreo: publicProcedure
      .input(z.object({ correo: z.string() }))
      .query(({ input }) => db.getLeadScoringByCorreo(input.correo)),

    create: publicProcedure
      .input(z.object({
        leadId: z.number().optional(),
        correo: z.string().optional(),
        instagram: z.string().optional(),
        p1Frustracion: z.string().optional(),
        p2MarketingPrevio: z.string().optional(),
        p3Urgencia: z.string().optional(),
        p4TiempoOperando: z.string().optional(),
        p5Tratamientos: z.string().optional(),
        p6Impedimento: z.string().optional(),
        scoreP1: z.number().optional(),
        scoreP2: z.number().optional(),
        scoreP3: z.number().optional(),
        scoreP4: z.number().optional(),
        scoreP6: z.number().optional(),
        scoreTotal: z.number().optional(),
        scoreFinal: z.number().optional(),
        scoreLabel: z.enum(["HOT", "WARM", "TIBIO", "FRÍO"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createLeadScoring(input as any);
        return { id };
      }),
  }),

  // ==================== PROSPECT PROFILE (Universal Data) ====================
  prospectProfile: router({
    getByLeadId: publicProcedure
      .input(z.object({ leadId: z.number() }))
      .query(({ input }) => db.getLeadDataEntries(input.leadId)),

    getLatest: publicProcedure
      .input(z.object({ leadId: z.number(), source: z.string().optional() }))
      .query(({ input }) => db.getLatestLeadDataEntry(input.leadId, input.source)),
  }),

  // ==================== SETTER ACTIVITIES ====================
  setterActivities: router({
    list: publicProcedure
      .input(z.object({
        setter: z.string().optional(),
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(({ input }) => db.getSetterActivities(input ?? undefined)),

    create: publicProcedure
      .input(z.object({
        fecha: z.date(),
        mes: z.string().optional(),
        semana: z.number().optional(),
        setter: z.string().min(1),
        intentosLlamada: z.number().min(0).max(200).optional(),
        introsEfectivas: z.number().min(0).max(200).optional(),
        demosAseguradasConIntro: z.number().min(0).max(100).optional(),
        demosEnCalendario: z.number().min(0).max(100).optional(),
        demosConfirmadas: z.number().min(0).max(100).optional(),
        demosAsistidas: z.number().min(0).max(100).optional(),
        introAgendadas: z.number().min(0).max(100).optional(),
        introLive: z.number().min(0).max(100).optional(),
        introADemo: z.number().min(0).max(100).optional(),
        cierresAtribuidos: z.number().min(0).max(100).optional(),
        revenueAtribuido: z.string().optional(),
        cashAtribuido: z.string().optional(),
        notas: z.string().optional(),
        igConversacionesIniciadas: z.number().min(0).optional(),
        igRespuestasRecibidas: z.number().min(0).optional(),
        igCalificados: z.number().min(0).optional(),
        igAgendasEnviadas: z.number().min(0).optional(),
        igAgendasReservadas: z.number().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createSetterActivity(input as any);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ input }) => {
        await db.updateSetterActivity(input.id, input.data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSetterActivity(input.id);
        return { success: true };
      }),
    bulkDelete: publicProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ input }) => {
        await db.bulkDeleteSetterActivities(input.ids);
        return { success: true, count: input.ids.length };
      }),

    leaderboard: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(({ input }) => db.getSetterLeaderboard(input ?? undefined)),
  }),

  // ==================== CLOSER ACTIVITIES ====================
  closerActivities: router({
    list: publicProcedure
      .input(z.object({
        closer: z.string().optional(),
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(({ input }) => db.getCloserActivities(input ?? undefined)),

    create: publicProcedure
      .input(z.object({
        fecha: z.date(),
        mes: z.string().optional(),
        semana: z.number().optional(),
        closer: z.string().min(1),
        scheduleCalls: z.number().min(0).max(100).optional(),
        liveCalls: z.number().min(0).max(100).optional(),
        offers: z.number().min(0).max(100).optional(),
        deposits: z.number().min(0).max(100).optional(),
        closes: z.number().min(0).max(100).optional(),
        piffRevenue: z.string().optional(),
        piffCash: z.string().optional(),
        setupRevenue: z.string().optional(),
        setupCash: z.string().optional(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createCloserActivity(input as any);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ input }) => {
        await db.updateCloserActivity(input.id, input.data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCloserActivity(input.id);
        return { success: true };
      }),
    bulkDelete: publicProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
      .mutation(async ({ input }) => {
        await db.bulkDeleteCloserActivities(input.ids);
        return { success: true, count: input.ids.length };
      }),

    leaderboard: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(({ input }) => db.getCloserLeaderboard(input ?? undefined)),
  }),

  // ==================== DASHBOARD ====================
  dashboard: router({
    kpis: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(({ input }) => db.getDashboardKPIs(input ?? undefined)),

    monthlyMetrics: publicProcedure
      .input(z.object({ anio: z.number().optional() }).optional())
      .query(({ input }) => db.getMonthlyMetrics(input?.anio)),

    upsertMonthlyMetrics: publicProcedure
      .input(z.object({
        mes: z.string(),
        anio: z.number(),
        adSpend: z.string().optional(),
        totalLeads: z.number().optional(),
        totalLeadsRaw: z.number().optional(),
        visitasLandingPage: z.number().optional(),
        ctrUnico: z.string().optional(),
        ctr: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertMonthlyMetrics(input as any);
        return { success: true };
      }),

    marketingKPIs: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(({ input }) => db.getMarketingKPIs(input ?? undefined)),

    currentMonthMetrics: publicProcedure
      .query(() => db.getCurrentMonthMetrics()),

    trackerKPIs: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const [setter, closer] = await Promise.all([
          db.getSetterTrackerKPIs(input ?? undefined),
          db.getCloserTrackerKPIs(input ?? undefined),
        ]);
        return { setter, closer };
      }),

    validation: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(({ input }) => db.getDataValidation(input ?? undefined)),
  }),

  // ==================== CONSTRAINT DIAGNOSIS ====================
  diagnosis: router({
    run: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const [mkpi, dkpi] = await Promise.all([
          db.getMarketingKPIs(input ?? undefined),
          db.getDashboardKPIs(input ?? undefined),
        ]);
        if (!mkpi || !dkpi) return { metrics: [], constraints: [], summary: null };

        const adSpend = mkpi.adSpend || 0;
        const totalAgendas = Number(mkpi.totalAgendas) || 0;
        const contestados = Number(mkpi.contestados) || 0;
        const introsEfectivas = Number(mkpi.introsEfectivas) || 0;
        const triageCompletados = Number(mkpi.triageCompletados) || 0;
        const demosAsistidas = Number(mkpi.demosAsistidas) || 0;
        const ofertasHechas = Number(mkpi.ofertasHechas) || 0;
        const ventas = Number(mkpi.ventas) || 0;
        const totalRevenue = Number(mkpi.totalRevenue) || 0;
        const totalCash = Number(mkpi.totalCash) || 0;
        const totalLeadsRaw = mkpi.totalLeadsRaw || 0;
        const visitasLandingPage = mkpi.visitasLandingPage || 0;
        const ctrUnico = mkpi.ctrUnico || 0;

        // Calculate all metrics
        const cpl = totalLeadsRaw > 0 ? adSpend / totalLeadsRaw : 0;
        const cpb = totalAgendas > 0 ? adSpend / totalAgendas : 0;
        const cpbc = contestados > 0 ? adSpend / contestados : 0;
        const cps = demosAsistidas > 0 ? adSpend / demosAsistidas : 0;
        const cpa = ventas > 0 ? adSpend / ventas : 0;

        const landingOptIn = visitasLandingPage > 0 ? (totalLeadsRaw / visitasLandingPage) * 100 : 0;
        const leadToBooking = totalLeadsRaw > 0 ? (totalAgendas / totalLeadsRaw) * 100 : 0;
        const answerRate = totalAgendas > 0 ? (contestados / totalAgendas) * 100 : 0;
        const triageRate = contestados > 0 ? (triageCompletados / contestados) * 100 : 0;
        const showRate = triageCompletados > 0 ? (demosAsistidas / triageCompletados) * 100 : 0;
        const closeRate = demosAsistidas > 0 ? (ventas / demosAsistidas) * 100 : 0;
        const ufCashPercent = totalRevenue > 0 ? (totalCash / totalRevenue) * 100 : 0;
        const roasFrontEnd = adSpend > 0 ? totalCash / adSpend : 0;

        // Evaluate each metric against benchmarks
        const allBenchmarks = [...COST_BENCHMARKS, ...RATE_BENCHMARKS];
        const metricValues: Record<string, number> = {
          cpl, cpb, cpbc, cps, cpa,
          ctrUnico, landingOptIn, leadToBooking,
          answerRate, triageRate, showRate, closeRate,
          ufCashPercent, roasFrontEnd,
        };

        const metrics = allBenchmarks.map(bm => {
          const value = metricValues[bm.metric] ?? 0;
          const level = (adSpend === 0 && bm.unit === 'usd') ? 'good' as HealthLevel : evaluateMetric(value, bm);
          return {
            metric: bm.metric,
            label: bm.label,
            unit: bm.unit,
            value,
            level,
            color: HEALTH_COLORS[level],
            benchmark: bm,
          };
        });

        // Find active constraints (scenarios whose conditions are met)
        const constraints = CONSTRAINT_SCENARIOS.filter(scenario => {
          return scenario.conditions.every(cond => {
            const metricResult = metrics.find(m => m.metric === cond.metric);
            if (!metricResult) return false;
            return cond.level.includes(metricResult.level);
          });
        }).map(scenario => ({
          ...scenario,
          affectedMetrics: scenario.conditions.map(c => {
            const m = metrics.find(mm => mm.metric === c.metric);
            return m ? { metric: c.metric, label: m.label, value: m.value, level: m.level } : null;
          }).filter(Boolean),
        }));

        // Summary: primary constraint category
        const categoryPriority: ConstraintCategory[] = ['profitability', 'marketing', 'sales_setter', 'sales_closer'];
        const constraintCounts: Record<ConstraintCategory, number> = {
          marketing: 0, sales_setter: 0, sales_closer: 0, profitability: 0,
        };
        constraints.forEach(c => { constraintCounts[c.category]++; });
        const primaryConstraint = categoryPriority.find(cat => constraintCounts[cat] > 0) || null;

        // Count metrics by health level
        const healthCounts: Record<HealthLevel, number> = {
          excellent: 0, good: 0, watch: 0, borderline: 0, probCut: 0, cut: 0,
        };
        metrics.forEach(m => { healthCounts[m.level]++; });

        // Detect if there's insufficient data for meaningful diagnosis
        const hasMinimumData = (totalAgendas >= 5 || totalLeadsRaw >= 5 || adSpend > 0);

        const summary = {
          totalMetrics: metrics.length,
          healthCounts,
          constraintCount: constraints.length,
          primaryConstraint,
          hasMinimumData,
          overallHealth: !hasMinimumData ? 'noData' as const
            : healthCounts.cut > 0 ? 'critical' as const
            : healthCounts.probCut > 0 ? 'warning' as const
            : healthCounts.borderline > 0 ? 'caution' as const
            : 'healthy' as const,
          rawData: {
            adSpend, totalAgendas, contestados, introsEfectivas,
            triageCompletados, demosAsistidas, ofertasHechas, ventas,
            totalRevenue, totalCash, totalLeadsRaw, visitasLandingPage,
          },
        };

        return { metrics, constraints, summary };
      }),
  }),

  // ==================== FILTERS ====================
  filters: router({
    distinctValues: publicProcedure.query(() => db.getDistinctValues()),
  }),

  // ==================== API KEYS ====================
  apiKeys: router({
    list: publicProcedure.query(async () => {
      return listApiKeys();
    }),
    create: publicProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ input }) => {
        return createApiKey(input.name);
      }),
    revoke: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return revokeApiKey(input.id);
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteApiKey(input.id);
      }),
   }),

  // ==================== CLOSER PROJECTIONS ====================
  closerProjections: router({
    list: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        anio: z.number().optional(),
        closer: z.string().optional(),
      }).optional())
      .query(({ input }) => db.getCloserProjections(input ?? undefined)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getCloserProjectionById(input.id)),

    getWithActuals: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getCloserProjectionWithActuals(input.id)),

    create: publicProcedure
      .input(z.object({
        closer: z.string(),
        semana: z.number(),
        mes: z.string(),
        anio: z.number(),
        weekStarting: z.date().optional(),
        weekEnding: z.date().optional(),
        scheduledCallsTarget: z.number().optional(),
        showRateTarget: z.string().optional(),
        offerRateTarget: z.string().optional(),
        closeRateTarget: z.string().optional(),
        bloodGoalCloses: z.number().optional(),
        bloodGoalRevenue: z.string().optional(),
        bloodGoalCash: z.string().optional(),
        stretchGoalCloses: z.number().optional(),
        stretchGoalRevenue: z.string().optional(),
        stretchGoalCash: z.string().optional(),
      }))
      .mutation(({ input }) => db.createCloserProjection(input as any)),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.record(z.string(), z.any()),
      }))
      .mutation(({ input }) => db.updateCloserProjection(input.id, input.data as any)),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteCloserProjection(input.id)),

  }),

  // ==================== SETTER PROJECTIONS ====================
  setterProjections: router({
    list: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        anio: z.number().optional(),
        setter: z.string().optional(),
      }).optional())
      .query(({ input }) => db.getSetterProjections(input ?? undefined)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getSetterProjectionById(input.id)),

    getWithActuals: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getSetterProjectionWithActuals(input.id)),

    create: publicProcedure
      .input(z.object({
        setter: z.string(),
        semana: z.number(),
        mes: z.string(),
        anio: z.number(),
        weekStarting: z.date().optional(),
        weekEnding: z.date().optional(),
        intentosLlamadaTarget: z.number().optional(),
        introsEfectivasTarget: z.number().optional(),
        demosAseguradasTarget: z.number().optional(),
        demosCalendarioTarget: z.number().optional(),
        demosConfirmadasTarget: z.number().optional(),
        demosAsistidasTarget: z.number().optional(),
        bloodGoalDemosAsistidas: z.number().optional(),
        bloodGoalCierres: z.number().optional(),
        bloodGoalRevenue: z.string().optional(),
        bloodGoalCash: z.string().optional(),
        stretchGoalDemosAsistidas: z.number().optional(),
        stretchGoalCierres: z.number().optional(),
        stretchGoalRevenue: z.string().optional(),
        stretchGoalCash: z.string().optional(),
      }))
      .mutation(({ input }) => db.createSetterProjection(input as any)),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.record(z.string(), z.any()),
      }))
      .mutation(({ input }) => db.updateSetterProjection(input.id, input.data as any)),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteSetterProjection(input.id)),

  }),

  // ==================== P9: WEIGHTED LEADERBOARD ====================
  weightedLeaderboard: router({
    setters: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
        weights: z.object({
          intentos: z.number().optional(),
          intros: z.number().optional(),
          asistidas: z.number().optional(),
          cierres: z.number().optional(),
          revenue: z.number().optional(),
        }).optional(),
      }).optional())
      .query(({ input }) => db.getWeightedSetterLeaderboard(
        { mes: input?.mes, semana: input?.semana },
        input?.weights ?? undefined
      )),

    closers: publicProcedure
      .input(z.object({
        mes: z.string().optional(),
        semana: z.number().optional(),
        weights: z.object({
          closes: z.number().optional(),
          revenue: z.number().optional(),
          cash: z.number().optional(),
          closeRate: z.number().optional(),
          showRate: z.number().optional(),
        }).optional(),
      }).optional())
      .query(({ input }) => db.getWeightedCloserLeaderboard(
        { mes: input?.mes, semana: input?.semana },
        input?.weights ?? undefined
      )),
  }),

  // ==================== P2: TEAM SUMMARY ====================
  teamSummary: router({
    setters: publicProcedure
      .input(z.object({ anio: z.number().optional() }).optional())
      .query(({ input }) => db.getSetterTeamSummaryByMonth(input?.anio)),

    closers: publicProcedure
      .input(z.object({ anio: z.number().optional() }).optional())
      .query(({ input }) => db.getCloserTeamSummaryByMonth(input?.anio)),
  }),

  // ==================== P6: REP PROFILE ====================
  repProfile: router({
    setter: publicProcedure
      .input(z.object({ setter: z.string() }))
      .query(({ input }) => db.getSetterRepProfile(input.setter)),

    closer: publicProcedure
      .input(z.object({ closer: z.string() }))
      .query(({ input }) => db.getCloserRepProfile(input.closer)),
  }),

  // ==================== P5: SMART ALERTS ====================
  alerts: router({
    list: publicProcedure.query(() => db.getSmartAlerts()),
  }),

  // ==================== FOLLOW-UPS (E-ID System) ====================
  followUps: router({
    list: publicProcedure
      .input(z.object({
        tipo: z.string().optional(),
        estado: z.string().optional(),
        closerAsignado: z.string().optional(),
        prioridad: z.string().optional(),
      }).optional())
      .query(({ input }) => db.getFollowUps(input ?? undefined)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getFollowUpById(input.id)),

    create: publicProcedure
      .input(z.object({
        leadId: z.number().optional(),
        nombre: z.string().optional(),
        correo: z.string().optional(),
        telefono: z.string().optional(),
        instagram: z.string().optional(),
        facebook: z.string().optional(),
        tipo: z.enum(["HOT", "WARM"]).optional(),
        prioridad: z.enum(["RED_HOT", "HOT", "WARM", "COLD"]).optional(),
        ultimaObjecion: z.string().optional(),
        montoEstimado: z.string().optional(),
        productoInteres: z.enum(["PIF", "SETUP_MONTHLY", "POR_DEFINIR"]).optional(),
        proximoFollowUp: z.date().optional(),
        closerAsignado: z.string().optional(),
        notas: z.string().optional(),
        linkCRM: z.string().optional(),
        creadoDesde: z.enum(["MANUAL", "CITAS", "SCORING"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createFollowUp(input as any);
        return { id };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        data: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ input }) => {
        await db.updateFollowUp(input.id, input.data);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteFollowUp(input.id);
        return { success: true };
      }),

    stats: publicProcedure.query(() => db.getFollowUpStats()),

    createFromLead: publicProcedure
      .input(z.object({
        leadId: z.number(),
        closerAsignado: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createFollowUpFromLead(input.leadId, input.closerAsignado);
        return { id };
      }),

    // Protocolo No-Show: marca asistencia NO SHOW, crea follow-up RED_HOT y registra log
    noShow: publicProcedure
      .input(z.object({
        leadId: z.number(),
        closerAsignado: z.string().optional(),
        notas: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const followUpId = await db.createFollowUpFromNoShow(input.leadId, input.closerAsignado, input.notas);
        return { followUpId };
      }),

    // Log a follow-up interaction
    logActivity: publicProcedure
      .input(z.object({
        followUpId: z.number(),
        accion: z.enum(["LLAMADA", "WHATSAPP", "EMAIL", "DM_INSTAGRAM", "DM_FACEBOOK", "NOTA", "CAMBIO_TIPO", "CAMBIO_ESTADO", "REAGENDADO"]),
        detalle: z.string().optional(),
        realizadoPor: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createFollowUpLog(input as any);
        return { id };
      }),

    getLogs: publicProcedure
      .input(z.object({ followUpId: z.number() }))
      .query(({ input }) => db.getFollowUpLogs(input.followUpId)),
  }),

  // ==================== CALL AUDITS ====================
  callAudits: router({
    list: publicProcedure
      .input(z.object({
        closer: z.string().optional(),
        manualReview: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(({ input }) => db.getCallAudits(input ?? undefined)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getCallAuditById(input.id)),
    getByLeadId: publicProcedure
      .input(z.object({ leadId: z.number() }))
      .query(({ input }) => db.getCallAuditsByLeadId(input.leadId)),
    stats: publicProcedure.query(() => db.getCallAuditStats()),
    updateReview: publicProcedure
      .input(z.object({
        id: z.number(),
        manualReview: z.enum(["PENDIENTE", "REVISADA", "ACCIONADA"]).optional(),
        manualNotes: z.string().optional(),
        actionItems: z.array(z.object({
          text: z.string(),
          done: z.boolean().optional(),
        })).optional(),
        reviewedBy: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateCallAuditReview(id, {
          ...data,
          actionItems: data.actionItems ? data.actionItems : undefined,
        });
      }),
    reanalyze: crmProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const audit = await db.getCallAuditById(input.id);
        if (!audit) throw new Error("Auditoria no encontrada");
        if (!audit.recordingTranscript) throw new Error("No hay transcripcion disponible para reanalizar");
        await reanalyzeTranscript(audit.id, audit.recordingTranscript);
        return { success: true };
      }),
  }),

  // ==================== META ADS & ATTRIBUTION ====================
  metaAds: router({
    /** Validate the Meta Ads API token */
    validateToken: publicProcedure.query(() => metaAds.validateToken()),

    /** Sync campaigns, adsets, ads metadata from Meta */
    syncStructure: publicProcedure.mutation(async () => {
      const campaigns = await metaAds.fetchCampaigns();
      for (const c of campaigns) {
        await db.upsertAdCampaign({ campaignId: c.id, name: c.name, status: c.status, objective: c.objective });
      }
      const adsets = await metaAds.fetchAdsets();
      for (const a of adsets) {
        await db.upsertAdAdset({ adsetId: a.id, campaignId: a.campaign_id, name: a.name, status: a.status });
      }
      const ads = await metaAds.fetchAds();
      for (const ad of ads) {
        await db.upsertAdAd({ adId: ad.id, adsetId: ad.adset_id, campaignId: ad.campaign_id, name: ad.name, status: ad.status, urlTags: ad.url_tags });
      }
      return { campaigns: campaigns.length, adsets: adsets.length, ads: ads.length };
    }),

    /** Sync daily insights from Meta Ads API */
    syncInsights: publicProcedure
      .input(z.object({
        dateFrom: z.string(),
        dateTo: z.string(),
        level: z.enum(["campaign", "adset", "ad"]).default("ad"),
      }))
      .mutation(async ({ input }) => {
        const insights = await metaAds.fetchInsights(input.dateFrom, input.dateTo, input.level);
        let synced = 0;
        for (const row of insights) {
          await db.upsertAdMetricDaily({
            fecha: row.fecha,
            campaignId: row.campaignId,
            campaignName: row.campaignName,
            adsetId: row.adsetId,
            adsetName: row.adsetName,
            adId: row.adId,
            adName: row.adName,
            impressions: row.impressions,
            clicks: row.clicks,
            spend: String(row.spend),
            reach: row.reach,
            leads: row.leads,
            linkClicks: row.linkClicks,
            ctr: String(row.ctr),
            cpc: String(row.cpc),
            cpl: String(row.cpl),
            costPerResult: String(row.costPerResult),
          });
          synced++;
        }
        return { synced, total: insights.length };
      }),

    /** Get cached campaigns from DB */
    campaigns: publicProcedure.query(() => db.getAdCampaigns()),

    /** Get cached adsets from DB */
    adsets: publicProcedure
      .input(z.object({ campaignId: z.string().optional() }).optional())
      .query(({ input }) => db.getAdAdsets(input?.campaignId)),

    /** Get cached ads from DB */
    ads: publicProcedure
      .input(z.object({ campaignId: z.string().optional(), adsetId: z.string().optional() }).optional())
      .query(({ input }) => db.getAdAds(input ?? undefined)),

    /** Get daily metrics with filters */
    metricsDaily: publicProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        campaignId: z.string().optional(),
        adsetId: z.string().optional(),
        adId: z.string().optional(),
      }).optional())
      .query(({ input }) => db.getAdMetricsDaily(input ?? undefined)),

    /** Get metrics aggregated by campaign */
    metricsByCampaign: publicProcedure
      .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
      .query(({ input }) => db.getAdMetricsByCampaign(input?.dateFrom, input?.dateTo)),

    /** Get metrics aggregated by adset (drill-down) */
    metricsByAdset: publicProcedure
      .input(z.object({ campaignId: z.string(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(({ input }) => db.getAdMetricsByAdset(input.campaignId, input.dateFrom, input.dateTo)),

    /** Get metrics aggregated by ad (most granular) */
    metricsByAd: publicProcedure
      .input(z.object({ adsetId: z.string(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
      .query(({ input }) => db.getAdMetricsByAd(input.adsetId, input.dateFrom, input.dateTo)),

    /** Get daily spend trend for charts */
    spendTrend: publicProcedure
      .input(z.object({ dateFrom: z.string(), dateTo: z.string() }))
      .query(({ input }) => db.getAdSpendTrend(input.dateFrom, input.dateTo)),

    /** Check UTM status of active ads */
    utmStatus: publicProcedure.query(() => metaAds.checkUtmStatus()),

    /** Get recommended UTM tags */
    recommendedUtmTags: publicProcedure.query(() => ({ tags: metaAds.getRecommendedUtmTags() })),

    /** Trigger a manual full sync (structure + insights) */
    fullSync: publicProcedure.mutation(async () => {
      return performFullSync("meta_ads_manual");
    }),

    /** Get sync history logs */
    syncLogs: publicProcedure
      .input(z.object({ limit: z.number().default(20) }).optional())
      .query(({ input }) => db.getSyncLogs(input?.limit ?? 20)),

    /** Get last successful sync info */
    lastSync: publicProcedure.query(async () => {
      const autoSync = await db.getLastSyncLog("meta_ads_auto");
      const manualSync = await db.getLastSyncLog("meta_ads_manual");
      const lastAny = await db.getLastSyncLog();
      return { autoSync, manualSync, lastAny };
    }),
  }),

  // ==================== ATTRIBUTION ====================
  attribution: router({
    /** Get lead attribution data grouped by UTM campaign */
    byCampaign: publicProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        campaignId: z.string().optional(),
      }).optional())
      .query(({ input }) => db.getLeadAttribution(input ?? undefined)),

    /** Get lead count by UTM campaign */
    leadCountByCampaign: publicProcedure
      .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
      .query(({ input }) => db.getLeadCountByUtmCampaign(input?.dateFrom, input?.dateTo)),
  }),

  // ==================== SETTER WORK QUEUE ====================
  workQueue: router({
    /** Get prioritized work queue for setter */
    list: publicProcedure
      .input(z.object({ setter: z.string().optional() }).optional())
      .query(({ input }) => db.getSetterWorkQueue(input?.setter)),
  }),

  // ==================== CONFIRMATION WORKFLOW ====================
  confirmations: router({
    /** Get confirmation queue grouped by urgency */
    queue: publicProcedure
      .input(z.object({ setter: z.string().optional() }).optional())
      .query(({ input }) => db.getConfirmationQueue(input?.setter)),
  }),
  // ==================== TEAM MEMBERS ====================
  team: router({
    /** List team members with optional role/active filters */
    list: publicProcedure
      .input(z.object({
        rol: z.string().optional(),
        activo: z.boolean().optional(),
      }).optional())
      .query(({ input }) => db.getTeamMembers(input ?? undefined)),
    /** Create a new team member */
    create: publicProcedure
      .input(z.object({
        nombre: z.string().min(1),
        rol: z.enum(["SETTER", "CLOSER", "SETTER_CLOSER"]),
        correo: z.string().optional(),
        telefono: z.string().optional(),
      }))
      .mutation(({ input }) => db.createTeamMember(input)),
    /** Update a team member */
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().optional(),
        rol: z.enum(["SETTER", "CLOSER", "SETTER_CLOSER"]).optional(),
        activo: z.boolean().optional(),
        correo: z.string().optional(),
        telefono: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateTeamMember(id, data);
      }),
    /** Delete a team member */
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteTeamMember(input.id)),
  }),

  // ==================== ACCESS CONTROL ====================
  access: router({
    /** List all allowed emails (admin only) */
    listAllowed: adminProcedure.query(() => db.getAllowedEmails()),

    /** Create a new allowed email (admin only) */
    createAllowed: adminProcedure
      .input(z.object({
        email: z.string().email(),
        role: z.enum(["admin", "setter", "closer"]),
        nombre: z.string().optional(),
      }))
      .mutation(({ input }) => db.createAllowedEmail(input)),

    /** Update an allowed email (admin only) */
    updateAllowed: adminProcedure
      .input(z.object({
        id: z.number(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "setter", "closer"]).optional(),
        nombre: z.string().optional(),
        activo: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateAllowedEmail(id, data);
      }),

    /** Delete an allowed email (admin only) */
    deleteAllowed: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteAllowedEmail(input.id)),

    /** List all users who have logged in (admin only) */
    listUsers: adminProcedure.query(() => db.getAllUsers()),

    /** Check if current user has CRM access */
    checkAccess: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return { hasAccess: false, role: null };
      const crmRoles = ["admin", "setter", "closer"];
      return {
        hasAccess: crmRoles.includes(ctx.user.role),
        role: ctx.user.role,
      };
    }),
  }),

  // ==================== REVENUE CALCULATOR ====================
  calculator: router({
    /** Calculate funnel metrics without saving */
    calculate: crmProcedure
      .input(z.object({
        mode: z.enum(["reverse", "forward"]),
        revenueGoal: z.number().optional(),
        adSpendInput: z.number().optional(),
        ticketPromedio: z.number().min(1),
        upfrontCashPct: z.number().min(0).max(100),
        closeRate: z.number().min(0.1).max(100),
        showRate: z.number().min(0.1).max(100),
        confirmationRate: z.number().min(0.1).max(100),
        answerRate: z.number().min(0.1).max(100),
        bookingRate: z.number().min(0.1).max(100),
        landingConvRate: z.number().min(0.1).max(100),
        ctr: z.number().min(0.01).max(100),
        cpm: z.number().min(0.01),
        setterCapacity: z.number().min(1).default(100),
        closerCapacity: z.number().min(1).default(80),
        setterMonthlyCost: z.number().min(0).default(0),
        closerMonthlyCost: z.number().min(0).default(0),
      }))
      .mutation(({ input }) => {
        return db.calculateFunnel(input);
      }),

    /** Save a scenario */
    save: crmProcedure
      .input(z.object({
        name: z.string().min(1).max(200),
        mode: z.enum(["reverse", "forward"]),
        revenueGoal: z.number().optional(),
        adSpendInput: z.number().optional(),
        ticketPromedio: z.number(),
        upfrontCashPct: z.number(),
        closeRate: z.number(),
        showRate: z.number(),
        confirmationRate: z.number(),
        answerRate: z.number(),
        bookingRate: z.number(),
        landingConvRate: z.number(),
        ctr: z.number(),
        cpm: z.number(),
        setterCapacity: z.number().default(100),
        closerCapacity: z.number().default(80),
        setterMonthlyCost: z.number().default(0),
        closerMonthlyCost: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        const calculated = db.calculateFunnel(input);
        const scenarioData = {
          ...input,
          userId: ctx.user.id,
          revenueGoal: input.revenueGoal?.toString() ?? null,
          adSpendInput: input.adSpendInput?.toString() ?? null,
          ticketPromedio: input.ticketPromedio.toString(),
          upfrontCashPct: input.upfrontCashPct.toString(),
          closeRate: input.closeRate.toString(),
          showRate: input.showRate.toString(),
          confirmationRate: input.confirmationRate.toString(),
          answerRate: input.answerRate.toString(),
          bookingRate: input.bookingRate.toString(),
          landingConvRate: input.landingConvRate.toString(),
          ctr: input.ctr.toString(),
          cpm: input.cpm.toString(),
          setterMonthlyCost: (input.setterMonthlyCost ?? 0).toString(),
          closerMonthlyCost: (input.closerMonthlyCost ?? 0).toString(),
          // Calculated fields
          clientesNecesarios: calculated.clientesNecesarios,
          demosNecesarias: calculated.demosNecesarias,
          agendasConfirmadas: calculated.agendasConfirmadas,
          agendasTotales: calculated.agendasTotales,
          leadsContactados: calculated.leadsContactados,
          leadsTotales: calculated.leadsTotales,
          clicksNecesarios: calculated.clicksNecesarios,
          impresionesNecesarias: calculated.impresionesNecesarias,
          adSpendCalculated: calculated.adSpendCalculated.toString(),
          cpl: calculated.cpl.toString(),
          cpb: calculated.cpb.toString(),
          cpa: calculated.cpa.toString(),
          cac: calculated.cac.toString(),
          roas: calculated.roas.toString(),
          cashCollected: calculated.cashCollected.toString(),
          contractedRevenue: calculated.contractedRevenue.toString(),
          revenueCalculated: calculated.revenueCalculated.toString(),
          settersNecesarios: calculated.settersNecesarios.toString(),
          closersNecesarios: calculated.closersNecesarios.toString(),
          presupuestoMensual: calculated.presupuestoMensual.toString(),
          presupuestoDiario: calculated.presupuestoDiario.toString(),
        };
        const result = await db.createRevenueScenario(scenarioData as any);
        return { id: result.id, ...calculated };
      }),

    /** List all scenarios */
    list: crmProcedure.query(async () => {
      return db.getRevenueScenarios();
    }),

    /** Get a single scenario */
    get: crmProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getRevenueScenarioById(input.id);
      }),

    /** Delete a scenario */
    delete: crmProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteRevenueScenario(input.id);
        return { success: true };
      }),
  }),

  // ==================== INSTAGRAM FUNNEL ====================
  instagramFunnel: router({
    kpis: crmProcedure
      .input(z.object({ mes: z.string().optional(), semana: z.number().optional() }).optional())
      .query(async ({ input }) => db.getInstagramFunnelKPIs(input ?? undefined)),
    setterPerformance: crmProcedure
      .input(z.object({ mes: z.string().optional(), semana: z.number().optional() }).optional())
      .query(async ({ input }) => db.getSetterIgPerformance(input ?? undefined)),
    events: crmProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => db.getManychatEvents(input?.limit ?? 50)),
  }),

  ai: router({
    chat: crmProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const { invokeChatLLM } = await import("./_core/llm");
        const result = await invokeChatLLM({ messages: input.messages });
        return { content: result.content };
      }),
  }),
});
export type AppRouter = typeof appRouter;
