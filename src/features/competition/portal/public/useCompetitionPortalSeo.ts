import { useEffect } from 'react';
import { useLocation } from 'react-router';
import type {
  PublicCompetitionArticleDto,
  PublicCompetitionDetailDto,
} from '../../../../../shared/competition-portal.contract';
import { publicCompetitionPortalService } from './publicCompetitionPortalService';

const BRAND = 'TôHiệuQuiz';
const PUBLIC_INDEX_TITLE = `Cuộc thi ${BRAND}`;
const PUBLIC_INDEX_DESCRIPTION = 'Thông tin các cuộc thi, lịch thi và hoạt động học tập công khai.';
const STUDENT_TITLE = `Cổng thi cuộc thi - ${BRAND}`;
const STUDENT_DESCRIPTION = 'Khu vực tham gia cuộc thi dành cho học sinh.';

type CompetitionSeoRoute =
  | { kind: 'index' }
  | { kind: 'campaign'; campaignSlug: string }
  | { kind: 'golden-board'; campaignSlug: string }
  | { kind: 'article'; campaignSlug: string; articleSlug: string };

interface CompetitionSeoMetadata {
  title: string;
  description: string;
  imageUrl?: string;
  type: 'website' | 'article';
  robots: 'index, follow' | 'noindex, nofollow, noarchive';
}

const decodeSegment = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getCompetitionSeoRoute = (pathname: string): CompetitionSeoRoute | null => {
  if (pathname === '/cuoc-thi' || pathname === '/cuoc-thi/') return { kind: 'index' };

  const articleMatch = pathname.match(/^\/cuoc-thi\/([^/]+)\/tin-tuc\/([^/]+)(?:\/|$)/);
  if (articleMatch) {
    return {
      kind: 'article',
      campaignSlug: decodeSegment(articleMatch[1]),
      articleSlug: decodeSegment(articleMatch[2]),
    };
  }

  const goldenBoardMatch = pathname.match(/^\/cuoc-thi\/([^/]+)\/bang-vang(?:\/|$)/);
  if (goldenBoardMatch) {
    return { kind: 'golden-board', campaignSlug: decodeSegment(goldenBoardMatch[1]) };
  }

  const campaignMatch = pathname.match(/^\/cuoc-thi\/([^/]+)(?:\/|$)/);
  if (campaignMatch) {
    return { kind: 'campaign', campaignSlug: decodeSegment(campaignMatch[1]) };
  }

  return null;
};

const withBrand = (title: string): string => (
  title.includes(BRAND) ? title : `${title} - ${BRAND}`
);

const upsertMetaByName = (name: string, content: string) => {
  let tag = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertMetaByProperty = (property: string, content: string) => {
  let tag = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const removeMetaByProperty = (property: string) => {
  document.head.querySelector(`meta[property="${property}"]`)?.remove();
};

const upsertCanonical = (href: string) => {
  const links = Array.from(document.head.querySelectorAll('link[rel="canonical"]')) as HTMLLinkElement[];
  const [canonical, ...duplicates] = links;
  duplicates.forEach((link) => link.remove());
  const tag = canonical || document.createElement('link');
  if (!canonical) {
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
};

const applyMetadata = (pathname: string, metadata: CompetitionSeoMetadata) => {
  const canonicalUrl = new URL(pathname, window.location.origin).toString();
  document.title = metadata.title;
  upsertMetaByName('description', metadata.description);
  upsertMetaByName('robots', metadata.robots);
  upsertMetaByName('twitter:title', metadata.title);
  upsertMetaByName('twitter:description', metadata.description);
  upsertMetaByName('twitter:card', metadata.imageUrl ? 'summary_large_image' : 'summary');
  upsertMetaByProperty('og:title', metadata.title);
  upsertMetaByProperty('og:description', metadata.description);
  upsertMetaByProperty('og:type', metadata.type);
  upsertMetaByProperty('og:url', canonicalUrl);
  upsertMetaByProperty('og:site_name', BRAND);
  upsertMetaByName('twitter:url', canonicalUrl);
  upsertCanonical(canonicalUrl);

  if (metadata.imageUrl) {
    upsertMetaByProperty('og:image', metadata.imageUrl);
    upsertMetaByName('twitter:image', metadata.imageUrl);
  } else {
    removeMetaByProperty('og:image');
    document.head.querySelector('meta[name="twitter:image"]')?.remove();
  }
};

const fallbackMetadata = (route: CompetitionSeoRoute): CompetitionSeoMetadata => {
  switch (route.kind) {
    case 'index':
      return {
        title: PUBLIC_INDEX_TITLE,
        description: PUBLIC_INDEX_DESCRIPTION,
        type: 'website',
        robots: 'index, follow',
      };
    case 'campaign':
      return {
        title: `Cuộc thi - ${BRAND}`,
        description: 'Thông tin cuộc thi công khai trên TôHiệuQuiz.',
        type: 'website',
        robots: 'index, follow',
      };
    case 'golden-board':
      return {
        title: `Bảng vàng cuộc thi - ${BRAND}`,
        description: 'Danh sách người đạt giải được công bố chính thức.',
        type: 'website',
        robots: 'index, follow',
      };
    case 'article':
      return {
        title: `Tin tức cuộc thi - ${BRAND}`,
        description: 'Tin tức và thông tin công khai của cuộc thi.',
        type: 'article',
        robots: 'index, follow',
      };
  }
};

const campaignMetadata = (campaign: PublicCompetitionDetailDto): CompetitionSeoMetadata => ({
  title: withBrand(campaign.title),
  description: campaign.summary || campaign.title,
  ...(campaign.hero.imageUrl ? { imageUrl: campaign.hero.imageUrl } : {}),
  type: 'website',
  robots: 'index, follow',
});

const articleMetadata = (article: PublicCompetitionArticleDto): CompetitionSeoMetadata => ({
  title: withBrand(article.title),
  description: article.summary || article.title,
  ...(article.coverImageUrl ? { imageUrl: article.coverImageUrl } : {}),
  type: 'article',
  robots: 'index, follow',
});

export const useCompetitionPortalSeo = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    let active = true;

    if (pathname === '/thi' || pathname.startsWith('/thi/')) {
      applyMetadata(pathname, {
        title: STUDENT_TITLE,
        description: STUDENT_DESCRIPTION,
        type: 'website',
        robots: 'noindex, nofollow, noarchive',
      });
      return () => {
        active = false;
      };
    }

    const route = getCompetitionSeoRoute(pathname);
    if (!route) {
      return () => {
        active = false;
      };
    }

    applyMetadata(pathname, fallbackMetadata(route));
    if (route.kind === 'index') {
      return () => {
        active = false;
      };
    }

    const request = route.kind === 'article'
      ? publicCompetitionPortalService.getArticle(route.campaignSlug, route.articleSlug)
      : route.kind === 'campaign'
        ? publicCompetitionPortalService.getCompetition(route.campaignSlug)
        : publicCompetitionPortalService.getCompetition(route.campaignSlug);

    void request
      .then((value) => {
        if (!active) return;
        applyMetadata(
          pathname,
          route.kind === 'article'
            ? articleMetadata(value as PublicCompetitionArticleDto)
            : campaignMetadata(value as PublicCompetitionDetailDto),
        );
      })
      .catch(() => {
        // The route remains safely indexable with generic metadata when its public data is unavailable.
      });

    return () => {
      active = false;
    };
  }, [pathname]);
};
