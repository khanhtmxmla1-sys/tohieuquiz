import {
  formatSystemDateTime,
  getSystemWeekKey,
  getSystemWeekUtcRange,
} from '../utils/systemTime';
import type { JWTPayload } from '../utils/jwt';
import type { Question } from '../types';
import {
  INTERVENTION_MAX_NOTE_LENGTH,
  INTERVENTION_MIN_CONFIDENCE,
  INTERVENTION_MIN_SAMPLE_SIZE,
  buildInterventionSuggestionKey,
  isInterventionSignalEligible,
  type CreateInterventionAssignmentsRequest,
  type CreateInterventionAssignmentsResponse,
  type InterventionDashboard,
  type InterventionGroup,
  type InterventionPrivateNote,
  type InterventionQuizRecommendation,
  type InterventionStudentSignal,
  type InterventionSuggestion,
  type InterventionTrendPoint,
} from '../../../shared/intervention.contract';
import {
  resolveExplicitSkillMetadata,
  resolveSkillMetadataFromTags,
} from '../../../src/shared/skillTaxonomy';
import {
  buildWeaknessProfileFromData,
  getQuestionsForQuizIds,
  type ResultRowWithAnswers,
} from './weaknessProfile';
import { createNotifications } from './notificationWriter';

interface InterventionStudentRow {
  id: string;
  full_name: string;
  class_id: string;
  class_name: string;
}

interface InterventionResultRow extends ResultRowWithAnswers {
  student_id?: string | null;
}

interface RecommendationQuestionRow {
  quiz_id: string;
  title: string;
  subject?: string | null;
  skill_code?: string | null;
  subskill_code?: string | null;
  tags?: string | null;
}

interface BuildSuggestionInput {
  students: InterventionStudentRow[];
  results: InterventionResultRow[];
  questions: Question[];
  recommendationRows: RecommendationQuestionRow[];
  now?: Date;
}

interface InterventionScopeFilters {
  className?: string;
  quizId?: string;
}

interface InterventionGroupRow {
  id: string;
  teacher_username: string;
  name: string;
  status: string;
  class_id: string;
  class_name: string;
  subject: string;
  subject_label: string;
  skill_code: string;
  skill_label: string;
  sample_size: number;
  confidence: number;
  source_filter_json: string;
  created_at: string;
  updated_at: string;
}

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const normalizeText = (value: unknown): string => String(value || '').trim().toLowerCase();
const INTERVENTION_SKILL_LABEL_OVERRIDES: Record<string, string> = {
  phan_so: 'Phân số',
};
const getInterventionSkillLabel = (skillCode: string, fallback: string): string => (
  INTERVENTION_SKILL_LABEL_OVERRIDES[skillCode] || fallback
);
const safeJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const buildFourWeekTrend = (
  results: InterventionResultRow[],
  now: Date,
): InterventionTrendPoint[] => [3, 2, 1, 0].map((weeksAgo) => {
  const targetInstant = new Date(now.getTime() - weeksAgo * 7 * 86_400_000);
  const range = getSystemWeekUtcRange(getSystemWeekKey(targetInstant));
  const startMs = Date.parse(range.startIso);
  const endMs = Date.parse(range.endIsoExclusive);
  const scores = results
    .filter((result) => {
      const submittedAt = Date.parse(String(result.submitted_at || ''));
      return Number.isFinite(submittedAt)
        && submittedAt >= startMs
        && submittedAt < endMs;
    })
    .map((result) => Number(result.score))
    .filter(Number.isFinite);
  return {
    weekStart: range.startDateKey,
    averageScore: scores.length
      ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length, 1)
      : null,
    attemptCount: scores.length,
  };
});

const resolveStudentForResult = (
  result: InterventionResultRow,
  studentsById: Map<string, InterventionStudentRow>,
): InterventionStudentRow | null => {
  if (!result.student_id || !result.class_id) return null;
  const direct = studentsById.get(String(result.student_id));
  return direct && String(direct.class_id) === String(result.class_id) ? direct : null;
};

