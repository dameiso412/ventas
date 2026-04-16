import { ComponentType, lazy, Suspense } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasAccess } from "@shared/permissions";

const AccesoDenegado = lazy(() => import("../pages/AccesoDenegado"));
const NoPermiso = lazy(() => import("../pages/NoPermiso"));

/**
 * Wraps a page component with role-based access check.
 * - If user has no CRM role → AccesoDenegado
 * - If user's role doesn't have access to `path` → NoPermiso
 * - Otherwise → renders the component
 */
export function ProtectedRoute({
  component: Component,
  path,
}: {
  component: ComponentType<any>;
  path: string;
}) {
  const { user } = useAuth();
  if (!user) return null;

  const crmRoles = ["admin", "setter", "closer"];
  if (!crmRoles.includes(user.role)) {
    return (
      <Suspense fallback={null}>
        <AccesoDenegado />
      </Suspense>
    );
  }

  if (!hasAccess(user.role, path)) {
    return (
      <Suspense fallback={null}>
        <NoPermiso />
      </Suspense>
    );
  }

  return <Component />;
}
