import { eq, desc, and, gte, lte, sql, asc, isNull, isNotNull, count } from "drizzle-orm";
import { getDb } from "./db";
import {
  clinicOrganizations, InsertClinicOrganization,
  clinicPatients, InsertClinicPatient, ClinicPatient,
  clinicProducts, InsertClinicProduct,
  clinicUserProfiles,
  clinicUserRoles,
  clinicLossReasons, InsertClinicLossReason,
  lossSubcategories,
  clinicPaymentNotifications,
  clinicWebhookLogs,
  clinicFailedWebhooks,
} from "../drizzle/schema";

// ==================== PATIENTS ====================

export async function getPatients(orgId: string, filters?: {
  status?: string;
  ownerId?: string;
  from?: Date;
  to?: Date;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(clinicPatients.organizationId, orgId), isNull(clinicPatients.archivedAt)];

  if (filters?.status) {
    conditions.push(eq(clinicPatients.status, filters.status as any));
  }
  if (filters?.ownerId) {
    conditions.push(eq(clinicPatients.ownerId, filters.ownerId));
  }
  if (filters?.from) {
    conditions.push(gte(clinicPatients.createdAt, filters.from));
  }
  if (filters?.to) {
    conditions.push(lte(clinicPatients.createdAt, filters.to));
  }

  return db
    .select()
    .from(clinicPatients)
    .where(and(...conditions))
    .orderBy(desc(clinicPatients.createdAt));
}

export async function getPatientById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(clinicPatients)
    .where(eq(clinicPatients.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function createPatient(data: InsertClinicPatient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .insert(clinicPatients)
    .values(data)
    .returning({ id: clinicPatients.id });

  return rows[0].id;
}

export async function updatePatient(id: string, data: Partial<InsertClinicPatient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(clinicPatients)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clinicPatients.id, id));

  return { success: true };
}

export async function archivePatient(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(clinicPatients)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(clinicPatients.id, id));

  return { success: true };
}

// ==================== PRODUCTS ====================

export async function getProducts(orgId: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(clinicProducts)
    .where(eq(clinicProducts.organizationId, orgId))
    .orderBy(asc(clinicProducts.name));
}

