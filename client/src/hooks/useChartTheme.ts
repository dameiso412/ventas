import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

/**
 * Provides theme-aware colors for Recharts components.
 * In dark mode: dark backgrounds, light text.
 * In light mode: light backgrounds, dark text with purple accents.
 */
export function useChartTheme() {
  const { theme } = useTheme();

  return useMemo(() => {
    const isDark = theme === "dark";

    return {
      // Tooltip styling
      tooltip: {
        contentStyle: {
          backgroundColor: isDark ? "#1E1245" : "#ffffff",
          border: isDark
            ? "1px solid rgba(168,85,247,0.3)"
            : "1px solid rgba(124,58,237,0.2)",
          borderRadius: "8px",
          color: isDark ? "#fff" : "#1a1a2e",
          boxShadow: isDark
            ? "0 4px 12px rgba(0,0,0,0.3)"
            : "0 4px 12px rgba(0,0,0,0.1)",
        },
      },
      // CartesianGrid stroke
      gridStroke: isDark
        ? "rgba(168,85,247,0.1)"
        : "rgba(124,58,237,0.08)",
      // Axis tick fill
      tickFill: isDark ? "#9ca3af" : "#64748b",
      // Legend text color
      legendColor: isDark ? "#9ca3af" : "#64748b",
      // Background for progress bars, etc.
      trackBg: isDark
        ? "rgba(255,255,255,0.05)"
        : "rgba(124,58,237,0.06)",
      // Card-like background for nested elements
      nestedBg: isDark
        ? "rgba(255,255,255,0.03)"
        : "rgba(124,58,237,0.03)",
      // Text colors
      textPrimary: isDark ? "#f3f4f6" : "#1e1b4b",
      textSecondary: isDark ? "#9ca3af" : "#64748b",
      textMuted: isDark ? "#6b7280" : "#94a3b8",
      // Theme flag
      isDark,
    };
  }, [theme]);
}
