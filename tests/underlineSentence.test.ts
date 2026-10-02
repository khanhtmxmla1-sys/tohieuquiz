import { describe, expect, it } from 'vitest';
import {
  buildUnderlineSegments,
  splitUnderlineToken,
} from '../src/domain/underline/underlineSentence';

describe('underline sentence presentation', () => {
  it('preserves whitespace and maps each visible token to its word index', () => {
    const segments = buildUnderlineSegments(
      'Mùa hạ năm nay đến muộn.',
      ['Mùa', 'hạ', 'năm', 'nay', 'đến', 'muộn.'],
    );

    expect(segments.map((segment) => segment.text).join(''))
      .toBe('Mùa hạ năm nay đến muộn.');
    expect(
      segments
        .filter((segment) => segment.kind === 'token')
        .map((segment) => segment.index),
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('keeps punctuation outside the underlinable core', () => {
    expect(splitUnderlineToken('nóng,')).toEqual({
      prefix: '',
      core: 'nóng',
      suffix: ',',
    });
    expect(splitUnderlineToken('(đẹp)')).toEqual({
      prefix: '(',
      core: 'đẹp',
      suffix: ')',
    });
  });

  it('keeps complete TeX delimiters in the underlinable core while splitting trailing punctuation', () => {
    expect(splitUnderlineToken('$x$,')).toEqual({
      prefix: '',
      core: '$x$',
      suffix: ',',
    });
    expect(splitUnderlineToken('“$x$”')).toEqual({
      prefix: '“',
      core: '$x$',
      suffix: '”',
    });
  });

  it('keeps raw TeX commands and symbol-only formulas in the underlinable core', () => {
    expect(splitUnderlineToken(String.raw`\frac{1}{2},`)).toEqual({
      prefix: '',
      core: String.raw`\frac{1}{2}`,
      suffix: ',',
    });
    expect(splitUnderlineToken('$+$,')).toEqual({
      prefix: '',
      core: '$+$',
      suffix: ',',
    });
  });

  it('merges raw and delimited TeX ranges into one underlinable core', () => {
    const formula = String.raw`\frac{1}{2}+$x$`;
    expect(splitUnderlineToken(formula)).toEqual({
      prefix: '',
      core: formula,
      suffix: '',
    });
  });

  it('keeps emoji graphemes and variation-selector symbols out of the core', () => {
    expect(splitUnderlineToken('👩‍💻')).toEqual({
      prefix: '👩‍💻',
      core: '',
      suffix: '',
    });
    expect(splitUnderlineToken('❤️')).toEqual({
      prefix: '❤️',
      core: '',
      suffix: '',
    });
  });

  it('preserves line breaks from sentence', () => {
    const segments = buildUnderlineSegments(
      'Dòng một.\nDòng hai.',
      ['Dòng', 'một.', 'Dòng', 'hai.'],
    );
    expect(segments.map((segment) => segment.text).join(''))
      .toBe('Dòng một.\nDòng hai.');
  });

  it('preserves CRLF, blank lines, and multiple spaces', () => {
    const sentence = 'Dòng một.\r\n\r\nDòng   hai.';
    const segments = buildUnderlineSegments(
      sentence,
      ['Dòng', 'một.', 'Dòng', 'hai.'],
    );

    expect(segments.map((segment) => segment.text).join('')).toBe(sentence);
  });

  it('matches canonically equivalent words without changing source whitespace', () => {
    const sentence = 'Café  déjà\nété.';
    const segments = buildUnderlineSegments(
      sentence,
      ['Cafe\u0301', 'de\u0301ja\u0300', 'e\u0301te\u0301.'],
    );

    expect(segments.map((segment) => segment.text).join('')).toBe(sentence);
    expect(
      segments
        .filter((segment) => segment.kind === 'token')
        .map((segment) => segment.index),
    ).toEqual([0, 1, 2]);
  });

  it('keeps duplicate words as distinct indexes', () => {
    const segments = buildUnderlineSegments(
      'nóng rồi lại nóng',
      ['nóng', 'rồi', 'lại', 'nóng'],
    );
    const tokens = segments.filter((segment) => segment.kind === 'token');
    expect(tokens.map((token) => token.index)).toEqual([0, 1, 2, 3]);
  });

  it('falls back safely when sentence and words are out of sync', () => {
    const segments = buildUnderlineSegments('Câu cũ', ['Câu', 'mới']);
    expect(segments.map((segment) => segment.text).join('')).toBe('Câu mới');
  });
});
