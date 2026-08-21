import {
  UpsertCompetitionRoundQuizRequestSchema,
  UpdateCompetitionRoundRequestSchema,
  type UpsertCompetitionRoundQuizRequest,
  type UpdateCompetitionRoundRequest,
} from '../../../schemas/competition.schema';
import { gradeQuiz } from '../../../src/domain/quiz-scoring';
import { mapLiveExamQuestionRow } from '../services/liveExamQuestionMapper';
import { buildAuthoritativeStoredAnswers } from '../services/quizGradingService';
import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';
import { assertQuizSnapshotIntegrity, createOrReuseQuizSnapshot } from './quizSnapshotService';

interface CompetitionRoundRow {
  id: string;
  campaign_id: string;
  round_number: number;
  opens_at: string;
  closes_at: string;
  max_attempts: number;
  passing_rule_type: 'MIN_SCORE';
  passing_score: number;
  status: 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'FINALIZED';
  created_at: string;
  finalized_at: string | null;
}

interface CompetitionAttemptRow {
  id: string;
  campaign_id: string;
  round_id: string;
  student_id: string;
  attempt_no: number;
  quiz_id: string;
  quiz_snapshot_id: string;
  quiz_snapshot_hash: string;
  result_id: number | null;
  status: 'STARTED' | 'SUBMITTED' | 'SCORED' | 'EXPIRED' | 'VOID';
  score: number | null;
  correct_count: number | null;
  time_taken: number | null;
  started_at: string;
  submitted_at: string | null;
  scored_at: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  idempotency_key: string;
}

interface RoundQuizRow {
  id: string;
  round_id: string;
  grade_level: number;
  class_id: string | null;
  quiz_id: string;
  quiz_snapshot_id: string;
  quiz_snapshot_hash: string;
  locked_at?: string;
  canonical_payload_json: string;
  snapshot_sha256: string;
}

export interface RoundQuizMappingView {
  id: string;
  roundId: string;
  gradeLevel: number;
  classId: string | null;
  quizId: string;
  quizSnapshotId: string;
  quizSnapshotHash: string;
  lockedAt: string;
}

interface FrozenStudentRow {
  student_id: string;
  grade_level_at_snapshot: number;
  class_id_at_snapshot: string;
  full_name: string;
  class_name: string;
}

interface StoredResultRow {
  id: number;
  score: number;
  correct_count: number;
  total_questions: number;
  time_taken: number;
}

export interface RoundAttemptView {
  id: string;
  campaignId: string;
  roundId: string;
  studentId: string;
  attemptNo: number;
  quizId: string;
  quizSnapshotId: string;
  status: CompetitionAttemptRow['status'];
  startedAt: string;
}

export interface RoundProgressView {
  campaignId: string;
  roundId: string;
  studentId: string;
  attemptsUsed: number;
  bestAttemptId: string | null;
  bestScore: number | null;
  isPassed: boolean;
  passedAt: string | null;
  status: string;
  version: number;
  updatedAt: string;
}

export interface RoundAttemptResultView extends RoundAttemptView {
  resultId: number;
  score: number;
  correctCount: number;
  totalQuestions: number;
  timeTaken: number;
  submittedAt: string;
  scoredAt: string;
  progress: RoundProgressView;
}

function normalizedId(value: string, errorCode: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function effectiveRoundStatus(
  row: CompetitionRoundRow,
  now = new Date(),
): CompetitionRoundRow['status'] {
  if (['DRAFT', 'CLOSED', 'FINALIZED'].includes(row.status)) return row.status;
  const opensAt = new Date(row.opens_at);
  const closesAt = new Date(row.closes_at);
  if (!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime())) return row.status;
  if (now < opensAt) return 'SCHEDULED';
  if (now < closesAt) return 'OPEN';
  return 'CLOSED';
}

function mapRound(row: CompetitionRoundRow, now = new Date()) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    roundNumber: Number(row.round_number),
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    maxAttempts: Number(row.max_attempts),
    passingRuleType: row.passing_rule_type,
    passingScore: Number(row.passing_score),
    status: effectiveRoundStatus(row, now),
    createdAt: row.created_at,
    finalizedAt: row.finalized_at,
  };
}

function mapAttempt(row: CompetitionAttemptRow): RoundAttemptView {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    roundId: row.round_id,
    studentId: row.student_id,
    attemptNo: Number(row.attempt_no),
    quizId: row.quiz_id,
    quizSnapshotId: row.quiz_snapshot_id,
    status: row.status,
    startedAt: row.started_at,
  };
}

function mapRoundQuiz(row: RoundQuizRow): RoundQuizMappingView {
  return {
    id: row.id,
    roundId: row.round_id,
    gradeLevel: Number(row.grade_level),
    classId: row.class_id,
    quizId: row.quiz_id,
    quizSnapshotId: row.quiz_snapshot_id,
    quizSnapshotHash: row.quiz_snapshot_hash,
    lockedAt: String(row.locked_at || ''),
  };
}

async function getRoundRow(
  db: D1Database,
  campaignId: string,
  roundId: string,
): Promise<CompetitionRoundRow | null> {
  return db.prepare(`
    SELECT id, campaign_id, round_number, opens_at, closes_at, max_attempts,
           passing_rule_type, passing_score, status, created_at, finalized_at
    FROM competition_rounds
    WHERE id = ? AND campaign_id = ?
    LIMIT 1
  `).bind(roundId, campaignId).first<CompetitionRoundRow>();
}

