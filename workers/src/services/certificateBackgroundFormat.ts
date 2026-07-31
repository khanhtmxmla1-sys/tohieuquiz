export type RenderableCertificateBackgroundMime = 'image/png' | 'image/jpeg' | 'image/gif';

function hasPrefix(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function getRenderableCertificateBackgroundMime(
  buffer: ArrayBuffer,
): RenderableCertificateBackgroundMime {
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 8 && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (bytes.length >= 3 && hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (bytes.length >= 6 && hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38])) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12
    && hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    throw new Error(
      'WebP certificate backgrounds are not supported by the PNG renderer. Use PNG or JPEG instead.',
    );
  }

  throw new Error('Unsupported certificate background format. Use PNG or JPEG.');
}
