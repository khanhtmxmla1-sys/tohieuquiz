// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../workers/src/types';
import { handleCompetitionRoutes } from '../workers/src/routes/competitions';

const stubs = vi.hoisted(() => ({
  auth: vi.fn(),
  flag: vi.fn(),
  resolveFlag: vi.fn(),
  staffPortal: vi.fn(),
  studentPortal: vi.fn(),
  campaign: vi.fn(),
  audience: vi.fn(),
  startAttempt: vi.fn(),
  attemptQuiz: vi.fn(),
  studentCompetitions: vi.fn(),
  schoolExamEvent: vi.fn(),
  listSchoolExams: vi.fn(),
  rankings: vi.fn(),
}));

vi.mock('../workers/src/middleware/jwtAuth', async (original) => ({
  ...await original<typeof import('../workers/src/middleware/jwtAuth')>(),
  verifyJWTMiddleware: stubs.auth,
}));
vi.mock('../workers/src/services/featureFlagService', async (original) => ({
  ...await original<typeof import('../workers/src/services/featureFlagService')>(),
  getFeatureFlag: stubs.flag,
  resolveFeatureFlag: stubs.resolveFlag,
}));
vi.mock('../workers/src/routes/competitions/portalRoutes', () => ({
  handleCompetitionPortalRoutes: stubs.staffPortal,
}));
vi.mock('../workers/src/routes/competitions/studentPortalRoutes', () => ({
  handleStudentCompetitionPortalRoutes: stubs.studentPortal,
}));
vi.mock('../workers/src/competition/campaignService', async (original) => ({
  ...await original<typeof import('../workers/src/competition/campaignService')>(),
  getCompetitionCampaign: stubs.campaign,
  listCompetitionAudience: stubs.audience,
}));
vi.mock('../workers/src/competition/roundService', async (original) => ({
  ...await original<typeof import('../workers/src/competition/roundService')>(),
  startRoundAttempt: stubs.startAttempt,
  getRoundAttemptQuiz: stubs.attemptQuiz,
}));
vi.mock('../workers/src/competition/studentCompetitionService', async (original) => ({
  ...await original<typeof import('../workers/src/competition/studentCompetitionService')>(),
  listStudentCompetitions: stubs.studentCompetitions,
}));
vi.mock('../workers/src/competition/schoolExamService', async (original) => ({
  ...await original<typeof import('../workers/src/competition/schoolExamService')>(),
  getSchoolExamEvent: stubs.schoolExamEvent,
  listSchoolExamEvents: stubs.listSchoolExams,
}));
vi.mock('../workers/src/competition/schoolExamPublicationRankingService', async (original) => ({
  ...await original<typeof import('../workers/src/competition/schoolExamPublicationRankingService')>(),
  getSchoolExamRankings: stubs.rankings,
}));

const fixture = vi.fn((sql: string) => {
  if (sql.includes('FROM classes')) {
    return { bind: vi.fn(() => ({ all: async () => ({ results: [{ id: 'class-own' }] }) })) };
  }
  if (sql.includes('FROM students')) {
    return { bind: vi.fn(() => ({ first: async () => ({ id: 'student-1' }) })) };
  }
  throw new Error('Unexpected D1 query in dispatch test');
});
const env = { DB: { prepare: fixture } } as unknown as Env;
const studentListPath = '/api/student/competitions';
const attemptPath = studentListPath + '/campaign-1/rounds/round-1/attempts';

function authenticateAs(role: 'admin' | 'teacher' | 'student') {
  stubs.auth.mockResolvedValue({ user: { username: role + '-user', role, id: role + '-1' } });
}

function route(path: string, method = 'GET', body?: string) {
  const req = new Request('https://api.test' + path, {
    method,
    body,
    headers: { 'x-request-id': 'dispatch-test' },
  });
  return handleCompetitionRoutes(req, env, new URL(req.url).pathname, method);
}

async function expectError(response: Promise<Response | null>, status: number, message: string) {
  const result = await response;
  expect(result?.status).toBe(status);
  expect(await result?.json()).toEqual({ status: 'error', message });
}

