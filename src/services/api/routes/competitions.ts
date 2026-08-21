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
  return query;
};

const rankingQuery = (payload: Record<string, any>) => {
  const query = new URLSearchParams();
  if (payload.scope) query.set('scope', String(payload.scope));
  if (payload.gradeLevel !== undefined && payload.gradeLevel !== null) query.set('gradeLevel', String(payload.gradeLevel));
  if (payload.classId) query.set('classId', String(payload.classId));
  return query;
};

export const competitionRoutes: RouteRegistry = {
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
  get_competition_progress: {
    method: 'GET', auth: 'session', path: ({ campaignId }) => `/api/competitions/${encoded(campaignId)}/progress`,
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
    method: 'GET', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/reconcile`,
  },
  list_school_exam_incidents: {
    method: 'GET', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/incidents`,
  },
  report_school_exam_incident: {
    method: 'POST', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/incidents`, body: identityBody,
  },
  list_school_exam_retests: {
    method: 'GET', auth: 'session', path: ({ eventId }) => `/api/school-exams/${encoded(eventId)}/retests`,
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
};
