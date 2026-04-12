import { useTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

/**
 * Returns theme-aware color values for status indicators (good/bad/warning).
 * In dark mode: uses -400 shades (lighter).
 * In light mode: uses -700 shades (darker) for better contrast.
 */
export function useStatusColors() {
  const { theme } = useTheme();

  return useMemo(() => {
    const isDark = theme === "dark";

    return {
      good: isDark ? "#22c55e" : "#15803d",      // green-400 → green-700
      bad: isDark ? "#ef4444" : "#b91c1c",        // red-400 → red-700
      warning: isDark ? "#f59e0b" : "#b45309",    // amber-400 → amber-700
      primary: isDark ? "#A855F7" : "#7c3aed",    // purple-400 → purple-600
      info: isDark ? "#3b82f6" : "#1d4ed8",       // blue-400 → blue-700
      // Diagnostico benchmark colors
      excellent: isDark ? "#4ade80" : "#15803d",
      goodBlue: isDark ? "#60a5fa" : "#1d4ed8",
      watch: isDark ? "#93c5fd" : "#2563eb",
      borderline: isDark ? "#fbbf24" : "#b45309",
      probCut: isDark ? "#fb923c" : "#c2410c",
      cut: isDark ? "#f87171" : "#b91c1c",
      isDark,
    };
  }, [theme]);
}