const buildRecommendations = (
  rows: RecommendationQuestionRow[],
  subject: string,
  skillCode: string,
): InterventionQuizRecommendation[] => {
  const grouped = new Map<string, {
    quizId: string;
    title: string;
    questionCount: number;
    matchedQuestionCount: number;
  }>();

  for (const row of rows) {
    const bucket = grouped.get(row.quiz_id) || {
      quizId: row.quiz_id,
      title: row.title,
      questionCount: 0,
      matchedQuestionCount: 0,
    };
    bucket.questionCount += 1;
    const metadata = resolveExplicitSkillMetadata({
      subject: row.subject || undefined,
      skillCode: row.skill_code || undefined,
      subskillCode: row.subskill_code || undefined,
    }, 'explicit_db') || resolveSkillMetadataFromTags(row.tags || undefined);
    if (metadata?.subject === subject && metadata.skillCode === skillCode) {
      bucket.matchedQuestionCount += 1;
    }
    grouped.set(row.quiz_id, bucket);
  }

  return Array.from(grouped.values())
    .filter((quiz) => quiz.matchedQuestionCount > 0)
    .map((quiz) => ({
      ...quiz,
      confidence: round(quiz.matchedQuestionCount / Math.max(1, quiz.questionCount), 2),
    }))
    .sort((left, right) => {
      if (left.confidence !== right.confidence) return right.confidence - left.confidence;
      if (left.matchedQuestionCount !== right.matchedQuestionCount) {
        return right.matchedQuestionCount - left.matchedQuestionCount;
      }
      return left.title.localeCompare(right.title);
    })
    .slice(0, 3);
};

export function buildInterventionSuggestionsFromData(
  input: BuildSuggestionInput,
): InterventionSuggestion[] {
  const now = input.now || new Date();
  const studentsById = new Map(input.students.map((student) => [student.id, student]));
  const resultsByStudentId = new Map<string, InterventionResultRow[]>();

  for (const result of input.results) {
    const student = resolveStudentForResult(result, studentsById);
    if (!student) continue;
    const studentResults = resultsByStudentId.get(student.id) || [];
    studentResults.push(result);
    resultsByStudentId.set(student.id, studentResults);
  }

  const buckets = new Map<string, {
    key: string;
    classId: string;
    className: string;
    subject: string;
    subjectLabel: string;
    skillCode: string;
    skillLabel: string;
    sampleSize: number;
    weightedConfidence: number;
    students: InterventionStudentSignal[];
  }>();

  for (const student of input.students) {
    const studentResults = (resultsByStudentId.get(student.id) || [])
      .sort((left, right) => Date.parse(left.submitted_at) - Date.parse(right.submitted_at));
    if (studentResults.length === 0) continue;
    const latestResult = studentResults[studentResults.length - 1];
    const profile = buildWeaknessProfileFromData(latestResult, studentResults, input.questions);
    const firstScore = Number(studentResults[0].score) || 0;
    const latestScore = Number(latestResult.score) || 0;

    for (const subjectGroup of profile.subjects) {
      for (const skill of subjectGroup.skills) {
        if (skill.status === 'stable') continue;
        const coverageFactor = Math.max(0, Math.min(1, profile.coveragePercent / 100));
        const confidence = round(coverageFactor * (skill.attempted / (skill.attempted + 2)), 2);
        if (!isInterventionSignalEligible(skill.attempted, confidence)) continue;

        const key = buildInterventionSuggestionKey(student.class_id, skill.subject, skill.skillCode);
        const signal: InterventionStudentSignal = {
          studentId: student.id,
          studentName: student.full_name,
          classId: student.class_id,
          className: student.class_name,
          latestResultId: String(latestResult.id),
          latestSubmittedAt: latestResult.submitted_at,
          firstAttemptScore: round(firstScore, 1),
          latestAttemptScore: round(latestScore, 1),
          scoreDelta: round(latestScore - firstScore, 1),
          attemptCount: studentResults.length,
          skillAccuracy: skill.accuracy,
          skillSampleSize: skill.attempted,
          confidence,
          fourWeekTrend: buildFourWeekTrend(studentResults, now),
        };
        const bucket = buckets.get(key) || {
          key,
          classId: student.class_id,
          className: student.class_name,
          subject: skill.subject,
          subjectLabel: skill.subjectLabel,
          skillCode: skill.skillCode,
          skillLabel: getInterventionSkillLabel(skill.skillCode, skill.skillLabel),
          sampleSize: 0,
          weightedConfidence: 0,
          students: [],
        };
        bucket.sampleSize += skill.attempted;
        bucket.weightedConfidence += confidence * skill.attempted;
        bucket.students.push(signal);
        buckets.set(key, bucket);
      }
    }
  }

  return Array.from(buckets.values())
    .map((bucket): InterventionSuggestion => {
      const confidence = round(
        bucket.weightedConfidence / Math.max(1, bucket.sampleSize),
        2,
      );
      const average = (selector: (student: InterventionStudentSignal) => number) => round(
        bucket.students.reduce((sum, student) => sum + selector(student), 0)
          / Math.max(1, bucket.students.length),
        1,
      );
      return {
        key: bucket.key,
        title: `Cần hỗ trợ ở ${bucket.skillLabel}`,
        classId: bucket.classId,
        className: bucket.className,
        subject: bucket.subject,
        subjectLabel: bucket.subjectLabel,
        skillCode: bucket.skillCode,
        skillLabel: bucket.skillLabel,
        sampleSize: bucket.sampleSize,
        confidence,
        studentCount: bucket.students.length,
        averageFirstScore: average((student) => student.firstAttemptScore),
        averageLatestScore: average((student) => student.latestAttemptScore),
        averageScoreDelta: average((student) => student.scoreDelta),
        students: bucket.students.sort((left, right) => {
          if (left.skillAccuracy !== right.skillAccuracy) return left.skillAccuracy - right.skillAccuracy;
          return left.studentName.localeCompare(right.studentName);
        }),
        recommendedQuizzes: buildRecommendations(
          input.recommendationRows,
          bucket.subject,
          bucket.skillCode,
        ),
      };
    })
    .filter((suggestion) => isInterventionSignalEligible(
      suggestion.sampleSize,
      suggestion.confidence,
    ))
    .sort((left, right) => {
      if (left.studentCount !== right.studentCount) return right.studentCount - left.studentCount;
      if (left.confidence !== right.confidence) return right.confidence - left.confidence;
      return left.title.localeCompare(right.title);
    })
    .slice(0, 12);
}

