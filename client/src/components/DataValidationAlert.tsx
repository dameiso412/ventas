import { trpc } from "@/lib/trpc";
import { AlertTriangle, X, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Props {
  filters: { mes?: string; semana?: number };
}

export function DataValidationAlert({ filters }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { data } = trpc.dashboard.validation.useQuery(filters);

  if (dismissed || !data?.warnings?.length) return null;

  const hasCritical = data.warnings.some((w) => w.severity === "critical");

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        hasCritical
          ? "bg-red-500/10 border-red-500/30 text-red-400"
          : "bg-amber-500/10 border-amber-500/30 text-amber-400"
      }`}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            {data.warnings.length} discrepancia{data.warnings.length > 1 ? "s" : ""} entre Trackers y Registro de Citas
          </span>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:opacity-70 shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1.5 pl-6">
          {data.warnings.map((w, i) => (
            <div
              key={i}
              className={`text-xs flex items-center gap-2 ${
                w.severity === "critical" ? "text-red-400" : "text-amber-400"
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  w.severity === "critical" ? "bg-red-400" : "bg-amber-400"
                }`}
              />
              <span>
                <strong>{w.metric}</strong>: Leads = {w.metric.includes("$") ? `$${w.leads.toLocaleString()}` : w.leads}, Tracker = {w.metric.includes("$") ? `$${w.tracker.toLocaleString()}` : w.tracker}
                {" "}(diferencia: {w.metric.includes("$") ? `$${w.diff.toLocaleString()}` : w.diff})
              </span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground mt-1">
            Los datos de Leads provienen del Registro de Citas (verificable). Los del Tracker son entrada manual.
          </p>
        </div>
      )}
    </div>
  );
}
