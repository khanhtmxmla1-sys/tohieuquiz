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

    const missing = literals.filter((route) => !findApiAuthorizationPolicy(route, 'GET', { ignoreMethod: true }));
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
