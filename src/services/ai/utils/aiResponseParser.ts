/**
 * @module aiResponseParser
 * Utilities for extracting text content from various AI API response formats
 * (OpenAI-compatible, Gemini, proxy wrappers, SSE streams).
 */

/** Deep-walk an AI response value to extract the first non-empty string. */
export const extractTextValue = (value: unknown, depth = 0): string => {
  if (depth > 6 || value == null) return '';

  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    return (value as unknown[])
      .map(item => extractTextValue(item, depth + 1))
      .filter(Boolean)
      .join('');
  }

  if (typeof value !== 'object') return '';

  const obj = value as Record<string, unknown>;
  const candidates = [
    obj.text,
    obj.output_text,
    obj.content,
    obj.parts,
    obj.message,
    obj.delta,
    obj.output,
    obj.response,
    obj.data,
    obj.reasoning,
  ];

  for (const candidate of candidates) {
    const extracted = extractTextValue(candidate, depth + 1);
    if (extracted) return extracted;
  }

  return '';
};

/** Extract text content from an AI API response object. */
export const extractAIContent = (data: unknown): string => {
  if (!data) return '';

  const obj = data as Record<string, unknown>;

  // 1. OpenAI-compatible format
  if (Array.isArray(obj.choices)) {
    for (const choice of obj.choices as Record<string, unknown>[]) {
      const extracted = extractTextValue(
        choice?.message?.['content'] ??
        choice?.message ??
        (choice?.delta as Record<string, unknown>)?.['content'] ??
        choice?.delta ??
        choice?.text
      );
      if (extracted) return extracted;
    }
  }

  // 2. Gemini format
  if (Array.isArray(obj.candidates)) {
    for (const candidate of obj.candidates as Record<string, unknown>[]) {
      const content = candidate?.content as Record<string, unknown> | undefined;
      const extracted = extractTextValue(content?.parts ?? candidate?.content ?? candidate);
      if (extracted) return extracted;
    }
  }

  // 3. Responses-style or other compatible wrappers
  const wrappedText = extractTextValue(
    obj.output_text ?? obj.output ?? obj.response ?? obj.content ?? obj.text
  );
  if (wrappedText) return wrappedText;

  // 4. Nested data (sometimes proxy wraps it)
  if (obj.data) return extractAIContent(obj.data);

  return '';
};

/** Extract a human-readable error message from an AI error response. */
export const extractAIErrorMessage = (data: unknown): string => {
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  const err = obj.error as Record<string, unknown> | undefined;
  const dataErr = (obj.data as Record<string, unknown> | undefined)?.error as Record<string, unknown> | undefined;
  const errors = obj.errors as Record<string, unknown>[] | undefined;

  const message =
    err?.message ||
    dataErr?.message ||
    errors?.[0]?.message ||
    obj.message ||
    obj.detail ||
    '';
  return typeof message === 'string' ? message.trim() : '';
};

/** Returns true when the error indicates we should retry with a different model. */
export const shouldTryNextModel = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();

  return (
    normalized.includes('no capacity available') ||
    normalized.includes('rate_limit_error') ||
    normalized.includes('resource_exhausted') ||
    normalized.includes('model overloaded') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('ai không trả về kết quả nào') ||
    normalized.includes('định dạng openai không xác định')
  );
};
