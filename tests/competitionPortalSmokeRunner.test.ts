import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  parseCompetitionPortalSmokeArgs,
  runCompetitionPortalSmoke,
  validateCompetitionPortalSmokeConfig,
} from '../scripts/run-competition-portal-smoke.mjs';

const stagingEnv = {
  COMPETITION_PORTAL_CAMPAIGN_SLUG: 'hoi-thi-toan-2026',
  COMPETITION_PORTAL_STUDENT_COOKIE: 'student_session=fixture-only',
};

const publicSummary = {
  slug: 'hoi-thi-toan-2026',
  title: 'Hội thi Toán 2026',
  summary: 'Sân chơi Toán học',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2027-05-31T00:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  hero: { title: 'Hội thi Toán 2026' },
  cta: { label: 'Vào thi' },
  rounds: Array.from({ length: 6 }, (_, index) => ({
    roundNumber: index + 1,
    title: `Vòng ${index + 1}`,
    opensAt: '2026-09-01T00:00:00.000Z',
    closesAt: '2026-09-30T00:00:00.000Z',
    state: index === 0 ? 'OPEN' : 'LOCKED',
  })),
  articleSummaryAvailable: true,
  goldenBoardAvailable: true,
};

const publicDetail = {
  ...publicSummary,
  articles: [{
    slug: 'quy-che',
    title: 'Quy chế cuộc thi',
    summary: 'Quy chế',
    content: 'Nội dung quy chế',
    type: 'RULES',
    publishedAt: '2026-08-25T00:00:00.000Z',
  }],
};

const studentPortal = {
  campaignId: 'campaign-1',
  slug: publicSummary.slug,
  title: publicSummary.title,
  schoolYear: publicSummary.schoolYear,
  publicState: publicSummary.publicState,
  rounds: Array.from({ length: 6 }, (_, index) => ({
    roundId: `round-${index + 1}`,
    roundNumber: index + 1,
    title: `Vòng ${index + 1}`,
    opensAt: '2026-09-01T00:00:00.000Z',
    closesAt: '2026-09-30T00:00:00.000Z',
    state: index === 0 ? 'OPEN' : 'LOCKED',
    attemptCount: 0,
    maxAttempts: 2,
  })),
  schoolExam: {
    qualified: true,
    eventId: 'event-1',
    scheduledAt: '2027-05-01T00:00:00.000Z',
    roomName: 'Phòng A',
    ready: true,
  },
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const publicResponse = (data: unknown) => jsonResponse({ status: 'success', data });

describe('competition portal smoke runner safeguards', () => {
  it('requires an explicit staging base URL and fixture-safe student cookie', () => {
    expect(() => parseCompetitionPortalSmokeArgs([], {})).toThrow(/base.?url/i);
    expect(() => parseCompetitionPortalSmokeArgs([
      '--base-url',
      'https://staging.example.test',
    ], { COMPETITION_PORTAL_CAMPAIGN_SLUG: 'fixture' })).toThrow(/student.*cookie/i);
    expect(parseCompetitionPortalSmokeArgs([
      '--base-url',
      'https://staging.example.test/',
    ], stagingEnv)).toMatchObject({
      baseUrl: 'https://staging.example.test',
      campaignSlug: stagingEnv.COMPETITION_PORTAL_CAMPAIGN_SLUG,
      studentCookie: stagingEnv.COMPETITION_PORTAL_STUDENT_COOKIE,
    });
  });

  it('rejects production targets and unsafe mutation options', () => {
    expect(() => validateCompetitionPortalSmokeConfig({
      baseUrl: 'https://www.thtohieu.com',
      campaignSlug: 'fixture',
      studentCookie: 'student_session=fixture-only',
      allowLocal: false,
    })).toThrow(/production/i);
    expect(() => parseCompetitionPortalSmokeArgs([
      '--base-url',
      'https://staging.example.test',
      '--create-attempt',
    ], stagingEnv)).toThrow(/read-only|attempt/i);
  });

  it('checks public publication and student preflight without calling attempt or Live Exam join routes', async () => {
    const requests: Array<{ method: string; path: string }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      requests.push({ method, path: url.pathname });
      if (method === 'GET' && url.pathname === '/api/public/competitions') {
        return publicResponse([publicSummary]);
      }
      if (method === 'GET' && url.pathname === `/api/public/competitions/${publicSummary.slug}`) {
        return publicResponse(publicDetail);
      }
      if (method === 'GET' && url.pathname === `/api/public/competitions/${publicSummary.slug}/articles/quy-che`) {
        return publicResponse(publicDetail.articles[0]);
      }
      if (method === 'GET' && url.pathname === `/api/public/competitions/${publicSummary.slug}/golden-board`) {
        return publicResponse({
          winners: [],
          publicationVersion: 2,
          rankingVersion: 4,
          awardRuleVersion: 3,
          publishedAt: '2027-05-02T00:00:00.000Z',
        });
      }
      if (method === 'GET' && url.pathname === `/api/student/competitions/by-slug/${publicSummary.slug}`) {
        return jsonResponse({ competition: { id: 'campaign-1' }, portal: studentPortal });
      }
      if (method === 'POST' && url.pathname === '/api/student/competitions/campaign-1/rounds/round-1/preflight') {
        return jsonResponse({ preflight: {
          status: 'READY',
          campaignId: 'campaign-1',
          roundId: 'round-1',
          quizId: 'quiz-1',
          serverTime: '2026-09-01T00:00:00.000Z',
          window: {
            opensAt: '2026-09-01T00:00:00.000Z',
            closesAt: '2026-09-30T00:00:00.000Z',
            timezone: 'Asia/Ho_Chi_Minh',
          },
          attemptsRemaining: 2,
        }});
      }
      if (method === 'POST' && url.pathname === '/api/student/competitions/campaign-1/school-exam/preflight') {
        return jsonResponse({ preflight: {
          status: 'READY',
          campaignId: 'campaign-1',
          title: 'School Exam',
          roomName: 'Phòng A',
          scheduledAt: '2027-05-01T00:00:00.000Z',
          serverTime: '2027-05-01T00:00:00.000Z',
          window: {
            opensAt: '2027-05-01T00:00:00.000Z',
            closesAt: '2027-05-01T01:00:00.000Z',
            timezone: 'Asia/Ho_Chi_Minh',
          },
          accessCode: 'SCHOOL-2027',
        }});
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    const directory = mkdtempSync(join(tmpdir(), 'tohieuquiz-competition-portal-smoke-'));
    const outputPath = join(directory, 'smoke.json');

    try {
      const report = await runCompetitionPortalSmoke([
        '--base-url',
        'https://staging.example.test',
        '--output',
        outputPath,
      ], { env: stagingEnv, fetchImpl });

      expect(report.status).toBe('ready');
      expect(report.checks.every(check => check.status === 'passed')).toBe(true);
      expect(JSON.parse(readFileSync(outputPath, 'utf8')).status).toBe('ready');
      expect(requests).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('/attempts') }),
        expect.objectContaining({ path: '/api/live-exam/join' }),
      ]));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
