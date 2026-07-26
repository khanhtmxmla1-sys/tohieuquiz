import type {
  CreateResultReportBatchResult,
  ResultReportBatchStatus,
} from '../../../../shared/result-reports.contract';
import { requireTeacher, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { buildResultReportCohort } from './attemptSelection';
import {
  createResultReportBatch,
  findResultReportBatchByRequest,
  type ResultReportBatchRecord,
  type ResultReportDeliveryItemCreate,
} from './batchRepository';
import { parseCreateResultReportBatchRequest } from './batchRequest';
import { loadResultReportCohortScope } from './cohortRepository';
import {
  createResultReportDeliveryRuntime,
  processResultReportBatch,
} from './deliveryItemService';
import { resultReportError, resultReportSuccess } from './responses';
import type { ResultReportCohortScope } from './types';

export interface ResultReportCreateBatchDependencies {
  findBatchByRequest(teacherId: string, requestId: string): Promise<ResultReportBatchRecord | null>;
  loadScope(input: {
    classId: string;
    quizId: string;
    attemptPolicy: ResultReportBatchRecord['attemptPolicy'];
  }): Promise<ResultReportCohortScope | Response>;
  createBatch(
    batch: ResultReportBatchRecord,
    items: ResultReportDeliveryItemCreate[],
  ): Promise<ResultReportBatchRecord>;
  processBatch(batchId: string): Promise<ResultReportBatchStatus>;
}

const createDefaultDependencies = (
  env: Env,
  user: JWTPayload,
): ResultReportCreateBatchDependencies => ({
  findBatchByRequest: (teacherId, requestId) => (
    findResultReportBatchByRequest(env.DB, teacherId, requestId)
  ),
  loadScope: (input) => loadResultReportCohortScope(env, user, input),
  createBatch: (batch, items) => createResultReportBatch(env.DB, batch, items),
  processBatch: (batchId) => processResultReportBatch(
    batchId,
    createResultReportDeliveryRuntime(env, user),
  ),
});

const expiresAfterDays = (now: string, days: number): string => {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

export async function handleCreateResultReportBatch(
  request: Request,
  env: Env,
  injected?: ResultReportCreateBatchDependencies,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return resultReportError('RESULT_REPORT_FORBIDDEN', 'Teacher access required', 403);
  }

  const input = await parseCreateResultReportBatchRequest(request);
  if (input instanceof Response) return input;
  const teacherId = authResult.user.username;
  const deps = injected || createDefaultDependencies(env, authResult.user);

  const existing = await deps.findBatchByRequest(teacherId, input.requestId);
  if (existing) {
    const status = existing.deliveryStatus === 'completed'
      ? existing.deliveryStatus
      : await deps.processBatch(existing.id);
    return resultReportSuccess<CreateResultReportBatchResult>({
      batchId: existing.id,
      status,
    });
  }

  const scope = await deps.loadScope(input);
  if (scope instanceof Response) return scope;
  const selected = buildResultReportCohort(
    scope.roster.map((student) => ({
      id: String(student.id),
      fullName: student.full_name,
      username: student.username,
      parentPhone: student.parent_phone ?? null,
    })),
    scope.results.map((result) => ({
      id: String(result.id),
      studentName: result.student_name,
      score: Number(result.score) || 0,
      correctCount: Number(result.correct_count) || 0,
      totalQuestions: Number(result.total_questions) || 0,
      submittedAt: result.submitted_at,
      quizTitle: result.quiz_title || scope.quiz.title,
    })),
    input.attemptPolicy,
  );
  const readyByResultId = new Map(selected.ready.map((item) => [item.result.id, item]));
  for (const draft of input.drafts) {
    if (!readyByResultId.has(draft.resultId)) {
      return resultReportError(
        'RESULT_REPORT_RESULT_OUT_OF_SCOPE',
        'A selected result is outside the server cohort',
        400,
      );
    }
  }

  const now = new Date().toISOString();
  const batchId = `rrb-${crypto.randomUUID().slice(0, 12)}`;
  const batch: ResultReportBatchRecord = {
    id: batchId,
    teacherId,
    requestId: input.requestId,
    classId: scope.classroom.id,
    className: scope.classroom.name,
    quizId: scope.quiz.id,
    quizTitle: scope.quiz.title,
    attemptPolicy: input.attemptPolicy,
    notifyStudents: input.notifyStudents,
    createParentLinks: input.createParentLinks,
    deliveryStatus: 'draft',
    expiresAt: expiresAfterDays(now, input.expiresInDays),
    createdAt: now,
    updatedAt: now,
  };
  const items: ResultReportDeliveryItemCreate[] = input.drafts.map((draft) => {
    const canonical = readyByResultId.get(draft.resultId)!;
    return {
      id: `rri-${crypto.randomUUID().slice(0, 12)}`,
      batchId,
      resultId: draft.resultId,
      phieuId: null,
      studentId: canonical.student.id,
      studentName: canonical.student.fullName,
      parentPhone: canonical.student.parentPhone,
      notificationId: null,
      publicLinkId: null,
      studentStatus: input.notifyStudents ? 'pending' : 'not_requested',
      parentStatus: 'not_requested',
      attemptCount: 0,
      lastError: null,
      draft,
      createdAt: now,
      updatedAt: now,
    };
  });

  let created: ResultReportBatchRecord;
  try {
    created = await deps.createBatch(batch, items);
  } catch (error) {
    const raced = await deps.findBatchByRequest(teacherId, input.requestId);
    if (!raced) throw error;
    created = raced;
  }
  const status = created.deliveryStatus === 'completed'
    ? created.deliveryStatus
    : await deps.processBatch(created.id);
  return resultReportSuccess<CreateResultReportBatchResult>({
    batchId: created.id,
    status,
  }, 201);
}