async function getAttemptRow(db: D1Database, attemptId: string): Promise<CompetitionAttemptRow | null> {
  return db.prepare(`
    SELECT id, campaign_id, round_id, student_id, attempt_no, quiz_id,
           quiz_snapshot_id, quiz_snapshot_hash, result_id, status, score,
           correct_count, time_taken, started_at, submitted_at, scored_at,
           voided_at, voided_by, void_reason, idempotency_key
    FROM competition_round_attempts
    WHERE id = ?
    LIMIT 1
  `).bind(attemptId).first<CompetitionAttemptRow>();
}

async function getFrozenStudent(
  db: D1Database,
  campaignId: string,
  studentId: string,
): Promise<FrozenStudentRow | null> {
  return db.prepare(`
    SELECT member.student_id,
           member.grade_level_at_snapshot,
           member.class_id_at_snapshot,
           student.full_name,
           classroom.name AS class_name
    FROM competition_campaigns AS campaign
    INNER JOIN competition_audience_snapshots AS snapshot
      ON snapshot.id = campaign.audience_snapshot_id
     AND snapshot.status = 'LOCKED'
    INNER JOIN competition_audience_members AS member
      ON member.audience_snapshot_id = snapshot.id
     AND member.student_id = ?
    INNER JOIN students AS student ON student.id = member.student_id
    INNER JOIN classes AS classroom ON classroom.id = member.class_id_at_snapshot
    WHERE campaign.id = ?
    LIMIT 1
  `).bind(studentId, campaignId).first<FrozenStudentRow>();
}

async function resolveRoundQuiz(
  db: D1Database,
  roundId: string,
  gradeLevel: number,
  classId: string,
): Promise<RoundQuizRow> {
  const row = await db.prepare(`
    SELECT mapping.id, mapping.round_id, mapping.grade_level, mapping.class_id,
           mapping.quiz_id, mapping.quiz_snapshot_id, mapping.quiz_snapshot_hash,
           snapshot.canonical_payload_json, snapshot.sha256 AS snapshot_sha256
    FROM competition_round_quizzes AS mapping
    INNER JOIN competition_quiz_snapshots AS snapshot
      ON snapshot.id = mapping.quiz_snapshot_id
    WHERE mapping.round_id = ?
      AND mapping.grade_level = ?
      AND (mapping.class_id = ? OR mapping.class_id IS NULL)
    ORDER BY CASE WHEN mapping.class_id = ? THEN 0 ELSE 1 END, mapping.id ASC
    LIMIT 1
  `).bind(roundId, gradeLevel, classId, classId).first<RoundQuizRow>();
  if (!row) throw new Error('COMPETITION_ROUND_QUIZ_NOT_FOUND');
  if (row.quiz_snapshot_hash !== row.snapshot_sha256) {
    throw new Error('COMPETITION_QUIZ_SNAPSHOT_HASH_MISMATCH');
  }
  await assertQuizSnapshotIntegrity({
    canonicalPayloadJson: row.canonical_payload_json,
    sha256: row.snapshot_sha256,
  });
  return row;
}

function parseSnapshotPayload(row: RoundQuizRow): {
  quiz: Record<string, unknown>;
  questions: Array<Record<string, unknown>>;
} {
  try {
    const parsed = JSON.parse(row.canonical_payload_json) as Record<string, unknown>;
    const quiz = parsed.quiz;
    const questions = parsed.questions;
    if (!quiz || typeof quiz !== 'object' || Array.isArray(quiz) || !Array.isArray(questions)) {
      throw new Error('invalid');
    }
    return {
      quiz: quiz as Record<string, unknown>,
      questions: questions.map((question) => {
        if (!question || typeof question !== 'object' || Array.isArray(question)) {
          throw new Error('invalid');
        }
        return question as Record<string, unknown>;
      }),
    };
  } catch {
    throw new Error('COMPETITION_QUIZ_SNAPSHOT_INVALID');
  }
}

