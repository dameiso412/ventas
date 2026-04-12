import { Button } from "@/components/ui/button";
import { Trash2, X, CheckSquare } from "lucide-react";

interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: () => void;
}

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions?: BulkAction[];
  onBulkDelete?: () => void;
}

export function BulkActionBar({ selectedCount, onClear, actions, onBulkDelete }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-lg animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <CheckSquare className="h-4 w-4" />
        <span>{selectedCount} seleccionado{selectedCount !== 1 ? "s" : ""}</span>
      </div>

      <div className="h-4 w-px bg-border/50" />

      {actions?.map((action, i) => (
        <Button
          key={i}
          variant={action.variant || "outline"}
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}

      {onBulkDelete && (
        <Button
          variant="destructive"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => {
            if (confirm(`¿Eliminar ${selectedCount} registro${selectedCount !== 1 ? "s" : ""}? Esta acción no se puede deshacer.`)) {
              onBulkDelete();
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar ({selectedCount})
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs gap-1 ml-auto text-muted-foreground"
        onClick={onClear}
      >
        <X className="h-3.5 w-3.5" />
        Deseleccionar
      </Button>
    </div>
  );
}
