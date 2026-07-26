import { describe, expect, it } from 'vitest';
import {
  normalizeWorksheetMath,
  readableMathExpression,
} from '../src/services/worksheet-export/shared/mathNormalizer';

describe('worksheet math normalization', () => {
  it('converts nested fractions, roots, scripts, and operators to readable plain math', () => {
    const source = String.raw`Giải $\frac{\frac{1}{2}}{\sqrt[3]{8}} + x^2 + a_1 \leq \pi$`;
    const readable = normalizeWorksheetMath(source);

    expect(readable).toContain('(1/2)/(√[3]8)');
    expect(readable).toContain('x^2');
    expect(readable).toContain('a_1');
    expect(readable).toContain('≤ π');
    expect(readable).not.toMatch(/\$|\\(?:frac|sqrt|leq|pi)/);
  });

  it('keeps prose spacing around inline math', () => {
    expect(normalizeWorksheetMath(String.raw`Tính $\frac{1}{2}$ rồi kết luận`))
      .toBe('Tính 1/2 rồi kết luận');
  });

  it('falls back to readable names for unsupported commands instead of raw backslashes', () => {
    const readable = readableMathExpression(String.raw`\unknown{a} + \times 2`);
    expect(readable).not.toContain('\\');
    expect(readable).toContain('unknowna');
    expect(readable).toContain('× 2');
  });
});
