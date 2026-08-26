// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const portalService = vi.hoisted(() => ({
  resolveStudentCompetitionBySlug: vi.fn(),
  getPublicPageForStaff: vi.fn(),
  updatePublicPageDraft: vi.fn(),
}));

vi.mock('../workers/src/competition/studentPortalService', () => ({
  ...portalService,
  preflightStudentCompetitionRound: vi.fn(),
  preflightStudentCompetitionSchoolExam: vi.fn(),
  STUDENT_COMPETITION_PORTAL_NOT_FOUND: 'STUDENT_COMPETITION_PORTAL_NOT_FOUND',
  STUDENT_COMPETITION_PORTAL_UNAVAILABLE: 'STUDENT_COMPETITION_PORTAL_UNAVAILABLE',
}));
vi.mock('../workers/src/competition/publicPageService', () => ({
  archivePublicPage: vi.fn(),
  getPublishedPublicPageProjectionBySlug: vi.fn(async () => ({
    campaignId: 'campaign-1', slug: 'campaign-one', title: 'Campaign One', summary: 'Summary',
    schoolYear: '2026-2027', startsAt: '2026-08-01T00:00:00.000Z',
    endsAt: '2026-09-01T00:00:00.000Z', timezone: 'Asia/Ho_Chi_Minh',
    heroTitle: 'Campaign One', heroSubtitle: null, heroImageUrl: null,
    ctaLabel: 'VÀO THI', articleSummaryAvailable: false,
    updatedAt: '2026-08-25T00:00:00.000Z',
  })),
  getPublicPageForStaff: portalService.getPublicPageForStaff,
  listPublishedPublicPageProjections: vi.fn(async () => []),
  previewPublicPage: vi.fn(),
  publishPublicPage: vi.fn(),
  updatePublicPageDraft: portalService.updatePublicPageDraft,
}));
vi.mock('../workers/src/competition/competitionArticleService', () => ({
  createCompetitionArticle: vi.fn(), deleteCompetitionArticle: vi.fn(),
  getCompetitionArticleForStaff: vi.fn(), getPublishedCompetitionArticle: vi.fn(),
  listCompetitionArticlesForStaff: vi.fn(), listPublishedCompetitionArticles: vi.fn(async () => []),
  updateCompetitionArticle: vi.fn(),
}));
vi.mock('../workers/src/competition/goldenBoardService', () => ({ getPublicGoldenBoard: vi.fn() }));
vi.mock('../workers/src/competition/goldenBoardConfigService', () => ({
  activateAwardRuleVersion: vi.fn(), createAwardRuleVersion: vi.fn(),
  getGoldenBoardConfig: vi.fn(), listAwardRuleVersions: vi.fn(), updateGoldenBoardConfig: vi.fn(),
}));
vi.mock('../workers/src/competition/campaignService', () => ({
  competitionAudienceIntersectsClassScope: vi.fn(async () => true),
  getCompetitionCampaign: vi.fn(async () => ({ id: 'campaign-1' })),
}));

import {
  COMPETITION_PORTAL_FEATURE_DISABLED,
  COMPETITION_PORTAL_FLAGS,
  isCompetitionLegacyRedirectEnabled,
  isCompetitionStudentPortalEnabled,
} from '../workers/src/competition/portalFeatureFlags';
import { handlePublicCompetitionRoutes } from '../workers/src/routes/publicCompetitions';
import { handleCompetitionPortalRoutes } from '../workers/src/routes/competitions/portalRoutes';
import { handleStudentCompetitionPortalRoutes } from '../workers/src/routes/competitions/studentPortalRoutes';

type FlagKey = typeof COMPETITION_PORTAL_FLAGS[keyof typeof COMPETITION_PORTAL_FLAGS];

function flagRow(
  key: FlagKey,
  enabled: boolean,
  overrides: Partial<Record<'audience' | 'percentage' | 'allow_users_json', unknown>> = {},
) {
  return {
    flag_key: key, description: key, enabled: enabled ? 1 : 0, owner: 'competition', version: 1,
    audience: overrides.audience ?? 'all', percentage: overrides.percentage ?? 100,
    allow_users_json: overrides.allow_users_json ?? '[]', allow_classes_json: '[]',
    starts_at: null, ends_at: null, stop_conditions_json: '{}', reason: 'test',
    updated_by: 'test', updated_at: '2026-08-25T00:00:00.000Z',
  };
}

function dbWithFlags(
  values: Partial<Record<FlagKey, boolean>>,
  rows: Partial<Record<FlagKey, ReturnType<typeof flagRow>>> = {},
): D1Database {
  return {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...next: unknown[]) { bindings = next; return this; },
        async first() {
          const key = bindings[0] as FlagKey;
          if (Object.hasOwn(rows, key)) return rows[key] ?? null;
          return Object.hasOwn(values, key) ? flagRow(key, Boolean(values[key])) : null;
        },
        async all() {
          if (sql.includes('FROM competition_rounds')) {
            return {
              results: Array.from({ length: 6 }, (_, index) => ({
                round_number: index + 1,
                opens_at: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
                closes_at: `2026-08-${String(index + 2).padStart(2, '0')}T00:00:00.000Z`,
                status: 'OPEN',
              })),
            };
          }
          return { results: [] };
        },
      };
    },
  } as unknown as D1Database;
}

const allEnabled = Object.fromEntries(
  Object.values(COMPETITION_PORTAL_FLAGS).map((key) => [key, true]),
) as Record<FlagKey, boolean>;

beforeEach(() => {
  vi.clearAllMocks();
  portalService.resolveStudentCompetitionBySlug.mockResolvedValue({ competition: { id: 'campaign-1' } });
  portalService.getPublicPageForStaff.mockResolvedValue({ id: 'page-1' });
  portalService.updatePublicPageDraft.mockResolvedValue({ id: 'page-1' });
});

