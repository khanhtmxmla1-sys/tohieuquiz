import { describe, expect, it, vi } from 'vitest';
import * as apiAdapter from '../src/services/apiAdapter';
import { resolveApiRoute } from '../src/services/api/routeResolver';
import { competitionDashboardService } from '../src/features/competition/competitionDashboardService';

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
  });

  it('strips route parameters from dashboard mutation bodies', () => {
    const updateCampaign = resolveApiRoute('update_competition');
    expect(updateCampaign.body?.('update_competition', { campaignId: 'c1', title: 'New title', requestId: 'request-123' }))
      .toEqual({ title: 'New title', requestId: 'request-123' });

    const preview = resolveApiRoute('preview_competition_audience');
    expect(preview.body?.('preview_competition_audience', { campaignId: 'c1' })).toEqual({});

    const freeze = resolveApiRoute('freeze_competition_audience');
    expect(freeze.body?.('freeze_competition_audience', { campaignId: 'c1', requestId: 'request-123' }))
      .toEqual({ requestId: 'request-123' });

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

    const incident = resolveApiRoute('report_school_exam_incident');
    expect(incident.path({ eventId: 'e1' })).toBe('/api/school-exams/e1/incidents');

    const retest = resolveApiRoute('grant_school_exam_retest');
    expect(retest.path({ eventId: 'e1', retestId: 'r 1' })).toBe('/api/school-exams/e1/retests/r%201/grant');

    const exportRoute = resolveApiRoute('create_school_exam_export');
    expect(exportRoute.body?.('create_school_exam_export', {
      eventId: 'e1', scope: 'CLASS', classId: 'class-1', requestId: 'request-123',
    })).toEqual({ eventId: 'e1', scope: 'CLASS', classId: 'class-1', requestId: 'request-123' });
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
});
