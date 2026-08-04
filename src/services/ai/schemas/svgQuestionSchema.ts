import { z } from 'zod';
import { MAX_SVG_BYTES } from '../../../../shared/svgDiagramSanitizer';

export { MAX_SVG_BYTES };

export const SvgContentSchema = z.string().trim().min(1).max(MAX_SVG_BYTES);
export const SvgAltSchema = z.string().trim().min(1).max(1_000);
export const SvgVersionSchema = z.literal(1);

export const CommonSvgQuestionFields = {
  svgContent: SvgContentSchema.optional(),
  svgAlt: SvgAltSchema.optional(),
  svgVersion: SvgVersionSchema.optional(),
};

export const hasSvgContent = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

export const hasCompleteSvgFieldSet = (value: Record<string, unknown>): boolean => {
  const present = [value.svgContent, value.svgAlt, value.svgVersion]
    .filter((field) => field !== undefined).length;
  if (present === 0) return true;
  return hasSvgContent(value.svgContent)
    && typeof value.svgAlt === 'string'
    && value.svgAlt.trim().length > 0
    && value.svgVersion === 1;
};

export const addSvgFieldSetIssue = (
  value: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void => {
  if (!hasCompleteSvgFieldSet(value)) {
    ctx.addIssue({
      code: 'custom',
      path: ['svgContent'],
      message: 'Khi có SVG phải cung cấp đủ svgContent, svgAlt và svgVersion = 1.',
    });
  }
};