const loadScopedClasses = async (
  db: D1Database,
  user: JWTPayload,
  className?: string,
): Promise<Array<{ id: string; name: string }>> => {
  const filters: string[] = ["COALESCE(archived_at, '') = ''"];
  const bindings: unknown[] = [];
  if (user.role === 'teacher') {
    filters.push('teacher_username = ?');
    bindings.push(user.username);
  }
  if (className && className !== 'All') {
    filters.push('LOWER(TRIM(name)) = ?');
    bindings.push(normalizeText(className));
  }
  const rows = await db.prepare(`
    SELECT id, name FROM classes
    WHERE ${filters.join(' AND ')}
    ORDER BY name COLLATE NOCASE
  `).bind(...bindings).all<{ id: string; name: string }>();
  return rows.results || [];
};

const loadRecommendationRows = async (
  db: D1Database,
  user: JWTPayload,
): Promise<RecommendationQuestionRow[]> => {
  const query = `
    SELECT q.id AS quiz_id, q.title, qt.subject, qt.skill_code, qt.subskill_code, qt.tags
    FROM quizzes q
    JOIN questions qt ON qt.quiz_id = q.id
    ${user.role === 'teacher' ? 'WHERE q.created_by = ?' : ''}
  `;
  const rows = user.role === 'teacher'
    ? await db.prepare(query).bind(user.username).all<RecommendationQuestionRow>()
    : await db.prepare(query).all<RecommendationQuestionRow>();
  return rows.results || [];
};

