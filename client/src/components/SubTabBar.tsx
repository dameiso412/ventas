import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type SubTab = {
  label: string;
  path: string;
  icon?: LucideIcon;
  badge?: number | string;
};

type SubTabBarProps = {
  tabs: SubTab[];
  className?: string;
};

/**
 * Horizontal sub-navigation bar rendered below each top-level section.
 * Sticky at the top of the content area so sub-tabs stay visible while scrolling.
 * URL-synced via wouter — each sub-tab is its own bookmarkable route.
 */
export function SubTabBar({ tabs, className }: SubTabBarProps) {
  const [location] = useLocation();

  if (tabs.length === 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-4 md:-mx-6 mb-6 border-b border-border/50 bg-background/80 backdrop-blur",
        className
      )}
    >
      <div className="flex gap-1 px-4 md:px-6 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive =
            location === tab.path || location.startsWith(tab.path + "/");
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon && <tab.icon className="h-4 w-4" />}
              <span>{tab.label}</span>
              {tab.badge != null && (
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