export async function listCompetitionProgress(
  db: D1Database,
  campaignId: string,
  options: { classIds?: string[] } = {},
) {
  const normalizedCampaignId = normalizedId(campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const campaign = await db.prepare('SELECT id FROM competition_campaigns WHERE id = ? LIMIT 1')
    .bind(normalizedCampaignId)
    .first<{ id: string }>();
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');
  if (options.classIds !== undefined && options.classIds.length === 0) return [];
  const classIds = options.classIds?.map(value => String(value || '').trim()).filter(Boolean);
  const classFilter = classIds && classIds.length > 0
    ? ` AND member.class_id_at_snapshot IN (${classIds.map(() => '?').join(', ')})`
    : '';
  const result = await db.prepare(`
    SELECT progress.campaign_id, progress.round_id, progress.student_id,
           progress.attempts_used, progress.best_attempt_id, progress.best_score,
           progress.is_passed, progress.passed_at, progress.status, progress.version,
           progress.updated_at, round.round_number, member.class_id_at_snapshot
    FROM competition_round_progress AS progress
    INNER JOIN competition_rounds AS round
      ON round.id = progress.round_id AND round.campaign_id = progress.campaign_id
    INNER JOIN competition_campaigns AS campaign ON campaign.id = progress.campaign_id
    INNER JOIN competition_audience_members AS member
      ON member.audience_snapshot_id = campaign.audience_snapshot_id
     AND member.student_id = progress.student_id
    WHERE progress.campaign_id = ?${classFilter}
    ORDER BY round.round_number ASC, member.class_id_at_snapshot ASC, progress.student_id ASC
  `).bind(normalizedCampaignId, ...(classIds || [])).all<{
    campaign_id: string;
    round_id: string;
    student_id: string;
    attempts_used: number;
    best_attempt_id: string | null;
    best_score: number | null;
    is_passed: number;
    passed_at: string | null;
    status: string;
    version: number;
    updated_at: string;
    round_number: number;
    class_id_at_snapshot: string;
  }>();
  return (result.results || []).map(row => ({
    campaignId: row.campaign_id,
    roundId: row.round_id,
    roundNumber: Number(row.round_number),
    studentId: row.student_id,
    classId: row.class_id_at_snapshot,
    attemptsUsed: Number(row.attempts_used),
    bestAttemptId: row.best_attempt_id,
    bestScore: row.best_score === null ? null : Number(row.best_score),
    isPassed: Number(row.is_passed) === 1,
    passedAt: row.passed_at,
    status: row.status,
    version: Number(row.version),
    updatedAt: row.updated_at,
  }));
}

export async function listCompetitionRounds(db: D1Database, campaignId: string) {
  const normalizedCampaignId = normalizedId(campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const campaign = await db.prepare('SELECT id FROM competition_campaigns WHERE id = ? LIMIT 1')
    .bind(normalizedCampaignId)
    .first<{ id: string }>();
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');

  const result = await db.prepare(`
    SELECT id, campaign_id, round_number, opens_at, closes_at, max_attempts,
           passing_rule_type, passing_score, status, created_at, finalized_at
    FROM competition_rounds
    WHERE campaign_id = ?
    ORDER BY round_number ASC, id ASC
  `).bind(normalizedCampaignId).all<CompetitionRoundRow>();
  const snapshotResult = await db.prepare(`
    SELECT mapping.id, mapping.round_id, mapping.grade_level, mapping.class_id,
           mapping.quiz_id, mapping.quiz_snapshot_id, mapping.quiz_snapshot_hash,
           mapping.locked_at, snapshot.sha256 AS snapshot_sha256,
           snapshot.canonical_payload_json
    FROM competition_round_quizzes AS mapping
    INNER JOIN competition_rounds AS round ON round.id = mapping.round_id
    LEFT JOIN competition_quiz_snapshots AS snapshot ON snapshot.id = mapping.quiz_snapshot_id
    WHERE round.campaign_id = ?
    ORDER BY mapping.round_id ASC, mapping.grade_level ASC, mapping.class_id ASC, mapping.id ASC
  `).bind(normalizedCampaignId).all<RoundQuizRow>();
  const mappingsByRound = new Map<string, RoundQuizRow[]>();
  for (const mapping of snapshotResult.results || []) {
    const mappings = mappingsByRound.get(mapping.round_id) || [];
    mappings.push(mapping);
    mappingsByRound.set(mapping.round_id, mappings);
  }
  return (result.results || []).map((row) => {
    const mappings = mappingsByRound.get(row.id) || [];
    const mappingCount = mappings.length;
    const invalidCount = mappings.filter(mapping => (
      !mapping.snapshot_sha256 || mapping.quiz_snapshot_hash !== mapping.snapshot_sha256
    )).length;
    return {
      ...mapRound(row),
      quizSnapshot: {
        status: mappingCount === 0 ? 'MISSING' : invalidCount > 0 ? 'INVALID' : 'LOCKED',
        mappingCount,
      },
      quizMappings: mappings.map(mapRoundQuiz),
    };
  });
}

export async function upsertCompetitionRoundQuiz(
  db: D1Database,
  campaignId: string,
  roundId: string,
  input: UpsertCompetitionRoundQuizRequest,
  actorUsername: string,
): Promise<RoundQuizMappingView> {
  const normalizedCampaignId = normalizedId(campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const normalizedRoundId = normalizedId(roundId, 'COMPETITION_ROUND_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const parsed = UpsertCompetitionRoundQuizRequestSchema.parse(input);
  if (parsed.campaignId !== normalizedCampaignId || parsed.roundId !== normalizedRoundId) {
    throw new Error('COMPETITION_ROUND_ROUTE_MISMATCH');
  }

  const round = await getRoundRow(db, normalizedCampaignId, normalizedRoundId);
  if (!round) throw new Error('COMPETITION_ROUND_NOT_FOUND');
  if (round.status === 'FINALIZED') throw new Error('COMPETITION_ROUND_FINALIZED');
  if (round.status !== 'DRAFT' && effectiveRoundStatus(round) !== 'SCHEDULED') {
    throw new Error('COMPETITION_ROUND_CONFIG_LOCKED');
  }
  if (parsed.classId) {
    const classroom = await db.prepare('SELECT id FROM classes WHERE id = ? LIMIT 1')
      .bind(parsed.classId)
      .first<{ id: string }>();
    if (!classroom) throw new Error('COMPETITION_ROUND_CLASS_NOT_FOUND');
  }

  const existing = await db.prepare(`
    SELECT mapping.id, mapping.round_id, mapping.grade_level, mapping.class_id,
           mapping.quiz_id, mapping.quiz_snapshot_id, mapping.quiz_snapshot_hash,
           mapping.locked_at, snapshot.canonical_payload_json,
           snapshot.sha256 AS snapshot_sha256
    FROM competition_round_quizzes AS mapping
    INNER JOIN competition_quiz_snapshots AS snapshot ON snapshot.id = mapping.quiz_snapshot_id
    WHERE mapping.round_id = ? AND mapping.grade_level = ?
      AND ((? IS NULL AND mapping.class_id IS NULL) OR mapping.class_id = ?)
    LIMIT 1
  `).bind(normalizedRoundId, parsed.gradeLevel, parsed.classId || null, parsed.classId || null)
    .first<RoundQuizRow>();
  const snapshot = await createOrReuseQuizSnapshot(db, parsed.quizId);
  const mappingId = existing?.id || generateId('competition-round-quiz');
  const lockedAt = new Date().toISOString();
  const mutation = existing
    ? db.prepare(`
        UPDATE competition_round_quizzes
        SET quiz_id = ?, quiz_snapshot_id = ?, quiz_snapshot_hash = ?, locked_at = ?
        WHERE id = ?
      `).bind(parsed.quizId, snapshot.id, snapshot.sha256, lockedAt, mappingId)
    : db.prepare(`
        INSERT INTO competition_round_quizzes (
          id, round_id, grade_level, class_id, quiz_id, quiz_snapshot_id,
          quiz_snapshot_hash, locked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        mappingId,
        normalizedRoundId,
        parsed.gradeLevel,
        parsed.classId || null,
        parsed.quizId,
        snapshot.id,
        snapshot.sha256,
        lockedAt,
      );

  const after: RoundQuizMappingView = {
    id: mappingId,
    roundId: normalizedRoundId,
    gradeLevel: parsed.gradeLevel,
    classId: parsed.classId || null,
    quizId: parsed.quizId,
    quizSnapshotId: snapshot.id,
    quizSnapshotHash: snapshot.sha256,
    lockedAt,
  };
  await db.batch([
    mutation,
    auditStatement(db, {
      actorUsername: actor,
      action: 'ROUND_CONFIG_CHANGED',
      targetType: 'competition_round_quiz',
      targetId: mappingId,
      requestId: parsed.requestId,
      before: existing ? mapRoundQuiz(existing) : undefined,
      after,
    }),
  ]);
  return after;
}

export async function updateCompetitionRound(
  db: D1Database,
  campaignId: string,
  roundId: string,
  input: UpdateCompetitionRoundRequest,
  actorUsername: string,
) {
  const normalizedCampaignId = normalizedId(campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const normalizedRoundId = normalizedId(roundId, 'COMPETITION_ROUND_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const parsed = UpdateCompetitionRoundRequestSchema.parse(input);
  if (parsed.campaignId !== normalizedCampaignId || parsed.roundId !== normalizedRoundId) {
    throw new Error('COMPETITION_ROUND_ROUTE_MISMATCH');
  }

  const campaign = await db.prepare('SELECT id FROM competition_campaigns WHERE id = ? LIMIT 1')
    .bind(normalizedCampaignId)
    .first<{ id: string }>();
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');

  const before = await getRoundRow(db, normalizedCampaignId, normalizedRoundId);
  if (before?.status === 'FINALIZED') throw new Error('COMPETITION_ROUND_FINALIZED');
  if (before && before.status !== 'DRAFT' && effectiveRoundStatus(before) !== 'SCHEDULED') {
    throw new Error('COMPETITION_ROUND_CONFIG_LOCKED');
  }
  const now = new Date().toISOString();

  const mutation = before
    ? db.prepare(`
        UPDATE competition_rounds
        SET round_number = ?, opens_at = ?, closes_at = ?, max_attempts = ?,
            passing_rule_type = ?, passing_score = ?,
            status = CASE WHEN status = 'DRAFT' THEN 'SCHEDULED' ELSE status END
        WHERE id = ? AND campaign_id = ? AND status <> 'FINALIZED'
      `).bind(
        parsed.roundNumber,
        parsed.opensAt,
        parsed.closesAt,
        parsed.maxAttempts,
        parsed.passingRuleType,
        parsed.passingScore,
        normalizedRoundId,
        normalizedCampaignId,
      )
    : db.prepare(`
        INSERT INTO competition_rounds (
          id, campaign_id, round_number, opens_at, closes_at, max_attempts,
          passing_rule_type, passing_score, status, created_at, finalized_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, NULL)
      `).bind(
        normalizedRoundId,
        normalizedCampaignId,
        parsed.roundNumber,
        parsed.opensAt,
        parsed.closesAt,
        parsed.maxAttempts,
        parsed.passingRuleType,
        parsed.passingScore,
        now,
      );

  await db.batch([
    mutation,
    auditStatement(db, {
      actorUsername: actor,
      action: 'ROUND_CONFIG_CHANGED',
      targetType: 'competition_round',
      targetId: normalizedRoundId,
      requestId: parsed.requestId,
      before: before ? mapRound(before) : undefined,
      after: {
        id: normalizedRoundId,
        campaignId: normalizedCampaignId,
        roundNumber: parsed.roundNumber,
        opensAt: parsed.opensAt,
        closesAt: parsed.closesAt,
        maxAttempts: parsed.maxAttempts,
        passingRuleType: parsed.passingRuleType,
        passingScore: parsed.passingScore,
      },
    }),
  ]);

  const updated = await getRoundRow(db, normalizedCampaignId, normalizedRoundId);
  if (!updated) throw new Error('COMPETITION_ROUND_PERSIST_FAILED');
  return mapRound(updated);
}

export async function startRoundAttempt(
  db: D1Database,
  input: { campaignId: string; roundId: string; studentId: string; requestId: string },
): Promise<RoundAttemptView> {
  const campaignId = normalizedId(input.campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const roundId = normalizedId(input.roundId, 'COMPETITION_ROUND_ID_REQUIRED');
  const studentId = normalizedId(input.studentId, 'COMPETITION_STUDENT_ID_REQUIRED');
  const requestId = normalizedId(input.requestId, 'COMPETITION_REQUEST_ID_REQUIRED');

  const existing = await db.prepare(`
    SELECT id, campaign_id, round_id, student_id, attempt_no, quiz_id,
           quiz_snapshot_id, quiz_snapshot_hash, result_id, status, score,
           correct_count, time_taken, started_at, submitted_at, scored_at,
           voided_at, voided_by, void_reason, idempotency_key
    FROM competition_round_attempts
    WHERE student_id = ? AND idempotency_key = ?
    LIMIT 1
  `).bind(studentId, requestId).first<CompetitionAttemptRow>();
  if (existing) {
    if (existing.campaign_id !== campaignId || existing.round_id !== roundId) {
      throw new Error('COMPETITION_IDEMPOTENCY_CONFLICT');
    }
    return mapAttempt(existing);
  }

  const round = await getRoundRow(db, campaignId, roundId);
  if (!round) throw new Error('COMPETITION_ROUND_NOT_FOUND');
  const now = new Date();
  if (effectiveRoundStatus(round, now) !== 'OPEN') {
    throw new Error('COMPETITION_ROUND_NOT_OPEN');
  }

  const member = await getFrozenStudent(db, campaignId, studentId);
  if (!member) throw new Error('COMPETITION_STUDENT_NOT_IN_AUDIENCE');

  const usage = await db.prepare(`
    SELECT COUNT(*) AS used, COALESCE(MAX(attempt_no), 0) AS max_attempt_no
    FROM competition_round_attempts
    WHERE round_id = ? AND student_id = ? AND status <> 'VOID'
  `).bind(roundId, studentId).first<{ used: number; max_attempt_no: number }>();
  const used = Number(usage?.used || 0);
  if (used >= Number(round.max_attempts)) throw new Error('COMPETITION_MAX_ATTEMPTS_REACHED');

  const anyAttempt = await db.prepare(`
    SELECT COALESCE(MAX(attempt_no), 0) AS max_attempt_no
    FROM competition_round_attempts
    WHERE round_id = ? AND student_id = ?
  `).bind(roundId, studentId).first<{ max_attempt_no: number }>();
  const attemptNo = Number(anyAttempt?.max_attempt_no || 0) + 1;
  const roundQuiz = await resolveRoundQuiz(
    db,
    roundId,
    Number(member.grade_level_at_snapshot),
    member.class_id_at_snapshot,
  );
  const attemptId = generateId('competition-attempt');
  const startedAt = now.toISOString();

  try {
    await db.prepare(`
      INSERT INTO competition_round_attempts (
        id, campaign_id, round_id, student_id, attempt_no, quiz_id,
        quiz_snapshot_id, quiz_snapshot_hash, result_id, status, score,
        correct_count, time_taken, started_at, submitted_at, scored_at,
        voided_at, voided_by, void_reason, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'STARTED', NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, ?)
    `).bind(
      attemptId,
      campaignId,
      roundId,
      studentId,
      attemptNo,
      roundQuiz.quiz_id,
      roundQuiz.quiz_snapshot_id,
      roundQuiz.quiz_snapshot_hash,
      startedAt,
      requestId,
    ).run();
  } catch (error) {
    const raced = await db.prepare(`
      SELECT id, campaign_id, round_id, student_id, attempt_no, quiz_id,
             quiz_snapshot_id, quiz_snapshot_hash, result_id, status, score,
             correct_count, time_taken, started_at, submitted_at, scored_at,
             voided_at, voided_by, void_reason, idempotency_key
      FROM competition_round_attempts
      WHERE student_id = ? AND idempotency_key = ?
      LIMIT 1
    `).bind(studentId, requestId).first<CompetitionAttemptRow>();
    if (raced && raced.campaign_id === campaignId && raced.round_id === roundId) return mapAttempt(raced);
    throw error;
  }

  const created = await getAttemptRow(db, attemptId);
  if (!created) throw new Error('COMPETITION_ATTEMPT_PERSIST_FAILED');
  return mapAttempt(created);
}

async function resultForAttempt(db: D1Database, attempt: CompetitionAttemptRow): Promise<StoredResultRow> {
  if (!attempt.result_id) throw new Error('COMPETITION_ATTEMPT_RESULT_MISSING');
  const row = await db.prepare(`
    SELECT id, score, correct_count, total_questions, time_taken
    FROM results
    WHERE id = ? AND student_id = ?
    LIMIT 1
  `).bind(attempt.result_id, attempt.student_id).first<StoredResultRow>();
  if (!row) throw new Error('COMPETITION_ATTEMPT_RESULT_MISSING');
  return row;
}

async function readRoundProgress(
  db: D1Database,
  campaignId: string,
  roundId: string,
  studentId: string,
): Promise<RoundProgressView | null> {
  const persisted = await db.prepare(`
    SELECT campaign_id, round_id, student_id, attempts_used, best_attempt_id,
           best_score, is_passed, passed_at, status, version, updated_at
    FROM competition_round_progress
    WHERE campaign_id = ? AND round_id = ? AND student_id = ?
    LIMIT 1
  `).bind(campaignId, roundId, studentId).first<{
    campaign_id: string;
    round_id: string;
    student_id: string;
    attempts_used: number;
    best_attempt_id: string | null;
    best_score: number | null;
    is_passed: number;
    passed_at: string | null;
    status: string;
    version: number;
    updated_at: string;
  }>();
  if (!persisted) return null;
  return {
    campaignId: persisted.campaign_id,
    roundId: persisted.round_id,
    studentId: persisted.student_id,
    attemptsUsed: Number(persisted.attempts_used),
    bestAttemptId: persisted.best_attempt_id,
    bestScore: persisted.best_score === null ? null : Number(persisted.best_score),
    isPassed: Number(persisted.is_passed) === 1,
    passedAt: persisted.passed_at,
    status: persisted.status,
    version: Number(persisted.version),
    updatedAt: persisted.updated_at,
  };
}

async function resultView(
  db: D1Database,
  attempt: CompetitionAttemptRow,
  progress?: RoundProgressView,
): Promise<RoundAttemptResultView> {
  if (attempt.status !== 'SCORED' || !attempt.submitted_at || !attempt.scored_at) {
    throw new Error('COMPETITION_ATTEMPT_NOT_SCORED');
  }
  const result = await resultForAttempt(db, attempt);
  const resolvedProgress = progress
    ?? await readRoundProgress(db, attempt.campaign_id, attempt.round_id, attempt.student_id)
    ?? await rebuildRoundProgress(db, {
      campaignId: attempt.campaign_id,
      roundId: attempt.round_id,
      studentId: attempt.student_id,
    });
  return {
    ...mapAttempt(attempt),
    status: 'SCORED',
    resultId: Number(result.id),
    score: Number(result.score),
    correctCount: Number(result.correct_count),
    totalQuestions: Number(result.total_questions),
    timeTaken: Number(result.time_taken),
    submittedAt: attempt.submitted_at,
    scoredAt: attempt.scored_at,
    progress: resolvedProgress,
  };
}

export async function submitRoundAttempt(
  db: D1Database,
  input: {
    attemptId: string;
    studentId: string;
    campaignId?: string;
    roundId?: string;
    answers: Record<string, unknown>;
    timeTaken: number;
    requestId: string;
  },
): Promise<RoundAttemptResultView> {
  const attemptId = normalizedId(input.attemptId, 'COMPETITION_ATTEMPT_ID_REQUIRED');
  const studentId = normalizedId(input.studentId, 'COMPETITION_STUDENT_ID_REQUIRED');
  normalizedId(input.requestId, 'COMPETITION_REQUEST_ID_REQUIRED');
  const timeTaken = Number(input.timeTaken);
  if (!Number.isInteger(timeTaken) || timeTaken < 0) throw new Error('COMPETITION_TIME_TAKEN_INVALID');
  const answers = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers)
    ? input.answers
    : {};

  const attempt = await getAttemptRow(db, attemptId);
  if (!attempt || attempt.student_id !== studentId) throw new Error('COMPETITION_ATTEMPT_NOT_FOUND');
  if (
    (input.campaignId && attempt.campaign_id !== String(input.campaignId).trim())
    || (input.roundId && attempt.round_id !== String(input.roundId).trim())
  ) {
    throw new Error('COMPETITION_ATTEMPT_ROUTE_MISMATCH');
  }
  if (attempt.status === 'SCORED') return resultView(db, attempt);
  if (attempt.status !== 'STARTED') throw new Error('COMPETITION_ATTEMPT_NOT_SUBMITTABLE');

  const round = await getRoundRow(db, attempt.campaign_id, attempt.round_id);
  if (!round) throw new Error('COMPETITION_ROUND_NOT_FOUND');
  if (effectiveRoundStatus(round) !== 'OPEN') {
    await db.prepare(`
      UPDATE competition_round_attempts
      SET status = 'EXPIRED'
      WHERE id = ? AND student_id = ? AND status = 'STARTED'
    `).bind(attemptId, studentId).run();
    await rebuildRoundProgress(db, {
      campaignId: attempt.campaign_id,
      roundId: attempt.round_id,
      studentId,
    });
    throw new Error('COMPETITION_ATTEMPT_EXPIRED');
  }

  const roundQuiz = await db.prepare(`
    SELECT mapping.id, mapping.round_id, mapping.grade_level, mapping.class_id,
           mapping.quiz_id, mapping.quiz_snapshot_id, mapping.quiz_snapshot_hash,
           snapshot.canonical_payload_json, snapshot.sha256 AS snapshot_sha256
    FROM competition_round_quizzes AS mapping
    INNER JOIN competition_quiz_snapshots AS snapshot ON snapshot.id = mapping.quiz_snapshot_id
    WHERE mapping.round_id = ? AND mapping.quiz_snapshot_id = ? AND mapping.quiz_id = ?
    LIMIT 1
  `).bind(attempt.round_id, attempt.quiz_snapshot_id, attempt.quiz_id).first<RoundQuizRow>();
  if (!roundQuiz || roundQuiz.quiz_snapshot_hash !== attempt.quiz_snapshot_hash) {
    throw new Error('COMPETITION_ROUND_QUIZ_NOT_FOUND');
  }
  if (roundQuiz.snapshot_sha256 !== attempt.quiz_snapshot_hash) {
    throw new Error('COMPETITION_QUIZ_SNAPSHOT_HASH_MISMATCH');
  }
  await assertQuizSnapshotIntegrity({
    canonicalPayloadJson: roundQuiz.canonical_payload_json,
    sha256: roundQuiz.snapshot_sha256,
  });

  const payload = parseSnapshotPayload(roundQuiz);
  const questions = payload.questions.map((question) => (
    mapLiveExamQuestionRow(question) as unknown as Record<string, unknown>
  ));
  const grading = gradeQuiz({ questions }, answers);
  const storedAnswers = buildAuthoritativeStoredAnswers(questions, answers, grading.details);
  const frozenStudent = await getFrozenStudent(db, attempt.campaign_id, studentId);
  if (!frozenStudent) throw new Error('COMPETITION_STUDENT_NOT_IN_AUDIENCE');
  const submittedAt = new Date().toISOString();
  const quizTitle = String(payload.quiz.title || '');

  await db.batch([
    db.prepare(`
      UPDATE competition_round_attempts
      SET status = 'SUBMITTED', submitted_at = ?, time_taken = ?
      WHERE id = ? AND student_id = ? AND status = 'STARTED'
    `).bind(submittedAt, timeTaken, attemptId, studentId),
    db.prepare(`
      INSERT INTO results (
        student_id, assignment_id, class_id, student_name, class_name, quiz_id, quiz_title,
        score, correct_count, total_questions, time_taken, submitted_at, answers, grading_version
      )
      SELECT ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM competition_round_attempts
        WHERE id = ? AND student_id = ? AND status = 'SUBMITTED'
      )
    `).bind(
      studentId,
      frozenStudent.class_id_at_snapshot,
      frozenStudent.full_name,
      frozenStudent.class_name,
      attempt.quiz_id,
      quizTitle,
      grading.score,
      grading.correctCount,
      grading.totalQuestions,
      timeTaken,
      submittedAt,
      JSON.stringify(storedAnswers),
      grading.engineVersion,
      attemptId,
      studentId,
    ),
    db.prepare(`
      UPDATE competition_round_attempts
      SET result_id = last_insert_rowid(), status = 'SCORED', score = ?, correct_count = ?,
          time_taken = ?, submitted_at = ?, scored_at = ?
      WHERE id = ? AND student_id = ? AND status = 'SUBMITTED'
    `).bind(
      grading.score,
      grading.correctCount,
      timeTaken,
      submittedAt,
      submittedAt,
      attemptId,
      studentId,
    ),
  ]);

  const scored = await getAttemptRow(db, attemptId);
  if (!scored) throw new Error('COMPETITION_ATTEMPT_NOT_FOUND');
  if (scored.status !== 'SCORED') {
    if (scored.status === 'VOID' || scored.status === 'EXPIRED') {
      throw new Error('COMPETITION_ATTEMPT_NOT_SUBMITTABLE');
    }
    throw new Error('COMPETITION_ATTEMPT_SCORE_PERSIST_FAILED');
  }
  const progress = await rebuildRoundProgress(db, {
    campaignId: scored.campaign_id,
    roundId: scored.round_id,
    studentId: scored.student_id,
  });
  return resultView(db, scored, progress);
}

export async function rebuildRoundProgress(
  db: D1Database,
  input: { campaignId: string; roundId: string; studentId: string },
): Promise<RoundProgressView> {
  const campaignId = normalizedId(input.campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const roundId = normalizedId(input.roundId, 'COMPETITION_ROUND_ID_REQUIRED');
  const studentId = normalizedId(input.studentId, 'COMPETITION_STUDENT_ID_REQUIRED');
  const round = await getRoundRow(db, campaignId, roundId);
  if (!round) throw new Error('COMPETITION_ROUND_NOT_FOUND');

  const usage = await db.prepare(`
    SELECT COUNT(*) AS used
    FROM competition_round_attempts
    WHERE campaign_id = ? AND round_id = ? AND student_id = ? AND status <> 'VOID'
  `).bind(campaignId, roundId, studentId).first<{ used: number }>();
  const best = await db.prepare(`
    SELECT id, score, scored_at
    FROM competition_round_attempts
    WHERE campaign_id = ? AND round_id = ? AND student_id = ?
      AND status = 'SCORED' AND score IS NOT NULL
    ORDER BY score DESC, attempt_no ASC, id ASC
    LIMIT 1
  `).bind(campaignId, roundId, studentId).first<{
    id: string;
    score: number;
    scored_at: string | null;
  }>();

  const attemptsUsed = Number(usage?.used || 0);
  const bestScore = best ? Number(best.score) : null;
  const isPassed = bestScore !== null && bestScore >= Number(round.passing_score);
  const roundStatus = effectiveRoundStatus(round);
  const status = isPassed
    ? 'PASSED'
    : (attemptsUsed >= Number(round.max_attempts) || ['CLOSED', 'FINALIZED'].includes(roundStatus))
      ? 'NOT_PASSED'
      : 'IN_PROGRESS';
  const updatedAt = new Date().toISOString();

  await db.prepare(`
    INSERT INTO competition_round_progress (
      campaign_id, round_id, student_id, attempts_used, best_attempt_id, best_score,
      is_passed, passed_at, status, version, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(campaign_id, round_id, student_id) DO UPDATE SET
      attempts_used = excluded.attempts_used,
      best_attempt_id = excluded.best_attempt_id,
      best_score = excluded.best_score,
      is_passed = excluded.is_passed,
      passed_at = excluded.passed_at,
      status = excluded.status,
      version = competition_round_progress.version + 1,
      updated_at = excluded.updated_at
  `).bind(
    campaignId,
    roundId,
    studentId,
    attemptsUsed,
    best?.id ?? null,
    bestScore,
    isPassed ? 1 : 0,
    isPassed ? best?.scored_at ?? updatedAt : null,
    status,
    updatedAt,
  ).run();

  const persisted = await readRoundProgress(db, campaignId, roundId, studentId);
  if (!persisted) throw new Error('COMPETITION_PROGRESS_PERSIST_FAILED');
  return persisted;
}

export async function voidRoundAttempt(
  db: D1Database,
  input: {
    attemptId: string;
    actorUsername: string;
    actorRole: 'student' | 'teacher' | 'admin';
    reason: string;
    requestId: string;
  },
): Promise<RoundProgressView> {
  if (input.actorRole !== 'admin') throw new Error('COMPETITION_ADMIN_REQUIRED');
  const attemptId = normalizedId(input.attemptId, 'COMPETITION_ATTEMPT_ID_REQUIRED');
  const actor = normalizedId(input.actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const requestId = normalizedId(input.requestId, 'COMPETITION_REQUEST_ID_REQUIRED');
  const reason = String(input.reason || '').trim();
  if (!reason) throw new Error('COMPETITION_VOID_REASON_REQUIRED');

  const attempt = await getAttemptRow(db, attemptId);
  if (!attempt) throw new Error('COMPETITION_ATTEMPT_NOT_FOUND');
  if (attempt.status === 'VOID') {
    return await readRoundProgress(
      db,
      attempt.campaign_id,
      attempt.round_id,
      attempt.student_id,
    ) ?? rebuildRoundProgress(db, {
      campaignId: attempt.campaign_id,
      roundId: attempt.round_id,
      studentId: attempt.student_id,
    });
  }
  if (!['SUBMITTED', 'SCORED'].includes(attempt.status)) {
    throw new Error('COMPETITION_ATTEMPT_NOT_VOIDABLE');
  }
  const voidedAt = new Date().toISOString();

  await db.batch([
    db.prepare(`
      UPDATE competition_round_attempts
      SET status = 'VOID', voided_at = ?, voided_by = ?, void_reason = ?
      WHERE id = ? AND status IN ('SUBMITTED', 'SCORED')
    `).bind(voidedAt, actor, reason, attemptId),
    auditStatement(db, {
      actorUsername: actor,
      action: 'ROUND_ATTEMPT_VOIDED',
      targetType: 'competition_round_attempt',
      targetId: attemptId,
      requestId,
      before: { status: attempt.status, score: attempt.score },
      after: { status: 'VOID', reason },
    }),
  ]);

  return rebuildRoundProgress(db, {
    campaignId: attempt.campaign_id,
    roundId: attempt.round_id,
    studentId: attempt.student_id,
  });
}

export async function finalizeCompetitionRound(
  db: D1Database,
  campaignId: string,
  roundId: string,
  actorUsername: string,
  requestId: string,
) {
  const normalizedCampaignId = normalizedId(campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const normalizedRoundId = normalizedId(roundId, 'COMPETITION_ROUND_ID_REQUIRED');
  const actor = normalizedId(actorUsername, 'COMPETITION_ACTOR_REQUIRED');
  const normalizedRequestId = normalizedId(requestId, 'COMPETITION_REQUEST_ID_REQUIRED');
  const round = await getRoundRow(db, normalizedCampaignId, normalizedRoundId);
  if (!round) throw new Error('COMPETITION_ROUND_NOT_FOUND');
  if (round.status === 'FINALIZED') return mapRound(round);
  if (effectiveRoundStatus(round) !== 'CLOSED') throw new Error('COMPETITION_ROUND_NOT_CLOSED');

  const mappings = await db.prepare(`
    SELECT mapping.id, mapping.round_id, mapping.grade_level, mapping.class_id,
           mapping.quiz_id, mapping.quiz_snapshot_id, mapping.quiz_snapshot_hash,
           snapshot.canonical_payload_json, snapshot.sha256 AS snapshot_sha256
    FROM competition_round_quizzes AS mapping
    INNER JOIN competition_quiz_snapshots AS snapshot ON snapshot.id = mapping.quiz_snapshot_id
    WHERE mapping.round_id = ?
    ORDER BY mapping.grade_level ASC, mapping.class_id ASC, mapping.id ASC
  `).bind(normalizedRoundId).all<RoundQuizRow>();
  if (!mappings.results || mappings.results.length === 0) {
    throw new Error('COMPETITION_ROUND_QUIZ_REQUIRED');
  }
  for (const mapping of mappings.results) {
    if (mapping.quiz_snapshot_hash !== mapping.snapshot_sha256) {
      throw new Error('COMPETITION_QUIZ_SNAPSHOT_HASH_MISMATCH');
    }
    await assertQuizSnapshotIntegrity({
      canonicalPayloadJson: mapping.canonical_payload_json,
      sha256: mapping.snapshot_sha256,
    });
  }

  const finalizedAt = new Date().toISOString();
  await db.batch([
    db.prepare(`
      UPDATE competition_round_attempts
      SET status = 'EXPIRED'
      WHERE campaign_id = ? AND round_id = ? AND status = 'STARTED'
    `).bind(normalizedCampaignId, normalizedRoundId),
    db.prepare(`
      UPDATE competition_rounds
      SET status = 'FINALIZED', finalized_at = ?
      WHERE id = ? AND campaign_id = ? AND status <> 'FINALIZED'
    `).bind(finalizedAt, normalizedRoundId, normalizedCampaignId),
    auditStatement(db, {
      actorUsername: actor,
      action: 'ROUND_FINALIZED',
      targetType: 'competition_round',
      targetId: normalizedRoundId,
      requestId: normalizedRequestId,
      before: mapRound(round),
      after: { ...mapRound(round), status: 'FINALIZED', finalizedAt },
    }),
  ]);

  const finalized = await getRoundRow(db, normalizedCampaignId, normalizedRoundId);
  if (!finalized || finalized.status !== 'FINALIZED') {
    throw new Error('COMPETITION_ROUND_FINALIZE_FAILED');
  }
  return mapRound(finalized);
}
