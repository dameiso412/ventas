import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import AccesoDenegado from "./pages/AccesoDenegado";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import { useAuth } from "./_core/hooks/useAuth";
import { hasAccess } from "@shared/permissions";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import { lazy, Suspense, useEffect, type ComponentType } from "react";

// Lazy-loaded pages — only downloaded when navigated to
const Home = lazy(() => import("./pages/Home"));
const Citas = lazy(() => import("./pages/Citas"));
const SetterTracker = lazy(() => import("./pages/SetterTracker"));
const CloserTracker = lazy(() => import("./pages/CloserTracker"));
const Scoring = lazy(() => import("./pages/Scoring"));
const Leaderboards = lazy(() => import("./pages/Leaderboards"));
const WebhookInfo = lazy(() => import("./pages/WebhookInfo"));
const Diagnostico = lazy(() => import("./pages/Diagnostico"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const Proyecciones = lazy(() => import("./pages/Proyecciones"));
const TeamSummary = lazy(() => import("./pages/TeamSummary"));
const RepProfile = lazy(() => import("./pages/RepProfile"));
const Alertas = lazy(() => import("./pages/Alertas"));
const AuditoriaLlamadas = lazy(() => import("./pages/AuditoriaLlamadas"));
const FollowUps = lazy(() => import("./pages/FollowUps"));
const Atribucion = lazy(() => import("./pages/Atribucion"));
const ColaTrabajo = lazy(() => import("./pages/ColaTrabajo"));
const Confirmaciones = lazy(() => import("./pages/Confirmaciones"));
const Equipo = lazy(() => import("./pages/Equipo"));
const Accesos = lazy(() => import("./pages/Accesos"));
const Calculadora = lazy(() => import("./pages/Calculadora"));
const NoPermiso = lazy(() => import("./pages/NoPermiso"));
const NotFound = lazy(() => import("./pages/NotFound"));

/**
 * ProtectedRoute - wraps a page component with role-based access check.
 * If the user's role doesn't have access to the given path, shows NoPermiso.
 */
function ProtectedRoute({ component: Component, path }: { component: ComponentType<any>; path: string }) {
  const { user } = useAuth();
  if (!user) return null;

  const crmRoles = ["admin", "setter", "closer"];
  if (!crmRoles.includes(user.role)) {
    return <AccesoDenegado />;
  }

  if (!hasAccess(user.role, path)) {
    return <NoPermiso />;
  }

  return <Component />;
}

function CRMRouter() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (loading) return;
    if (!user && location !== "/acceso-denegado" && location !== "/login") {
      window.location.href = "/login";
    }
  }, [user, loading, location]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  // If user has no CRM role, show access denied
  if (user && !["admin", "setter", "closer"].includes(user.role)) {
    return <AccesoDenegado />;
  }

  return (
    <DashboardLayout>
      <Suspense fallback={<DashboardLayoutSkeleton />}>
      <Switch>
        <Route path={"/"}>
          <ProtectedRoute component={Home} path="/" />
        </Route>
        <Route path={"/cola-trabajo"}>
          <ProtectedRoute component={ColaTrabajo} path="/cola-trabajo" />
        </Route>
        <Route path={"/confirmaciones"}>
          <ProtectedRoute component={Confirmaciones} path="/confirmaciones" />
        </Route>
        <Route path={"/citas"}>
          <ProtectedRoute component={Citas} path="/citas" />
        </Route>
        <Route path={"/setter-tracker"}>
          <ProtectedRoute component={SetterTracker} path="/setter-tracker" />
        </Route>
        <Route path={"/closer-tracker"}>
          <ProtectedRoute component={CloserTracker} path="/closer-tracker" />
        </Route>
        <Route path={"/scoring"}>
          <ProtectedRoute component={Scoring} path="/scoring" />
        </Route>
        <Route path={"/leaderboards"}>
          <ProtectedRoute component={Leaderboards} path="/leaderboards" />
        </Route>
        <Route path={"/team-summary"}>
          <ProtectedRoute component={TeamSummary} path="/team-summary" />
        </Route>
        <Route path={"/rep-profile"}>
          <ProtectedRoute component={RepProfile} path="/rep-profile" />
        </Route>
        <Route path={"/rep-profile/:type/:name"}>
          <ProtectedRoute component={RepProfile} path="/rep-profile" />
        </Route>
        <Route path={"/proyecciones"}>
          <ProtectedRoute component={Proyecciones} path="/proyecciones" />
        </Route>
        <Route path={"/alertas"}>
          <ProtectedRoute component={Alertas} path="/alertas" />
        </Route>
        <Route path={"/auditoria"}>
          <ProtectedRoute component={AuditoriaLlamadas} path="/auditoria" />
        </Route>
        <Route path={"/auditoria/:id"}>
          <ProtectedRoute component={AuditoriaLlamadas} path="/auditoria" />
        </Route>
        <Route path={"/follow-ups"}>
          <ProtectedRoute component={FollowUps} path="/follow-ups" />
        </Route>
        <Route path={"/diagnostico"}>
          <ProtectedRoute component={Diagnostico} path="/diagnostico" />
        </Route>
        <Route path={"/atribucion"}>
          <ProtectedRoute component={Atribucion} path="/atribucion" />
        </Route>
        <Route path={"/equipo"}>
          <ProtectedRoute component={Equipo} path="/equipo" />
        </Route>
        <Route path={"/calculadora"}>
          <ProtectedRoute component={Calculadora} path="/calculadora" />
        </Route>
        <Route path={"/accesos"}>
          <ProtectedRoute component={Accesos} path="/accesos" />
        </Route>
        <Route path={"/webhook"}>
          <ProtectedRoute component={WebhookInfo} path="/webhook" />
        </Route>
        <Route path={"/api"}>
          <ProtectedRoute component={ApiDocs} path="/api" />
        </Route>
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/auth/callback" component={AuthCallback} />
            <Route path="/acceso-denegado" component={AccesoDenegado} />
            <Route>
              <CRMRouter />
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
