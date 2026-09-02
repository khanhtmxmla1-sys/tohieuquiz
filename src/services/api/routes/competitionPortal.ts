import type { RouteRegistry } from '../types';

const encoded = (value: unknown) => encodeURIComponent(String(value || ''));

export const competitionPortalRoutes: RouteRegistry = {
  list_public_competitions: {
    method: 'GET', auth: 'public', path: () => '/api/public/competitions',
  },
  get_public_competition: {
    method: 'GET', auth: 'public', path: ({ slug }) => `/api/public/competitions/${encoded(slug)}`,
  },
  list_public_competition_articles: {
    method: 'GET', auth: 'public', path: ({ slug }) => `/api/public/competitions/${encoded(slug)}/articles`,
  },
  get_public_competition_article: {
    method: 'GET', auth: 'public',
    path: ({ slug, articleSlug }) => `/api/public/competitions/${encoded(slug)}/articles/${encoded(articleSlug)}`,
  },
  get_public_competition_golden_board: {
    method: 'GET', auth: 'public', path: ({ slug }) => `/api/public/competitions/${encoded(slug)}/golden-board`,
  },
};
