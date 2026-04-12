import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/hooks/useTeamMembers";

interface TeamMemberSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  role?: "SETTER" | "CLOSER";
  placeholder?: string;
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Reusable select component that loads team members from the database.
 * Replaces all hardcoded setter/closer name inputs across the platform.
 */
export function TeamMemberSelect({
  value,
  onValueChange,
  role,
  placeholder = "Seleccionar...",
  includeAll = false,
  allLabel = "Todos",
  className,
  disabled,
}: TeamMemberSelectProps) {
  const { setters, closers, allNames } = useTeamMembers();

  const names = role === "SETTER" ? setters : role === "CLOSER" ? closers : allNames;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{allLabel}</SelectItem>}
        {names.map(name => (
          <SelectItem key={name} value={name}>{name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
