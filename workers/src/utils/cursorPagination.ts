import { normalizeCollectionLimit } from '../../../shared/pagination.contract';

interface CursorPayload {
  version: 1;
  scope: string;
  values: string[];
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function encodeCollectionCursor(scope: string, values: Array<string | number>): string {
  return encodeBase64Url(JSON.stringify({
    version: 1,
    scope,
    values: values.map((value) => String(value)),
  } satisfies CursorPayload));
}

export function decodeCollectionCursor(
  value: string | null,
  scope: string,
  expectedValues: number,
): string[] | null {
  if (!value) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(value)) as Partial<CursorPayload>;
    if (payload.version !== 1
      || payload.scope !== scope
      || !Array.isArray(payload.values)
      || payload.values.length !== expectedValues
      || payload.values.some((item) => typeof item !== 'string' || item.length > 500)) {
      throw new Error('invalid cursor payload');
    }
    return payload.values;
  } catch {
    throw new Error('cursor không hợp lệ');
  }
}

export function collectionLimit(url: URL, aliases: string[] = []): number {
  const raw = url.searchParams.get('limit')
    ?? aliases.map((alias) => url.searchParams.get(alias)).find((value) => value !== null)
    ?? undefined;
  return normalizeCollectionLimit(raw);
}
