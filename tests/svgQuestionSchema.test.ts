import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  CommonSvgQuestionFields,
  MAX_SVG_BYTES,
  SvgAltSchema,
  SvgContentSchema,
  SvgVersionSchema,
  addSvgFieldSetIssue,
  hasCompleteSvgFieldSet,
  hasSvgContent,
} from '../src/services/ai/schemas/svgQuestionSchema';

describe('SVG question schema helpers', () => {
  it('validates and normalizes individual SVG fields', () => {
    expect(SvgContentSchema.parse('  <svg></svg>  ')).toBe('<svg></svg>');
    expect(SvgAltSchema.parse('  Hình tròn  ')).toBe('Hình tròn');
    expect(SvgVersionSchema.parse(1)).toBe(1);

    expect(() => SvgContentSchema.parse('')).toThrow();
    expect(() => SvgContentSchema.parse('x'.repeat(MAX_SVG_BYTES + 1))).toThrow();
    expect(() => SvgAltSchema.parse('')).toThrow();
    expect(() => SvgAltSchema.parse('x'.repeat(1_001))).toThrow();
    expect(() => SvgVersionSchema.parse(2)).toThrow();
  });

  it('supports optional common SVG fields', () => {
    const schema = z.object(CommonSvgQuestionFields);
    expect(schema.parse({})).toEqual({});
    expect(schema.parse({
      svgContent: '<svg></svg>',
      svgAlt: 'Hình minh họa',
      svgVersion: 1,
    })).toEqual({
      svgContent: '<svg></svg>',
      svgAlt: 'Hình minh họa',
      svgVersion: 1,
    });
  });

  it('detects meaningful SVG content', () => {
    expect(hasSvgContent('<svg></svg>')).toBe(true);
    expect(hasSvgContent('   ')).toBe(false);
    expect(hasSvgContent(undefined)).toBe(false);
  });

  it('requires SVG metadata to be all-or-none', () => {
    expect(hasCompleteSvgFieldSet({})).toBe(true);
    expect(hasCompleteSvgFieldSet({
      svgContent: '<svg></svg>',
      svgAlt: 'Hình minh họa',
      svgVersion: 1,
    })).toBe(true);
    expect(hasCompleteSvgFieldSet({ svgContent: '<svg></svg>' })).toBe(false);
    expect(hasCompleteSvgFieldSet({
      svgContent: '<svg></svg>',
      svgAlt: '   ',
      svgVersion: 1,
    })).toBe(false);
    expect(hasCompleteSvgFieldSet({
      svgContent: '<svg></svg>',
      svgAlt: 'Hình minh họa',
      svgVersion: 2,
    })).toBe(false);
  });

  it('adds a targeted refinement issue only for incomplete SVG metadata', () => {
    const addIssue = vi.fn();
    const ctx = { addIssue } as unknown as z.RefinementCtx;

    addSvgFieldSetIssue({}, ctx);
    expect(addIssue).not.toHaveBeenCalled();

    addSvgFieldSetIssue({ svgContent: '<svg></svg>' }, ctx);
    expect(addIssue).toHaveBeenCalledWith({
      code: 'custom',
      path: ['svgContent'],
      message: 'Khi có SVG phải cung cấp đủ svgContent, svgAlt và svgVersion = 1.',
    });
  });
});
