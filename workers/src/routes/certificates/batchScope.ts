import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { certificateError } from './responses';
import { loadBatchQuizScope } from './batchQuizScope';
import type { BatchInput, BatchScope, BatchStudent } from './batchTypes';

export async function loadBatchScope(
  env: Env,
  user: JWTPayload,
  input: BatchInput,
): Promise<Response | BatchScope> {
  const classroom = await env.DB.prepare(`
    SELECT id, name, teacher_username FROM classes WHERE id = ?
  `).bind(input.classId).first<{ id: string; name: string; teacher_username: string }>();
  if (!classroom) return certificateError('CERTIFICATE_CLASS_NOT_FOUND', 'Class not found', 404);
  if (user.role !== 'admin' && classroom.teacher_username !== user.username) {
    return certificateError('CERTIFICATE_CLASS_FORBIDDEN', 'You do not own this class', 403);
  }

  const placeholders = input.studentIds.map(() => '?').join(', ');
  const { results: roster } = await env.DB.prepare(`
    SELECT id, full_name FROM students
    WHERE class_id = ? AND id IN (${placeholders})
  `).bind(input.classId, ...input.studentIds).all<BatchStudent>();
  if (roster.length !== input.studentIds.length) {
    return certificateError(
      'CERTIFICATE_STUDENT_SCOPE_INVALID',
      'One or more students do not belong to the selected class',
      403,
    );
  }

  const template = await env.DB.prepare(`
    SELECT id, school_id, created_by, is_active FROM certificate_templates WHERE id = ?
  `).bind(input.templateId).first<{
    id: string;
    school_id: string | null;
    created_by: string;
    is_active: number;
  }>();
  if (!template || !template.is_active) {
    return certificateError('CERTIFICATE_TEMPLATE_NOT_FOUND', 'Active template not found', 404);
  }
  const schoolId = user.school_id ?? user.username;
  const canUseTemplate = user.role === 'admin'
    || template.school_id === null
    || template.created_by === 'admin'
    || template.school_id === schoolId;
  if (!canUseTemplate) {
    return certificateError('CERTIFICATE_TEMPLATE_FORBIDDEN', 'Template is outside your scope', 403);
  }

  const quizScope = await loadBatchQuizScope(env, user, input, classroom.name);
  if (quizScope instanceof Response) return quizScope;
  return { roster, ...quizScope };
}
