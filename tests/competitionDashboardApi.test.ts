import { afterEach, describe, expect, it, vi } from 'vitest';
import * as apiAdapter from '../src/services/apiAdapter';
import { resolveApiRoute } from '../src/services/api/routeResolver';
import { competitionDashboardService } from '../src/features/competition/competitionDashboardService';
import { competitionPublicContentService } from '../src/features/competition/public-content/competitionPublicContentService';

afterEach(() => vi.restoreAllMocks());

describe('Competition V1 dashboard API registry', () => {
  it('maps dashboard reads to the Competition V1 REST namespace', () => {
    expect(resolveApiRoute('list_competitions')).toMatchObject({ method: 'GET', auth: 'session' });
    expect(resolveApiRoute('list_competitions').path({})).toBe('/api/competitions');
    expect(resolveApiRoute('create_competition')).toMatchObject({ method: 'POST', auth: 'session' });
    expect(resolveApiRoute('create_competition').path({})).toBe('/api/competitions');
    expect(resolveApiRoute('update_competition').path({ campaignId: 'campaign 1' }))
      .toBe('/api/competitions/campaign%201');
    expect(resolveApiRoute('get_competition_rounds').path({ campaignId: 'campaign 1' }))
      .toBe('/api/competitions/campaign%201/rounds');
    expect(resolveApiRoute('list_student_competitions').path({})).toBe('/api/student/competitions');
    expect(resolveApiRoute('get_student_competition').path({ campaignId: 'campaign 1' }))
      .toBe('/api/student/competitions/campaign%201');
    expect(resolveApiRoute('start_student_competition_round_attempt').path({ campaignId: 'campaign 1', roundId: 'round 1' }))
      .toBe('/api/student/competitions/campaign%201/rounds/round%201/attempts');
    expect(resolveApiRoute('submit_student_competition_round_attempt').path({ campaignId: 'campaign 1', roundId: 'round 1', attemptId: 'attempt 1' }))
      .toBe('/api/student/competitions/campaign%201/rounds/round%201/attempts/attempt%201/submit');
    expect(resolveApiRoute('get_student_competition_official_result').path({ campaignId: 'campaign 1' }))
      .toBe('/api/student/competitions/campaign%201/official-result');
    expect(resolveApiRoute('upsert_competition_round_quiz')).toMatchObject({ method: 'PUT', auth: 'session' });
    expect(resolveApiRoute('upsert_competition_round_quiz').path({ campaignId: 'campaign 1', roundId: 'round 1' }))
      .toBe('/api/competitions/campaign%201/rounds/round%201/quizzes');
    expect(resolveApiRoute('get_competition_progress').path({ campaignId: 'campaign 1' }))
      .toBe('/api/competitions/campaign%201/progress');
    expect(resolveApiRoute('get_competition_eligibility').path({ campaignId: 'campaign 1' }))
      .toBe('/api/competitions/campaign%201/eligibility');
    expect(resolveApiRoute('list_school_exam_events').path({ campaignId: 'campaign 1' }))
      .toBe('/api/competitions/campaign%201/school-exams');
    expect(resolveApiRoute('get_school_exam_event').path({ eventId: 'event 1' }))
      .toBe('/api/school-exams/event%201');
    expect(resolveApiRoute('get_school_exam_reconcile').path({ eventId: 'event 1' }))
      .toBe('/api/school-exams/event%201/reconcile');
    expect(resolveApiRoute('list_school_exam_incidents').path({ eventId: 'event 1' }))
      .toBe('/api/school-exams/event%201/incidents');
    expect(resolveApiRoute('list_school_exam_retests').path({ eventId: 'event 1' }))
      .toBe('/api/school-exams/event%201/retests');
    expect(resolveApiRoute('get_school_exam_rankings').path({ eventId: 'event 1' }))
      .toBe('/api/school-exams/event%201/rankings');
    expect(resolveApiRoute('list_school_exam_result_corrections').path({ eventId: 'event 1' }))
      .toBe('/api/school-exams/event%201/corrections');
    expect(resolveApiRoute('create_school_exam_result_correction')).toMatchObject({ method: 'POST', auth: 'session' });
    expect(resolveApiRoute('republish_corrected_school_exam_results').path({ eventId: 'event 1' }))
      .toBe('/api/school-exams/event%201/publish');
  });

  it('strips route parameters from dashboard mutation bodies', () => {
    const updateCampaign = resolveApiRoute('update_competition');
    expect(updateCampaign.body?.('update_competition', { campaignId: 'c1', title: 'New title', requestId: 'request-123' }))
      .toEqual({ title: 'New title', requestId: 'request-123' });

    const preview = resolveApiRoute('preview_competition_audience');
    expect(preview.body?.('preview_competition_audience', { campaignId: 'c1' })).toEqual({});

    const freeze = resolveApiRoute('freeze_competition_audience');
    expect(freeze.body?.('freeze_competition_audience', {
      campaignId: 'c1', requestId: 'request-123', expectedMemberCount: 2,
    })).toEqual({ requestId: 'request-123', expectedMemberCount: 2 });

    const roundQuiz = resolveApiRoute('upsert_competition_round_quiz');
    expect(roundQuiz.body?.('upsert_competition_round_quiz', {
      campaignId: 'c1', roundId: 'r1', gradeLevel: 4, classId: 'class-4a', quizId: 'quiz-1', requestId: 'request-123',
    })).toEqual({ campaignId: 'c1', roundId: 'r1', gradeLevel: 4, classId: 'class-4a', quizId: 'quiz-1', requestId: 'request-123' });

    const preflight = resolveApiRoute('run_school_exam_preflight');
    expect(preflight.body?.('run_school_exam_preflight', { eventId: 'e1', requestId: 'request-123' }))
      .toEqual({ eventId: 'e1', requestId: 'request-123' });

    const reconcile = resolveApiRoute('start_school_exam_reconcile');
    expect(reconcile.body?.('start_school_exam_reconcile', { eventId: 'e1', requestId: 'request-123' }))
      .toEqual({ eventId: 'e1', requestId: 'request-123' });

    const publish = resolveApiRoute('publish_school_exam_results');
    expect(publish.body?.('publish_school_exam_results', { eventId: 'e1', requestId: 'request-123' }))
      .toEqual({ eventId: 'e1', requestId: 'request-123' });

    const correction = resolveApiRoute('create_school_exam_result_correction');
    expect(correction.body?.('create_school_exam_result_correction', {
      eventId: 'e1', studentId: 'student-1', score: 99, correctCount: 10, timeTaken: 90,
      reason: 'Validated answer key', requestId: 'request-123',
    })).toEqual({
      studentId: 'student-1', score: 99, correctCount: 10, timeTaken: 90,
      reason: 'Validated answer key', requestId: 'request-123',
    });

    const republish = resolveApiRoute('republish_corrected_school_exam_results');
    expect(republish.body?.('republish_corrected_school_exam_results', { eventId: 'e1', requestId: 'request-456' }))
      .toEqual({ eventId: 'e1', requestId: 'request-456' });

    const incident = resolveApiRoute('report_school_exam_incident');
    expect(incident.path({ eventId: 'e1' })).toBe('/api/school-exams/e1/incidents');

    const retest = resolveApiRoute('grant_school_exam_retest');
    expect(retest.path({ eventId: 'e1', retestId: 'r 1' })).toBe('/api/school-exams/e1/retests/r%201/grant');

    const exportRoute = resolveApiRoute('create_school_exam_export');
    expect(exportRoute.body?.('create_school_exam_export', {
      eventId: 'e1', scope: 'CLASS', classId: 'class-1', requestId: 'request-123',
    })).toEqual({ eventId: 'e1', scope: 'CLASS', classId: 'class-1', requestId: 'request-123' });

    expect(resolveApiRoute('get_competition_certificate_batch').path({ eventId: 'event 1', certificateBatchId: 'batch 1' }))
      .toBe('/api/school-exams/event%201/certificates/batch%201');
  });

  it('exposes bounded-read cursor parameters for every school-wide dashboard collection', () => {
    const progress = resolveApiRoute('get_competition_progress');
    expect(progress.query?.({ limit: 10, cursor: 'opaque-progress' }).toString())
      .toBe('limit=10&cursor=opaque-progress');

    const eligibility = resolveApiRoute('get_competition_eligibility');
    expect(eligibility.query?.({ version: 2, limit: 10, cursor: 'opaque-eligibility' }).toString())
      .toBe('version=2&limit=10&cursor=opaque-eligibility');

    const ranking = resolveApiRoute('get_school_exam_rankings');
    expect(ranking.query?.({ scope: 'CLASS', classId: 'class-4a', limit: 10, cursor: 'opaque-ranking' }).toString())
      .toBe('scope=CLASS&classId=class-4a&limit=10&cursor=opaque-ranking');

    for (const action of [
      'get_school_exam_reconcile',
      'list_school_exam_incidents',
      'list_school_exam_retests',
      'list_school_exam_result_corrections',
    ]) {
      expect(resolveApiRoute(action).query?.({ limit: 10, cursor: 'opaque-collection' }).toString())
        .toBe('limit=10&cursor=opaque-collection');
    }
  });

  it('uses the registered action when creating a competition certificate batch', async () => {
    const callApi = vi.spyOn(apiAdapter, 'callApi').mockResolvedValue({
      certificateBatch: {
        id: 'batch-1',
        eventId: 'event-1',
        publicationVersion: 1,
        rankingVersion: 1,
        status: 'QUEUED',
        winnerCount: 1,
        batchCount: 1,
      },
    });

    await competitionDashboardService.createCertificates({
      eventId: 'event-1',
      publicationVersion: 1,
      rankingVersion: 1,
      winnerStudentIds: ['student-1'],
      templateId: 'template-1',
      title: 'Champion',
      requestId: 'request-1',
    });

    expect(callApi).toHaveBeenCalledWith('create_competition_certificate_batch', expect.objectContaining({
      eventId: 'event-1',
      winnerStudentIds: ['student-1'],
    }));
  });

  it('registers every staff public-content action with encoded resource paths', () => {
    const expected = {
      get_competition_public_page: ['GET', '/api/competitions/campaign%201/public-page'],
      update_competition_public_page: ['PUT', '/api/competitions/campaign%201/public-page'],
      preview_competition_public_page: ['POST', '/api/competitions/campaign%201/public-page/preview'],
      publish_competition_public_page: ['POST', '/api/competitions/campaign%201/public-page/publish'],
      archive_competition_public_page: ['POST', '/api/competitions/campaign%201/public-page/archive'],
      list_competition_articles: ['GET', '/api/competitions/campaign%201/articles'],
      create_competition_article: ['POST', '/api/competitions/campaign%201/articles'],
      get_competition_article: ['GET', '/api/competitions/campaign%201/articles/article%201'],
      update_competition_article: ['PATCH', '/api/competitions/campaign%201/articles/article%201'],
      delete_competition_article: ['DELETE', '/api/competitions/campaign%201/articles/article%201'],
      get_competition_golden_board_config: ['GET', '/api/competitions/campaign%201/golden-board-config'],
      update_competition_golden_board_config: ['PUT', '/api/competitions/campaign%201/golden-board-config'],
      list_competition_award_rules: ['GET', '/api/competitions/campaign%201/award-rules'],
      create_competition_award_rules: ['POST', '/api/competitions/campaign%201/award-rules'],
      activate_competition_award_rules: ['POST', '/api/competitions/campaign%201/award-rules/2/activate'],
    } as const;
    for (const [action, [method, path]] of Object.entries(expected)) {
      const route = resolveApiRoute(action);
      expect(route).toMatchObject({ method, auth: 'session' });
      expect(route.path({ campaignId: 'campaign 1', articleId: 'article 1', version: 2 })).toBe(path);
    }
  });

  it('exposes typed public-content service methods without raw fetch calls', async () => {
    const callApi = vi.spyOn(apiAdapter, 'callApi').mockResolvedValue({
      publicPage: { id: 'page-1' }, items: [], preview: { slug: 'preview' },
    });

    await competitionPublicContentService.getPublicPage('campaign-1');
    await competitionPublicContentService.previewPublicPage('campaign-1', 'request-preview-1');
    await competitionPublicContentService.listArticles('campaign-1');
    await competitionPublicContentService.getGoldenBoardConfig('campaign-1');
    await competitionPublicContentService.listAwardRuleVersions('campaign-1');

    expect(callApi.mock.calls.map(([action]) => action)).toEqual([
      'get_competition_public_page',
      'preview_competition_public_page',
      'list_competition_articles',
      'get_competition_golden_board_config',
      'list_competition_award_rules',
    ]);
  });

  it('sends the article delete requestId through the real callApi transport header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ article: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await competitionPublicContentService.deleteArticle(
      'campaign-1', 'article-1', 'request-delete-1',
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/competitions/campaign-1/articles/article-1');
    expect(init?.method).toBe('DELETE');
    expect(new Headers(init?.headers).get('x-request-id')).toBe('request-delete-1');
    expect(init?.body).toBeUndefined();
  });
});
