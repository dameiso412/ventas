import React, { createContext, useContext, useState, useCallback } from "react";

export type PlatformMode = "pipeline" | "clinica";

interface PlatformModeContextType {
  mode: PlatformMode;
  setMode: (mode: PlatformMode) => void;
  toggleMode: () => void;
  isPipelineMode: boolean;
  isClinicaMode: boolean;
}

const PlatformModeContext = createContext<PlatformModeContextType | undefined>(undefined);

export function PlatformModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<PlatformMode>(() => {
    const stored = localStorage.getItem("platform_mode");
    return (stored as PlatformMode) || "pipeline";
  });

  const setMode = useCallback((newMode: PlatformMode) => {
    setModeState(newMode);
    localStorage.setItem("platform_mode", newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "pipeline" ? "clinica" : "pipeline");
  }, [mode, setMode]);

  return (
    <PlatformModeContext.Provider value={{
      mode,
      setMode,
      toggleMode,
      isPipelineMode: mode === "pipeline",
      isClinicaMode: mode === "clinica",
    }}>
      {children}
    </PlatformModeContext.Provider>
  );
}

export function usePlatformMode() {
  const context = useContext(PlatformModeContext);
  if (!context) {
    throw new Error("usePlatformMode must be used within PlatformModeProvider");
  }
  return context;
}