describe('Competition portal feature gates', () => {
  it('fails closed for missing/erroring flags and produces an independent legacy redirect helper', async () => {
    const missing = dbWithFlags({});
    expect(await isCompetitionLegacyRedirectEnabled(missing, { role: 'student', username: 'student-1' }))
      .toBe(false);

    const broken = { prepare: () => { throw new Error('database unavailable'); } } as unknown as D1Database;
    expect(await isCompetitionLegacyRedirectEnabled(broken, { role: 'student', username: 'student-1' }))
      .toBe(false);

    const enabled = dbWithFlags({ [COMPETITION_PORTAL_FLAGS.legacyRedirect]: true });
    expect(await isCompetitionLegacyRedirectEnabled(enabled, { role: 'student', username: 'student-1' }))
      .toBe(true);
  });

  it('hides all public reads behind the generic 404 while leaving the staff namespace untouched', async () => {
    const db = dbWithFlags({ ...allEnabled, [COMPETITION_PORTAL_FLAGS.publicRead]: false });
    const response = await handlePublicCompetitionRoutes(
      new Request('https://example.test/api/public/competitions'),
      { DB: db } as any,
      '/api/public/competitions',
      'GET',
    );
    expect(response?.status).toBe(404);
    expect(await response?.json()).toEqual({ status: 'error', message: 'Not found' });
    expect(await handleCompetitionPortalRoutes(
      new Request('https://example.test/api/competitions/campaign-1/public-page'), db,
      '/api/competitions/campaign-1/public-page', 'GET',
      { username: 'admin', role: 'admin' } as any, undefined,
    )).toMatchObject({ status: 200 });
  });

  it('keeps public campaign reads available when only Golden Board is disabled', async () => {
    const db = dbWithFlags({ ...allEnabled, [COMPETITION_PORTAL_FLAGS.goldenBoard]: false });
    const detail = await handlePublicCompetitionRoutes(
      new Request('https://example.test/api/public/competitions/campaign-one'), { DB: db } as any,
      '/api/public/competitions/campaign-one', 'GET',
    );
    expect(detail?.status).toBe(200);

    const board = await handlePublicCompetitionRoutes(
      new Request('https://example.test/api/public/competitions/campaign-one/golden-board'), { DB: db } as any,
      '/api/public/competitions/campaign-one/golden-board', 'GET',
    );
    expect(board?.status).toBe(404);
    expect(await board?.json()).toEqual({ status: 'error', message: 'Not found' });
  });

  it('disables only Student portal adapter/preflight surfaces, not canonical Student routes', async () => {
    const db = dbWithFlags({ ...allEnabled, [COMPETITION_PORTAL_FLAGS.studentPortal]: false });
    const paths: Array<[string, string]> = [
      ['/api/student/competitions/by-slug/campaign-one', 'GET'],
      ['/api/student/competitions/campaign-1/rounds/round-1/preflight', 'POST'],
      ['/api/student/competitions/campaign-1/school-exam/preflight', 'POST'],
    ];
    for (const [path, method] of paths) {
      const response = await handleStudentCompetitionPortalRoutes(db, path, method, 'student-1', 'student1');
      expect(response?.status).toBe(503);
      expect(await response?.json()).toEqual({ status: 'error', message: COMPETITION_PORTAL_FEATURE_DISABLED });
    }
    expect(portalService.resolveStudentCompetitionBySlug).not.toHaveBeenCalled();

    expect(await handleStudentCompetitionPortalRoutes(
      db, '/api/student/competitions/campaign-1', 'GET', 'student-1', 'student1',
    )).toBeNull();
  });

  it('uses the authenticated username for Student allowlists and rollout bucketing', async () => {
    const key = COMPETITION_PORTAL_FLAGS.studentPortal;
    const db = dbWithFlags({ [key]: true }, {
      [key]: flagRow(key, true, {
        audience: 'student', percentage: 0, allow_users_json: '["student1"]',
      }),
    });
    expect(await isCompetitionStudentPortalEnabled(db, 'student1')).toBe(true);
    expect(await isCompetitionStudentPortalEnabled(db, 'student-1')).toBe(false);

    const response = await handleStudentCompetitionPortalRoutes(
      db, '/api/student/competitions/by-slug/campaign-one', 'GET', 'student-1', 'student1',
    );
    expect(response?.status).toBe(200);
    expect(portalService.resolveStudentCompetitionBySlug).toHaveBeenCalledWith(db, 'campaign-one', 'student-1');
  });

  it('gates Admin portal mutations but leaves scoped portal reads and staff core routing usable', async () => {
    const db = dbWithFlags({ ...allEnabled, [COMPETITION_PORTAL_FLAGS.publicContentAdmin]: false });
    const read = await handleCompetitionPortalRoutes(
      new Request('https://example.test/api/competitions/campaign-1/public-page'), db,
      '/api/competitions/campaign-1/public-page', 'GET',
      { username: 'admin', role: 'admin' } as any, undefined,
    );
    expect(read?.status).toBe(200);

    const mutation = await handleCompetitionPortalRoutes(
      new Request('https://example.test/api/competitions/campaign-1/public-page', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}',
      }), db, '/api/competitions/campaign-1/public-page', 'PUT',
      { username: 'admin', role: 'admin' } as any, undefined,
    );
    expect(mutation?.status).toBe(503);
    expect(await mutation?.json()).toEqual({ status: 'error', message: COMPETITION_PORTAL_FEATURE_DISABLED });
    expect(portalService.updatePublicPageDraft).not.toHaveBeenCalled();
  });
});
