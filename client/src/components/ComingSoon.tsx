import { Sparkles } from "lucide-react";

type ComingSoonProps = {
  title: string;
  description?: string;
  phase?: string;
};

/**
 * Placeholder for sub-tabs that are registered in navigation but not yet implemented.
 * Used during multi-phase rollouts so the URL + sidebar structure can ship first.
 */
export function ComingSoon({ title, description, phase }: ComingSoonProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-3">
          {description ?? "Esta sección estará disponible muy pronto."}
        </p>
        {phase && (
          <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-muted text-muted-foreground">
            {phase}
          </span>
        )}
      </div>
    </div>
  );
}
