import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSeo } from '../src/hooks/useSeo';
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

const SeoProbe = ({ pathname, view = 'home', selectedQuiz = null }: {
  pathname: string;
  view?: string;
  selectedQuiz?: any;
}) => {
  useSeo(pathname, view, selectedQuiz, false);
  return null;
};

const canonicalHref = () =>
  document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

describe('Tô Hiệu route SEO metadata', () => {
  it('brands the home page for Trường Tiểu học Tô Hiệu Sơn La', () => {
    render(<SeoProbe pathname="/" />);
    expect(document.title).toBe('Trường Tiểu học Tô Hiệu Sơn La | TôHiệuQuiz');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toContain('Trường Tiểu học Tô Hiệu');
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toContain('Sơn La');
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    expect(canonicalHref()).toBe(`${window.location.origin}/`);
  });

  it('publishes dedicated metadata for the school profile route', () => {
    render(<SeoProbe pathname="/truong-tieu-hoc-to-hieu-son-la" />);
    expect(document.title).toBe('Trường Tiểu học Tô Hiệu Sơn La | Giới thiệu chính thức');
    expect(canonicalHref()).toBe(
      `${window.location.origin}/truong-tieu-hoc-to-hieu-son-la`,
    );
    const jsonLd = JSON.parse(document.getElementById('seo-jsonld')?.textContent || '{}');
    expect(JSON.stringify(jsonLd)).toContain('Trường Tiểu học Tô Hiệu');
    expect(JSON.stringify(jsonLd)).toContain('H52.101.114');
    expect(JSON.stringify(jsonLd)).toContain('thtohieu.tohieu@sonla.gov.vn');
  });

  it('never indexes a quiz-id view', () => {
    const quiz = {
      id: 'private-quiz-1',
      title: 'Đề nội bộ',
      classLevel: '3',
      category: 'toan',
      questions: [],
    };
    render(<SeoProbe pathname="/" view="student" selectedQuiz={quiz} />);
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow, noarchive',
    );
  });
});
