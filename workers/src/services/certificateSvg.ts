import type { FieldConfig } from '../types/certificates';

type DynamicFieldKey = Exclude<FieldConfig['key'], 'static_text'>;
export type CertificateTextData = Record<DynamicFieldKey, string>;

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fittedFontSize(value: string, field: FieldConfig): number {
  const configuredSize = field.fontSize ?? 32;
  if (!field.maxWidth) return configuredSize;
  const widthFactorByFamily: Record<string, number> = {
    'Great Vibes': 0.43,
    'Dancing Script': 0.52,
    'Playwrite VN': 0.55,
    Allura: 0.48,
    'Alex Brush': 0.47,
  };
  const widthFactor = widthFactorByFamily[field.fontFamily ?? 'Roboto'] ?? 0.55;
  const estimatedWidth = Array.from(value).length * configuredSize * widthFactor;
  if (estimatedWidth <= field.maxWidth) return configuredSize;
  return Math.round((configuredSize * field.maxWidth / estimatedWidth) * 100) / 100;
}

export function buildCertificateSvg(bgHref: string, fieldsConfig: FieldConfig[], data: CertificateTextData, width: number, height: number): string {
  const textNodes = fieldsConfig.map((field) => {
    let rawValue = field.key === 'static_text' ? field.text : data[field.key];
    if (rawValue === undefined || rawValue === null || rawValue === '') return '';
    if (field.format === 'vi-long-date') {
      const parts = String(rawValue).split('/');
      if (parts.length === 3) rawValue = `${Number(parts[0])} tháng ${Number(parts[1])} năm ${parts[2]}`;
    }
    const value = `${field.prefix ?? ''}${rawValue}${field.suffix ?? ''}`;
    const anchor = field.align === 'left' ? 'start' : field.align === 'right' ? 'end' : 'middle';
    const fontSize = fittedFontSize(value, field);
    return `<text x="${field.x}" y="${field.y}" font-family="${escapeXml(field.fontFamily ?? 'Roboto')}" font-size="${fontSize}" font-weight="${field.fontWeight === 'bold' ? '700' : '400'}" font-style="${field.fontStyle ?? 'normal'}" fill="${field.color ?? '#000000'}" text-anchor="${anchor}" dominant-baseline="${field.baseline ?? 'middle'}">${escapeXml(value)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image href="${bgHref}" xlink:href="${bgHref}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>${textNodes}</svg>`;
}
