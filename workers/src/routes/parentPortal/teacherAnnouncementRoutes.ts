import { z } from 'zod';
import { PARENT_NOTIFICATION_KINDS, type ParentNotificationKind } from '../../../../shared/parent-portal.contract';
import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import {
  requireTeacherForParentClass,
  type AuthorizedParentClass,
} from '../../parentPortal/authorization';
import { fanOutParentNotificationToClass } from '../../parentPortal/notificationService';
import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';
import { errorResponse, jsonResponse } from '../../utils/response';

export type ParentAccessStatus = 'not_issued' | 'pending' | 'active' | 'revoked';

export interface ParentAnnouncementRecord {
  id: string;
  classId: string;
  title: string;
  body: string;
  isImportant: boolean;
  status: 'PUBLISHED' | 'REVOKED';
  createdBy: string;
  publishedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface ParentAnnouncementMetrics extends ParentAnnouncementRecord {
  targetCount: number;
  readCount: number;
  unreadCount: number;
}

export interface ParentDeliveryItem {
  studentId: string;
  studentName: string;
  parentAccessStatus: ParentAccessStatus;
  unreadCount: number;
  lastViewedAt: string | null;
}

interface CreateAnnouncementInput {
  id: string;
  classId: string;
  title: string;
  body: string;
  isImportant: boolean;
  createdBy: string;
  publishedAt: string;
  expiresAt: string | null;
}

export interface TeacherAnnouncementRuntime {
  authorizeClass(
    db: D1Database,
    user: JWTPayload,
    classId: string,
  ): Promise<AuthorizedParentClass | Response>;
  createAnnouncement(input: CreateAnnouncementInput): Promise<{
    announcement: ParentAnnouncementRecord;
    delivery: { targetCount: number; createdCount: number };
  }>;
  listAnnouncements(classId: string): Promise<ParentAnnouncementMetrics[]>;
  findAnnouncement(id: string): Promise<ParentAnnouncementRecord | null>;
  revokeAnnouncement(id: string, now: string): Promise<void>;
  listDelivery(classId: string, kind: ParentNotificationKind | null): Promise<ParentDeliveryItem[]>;
  now(): Date;
}

const createSchema = z.object({
  classId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(2000),
  isImportant: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

const mapAnnouncement = (row: Record<string, unknown>): ParentAnnouncementRecord => ({
  id: String(row.id),
  classId: String(row.class_id),
  title: String(row.title),
  body: String(row.body),
  isImportant: Number(row.is_important) === 1,
  status: String(row.status) as 'PUBLISHED' | 'REVOKED',
  createdBy: String(row.created_by),
  publishedAt: String(row.published_at),
  expiresAt: row.expires_at ? String(row.expires_at) : null,
  revokedAt: row.revoked_at ? String(row.revoked_at) : null,
});

const makeRuntime = (env: Env): TeacherAnnouncementRuntime => ({
  authorizeClass: requireTeacherForParentClass,

  async createAnnouncement(input) {
    await env.DB.prepare(`
      INSERT INTO parent_class_announcements (
        id, class_id, title, body, is_important, status,
        created_by, published_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, 'PUBLISHED', ?, ?, ?)
    `).bind(
      input.id,
      input.classId,
      input.title,
      input.body,
      input.isImportant ? 1 : 0,
      input.createdBy,
      input.publishedAt,
      input.expiresAt,
    ).run();
    const delivery = await fanOutParentNotificationToClass(env.DB, {
      classId: input.classId,
      kind: 'class_announcement',
      sourceType: 'class_announcement',
      sourceId: input.id,
      title: input.title,
      body: input.body,
      isImportant: input.isImportant,
      publishedAt: input.publishedAt,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
    });
    return {
      announcement: {
        ...input,
        status: 'PUBLISHED',
        revokedAt: null,
      },
      delivery,
    };
  },

  async listAnnouncements(classId) {
    const rows = await env.DB.prepare(`
      SELECT a.*,
             COUNT(pn.id) AS target_count,
             SUM(CASE WHEN pn.read_at IS NOT NULL THEN 1 ELSE 0 END) AS read_count,
             SUM(CASE WHEN pn.id IS NOT NULL AND pn.read_at IS NULL THEN 1 ELSE 0 END) AS unread_count
      FROM parent_class_announcements a
      LEFT JOIN parent_notifications pn
        ON pn.source_type = 'class_announcement'
       AND pn.source_id = a.id
       AND pn.revoked_at IS NULL
      WHERE a.class_id = ?
      GROUP BY a.id
      ORDER BY a.published_at DESC, a.id DESC
    `).bind(classId).all<Record<string, unknown>>();
    return rows.results.map(row => ({
      ...mapAnnouncement(row),
      targetCount: Number(row.target_count || 0),
      readCount: Number(row.read_count || 0),
      unreadCount: Number(row.unread_count || 0),
    }));
  },

  async findAnnouncement(id) {
    const row = await env.DB.prepare(`
      SELECT * FROM parent_class_announcements WHERE id = ? LIMIT 1
    `).bind(id).first<Record<string, unknown>>();
    return row ? mapAnnouncement(row) : null;
  },

  async revokeAnnouncement(id, now) {
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE parent_class_announcements
        SET status = 'REVOKED', revoked_at = ?
        WHERE id = ? AND status = 'PUBLISHED'
      `).bind(now, id),
      env.DB.prepare(`
        UPDATE parent_notifications
        SET revoked_at = ?
        WHERE source_type = 'class_announcement'
          AND source_id = ? AND revoked_at IS NULL
      `).bind(now, id),
    ]);
  },

  async listDelivery(classId, kind) {
    const kindFilter = kind ? 'AND pn.kind = ?' : '';
    const bindings = kind ? [classId, kind, kind] : [classId];
    const rows = await env.DB.prepare(`
      SELECT s.id AS student_id, s.full_name AS student_name,
        COALESCE((
          SELECT LOWER(pl.status)
          FROM parent_links pl
          WHERE pl.student_id = s.id
          ORDER BY pl.created_at DESC, pl.id DESC
          LIMIT 1
        ), 'not_issued') AS parent_access_status,
        (
          SELECT COUNT(*)
          FROM parent_notifications pn
          WHERE pn.student_id = s.id
            AND pn.read_at IS NULL
            AND pn.revoked_at IS NULL
            AND (pn.expires_at IS NULL OR pn.expires_at > datetime('now'))
            ${kindFilter}
        ) AS unread_count,
        (
          SELECT MAX(pn.read_at)
          FROM parent_notifications pn
          WHERE pn.student_id = s.id
            AND pn.revoked_at IS NULL
            ${kindFilter}
        ) AS last_viewed_at
      FROM students s
      WHERE s.class_id = ? AND COALESCE(s.archived_at, '') = ''
      ORDER BY s.full_name COLLATE NOCASE, s.id
    `).bind(...bindings.reverse()).all<Record<string, unknown>>();
    return rows.results.map(row => ({
      studentId: String(row.student_id),
      studentName: String(row.student_name),
      parentAccessStatus: String(row.parent_access_status) as ParentAccessStatus,
      unreadCount: Number(row.unread_count || 0),
      lastViewedAt: row.last_viewed_at ? String(row.last_viewed_at) : null,
    }));
  },

  now: () => new Date(),
});

const readBody = async (request: Request): Promise<unknown> => {
  try { return await request.json(); } catch { return null; }
};

export async function handleTeacherAnnouncementRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  injectedRuntime?: TeacherAnnouncementRuntime,
): Promise<Response | null> {
  const isCollection = path === '/api/parent-announcements';
  const revokeMatch = path.match(/^\/api\/parent-announcements\/([^/]+)\/revoke$/);
  const isDelivery = path === '/api/parent-delivery';
  if (!isCollection && !revokeMatch && !isDelivery) return null;

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return auth;
  if (!requireTeacher(auth.user)) return errorResponse('Forbidden: Teacher access required', 403);
  const runtime = injectedRuntime || makeRuntime(env);

  if (isCollection && method === 'POST') {
    const parsed = createSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse('Invalid announcement data', 400);
    const expiresAt = parsed.data.expiresAt || null;
    if (expiresAt && Date.parse(expiresAt) <= runtime.now().getTime()) {
      return errorResponse('expiresAt must be in the future', 400);
    }
    const allowed = await runtime.authorizeClass(env.DB, auth.user, parsed.data.classId);
    if (allowed instanceof Response) return allowed;
    const publishedAt = runtime.now().toISOString();
    const result = await runtime.createAnnouncement({
      id: `pa-${crypto.randomUUID()}`,
      classId: parsed.data.classId,
      title: parsed.data.title,
      body: parsed.data.body,
      isImportant: parsed.data.isImportant,
      createdBy: auth.user.username,
      publishedAt,
      expiresAt,
    });
    return jsonResponse({ data: result }, 201);
  }

  if (isCollection && method === 'GET') {
    const classId = new URL(request.url).searchParams.get('classId')?.trim() || '';
    if (!classId) return errorResponse('classId is required', 400);
    const allowed = await runtime.authorizeClass(env.DB, auth.user, classId);
    if (allowed instanceof Response) return allowed;
    return jsonResponse({ data: { items: await runtime.listAnnouncements(classId) } });
  }

  if (revokeMatch && method === 'POST') {
    const announcement = await runtime.findAnnouncement(revokeMatch[1]);
    if (!announcement) return errorResponse('Announcement not found', 404);
    const allowed = await runtime.authorizeClass(env.DB, auth.user, announcement.classId);
    if (allowed instanceof Response) return allowed;
    await runtime.revokeAnnouncement(announcement.id, runtime.now().toISOString());
    return jsonResponse({ data: { id: announcement.id, status: 'REVOKED' } });
  }

  if (isDelivery && method === 'GET') {
    const url = new URL(request.url);
    const classId = url.searchParams.get('classId')?.trim() || '';
    if (!classId) return errorResponse('classId is required', 400);
    const rawKind = url.searchParams.get('kind')?.trim() || '';
    if (rawKind && !PARENT_NOTIFICATION_KINDS.includes(rawKind as ParentNotificationKind)) {
      return errorResponse('Invalid notification kind', 400);
    }
    const allowed = await runtime.authorizeClass(env.DB, auth.user, classId);
    if (allowed instanceof Response) return allowed;
    const kind = rawKind ? rawKind as ParentNotificationKind : null;
    return jsonResponse({ data: { items: await runtime.listDelivery(classId, kind) } });
  }

  return errorResponse('Method not allowed', 405);
}
