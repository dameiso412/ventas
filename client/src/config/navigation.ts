/**
 * Navigation config for the consolidated sidebar + sub-tab system.
 *
 * The sidebar shows only TOP-LEVEL sections. Each section has one or more
 * sub-tabs that render inside the section wrapper with a SubTabBar.
 *
 * Keeping this client-side (not in shared/) because LucideIcon components
 * are React and would bloat the server bundle.
 */
import {
  LayoutDashboard,
  Users,
  Trophy,
  DollarSign,
  Megaphone,
  Settings,
  BarChart3,
  CalendarCheck,
  TrendingUp,
  Target,
  ListTodo,
  ClipboardCheck,
  Flame,
  PhoneCall,
  UserCircle,
  Receipt,
  Percent,
  Calculator,
  Crosshair,
  Star,
  Activity,
  Headphones,
  Shield,
  Bell,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { CrmRole } from "@shared/permissions";

export type SubTabDef = {
  label: string;
  path: string;
  icon?: LucideIcon;
  roles: CrmRole[];
  /** Feature flag — hide sub-tab until Phase N ships */
  comingSoon?: boolean;
};

export type NavSection = {
  label: string;
  basePath: string;
  icon: LucideIcon;
  /** Default sub-tab when user lands on the section root */
  defaultPath: string;
  subTabs: SubTabDef[];
};

const ALL_ROLES: CrmRole[] = ["admin", "setter", "closer"];
const ADMIN_ONLY: CrmRole[] = ["admin"];
const ADMIN_SETTER: CrmRole[] = ["admin", "setter"];
const ADMIN_CLOSER: CrmRole[] = ["admin", "closer"];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Dashboard",
    basePath: "/dashboard",
    icon: LayoutDashboard,
    defaultPath: "/dashboard/comercial",
    subTabs: [
      { label: "Comercial", path: "/dashboard/comercial", icon: BarChart3, roles: ALL_ROLES },
      { label: "Citas", path: "/dashboard/citas", icon: CalendarCheck, roles: ALL_ROLES },
      { label: "Pipeline", path: "/dashboard/pipeline", icon: TrendingUp, roles: ALL_ROLES },
      { label: "Fuentes", path: "/dashboard/fuentes", icon: Target, roles: ADMIN_ONLY },
    ],
  },
  {
    label: "Contactos",
    basePath: "/contactos",
    icon: Users,
    defaultPath: "/contactos/citas",
    subTabs: [
      { label: "Todos", path: "/contactos/todos", icon: Users, roles: ALL_ROLES },
      { label: "Cola", path: "/contactos/cola", icon: ListTodo, roles: ADMIN_SETTER },
      { label: "Confirmaciones", path: "/contactos/confirmaciones", icon: ClipboardCheck, roles: ADMIN_SETTER },
      { label: "Citas", path: "/contactos/citas", icon: CalendarCheck, roles: ALL_ROLES },
      { label: "Follow-ups", path: "/contactos/follow-ups", icon: Flame, roles: ALL_ROLES },
    ],
  },
  {
    label: "Performance",
    basePath: "/performance",
    icon: Trophy,
    defaultPath: "/performance/leaderboards",
    subTabs: [
      { label: "Setter", path: "/performance/setter", icon: PhoneCall, roles: ADMIN_SETTER },
      { label: "Closer", path: "/performance/closer", icon: Target, roles: ADMIN_CLOSER },
      { label: "Leaderboards", path: "/performance/leaderboards", icon: Trophy, roles: ALL_ROLES },
      { label: "Team Summary", path: "/performance/team", icon: BarChart3, roles: ADMIN_ONLY },
      { label: "Perfil Rep", path: "/performance/rep", icon: UserCircle, roles: ALL_ROLES },
    ],
  },
  {
    label: "Ventas",
    basePath: "/ventas",
    icon: DollarSign,
    defaultPath: "/ventas/proyecciones",
    subTabs: [
      { label: "Pagos", path: "/ventas/pagos", icon: Receipt, roles: ADMIN_CLOSER, comingSoon: true },
      { label: "Comisiones", path: "/ventas/comisiones", icon: Percent, roles: ADMIN_CLOSER, comingSoon: true },
      { label: "Proyecciones", path: "/ventas/proyecciones", icon: TrendingUp, roles: ADMIN_CLOSER },
      { label: "Calculadora", path: "/ventas/calculadora", icon: Calculator, roles: ADMIN_ONLY },
    ],
  },
  {
    label: "Marketing",
    basePath: "/marketing",
    icon: Megaphone,
    defaultPath: "/marketing/scoring",
    subTabs: [
      { label: "Atribución", path: "/marketing/atribucion", icon: Crosshair, roles: ADMIN_ONLY },
      { label: "Scoring IA", path: "/marketing/scoring", icon: Star, roles: ALL_ROLES },
      { label: "Diagnóstico", path: "/marketing/diagnostico", icon: Activity, roles: ADMIN_ONLY },
      { label: "Auditoría", path: "/marketing/auditoria", icon: Headphones, roles: ADMIN_CLOSER },
    ],
  },
  {
    label: "Admin",
    basePath: "/admin",
    icon: Settings,
    defaultPath: "/admin/equipo",
    subTabs: [
      { label: "Equipo", path: "/admin/equipo", icon: Users, roles: ALL_ROLES },
      { label: "Accesos", path: "/admin/accesos", icon: Shield, roles: ADMIN_ONLY },
      { label: "Alertas", path: "/admin/alertas", icon: Bell, roles: ALL_ROLES },
      { label: "Webhook", path: "/admin/webhook", icon: Webhook, roles: ADMIN_ONLY },
      { label: "API", path: "/admin/api", icon: Webhook, roles: ADMIN_ONLY },
    ],
  },
];

/**
 * Filter sub-tabs by user role. Coming-soon tabs are visible but will render a placeholder.
 */
export function getVisibleSubTabs(section: NavSection, role: string): SubTabDef[] {
  return section.subTabs.filter((tab) => tab.roles.includes(role as CrmRole));
}

/**
 * Get sections where the user has access to at least one sub-tab.
 */
export function getVisibleSections(role: string): NavSection[] {
  return NAV_SECTIONS.filter((section) => getVisibleSubTabs(section, role).length > 0);
}

/**
 * Map OLD flat route → NEW sub-tab route for 301 redirects.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/": "/dashboard/comercial",
  "/cola-trabajo": "/contactos/cola",
  "/confirmaciones": "/contactos/confirmaciones",
  "/citas": "/contactos/citas",
  "/follow-ups": "/contactos/follow-ups",
  "/setter-tracker": "/performance/setter",
  "/closer-tracker": "/performance/closer",
  "/leaderboards": "/performance/leaderboards",
  "/team-summary": "/performance/team",
  "/rep-profile": "/performance/rep",
  "/proyecciones": "/ventas/proyecciones",
  "/calculadora": "/ventas/calculadora",
  "/atribucion": "/marketing/atribucion",
  "/scoring": "/marketing/scoring",
  "/diagnostico": "/marketing/diagnostico",
  "/auditoria": "/marketing/auditoria",
  "/equipo": "/admin/equipo",
  "/accesos": "/admin/accesos",
  "/alertas": "/admin/alertas",
  "/webhook": "/admin/webhook",
  "/api": "/admin/api",
};
