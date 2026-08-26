import type { RouteRegistry } from '../types';

const encoded = (value: unknown) => encodeURIComponent(String(value || ''));

const identityBody = (_action: string, payload: Record<string, any>) => payload;

const omitFields = (...fields: string[]) => (_action: string, payload: Record<string, any>) => {
  const body = { ...payload };
  for (const field of fields) delete body[field];
  return body;
};

const eligibilityQuery = (payload: Record<string, any>) => {
  const query = new URLSearchParams();
  if (payload.version !== undefined && payload.version !== null) query.set('version', String(payload.version));
  if (payload.limit !== undefined && payload.limit !== null) query.set('limit', String(payload.limit));
  if (payload.cursor) query.set('cursor', String(payload.cursor));
  return query;
};

const collectionQuery = (payload: Record<string, any>) => {
  const query = new URLSearchParams();
  if (payload.limit !== undefined && payload.limit !== null) query.set('limit', String(payload.limit));
  if (payload.cursor) query.set('cursor', String(payload.cursor));
  return query;
};

const rankingQuery = (payload: Record<string, any>) => {
  const query = new URLSearchParams();
  if (payload.scope) query.set('scope', String(payload.scope));
  if (payload.gradeLevel !== undefined && payload.gradeLevel !== null) query.set('gradeLevel', String(payload.gradeLevel));
  if (payload.classId) query.set('classId', String(payload.classId));
  if (payload.limit !== undefined && payload.limit !== null) query.set('limit', String(payload.limit));
  if (payload.cursor) query.set('cursor', String(payload.cursor));
  return query;
};