export async function getProductById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(clinicProducts)
    .where(eq(clinicProducts.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function createProduct(data: InsertClinicProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .insert(clinicProducts)
    .values(data)
    .returning({ id: clinicProducts.id });

  return rows[0].id;
}

export async function updateProduct(id: string, data: Partial<InsertClinicProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(clinicProducts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clinicProducts.id, id));

  return { success: true };
}

export async function deleteProduct(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(clinicProducts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(clinicProducts.id, id));

  return { success: true };
}

// ==================== ANALYTICS ====================

export async function getClinicaKPIs(orgId: string, dateRange?: { from?: Date; to?: Date }, ownerId?: string) {
  const db = await getDb();
  if (!db) return { totalPatients: 0, totalRevenue: 0, attendanceRate: 0, conversionRate: 0, upsellRevenue: 0, avgDealValue: 0 };

  const conditions = [eq(clinicPatients.organizationId, orgId), isNull(clinicPatients.archivedAt)];
  if (dateRange?.from) conditions.push(gte(clinicPatients.createdAt, dateRange.from));
  if (dateRange?.to) conditions.push(lte(clinicPatients.createdAt, dateRange.to));
  if (ownerId) conditions.push(eq(clinicPatients.ownerId, ownerId));

  const patients = await db
    .select()
    .from(clinicPatients)
    .where(and(...conditions));

  const total = patients.length;
  const attended = patients.filter(p => p.attended === true).length;
  const purchased = patients.filter(p => p.purchased === true).length;

  const totalRevenue = patients.reduce((sum, p) => {
    let rev = Number(p.initialAmount) || 0;
    if (p.purchased && p.upsellPrice) rev += Number(p.upsellPrice) || 0;
    return sum + rev;
  }, 0);

  const upsellRevenue = patients.reduce((sum, p) => {
    if (p.purchased && p.upsellPrice) return sum + (Number(p.upsellPrice) || 0);
    return sum;
  }, 0);

  return {
    totalPatients: total,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    attendanceRate: total > 0 ? Math.round((attended / total) * 100 * 10) / 10 : 0,
    conversionRate: attended > 0 ? Math.round((purchased / attended) * 100 * 10) / 10 : 0,
    upsellRevenue: Math.round(upsellRevenue * 100) / 100,
    avgDealValue: purchased > 0 ? Math.round((totalRevenue / purchased) * 100) / 100 : 0,
  };
}

export async function getRevenueMetrics(orgId: string) {
  const db = await getDb();
  if (!db) return { realizedRevenue: 0, contractedRevenue: 0, totalPipeline: 0 };

  const patients = await db
    .select()
    .from(clinicPatients)
    .where(and(eq(clinicPatients.organizationId, orgId), isNull(clinicPatients.archivedAt)));

  const realized = patients
    .filter(p => p.status === "completed" && p.purchased)
    .reduce((sum, p) => sum + (Number(p.initialAmount) || 0) + (Number(p.upsellPrice) || 0), 0);

  const contracted = patients
    .filter(p => p.attended && p.purchased)
    .reduce((sum, p) => sum + (Number(p.initialAmount) || 0) + (Number(p.upsellPrice) || 0), 0);

  const pipeline = patients
    .reduce((sum, p) => sum + (Number(p.initialAmount) || 0), 0);

  return {
    realizedRevenue: Math.round(realized * 100) / 100,
    contractedRevenue: Math.round(contracted * 100) / 100,
    totalPipeline: Math.round(pipeline * 100) / 100,
  };
}

export async function getConversionFunnel(orgId: string, dateRange?: { from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return { total: 0, attended: 0, purchased: 0, upselled: 0 };

  const conditions = [eq(clinicPatients.organizationId, orgId), isNull(clinicPatients.archivedAt)];
  if (dateRange?.from) conditions.push(gte(clinicPatients.createdAt, dateRange.from));
  if (dateRange?.to) conditions.push(lte(clinicPatients.createdAt, dateRange.to));

  const patients = await db
    .select()
    .from(clinicPatients)
    .where(and(...conditions));

  return {
    total: patients.length,
    attended: patients.filter(p => p.attended === true).length,
    purchased: patients.filter(p => p.purchased === true).length,
    upselled: patients.filter(p => p.upsellDecision === "completed").length,
  };
}

export async function getOwnerPerformance(orgId: string, dateRange?: { from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(clinicPatients.organizationId, orgId), isNull(clinicPatients.archivedAt), isNotNull(clinicPatients.ownerId)];
  if (dateRange?.from) conditions.push(gte(clinicPatients.createdAt, dateRange.from));
  if (dateRange?.to) conditions.push(lte(clinicPatients.createdAt, dateRange.to));

  const patients = await db
    .select()
    .from(clinicPatients)
    .where(and(...conditions));

  // Group by owner
  const byOwner = new Map<string, ClinicPatient[]>();
  for (const p of patients) {
    const key = p.ownerId || "unassigned";
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key)!.push(p);
  }

  return Array.from(byOwner.entries()).map(([ownerId, pts]) => {
    const total = pts.length;
    const attended = pts.filter(p => p.attended === true).length;
    const purchased = pts.filter(p => p.purchased === true).length;
    const revenue = pts.reduce((sum, p) => {
      let rev = Number(p.initialAmount) || 0;
      if (p.purchased && p.upsellPrice) rev += Number(p.upsellPrice) || 0;
      return sum + rev;
    }, 0);

    return {
      ownerId,
      totalPatients: total,
      attended,
      purchased,
      attendanceRate: total > 0 ? Math.round((attended / total) * 100 * 10) / 10 : 0,
      conversionRate: attended > 0 ? Math.round((purchased / attended) * 100 * 10) / 10 : 0,
      totalRevenue: Math.round(revenue * 100) / 100,
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export async function getLossReasons(orgId: string, dateRange?: { from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(clinicLossReasons.organizationId, orgId)];
  if (dateRange?.from) conditions.push(gte(clinicLossReasons.createdAt, dateRange.from));
  if (dateRange?.to) conditions.push(lte(clinicLossReasons.createdAt, dateRange.to));

  return db
    .select()
    .from(clinicLossReasons)
    .where(and(...conditions))
    .orderBy(desc(clinicLossReasons.createdAt));
}

export async function createLossReason(data: InsertClinicLossReason) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Also mark patient as having loss reason captured
  await db
    .update(clinicPatients)
    .set({ lossReasonCaptured: true, updatedAt: new Date() })
    .where(eq(clinicPatients.id, data.patientId));

  const rows = await db
    .insert(clinicLossReasons)
    .values(data)
    .returning({ id: clinicLossReasons.id });

  return rows[0].id;
}

export async function getRevenueChart(orgId: string, dateRange?: { from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(clinicPatients.organizationId, orgId),
    isNull(clinicPatients.archivedAt),
    eq(clinicPatients.purchased, true),
  ];
  if (dateRange?.from) conditions.push(gte(clinicPatients.createdAt, dateRange.from));
  if (dateRange?.to) conditions.push(lte(clinicPatients.createdAt, dateRange.to));

  const rows = await db
    .select({
      date: sql<string>`DATE(${clinicPatients.createdAt})`.as("date"),
      revenue: sql<number>`SUM(COALESCE(${clinicPatients.initialAmount}::numeric, 0) + COALESCE(${clinicPatients.upsellPrice}::numeric, 0))`.as("revenue"),
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(clinicPatients)
    .where(and(...conditions))
    .groupBy(sql`DATE(${clinicPatients.createdAt})`)
    .orderBy(asc(sql`DATE(${clinicPatients.createdAt})`));

  return rows;
}

// ==================== MEMBERS ====================

export async function getClinicaMembers(orgId: string) {
  const db = await getDb();
  if (!db) return [];

  const profiles = await db
    .select()
    .from(clinicUserProfiles)
    .where(eq(clinicUserProfiles.organizationId, orgId));

  const roles = await db
    .select()
    .from(clinicUserRoles)
    .where(eq(clinicUserRoles.organizationId, orgId));

  const roleMap = new Map(roles.map(r => [r.userId, r.role]));

  return profiles.map(p => ({
    ...p,
    role: roleMap.get(p.userId) ?? "member",
  }));
}

// ==================== ORGANIZATIONS ====================

export async function getOrganization(orgId: string) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(clinicOrganizations)
    .where(eq(clinicOrganizations.id, orgId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getOrganizationByWebhookToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(clinicOrganizations)
    .where(eq(clinicOrganizations.webhookToken, token))
    .limit(1);

  return rows[0] ?? null;
}

export async function getDefaultOrganization() {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(clinicOrganizations)
    .limit(1);

  return rows[0] ?? null;
}

// ==================== LOSS SUBCATEGORIES ====================

export async function getLossSubcategories() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(lossSubcategories)
    .orderBy(asc(lossSubcategories.category), asc(lossSubcategories.displayOrder));
}

// ==================== WEBHOOK LOGS ====================

export async function createWebhookLog(data: {
  organizationId: string;
  action: string;
  patientData: Record<string, any>;
  status: string;
}) {
  const db = await getDb();
  if (!db) return;

  await db.insert(clinicWebhookLogs).values({
    organizationId: data.organizationId,
    action: data.action,
    patientData: data.patientData,
    status: data.status,
  });
}

export async function createFailedWebhook(data: {
  organizationId: string;
  webhookData: Record<string, any>;
  errorMessage: string;
}) {
  const db = await getDb();
  if (!db) return;

  // First create a webhook log entry for the failed attempt
  const logRows = await db.insert(clinicWebhookLogs).values({
    organizationId: data.organizationId,
    action: "error",
    patientData: data.webhookData,
    status: "error",
    errorMessage: data.errorMessage,
  }).returning({ id: clinicWebhookLogs.id });

  const webhookLogId = logRows[0]?.id;
  if (!webhookLogId) return;

  await db.insert(clinicFailedWebhooks).values({
    organizationId: data.organizationId,
    webhookLogId,
    webhookData: data.webhookData,
    errorMessage: data.errorMessage,
    status: "pending",
    nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // retry in 5 minutes
  });
}
