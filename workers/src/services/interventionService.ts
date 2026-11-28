import {
  formatSystemDateTime,
} from '../utils/systemTime';
import type { JWTPayload } from '../utils/jwt';
import {
  INTERVENTION_ARCHIVE_REASONS,
  INTERVENTION_MAX_NOTE_LENGTH,
  INTERVENTION_MIN_CONFIDENCE,
  INTERVENTION_MIN_SAMPLE_SIZE,
  INTERVENTION_PROGRESS_ACCURACY_DELTA_THRESHOLD,
  type ArchiveInterventionGroupRequest,
  type ArchiveInterventionGroupResponse,
  type CreateInterventionAssignmentsRequest,
  type CreateInterventionAssignmentsResponse,
  type InterventionAssignmentPreview,
  type InterventionDashboard,
  type InterventionGroup,
  type InterventionGroupProgress,
  type InterventionMemberProgress,
  type InterventionPrivateNote,
  type InterventionQuizRecommendation,
  type InterventionStudentSignal,
  type InterventionSuggestion,
  type InterventionTrendPoint,
} from '../../../shared/intervention.contract';
import {
  buildInterventionReadinessFromData,
  buildInterventionSuggestionsFromData,
  createEmptyInterventionReadiness,
  type InterventionResultRow,
  type InterventionStudentRow,
  type RecommendationQuestionRow,
} from './interventionModel';
export { buildInterventionSuggestionsFromData } from './interventionModel';
import {
  getQuestionsForQuizIds,
} from './weaknessProfile';
import {
  buildInterventionGroupProgressFromData,
  type InterventionProgressAssignmentRow,
  type InterventionProgressResultRow,
} from './interventionProgress';
import { createNotifications } from './notificationWriter';

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

