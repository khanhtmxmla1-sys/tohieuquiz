export type HostContext = 'parent' | 'main';

export function isDedicatedParentHost(hostname: string): boolean {
  return hostname.trim().toLowerCase().startsWith('phuhuynh.');
}

export function resolveHostContext(hostname: string, search = ''): HostContext {
  const normalized = hostname.trim().toLowerCase();
  if (isDedicatedParentHost(normalized)) return 'parent';
  if (
    (normalized === 'localhost' || normalized === '127.0.0.1')
    && new URLSearchParams(search).get('portal') === 'parent'
  ) return 'parent';
  return 'main';
}
