import { describe, expect, it } from 'vitest';
import { getRenderableCertificateBackgroundMime } from '../workers/src/services/certificateBackgroundFormat';

function asArrayBuffer(bytes: number[]): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

describe('certificate background format guard', () => {
  it('accepts PNG backgrounds used by the certificate renderer', () => {
    const png = asArrayBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(getRenderableCertificateBackgroundMime(png)).toBe('image/png');
  });

  it('rejects WebP before Resvg can silently render a blank background', () => {
    const webp = asArrayBuffer([
      0x52, 0x49, 0x46, 0x46,
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ]);

    expect(() => getRenderableCertificateBackgroundMime(webp)).toThrow(
      /WebP certificate backgrounds are not supported.*PNG or JPEG/i,
    );
  });

  it('rejects unrecognized bytes instead of pretending they are PNG', () => {
    expect(() => getRenderableCertificateBackgroundMime(asArrayBuffer([1, 2, 3, 4]))).toThrow(
      /Unsupported certificate background format/i,
    );
  });
});
