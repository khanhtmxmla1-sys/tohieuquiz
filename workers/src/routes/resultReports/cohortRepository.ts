import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { resultReportError } from './responses';
import type {
  ResultReportClassRow,
  ResultReportCohortInput,
  ResultReportCohortScope,
  ResultReportQuizRow,
  ResultReportRosterDbRow,
  ResultReportSourceDbRow,
} from './types';

async function loadClassScope(
  env: Env,
  user: JWTPayload,
  classId: string,
): Promise<ResultReportClassRow | Response> {
  const classroom = await env.DB.prepare(`
    SELECT id, name, teacher_username
    FROM classes
    WHERE id = ? AND archived_at IS NULL
    LIMIT 1
  `).bind(classId).first<ResultReportClassRow>();

  if (!classroom) {
    return resultReportError('RESULT_REPORT_CLASS_NOT_FOUND', 'Class not found', 404);
  }
  if (user.role !== 'admin' && classroom.teacher_username !== user.username) {
    return resultReportError(
      'RESULT_REPORT_CLASS_FORBIDDEN',
      'Class is outside your scope',
      403,
    );
  }
  return classroom;
}

async function loadQuizScope(
  env: Env,
  user: JWTPayload,
  input: ResultReportCohortInput,
): Promise<ResultReportQuizRow | Response> {
  const quiz = await env.DB.prepare(`
    SELECT id, title, category FROM quizzes WHERE id = ? LIMIT 1
  `).bind(input.quizId).first<ResultReportQuizRow>();
  if (!quiz) {
    return resultReportError('RESULT_REPORT_QUIZ_NOT_FOUND', 'Quiz not found', 404);
  }

  if (user.role !== 'admin') {
    const access = await env.DB.prepare(`
      SELECT q.id FROM quizzes q
      WHERE q.id = ? AND (
        q.created_by = ? OR EXISTS (
          SELECT 1 FROM assignments a
          WHERE a.quiz_id = q.id AND a.class_id = ?
        )
      )
      LIMIT 1
    `).bind(input.quizId, user.username, input.classId).first<{ id: string }>();
    if (!access) {
      return resultReportError(
        'RESULT_REPORT_QUIZ_FORBIDDEN',
        'Quiz is outside your scope',
        403,
      );
    }
  }

  return quiz;
}

export async function loadResultReportCohortScope(
  env: Env,
  user: JWTPayload,
  input: ResultReportCohortInput,
): Promise<ResultReportCohortScope | Response> {
  const classroom = await loadClassScope(env, user, input.classId);
  if (classroom instanceof Response) return classroom;

  const quiz = await loadQuizScope(env, user, input);
  if (quiz instanceof Response) return quiz;

  const rosterResult = await env.DB.prepare(`
    SELECT id, full_name, username, parent_phone
    FROM students
    WHERE class_id = ? AND archived_at IS NULL
    ORDER BY full_name ASC, id ASC
  `).bind(classroom.id).all<ResultReportRosterDbRow>();

  const resultsResult = await env.DB.prepare(`
    SELECT id, student_name, score, correct_count, total_questions,
           submitted_at, quiz_title
    FROM results
    WHERE quiz_id = ?
      AND (
        class_name = ?
        OR class_name = 'Lớp ' || ?
        OR REPLACE(class_name, 'Lớp ', '') = REPLACE(?, 'Lớp ', '')
      )
      AND answers != '{"status":"STARTED"}'
    ORDER BY submitted_at ASC, id ASC
  `).bind(quiz.id, classroom.name, classroom.name, classroom.name)
    .all<ResultReportSourceDbRow>();

  return {
    classroom,
    quiz,
    roster: rosterResult.results ?? [],
    results: resultsResult.results ?? [],
  };
}