const normalizeText = (value: unknown): string => String(value || '').trim().toLowerCase();
const safeJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

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
  evaluatedAt: string,
): Promise<InterventionGroup[]> => {
  const where = ["g.status IN ('ACTIVE', 'ARCHIVED')"];
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

  const assignmentRows = await db.prepare(`
    SELECT id, intervention_group_id, student_id, status, deadline, created_at
    FROM assignments
    WHERE intervention_group_id IN (${placeholders})
  `).bind(...groupIds).all<InterventionProgressAssignmentRow>();
  const assignments = assignmentRows.results || [];
  const progressAssignmentIds = assignments
    .filter((assignment) => String(assignment.status || 'OPEN').toUpperCase() !== 'REVOKED')
    .map((assignment) => assignment.id);
  let progressResults: InterventionProgressResultRow[] = [];
  if (progressAssignmentIds.length > 0) {
    const assignmentPlaceholders = progressAssignmentIds.map(() => '?').join(',');
    const resultRows = await db.prepare(`
      SELECT r.id, r.assignment_id, r.student_id, r.class_id, r.student_name, r.class_name,
             r.quiz_id, r.quiz_title, r.score, r.correct_count, r.total_questions,
             r.time_taken, r.submitted_at, r.answers
      FROM results r
      WHERE r.assignment_id IN (${assignmentPlaceholders})
        AND r.answers != '{"status":"STARTED"}'
      ORDER BY datetime(r.submitted_at) ASC
    `).bind(...progressAssignmentIds).all<InterventionProgressResultRow>();
    progressResults = resultRows.results || [];
  }
  const progressQuestions = await getQuestionsForQuizIds(
    db,
    progressResults.map((result) => result.quiz_id),
  );
  const membersByGroupId = new Map<string, InterventionStudentSignal[]>();
  for (const row of memberRows.results || []) {
    const group = groups.find((item) => item.id === String(row.group_id));
    if (!group) continue;
    const members = membersByGroupId.get(group.id) || [];
    members.push({
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
    });
    membersByGroupId.set(group.id, members);
  }

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
    members: membersByGroupId.get(group.id) || [],
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
    progress: buildInterventionGroupProgressFromData({
      groupId: group.id,
      subject: group.subject,
      skillCode: group.skill_code,
      members: membersByGroupId.get(group.id) || [],
      assignments,
      results: progressResults,
      questions: progressQuestions,
      evaluatedAt,
    }),
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
      readiness: createEmptyInterventionReadiness(),
      suggestions: [],
      groups: [],
      archivedGroups: [],
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
  const readiness = buildInterventionReadinessFromData(students, results, questions);
  const [suggestions, persistedGroups] = await Promise.all([
    Promise.resolve(buildInterventionSuggestionsFromData({
      students,
      results,
      questions,
      recommendationRows,
      now,
    })),
    loadPersistedGroups(db, user, filters, now.toISOString()),
  ]);
  return {
    generatedAt: now.toISOString(),
    criteria: {
      windowDays: 28,
      minimumSampleSize: INTERVENTION_MIN_SAMPLE_SIZE,
      minimumConfidence: INTERVENTION_MIN_CONFIDENCE,
    },
    readiness,
    suggestions,
    groups: persistedGroups.filter((group) => group.status === 'ACTIVE'),
    archivedGroups: persistedGroups.filter((group) => group.status === 'ARCHIVED'),
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
  const groups = await loadPersistedGroups(db, user, { className: suggestion.className }, nowIso);
  const created = groups.find((group) => group.id === groupId);
  if (!created) throw new Error('Created intervention group could not be reloaded');
  return created;
}

const assertActiveInterventionGroup = (group: InterventionGroupRow): void => {
  if (String(group.status).toUpperCase() !== 'ACTIVE') {
    throw new Error('Archived intervention group is read-only');
  }
};

const assertResponsibleTeacher = (group: InterventionGroupRow, user: JWTPayload): void => {
  if (user.role !== 'teacher' || group.teacher_username !== user.username) {
    throw new Error('Forbidden: responsible teacher required');
  }
};

export async function archiveInterventionGroup(
  db: D1Database,
  user: JWTPayload,
  groupId: string,
  input: ArchiveInterventionGroupRequest,
  requestId: string,
  nowIso: string,
): Promise<ArchiveInterventionGroupResponse> {
  const group = await loadGroupAccess(db, user, groupId);
  if (!group) throw new Error('Intervention group not found');
  assertResponsibleTeacher(group, user);
  assertActiveInterventionGroup(group);

  const reason = String(input.reason || '').trim();
  if (!INTERVENTION_ARCHIVE_REASONS.includes(reason as typeof INTERVENTION_ARCHIVE_REASONS[number])) {
    throw new Error('Invalid intervention archive reason');
  }
  const note = String(input.note || '').trim();
  if (note.length > INTERVENTION_MAX_NOTE_LENGTH) {
    throw new Error(`Archive note must not exceed ${INTERVENTION_MAX_NOTE_LENGTH} characters`);
  }
  const archiveReason = reason as ArchiveInterventionGroupResponse['reason'];
  const metadata = JSON.stringify({
    beforeStatus: 'ACTIVE',
    afterStatus: 'ARCHIVED',
    reason: archiveReason,
    note: note || null,
  });
  const auditId = `ia-${crypto.randomUUID()}`;
  const results = await db.batch([
    db.prepare(`
      UPDATE intervention_groups
      SET status = 'ARCHIVED', updated_at = ?
      WHERE id = ? AND status = 'ACTIVE'
    `).bind(nowIso, groupId),
    db.prepare(`
      INSERT INTO intervention_audit (
        id, teacher_username, action, group_id, request_id, metadata_json, created_at
      )
      SELECT ?, ?, 'GROUP_ARCHIVED', ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM intervention_groups
        WHERE id = ? AND status = 'ARCHIVED' AND updated_at = ?
      )
      AND NOT EXISTS (
        SELECT 1 FROM intervention_audit
        WHERE group_id = ? AND action = 'GROUP_ARCHIVED'
      )
    `).bind(
      auditId,
      user.username,
      groupId,
      requestId,
      metadata,
      nowIso,
      groupId,
      nowIso,
      groupId,
    ),
  ]);
  if (Number(results[0]?.meta?.changes || 0) !== 1) {
    throw new Error('Intervention group is already archived');
  }

  return {
    groupId,
    status: 'ARCHIVED',
    reason: archiveReason,
    note: note || null,
    archivedAt: nowIso,
  };
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
  assertActiveInterventionGroup(group);
  assertResponsibleTeacher(group, user);
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

interface InterventionAssignmentMemberRow {
  student_id: string;
  full_name: string;
}

interface InterventionAssignmentEligibility {
  quiz: { id: string; title: string };
  members: InterventionAssignmentMemberRow[];
  existingByStudent: Map<string, string>;
}

const loadInterventionAssignmentEligibility = async (
  db: D1Database,
  group: InterventionGroupRow,
  groupId: string,
  quizId: string,
  nowIso: string,
): Promise<InterventionAssignmentEligibility> => {
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
  `).bind(groupId).all<InterventionAssignmentMemberRow>();
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

  return { quiz, members, existingByStudent };
};

export async function previewInterventionAssignments(
  db: D1Database,
  user: JWTPayload,
  groupId: string,
  quizIdInput: string,
  nowIso: string,
): Promise<InterventionAssignmentPreview> {
  const group = await loadGroupAccess(db, user, groupId);
  if (!group) throw new Error('Intervention group not found');
  const quizId = String(quizIdInput || '').trim();
  if (!quizId) throw new Error('quizId is required');
  const { members, existingByStudent } = await loadInterventionAssignmentEligibility(
    db,
    group,
    groupId,
    quizId,
    nowIso,
  );
  return {
    groupId,
    quizId,
    memberCount: members.length,
    openAssignmentCount: existingByStudent.size,
    assignableCount: Math.max(0, members.length - existingByStudent.size),
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
  assertActiveInterventionGroup(group);
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
  const { quiz, members, existingByStudent } = await loadInterventionAssignmentEligibility(
    db,
    group,
    groupId,
    quizId,
    nowIso,
  );
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
