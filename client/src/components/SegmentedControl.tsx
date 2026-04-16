import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Tailwind class applied to the selected pill (color accent) */
  activeClass?: string;
  /** Optional icon or element rendered before the label */
  icon?: React.ReactNode;
};

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  /** When true, the segmented control occupies the full container width */
  fullWidth?: boolean;
}

/**
 * Button-group style radio control. Single-click selection for discrete status
 * fields (vs. a dropdown Select which requires two clicks). Per-option color
 * accent lets us convey semantic meaning (red=NO, green=SÍ, amber=pending).
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  className,
  disabled,
  fullWidth = false,
}: SegmentedControlProps<T>) {
  const paddingClass = size === "md" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";

  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex rounded-md border border-border/50 bg-muted/20 p-0.5 gap-0.5",
        fullWidth && "w-full",
        className
      )}
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => {
              if (!isActive) onChange(opt.value);
            }}
            className={cn(
              "font-medium rounded-sm transition-colors inline-flex items-center justify-center gap-1.5",
              paddingClass,
              fullWidth && "flex-1",
              isActive
                ? cn("bg-background shadow-sm", opt.activeClass ?? "text-foreground")
                : "text-muted-foreground hover:text-foreground hover:bg-background/40",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
