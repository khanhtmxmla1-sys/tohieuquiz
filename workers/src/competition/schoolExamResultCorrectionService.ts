import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';

interface CorrectionInput {
  studentId: string;
  score: number;
  correctCount: number | null;
  timeTaken: number | null;
  reason: string;
  requestId: string;
}

interface CorrectionRow {
  id: string;
  event_id: string;
  canonical_result_id: string;
  student_id: string;
  source_publication_id: string;
  source_publication_version: number;
  before_score: number;
  before_correct_count: number | null;
  before_time_taken: number | null;
  corrected_score: number;
  corrected_correct_count: number | null;
  corrected_time_taken: number | null;
  reason: string;
  request_id: string;
  created_by: string;
  created_at: string;
  before_hash: string;
  after_hash: string;
  applied_publication_id: string | null;
  applied_publication_version: number | null;
  applied_at: string | null;
}

function mapCorrection(row: CorrectionRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    canonicalResultId: row.canonical_result_id,
    studentId: row.student_id,
    sourcePublicationId: row.source_publication_id,
    sourcePublicationVersion: Number(row.source_publication_version),
    before: {
      score: Number(row.before_score),
      correctCount: row.before_correct_count === null ? null : Number(row.before_correct_count),
      timeTaken: row.before_time_taken === null ? null : Number(row.before_time_taken),
    },
    after: {
      score: Number(row.corrected_score),
      correctCount: row.corrected_correct_count === null ? null : Number(row.corrected_correct_count),
      timeTaken: row.corrected_time_taken === null ? null : Number(row.corrected_time_taken),
    },
    reason: row.reason,
    requestId: row.request_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    beforeHash: row.before_hash,
    afterHash: row.after_hash,
    appliedPublicationId: row.applied_publication_id,
    appliedPublicationVersion: row.applied_publication_version === null ? null : Number(row.applied_publication_version),
    appliedAt: row.applied_at,
    status: row.applied_publication_id ? 'APPLIED' as const : 'PENDING' as const,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const selectCorrection = `
  SELECT id, event_id, canonical_result_id, student_id, source_publication_id,
         source_publication_version, before_score, before_correct_count, before_time_taken,
         corrected_score, corrected_correct_count, corrected_time_taken, reason, request_id,
         created_by, created_at, before_hash, after_hash, applied_publication_id,
         applied_publication_version, applied_at
  FROM competition_school_exam_result_corrections
`;

export async function createSchoolExamResultCorrection(
  db: D1Database,
  eventId: string,
  input: CorrectionInput,
  actorUsername: string,
) {
  const replay = await db.prepare(`${selectCorrection} WHERE event_id = ? AND request_id = ? LIMIT 1`)
    .bind(eventId, input.requestId)
    .first<CorrectionRow>();
  if (replay) {
    const samePayload = replay.student_id === input.studentId
      && Number(replay.corrected_score) === Number(input.score)
      && replay.corrected_correct_count === input.correctCount
      && replay.corrected_time_taken === input.timeTaken
      && replay.reason === input.reason;
    if (!samePayload) throw new Error('SCHOOL_EXAM_CORRECTION_IDEMPOTENCY_CONFLICT');
    return { correction: mapCorrection(replay), created: false };
  }

  const event = await db.prepare('SELECT id, status FROM competition_school_exam_events WHERE id = ? LIMIT 1')
    .bind(eventId)
    .first<{ id: string; status: string }>();
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  if (event.status !== 'PUBLISHED') throw new Error('SCHOOL_EXAM_CORRECTION_NOT_PUBLISHED');

  const source = await db.prepare(`
    SELECT publications.id AS publication_id, publications.version AS publication_version,
           snapshots.canonical_result_id, snapshots.score, snapshots.correct_count, snapshots.time_taken
    FROM competition_school_exam_publications AS publications
    JOIN competition_school_exam_publication_results AS snapshots
      ON snapshots.publication_id = publications.id AND snapshots.student_id = ?
    WHERE publications.event_id = ? AND publications.status = 'PUBLISHED'
    ORDER BY publications.version DESC LIMIT 1
  `).bind(input.studentId, eventId).first<{
    publication_id: string;
    publication_version: number;
    canonical_result_id: string;
    score: number;
    correct_count: number | null;
    time_taken: number | null;
  }>();
  if (!source) throw new Error('SCHOOL_EXAM_CORRECTION_RESULT_NOT_FOUND');

  const canonical = await db.prepare(`
    SELECT id, score, correct_count, time_taken
    FROM competition_school_exam_results WHERE id = ? AND event_id = ? LIMIT 1
  `).bind(source.canonical_result_id, eventId).first<{
    id: string;
    score: number;
    correct_count: number | null;
    time_taken: number | null;
  }>();
  if (!canonical) throw new Error('SCHOOL_EXAM_CORRECTION_RESULT_NOT_FOUND');
  const pending = await db.prepare(`
    SELECT id FROM competition_school_exam_result_corrections
    WHERE event_id = ? AND student_id = ? AND applied_publication_id IS NULL LIMIT 1
  `).bind(eventId, input.studentId).first<{ id: string }>();
  if (pending) throw new Error('SCHOOL_EXAM_CORRECTION_PENDING_EXISTS');

  const before = {
    score: Number(canonical.score),
    correctCount: canonical.correct_count === null ? null : Number(canonical.correct_count),
    timeTaken: canonical.time_taken === null ? null : Number(canonical.time_taken),
  };
  const after = { score: Number(input.score), correctCount: input.correctCount, timeTaken: input.timeTaken };
  if (before.score === after.score && before.correctCount === after.correctCount && before.timeTaken === after.timeTaken) {
    throw new Error('SCHOOL_EXAM_CORRECTION_NO_CHANGE');
  }

  const id = generateId('school-exam-result-correction');
  const createdAt = new Date().toISOString();
  const beforeHash = await sha256Hex(JSON.stringify({ eventId, studentId: input.studentId, ...before }));
  const afterHash = await sha256Hex(JSON.stringify({ eventId, studentId: input.studentId, ...after, reason: input.reason }));
  await db.batch([
    db.prepare(`
      INSERT INTO competition_school_exam_result_corrections (
        id, event_id, canonical_result_id, student_id, source_publication_id,
        source_publication_version, before_score, before_correct_count, before_time_taken,
        corrected_score, corrected_correct_count, corrected_time_taken, reason, request_id,
        created_by, created_at, before_hash, after_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, eventId, canonical.id, input.studentId, source.publication_id, Number(source.publication_version),
      before.score, before.correctCount, before.timeTaken, after.score, after.correctCount, after.timeTaken,
      input.reason, input.requestId, actorUsername, createdAt, beforeHash, afterHash,
    ),
    db.prepare(`
      UPDATE competition_school_exam_results
      SET score = ?, correct_count = ?, time_taken = ?, status = 'RECONCILED', rank = NULL, published_at = NULL
      WHERE id = ? AND event_id = ?
    `).bind(after.score, after.correctCount, after.timeTaken, canonical.id, eventId),
    auditStatement(db, {
      actorUsername,
      action: 'SCHOOL_EXAM_RESULT_CORRECTED',
      targetType: 'competition_school_exam_result',
      targetId: canonical.id,
      requestId: input.requestId,
      before,
      after: { ...after, reason: input.reason, sourcePublicationVersion: Number(source.publication_version) },
    }),
    auditStatement(db, {
      actorUsername,
      action: 'RESULT_CORRECTED',
      targetType: 'competition_school_exam_result',
      targetId: canonical.id,
      requestId: input.requestId,
      after: {
        sourcePublicationVersion: Number(source.publication_version),
        correctedScore: after.score,
        correctedCorrectCount: after.correctCount,
        correctedTimeTaken: after.timeTaken,
      },
    }),
  ]);

  const persisted = await db.prepare(`${selectCorrection} WHERE id = ? LIMIT 1`).bind(id).first<CorrectionRow>();
  if (!persisted) throw new Error('SCHOOL_EXAM_CORRECTION_PERSIST_FAILED');
  return { correction: mapCorrection(persisted), created: true };
}

export async function listSchoolExamResultCorrections(db: D1Database, eventId: string) {
  const event = await db.prepare('SELECT id FROM competition_school_exam_events WHERE id = ? LIMIT 1')
    .bind(eventId).first<{ id: string }>();
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  const result = await db.prepare(`${selectCorrection} WHERE event_id = ? ORDER BY created_at DESC, id DESC`)
    .bind(eventId).all<CorrectionRow>();
  return (result.results || []).map(mapCorrection);
}
