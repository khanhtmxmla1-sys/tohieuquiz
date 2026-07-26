import { useEffect, useMemo, useState } from 'react';

export const useBulkQuestionSelection = (questionIds: string[]) => {
    const [selectionMode, setSelectionModeState] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const availableIds = useMemo(() => new Set(questionIds), [questionIds]);

    useEffect(() => {
        setSelectedIds((current) => {
            const next = new Set(Array.from(current).filter((id) => availableIds.has(id)));
            return next.size === current.size ? current : next;
        });
    }, [availableIds]);

    const setSelectionMode = (enabled: boolean) => {
        setSelectionModeState(enabled);
        if (!enabled) setSelectedIds(new Set());
    };

    const toggle = (id: string) => setSelectedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const selectAll = () => setSelectedIds(new Set(questionIds));
    const clear = () => setSelectedIds(new Set());

    return {
        selectionMode,
        setSelectionMode,
        selectedIds,
        toggle,
        selectAll,
        clear,
    };
};