beforeEach(() => {
  vi.resetAllMocks();
  authenticateAs('admin');
  stubs.flag.mockResolvedValue({ key: 'competition_v1' });
  stubs.resolveFlag.mockResolvedValue({ enabled: true });
  stubs.staffPortal.mockResolvedValue(null);
  stubs.studentPortal.mockResolvedValue(null);
  stubs.studentCompetitions.mockResolvedValue([]);
  stubs.startAttempt.mockResolvedValue({ id: 'attempt-1' });
  stubs.attemptQuiz.mockResolvedValue({ questions: [] });
  stubs.listSchoolExams.mockResolvedValue([]);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('competition dispatch parity', () => {
  it('falls through outside the namespace without consulting auth', async () => {
    expect(await route('/api/other')).toBeNull();
    expect(stubs.auth).not.toHaveBeenCalled();
    expect(fixture).not.toHaveBeenCalled();
  });

  it('returns the exact JWT failure before rollout or handler calls', async () => {
    const denied = new Response('denied', { status: 401 });
    stubs.auth.mockResolvedValue(denied);
    expect(await route('/api/competitions')).toBe(denied);
    expect(stubs.flag).not.toHaveBeenCalled();
    expect(stubs.staffPortal).not.toHaveBeenCalled();
  });

  it('fails closed when rollout is disabled', async () => {
    stubs.resolveFlag.mockResolvedValue({ enabled: false });
    await expectError(route('/api/competitions'), 404, 'COMPETITION_NOT_AVAILABLE');
    expect(stubs.staffPortal).not.toHaveBeenCalled();
  });

  it('enforces namespace roles and the admin mutation gate', async () => {
    authenticateAs('teacher');
    await expectError(route(studentListPath), 403, 'Forbidden');
    await expectError(route('/api/competitions', 'POST', '{}'), 403, 'Forbidden');
    expect(stubs.studentPortal).not.toHaveBeenCalled();
    expect(stubs.staffPortal).not.toHaveBeenCalled();
    authenticateAs('student');
    await expectError(route('/api/competitions'), 403, 'Forbidden');
    expect(stubs.staffPortal).not.toHaveBeenCalled();
  });

  it.each([
    ['incidents', 'Invalid school exam incident payload'],
    ['exports', 'Invalid school exam export payload'],
  ])('routes teacher POST %s to its existing validation', async (endpoint, message) => {
    authenticateAs('teacher');
    await expectError(route('/api/school-exams/event-1/' + endpoint, 'POST', '{}'), 400, message);
    await expectError(route('/api/school-exams/event-1/' + endpoint, 'PATCH', '{}'), 403, 'Forbidden');
  });

  it('lets the student portal handle a request before the core student routes', async () => {
    authenticateAs('student');
    const first = new Response(null, { status: 405 });
    stubs.studentPortal.mockResolvedValue(first);
    expect(await route(studentListPath)).toBe(first);
    expect(stubs.studentPortal).toHaveBeenCalledWith(env.DB, studentListPath, 'GET', 'student-1', 'student-user');
    expect(stubs.studentCompetitions).not.toHaveBeenCalled();
    stubs.studentPortal.mockResolvedValue(null);
    expect((await route(studentListPath))?.status).toBe(200);
    expect(await route(studentListPath, 'PATCH')).toBeNull();
  });

  it('preserves portal priority and the class lookup order for a scoped school exam list', async () => {
    authenticateAs('teacher');
    const trace: string[] = [];
    stubs.resolveFlag.mockImplementation(async () => {
      trace.push('rollout:' + fixture.mock.calls.length);
      return { enabled: true };
    });
    stubs.staffPortal.mockImplementation(async () => {
      trace.push('portal:' + fixture.mock.calls.length);
      return null;
    });
    stubs.listSchoolExams.mockImplementation(async () => {
      trace.push('service:' + fixture.mock.calls.length);
      return [];
    });
    const path = '/api/competitions/campaign-1/school-exams';
    expect((await route(path))?.status).toBe(200);
    expect(trace).toEqual(['rollout:1', 'portal:2', 'service:3']);
    expect(stubs.listSchoolExams).toHaveBeenCalledWith(env.DB, 'campaign-1', { classIds: ['class-own'] });
    const portalResponse = new Response(null, { status: 204 });
    stubs.staffPortal.mockResolvedValue(portalResponse);
    fixture.mockClear();
    stubs.listSchoolExams.mockClear();
    expect(await route(path)).toBe(portalResponse);
    expect(fixture).toHaveBeenCalledTimes(2);
    expect(stubs.listSchoolExams).not.toHaveBeenCalled();
    expect(stubs.campaign).not.toHaveBeenCalled();
  });

  it('passes teacher scope to staff routes and keeps unrelated class rankings denied', async () => {
    authenticateAs('teacher');
    stubs.audience.mockResolvedValue({ items: [] });
    expect((await route('/api/competitions/campaign-1/audience'))?.status).toBe(200);
    expect(stubs.audience).toHaveBeenCalledWith(env.DB, 'campaign-1', {
      classIds: ['class-own'], limit: 50, cursor: undefined,
    });
    expect(fixture).toHaveBeenCalledTimes(3);
    fixture.mockClear();
    await expectError(route('/api/school-exams/event-1/rankings?scope=CLASS&classId=class-other'),
      403, 'SCHOOL_EXAM_RANKING_FORBIDDEN');
    expect(stubs.rankings).not.toHaveBeenCalled();
    expect(fixture).toHaveBeenCalledTimes(3);
  });

  it('preserves the student attempt JSON, schema and path match validation', async () => {
    authenticateAs('student');
    await expectError(route(attemptPath, 'POST', '{'), 400, 'Invalid JSON body');
    await expectError(route(attemptPath, 'POST', '{}'), 400, 'Invalid competition attempt payload');
    const input = { campaignId: 'campaign-other', roundId: 'round-1', requestId: 'dispatch-start-1' };
    await expectError(route(attemptPath, 'POST', JSON.stringify(input)), 400, 'COMPETITION_ROUND_ROUTE_MISMATCH');
    expect(stubs.startAttempt).not.toHaveBeenCalled();
  });

  it('logs the unchanged status and operation for both successful and rejected mutations', async () => {
    authenticateAs('student');
    const body = JSON.stringify({ campaignId: 'campaign-1', roundId: 'round-1', requestId: 'dispatch-start-1' });
    const response = await route(attemptPath, 'POST', body);
    expect(response?.status).toBe(201);
    expect(await response?.json()).toEqual({ attempt: { id: 'attempt-1' }, quiz: { questions: [] } });
    expect(stubs.startAttempt).toHaveBeenCalledWith(env.DB, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-1', requestId: 'dispatch-start-1',
    });
    expect(console.info).toHaveBeenCalledExactlyOnceWith('[Competition] mutation_completed', expect.objectContaining({
      operation: 'student_round_attempt_start', status: 201, requestId: 'dispatch-test', campaignId: 'campaign-1',
    }));
    stubs.startAttempt.mockRejectedValue(new Error('COMPETITION_ROUND_NOT_FOUND'));
    await expectError(route(attemptPath, 'POST', body), 404, 'COMPETITION_ROUND_NOT_FOUND');
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('[Competition] mutation_failed', expect.objectContaining({
      operation: 'student_round_attempt_start', status: 404, requestId: 'dispatch-test',
    }));
  });

  it.each([
    ['COMPETITION_CAMPAIGN_NOT_FOUND', 404],
    ['COMPETITION_CAMPAIGN_NOT_DRAFT', 409],
    ['COMPETITION_AUDIENCE_CURSOR_INVALID', 400],
  ])('keeps async staff errors in the existing response envelope (%s)', async (message, status) => {
    stubs.campaign.mockRejectedValue(new Error(message));
    await expectError(route('/api/competitions/campaign-1'), status, message);
    expect(await route('/api/competitions/campaign-1/unmatched')).toBeNull();
  });
});