const loadPersistedGroups = async (
  db: D1Database,
  user: JWTPayload,
  filters: InterventionScopeFilters,
): Promise<InterventionGroup[]> => {
  const where = ["g.status = 'ACTIVE'"];
  const bindings: unknown[] = [];
  if (user.role === 'teacher') {
    where.push('g.teacher_username = ?');
    bindings.push(user.username);
  }
  if (filters.className && filters.className !== 'All') {
    where.push('LOWER(TRIM(c.name)) = ?');
    bindings.push(normalizeText(filters.className));
  }
  const groupRows = await db.prepare(`
    SELECT g.*, c.name AS class_name
    FROM intervention_groups g
    JOIN classes c ON c.id = g.class_id
    WHERE ${where.join(' AND ')}
    ORDER BY datetime(g.updated_at) DESC
  `).bind(...bindings).all<InterventionGroupRow>();
  const groups = groupRows.results || [];
  if (groups.length === 0) return [];

  const groupIds = groups.map((group) => group.id);
  const placeholders = groupIds.map(() => '?').join(',');
  const memberRows = await db.prepare(`
    SELECT m.*, s.full_name, c.name AS class_name
    FROM intervention_group_members m
    JOIN students s ON s.id = m.student_id
    JOIN classes c ON c.id = s.class_id
    WHERE m.group_id IN (${placeholders})
    ORDER BY s.full_name COLLATE NOCASE
  `).bind(...groupIds).all<Record<string, unknown>>();
  const noteRows = await db.prepare(`
    SELECT id, group_id, student_id, note_text, created_at, updated_at
    FROM intervention_notes
    WHERE group_id IN (${placeholders})
    ORDER BY datetime(created_at) DESC
  `).bind(...groupIds).all<Record<string, unknown>>();

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    status: group.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    classId: group.class_id,
    className: group.class_name,
    subject: group.subject,
    subjectLabel: group.subject_label,
    skillCode: group.skill_code,
    skillLabel: group.skill_label,
    sampleSize: Number(group.sample_size) || 0,
    confidence: Number(group.confidence) || 0,
    recommendedQuizzes: safeJson<{ recommendedQuizzes?: InterventionQuizRecommendation[] }>(
      group.source_filter_json,
      {},
    ).recommendedQuizzes || [],
    members: (memberRows.results || [])
      .filter((row) => String(row.group_id) === group.id)
      .map((row): InterventionStudentSignal => ({
        studentId: String(row.student_id),
        studentName: String(row.full_name || ''),
        classId: group.class_id,
        className: String(row.class_name || group.class_name),
        latestResultId: String(row.latest_result_id || ''),
        latestSubmittedAt: String(row.latest_submitted_at || ''),
        firstAttemptScore: Number(row.first_attempt_score) || 0,
        latestAttemptScore: Number(row.latest_attempt_score) || 0,
        scoreDelta: Number(row.score_delta) || 0,
        attemptCount: Number(row.attempt_count) || 0,
        skillAccuracy: Number(row.skill_accuracy) || 0,
        skillSampleSize: Number(row.skill_sample_size) || 0,
        confidence: Number(row.confidence) || 0,
        fourWeekTrend: safeJson<InterventionTrendPoint[]>(row.trend_json, []),
      })),
    notes: (noteRows.results || [])
      .filter((row) => String(row.group_id) === group.id)
      .map((row): InterventionPrivateNote => ({
        id: String(row.id),
        groupId: group.id,
        studentId: row.student_id ? String(row.student_id) : null,
        note: String(row.note_text || ''),
        createdAt: String(row.created_at || ''),
        updatedAt: String(row.updated_at || ''),
      })),
    createdAt: group.created_at,
    updatedAt: group.updated_at,
  }));
};

export async function loadInterventionDashboard(
  db: D1Database,
  user: JWTPayload,
  filters: InterventionScopeFilters = {},
  now = new Date(),
): Promise<InterventionDashboard> {
  const classes = await loadScopedClasses(db, user, filters.className);
  if (classes.length === 0) {
    return {
      generatedAt: now.toISOString(),
      criteria: {
        windowDays: 28,
        minimumSampleSize: INTERVENTION_MIN_SAMPLE_SIZE,
        minimumConfidence: INTERVENTION_MIN_CONFIDENCE,
      },
      suggestions: [],
      groups: [],
    };
  }
  const classIds = classes.map((classroom) => classroom.id);
  const classPlaceholders = classIds.map(() => '?').join(',');
  const studentRows = await db.prepare(`
    SELECT s.id, s.full_name, s.class_id, c.name AS class_name
    FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE s.class_id IN (${classPlaceholders})
      AND COALESCE(s.archived_at, '') = ''
  `).bind(...classIds).all<InterventionStudentRow>();
  const students = studentRows.results || [];
  const since = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const studentIds = students.map((student) => student.id);
  let results: InterventionResultRow[] = [];
  if (studentIds.length > 0) {
    const studentPlaceholders = studentIds.map(() => '?').join(',');
    const resultBindings: unknown[] = [since, ...studentIds, ...classIds];
    let resultQuery = `
      SELECT r.id, r.student_id, r.class_id, r.student_name, r.class_name, r.quiz_id, r.quiz_title,
             r.score, r.correct_count, r.total_questions, r.time_taken, r.submitted_at, r.answers
      FROM results r
      WHERE r.submitted_at >= ?
        AND r.answers != '{"status":"STARTED"}'
        AND r.student_id IN (${studentPlaceholders})
        AND r.class_id IN (${classPlaceholders})`;
    if (filters.quizId && filters.quizId !== 'all') {
      resultQuery += ' AND r.quiz_id = ?';
      resultBindings.push(filters.quizId);
    }
    resultQuery += ' ORDER BY datetime(r.submitted_at) ASC';
    const resultRows = await db.prepare(resultQuery)
      .bind(...resultBindings)
      .all<InterventionResultRow>();
    results = resultRows.results || [];
  }

  const questions = await getQuestionsForQuizIds(db, results.map((result) => result.quiz_id));
  const recommendationRows = await loadRecommendationRows(db, user);
  const [suggestions, groups] = await Promise.all([
    Promise.resolve(buildInterventionSuggestionsFromData({
      students,
      results,
      questions,
      recommendationRows,
      now,
    })),
    loadPersistedGroups(db, user, filters),
  ]);
  return {
    generatedAt: now.toISOString(),
    criteria: {
      windowDays: 28,
      minimumSampleSize: INTERVENTION_MIN_SAMPLE_SIZE,
      minimumConfidence: INTERVENTION_MIN_CONFIDENCE,
    },
    suggestions,
    groups,
  };
}

