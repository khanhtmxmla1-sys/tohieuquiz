import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeo } from '../src/hooks/useSeo';
import { useCompetitionPortalSeo } from '../src/features/competition/portal/public/useCompetitionPortalSeo';

const mocks = vi.hoisted(() => ({
  getCompetition: vi.fn(),
  getArticle: vi.fn(),
}));

vi.mock('../src/features/competition/portal/public/publicCompetitionPortalService', () => ({
  publicCompetitionPortalService: mocks,
}));

const SeoProbe = () => {
  useCompetitionPortalSeo();
  return null;
};

const LegacyAndCompetitionSeoProbe = () => {
  useSeo('/cuoc-thi/san-choi-2026', 'home', null, false);
  useCompetitionPortalSeo();
  return null;
};

const renderSeo = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="*" element={<SeoProbe />} />
    </Routes>
  </MemoryRouter>,
);

const renderLegacyAndCompetitionSeo = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="*" element={<LegacyAndCompetitionSeoProbe />} />
    </Routes>
  </MemoryRouter>,
);

const clearSeoMetadata = () => {
  document.title = '';
  document.head.querySelectorAll(
    'meta[name="description"], meta[name="robots"], meta[name="twitter:title"], '
      + 'meta[name="twitter:description"], meta[property^="og:"], meta[name="twitter:url"], '
      + 'meta[name="twitter:image"], link[rel="canonical"]',
  ).forEach((element) => element.remove());
};

describe('Competition portal SEO metadata', () => {
  beforeEach(() => {
    clearSeoMetadata();
    mocks.getCompetition.mockReset();
    mocks.getArticle.mockReset();
  });

  afterEach(() => {
    clearSeoMetadata();
  });

  it('publishes campaign title, description, canonical and OpenGraph metadata', async () => {
    mocks.getCompetition.mockResolvedValue({
      title: 'Sân chơi Tô Hiệu 2026',
      summary: 'Sáu vòng thi học tập dành cho học sinh.',
      hero: { imageUrl: 'https://example.edu/campaign.jpg' },
    });

    renderSeo('/cuoc-thi/san-choi-2026');

    await waitFor(() => {
      expect(document.title).toBe('Sân chơi Tô Hiệu 2026 - TôHiệuQuiz');
    });
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'Sáu vòng thi học tập dành cho học sinh.',
    );
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${window.location.origin}/cuoc-thi/san-choi-2026`,
    );
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelector('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Sân chơi Tô Hiệu 2026 - TôHiệuQuiz',
    );
    expect(document.head.querySelector('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://example.edu/campaign.jpg',
    );
    expect(mocks.getCompetition).toHaveBeenCalledWith('san-choi-2026');
  });

  it('publishes stable metadata for the public competition index without an API request', async () => {
    renderSeo('/cuoc-thi/');

    await waitFor(() => {
      expect(document.title).toBe('Cuộc thi TôHiệuQuiz');
    });
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'Thông tin các cuộc thi, lịch thi và hoạt động học tập công khai.',
    );
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${window.location.origin}/cuoc-thi/`,
    );
    expect(mocks.getCompetition).not.toHaveBeenCalled();
    expect(mocks.getArticle).not.toHaveBeenCalled();
  });

  it('uses published article fields for article metadata and canonical URL', async () => {
    mocks.getArticle.mockResolvedValue({
      title: 'Thể lệ cuộc thi',
      summary: 'Các quy định chính thức của sân chơi.',
      coverImageUrl: 'https://example.edu/rules.jpg',
    });

    renderSeo('/cuoc-thi/san-choi-2026/tin-tuc/the-le');

    await waitFor(() => {
      expect(document.title).toBe('Thể lệ cuộc thi - TôHiệuQuiz');
    });
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'Các quy định chính thức của sân chơi.',
    );
    expect(document.head.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'article');
    expect(document.head.querySelector('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://example.edu/rules.jpg',
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${window.location.origin}/cuoc-thi/san-choi-2026/tin-tuc/the-le`,
    );
    expect(mocks.getArticle).toHaveBeenCalledWith('san-choi-2026', 'the-le');
    expect(mocks.getCompetition).not.toHaveBeenCalled();
  });

  it('keeps competition metadata after the legacy SEO effect runs', async () => {
    mocks.getCompetition.mockResolvedValue({
      title: 'Sân chơi Tô Hiệu 2026',
      summary: 'Sáu vòng thi học tập dành cho học sinh.',
      hero: { imageUrl: 'https://example.edu/campaign.jpg' },
    });

    renderLegacyAndCompetitionSeo('/cuoc-thi/san-choi-2026');

    await waitFor(() => {
      expect(document.title).toBe('Sân chơi Tô Hiệu 2026 - TôHiệuQuiz');
    });
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    expect(document.head.querySelector('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://example.edu/campaign.jpg',
    );
  });

  it('sets noindex and makes no public API request for every student competition route', async () => {
    renderSeo('/thi/san-choi-2026/vong/2/lam-bai');

    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow, noarchive',
      );
    });
    expect(document.title).toBe('Cổng thi cuộc thi - TôHiệuQuiz');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${window.location.origin}/thi/san-choi-2026/vong/2/lam-bai`,
    );
    expect(mocks.getCompetition).not.toHaveBeenCalled();
    expect(mocks.getArticle).not.toHaveBeenCalled();
  });

  it('keeps a safe fallback when a public campaign is unavailable', async () => {
    mocks.getCompetition.mockRejectedValue(new Error('PRIVATE_CAMPAIGN_DETAILS'));

    renderSeo('/cuoc-thi/hidden-campaign');

    await waitFor(() => {
      expect(document.title).toBe('Cuộc thi - TôHiệuQuiz');
    });
    expect(document.head.querySelector('meta[name="description"]')).not.toHaveAttribute(
      'content',
      expect.stringContaining('PRIVATE_CAMPAIGN_DETAILS'),
    );
  });
});
