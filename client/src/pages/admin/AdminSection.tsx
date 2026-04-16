import { Route, Switch, Redirect } from "wouter";
import { SubTabBar } from "@/components/SubTabBar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NAV_SECTIONS, getVisibleSubTabs } from "@/config/navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import Equipo from "../Equipo";
import Accesos from "../Accesos";
import Alertas from "../Alertas";
import WebhookInfo from "../WebhookInfo";
import ApiDocs from "../ApiDocs";

const SECTION = NAV_SECTIONS.find((s) => s.basePath === "/admin")!;

export default function AdminSection() {
  const { user } = useAuth();
  const tabs = user ? getVisibleSubTabs(SECTION, user.role) : [];

  return (
    <>
      <SubTabBar tabs={tabs} />
      <Switch>
        <Route path="/admin/equipo">
          <ProtectedRoute component={Equipo} path="/admin/equipo" />
        </Route>
        <Route path="/admin/accesos">
          <ProtectedRoute component={Accesos} path="/admin/accesos" />
        </Route>
        <Route path="/admin/alertas">
          <ProtectedRoute component={Alertas} path="/admin/alertas" />
        </Route>
        <Route path="/admin/webhook">
          <ProtectedRoute component={WebhookInfo} path="/admin/webhook" />
        </Route>
        <Route path="/admin/api">
          <ProtectedRoute component={ApiDocs} path="/admin/api" />
        </Route>
        <Route>
          <Redirect to={SECTION.defaultPath} />
        </Route>
      </Switch>
    </>
  );
}
