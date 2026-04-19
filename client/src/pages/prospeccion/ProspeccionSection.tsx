/**
 * Prospección — top-level section wrapper for the IG Cold DM System tooling.
 *
 * Five sub-tabs:
 *   Tablero   — KPIs con semáforo + funnel visual                (Fase 2 ✅)
 *   Rutina    — Checklist AM/PM + captura diaria                 (Fase 3 ✅)
 *   Tracker   — Matriz mensual 12 meses × filas                  (Fase 4 ✅)
 *   Doctor    — Troubleshooting reactivo por KPI                 (Fase 5 ✅)
 *   Metas     — Config admin de umbrales y volúmenes             (Fase 6)
 *
 * Tablero + Rutina + Tracker + Doctor son funcionales. Metas renderiza
 * ComingSoon placeholder hasta que cierre Fase 6.
 */
import { Route, Switch, Redirect } from "wouter";
import { SubTabBar } from "@/components/SubTabBar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ComingSoon } from "@/components/ComingSoon";
import { NAV_SECTIONS, getVisibleSubTabs } from "@/config/navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import ProspeccionTablero from "./ProspeccionTablero";
import ProspeccionRutina from "./ProspeccionRutina";
import ProspeccionTracker from "./ProspeccionTracker";
import ProspeccionDoctor from "./ProspeccionDoctor";

const SECTION = NAV_SECTIONS.find((s) => s.basePath === "/prospeccion")!;

function ProspeccionMetasPlaceholder() {
  return (
    <ComingSoon
      title="Metas globales"
      description="Admin: editar umbrales de KPIs (MSR, PRR, CSR, ABR, CAR) y volúmenes diarios (DMs, follows, likes, comentarios)."
      phase="Próximamente — Fase 6"
    />
  );
}

export default function ProspeccionSection() {
  const { user } = useAuth();
  const tabs = user ? getVisibleSubTabs(SECTION, user.role) : [];

  return (
    <>
      <SubTabBar tabs={tabs} />
      <Switch>
        <Route path="/prospeccion/tablero">
          <ProtectedRoute component={ProspeccionTablero} path="/prospeccion/tablero" />
        </Route>
        <Route path="/prospeccion/rutina">
          <ProtectedRoute component={ProspeccionRutina} path="/prospeccion/rutina" />
        </Route>
        <Route path="/prospeccion/tracker">
          <ProtectedRoute component={ProspeccionTracker} path="/prospeccion/tracker" />
        </Route>
        <Route path="/prospeccion/doctor">
          <ProtectedRoute component={ProspeccionDoctor} path="/prospeccion/doctor" />
        </Route>
        <Route path="/prospeccion/metas">
          <ProtectedRoute component={ProspeccionMetasPlaceholder} path="/prospeccion/metas" />
        </Route>
        <Route>
          <Redirect to={SECTION.defaultPath} />
        </Route>
      </Switch>
    </>
  );
}
