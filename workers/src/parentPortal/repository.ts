import type { ParentStudentProfile } from '../../../shared/parent-portal.contract';
import type {
  CreateParentLinkRecord,
  ParentActivationRecord,
  ParentLinkRecord,
  ParentLinkRepository,
  ParentLinkStatus,
} from './types';

type ParentLinkRow = {
  id: string;
  student_id: string;
  access_code: string;
  pin_hash: string | null;
  status: ParentLinkStatus;
  token_version: number;
  created_by: string;
  created_at: string;
  activated_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
};

const mapLink = (row: ParentLinkRow): ParentLinkRecord => ({
  id: row.id,
  studentId: row.student_id,
  accessCode: row.access_code,
  pinHash: row.pin_hash,
  status: row.status,
  tokenVersion: Number(row.token_version),
  createdBy: row.created_by,
  createdAt: row.created_at,
  activatedAt: row.activated_at,
  revokedAt: row.revoked_at,
  lastAccessedAt: row.last_accessed_at,
});

const linkSelect = `
  SELECT id, student_id, access_code, pin_hash, status, token_version,
         created_by, created_at, activated_at, revoked_at, last_accessed_at
  FROM parent_links
`;

export function createParentLinkRepository(db: D1Database): ParentLinkRepository {
  const findById = async (linkId: string): Promise<ParentLinkRecord | null> => {
    const row = await db.prepare(`${linkSelect} WHERE id = ? LIMIT 1`)
      .bind(linkId).first<ParentLinkRow>();
    return row ? mapLink(row) : null;
  };

  return {
    findById,

    async findActiveByStudentId(studentId) {
      const row = await db.prepare(`${linkSelect}
        WHERE student_id = ? AND status IN ('PENDING', 'ACTIVE') LIMIT 1`)
        .bind(studentId).first<ParentLinkRow>();
      return row ? mapLink(row) : null;
    },

    async findByAccessCode(accessCode) {
      const row = await db.prepare(`${linkSelect} WHERE access_code = ? LIMIT 1`)
        .bind(accessCode).first<ParentLinkRow>();
      return row ? mapLink(row) : null;
    },

    async findActivationByHash(tokenHash) {
      const row = await db.prepare(`
        SELECT t.id AS token_id, t.link_id, t.token_hash, t.expires_at,
               t.consumed_at, t.created_at AS token_created_at,
               l.id, l.student_id, l.access_code, l.pin_hash, l.status,
               l.token_version, l.created_by, l.created_at, l.activated_at,
               l.revoked_at, l.last_accessed_at
        FROM parent_activation_tokens t
        JOIN parent_links l ON l.id = t.link_id
        WHERE t.token_hash = ?
        LIMIT 1
      `).bind(tokenHash).first<ParentLinkRow & {
        token_id: string;
        link_id: string;
        token_hash: string;
        expires_at: string;
        consumed_at: string | null;
        token_created_at: string;
      }>();
      if (!row) return null;
      return {
        id: row.token_id,
        linkId: row.link_id,
        tokenHash: row.token_hash,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
        createdAt: row.token_created_at,
        link: mapLink(row),
      } satisfies ParentActivationRecord;
    },

    async createLink(input: CreateParentLinkRecord) {
      await db.batch([
        db.prepare(`
          INSERT INTO parent_links (
            id, student_id, access_code, status, token_version, created_by, created_at
          ) VALUES (?, ?, ?, 'PENDING', 1, ?, ?)
        `).bind(input.id, input.studentId, input.accessCode, input.createdBy, input.createdAt),
        db.prepare(`
          INSERT INTO parent_activation_tokens (
            id, link_id, token_hash, expires_at, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
          input.activation.id,
          input.id,
          input.activation.tokenHash,
          input.activation.expiresAt,
          input.activation.createdAt,
        ),
      ]);
      const created = await findById(input.id);
      if (!created) throw new Error('Parent link creation failed');
      return created;
    },

    async reissueLink(linkId, activation, now) {
      await db.batch([
        db.prepare(`
          UPDATE parent_activation_tokens
          SET consumed_at = ?
          WHERE link_id = ? AND consumed_at IS NULL
        `).bind(now, linkId),
        db.prepare(`
          UPDATE parent_links
          SET pin_hash = NULL, status = 'PENDING', activated_at = NULL,
              revoked_at = NULL, token_version = token_version + 1
          WHERE id = ?
        `).bind(linkId),
        db.prepare(`
          INSERT INTO parent_activation_tokens (
            id, link_id, token_hash, expires_at, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `).bind(
          activation.id,
          linkId,
          activation.tokenHash,
          activation.expiresAt,
          activation.createdAt,
        ),
      ]);
      const updated = await findById(linkId);
      if (!updated) throw new Error('Parent link reissue failed');
      return updated;
    },

    async activateLink(linkId, pinHash, consumedTokenId, now) {
      await db.batch([
        db.prepare(`
          UPDATE parent_links
          SET pin_hash = ?, status = 'ACTIVE', activated_at = ?, revoked_at = NULL
          WHERE id = ? AND status = 'PENDING'
        `).bind(pinHash, now, linkId),
        db.prepare(`
          UPDATE parent_activation_tokens
          SET consumed_at = ?
          WHERE id = ? AND link_id = ? AND consumed_at IS NULL
        `).bind(now, consumedTokenId, linkId),
      ]);
    },

    async revokeLink(linkId, now) {
      await db.prepare(`
        UPDATE parent_links
        SET status = 'REVOKED', revoked_at = ?, token_version = token_version + 1
        WHERE id = ?
      `).bind(now, linkId).run();
    },

    async touchLastAccessed(linkId, now) {
      await db.prepare('UPDATE parent_links SET last_accessed_at = ? WHERE id = ?')
        .bind(now, linkId).run();
    },

    async loadProfile(studentId): Promise<ParentStudentProfile | null> {
      const row = await db.prepare(`
        SELECT s.id, s.full_name, COALESCE(s.avatar, '') AS avatar, c.name AS class_name
        FROM students s
        JOIN classes c ON c.id = s.class_id
        WHERE s.id = ?
          AND COALESCE(s.archived_at, '') = ''
          AND COALESCE(c.archived_at, '') = ''
        LIMIT 1
      `).bind(studentId).first<{
        id: string;
        full_name: string;
        avatar: string;
        class_name: string;
      }>();
      return row ? {
        id: row.id,
        fullName: row.full_name,
        className: row.class_name,
        avatar: row.avatar,
      } : null;
    },
  };
}
