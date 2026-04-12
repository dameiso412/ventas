import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Hook to load team members from the database.
 * Replaces hardcoded SETTERS/CLOSERS constants throughout the app.
 */
export function useTeamMembers() {
  const { data: allMembers = [], isLoading } = trpc.team.list.useQuery({ activo: true });

  const setters = useMemo(
    () => allMembers.filter(m => m.rol === "SETTER" || m.rol === "SETTER_CLOSER").map(m => m.nombre),
    [allMembers]
  );

  const closers = useMemo(
    () => allMembers.filter(m => m.rol === "CLOSER" || m.rol === "SETTER_CLOSER").map(m => m.nombre),
    [allMembers]
  );

  const allNames = useMemo(
    () => allMembers.map(m => m.nombre),
    [allMembers]
  );

  return { allMembers, setters, closers, allNames, isLoading };
}
