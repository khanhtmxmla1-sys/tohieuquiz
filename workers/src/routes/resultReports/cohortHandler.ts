import type { ResultReportCohortResponse } from '../../../../shared/result-reports.contract';
import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import {
  buildResultReportCohort,
  type ResultReportRosterRow,
  type ResultReportSourceRow,
} from './attemptSelection';
import { loadResultReportCohortScope } from './cohortRepository';
import { parseResultReportCohortRequest } from './request';
import { resultReportError, resultReportSuccess } from './responses';

export async function handleResultReportCohort(
  request: Request,
  env: Env,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return resultReportError(
      'RESULT_REPORT_FORBIDDEN',
      'Teacher access required',
      403,
    );
  }

  const input = await parseResultReportCohortRequest(request);
  if (input instanceof Response) return input;

  const scope = await loadResultReportCohortScope(env, authResult.user, input);
  if (scope instanceof Response) return scope;

  const roster: ResultReportRosterRow[] = scope.roster.map((student) => ({
    id: String(student.id),
    fullName: student.full_name,
    username: student.username,
    parentPhone: student.parent_phone ?? null,
  }));
  const results: ResultReportSourceRow[] = scope.results.map((result) => ({
    id: String(result.id),
    studentName: result.student_name,
    score: Number(result.score) || 0,
    correctCount: Number(result.correct_count) || 0,
    totalQuestions: Number(result.total_questions) || 0,
    submittedAt: result.submitted_at,
    quizTitle: result.quiz_title || scope.quiz.title,
  }));
  const selected = buildResultReportCohort(roster, results, input.attemptPolicy);

  const response: ResultReportCohortResponse = {
    class: { id: scope.classroom.id, name: scope.classroom.name },
    quiz: { id: scope.quiz.id, title: scope.quiz.title },
    attemptPolicy: input.attemptPolicy,
    summary: {
      totalStudents: roster.length,
      completedStudents: selected.ready.length,
      notCompletedStudents: selected.notCompleted.length,
      unresolvedStudents: selected.unresolved.length,
      reportCount: selected.ready.length,
    },
    ready: selected.ready,
    notCompleted: selected.notCompleted,
    unresolved: selected.unresolved,
  };

  return resultReportSuccess(response);
}
