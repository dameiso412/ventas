import { Route, Switch, Redirect } from "wouter";
import { SubTabBar } from "@/components/SubTabBar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NAV_SECTIONS, getVisibleSubTabs } from "@/config/navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import Home from "../Home";
import DashboardCitas from "./DashboardCitas";
import DashboardPipeline from "./DashboardPipeline";
import DashboardFuentes from "./DashboardFuentes";

const SECTION = NAV_SECTIONS.find((s) => s.basePath === "/dashboard")!;

export default function DashboardSection() {
  const { user } = useAuth();
  const tabs = user ? getVisibleSubTabs(SECTION, user.role) : [];

  return (
    <>
      <SubTabBar tabs={tabs} />
      <Switch>
        <Route path="/dashboard/comercial">
          <ProtectedRoute component={Home} path="/dashboard/comercial" />
        </Route>
        <Route path="/dashboard/citas">
          <ProtectedRoute component={DashboardCitas} path="/dashboard/citas" />
        </Route>
        <Route path="/dashboard/pipeline">
          <ProtectedRoute component={DashboardPipeline} path="/dashboard/pipeline" />
        </Route>
        <Route path="/dashboard/fuentes">
          <ProtectedRoute component={DashboardFuentes} path="/dashboard/fuentes" />
        </Route>
        <Route>
          <Redirect to={SECTION.defaultPath} />
        </Route>
      </Switch>
    </>
  );
}
