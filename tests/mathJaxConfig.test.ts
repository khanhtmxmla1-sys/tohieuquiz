import { describe, expect, it } from 'vitest';
import { mathJaxConfig } from '../src/config/mathJaxConfig';

describe('mathJaxConfig', () => {
  it('does not reload extensions already bundled by input/tex', () => {
    expect(mathJaxConfig.loader.load).toEqual([
      'input/tex',
      'output/chtml',
      '[tex]/noerrors',
    ]);
    expect(mathJaxConfig.loader.load).not.toContain('[tex]/ams');
    expect(mathJaxConfig.loader.load).not.toContain('[tex]/noundefined');
    expect(mathJaxConfig.tex.packages).toEqual({ '[+]': ['noerrors'] });
  });

  it('preserves existing delimiter and HTML processing rules', () => {
    expect(mathJaxConfig.tex.inlineMath).toEqual([
      ['$', '$'],
      ['\\(', '\\)'],
    ]);
    expect(mathJaxConfig.tex.displayMath).toEqual([
      ['$$', '$$'],
      ['\\[', '\\]'],
    ]);
    expect(mathJaxConfig.tex.processEscapes).toBe(true);
    expect(mathJaxConfig.options).toEqual({
      ignoreHtmlClass: 'tex2jax_ignore',
      processHtmlClass: 'tex2jax_process',
    });
  });
});
