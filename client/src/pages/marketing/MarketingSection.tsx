import { Route, Switch, Redirect } from "wouter";
import { SubTabBar } from "@/components/SubTabBar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NAV_SECTIONS, getVisibleSubTabs } from "@/config/navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import Atribucion from "../Atribucion";
import Scoring from "../Scoring";
import Diagnostico from "../Diagnostico";
import AuditoriaLlamadas from "../AuditoriaLlamadas";
import MarketingAuditoriaUtm from "./MarketingAuditoriaUtm";

const SECTION = NAV_SECTIONS.find((s) => s.basePath === "/marketing")!;

export default function MarketingSection() {
  const { user } = useAuth();
  const tabs = user ? getVisibleSubTabs(SECTION, user.role) : [];

  return (
    <>
      <SubTabBar tabs={tabs} />
      <Switch>
        <Route path="/marketing/atribucion">
          <ProtectedRoute component={Atribucion} path="/marketing/atribucion" />
        </Route>
        <Route path="/marketing/auditoria-utm">
          <ProtectedRoute component={MarketingAuditoriaUtm} path="/marketing/auditoria-utm" />
        </Route>
        <Route path="/marketing/scoring">
          <ProtectedRoute component={Scoring} path="/marketing/scoring" />
        </Route>
        <Route path="/marketing/diagnostico">
          <ProtectedRoute component={Diagnostico} path="/marketing/diagnostico" />
        </Route>
        <Route path="/marketing/auditoria">
          <ProtectedRoute component={AuditoriaLlamadas} path="/marketing/auditoria" />
        </Route>
        <Route path="/marketing/auditoria/:id">
          <ProtectedRoute component={AuditoriaLlamadas} path="/marketing/auditoria" />
        </Route>
        <Route>
          <Redirect to={SECTION.defaultPath} />
        </Route>
      </Switch>
    </>
  );
}
