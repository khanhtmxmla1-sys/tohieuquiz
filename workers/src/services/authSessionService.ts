import type { JWTPayload } from '../utils/jwt';

export type SecurityEventType =
  | 'LOGIN_FAILURE_THRESHOLD'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'SESSION_REVOKED'
  | 'SESSIONS_REVOKED_ALL'
  | 'PASSKEY_ADDED'
  | 'PASSKEY_REMOVED';

export interface AuthSessionRecord {
  id: string;
  username: string;
  role: 'student' | 'teacher' | 'admin';
  token_version: number;
  purpose: 'session' | 'password_change';
  user_agent_family: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  revoked_by: string | null;
}

interface CreateSessionOptions {
  purpose?: 'session' | 'password_change';
  ttlSeconds?: number;
  now?: Date;
}

interface SecurityEventInput {
  username: string;
  role: 'student' | 'teacher' | 'admin';
  eventType: SecurityEventType;
  severity?: 'informational' | 'action_required' | 'critical';
  actorUsername?: string | null;
  sessionId?: string | null;
  requestId: string;
  metadata?: Record<string, unknown>;
  now?: Date;
}

const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_CHANGE_TTL_SECONDS = 15 * 60;
const RETENTION_DAYS = 90;

const safeText = (value: unknown, max = 128): string => (
  String(value ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, max)
);

const createId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

export const classifyUserAgentFamily = (value: string | null): string => {
  const ua = String(value || '');
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  if (/Android|iPhone|iPad|Mobile/i.test(ua)) return 'Mobile';
  return 'Other';
};

export async function createAuthSession(
  db: D1Database,
  request: Request,
  user: Pick<JWTPayload, 'username' | 'role' | 'tokenVersion'>,
  options: CreateSessionOptions = {},
): Promise<AuthSessionRecord> {
  const now = options.now ?? new Date();
  const purpose = options.purpose ?? 'session';
  const ttlSeconds = Number.isFinite(options.ttlSeconds)
    ? Math.max(60, Math.floor(options.ttlSeconds!))
    : purpose === 'password_change'
      ? PASSWORD_CHANGE_TTL_SECONDS
      : DEFAULT_SESSION_TTL_SECONDS;
  const record: AuthSessionRecord = {
    id: createId('session'),
    username: safeText(user.username, 128),
    role: user.role,
    token_version: Number(user.tokenVersion ?? 0),
    purpose,
    user_agent_family: classifyUserAgentFamily(request.headers.get('user-agent')),
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    revoked_at: null,
    revoked_reason: null,
    revoked_by: null,
  };
  await db.prepare(`
    INSERT INTO auth_sessions (
      id, username, role, token_version, purpose, user_agent_family,
      created_at, last_seen_at, expires_at, revoked_at, revoked_reason, revoked_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
  `).bind(
    record.id,
    record.username,
    record.role,
    record.token_version,
    record.purpose,
    record.user_agent_family,
    record.created_at,
    record.last_seen_at,
    record.expires_at,
  ).run();
  return record;
}

export async function assertActiveAuthSession(
  db: D1Database,
  payload: Pick<JWTPayload, 'username' | 'role' | 'tokenVersion' | 'sessionId'>,
  now = new Date(),
): Promise<boolean> {
  if (!payload.sessionId) return false;
  const row = await db.prepare(`
    SELECT id
    FROM auth_sessions
    WHERE id = ?
      AND username = ?
      AND role = ?
      AND token_version = ?
      AND revoked_at IS NULL
      AND expires_at > ?
    LIMIT 1
  `).bind(
    payload.sessionId,
    payload.username,
    payload.role,
    Number(payload.tokenVersion ?? 0),
    now.toISOString(),
  ).first<{ id: string }>();
  if (!row) return false;
  await db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?')
    .bind(now.toISOString(), payload.sessionId).run();
  return true;
}

