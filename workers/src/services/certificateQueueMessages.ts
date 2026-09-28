export type CertificateQueueMessage =
  | { kind: 'dispatch_batch'; batchId: string }
  | { kind: 'render_certificate'; batchId: string; certificateId: string };

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function normalizeCertificateQueueMessage(body: unknown): CertificateQueueMessage | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const candidate = body as Record<string, unknown>;
  const batchId = nonEmptyString(candidate.batchId);
  if (!batchId) return null;

  if (candidate.kind === 'render_certificate') {
    const certificateId = nonEmptyString(candidate.certificateId);
    return certificateId ? { kind: 'render_certificate', batchId, certificateId } : null;
  }

  if (candidate.kind === 'dispatch_batch' || candidate.kind === undefined) {
    return { kind: 'dispatch_batch', batchId };
  }

  return null;
}
