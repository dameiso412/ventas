/**
 * Role-based permissions for the CRM.
 * Shared between frontend (navigation filtering) and backend (route protection).
 */

export type CrmRole = "admin" | "setter" | "closer";

/**
 * Each route entry defines which roles can access it.
 * Admin always has access to everything, but we list it explicitly for clarity.
 */
export interface RoutePermission {
  path: string;
  label: string;
  roles: CrmRole[];
}

/**
 * Flat list of all routes (NEW sub-tab paths + LEGACY paths for redirect compatibility).
 * The sidebar does NOT use this — it uses NAV_SECTIONS in client/src/config/navigation.ts.
 * This list is the source of truth for `hasAccess(role, path)`.
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // New consolidated paths — Dashboard section
  { path: "/dashboard/comercial", label: "Dashboard Comercial", roles: ["admin", "setter", "closer"] },
  { path: "/dashboard/citas", label: "Dashboard Citas", roles: ["admin", "setter", "closer"] },
  { path: "/dashboard/pipeline", label: "Dashboard Pipeline", roles: ["admin", "setter", "closer"] },
  { path: "/dashboard/fuentes", label: "Dashboard Fuentes", roles: ["admin"] },

  // Contactos section
  { path: "/contactos/todos", label: "Contactos", roles: ["admin", "setter", "closer"] },
  { path: "/contactos/cola", label: "Cola de Trabajo", roles: ["admin", "setter"] },
  { path: "/contactos/confirmaciones", label: "Confirmaciones", roles: ["admin", "setter"] },
  { path: "/contactos/citas", label: "Registro de Citas", roles: ["admin", "setter", "closer"] },
  { path: "/contactos/follow-ups", label: "Follow-ups", roles: ["admin", "setter", "closer"] },

  // Performance section
  { path: "/performance/setter", label: "Setter Tracker", roles: ["admin", "setter"] },
  { path: "/performance/closer", label: "Closer Tracker", roles: ["admin", "closer"] },
  { path: "/performance/leaderboards", label: "Leaderboards", roles: ["admin", "setter", "closer"] },
  { path: "/performance/team", label: "Team Summary", roles: ["admin"] },
  { path: "/performance/rep", label: "Perfil de Rep", roles: ["admin", "setter", "closer"] },

  // Ventas section
  { path: "/ventas/pagos", label: "Pagos", roles: ["admin", "closer"] },
  { path: "/ventas/comisiones", label: "Comisiones", roles: ["admin", "closer"] },
  { path: "/ventas/proyecciones", label: "Proyecciones", roles: ["admin", "closer"] },
  { path: "/ventas/calculadora", label: "Calculadora Revenue", roles: ["admin"] },

  // Marketing section
  { path: "/marketing/atribucion", label: "Atribución Ads", roles: ["admin"] },
  { path: "/marketing/scoring", label: "Score de Leads", roles: ["admin", "setter", "closer"] },
  { path: "/marketing/diagnostico", label: "Diagnóstico", roles: ["admin"] },
  { path: "/marketing/auditoria", label: "Auditoría Llamadas", roles: ["admin", "closer"] },

  // Admin section
  { path: "/admin/equipo", label: "Equipo", roles: ["admin", "setter", "closer"] },
  { path: "/admin/accesos", label: "Accesos", roles: ["admin"] },
  { path: "/admin/alertas", label: "Alertas", roles: ["admin", "setter", "closer"] },
  { path: "/admin/webhook", label: "Webhook Info", roles: ["admin"] },
  { path: "/admin/api", label: "API REST", roles: ["admin"] },

  // LEGACY paths retained for redirect compatibility — same perms as their new targets
  { path: "/", label: "Dashboard", roles: ["admin", "setter", "closer"] },
  { path: "/cola-trabajo", label: "Cola de Trabajo", roles: ["admin", "setter"] },
  { path: "/confirmaciones", label: "Confirmaciones", roles: ["admin", "setter"] },
  { path: "/citas", label: "Registro de Citas", roles: ["admin", "setter", "closer"] },
  { path: "/setter-tracker", label: "Setter Tracker", roles: ["admin", "setter"] },
  { path: "/closer-tracker", label: "Closer Tracker", roles: ["admin", "closer"] },
  { path: "/scoring", label: "Score de Leads", roles: ["admin", "setter", "closer"] },
  { path: "/leaderboards", label: "Leaderboards", roles: ["admin", "setter", "closer"] },
  { path: "/team-summary", label: "Team Summary", roles: ["admin"] },
  { path: "/rep-profile", label: "Perfil de Rep", roles: ["admin", "setter", "closer"] },
  { path: "/proyecciones", label: "Proyecciones", roles: ["admin", "closer"] },
  { path: "/alertas", label: "Alertas", roles: ["admin", "setter", "closer"] },
  { path: "/follow-ups", label: "Follow-Ups", roles: ["admin", "setter", "closer"] },
  { path: "/auditoria", label: "Auditoría Llamadas", roles: ["admin", "closer"] },
  { path: "/diagnostico", label: "Diagnóstico", roles: ["admin"] },
  { path: "/atribucion", label: "Atribución Ads", roles: ["admin"] },
  { path: "/equipo", label: "Equipo", roles: ["admin", "setter", "closer"] },
  { path: "/webhook", label: "Webhook Info", roles: ["admin"] },
  { path: "/api", label: "API REST", roles: ["admin"] },
  { path: "/calculadora", label: "Calculadora Revenue", roles: ["admin"] },
  { path: "/accesos", label: "Accesos", roles: ["admin"] },
];

/**
 * Check if a given role has access to a specific path.
 * Returns true if:
 * - The role is "admin" (always has access)
 * - The path is in the permissions list and the role is included
 * - The path starts with a permissioned path (for dynamic routes like /performance/rep/:type/:name)
 * - The path is not in the list (unlisted routes are accessible by all CRM roles)
 */
export function hasAccess(role: string, path: string): boolean {
  if (role === "admin") return true;

  // Find the most specific match (longest path prefix)
  let bestMatch: RoutePermission | undefined;
  for (const r of ROUTE_PERMISSIONS) {
    if (r.path === path || path.startsWith(r.path + "/")) {
      if (!bestMatch || r.path.length > bestMatch.path.length) {
        bestMatch = r;
      }
    }
  }

  if (!bestMatch) return true; // Unlisted routes accessible by all CRM roles
  return bestMatch.roles.includes(role as CrmRole);
}

/**
 * Get all routes accessible by a given role.
 */
export function getAccessibleRoutes(role: string): RoutePermission[] {
  if (role === "admin") return ROUTE_PERMISSIONS;
  return ROUTE_PERMISSIONS.filter(r => r.roles.includes(role as CrmRole));
}

/**
 * Role display labels for the UI.
 */
export const ROLE_LABELS: Record<CrmRole, string> = {
  admin: "Administrador",
  setter: "Setter",
  closer: "Closer",
};

export const ROLE_COLORS: Record<CrmRole, string> = {
  admin: "text-purple-400",
  setter: "text-blue-400",
  closer: "text-emerald-400",
};

export const ROLE_BG_COLORS: Record<CrmRole, string> = {
  admin: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  setter: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  closer: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};
