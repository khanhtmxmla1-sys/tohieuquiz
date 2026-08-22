import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';

export const SCHOOL_EXAM_RANKING_SCOPES = ['GRADE', 'CLASS', 'EVENT'] as const;
export type SchoolExamRankingScope = typeof SCHOOL_EXAM_RANKING_SCOPES[number];

interface ReconcileRow {
  id: string;
  version: number;
  status: string;
  summary_json: string;
}

interface CanonicalRow {
  id: string;
  student_id: string;
  original_class_id: string;
  grade_level: number;
  score: number;
  correct_count: number | null;
  time_taken: number | null;
  reconcile_version: number | null;
}

interface RankedRow extends CanonicalRow {
  rankEvent: number;
  rankGrade: number;
  rankClass: number;
}

interface PublicationRow {
  id: string;
  event_id: string;
  version: number;
  ranking_version: number | null;
  status: string;
  result_digest: string;
  published_by: string | null;
  prepared_at: string;
  published_at: string | null;
  request_id: string | null;
  reconcile_version: number | null;
}

interface PublicationResultRow {
  student_id: string;
  original_class_id: string;
  grade_level: number;
  score: number;
  correct_count: number | null;
  time_taken: number | null;
  rank_event: number;
  rank_grade: number;
  rank_class: number;
}

