import type { D1Database } from '@cloudflare/workers-types';
import type { JWTPayload } from '../utils/jwt';

interface TeacherQuizOwnerRow {
  username: string;
  full_name: string;
  full_name_count: number;
}

export interface TeacherQuizOwnerIdentity {
  username: string;
  legacyFullName?: string;
}

export async function canAccessQuiz(
  db: D1Database,
  user: JWTPayload,
  quizId: string,
): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role !== 'teacher') return false;

  const [quiz, identity] = await Promise.all([
    db.prepare('SELECT created_by FROM quizzes WHERE id = ?').bind(quizId).first<{ created_by: string }>(),
    loadTeacherQuizOwnerIdentity(db, user.username),
  ]);
  if (!quiz || !identity) return false;

  return quizOwnerMatchesIdentity(quiz.created_by, identity);
}

const normalizeOwner = (value: string | null | undefined): string =>
  String(value || '').trim().toLocaleLowerCase('vi');

export async function loadTeacherQuizOwnerIdentity(
  db: D1Database,
  username: string,
): Promise<TeacherQuizOwnerIdentity | null> {
  const row = await db.prepare(`
    SELECT t.username, t.full_name,
           (
             SELECT COUNT(*)
             FROM teachers other
             WHERE LOWER(TRIM(other.full_name)) = LOWER(TRIM(t.full_name))
           ) AS full_name_count
    FROM teachers t
    WHERE t.username = ?
    LIMIT 1
  `).bind(username).first<TeacherQuizOwnerRow>();

  if (!row) return null;

  const canonicalUsername = String(row.username).trim();
  const fullName = String(row.full_name || '').trim();
  const hasUniqueLegacyName = Number(row.full_name_count) === 1
    && Boolean(fullName)
    && normalizeOwner(fullName) !== normalizeOwner(canonicalUsername);

  return {
    username: canonicalUsername,
    ...(hasUniqueLegacyName ? { legacyFullName: fullName } : {}),
  };
}

export function quizOwnerMatchesIdentity(
  createdBy: string | null | undefined,
  identity: TeacherQuizOwnerIdentity,
): boolean {
  const owner = normalizeOwner(createdBy);
  if (!owner) return false;
  if (owner === normalizeOwner(identity.username)) return true;
  return Boolean(identity.legacyFullName)
    && owner === normalizeOwner(identity.legacyFullName);
}

export function teacherQuizOwnerQueryValues(
  identity: TeacherQuizOwnerIdentity,
): [string, string | null, string | null] {
  return [
    identity.username,
    identity.legacyFullName || null,
    identity.legacyFullName || null,
  ];
}
