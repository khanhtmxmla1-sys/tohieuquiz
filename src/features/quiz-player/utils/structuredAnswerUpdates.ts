export type MatchingSelectionSide = 'left' | 'right';

const asAnswerRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
);

export const updateMatchingAnswer = (
  current: unknown,
  item: string,
  side: MatchingSelectionSide,
): Record<string, unknown> => {
  const next = asAnswerRecord(current);

  if (side === 'left') {
    if (next.selectedLeft === item) delete next.selectedLeft;
    else next.selectedLeft = item;
    return next;
  }

  const selectedLeft = typeof next.selectedLeft === 'string' ? next.selectedLeft : '';
  if (!selectedLeft) return next;

  Object.entries(next).forEach(([leftId, rightId]) => {
    if (
      leftId !== selectedLeft
      && leftId !== 'selectedLeft'
      && leftId !== '__shuffledIds'
      && rightId === item
    ) {
      delete next[leftId];
    }
  });

  next[selectedLeft] = item;
  delete next.selectedLeft;
  return next;
};

export const updateOrderingRanks = (
  current: Record<string, number>,
  itemId: string,
  rank: number | null,
): Record<string, number> => {
  const next = { ...current };
  if (rank === null) {
    delete next[itemId];
    return next;
  }

  Object.entries(next).forEach(([otherItemId, otherRank]) => {
    if (otherItemId !== itemId && otherRank === rank) delete next[otherItemId];
  });
  next[itemId] = rank;
  return next;
};
