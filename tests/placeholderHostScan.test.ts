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

  it.each([
    ['const marker = Symbol.for("zod.compile.invalid");', []],
    ['const marker = Symbol.for("zod.other.invalid");', ['zod.other.invalid']],
    ['OtherSymbol.for("zod.compile.invalid");', ['zod.compile.invalid']],
    ['object.Symbol.for("zod.compile.invalid");', ['zod.compile.invalid']],
    ['object. Symbol.for("zod.compile.invalid");', ['zod.compile.invalid']],
    ['object . Symbol.for("zod.compile.invalid");', ['zod.compile.invalid']],
    ['fetch("https://zod.compile.invalid/path");', ['zod.compile.invalid']],
    ['const host = \'zod.compile.invalid\';', ['zod.compile.invalid']],
    ['const marker = Symbol.for("zod.compile.invalid"); fetch("https://zod.compile.invalid/path");', ['zod.compile.invalid']],
  ])('handles only a global Zod marker while preserving placeholder hosts: %s', (source, expected) => {
    expect(findPlaceholderHosts(source)).toEqual(expected);
  });

  it('does not ignore marker-shaped text inside a string or template literal', () => {
    expect(findPlaceholderHosts('const source = \'Symbol.for("zod.compile.invalid")\';'))
      .toEqual(['zod.compile.invalid']);
    expect(findPlaceholderHosts('`Symbol.for("zod.compile.invalid")`'))
      .toEqual(['zod.compile.invalid']);
  });
});
