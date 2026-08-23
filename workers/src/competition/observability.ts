export interface CompetitionLogSink {
  info(message: string, metadata: Record<string, unknown>): void;
  warn(message: string, metadata: Record<string, unknown>): void;
}

const FORBIDDEN_KEY = /(?:answer|authorization|body|cookie|credential|password|payload|pin|question|secret|token)/i;
const MAX_STRING_LENGTH = 256;

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 50).map(sanitizeValue);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? value.slice(0, MAX_STRING_LENGTH) : value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !FORBIDDEN_KEY.test(key))
      .map(([key, child]) => [key, sanitizeValue(child)]),
  );
}

export function sanitizeCompetitionLogMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeValue(metadata) as Record<string, unknown>;
}

const defaultSink: CompetitionLogSink = {
  info: (message, metadata) => console.info(message, metadata),
  warn: (message, metadata) => console.warn(message, metadata),
};

export function createCompetitionEventLogger(sink: CompetitionLogSink = defaultSink) {
  return {
    info(event: string, metadata: Record<string, unknown>) {
      sink.info(`[Competition] ${event}`, sanitizeCompetitionLogMetadata(metadata));
    },
    warn(event: string, metadata: Record<string, unknown>) {
      sink.warn(`[Competition] ${event}`, sanitizeCompetitionLogMetadata(metadata));
    },
  };
}
