import {
  PARENT_NOTIFICATION_KINDS,
  type ParentContactPreferences,
  type ParentContactPreferencesInput,
  type ParentDigestWeekday,
  type ParentNotificationKind,
} from '../../../shared/parent-portal.contract';
import { generateActivationToken, hashActivationToken, hashParentPin, validateParentPin } from './crypto';
import { SYSTEM_TIME_ZONE } from '../../../shared/time-zone.contract';
import type { ParentEmailProvider } from './emailProvider';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_RECOVERY_TTL_MS = 30 * 60 * 1000;
const TIMEZONE = SYSTEM_TIME_ZONE;
const DEFAULT_KINDS = [...PARENT_NOTIFICATION_KINDS];

export class ParentAccountError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ParentAccountError';
  }
}

interface PreferenceRow {
  link_id: string;
  email: string | null;
  email_normalized: string | null;
  email_verified_at: string | null;
  weekly_digest_enabled: number;
  digest_weekday: number;
  digest_hour: number;
  timezone: string;
  quiet_hours_enabled: number;
  quiet_hours_start_minute: number;
  quiet_hours_end_minute: number;
  email_kinds_json: string;
  updated_at: string;
}

interface TokenRow {
  id: string;
  link_id: string;
  email_normalized: string;
  expires_at: string;
  consumed_at: string | null;
}

const normalizeEmail = (value: unknown): string | null => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const email = String(value).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ParentAccountError('PARENT_EMAIL_INVALID', 'Địa chỉ email không hợp lệ.', 400);
  }
  return email;
};

const parseClock = (value: unknown, field: string): number => {
  const text = String(value || '');
  const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new ParentAccountError('PARENT_PREFERENCES_INVALID', `${field} phải có dạng HH:mm.`, 400);
  return Number(match[1]) * 60 + Number(match[2]);
};

const formatClock = (minute: number): string => (
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
);

export const isMinuteInQuietHours = (minute: number, start: number, end: number): boolean => {
  if (start === end) return true;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
};

const parseKinds = (value: unknown): ParentNotificationKind[] => {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = undefined; }
  }
  if (!Array.isArray(raw)) return [...DEFAULT_KINDS];
  const kinds = Array.from(new Set(raw.filter((kind): kind is ParentNotificationKind => (
    typeof kind === 'string' && PARENT_NOTIFICATION_KINDS.includes(kind as ParentNotificationKind)
  ))));
  return kinds;
};

const mapPreferences = (row: PreferenceRow | null, emailRolloutReady: boolean): ParentContactPreferences => ({
  email: row?.email || null,
  emailVerifiedAt: row?.email_verified_at || null,
  weeklyDigestEnabled: Number(row?.weekly_digest_enabled || 0) === 1,
  digestWeekday: (Number(row?.digest_weekday || 1) as ParentDigestWeekday),
  digestHour: Number(row?.digest_hour ?? 19),
  timezone: TIMEZONE,
  quietHoursEnabled: Number(row?.quiet_hours_enabled ?? 1) === 1,
  quietHoursStart: formatClock(Number(row?.quiet_hours_start_minute ?? 1260)),
  quietHoursEnd: formatClock(Number(row?.quiet_hours_end_minute ?? 420)),
  emailKinds: row ? parseKinds(row.email_kinds_json) : [...DEFAULT_KINDS],
  emailRolloutReady,
  updatedAt: row?.updated_at || null,
});

const changes = (result: D1Result): number => Number(result.meta.changes || 0);

