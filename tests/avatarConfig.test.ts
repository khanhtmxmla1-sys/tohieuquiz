import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AVATAR_LIST, getAvatarUrl } from '../src/config/avatars';

const cloudinaryBase = import.meta.env.VITE_CLOUDINARY_AVATAR_BASE_URL?.trim().replace(/\/+$/, '') || '';
const cloudinaryFolder = import.meta.env.VITE_CLOUDINARY_AVATAR_FOLDER?.trim().replace(/^\/+|\/+$/g, '') || '';
const usesCloudinary = Boolean(cloudinaryBase && cloudinaryFolder);

describe('student avatar configuration', () => {
  it('maps all supported IDs to distinct assets in the configured mode', () => {
    expect(AVATAR_LIST).toHaveLength(14);
    const urls = AVATAR_LIST.map((avatar) => avatar.url);

    expect(new Set(urls).size).toBe(14);

    if (usesCloudinary) {
      for (const avatar of AVATAR_LIST) {
        expect(avatar.url).toBe(
          `${cloudinaryBase}/w_200,h_200,c_fill,f_auto,q_auto/${cloudinaryFolder}/${avatar.id}`,
        );
        expect(avatar.url).toMatch(/^https:\/\//);
      }
      expect(getAvatarUrl('girl_07')).toBe(
        `${cloudinaryBase}/w_200,h_200,c_fill,f_auto,q_auto/${cloudinaryFolder}/girl_07`,
      );
      expect(getAvatarUrl('boy_04')).toBe(
        `${cloudinaryBase}/w_200,h_200,c_fill,f_auto,q_auto/${cloudinaryFolder}/boy_04`,
      );
      return;
    }

    expect(getAvatarUrl('girl_07')).toBe('/avatars/students/girl_07.webp');
    expect(getAvatarUrl('boy_04')).toBe('/avatars/students/boy_04.webp');
  });

  it('ships every configured local image within the size budget in local mode', () => {
    if (usesCloudinary) return;

    for (const avatar of AVATAR_LIST) {
      const file = join(process.cwd(), 'public', avatar.url.replace(/^\//, ''));

      expect(existsSync(file), `${avatar.id} is missing`).toBe(true);
      expect(statSync(file).size, `${avatar.id} exceeds 150 KB`).toBeLessThanOrEqual(150_000);
    }
  });

  it('keeps the established fallback for empty and invalid IDs', () => {
    expect(getAvatarUrl()).toBe(getAvatarUrl('girl_01'));
    expect(getAvatarUrl('not-a-known-avatar')).toBe(getAvatarUrl('girl_01'));
  });
});
