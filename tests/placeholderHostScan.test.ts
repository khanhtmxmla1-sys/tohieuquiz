// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findPlaceholderHosts } from '../scripts/check-placeholder-hosts.mjs';

describe('production placeholder-host scan', () => {
  it('ignores JavaScript property access ending in invalid', () => {
    expect(findPlaceholderHosts('result.summary.invalid, next.value')).toEqual([]);
    expect(findPlaceholderHosts('cacheService.invalidate(key)')).toEqual([]);
  });

  it('detects placeholder URLs and quoted hostnames', () => {
    expect(findPlaceholderHosts('fetch("https://api.example.invalid/v1")')).toEqual(['api.example.invalid']);
    expect(findPlaceholderHosts('const host = "assets.invalid";')).toEqual(['assets.invalid']);
    expect(findPlaceholderHosts('src="//cdn.example.invalid/file.js"')).toEqual(['cdn.example.invalid']);
  });

  it('deduplicates repeated placeholder hosts', () => {
    expect(findPlaceholderHosts('https://api.invalid/a https://api.invalid/b')).toEqual(['api.invalid']);
  });
});
