import type { Env } from '../types';
import { requireAdmin, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { auditStatement } from '../utils/audit';
import { withD1Retry } from '../utils/d1';
import { errorResponse, jsonResponse } from '../utils/response';

type DisplayMode = 'CONTENT' | 'SLIDER';
type Transition = 'FADE' | 'SLIDE';

type LoginMediaSettingsRow = {
  id: string;
  display_mode: DisplayMode;
  autoplay: number;
  interval_ms: number;
  transition: Transition;
  show_dots: number;
  show_arrows: number;
  pause_on_hover: number;
  version: number;
  updated_at: string;
  updated_by: string | null;
};

type LoginMediaSlideRow = {
  id: string;
  cloudinary_public_id: string;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
  alt_text: string;
  internal_title: string;
  link_url: string | null;
  open_new_tab: number;
  sort_order: number;
  enabled: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

type SlideInput = {
  cloudinaryPublicId: string;
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  altText: string;
  internalTitle: string;
  linkUrl: string | null;
  openNewTab: boolean;
  sortOrder: number;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

const DEFAULT_PUBLIC_SETTINGS = {
  autoplay: true,
  intervalMs: 5000,
  transition: 'FADE' as const,
  showDots: true,
  showArrows: true,
  pauseOnHover: true,
};

const DEFAULT_SETTINGS_ROW: LoginMediaSettingsRow = {
  id: 'default',
  display_mode: 'CONTENT',
  autoplay: 1,
  interval_ms: 5000,
  transition: 'FADE',
  show_dots: 1,
  show_arrows: 1,
  pause_on_hover: 1,
  version: 1,
  updated_at: '',
  updated_by: null,
};

const isObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const requestIdOf = (request: Request): string => (
  request.headers.get('cf-ray')
  || request.headers.get('x-request-id')
  || crypto.randomUUID()
);

const mapPublicSettings = (row: LoginMediaSettingsRow) => ({
  autoplay: row.autoplay === 1,
  intervalMs: row.interval_ms,
  transition: row.transition,
  showDots: row.show_dots === 1,
  showArrows: row.show_arrows === 1,
  pauseOnHover: row.pause_on_hover === 1,
});

const mapAdminSettings = (row: LoginMediaSettingsRow) => ({
  id: row.id,
  displayMode: row.display_mode,
  ...mapPublicSettings(row),
  version: row.version,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

const mapAdminSlide = (row: LoginMediaSlideRow) => ({
  id: row.id,
  cloudinaryPublicId: row.cloudinary_public_id,
  imageUrl: row.image_url,
  imageWidth: row.image_width,
  imageHeight: row.image_height,
  altText: row.alt_text,
  internalTitle: row.internal_title,
  linkUrl: row.link_url,
  openNewTab: row.open_new_tab === 1,
  sortOrder: row.sort_order,
  enabled: row.enabled === 1,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

const noStore = (response: Response): Response => {
  response.headers.set('Cache-Control', 'no-store');
  return response;
};

async function settingsRow(db: D1Database): Promise<LoginMediaSettingsRow | null> {
  return withD1Retry(
    () => db.prepare(`
      SELECT id, display_mode, autoplay, interval_ms, transition,
             show_dots, show_arrows, pause_on_hover, version, updated_at, updated_by
      FROM login_media_settings
      WHERE id = 'default'
      LIMIT 1
    `).first<LoginMediaSettingsRow>(),
    'login media settings read',
  );
}

async function publicSlides(db: D1Database, now: string): Promise<LoginMediaSlideRow[]> {
  const result = await withD1Retry(
    () => db.prepare(`
      SELECT id, cloudinary_public_id, image_url, image_width, image_height,
             alt_text, internal_title, link_url, open_new_tab, sort_order, enabled,
             starts_at, ends_at, created_at, created_by, updated_at, updated_by
      FROM login_media_slides
      WHERE enabled = 1
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at IS NULL OR ends_at > ?)
      ORDER BY sort_order ASC, created_at ASC
      LIMIT 10
    `).bind(now, now).all<LoginMediaSlideRow>(),
    'login media public slides read',
  );
  return result.results || [];
}

async function allSlides(db: D1Database): Promise<LoginMediaSlideRow[]> {
  const result = await withD1Retry(
    () => db.prepare(`
      SELECT id, cloudinary_public_id, image_url, image_width, image_height,
             alt_text, internal_title, link_url, open_new_tab, sort_order, enabled,
             starts_at, ends_at, created_at, created_by, updated_at, updated_by
      FROM login_media_slides
      ORDER BY sort_order ASC, created_at ASC
    `).all<LoginMediaSlideRow>(),
    'login media admin slides read',
  );
  return result.results || [];
}

function publicFallback(degraded = false): Response {
  return jsonResponse({
    status: 'success',
    data: {
      mode: 'CONTENT',
      settings: DEFAULT_PUBLIC_SETTINGS,
      slides: [],
      ...(degraded ? { degraded: true } : {}),
    },
  }, 200, 60);
}

async function handlePublicRead(env: Env): Promise<Response> {
  try {
    const row = await settingsRow(env.DB);
    if (!row || row.display_mode !== 'SLIDER') return publicFallback(false);
    const slides = await publicSlides(env.DB, new Date().toISOString());
    return jsonResponse({
      status: 'success',
      data: {
        mode: 'SLIDER',
        settings: mapPublicSettings(row),
        slides: slides
          .map(mapPublicSlide)
          .filter((slide): slide is NonNullable<typeof slide> => slide !== null),
      },
    }, 200, 60);
  } catch (error) {
    console.warn('[Login Media] public read degraded:', error instanceof Error ? error.message : 'unknown error');
    return publicFallback(true);
  }
}

function safeLink(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  const normalized = value.trim();
  if (!normalized || /[\\\u0000-\u001F\u007F]/.test(normalized)) return undefined;
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function safeCloudinaryImage(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null;
    if (url.username || url.password || (url.port && url.port !== '443')) return null;
    if (!url.pathname.includes('/image/upload/')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function mapPublicSlide(row: LoginMediaSlideRow) {
  const imageUrl = safeCloudinaryImage(row.image_url);
  if (!imageUrl) return null;
  const safeStoredLink = safeLink(row.link_url);
  const linkUrl = safeStoredLink === undefined || (safeStoredLink && !row.alt_text.trim())
    ? null
    : safeStoredLink;
  return {
    id: row.id,
    imageUrl,
    alt: row.alt_text,
    linkUrl,
    openNewTab: Boolean(linkUrl) && row.open_new_tab === 1,
  };
}

function safePublicId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 512) return null;
  if (!normalized.startsWith('tohieuquiz/login-media/')) return null;
  if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) return null;
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
  return normalized;
}

function positiveDimension(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > 20000) return undefined;
  return Number(value);
}

function optionalIsoDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function parseSlideInput(body: Record<string, unknown>): SlideInput | null {
  const cloudinaryPublicId = safePublicId(body.cloudinaryPublicId);
  const imageUrl = safeCloudinaryImage(body.imageUrl);
  const imageWidth = positiveDimension(body.imageWidth);
  const imageHeight = positiveDimension(body.imageHeight);
  const linkUrl = safeLink(body.linkUrl);
  const startsAt = optionalIsoDate(body.startsAt);
  const endsAt = optionalIsoDate(body.endsAt);
  const altText = typeof body.altText === 'string' ? body.altText.trim() : '';
  const internalTitle = typeof body.internalTitle === 'string' ? body.internalTitle.trim() : '';
  const openNewTab = body.openNewTab === undefined ? false : body.openNewTab;
  const enabled = body.enabled === undefined ? false : body.enabled;
  const sortOrder = body.sortOrder === undefined ? 0 : body.sortOrder;

  if (!cloudinaryPublicId || !imageUrl || imageWidth === undefined || imageHeight === undefined
    || linkUrl === undefined || startsAt === undefined || endsAt === undefined
    || altText.length > 300 || internalTitle.length > 160
    || typeof openNewTab !== 'boolean' || typeof enabled !== 'boolean'
    || !Number.isInteger(sortOrder) || Number(sortOrder) < -1_000_000 || Number(sortOrder) > 1_000_000) {
    return null;
  }
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return null;
  if (linkUrl && !altText) return null;
  if (!linkUrl && openNewTab) return null;

  return {
    cloudinaryPublicId,
    imageUrl,
    imageWidth,
    imageHeight,
    altText,
    internalTitle,
    linkUrl,
    openNewTab,
    sortOrder: Number(sortOrder),
    enabled,
    startsAt,
    endsAt,
  };
}

function parseSettingsInput(body: Record<string, unknown>) {
  const displayMode = body.displayMode;
  const transition = body.transition;
  const intervalMs = body.intervalMs;
  const expectedVersion = body.expectedVersion;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if ((displayMode !== 'CONTENT' && displayMode !== 'SLIDER')
    || (transition !== 'FADE' && transition !== 'SLIDE')
    || !Number.isInteger(intervalMs) || Number(intervalMs) < 2000 || Number(intervalMs) > 30000
    || !Number.isInteger(expectedVersion) || Number(expectedVersion) < 1
    || typeof body.autoplay !== 'boolean'
    || typeof body.showDots !== 'boolean'
    || typeof body.showArrows !== 'boolean'
    || typeof body.pauseOnHover !== 'boolean'
    || !reason || reason.length > 500) {
    return null;
  }
  return {
    displayMode,
    transition,
    intervalMs: Number(intervalMs),
    expectedVersion: Number(expectedVersion),
    autoplay: body.autoplay,
    showDots: body.showDots,
    showArrows: body.showArrows,
    pauseOnHover: body.pauseOnHover,
    reason,
  };
}

async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  const value = await request.json().catch(() => null);
  return isObject(value) ? value : null;
}

async function slideById(db: D1Database, id: string): Promise<LoginMediaSlideRow | null> {
  return db.prepare(`
    SELECT id, cloudinary_public_id, image_url, image_width, image_height,
           alt_text, internal_title, link_url, open_new_tab, sort_order, enabled,
           starts_at, ends_at, created_at, created_by, updated_at, updated_by
    FROM login_media_slides
    WHERE id = ?
    LIMIT 1
  `).bind(id).first<LoginMediaSlideRow>();
}

async function handleSettingsPatch(request: Request, env: Env, actor: string): Promise<Response> {
  const body = await jsonBody(request);
  if (!body) return errorResponse('Dữ liệu cấu hình không hợp lệ.', 400);
  const input = parseSettingsInput(body);
  if (!input) return errorResponse('Cấu hình trình chiếu không hợp lệ.', 400);

  const before = await settingsRow(env.DB) || DEFAULT_SETTINGS_ROW;
  if (before.version !== input.expectedVersion) {
    return errorResponse('Cấu hình đã được cập nhật ở phiên khác. Vui lòng tải lại.', 409);
  }

  const now = new Date().toISOString();
  const projected = {
    ...mapAdminSettings(before),
    displayMode: input.displayMode,
    autoplay: input.autoplay,
    intervalMs: input.intervalMs,
    transition: input.transition,
    showDots: input.showDots,
    showArrows: input.showArrows,
    pauseOnHover: input.pauseOnHover,
    version: before.version + 1,
    updatedAt: now,
    updatedBy: actor,
  };
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE login_media_settings
      SET display_mode = ?, autoplay = ?, interval_ms = ?, transition = ?,
          show_dots = ?, show_arrows = ?, pause_on_hover = ?,
          version = version + 1, updated_at = ?, updated_by = ?
      WHERE id = 'default' AND version = ?
    `).bind(
      input.displayMode,
      input.autoplay ? 1 : 0,
      input.intervalMs,
      input.transition,
      input.showDots ? 1 : 0,
      input.showArrows ? 1 : 0,
      input.pauseOnHover ? 1 : 0,
      now,
      actor,
      input.expectedVersion,
    ),
    env.DB.prepare(`
      INSERT INTO admin_audit_logs
        (id, actor_username, action, target_type, target_id, request_id,
         before_json, after_json, created_at)
      SELECT ?, ?, 'LOGIN_MEDIA_SETTINGS_UPDATED', 'login_media_settings', 'default', ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM login_media_settings
        WHERE id = 'default' AND version = ? AND updated_at = ? AND updated_by = ?
      )
    `).bind(
      `audit-${crypto.randomUUID()}`,
      actor,
      requestIdOf(request),
      JSON.stringify(mapAdminSettings(before)),
      JSON.stringify({ ...projected, reason: input.reason }),
      now,
      input.expectedVersion + 1,
      now,
      actor,
    ),
  ]);

  const after = await settingsRow(env.DB);
  if (!after
    || after.version !== input.expectedVersion + 1
    || after.updated_at !== now
    || after.updated_by !== actor) {
    return errorResponse('Cấu hình đã được cập nhật ở phiên khác. Vui lòng tải lại.', 409);
  }
  return noStore(jsonResponse({ status: 'success', data: mapAdminSettings(after) }));
}

async function handleSlideCreate(request: Request, env: Env, actor: string): Promise<Response> {
  const body = await jsonBody(request);
  const input = body ? parseSlideInput(body) : null;
  if (!input) return errorResponse('Dữ liệu banner không hợp lệ.', 400);
  const id = `login-slide-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const mapped = {
    id,
    ...input,
    createdAt: now,
    createdBy: actor,
    updatedAt: now,
    updatedBy: actor,
  };

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO login_media_slides (
        id, cloudinary_public_id, image_url, image_width, image_height,
        alt_text, internal_title, link_url, open_new_tab, sort_order, enabled,
        starts_at, ends_at, created_at, created_by, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, input.cloudinaryPublicId, input.imageUrl, input.imageWidth, input.imageHeight,
      input.altText, input.internalTitle, input.linkUrl, input.openNewTab ? 1 : 0,
      input.sortOrder, input.enabled ? 1 : 0, input.startsAt, input.endsAt,
      now, actor, now, actor,
    ),
    auditStatement(env.DB, {
      actorUsername: actor,
      action: 'LOGIN_MEDIA_SLIDE_CREATED',
      targetType: 'login_media_slide',
      targetId: id,
      requestId: requestIdOf(request),
      after: mapped,
    }),
  ]);
  return noStore(jsonResponse({ status: 'success', data: mapped }, 201));
}

async function handleSlideUpdate(
  request: Request,
  env: Env,
  actor: string,
  id: string,
): Promise<Response> {
  const body = await jsonBody(request);
  if (!body || typeof body.expectedUpdatedAt !== 'string' || !body.expectedUpdatedAt) {
    return errorResponse('expectedUpdatedAt là bắt buộc khi cập nhật banner.', 400);
  }
  const input = parseSlideInput(body);
  if (!input) return errorResponse('Dữ liệu banner không hợp lệ.', 400);
  const before = await slideById(env.DB, id);
  if (!before) return errorResponse('Không tìm thấy banner.', 404);
  if (before.updated_at !== body.expectedUpdatedAt) {
    return errorResponse('Banner đã được cập nhật ở phiên khác. Vui lòng tải lại.', 409);
  }

  const now = new Date().toISOString();
  const projected = {
    ...mapAdminSlide(before),
    ...input,
    updatedAt: now,
    updatedBy: actor,
  };
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE login_media_slides
      SET cloudinary_public_id = ?, image_url = ?, image_width = ?, image_height = ?,
          alt_text = ?, internal_title = ?, link_url = ?, open_new_tab = ?, sort_order = ?,
          enabled = ?, starts_at = ?, ends_at = ?, updated_at = ?, updated_by = ?
      WHERE id = ? AND updated_at = ?
    `).bind(
      input.cloudinaryPublicId, input.imageUrl, input.imageWidth, input.imageHeight,
      input.altText, input.internalTitle, input.linkUrl, input.openNewTab ? 1 : 0,
      input.sortOrder, input.enabled ? 1 : 0, input.startsAt, input.endsAt,
      now, actor, id, body.expectedUpdatedAt,
    ),
    env.DB.prepare(`
      INSERT INTO admin_audit_logs
        (id, actor_username, action, target_type, target_id, request_id,
         before_json, after_json, created_at)
      SELECT ?, ?, 'LOGIN_MEDIA_SLIDE_UPDATED', 'login_media_slide', ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM login_media_slides WHERE id = ? AND updated_at = ? AND updated_by = ?
      )
    `).bind(
      `audit-${crypto.randomUUID()}`, actor, id, requestIdOf(request),
      JSON.stringify(mapAdminSlide(before)), JSON.stringify(projected), now, id, now, actor,
    ),
  ]);
  const after = await slideById(env.DB, id);
  if (!after || after.updated_at !== now || after.updated_by !== actor) {
    return errorResponse('Banner đã được cập nhật ở phiên khác. Vui lòng tải lại.', 409);
  }
  return noStore(jsonResponse({ status: 'success', data: mapAdminSlide(after) }));
}

async function handleReorder(request: Request, env: Env, actor: string): Promise<Response> {
  const body = await jsonBody(request);
  const slideIds = body?.slideIds;
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!Array.isArray(slideIds)
    || slideIds.some((id) => typeof id !== 'string' || !id)
    || new Set(slideIds).size !== slideIds.length
    || slideIds.length > 100
    || !reason || reason.length > 500) {
    return errorResponse('Danh sách sắp xếp banner không hợp lệ.', 400);
  }

  const existing = await env.DB.prepare('SELECT id FROM login_media_slides ORDER BY sort_order ASC, created_at ASC')
    .all<{ id: string }>();
  const existingIds = (existing.results || []).map((item) => item.id);
  if (existingIds.length !== slideIds.length
    || [...existingIds].sort().join('\u0000') !== [...slideIds].sort().join('\u0000')) {
    return errorResponse('Danh sách banner đã thay đổi. Vui lòng tải lại trước khi sắp xếp.', 409);
  }

  const now = new Date().toISOString();
  const statements = slideIds.map((id, index) => env.DB.prepare(`
    UPDATE login_media_slides SET sort_order = ?, updated_at = ?, updated_by = ? WHERE id = ?
  `).bind((index + 1) * 10, now, actor, id));
  statements.push(auditStatement(env.DB, {
    actorUsername: actor,
    action: 'LOGIN_MEDIA_SLIDE_REORDERED',
    targetType: 'login_media_slide_order',
    targetId: 'all',
    requestId: requestIdOf(request),
    before: { slideIds: existingIds },
    after: { slideIds, reason },
  }));
  await env.DB.batch(statements);
  return noStore(jsonResponse({ status: 'success', data: { slideIds } }));
}

async function handleSlideDelete(
  request: Request,
  env: Env,
  actor: string,
  id: string,
): Promise<Response> {
  const before = await slideById(env.DB, id);
  if (!before) return errorResponse('Không tìm thấy banner.', 404);
  const body = await jsonBody(request);
  if (body?.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== before.updated_at) {
    return errorResponse('Banner đã được cập nhật ở phiên khác. Vui lòng tải lại.', 409);
  }
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_media_slides WHERE id = ? AND updated_at = ?')
      .bind(id, before.updated_at),
    env.DB.prepare(`
      INSERT INTO admin_audit_logs
        (id, actor_username, action, target_type, target_id, request_id,
         before_json, after_json, created_at)
      SELECT ?, ?, 'LOGIN_MEDIA_SLIDE_DELETED', 'login_media_slide', ?, ?, ?, NULL, ?
      WHERE NOT EXISTS (SELECT 1 FROM login_media_slides WHERE id = ?)
    `).bind(
      `audit-${crypto.randomUUID()}`,
      actor,
      id,
      requestIdOf(request),
      JSON.stringify(mapAdminSlide(before)),
      now,
      id,
    ),
  ]);
  const after = await slideById(env.DB, id);
  if (after) return errorResponse('Banner đã được cập nhật ở phiên khác. Vui lòng tải lại.', 409);
  return noStore(jsonResponse({ status: 'success', data: { id } }));
}

async function handleAdminRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return auth;
  if (!requireAdmin(auth.user)) return errorResponse('Forbidden', 403);
  const actor = auth.user.username;

  if (path === '/api/admin/login-media' && method === 'GET') {
    const [row, slides] = await Promise.all([settingsRow(env.DB), allSlides(env.DB)]);
    return noStore(jsonResponse({
      status: 'success',
      data: {
        settings: mapAdminSettings(row || DEFAULT_SETTINGS_ROW),
        slides: slides.map(mapAdminSlide),
      },
    }));
  }
  if (path === '/api/admin/login-media/settings' && method === 'PATCH') {
    return handleSettingsPatch(request, env, actor);
  }
  if (path === '/api/admin/login-media/slides' && method === 'POST') {
    return handleSlideCreate(request, env, actor);
  }
  if (path === '/api/admin/login-media/slides/reorder' && method === 'PATCH') {
    return handleReorder(request, env, actor);
  }

  const slideMatch = path.match(/^\/api\/admin\/login-media\/slides\/([^/]+)$/);
  if (slideMatch) {
    const id = decodeURIComponent(slideMatch[1]);
    if (method === 'PUT') return handleSlideUpdate(request, env, actor, id);
    if (method === 'DELETE') return handleSlideDelete(request, env, actor, id);
  }
  return errorResponse('Method not allowed', 405);
}

export async function handleLoginMediaRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  if (path === '/api/login-media') {
    if (method === 'GET') return handlePublicRead(env);
    return errorResponse('Method not allowed', 405);
  }
  if (path === '/api/admin/login-media' || path.startsWith('/api/admin/login-media/')) {
    try {
      return await handleAdminRoutes(request, env, path, method);
    } catch (error) {
      console.error('[Login Media] admin route failed:', error instanceof Error ? error.message : 'unknown error');
      return errorResponse('Không thể xử lý yêu cầu banner đăng nhập.', 500);
    }
  }
  return null;
}
