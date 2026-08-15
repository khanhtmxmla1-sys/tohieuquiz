// Admin Certificate Template API
import type { Env } from '../types';
import type { CertificateTemplate } from '../types/certificates';
import { verifyJWTMiddleware, requireAdmin } from '../middleware/jwtAuth';

const TEMPLATE_KEYS = new Set(['student_name', 'score', 'quiz_title', 'date', 'teacher_name', 'custom_note', 'static_text']);

function error(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function validFlag(value: unknown): value is number {
  return value === 0 || value === 1;
}

function validCanvasDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 5000;
}

function normalizeFieldsConfig(value: unknown): string | Response {
  if (value === undefined) return '[]';
  if (typeof value !== 'string' || value.length > 50000) return error('fields_config must be a JSON string');
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length > 64) return error('fields_config must be a JSON array with at most 64 fields');
    for (const field of parsed) {
      if (!field || typeof field !== 'object') return error('fields_config contains an invalid field');
      const item = field as Record<string, unknown>;
      if (typeof item.key !== 'string' || !TEMPLATE_KEYS.has(item.key)) return error('fields_config contains an unsupported field key');
      if (typeof item.x !== 'number' || !Number.isFinite(item.x) || typeof item.y !== 'number' || !Number.isFinite(item.y)) {
        return error('fields_config coordinates must be finite numbers');
      }
      if (item.fontSize !== undefined && (typeof item.fontSize !== 'number' || !Number.isFinite(item.fontSize) || item.fontSize < 6 || item.fontSize > 240)) {
        return error('fields_config fontSize is invalid');
      }
    }
    return JSON.stringify(parsed);
  } catch {
    return error('fields_config must contain valid JSON');
  }
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body = await request.json<unknown>();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : error('Request body must be a JSON object');
  } catch {
    return error('Request body must be valid JSON');
  }
}

export async function handleAdminCertificateRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const user = authResult.user;
  if (!requireAdmin(user)) return Response.json({ error: 'Forbidden: admin role required' }, { status: 403 });

  if (path === '/api/admin/certificate-templates' && method === 'GET') {
    const schoolId = user.school_id ?? user.username;
    const templates = await env.DB.prepare(
      'SELECT * FROM certificate_templates WHERE school_id = ? OR school_id IS NULL ORDER BY is_default DESC, created_at DESC',
    ).bind(schoolId).all<CertificateTemplate>();
    return Response.json({ data: templates.results });
  }

  if (path === '/api/admin/certificate-templates' && method === 'POST') {
    const body = await readBody(request);
    if (body instanceof Response) return body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const bgKey = typeof body.bg_image_r2_key === 'string' ? body.bg_image_r2_key.trim() : '';
    if (!name || name.length > 160 || !bgKey || bgKey.length > 500) return error('name and bg_image_r2_key are required and must be within allowed length');
    const fieldsConfig = normalizeFieldsConfig(body.fields_config);
    if (fieldsConfig instanceof Response) return fieldsConfig;
    const isDefault = body.is_default ?? 0;
    const canvasWidth = body.canvas_width ?? 1200;
    const canvasHeight = body.canvas_height ?? 848;
    if (!validFlag(isDefault)) return error('is_default must be 0 or 1');
    if (!validCanvasDimension(canvasWidth) || !validCanvasDimension(canvasHeight)) return error('canvas dimensions must be integers between 100 and 5000');

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await env.DB.prepare(
      `INSERT INTO certificate_templates (id, school_id, name, bg_image_r2_key, fields_config, is_default, canvas_width, canvas_height, created_by)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, name, bgKey, fieldsConfig, isDefault, canvasWidth, canvasHeight, user.username).run();
    return Response.json({ data: { id } }, { status: 201 });
  }

  const patchMatch = path.match(/^\/api\/admin\/certificate-templates\/([^/]+)$/);
  if (patchMatch && method === 'PATCH') {
    const body = await readBody(request);
    if (body instanceof Response) return body;
    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 160) return error('name is invalid');
      fields.push('name = ?'); values.push(name);
    }
    if (body.fields_config !== undefined) {
      const fieldsConfig = normalizeFieldsConfig(body.fields_config);
      if (fieldsConfig instanceof Response) return fieldsConfig;
      fields.push('fields_config = ?'); values.push(fieldsConfig);
    }
    if (body.is_active !== undefined) {
      if (!validFlag(body.is_active)) return error('is_active must be 0 or 1');
      fields.push('is_active = ?'); values.push(body.is_active);
    }
    if (body.is_default !== undefined) {
      if (!validFlag(body.is_default)) return error('is_default must be 0 or 1');
      fields.push('is_default = ?'); values.push(body.is_default);
    }
    if (body.canvas_width !== undefined) {
      if (!validCanvasDimension(body.canvas_width)) return error('canvas_width must be an integer between 100 and 5000');
      fields.push('canvas_width = ?'); values.push(body.canvas_width);
    }
    if (body.canvas_height !== undefined) {
      if (!validCanvasDimension(body.canvas_height)) return error('canvas_height must be an integer between 100 and 5000');
      fields.push('canvas_height = ?'); values.push(body.canvas_height);
    }
    if (fields.length === 0) return error('Nothing to update');

    const templateId = decodeURIComponent(patchMatch[1]);
    const schoolId = user.school_id ?? user.username;
    if (body.is_default === 1) {
      await env.DB.prepare('UPDATE certificate_templates SET is_default = 0 WHERE school_id = ? OR school_id IS NULL')
        .bind(schoolId).run();
    }
    values.push(templateId, schoolId);
    await env.DB.prepare(`UPDATE certificate_templates SET ${fields.join(', ')} WHERE id = ? AND (school_id = ? OR school_id IS NULL)`)
      .bind(...values).run();
    return Response.json({ ok: true });
  }

  return null;
}
