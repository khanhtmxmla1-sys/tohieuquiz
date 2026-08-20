import { generateId } from '../utils/response';
import type {
  CompetitionQuizSnapshot,
  CompetitionQuizSnapshotPayload,
} from './types';

export type { CompetitionQuizSnapshot } from './types';

interface CompetitionQuizSnapshotRow {
  id: string;
  quiz_id: string;
  canonical_payload_json: string;
  sha256: string;
  created_at: string;
  created_by: string;
}

const SNAPSHOT_QUIZ_FIELDS = [
  'id',
  'title',
  'class_level',
  'category',
  'time_limit',
  'created_at',
  'created_by',
  'tags',
  'source_type',
  'parent_quiz_id',
  'version_number',
  'revision',
  'updated_at',
] as const;

function toSnapshot(row: CompetitionQuizSnapshotRow): CompetitionQuizSnapshot {
  return {
    id: row.id,
    quizId: row.quiz_id,
    canonicalPayloadJson: row.canonical_payload_json,
    sha256: row.sha256,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCanonicalValue(item) ?? null);
  }
  if (typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = normalizeCanonicalValue((value as Record<string, unknown>)[key]);
      if (child !== undefined) normalized[key] = child;
    }
    return normalized;
  }
  return String(value);
}

export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(normalizeCanonicalValue(value));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function snapshotQuizMetadata(quiz: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const field of SNAPSHOT_QUIZ_FIELDS) {
    if (quiz[field] !== undefined) metadata[field] = quiz[field];
  }
  return metadata;
}

export async function createOrReuseQuizSnapshot(
  db: D1Database,
  quizId: string,
): Promise<CompetitionQuizSnapshot> {
  const normalizedQuizId = String(quizId || '').trim();
  if (!normalizedQuizId) throw new Error('COMPETITION_QUIZ_ID_REQUIRED');

  const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?')
    .bind(normalizedQuizId)
    .first<Record<string, unknown>>();
  if (!quiz) throw new Error('COMPETITION_QUIZ_NOT_FOUND');

  const questions = await db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY rowid ASC')
    .bind(normalizedQuizId)
    .all<Record<string, unknown>>();

  const payload: CompetitionQuizSnapshotPayload = {
    quiz: snapshotQuizMetadata(quiz),
    questions: questions.results.map((question) => ({ ...question })),
  };
  const canonicalPayloadJson = canonicalJsonStringify(payload);
  const sha256 = await sha256Hex(canonicalPayloadJson);
  const id = generateId('competition-quiz-snapshot');
  const createdAt = new Date().toISOString();
  const createdBy = String(quiz.created_by || 'system');

  await db.prepare(`
    INSERT OR IGNORE INTO competition_quiz_snapshots (
      id, quiz_id, canonical_payload_json, sha256, created_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    normalizedQuizId,
    canonicalPayloadJson,
    sha256,
    createdAt,
    createdBy,
  ).run();

  const persisted = await db.prepare(`
    SELECT id, quiz_id, canonical_payload_json, sha256, created_at, created_by
    FROM competition_quiz_snapshots
    WHERE quiz_id = ? AND sha256 = ?
  `).bind(normalizedQuizId, sha256).first<CompetitionQuizSnapshotRow>();

  if (!persisted) throw new Error('COMPETITION_QUIZ_SNAPSHOT_PERSIST_FAILED');
  return toSnapshot(persisted);
}

export async function verifyQuizSnapshotIntegrity(
  snapshot: Pick<CompetitionQuizSnapshot, 'canonicalPayloadJson' | 'sha256'>,
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(snapshot.sha256)) return false;
  return (await sha256Hex(snapshot.canonicalPayloadJson)) === snapshot.sha256;
}

export async function assertQuizSnapshotIntegrity(
  snapshot: Pick<CompetitionQuizSnapshot, 'canonicalPayloadJson' | 'sha256'>,
): Promise<void> {
  if (!(await verifyQuizSnapshotIntegrity(snapshot))) {
    throw new Error('COMPETITION_QUIZ_SNAPSHOT_HASH_MISMATCH');
  }
}