function parseJson<T>(value: string | null, fallback: T): T {
  try {
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function officialCompare(a: CanonicalRow, b: CanonicalRow): number {
  const score = Number(b.score) - Number(a.score);
  if (score !== 0) return score;
  const aCorrect = a.correct_count === null ? Number.NEGATIVE_INFINITY : Number(a.correct_count);
  const bCorrect = b.correct_count === null ? Number.NEGATIVE_INFINITY : Number(b.correct_count);
  if (bCorrect !== aCorrect) return bCorrect - aCorrect;
  const aTime = a.time_taken === null ? Number.POSITIVE_INFINITY : Number(a.time_taken);
  const bTime = b.time_taken === null ? Number.POSITIVE_INFINITY : Number(b.time_taken);
  if (aTime !== bTime) return aTime - bTime;
  return a.student_id.localeCompare(b.student_id);
}

function sameOfficialKeys(a: CanonicalRow, b: CanonicalRow): boolean {
  return Number(a.score) === Number(b.score)
    && a.correct_count === b.correct_count
    && a.time_taken === b.time_taken;
}

function rankGroup(rows: CanonicalRow[]): Map<string, number> {
  const sorted = [...rows].sort(officialCompare);
  const ranks = new Map<string, number>();
  let prior: CanonicalRow | null = null;
  let rank = 0;
  sorted.forEach((row, index) => {
    if (!prior || !sameOfficialKeys(prior, row)) rank = index + 1;
    ranks.set(row.student_id, rank);
    prior = row;
  });
  return ranks;
}

function rankCanonicalRows(rows: CanonicalRow[]): RankedRow[] {
  const eventRanks = rankGroup(rows);
  const gradeGroups = new Map<number, CanonicalRow[]>();
  const classGroups = new Map<string, CanonicalRow[]>();
  for (const row of rows) {
    gradeGroups.set(row.grade_level, [...(gradeGroups.get(row.grade_level) || []), row]);
    classGroups.set(row.original_class_id, [...(classGroups.get(row.original_class_id) || []), row]);
  }
  const gradeRanks = new Map<number, Map<string, number>>();
  const classRanks = new Map<string, Map<string, number>>();
  for (const [gradeLevel, group] of gradeGroups) gradeRanks.set(gradeLevel, rankGroup(group));
  for (const [classId, group] of classGroups) classRanks.set(classId, rankGroup(group));
  return [...rows].sort(officialCompare).map((row) => ({
    ...row,
    rankEvent: eventRanks.get(row.student_id) || 1,
    rankGrade: gradeRanks.get(row.grade_level)?.get(row.student_id) || 1,
    rankClass: classRanks.get(row.original_class_id)?.get(row.student_id) || 1,
  }));
}

function mapPublication(row: PublicationRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    publicationVersion: Number(row.version),
    resultDigest: row.result_digest,
    rankingVersion: Number(row.ranking_version || row.version),
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    reconcileVersion: row.reconcile_version === null ? null : Number(row.reconcile_version),
    status: row.status,
  };
}

async function publicationByRequest(db: D1Database, eventId: string, requestId: string): Promise<PublicationRow | null> {
  return db.prepare(`
    SELECT id, event_id, version, ranking_version, status, result_digest, published_by,
           prepared_at, published_at, request_id, reconcile_version
    FROM competition_school_exam_publications
    WHERE event_id = ? AND request_id = ? LIMIT 1
  `).bind(eventId, requestId).first<PublicationRow>();
}

async function latestPublication(db: D1Database, eventId: string): Promise<PublicationRow | null> {
  return db.prepare(`
    SELECT id, event_id, version, ranking_version, status, result_digest, published_by,
           prepared_at, published_at, request_id, reconcile_version
    FROM competition_school_exam_publications
    WHERE event_id = ? AND status = 'PUBLISHED'
    ORDER BY version DESC LIMIT 1
  `).bind(eventId).first<PublicationRow>();
}

export async function publishSchoolExamResults(
  db: D1Database,
  eventId: string,
  actorUsername: string,
  requestId: string,
) {
  const replay = await publicationByRequest(db, eventId, requestId);
  if (replay) return mapPublication(replay);

  const event = await db.prepare(`
    SELECT id, status FROM competition_school_exam_events WHERE id = ? LIMIT 1
  `).bind(eventId).first<{ id: string; status: string }>();
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  if (!['READY_TO_PUBLISH', 'PUBLISHED'].includes(event.status)) throw new Error('SCHOOL_EXAM_PUBLISH_NOT_READY');

  const reconcile = await db.prepare(`
    SELECT id, version, status, summary_json
    FROM competition_school_exam_reconcile_runs
    WHERE event_id = ? ORDER BY version DESC, started_at DESC, id DESC LIMIT 1
  `).bind(eventId).first<ReconcileRow>();
  const summary = parseJson<Record<string, unknown>>(reconcile?.summary_json || null, {});
  if (
    !reconcile
    || reconcile.status !== 'SUCCEEDED'
    || summary.allRoomsClosed !== true
    || Number(summary.blockingIssues || 0) !== 0
  ) throw new Error('SCHOOL_EXAM_PUBLISH_NOT_READY');

  const openRooms = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM competition_school_exam_rooms AS rooms
    LEFT JOIN live_exam_sessions AS sessions ON sessions.id = rooms.live_exam_session_id
    WHERE rooms.event_id = ?
      AND (rooms.live_exam_session_id IS NULL OR LOWER(COALESCE(sessions.status, '')) <> 'closed')
  `).bind(eventId).first<{ count: number }>();
  if (Number(openRooms?.count || 0) !== 0) throw new Error('SCHOOL_EXAM_PUBLISH_NOT_READY');

  const result = await db.prepare(`
    SELECT results.id, results.student_id, results.original_class_id,
           audience.grade_level_at_snapshot AS grade_level,
           results.score, results.correct_count, results.time_taken, results.reconcile_version
    FROM competition_school_exam_results AS results
    JOIN competition_school_exam_events AS events ON events.id = results.event_id
    JOIN competition_campaigns AS campaigns ON campaigns.id = events.campaign_id
    JOIN competition_audience_members AS audience
      ON audience.audience_snapshot_id = campaigns.audience_snapshot_id
     AND audience.student_id = results.student_id
    WHERE results.event_id = ? AND results.status <> 'VOID' AND results.score IS NOT NULL
    ORDER BY results.student_id ASC
  `).bind(eventId).all<CanonicalRow>();
  const canonicalRows = result.results || [];
  if (canonicalRows.length === 0) throw new Error('SCHOOL_EXAM_PUBLISH_RESULTS_REQUIRED');
  if (canonicalRows.some((row) => Number(row.reconcile_version || 0) <= 0)) {
    throw new Error('SCHOOL_EXAM_PUBLISH_RECONCILE_VERSION_REQUIRED');
  }

  const rankedRows = rankCanonicalRows(canonicalRows);
  const digestPayload = canonicalRows
    .map((row) => ({
      studentId: row.student_id,
      originalClassId: row.original_class_id,
      gradeLevel: Number(row.grade_level),
      score: Number(row.score),
      correctCount: row.correct_count === null ? null : Number(row.correct_count),
      timeTaken: row.time_taken === null ? null : Number(row.time_taken),
      reconcileVersion: Number(row.reconcile_version),
    }));
  const resultDigest = await sha256Hex(JSON.stringify(digestPayload));

  const versionRow = await db.prepare(`
    SELECT COALESCE(MAX(version), 0) + 1 AS publication_version,
           COALESCE(MAX(ranking_version), 0) + 1 AS ranking_version
    FROM competition_school_exam_publications WHERE event_id = ?
  `).bind(eventId).first<{ publication_version: number; ranking_version: number }>();
  const publicationVersion = Number(versionRow?.publication_version || 1);
  const rankingVersion = Number(versionRow?.ranking_version || 1);
  const publicationId = generateId('school-exam-publication');
  const publishedAt = new Date().toISOString();

  const snapshotStatements = rankedRows.map((row) => db.prepare(`
    INSERT INTO competition_school_exam_publication_results (
      id, publication_id, event_id, publication_version, ranking_version,
      canonical_result_id, student_id, original_class_id, grade_level,
      score, correct_count, time_taken, rank_event, rank_grade, rank_class,
      source_reconcile_version, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    generateId('school-exam-publication-result'),
    publicationId,
    eventId,
    publicationVersion,
    rankingVersion,
    row.id,
    row.student_id,
    row.original_class_id,
    Number(row.grade_level),
    Number(row.score),
    row.correct_count === null ? null : Number(row.correct_count),
    row.time_taken === null ? null : Number(row.time_taken),
    row.rankEvent,
    row.rankGrade,
    row.rankClass,
    Number(row.reconcile_version),
    publishedAt,
  ));
  const canonicalPublishStatements = rankedRows.map((row) => db.prepare(`
    UPDATE competition_school_exam_results
    SET status = 'PUBLISHED', rank = ?, published_at = ?
    WHERE id = ? AND event_id = ?
  `).bind(row.rankEvent, publishedAt, row.id, eventId));

  await db.batch([
    db.prepare(`
      INSERT INTO competition_school_exam_publications (
        id, event_id, version, status, result_digest, published_by, prepared_at,
        published_at, ranking_version, request_id, reconcile_version
      ) VALUES (?, ?, ?, 'PUBLISHED', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      publicationId,
      eventId,
      publicationVersion,
      resultDigest,
      actorUsername,
      publishedAt,
      publishedAt,
      rankingVersion,
      requestId,
      Number(reconcile.version),
    ),
    ...snapshotStatements,
    ...canonicalPublishStatements,
    db.prepare(`
      UPDATE live_exam_sessions
      SET result_visibility = 'PUBLISHED', updated_at = ?
      WHERE result_visibility = 'WITHHELD' AND (
        id IN (
          SELECT live_exam_session_id FROM competition_school_exam_rooms
          WHERE event_id = ? AND live_exam_session_id IS NOT NULL
        )
        OR id IN (
          SELECT live_exam_session_id FROM competition_school_exam_retests
          WHERE event_id = ? AND live_exam_session_id IS NOT NULL
        )
      )
    `).bind(publishedAt, eventId, eventId),
    db.prepare(`UPDATE competition_school_exam_events SET status = 'PUBLISHED', updated_at = ? WHERE id = ?`)
      .bind(publishedAt, eventId),
    db.prepare(`UPDATE competition_school_exam_rooms SET status = 'PUBLISHED', updated_at = ? WHERE event_id = ?`)
      .bind(publishedAt, eventId),
    db.prepare(`
      UPDATE competition_school_exam_result_corrections
      SET applied_publication_id = ?, applied_publication_version = ?, applied_at = ?
      WHERE event_id = ? AND applied_publication_id IS NULL
    `).bind(publicationId, publicationVersion, publishedAt, eventId),
    auditStatement(db, {
      actorUsername,
      action: 'SCHOOL_EXAM_RESULTS_PUBLISHED',
      targetType: 'competition_school_exam_event',
      targetId: eventId,
      requestId,
      after: {
        publicationVersion,
        rankingVersion,
        resultDigest,
        reconcileVersion: Number(reconcile.version),
        resultCount: rankedRows.length,
      },
    }),
  ]);

  const persisted = await publicationByRequest(db, eventId, requestId);
  if (!persisted) throw new Error('SCHOOL_EXAM_PUBLICATION_PERSIST_FAILED');
  return mapPublication(persisted);
}

export async function getSchoolExamRankings(
  db: D1Database,
  eventId: string,
  input: { scope: SchoolExamRankingScope; gradeLevel?: number; classId?: string },
) {
  if (!SCHOOL_EXAM_RANKING_SCOPES.includes(input.scope)) throw new Error('SCHOOL_EXAM_RANKING_SCOPE_INVALID');
  if (input.scope === 'GRADE' && (!Number.isInteger(input.gradeLevel) || Number(input.gradeLevel) < 1 || Number(input.gradeLevel) > 12)) {
    throw new Error('SCHOOL_EXAM_RANKING_GRADE_REQUIRED');
  }
  if (input.scope === 'CLASS' && !String(input.classId || '').trim()) throw new Error('SCHOOL_EXAM_RANKING_CLASS_REQUIRED');

  const publication = await latestPublication(db, eventId);
  if (!publication) throw new Error('SCHOOL_EXAM_PUBLICATION_NOT_FOUND');
  const conditions = ['publication_id = ?'];
  const bindings: unknown[] = [publication.id];
  let rankColumn = 'rank_event';
  if (input.scope === 'GRADE') {
    conditions.push('grade_level = ?');
    bindings.push(Number(input.gradeLevel));
    rankColumn = 'rank_grade';
  } else if (input.scope === 'CLASS') {
    conditions.push('original_class_id = ?');
    bindings.push(String(input.classId));
    rankColumn = 'rank_class';
  }
  const rowsResult = await db.prepare(`
    SELECT student_id, original_class_id, grade_level, score, correct_count, time_taken,
           rank_event, rank_grade, rank_class
    FROM competition_school_exam_publication_results
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${rankColumn} ASC,
             score DESC,
             CASE WHEN correct_count IS NULL THEN 1 ELSE 0 END ASC,
             correct_count DESC,
             CASE WHEN time_taken IS NULL THEN 1 ELSE 0 END ASC,
             time_taken ASC,
             student_id ASC
  `).bind(...bindings).all<PublicationResultRow>();
  const rows = rowsResult.results || [];
  return {
    eventId,
    publicationVersion: Number(publication.version),
    rankingVersion: Number(publication.ranking_version || publication.version),
    scope: input.scope,
    ...(input.scope === 'GRADE' ? { gradeLevel: Number(input.gradeLevel) } : {}),
    ...(input.scope === 'CLASS' ? { classId: String(input.classId) } : {}),
    items: rows.map((row) => ({
      studentId: row.student_id,
      originalClassId: row.original_class_id,
      gradeLevel: Number(row.grade_level),
      score: Number(row.score),
      correctCount: row.correct_count === null ? null : Number(row.correct_count),
      timeTaken: row.time_taken === null ? null : Number(row.time_taken),
      rank: Number(input.scope === 'GRADE'
        ? row.rank_grade
        : input.scope === 'CLASS'
          ? row.rank_class
          : row.rank_event),
    })),
  };
}
