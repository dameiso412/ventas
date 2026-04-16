import { Route, Switch, Redirect } from "wouter";
import { SubTabBar } from "@/components/SubTabBar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NAV_SECTIONS, getVisibleSubTabs } from "@/config/navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import VentasPagos from "./VentasPagos";
import VentasComisiones from "./VentasComisiones";
import Proyecciones from "../Proyecciones";
import Calculadora from "../Calculadora";

const SECTION = NAV_SECTIONS.find((s) => s.basePath === "/ventas")!;

export default function VentasSection() {
  const { user } = useAuth();
  const tabs = user ? getVisibleSubTabs(SECTION, user.role) : [];

  return (
    <>
      <SubTabBar tabs={tabs} />
      <Switch>
        <Route path="/ventas/pagos">
          <ProtectedRoute component={VentasPagos} path="/ventas/pagos" />
        </Route>
        <Route path="/ventas/comisiones">
          <ProtectedRoute component={VentasComisiones} path="/ventas/comisiones" />
        </Route>
        <Route path="/ventas/proyecciones">
          <ProtectedRoute component={Proyecciones} path="/ventas/proyecciones" />
        </Route>
        <Route path="/ventas/calculadora">
          <ProtectedRoute component={Calculadora} path="/ventas/calculadora" />
        </Route>
        <Route>
          <Redirect to={SECTION.defaultPath} />
        </Route>
      </Switch>
    </>
  );
}
