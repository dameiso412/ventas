/**
 * Role-based permissions for the CRM.
 * Shared between frontend (navigation filtering) and backend (route protection).
 */

export type CrmRole = "admin" | "setter" | "closer" | "clinic_member";

/**
 * Each route entry defines which roles can access it.
 * Admin always has access to everything, but we list it explicitly for clarity.
 */
export interface RoutePermission {
  path: string;
  label: string;
  roles: CrmRole[];
}

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Pipeline routes
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
  // Clinica routes
  { path: "/clinica", label: "Pacientes", roles: ["admin", "closer", "clinic_member"] },
  { path: "/clinica/analytics", label: "Analytics Clinica", roles: ["admin", "clinic_member"] },
  { path: "/clinica/products", label: "Productos", roles: ["admin", "clinic_member"] },
  { path: "/clinica/members", label: "Miembros Clinica", roles: ["admin", "clinic_member"] },
  { path: "/clinica/settings", label: "Config Clinica", roles: ["admin", "clinic_member"] },
];

/**
 * Check if a given role has access to a specific path.
 * Returns true if:
 * - The role is "admin" (always has access)
 * - The path is in the permissions list and the role is included
 * - The path is not in the list (unlisted routes are accessible by all CRM roles)
 */
export function hasAccess(role: string, path: string): boolean {
  if (role === "admin") return true;

  const permission = ROUTE_PERMISSIONS.find(r => {
    if (r.path === path) return true;
    // Handle dynamic routes like /rep-profile/:type/:name
    if (path.startsWith(r.path + "/")) return true;
    // Handle /auditoria/:id
    if (r.path === "/auditoria" && path.startsWith("/auditoria")) return true;
    // Handle /clinica sub-routes
    if (r.path === "/clinica" && path.startsWith("/clinica")) return true;
    return false;
  });

  if (!permission) return true; // Unlisted routes accessible by all CRM roles
  return permission.roles.includes(role as CrmRole);
}

/**
 * Check if a role can access pipeline mode.
 */
export function canAccessPipeline(role: string): boolean {
  return role === "admin" || role === "setter" || role === "closer";
}

/**
 * Check if a role can access clinica mode.
 */
export function canAccessClinica(role: string): boolean {
  return role === "admin" || role === "closer" || role === "clinic_member";
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
  clinic_member: "Clinica",
};

export const ROLE_COLORS: Record<CrmRole, string> = {
  admin: "text-purple-400",
  setter: "text-blue-400",
  closer: "text-emerald-400",
  clinic_member: "text-pink-400",
};

export const ROLE_BG_COLORS: Record<CrmRole, string> = {
  admin: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  setter: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  closer: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  clinic_member: "bg-pink-500/20 text-pink-300 border-pink-500/30",
};
