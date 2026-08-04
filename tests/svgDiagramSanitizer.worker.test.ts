import { describe, expect, it } from 'vitest';
import {
  MAX_SVG_BYTES,
  sanitizeSvgDiagram,
} from '../workers/src/services/svgDiagramSanitizer';

const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="25" /></svg>';

describe('sanitizeSvgDiagram', () => {
  it('accepts and normalizes a small allowlisted SVG', () => {
    const result = sanitizeSvgDiagram(validSvg);

    expect(result.ok).toBe(true);
    expect(result.sanitizedSvg).toContain('<svg');
    expect(result.sanitizedSvg).toContain('viewBox="0 0 100 100"');
    expect(result.sanitizedSvg).toContain('<circle');
    expect(result.issues).toEqual([]);
  });

  it.each([
    ['event handler', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"></svg>'],
    ['script', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>'],
    ['foreignObject', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><foreignObject><div>HTML</div></foreignObject></svg>'],
    ['remote image', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="https://evil.example/x.png" /></svg>'],
    ['javascript link', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><a href="javascript:alert(1)">Click</a></svg>'],
    ['remote use', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><use href="https://evil.example/sprite.svg#icon" /></svg>'],
    ['remote paint URL', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2" fill="url(blob:evil)" /></svg>'],
  ])('rejects %s', (_label, payload) => {
    const result = sanitizeSvgDiagram(payload);
    expect(result.ok).toBe(false);
    expect(result.sanitizedSvg).toBeUndefined();
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects missing viewBox and malformed XML', () => {
    expect(sanitizeSvgDiagram('<svg xmlns="http://www.w3.org/2000/svg"><circle /></svg>').ok).toBe(false);
    expect(sanitizeSvgDiagram('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g></svg>').ok).toBe(false);
  });

  it('rejects empty and oversized SVG content', () => {
    expect(sanitizeSvgDiagram('  ').ok).toBe(false);
    const oversized = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>${'a'.repeat(MAX_SVG_BYTES)}</text></svg>`;
    expect(sanitizeSvgDiagram(oversized).ok).toBe(false);
  });

  it('enforces complexity limits', () => {
    const nodes = Array.from({ length: 700 }, (_, index) => `<circle cx="${index}" cy="1" r="1" />`).join('');
    expect(sanitizeSvgDiagram(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 10">${nodes}</svg>`).ok).toBe(false);

    const longPath = `M0 0 ${'L1 1 '.repeat(5_000)}`;
    expect(sanitizeSvgDiagram(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="${longPath}" /></svg>`).ok).toBe(false);
  });
});
