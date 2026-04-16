import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Redirect, Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import AccesoDenegado from "./pages/AccesoDenegado";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import { useAuth } from "./_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import { LEGACY_REDIRECTS } from "./config/navigation";
import { lazy, Suspense, useEffect } from "react";

// Lazy-loaded section wrappers — 6 top-level sections replace 21 flat routes.
const DashboardSection = lazy(() => import("./pages/dashboard/DashboardSection"));
const ContactosSection = lazy(() => import("./pages/contactos/ContactosSection"));
const PerformanceSection = lazy(() => import("./pages/performance/PerformanceSection"));
const VentasSection = lazy(() => import("./pages/ventas/VentasSection"));
const MarketingSection = lazy(() => import("./pages/marketing/MarketingSection"));
const AdminSection = lazy(() => import("./pages/admin/AdminSection"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
          {/* LEGACY REDIRECTS — static paths from the pre-consolidation sidebar */}
          {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
            <Route key={from} path={from}>
              <Redirect to={to} />
            </Route>
          ))}

          {/* LEGACY REDIRECTS — dynamic paths */}
          <Route path="/rep-profile/:type/:name">
            {(params) => (
              <Redirect to={`/performance/rep/${params.type}/${params.name}`} />
            )}
          </Route>
          <Route path="/auditoria/:id">
            {(params) => <Redirect to={`/marketing/auditoria/${params.id}`} />}
          </Route>

          {/* 6 TOP-LEVEL SECTIONS — each renders a SubTabBar + sub-tab routes */}
          <Route path="/dashboard/:rest*" component={DashboardSection} />
          <Route path="/dashboard" component={DashboardSection} />

          <Route path="/contactos/:rest*" component={ContactosSection} />
          <Route path="/contactos" component={ContactosSection} />

          <Route path="/performance/:rest*" component={PerformanceSection} />
          <Route path="/performance" component={PerformanceSection} />

          <Route path="/ventas/:rest*" component={VentasSection} />
          <Route path="/ventas" component={VentasSection} />

          <Route path="/marketing/:rest*" component={MarketingSection} />
          <Route path="/marketing" component={MarketingSection} />

          <Route path="/admin/:rest*" component={AdminSection} />
          <Route path="/admin" component={AdminSection} />

          <Route path="/404" component={NotFound} />
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
