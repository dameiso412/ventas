import { Route, Switch, Redirect } from "wouter";
import { SubTabBar } from "@/components/SubTabBar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { NAV_SECTIONS, getVisibleSubTabs } from "@/config/navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import ContactosTodos from "./ContactosTodos";
import ColaTrabajo from "../ColaTrabajo";
import Confirmaciones from "../Confirmaciones";
import Citas from "../Citas";
import FollowUps from "../FollowUps";

const SECTION = NAV_SECTIONS.find((s) => s.basePath === "/contactos")!;

export default function ContactosSection() {
  const { user } = useAuth();
  const tabs = user ? getVisibleSubTabs(SECTION, user.role) : [];

  return (
    <>
      <SubTabBar tabs={tabs} />
      <Switch>
        <Route path="/contactos/todos">
          <ProtectedRoute component={ContactosTodos} path="/contactos/todos" />
        </Route>
        <Route path="/contactos/cola">
          <ProtectedRoute component={ColaTrabajo} path="/contactos/cola" />
        </Route>
        <Route path="/contactos/confirmaciones">
          <ProtectedRoute component={Confirmaciones} path="/contactos/confirmaciones" />
        </Route>
        <Route path="/contactos/citas">
          <ProtectedRoute component={Citas} path="/contactos/citas" />
        </Route>
        <Route path="/contactos/follow-ups">
          <ProtectedRoute component={FollowUps} path="/contactos/follow-ups" />
        </Route>
        <Route>
          <Redirect to={SECTION.defaultPath} />
        </Route>
      </Switch>
    </>
  );
}
