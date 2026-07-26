// Admin Certificate Template API
// Routes: GET/POST /api/admin/certificate-templates
//         PATCH   /api/admin/certificate-templates/:id
import type { Env } from '../types';
import type { CertificateTemplate } from '../types/certificates';
import { verifyJWTMiddleware, requireAdmin } from '../middleware/jwtAuth';

export async function handleAdminCertificateRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response | null> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const user = authResult.user;
  if (!requireAdmin(user)) {
    return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }

  // GET /api/admin/certificate-templates
  if (path === '/api/admin/certificate-templates' && method === 'GET') {
    const schoolId = user.school_id ?? user.username;
    const templates = await env.DB.prepare(
      'SELECT * FROM certificate_templates WHERE school_id = ? OR school_id IS NULL ORDER BY is_default DESC, created_at DESC'
    ).bind(schoolId).all<CertificateTemplate>();
    return Response.json({ data: templates.results });
  }

  // POST /api/admin/certificate-templates
  if (path === '/api/admin/certificate-templates' && method === 'POST') {
    const body = await request.json() as {
      name: string;
      bg_image_r2_key: string;
      fields_config?: string;
      is_default?: number;
      canvas_width?: number;
      canvas_height?: number;
    };

    if (!body.name || !body.bg_image_r2_key) {
      return Response.json({ error: 'name and bg_image_r2_key are required' }, { status: 400 });
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await env.DB.prepare(
      `INSERT INTO certificate_templates (id, school_id, name, bg_image_r2_key, fields_config, is_default, canvas_width, canvas_height, created_by)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, body.name, body.bg_image_r2_key, body.fields_config ?? '[]', body.is_default ?? 0, body.canvas_width ?? 1200, body.canvas_height ?? 848, user.username).run();

    return Response.json({ data: { id } }, { status: 201 });
  }

  // PATCH /api/admin/certificate-templates/:id
  const patchMatch = path.match(/^\/api\/admin\/certificate-templates\/(\w+)$/);
  if (patchMatch && method === 'PATCH') {
    const templateId = patchMatch[1];
    const body = await request.json() as Partial<{
      name: string;
      fields_config: string;
      is_active: number;
      is_default: number;
      canvas_width: number;
      canvas_height: number;
    }>;

    const fields: string[] = [];
    const values: unknown[] = [];
    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.fields_config !== undefined) { fields.push('fields_config = ?'); values.push(body.fields_config); }
    if (body.is_active !== undefined) { fields.push('is_active = ?'); values.push(body.is_active); }
    if (body.is_default !== undefined) { fields.push('is_default = ?'); values.push(body.is_default); }
    if (body.canvas_width !== undefined) { fields.push('canvas_width = ?'); values.push(body.canvas_width); }
    if (body.canvas_height !== undefined) { fields.push('canvas_height = ?'); values.push(body.canvas_height); }

    if (fields.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });

    const schoolId = user.school_id ?? user.username;
    if (body.is_default === 1) {
      await env.DB.prepare(
        'UPDATE certificate_templates SET is_default = 0 WHERE school_id = ? OR school_id IS NULL'
      ).bind(schoolId).run();
    }
    values.push(templateId, schoolId);
    await env.DB.prepare(
      `UPDATE certificate_templates SET ${fields.join(', ')} WHERE id = ? AND (school_id = ? OR school_id IS NULL)`
    ).bind(...values).run();

    return Response.json({ ok: true });
  }

  return null;
}