const addAudit = async (
  db: D1Database,
  linkId: string | null,
  action: string,
  requestId: string,
  nowIso: string,
  metadata: Record<string, unknown> = {},
): Promise<void> => {
  await db.prepare(`
    INSERT INTO parent_account_audit (id, link_id, action, request_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    `paa-${crypto.randomUUID()}`,
    linkId,
    action,
    requestId,
    JSON.stringify(metadata),
    nowIso,
  ).run();
};

const requireProvider = (provider: ParentEmailProvider): void => {
  if (!provider.ready) {
    throw new ParentAccountError(
      'PARENT_EMAIL_UNAVAILABLE',
      'Dịch vụ email chưa sẵn sàng. Vui lòng thử lại sau.',
      503,
    );
  }
};

const safeBaseUrl = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error();
    return url.origin;
  } catch {
    throw new ParentAccountError('PARENT_EMAIL_UNAVAILABLE', 'Địa chỉ cổng phụ huynh chưa được cấu hình.', 503);
  }
};

export interface ParentAccountService {
  getPreferences(linkId: string): Promise<ParentContactPreferences>;
  updatePreferences(
    linkId: string,
    input: ParentContactPreferencesInput,
    now: Date,
    requestId: string,
  ): Promise<ParentContactPreferences>;
  requestEmailVerification(linkId: string, now: Date, requestId: string): Promise<{ requested: true }>;
  verifyEmail(token: string, now: Date, requestId: string): Promise<{ verified: true }>;
  requestRecovery(
    accessCode: string,
    email: string,
    now: Date,
    requestId: string,
  ): Promise<{ requested: true }>;
  confirmRecovery(token: string, pin: string, now: Date, requestId: string): Promise<{ reset: true }>;
}

export function createParentAccountService(
  db: D1Database,
  provider: ParentEmailProvider,
  publicBaseUrl: string,
): ParentAccountService {
  const getRow = (linkId: string) => db.prepare(`
    SELECT link_id, email, email_normalized, email_verified_at,
           weekly_digest_enabled, digest_weekday, digest_hour, timezone,
           quiet_hours_enabled, quiet_hours_start_minute, quiet_hours_end_minute,
           email_kinds_json, updated_at
    FROM parent_contact_preferences WHERE link_id = ?
  `).bind(linkId).first<PreferenceRow>();

  const createToken = async (
    linkId: string,
    purpose: 'EMAIL_VERIFICATION' | 'ACCOUNT_RECOVERY',
    emailNormalized: string,
    ttlMs: number,
    now: Date,
    requestId: string,
  ): Promise<string> => {
    const token = generateActivationToken();
    const nowIso = now.toISOString();
    await db.batch([
      db.prepare(`
        UPDATE parent_contact_tokens SET consumed_at = ?
        WHERE link_id = ? AND purpose = ? AND consumed_at IS NULL
      `).bind(nowIso, linkId, purpose),
      db.prepare(`
        INSERT INTO parent_contact_tokens (
          id, link_id, purpose, token_hash, email_normalized,
          expires_at, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `pct-${crypto.randomUUID()}`,
        linkId,
        purpose,
        await hashActivationToken(token),
        emailNormalized,
        new Date(now.getTime() + ttlMs).toISOString(),
        requestId,
        nowIso,
      ),
    ]);
    return token;
  };

  const consumeToken = async (
    rawToken: string,
    purpose: 'EMAIL_VERIFICATION' | 'ACCOUNT_RECOVERY',
    now: Date,
  ): Promise<TokenRow> => {
    const token = String(rawToken || '').trim();
    if (!token || token.length > 256) {
      throw new ParentAccountError('PARENT_TOKEN_INVALID', 'Liên kết không hợp lệ hoặc đã hết hạn.', 410);
    }
    const tokenHash = await hashActivationToken(token);
    const row = await db.prepare(`
      SELECT id, link_id, email_normalized, expires_at, consumed_at
      FROM parent_contact_tokens
      WHERE token_hash = ? AND purpose = ? LIMIT 1
    `).bind(tokenHash, purpose).first<TokenRow>();
    const nowIso = now.toISOString();
    if (!row || row.consumed_at || Date.parse(row.expires_at) <= now.getTime()) {
      throw new ParentAccountError('PARENT_TOKEN_INVALID', 'Liên kết không hợp lệ hoặc đã hết hạn.', 410);
    }
    const consumed = await db.prepare(`
      UPDATE parent_contact_tokens SET consumed_at = ?
      WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
    `).bind(nowIso, row.id, nowIso).run();
    if (changes(consumed) !== 1) {
      throw new ParentAccountError('PARENT_TOKEN_REPLAYED', 'Liên kết đã được sử dụng.', 410);
    }
    return row;
  };

  return {
    async getPreferences(linkId) {
      return mapPreferences(await getRow(linkId), provider.ready);
    },

    async updatePreferences(linkId, input, now, requestId) {
      const emailNormalized = normalizeEmail(input.email);
      const digestWeekday = Number(input.digestWeekday);
      const digestHour = Number(input.digestHour);
      if (!Number.isInteger(digestWeekday) || digestWeekday < 1 || digestWeekday > 7
        || !Number.isInteger(digestHour) || digestHour < 0 || digestHour > 23) {
        throw new ParentAccountError('PARENT_PREFERENCES_INVALID', 'Lịch gửi bản tin không hợp lệ.', 400);
      }
      const quietStart = parseClock(input.quietHoursStart, 'Giờ bắt đầu yên lặng');
      const quietEnd = parseClock(input.quietHoursEnd, 'Giờ kết thúc yên lặng');
      if (input.quietHoursEnabled && quietStart === quietEnd) {
        throw new ParentAccountError('PARENT_PREFERENCES_INVALID', 'Khung giờ yên lặng không thể kéo dài cả ngày.', 400);
      }
      if (input.weeklyDigestEnabled && !provider.ready) {
        throw new ParentAccountError('PARENT_EMAIL_UNAVAILABLE', 'Dịch vụ email chưa sẵn sàng.', 503);
      }
      if (input.weeklyDigestEnabled && !emailNormalized) {
        throw new ParentAccountError('PARENT_EMAIL_REQUIRED', 'Cần nhập email trước khi bật bản tin tuần.', 400);
      }
      if (input.weeklyDigestEnabled && input.quietHoursEnabled
        && isMinuteInQuietHours(digestHour * 60, quietStart, quietEnd)) {
        throw new ParentAccountError('PARENT_DIGEST_IN_QUIET_HOURS', 'Giờ gửi bản tin đang nằm trong khung giờ yên lặng.', 400);
      }
      const kinds = parseKinds(input.emailKinds);
      const current = await getRow(linkId);
      const verifiedAt = current?.email_normalized === emailNormalized ? current.email_verified_at : null;
      const nowIso = now.toISOString();
      await db.prepare(`
        INSERT INTO parent_contact_preferences (
          link_id, email, email_normalized, email_verified_at,
          weekly_digest_enabled, digest_weekday, digest_hour, timezone,
          quiet_hours_enabled, quiet_hours_start_minute, quiet_hours_end_minute,
          email_kinds_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(link_id) DO UPDATE SET
          email = excluded.email,
          email_normalized = excluded.email_normalized,
          email_verified_at = excluded.email_verified_at,
          weekly_digest_enabled = excluded.weekly_digest_enabled,
          digest_weekday = excluded.digest_weekday,
          digest_hour = excluded.digest_hour,
          timezone = excluded.timezone,
          quiet_hours_enabled = excluded.quiet_hours_enabled,
          quiet_hours_start_minute = excluded.quiet_hours_start_minute,
          quiet_hours_end_minute = excluded.quiet_hours_end_minute,
          email_kinds_json = excluded.email_kinds_json,
          updated_at = excluded.updated_at
      `).bind(
        linkId,
        emailNormalized,
        emailNormalized,
        verifiedAt,
        input.weeklyDigestEnabled ? 1 : 0,
        digestWeekday,
        digestHour,
        TIMEZONE,
        input.quietHoursEnabled ? 1 : 0,
        quietStart,
        quietEnd,
        JSON.stringify(kinds),
        current?.updated_at || nowIso,
        nowIso,
      ).run();
      await addAudit(db, linkId, 'PREFERENCES_UPDATED', requestId, nowIso, {
        weeklyDigestEnabled: Boolean(input.weeklyDigestEnabled),
        emailChanged: current?.email_normalized !== emailNormalized,
      });
      return mapPreferences(await getRow(linkId), provider.ready);
    },

    async requestEmailVerification(linkId, now, requestId) {
      requireProvider(provider);
      const preferences = await getRow(linkId);
      if (!preferences?.email_normalized) {
        throw new ParentAccountError('PARENT_EMAIL_REQUIRED', 'Cần lưu email trước khi xác minh.', 400);
      }
      const token = await createToken(
        linkId,
        'EMAIL_VERIFICATION',
        preferences.email_normalized,
        EMAIL_VERIFICATION_TTL_MS,
        now,
        requestId,
      );
      const verifyUrl = `${safeBaseUrl(publicBaseUrl)}/verify-email?token=${encodeURIComponent(token)}&portal=parent`;
      await provider.send({
        to: preferences.email_normalized,
        subject: 'Xác minh email Cổng phụ huynh TôHiệuQuiz',
        text: `Mở liên kết sau để xác minh email. Liên kết có hiệu lực trong 24 giờ:\n${verifyUrl}`,
        idempotencyKey: `parent-email-verification:${requestId}`,
      });
      await addAudit(db, linkId, 'EMAIL_VERIFICATION_REQUESTED', requestId, now.toISOString());
      return { requested: true };
    },

    async verifyEmail(token, now, requestId) {
      const record = await consumeToken(token, 'EMAIL_VERIFICATION', now);
      const result = await db.prepare(`
        UPDATE parent_contact_preferences
        SET email_verified_at = ?, updated_at = ?
        WHERE link_id = ? AND email_normalized = ?
      `).bind(now.toISOString(), now.toISOString(), record.link_id, record.email_normalized).run();
      if (changes(result) !== 1) {
        throw new ParentAccountError('PARENT_EMAIL_CHANGED', 'Email đã thay đổi. Vui lòng yêu cầu liên kết mới.', 409);
      }
      await addAudit(db, record.link_id, 'EMAIL_VERIFIED', requestId, now.toISOString());
      return { verified: true };
    },

    async requestRecovery(accessCode, email, now, requestId) {
      requireProvider(provider);
      let emailNormalized: string | null = null;
      try { emailNormalized = normalizeEmail(email); } catch { /* Generic response prevents enumeration. */ }
      const normalizedCode = String(accessCode || '').replace(/\s+/g, '').toUpperCase().slice(0, 32);
      if (!emailNormalized || !normalizedCode) return { requested: true };
      const match = await db.prepare(`
        SELECT l.id AS link_id, p.email_normalized
        FROM parent_links l
        JOIN parent_contact_preferences p ON p.link_id = l.id
        WHERE l.access_code = ? AND l.status = 'ACTIVE'
          AND p.email_normalized = ? AND p.email_verified_at IS NOT NULL
        LIMIT 1
      `).bind(normalizedCode, emailNormalized).first<{ link_id: string; email_normalized: string }>();
      if (!match) return { requested: true };
      const token = await createToken(
        match.link_id,
        'ACCOUNT_RECOVERY',
        match.email_normalized,
        ACCOUNT_RECOVERY_TTL_MS,
        now,
        requestId,
      );
      const resetUrl = `${safeBaseUrl(publicBaseUrl)}/recover/confirm?token=${encodeURIComponent(token)}&portal=parent`;
      await provider.send({
        to: match.email_normalized,
        subject: 'Đặt lại PIN Cổng phụ huynh TôHiệuQuiz',
        text: `Mở liên kết sau để đặt lại PIN. Liên kết chỉ dùng một lần và có hiệu lực trong 30 phút:\n${resetUrl}`,
        idempotencyKey: `parent-account-recovery:${requestId}`,
      });
      await addAudit(db, match.link_id, 'RECOVERY_REQUESTED', requestId, now.toISOString());
      return { requested: true };
    },

    async confirmRecovery(token, pin, now, requestId) {
      if (!validateParentPin(pin)) {
        throw new ParentAccountError('PARENT_PIN_INVALID', 'PIN phải gồm đúng 6 chữ số.', 400);
      }
      const record = await consumeToken(token, 'ACCOUNT_RECOVERY', now);
      const result = await db.prepare(`
        UPDATE parent_links
        SET pin_hash = ?, token_version = token_version + 1
        WHERE id = ? AND status = 'ACTIVE'
      `).bind(await hashParentPin(pin), record.link_id).run();
      if (changes(result) !== 1) {
        throw new ParentAccountError('PARENT_RECOVERY_UNAVAILABLE', 'Không thể đặt lại PIN cho quyền truy cập này.', 409);
      }
      await addAudit(db, record.link_id, 'PIN_RESET', requestId, now.toISOString());
      return { reset: true };
    },
  };
}
