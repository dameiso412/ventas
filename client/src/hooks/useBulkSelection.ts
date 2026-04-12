import { useState, useCallback, useMemo } from "react";

export function useBulkSelection<T extends { id: number }>(items: T[] | undefined) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!items) return;
    setSelectedIds(prev => {
      if (prev.size === items.length && items.length > 0) return new Set();
      return new Set(items.map(i => i.id));
    });
  }, [items]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const isAllSelected = useMemo(
    () => !!items && items.length > 0 && selectedIds.size === items.length,
    [items, selectedIds]
  );

  const isSomeSelected = useMemo(
    () => selectedIds.size > 0 && (!items || selectedIds.size < items.length),
    [items, selectedIds]
  );

  const selectedCount = selectedIds.size;

  const selectedItems = useMemo(
    () => items?.filter(i => selectedIds.has(i.id)) ?? [],
    [items, selectedIds]
  );

  return {
    selectedIds,
    selectedCount,
    selectedItems,
    isAllSelected,
    isSomeSelected,
    toggle,
    toggleAll,
    clear,
  };
}
