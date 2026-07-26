import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { certificateError, certificateSuccess } from './responses';

export async function handleUploadTemplate(): Promise<Response> {
  return certificateError(
    'CERTIFICATE_TEMPLATE_ADMIN_ONLY',
    'Use the admin certificate template endpoint',
    405,
  );
}

// GET /api/certificates/templates
export async function handleGetTemplates(request: Request, env: Env): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return certificateError('CERTIFICATE_FORBIDDEN', 'Forbidden', 403);
  }

  const schoolId = authResult.user.school_id ?? authResult.user.username;
  const { results } = await env.DB.prepare(`
    SELECT id, name, description, thumbnail_r2_key, is_active, is_default
    FROM certificate_templates
    WHERE is_active = 1 AND (school_id = ? OR school_id IS NULL OR created_by = 'admin')
    ORDER BY is_default DESC, created_at DESC
  `).bind(schoolId).all();

  return certificateSuccess(results);
}

// GET /api/certificates/my
