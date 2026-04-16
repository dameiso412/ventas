import { Route, Switch, Redirect } from "wouter";
import { SubTabBar } from "@/components/SubTabBar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NAV_SECTIONS, getVisibleSubTabs } from "@/config/navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import SetterTracker from "../SetterTracker";
import CloserTracker from "../CloserTracker";
import Leaderboards from "../Leaderboards";
import TeamSummary from "../TeamSummary";
import RepProfile from "../RepProfile";

const SECTION = NAV_SECTIONS.find((s) => s.basePath === "/performance")!;

export default function PerformanceSection() {
  const { user } = useAuth();
  const tabs = user ? getVisibleSubTabs(SECTION, user.role) : [];

  return (
    <>
      <SubTabBar tabs={tabs} />
      <Switch>
        <Route path="/performance/setter">
          <ProtectedRoute component={SetterTracker} path="/performance/setter" />
        </Route>
        <Route path="/performance/closer">
          <ProtectedRoute component={CloserTracker} path="/performance/closer" />
        </Route>
        <Route path="/performance/leaderboards">
          <ProtectedRoute component={Leaderboards} path="/performance/leaderboards" />
        </Route>
        <Route path="/performance/team">
          <ProtectedRoute component={TeamSummary} path="/performance/team" />
        </Route>
        <Route path="/performance/rep">
          <ProtectedRoute component={RepProfile} path="/performance/rep" />
        </Route>
        <Route path="/performance/rep/:type/:name">
          <ProtectedRoute component={RepProfile} path="/performance/rep" />
        </Route>
        <Route>
          <Redirect to={SECTION.defaultPath} />
        </Route>
      </Switch>
    </>
  );
}
