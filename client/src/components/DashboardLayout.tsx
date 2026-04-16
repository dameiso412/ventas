import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { PanelLeft, Sun, Moon, LogOut } from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { ROLE_LABELS, type CrmRole } from "@shared/permissions";
import { getVisibleSections } from "@/config/navigation";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { NotificationBell } from "./NotificationBell";
import { AIChatWidget } from "./AIChatWidget";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();

  // Filter nav sections based on user role — user sees a section only if they
  // have access to at least one of its sub-tabs.
  const visibleSections = useMemo(() => {
    if (!user) return [];
    return getVisibleSections(user.role);
  }, [user]);

  const activeSection = visibleSections.find((section) =>
    location === section.basePath || location.startsWith(section.basePath + "/")
  );

  // Get user initials for avatar
  const userInitials = useMemo(() => {
    if (!user?.name) return "?";
    const parts = user.name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }, [user]);

  const roleLabel = user?.role ? (ROLE_LABELS[user.role as CrmRole] || user.role) : "";

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold tracking-tight truncate text-gradient-purple text-lg">
                    SACAMEDI
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">CRM</span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {visibleSections.map((section) => {
                const isActive =
                  location === section.basePath ||
                  location.startsWith(section.basePath + "/");
                return (
                  <SidebarMenuItem key={section.basePath}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(section.defaultPath)}
                      tooltip={section.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <section.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{section.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <div className="flex items-center gap-3 rounded-lg px-1 py-1 w-full text-left group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-9 w-9 border shrink-0 border-primary/30">
                <AvatarFallback className="text-xs font-medium bg-primary/20 text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "Usuario"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">{roleLabel}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <NotificationBell />
                    {toggleTheme && (
                      <button
                        onClick={toggleTheme}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors shrink-0"
                        aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                      >
                        {theme === 'dark' ? (
                          <Sun className="h-4 w-4 text-amber-400" />
                        ) : (
                          <Moon className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => logout()}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/20 transition-colors shrink-0"
                      aria-label="Cerrar sesión"
                      title="Cerrar sesión"
                    >
                      <LogOut className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {isCollapsed && (
              <div className="flex flex-col items-center gap-1">
                <NotificationBell />
                {toggleTheme && (
                  <button
                    onClick={toggleTheme}
                    className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
                    aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  >
                    {theme === 'dark' ? (
                      <Sun className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Moon className="h-4 w-4 text-primary" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => logout()}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/20 transition-colors"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (isCollapsed) return; setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <span className="tracking-tight text-foreground font-semibold">
                  {activeSection?.label ?? "Sacamedi CRM"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell />
              {toggleTheme && (
                <button
                  onClick={toggleTheme}
                  className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
                  aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Moon className="h-4 w-4 text-primary" />
                  )}
                </button>
              )}
              <button
                onClick={() => logout()}
                className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-destructive/20 transition-colors"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
      <AIChatWidget />
    </>
  );
}
