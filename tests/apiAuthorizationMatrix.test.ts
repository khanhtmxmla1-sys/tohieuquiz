import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  apiAuthorizationPolicies,
  findApiAuthorizationPolicy,
  verifyToken,
  type ApiAuthorizationClass,
} from '../workers/src/middleware/auth';

const repoRoot = path.resolve(import.meta.dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const expectedClasses: ApiAuthorizationClass[] = [
  'public',
  'authenticated',
  'student-owned',
  'teacher-owned',
  'admin-only',
  'internal-only',
];

const routeSamples = [
  ['/api/health', 'GET', 'public'],
  ['/api/login', 'POST', 'public'],
  ['/api/student-login', 'POST', 'public'],
  ['/api/questions', 'GET', 'public'],
  ['/api/quizzes/access-verification/quiz-1', 'POST', 'public'],
  ['/api/quizzes/quiz-1', 'PUT', 'teacher-owned'],
  ['/api/results/42', 'GET', 'teacher-owned'],
  ['/api/student-profile', 'GET', 'student-owned'],
  ['/api/game-state/result-reward', 'POST', 'student-owned'],
  ['/api/admin/teachers/teacher-1', 'DELETE', 'admin-only'],
  ['/api/admin/math-audit', 'GET', 'admin-only'],
  ['/api/client-errors', 'POST', 'internal-only'],
  ['/api/client-telemetry', 'POST', 'internal-only'],
  ['/api/parent/dashboard', 'GET', 'student-owned'],
  ['/api/parent/preferences', 'GET', 'student-owned'],
  ['/api/parent/preferences/email/verify', 'POST', 'public'],
  ['/api/parent/recovery/request', 'POST', 'public'],
  ['/api/parent/recovery/confirm', 'POST', 'public'],
  ['/api/parent-links', 'POST', 'teacher-owned'],
  ['/api/result-reports/batches/batch-1/retry', 'POST', 'teacher-owned'],
  ['/api/gift-shop/purchase', 'POST', 'student-owned'],
  ['/api/gift-shop/settings', 'GET', 'authenticated'],
  ['/api/gift-shop/settings', 'PUT', 'teacher-owned'],
  ['/api/gift-shop/orders/order-1/approve', 'PATCH', 'teacher-owned'],
  ['/api/gift-shop/catalog/gift-1', 'DELETE', 'admin-only'],
  ['/api/gift-shop/events', 'GET', 'admin-only'],
  ['/api/media/uploads', 'POST', 'authenticated'],
  ['/api/public/competitions/example', 'GET', 'public'],
  ['/api/public/competitions/example/articles', 'GET', 'public'],
  ['/api/competitions', 'POST', 'admin-only'],
  ['/api/competitions/campaign-1', 'GET', 'teacher-owned'],
  ['/api/student/competitions/campaign-1', 'GET', 'student-owned'],
  ['/api/school-exams/event-1', 'GET', 'teacher-owned'],
  ['/api/school-exams/event-1/incidents', 'POST', 'teacher-owned'],
  ['/api/school-exams/event-1/exports', 'POST', 'teacher-owned'],
  ['/api/school-exams/event-1/retests/retest-1/grant', 'POST', 'admin-only'],
  ['/api/school-exams/event-1/publish', 'POST', 'admin-only'],
] as const;

describe('API authorization matrix', () => {
  it('uses every required authorization class', () => {
    expect(new Set(apiAuthorizationPolicies.map((policy) => policy.authorization))).toEqual(
      new Set(expectedClasses),
    );
  });

  it.each(routeSamples)('classifies %s %s as %s', (route, method, expected) => {
    expect(findApiAuthorizationPolicy(route, method)?.authorization).toBe(expected);
  });

  it('locks Competition ownership keys for campaign, round, event, room, attempt, and export scope', () => {
    expect(findApiAuthorizationPolicy('/api/competitions/campaign-1', 'GET')?.ownership)
      .toEqual(expect.arrayContaining(['campaignId', 'classId']));
    expect(findApiAuthorizationPolicy('/api/student/competitions/campaign-1/rounds/round-1/attempts/attempt-1/submit', 'POST')?.ownership)
      .toEqual(expect.arrayContaining(['session', 'campaignId', 'roundId', 'attemptId']));
    expect(findApiAuthorizationPolicy('/api/school-exams/event-1/exports/export-1', 'GET')?.ownership)
      .toEqual(expect.arrayContaining(['eventId', 'roomId', 'exportId']));
  });

  it('locks the five public Competition surfaces to explicit GET-only policies', () => {
    const cases = [
      ['/api/public/competitions', '/api/public/competitions', 'exact'],
      ['/api/public/competitions/example', '/api/public/competitions/:slug', 'template'],
      ['/api/public/competitions/example/articles', '/api/public/competitions/:slug/articles', 'template'],
      ['/api/public/competitions/example/articles/rules', '/api/public/competitions/:slug/articles/:articleSlug', 'template'],
      ['/api/public/competitions/example/golden-board', '/api/public/competitions/:slug/golden-board', 'template'],
    ] as const;

    for (const [route, policyPath, match] of cases) {
      expect(findApiAuthorizationPolicy(route, 'GET')).toMatchObject({
        path: policyPath,
        match,
        authorization: 'public',
        ownership: ['none'],
        methods: ['GET'],
      });
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(findApiAuthorizationPolicy(route, method), `${method} ${route}`).toBeUndefined();
      }
    }
    expect(findApiAuthorizationPolicy('/api/public/competitions/example/not-a-route', 'GET')).toBeUndefined();
  });

  it('locks Student Competition routes to explicit Student-owned policies and exact verbs', () => {
    const cases = [
      ['/api/student/competitions', 'GET', '/api/student/competitions', 'exact', ['session']],
      ['/api/student/competitions/by-slug/example', 'GET', '/api/student/competitions/by-slug/:campaignSlug', 'template', ['session', 'campaignId']],
      ['/api/student/competitions/campaign-1', 'GET', '/api/student/competitions/:campaignId', 'template', ['session', 'campaignId']],
      ['/api/student/competitions/campaign-1/eligibility', 'GET', '/api/student/competitions/:campaignId/eligibility', 'template', ['session', 'campaignId']],
      ['/api/student/competitions/campaign-1/official-result', 'GET', '/api/student/competitions/:campaignId/official-result', 'template', ['session', 'campaignId']],
      ['/api/student/competitions/campaign-1/rounds/round-1/attempts', 'POST', '/api/student/competitions/:campaignId/rounds/:roundId/attempts', 'template', ['session', 'campaignId', 'roundId']],
      ['/api/student/competitions/campaign-1/rounds/round-1/attempts/attempt-1/submit', 'POST', '/api/student/competitions/:campaignId/rounds/:roundId/attempts/:attemptId/submit', 'template', ['session', 'campaignId', 'roundId', 'attemptId']],
      ['/api/student/competitions/campaign-1/rounds/round-1/preflight', 'POST', '/api/student/competitions/:campaignId/rounds/:roundId/preflight', 'template', ['session', 'campaignId', 'roundId']],
      ['/api/student/competitions/campaign-1/school-exam/preflight', 'POST', '/api/student/competitions/:campaignId/school-exam/preflight', 'template', ['session', 'campaignId']],
    ] as const;

    for (const [route, method, policyPath, match, ownership] of cases) {
      expect(findApiAuthorizationPolicy(route, method)).toMatchObject({
        path: policyPath,
        match,
        authorization: 'student-owned',
        ownership,
        methods: [method],
      });
      const wrongMethod = method === 'GET' ? 'POST' : 'GET';
      expect(findApiAuthorizationPolicy(route, wrongMethod), `${wrongMethod} ${route}`).toBeUndefined();
    }
    expect(findApiAuthorizationPolicy('/api/student/competitions/campaign-1/not-a-route', 'GET')).toBeUndefined();
  });

  it('keeps staff portal reads Teacher-owned and portal mutations Admin-only', () => {
    const teacherReads = [
      '/api/competitions/campaign-1/public-page',
      '/api/competitions/campaign-1/articles',
      '/api/competitions/campaign-1/articles/article-1',
      '/api/competitions/campaign-1/golden-board-config',
      '/api/competitions/campaign-1/award-rules',
    ];
    for (const route of teacherReads) {
      expect(findApiAuthorizationPolicy(route, 'GET')?.authorization, route).toBe('teacher-owned');
    }

    const adminMutations = [
      ['/api/competitions/campaign-1/public-page', 'PUT'],
      ['/api/competitions/campaign-1/public-page/preview', 'POST'],
      ['/api/competitions/campaign-1/public-page/publish', 'POST'],
      ['/api/competitions/campaign-1/public-page/archive', 'POST'],
      ['/api/competitions/campaign-1/articles', 'POST'],
      ['/api/competitions/campaign-1/articles/article-1', 'PATCH'],
      ['/api/competitions/campaign-1/articles/article-1', 'DELETE'],
      ['/api/competitions/campaign-1/golden-board-config', 'PUT'],
      ['/api/competitions/campaign-1/award-rules', 'POST'],
      ['/api/competitions/campaign-1/award-rules/1/activate', 'POST'],
    ] as const;
    for (const [route, method] of adminMutations) {
      expect(findApiAuthorizationPolicy(route, method)?.authorization, `${method} ${route}`).toBe('admin-only');
    }
  });

  it('preserves the existing School Exam Teacher exceptions and Admin retest grant', () => {
    expect(findApiAuthorizationPolicy('/api/school-exams/event-1/incidents', 'POST')).toMatchObject({
      id: 'school-exam-incident-report', match: 'template', methods: ['POST'], authorization: 'teacher-owned',
      ownership: ['session', 'eventId', 'roomId', 'studentId', 'resultId', 'route-handler'],
    });
    expect(findApiAuthorizationPolicy('/api/school-exams/event-1/exports', 'POST')).toMatchObject({
      id: 'school-exam-class-export', match: 'template', methods: ['POST'], authorization: 'teacher-owned',
      ownership: ['session', 'eventId', 'classId', 'exportId', 'route-handler'],
    });
    expect(findApiAuthorizationPolicy('/api/school-exams/event-1/retests/retest-1/grant', 'POST')).toMatchObject({
      id: 'school-exam-retest-grant', match: 'template', methods: ['POST'], authorization: 'admin-only',
    });
    expect(findApiAuthorizationPolicy('/api/school-exams/event-1', 'GET')?.authorization).toBe('teacher-owned');
  });

  it('fails closed for an unclassified API route', async () => {
    const response = verifyToken(
      new Request('https://example.test/api/new-route-without-policy', { method: 'GET' }),
      {} as never,
    );
    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toMatchObject({
      message: expect.stringContaining('no explicit authentication policy'),
    });
  });

  it('covers every API path literal dispatched by the Worker router', () => {
    const routerSource = read('workers/src/router/createWorkerFetch.ts');
    const literals = [...routerSource.matchAll(/['"](\/api\/[a-z0-9_\-/]+)['"]/gi)]
      .map((match) => match[1])
      .filter((value, index, values) => values.indexOf(value) === index);

    const executableLiterals = literals.filter((route) => route !== '/api/public/competitions/');
    const missing = executableLiterals.filter((route) => !findApiAuthorizationPolicy(route, 'GET', { ignoreMethod: true }));
    expect(missing, `Missing policies for router literals: ${missing.join(', ')}`).toEqual([]);
  });

  it('keeps executable cross-owner abuse coverage for all high-risk identifiers', () => {
    const evidence = {
      studentId: read('tests/parentDashboard.worker.test.ts'),
      quizId: read('tests/quizzesSecurity.worker.test.ts'),
      resultId: read('tests/aiTutorAuthorization.worker.test.ts') + read('tests/resultReportDelivery.worker.test.ts'),
      classId: read('tests/certificates.worker.test.ts'),
      batchId: read('tests/resultReportDelivery.worker.test.ts'),
    };

    expect(evidence.studentId).toContain('ignores a spoofed studentId');
    expect(evidence.quizId).toContain('rejects a body id that differs from the URL quiz id');
    expect(evidence.resultId).toContain('cross-owner access');
    expect(evidence.resultId).toContain("resultId: 'other-result'");
    expect(evidence.classId).toContain('rejects a class owned by another teacher');
    expect(evidence.batchId).toContain('retries only owned batches');
  });
});
