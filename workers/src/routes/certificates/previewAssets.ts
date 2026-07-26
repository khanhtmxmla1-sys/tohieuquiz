import type { FieldConfig } from '../../types/certificates';

export interface PreviewFontAsset {
  r2Name: string;
  family: string;
  weight: '400' | '700';
  style: 'normal' | 'italic';
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

export function imageMime(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return 'image/png';
}

export function previewFontAssets(fieldsConfig: FieldConfig[]): PreviewFontAsset[] {
  const assets = new Map<string, PreviewFontAsset>();
  for (const field of fieldsConfig) {
    const configuredFamily = field.fontFamily ?? 'Roboto';
    const family = [
      'Spectral',
      'Great Vibes',
      'Dancing Script',
      'Playwrite VN',
      'Allura',
      'Alex Brush',
      'Roboto',
    ].includes(configuredFamily)
      ? configuredFamily
      : 'Roboto';
    const weight = field.fontWeight === 'bold' ? '700' : '400';
    const style = field.fontStyle === 'italic' ? 'italic' : 'normal';
    let r2Name: string;
    if (family === 'Spectral') {
      r2Name = weight === '700' && style === 'italic'
        ? 'Spectral-BoldItalic'
        : weight === '700' ? 'Spectral-Bold' : 'Spectral-Regular';
    } else if (family === 'Great Vibes') {
      r2Name = 'GreatVibes-Regular';
    } else if (family === 'Dancing Script') {
      r2Name = 'DancingScript-Bold';
    } else if (family === 'Playwrite VN') {
      r2Name = 'PlaywriteVN-Regular';
    } else if (family === 'Allura') {
      r2Name = 'Allura-Regular';
    } else if (family === 'Alex Brush') {
      r2Name = 'AlexBrush-Regular';
    } else {
      r2Name = weight === '700' ? 'Roboto-Bold' : 'Roboto-Regular';
    }
    assets.set(`${family}:${weight}:${style}`, { r2Name, family, weight, style });
  }
  return [...assets.values()];
}