const loadGroupAccess = async (
  db: D1Database,
  user: JWTPayload,
  groupId: string,
): Promise<InterventionGroupRow | null> => {
  let query = `
    SELECT g.*, c.name AS class_name
    FROM intervention_groups g
    JOIN classes c ON c.id = g.class_id
    WHERE g.id = ?`;
  const bindings: unknown[] = [groupId];
  if (user.role === 'teacher') {
    query += ' AND g.teacher_username = ?';
    bindings.push(user.username);
  }
  return db.prepare(query).bind(...bindings).first<InterventionGroupRow>();
};

export async function createInterventionGroup(
  db: D1Database,
  user: JWTPayload,
  suggestion: InterventionSuggestion,
  input: { name?: string; studentIds?: string[] },
  requestId: string,
  nowIso: string,
): Promise<InterventionGroup> {
  const requestedStudentIds = Array.isArray(input.studentIds)
    ? new Set(input.studentIds.map(String))
    : null;
  const members = suggestion.students.filter((student) => (
    !requestedStudentIds || requestedStudentIds.has(student.studentId)
  ));
  if (members.length === 0) throw new Error('At least one eligible student is required');
  const name = String(input.name || suggestion.title).trim();
  if (!name || name.length > 160) throw new Error('Group name must be between 1 and 160 characters');
  const groupId = `ig-${crypto.randomUUID()}`;
  const statements: D1PreparedStatement[] = [
    db.prepare(`
      INSERT INTO intervention_groups (
        id, teacher_username, name, status, class_id, subject, subject_label,
        skill_code, skill_label, sample_size, confidence, source_filter_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      groupId,
      user.username,
      name,
      suggestion.classId,
      suggestion.subject,
      suggestion.subjectLabel,
      suggestion.skillCode,
      suggestion.skillLabel,
      suggestion.sampleSize,
      suggestion.confidence,
      JSON.stringify({
        suggestionKey: suggestion.key,
        recommendedQuizzes: suggestion.recommendedQuizzes,
      }),
      nowIso,
      nowIso,
    ),
    ...members.map((member) => db.prepare(`
      INSERT INTO intervention_group_members (
        group_id, student_id, latest_result_id, latest_submitted_at,
        first_attempt_score, latest_attempt_score, score_delta, attempt_count,
        skill_accuracy, skill_sample_size, confidence, trend_json, added_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      groupId,
      member.studentId,
      member.latestResultId,
      member.latestSubmittedAt,
      member.firstAttemptScore,
      member.latestAttemptScore,
      member.scoreDelta,
      member.attemptCount,
      member.skillAccuracy,
      member.skillSampleSize,
      member.confidence,
      JSON.stringify(member.fourWeekTrend),
      nowIso,
    )),
    db.prepare(`
      INSERT INTO intervention_audit (
        id, teacher_username, action, group_id, request_id, metadata_json, created_at
      ) VALUES (?, ?, 'GROUP_CREATED', ?, ?, ?, ?)
    `).bind(
      `ia-${crypto.randomUUID()}`,
      user.username,
      groupId,
      requestId,
      JSON.stringify({ suggestionKey: suggestion.key, memberCount: members.length }),
      nowIso,
    ),
  ];
  await db.batch(statements);
  const groups = await loadPersistedGroups(db, user, { className: suggestion.className });
  const created = groups.find((group) => group.id === groupId);
  if (!created) throw new Error('Created intervention group could not be reloaded');
  return created;
}

