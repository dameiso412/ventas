import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Citas from "./pages/Citas";
import SetterTracker from "./pages/SetterTracker";
import CloserTracker from "./pages/CloserTracker";
import Scoring from "./pages/Scoring";
import Leaderboards from "./pages/Leaderboards";
import WebhookInfo from "./pages/WebhookInfo";
import Diagnostico from "./pages/Diagnostico";
import ApiDocs from "./pages/ApiDocs";
import Proyecciones from "./pages/Proyecciones";
import TeamSummary from "./pages/TeamSummary";
import RepProfile from "./pages/RepProfile";
import Alertas from "./pages/Alertas";
import AuditoriaLlamadas from "./pages/AuditoriaLlamadas";
import FollowUps from "./pages/FollowUps";
import Atribucion from "./pages/Atribucion";
import ColaTrabajo from "./pages/ColaTrabajo";
import Confirmaciones from "./pages/Confirmaciones";
import Equipo from "./pages/Equipo";
import Accesos from "./pages/Accesos";
import Calculadora from "./pages/Calculadora";
import AccesoDenegado from "./pages/AccesoDenegado";
import NoPermiso from "./pages/NoPermiso";
import Login from "./pages/Login";
import { useAuth } from "./_core/hooks/useAuth";
import { hasAccess } from "@shared/permissions";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import { useEffect, type ComponentType } from "react";

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
