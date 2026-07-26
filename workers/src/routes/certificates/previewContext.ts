import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import type { FieldConfig } from '../../types/certificates';
import { certificateError } from './responses';
import { loadPreviewQuiz } from './previewQuiz';
import type { PreviewContext, PreviewInput, PreviewTemplate } from './previewTypes';

export async function loadPreviewContext(
  env: Env,
  user: JWTPayload,
  input: PreviewInput,
): Promise<Response | PreviewContext> {
  const classroom = await env.DB.prepare(`
    SELECT id, name, teacher_username FROM classes WHERE id = ?
  `).bind(input.classId).first<{ id: string; name: string; teacher_username: string }>();
  if (!classroom) return certificateError('CERTIFICATE_CLASS_NOT_FOUND', 'Class not found', 404);
  if (user.role !== 'admin' && classroom.teacher_username !== user.username) {
    return certificateError('CERTIFICATE_CLASS_FORBIDDEN', 'You do not own this class', 403);
  }

  const student = await env.DB.prepare(`
    SELECT id, full_name FROM students WHERE id = ? AND class_id = ?
  `).bind(input.studentId, input.classId).first<{ id: string; full_name: string }>();
  if (!student) {
    return certificateError(
      'CERTIFICATE_STUDENT_SCOPE_INVALID',
      'Student does not belong to the selected class',
      403,
    );
  }

  const template = await env.DB.prepare(`
    SELECT id, school_id, created_by, bg_image_r2_key, fields_config, canvas_width, canvas_height
    FROM certificate_templates WHERE id = ? AND is_active = 1
  `).bind(input.templateId).first<PreviewTemplate>();
  if (!template) return certificateError('CERTIFICATE_TEMPLATE_NOT_FOUND', 'Active template not found', 404);
  const schoolId = user.school_id ?? user.username;
  if (
    user.role !== 'admin'
    && template.school_id !== null
    && template.created_by !== 'admin'
    && template.school_id !== schoolId
  ) {
    return certificateError('CERTIFICATE_TEMPLATE_FORBIDDEN', 'Template is outside your scope', 403);
  }

  const quizData = await loadPreviewQuiz(env, user, input, classroom.name, student.full_name);
  if (quizData instanceof Response) return quizData;
  let fieldsConfig: FieldConfig[];
  try {
    fieldsConfig = JSON.parse(template.fields_config || '[]') as FieldConfig[];
  } catch {
    return certificateError('CERTIFICATE_TEMPLATE_INVALID', 'Template field configuration is invalid', 500);
  }
  fieldsConfig = fieldsConfig.map((field) => {
    if (field.key === 'student_name' && input.studentNameFont !== null) {
      return { ...field, fontFamily: input.studentNameFont };
    }
    if (field.key === 'quiz_title' && input.achievementPrefix !== null) {
      return { ...field, prefix: input.achievementPrefix ? `${input.achievementPrefix} ` : '' };
    }
    if (field.key === 'date' && input.dateLine !== null) {
      return { ...field, prefix: '', format: undefined };
    }
    return field;
  });
  return {
    input,
    studentName: student.full_name,
    quizTitle: quizData.quizTitle,
    score: quizData.score,
    template,
    fieldsConfig,
  };
}