export async function addInterventionNote(
  db: D1Database,
  user: JWTPayload,
  groupId: string,
  input: { note: string; studentId?: string },
  requestId: string,
  nowIso: string,
): Promise<InterventionPrivateNote> {
  const group = await loadGroupAccess(db, user, groupId);
  if (!group) throw new Error('Intervention group not found');
  const note = String(input.note || '').trim();
  if (!note || note.length > INTERVENTION_MAX_NOTE_LENGTH) {
    throw new Error(`Note must be between 1 and ${INTERVENTION_MAX_NOTE_LENGTH} characters`);
  }
  const studentId = input.studentId ? String(input.studentId) : null;
  if (studentId) {
    const member = await db.prepare(`
      SELECT 1 FROM intervention_group_members WHERE group_id = ? AND student_id = ?
    `).bind(groupId, studentId).first();
    if (!member) throw new Error('Student is not a member of this intervention group');
  }
  const noteId = `in-${crypto.randomUUID()}`;
  await db.batch([
    db.prepare(`
      INSERT INTO intervention_notes (
        id, group_id, student_id, teacher_username, note_text, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(noteId, groupId, studentId, user.username, note, nowIso, nowIso),
    db.prepare(`
      INSERT INTO intervention_audit (
        id, teacher_username, action, group_id, student_id, request_id, metadata_json, created_at
      ) VALUES (?, ?, 'NOTE_CREATED', ?, ?, ?, ?, ?)
    `).bind(
      `ia-${crypto.randomUUID()}`,
      user.username,
      groupId,
      studentId,
      requestId,
      JSON.stringify({ noteLength: note.length, scope: studentId ? 'student' : 'group' }),
      nowIso,
    ),
    db.prepare('UPDATE intervention_groups SET updated_at = ? WHERE id = ?').bind(nowIso, groupId),
  ]);
  return {
    id: noteId,
    groupId,
    studentId,
    note,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function createInterventionAssignments(
  db: D1Database,
  user: JWTPayload,
  groupId: string,
  input: CreateInterventionAssignmentsRequest,
  requestId: string,
  nowIso: string,
): Promise<CreateInterventionAssignmentsResponse> {
  const group = await loadGroupAccess(db, user, groupId);
  if (!group) throw new Error('Intervention group not found');
  const quizId = String(input.quizId || '').trim();
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  const deadlineMs = Date.parse(String(input.deadline || ''));
  const maxAttempts = Number(input.maxAttempts);
  if (!quizId) throw new Error('quizId is required');
  if (!idempotencyKey || idempotencyKey.length > 200) throw new Error('idempotencyKey is required');
  if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.parse(nowIso)) {
    throw new Error('deadline must be in the future');
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new Error('maxAttempts must be an integer from 1 to 10');
  }
  const replay = await db.prepare(`
    SELECT group_id, assignment_ids_json, skipped_assignment_ids_json
    FROM intervention_assignment_batches
    WHERE teacher_username = ? AND idempotency_key = ?
  `).bind(user.username, idempotencyKey).first<{
    group_id: string;
    assignment_ids_json: string;
    skipped_assignment_ids_json: string;
  }>();
  if (replay) {
    if (String(replay.group_id) !== groupId) {
      throw new Error('idempotencyKey has already been used for another intervention group');
    }
    return {
      groupId,
      assignmentIds: safeJson<string[]>(replay.assignment_ids_json, []),
      skippedAssignmentIds: safeJson<string[]>(replay.skipped_assignment_ids_json, []),
      replayed: true,
    };
  }
  const quiz = await db.prepare('SELECT id, title FROM quizzes WHERE id = ?')
    .bind(quizId)
    .first<{ id: string; title: string }>();
  if (!quiz) throw new Error('Quiz not found');
  const memberRows = await db.prepare(`
    SELECT m.student_id, s.full_name
    FROM intervention_group_members m
    JOIN students s ON s.id = m.student_id
    WHERE m.group_id = ?
    ORDER BY s.full_name COLLATE NOCASE
  `).bind(groupId).all<{ student_id: string; full_name: string }>();
  const members = memberRows.results || [];
  if (members.length === 0) throw new Error('Intervention group has no members');
  const studentIds = members.map((member) => member.student_id);
  const placeholders = studentIds.map(() => '?').join(',');
  const existingRows = await db.prepare(`
    SELECT id, student_id FROM assignments
    WHERE quiz_id = ? AND class_id = ?
      AND (COALESCE(student_id, '') = '' OR student_id IN (${placeholders}))
      AND status = 'OPEN' AND deadline > ?
  `).bind(quizId, group.class_id, ...studentIds, nowIso).all<{ id: string; student_id: string }>();
  const existingAssignments = existingRows.results || [];
  const classWideAssignmentId = existingAssignments.find((row) => !String(row.student_id || '').trim())?.id;
  const existingByStudent = new Map<string, string>();
  for (const member of members) {
    const personal = existingAssignments.find((row) => String(row.student_id) === member.student_id);
    const assignmentId = personal?.id || classWideAssignmentId;
    if (assignmentId) existingByStudent.set(member.student_id, String(assignmentId));
  }
  const deadline = new Date(deadlineMs).toISOString();
  const created = members
    .filter((member) => !existingByStudent.has(member.student_id))
    .map((member) => ({
      id: `a-${crypto.randomUUID().slice(0, 8)}`,
      studentId: member.student_id,
      studentName: member.full_name,
    }));
  const skippedAssignmentIds = Array.from(new Set(existingByStudent.values()));
  const assignmentIds = created.map((assignment) => assignment.id);
  const batchId = `ib-${crypto.randomUUID()}`;
  const statements: D1PreparedStatement[] = [
    ...created.map((assignment) => db.prepare(`
      INSERT INTO assignments (
        id, quiz_id, class_id, student_id, deadline, max_attempts,
        status, created_at, intervention_group_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
    `).bind(
      assignment.id,
      quizId,
      group.class_id,
      assignment.studentId,
      deadline,
      maxAttempts,
      nowIso,
      groupId,
    )),
    db.prepare(`
      INSERT INTO intervention_assignment_batches (
        id, group_id, teacher_username, idempotency_key, quiz_id,
        deadline, max_attempts, assignment_ids_json,
        skipped_assignment_ids_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      batchId,
      groupId,
      user.username,
      idempotencyKey,
      quizId,
      deadline,
      maxAttempts,
      JSON.stringify(assignmentIds),
      JSON.stringify(skippedAssignmentIds),
      nowIso,
    ),
    db.prepare(`
      INSERT INTO intervention_audit (
        id, teacher_username, action, group_id, request_id, metadata_json, created_at
      ) VALUES (?, ?, 'ASSIGNMENT_BATCH_CREATED', ?, ?, ?, ?)
    `).bind(
      `ia-${crypto.randomUUID()}`,
      user.username,
      groupId,
      requestId,
      JSON.stringify({
        batchId,
        quizId,
        assignmentIds,
        skippedAssignmentIds,
        memberCount: members.length,
      }),
      nowIso,
    ),
    db.prepare('UPDATE intervention_groups SET updated_at = ? WHERE id = ?').bind(nowIso, groupId),
  ];
  await db.batch(statements);
  try {
    await createNotifications(db, created.map((assignment) => ({
      userId: assignment.studentId,
      userRole: 'student' as const,
      type: 'assignment_created' as const,
      priority: 'IMPORTANT' as const,
      title: 'Em có bài luyện tập mới',
      body: `${quiz.title || 'Bài luyện tập'} · Hạn làm ${formatSystemDateTime(deadline)}`,
      actionUrl: `/student?assignment=${encodeURIComponent(assignment.id)}`,
      data: {
        assignment_id: assignment.id,
        quiz_id: quizId,
        deadline,
        intervention_group_id: groupId,
      },
      sourceType: 'assignment',
      sourceId: assignment.id,
      createdAt: nowIso,
    })));
  } catch (error) {
    console.error('[Intervention] assignment notifications failed', { groupId, batchId, error });
  }
  return {
    groupId,
    assignmentIds,
    skippedAssignmentIds,
    replayed: false,
  };
}