export async function listAuthSessions(
  db: D1Database,
  user: Pick<JWTPayload, 'username' | 'role' | 'sessionId'>,
  now = new Date(),
): Promise<Array<{
  id: string;
  current: boolean;
  userAgentFamily: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}>> {
  const rows = await db.prepare(`
    SELECT id, user_agent_family, created_at, last_seen_at, expires_at
    FROM auth_sessions
    WHERE username = ? AND role = ? AND revoked_at IS NULL AND expires_at > ?
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(user.username, user.role, now.toISOString()).all<{
    id: string;
    user_agent_family: string;
    created_at: string;
    last_seen_at: string;
    expires_at: string;
  }>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    current: row.id === user.sessionId,
    userAgentFamily: row.user_agent_family,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
  }));
}

export async function recordSecurityEvent(
  db: D1Database,
  input: SecurityEventInput,
): Promise<void> {
  const now = input.now ?? new Date();
  const metadata = JSON.stringify(input.metadata || {});
  await db.prepare(`
    INSERT INTO security_events (
      id, username, role, event_type, severity, actor_username,
      session_id, request_id, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    createId('security-event'),
    safeText(input.username, 128),
    input.role,
    input.eventType,
    input.severity ?? 'informational',
    input.actorUsername ? safeText(input.actorUsername, 128) : null,
    input.sessionId ? safeText(input.sessionId, 128) : null,
    safeText(input.requestId, 128) || createId('request'),
    metadata,
    now.toISOString(),
  ).run();
}

export async function revokeAuthSession(
  db: D1Database,
  user: Pick<JWTPayload, 'username' | 'role'>,
  sessionId: string,
  options: { actorUsername?: string; reason?: string; requestId: string; now?: Date },
): Promise<boolean> {
  const now = options.now ?? new Date();
  const result = await db.prepare(`
    UPDATE auth_sessions
    SET revoked_at = ?, revoked_reason = ?, revoked_by = ?
    WHERE id = ? AND username = ? AND role = ? AND revoked_at IS NULL
  `).bind(
    now.toISOString(),
    safeText(options.reason || 'user_revoked', 128),
    safeText(options.actorUsername || user.username, 128),
    sessionId,
    user.username,
    user.role,
  ).run();
  const changed = Number((result as any).meta?.changes ?? (result as any).changes ?? 0) > 0;
  if (changed) {
    await recordSecurityEvent(db, {
      username: user.username,
      role: user.role,
      eventType: 'SESSION_REVOKED',
      actorUsername: options.actorUsername || user.username,
      sessionId,
      requestId: options.requestId,
      metadata: { reason: safeText(options.reason || 'user_revoked', 128) },
      now,
    });
  }
  return changed;
}

export async function revokeAllAuthSessions(
  db: D1Database,
  user: Pick<JWTPayload, 'username' | 'role'>,
  options: {
    actorUsername?: string;
    reason?: string;
    requestId: string;
    cutoff?: Date;
    exceptSessionId?: string | null;
    now?: Date;
  },
): Promise<number> {
  const now = options.now ?? new Date();
  const cutoff = options.cutoff ?? now;
  const bindings: unknown[] = [
    now.toISOString(),
    safeText(options.reason || 'logout_all', 128),
    safeText(options.actorUsername || user.username, 128),
    user.username,
    user.role,
    cutoff.toISOString(),
  ];
  let exceptSql = '';
  if (options.exceptSessionId) {
    exceptSql = ' AND id <> ?';
    bindings.push(options.exceptSessionId);
  }
  const result = await db.prepare(`
    UPDATE auth_sessions
    SET revoked_at = ?, revoked_reason = ?, revoked_by = ?
    WHERE username = ? AND role = ? AND revoked_at IS NULL AND created_at <= ?${exceptSql}
  `).bind(...bindings).run();
  const changes = Number((result as any).meta?.changes ?? (result as any).changes ?? 0);
  await recordSecurityEvent(db, {
    username: user.username,
    role: user.role,
    eventType: 'SESSIONS_REVOKED_ALL',
    actorUsername: options.actorUsername || user.username,
    sessionId: options.exceptSessionId || null,
    requestId: options.requestId,
    metadata: { revokedCount: changes, cutoff: cutoff.toISOString() },
    now,
  });
  return changes;
}

export async function listSecurityEvents(
  db: D1Database,
  user: Pick<JWTPayload, 'username' | 'role'>,
): Promise<Array<{
  id: string;
  eventType: SecurityEventType;
  severity: string;
  actorUsername: string | null;
  sessionId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}>> {
  const rows = await db.prepare(`
    SELECT id, event_type, severity, actor_username, session_id, metadata_json, created_at
    FROM security_events
    WHERE username = ? AND role = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(user.username, user.role).all<any>();
  return (rows.results || []).map((row) => {
    let metadata: Record<string, unknown> = {};
    try { metadata = JSON.parse(String(row.metadata_json || '{}')); } catch { metadata = {}; }
    return {
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      actorUsername: row.actor_username,
      sessionId: row.session_id,
      createdAt: row.created_at,
      metadata,
    };
  });
}

export async function purgeExpiredAuthSecurityData(
  db: D1Database,
  now = new Date(),
): Promise<{ sessions: number; events: number }> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [sessions, events] = await db.batch([
    db.prepare('DELETE FROM auth_sessions WHERE created_at < ?').bind(cutoff),
    db.prepare('DELETE FROM security_events WHERE created_at < ?').bind(cutoff),
  ]);
  return {
    sessions: Number((sessions as any).meta?.changes ?? 0),
    events: Number((events as any).meta?.changes ?? 0),
  };
}
