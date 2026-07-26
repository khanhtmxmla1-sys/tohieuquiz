import { describe, expect, it } from 'vitest';
import {
  analyzeMathText,
  hasMathSyntax,
  normalizeMathText,
} from '../src/utils/mathText';

describe('math text normalization', () => {
  it('preserves valid display math delimiters', () => {
    const input = '$$\\frac{1}{2} + \\sqrt{9}$$';
    expect(normalizeMathText(input)).toBe(input);
  });

  it('wraps common unwrapped TeX commands without changing surrounding prose', () => {
    expect(normalizeMathText('Tính \\frac{1}{2} + \\sqrt{9}.')).toBe(
      'Tính $\\frac{1}{2}$ + $\\sqrt{9}$.',
    );
  });

  it('wraps nested unwrapped TeX commands as one valid expression', () => {
    expect(normalizeMathText('Giá trị \\frac{\\sqrt{2}}{2}.')).toBe(
      'Giá trị $\\frac{\\sqrt{2}}{2}$.',
    );
  });

  it('repairs narrowly scoped legacy closing-dollar mistakes', () => {
    expect(normalizeMathText('$\\frac{4}{9}$ < \\frac{7}{9}$')).toBe(
      '$\\frac{4}{9}$ < $\\frac{7}{9}$',
    );
    expect(normalizeMathText('$\\frac{5}{5}$ = 1$')).toBe('$\\frac{5}{5}$ = 1');
    expect(normalizeMathText('Tìm: $\\frac{3}{5}$ = \\frac{x}{15}$ là')).toBe(
      'Tìm: $\\frac{3}{5}$ = $\\frac{x}{15}$ là',
    );
  });

  it('repairs common single-vs-double-dollar mismatches', () => {
    expect(normalizeMathText('$\\frac{1}{2}$$')).toBe('$\\frac{1}{2}$');
    expect(normalizeMathText('$$\\sqrt{4}$')).toBe('$\\sqrt{4}$');
  });

  it('does not reinterpret dates, URLs, markdown emphasis, or ordinary slashes', () => {
    const input = 'Ngày 16/7/2026, xem https://example.com/a/b và *lưu ý* phép 12 / 3.';
    expect(normalizeMathText(input)).toBe(input);
  });

  it('recognizes raw TeX commands even before they are wrapped', () => {
    expect(hasMathSyntax('Giá trị là \\frac{3}{4}')).toBe(true);
    expect(hasMathSyntax('Nội dung bình thường')).toBe(false);
  });
});

describe('math syntax analysis', () => {
  it('accepts valid inline and display math', () => {
    expect(analyzeMathText('$x^2$ và $$\\frac{1}{2}$$')).toEqual([]);
  });

  it('detects unclosed delimiters', () => {
    expect(analyzeMathText('Tính $\\frac{1}{2}')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unclosed-delimiter' }),
      ]),
    );
  });

  it('detects unbalanced braces and malformed fraction arguments', () => {
    expect(analyzeMathText('$\\frac{1}{2$')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unbalanced-braces' }),
      ]),
    );
    expect(analyzeMathText('$\\frac[1]{2}$')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'malformed-command' }),
      ]),
    );
    expect(analyzeMathText('Tính \\frac{1}{2')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unbalanced-braces' }),
      ]),
    );
  });
});