import { describe, expect, it } from 'vitest';
import {
  BRAND_RELATIONSHIP_LINE,
  SCHOOL_IDENTIFIER,
  SCHOOL_LOCATION_LABEL,
  SCHOOL_NAME,
  SCHOOL_OFFICIAL_EMAIL,
  SCHOOL_PROFILE_PATH,
  SITE_URL,
} from '../src/config/schoolIdentity';

describe('Tô Hiệu brand SEO identity', () => {
  it('keeps one canonical school identity', () => {
    expect(SCHOOL_NAME).toBe('Trường Tiểu học Tô Hiệu');
    expect(SCHOOL_LOCATION_LABEL).toBe('Phường Tô Hiệu, tỉnh Sơn La');
    expect(SCHOOL_IDENTIFIER).toBe('H52.101.114');
    expect(SCHOOL_OFFICIAL_EMAIL).toBe('thtohieu.tohieu@sonla.gov.vn');
    expect(SCHOOL_PROFILE_PATH).toBe('/truong-tieu-hoc-to-hieu-son-la');
    expect(SITE_URL).toBe('https://www.thtohieu.com');
    expect(BRAND_RELATIONSHIP_LINE).toContain('Trường Tiểu học Tô Hiệu');
    expect(BRAND_RELATIONSHIP_LINE).toContain('Sơn La');
  });
});