export const competitionRoutes: RouteRegistry = {
  get_competition_public_page: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/public-page`,
  },
  update_competition_public_page: {
    method: 'PUT', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/public-page`, body: omitFields('campaignId'),
  },
  preview_competition_public_page: {
    method: 'POST', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/public-page/preview`, body: omitFields('campaignId'),
  },
  publish_competition_public_page: {
    method: 'POST', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/public-page/publish`, body: omitFields('campaignId'),
  },
  archive_competition_public_page: {
    method: 'POST', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/public-page/archive`, body: omitFields('campaignId'),
  },
  list_competition_articles: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/articles`,
  },
  create_competition_article: {
    method: 'POST', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/articles`, body: identityBody,
  },
  get_competition_article: {
    method: 'GET', auth: 'session', path: ({ campaignId, articleId }) => `/api/competitions/${encoded(campaignId)}/articles/${encoded(articleId)}`,
  },
  update_competition_article: {
    method: 'PATCH', auth: 'session', path: ({ campaignId, articleId }) => `/api/competitions/${encoded(campaignId)}/articles/${encoded(articleId)}`, body: omitFields('campaignId', 'articleId'),
  },
  delete_competition_article: {
    method: 'DELETE', auth: 'session', path: ({ campaignId, articleId }) => `/api/competitions/${encoded(campaignId)}/articles/${encoded(articleId)}`,
  },
  get_competition_golden_board_config: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/golden-board-config`,
  },
  update_competition_golden_board_config: {
    method: 'PUT', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/golden-board-config`, body: omitFields('campaignId'),
  },
  list_competition_award_rules: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/award-rules`,
  },
  create_competition_award_rules: {
    method: 'POST', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/award-rules`, body: identityBody,
  },
  activate_competition_award_rules: {
    method: 'POST', auth: 'session', path: ({ campaignId, version }) => `/api/competitions/${encoded(campaignId)}/award-rules/${encoded(version)}/activate`, body: omitFields('campaignId', 'version'),
  },
  list_student_competitions: {
    method: 'GET', auth: 'session', path: () => '/api/student/competitions',
  },
  get_student_competition_by_slug: {
    method: 'GET', auth: 'session', path: ({ campaignSlug }) => `/api/student/competitions/by-slug/${encoded(campaignSlug)}`,
  },
  preflight_student_competition_round: {
    method: 'POST',
    auth: 'session',
    path: ({ campaignId, roundId }) => `/api/student/competitions/${encoded(campaignId)}/rounds/${encoded(roundId)}/preflight`,
    body: () => ({}),
  },
  preflight_student_competition_school_exam: {
    method: 'POST',
    auth: 'session',
    path: ({ campaignId }) => `/api/student/competitions/${encoded(campaignId)}/school-exam/preflight`,
    body: () => ({}),
  },
  get_student_competition: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/student/competitions/${encoded(campaignId)}`,
  },
  start_student_competition_round_attempt: {
    method: 'POST', auth: 'session', path: ({ campaignId, roundId }) => `/api/student/competitions/${encoded(campaignId)}/rounds/${encoded(roundId)}/attempts`,
  },
  submit_student_competition_round_attempt: {
    method: 'POST', auth: 'session', path: ({ campaignId, roundId, attemptId }) => `/api/student/competitions/${encoded(campaignId)}/rounds/${encoded(roundId)}/attempts/${encoded(attemptId)}/submit`,
  },
  get_student_competition_official_result: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/student/competitions/${encoded(campaignId)}/official-result`,
  },
  list_competitions: { method: 'GET', auth: 'session', path: () => '/api/competitions' },
  create_competition: { method: 'POST', auth: 'session', path: () => '/api/competitions' },
  update_competition: {
    method: 'PATCH', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}`,
    body: omitFields('campaignId'),
  },
  get_competition: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}`,
  },
  preview_competition_audience: {
    method: 'POST', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/audience/preview`,
    body: omitFields('campaignId'),
  },
  freeze_competition_audience: {
    method: 'POST', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/audience/snapshot`,
    body: omitFields('campaignId'),
  },
  get_competition_rounds: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/rounds`,
  },
  upsert_competition_round_quiz: {
    method: 'PUT', auth: 'session', path: ({ campaignId, roundId }) => `/api/competitions/${encoded(campaignId)}/rounds/${encoded(roundId)}/quizzes`,
    body: identityBody,
  },
  get_competition_progress: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/progress`, query: collectionQuery,
  },
  update_competition_round: {
    method: 'PATCH', auth: 'session', path: ({ campaignId, roundId }) => `/api/competitions/${encoded(campaignId)}/rounds/${encoded(roundId)}`,
  },
  finalize_competition_round: {
    method: 'POST', auth: 'session', path: ({ campaignId, roundId }) => `/api/competitions/${encoded(campaignId)}/rounds/${encoded(roundId)}/finalize`,
  },
  get_competition_eligibility: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/eligibility`, query: eligibilityQuery,
  },
  finalize_competition_eligibility: {
    method: 'POST', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/eligibility/finalize`,
  },
  list_school_exam_events: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/school-exams`,
  },
  create_school_exam_event: {
    method: 'POST', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/school-exams`,
  },
  get_school_exam_event: {
    method: 'GET', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}`,
  },
  create_school_exam_room: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/rooms`,
  },
  run_school_exam_preflight: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/preflight`, body: identityBody,
  },
  provision_school_exam: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/provision`,
  },
  get_school_exam_reconcile: {
    method: 'GET', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/reconcile`, query: collectionQuery,
  },
  list_school_exam_incidents: {
    method: 'GET', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/incidents`, query: collectionQuery,
  },
  report_school_exam_incident: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/incidents`, body: identityBody,
  },
  list_school_exam_retests: {
    method: 'GET', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/retests`, query: collectionQuery,
  },
  grant_school_exam_retest: {
    method: 'POST', auth: 'session', path: ({ eventId, retestId }) => `/api/school-exams/${encoded(eventId)}/retests/${encoded(retestId)}/grant`,
    body: omitFields('retestId'),
  },
  start_school_exam_reconcile: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/reconcile`, body: identityBody,
  },
  publish_school_exam_results: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/publish`, body: identityBody,
  },
  republish_corrected_school_exam_results: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/publish`, body: identityBody,
  },
  list_school_exam_result_corrections: {
    method: 'GET', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/corrections`, query: collectionQuery,
  },
  create_school_exam_result_correction: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/corrections`, body: omitFields('eventId'),
  },
  get_school_exam_rankings: {
    method: 'GET', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/rankings`, query: rankingQuery,
  },
  create_school_exam_export: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/exports`, body: identityBody,
  },
  get_school_exam_export: {
    method: 'GET', auth: 'session', path: ({ eventId, exportId }) => `/api/school-exams/${encoded(eventId)}/exports/${encoded(exportId)}`,
  },
  create_competition_certificate_batch: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/certificates`,
  },
  get_competition_certificate_batch: {
    method: 'GET', auth: 'session', path: ({ eventId, certificateBatchId }) => `/api/school-exams/${encoded(eventId)}/certificates/${encoded(certificateBatchId)}`,
  },
};
