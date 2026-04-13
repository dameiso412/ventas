import { usePlatformMode } from "@/contexts/PlatformModeContext";
import { Activity, Stethoscope } from "lucide-react";
import { useLocation } from "wouter";

export function ModeToggle({ collapsed }: { collapsed?: boolean }) {
  const { mode, setMode } = usePlatformMode();
  const [, navigate] = useLocation();

  const handleSwitch = (newMode: "pipeline" | "clinica") => {
    if (newMode === mode) return;
    setMode(newMode);
    navigate(newMode === "pipeline" ? "/" : "/clinica");
  };

  if (collapsed) {
    return (
      <button
        onClick={() => handleSwitch(mode === "pipeline" ? "clinica" : "pipeline")}
        className="w-full flex items-center justify-center p-2 rounded-lg transition-colors hover:bg-muted/50"
        title={mode === "pipeline" ? "Cambiar a Clinica" : "Cambiar a Pipeline"}
      >
        {mode === "pipeline" ? (
          <Activity className="h-4 w-4 text-primary" />
        ) : (
          <Stethoscope className="h-4 w-4 text-pink-400" />
        )}
      </button>
    );
  }

  return (
    <div className="px-2 py-1.5">
      <div className="flex bg-muted/40 rounded-lg p-0.5 border border-border/30">
        <button
          onClick={() => handleSwitch("pipeline")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === "pipeline"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Pipeline
        </button>
        <button
          onClick={() => handleSwitch("clinica")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            mode === "clinica"
              ? "bg-pink-500 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Stethoscope className="h-3.5 w-3.5" />
          Clinica
        </button>
      </div>
    </div>
  );
}
