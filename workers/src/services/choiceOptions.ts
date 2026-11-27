/**
 * Read the historical formats used by the questions.options column.
 *
 * Newer rows may contain an array or a JSON-encoded array while legacy D1 rows
 * contain pipe-separated text.  Keep the parser value-preserving so each
 * caller can apply its own projection (text DTO, live-exam strings, or
 * practice presentation objects).
 */
export const parseChoiceOptions = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];

  const normalized = value.trim();
  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to the legacy D1 representation.
  }

  // Keep the legacy split semantics for callers that historically preserved
  // spaces inside each option. Callers that intentionally trim the whole
  // field can pass a trimmed string before invoking this helper.
  return value.includes('|') ? value.split('|') : [];
};
