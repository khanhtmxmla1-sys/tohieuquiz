import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';
import { competitionCursor, competitionLimit, competitionPage } from './pagination';

export const SCHOOL_EXAM_RECONCILE_ISSUE_TYPES = [
  'MISSING_PARTICIPANT',
  'MISSING_SUBMISSION',
  'DUPLICATE_RESULT',
  'ROOM_MEMBER_MISMATCH',
  'SCORE_MISSING',
  'RETEST_PENDING',
  'EXAM_NOT_CLOSED',
] as const;

export type SchoolExamReconcileIssueType = typeof SCHOOL_EXAM_RECONCILE_ISSUE_TYPES[number];

interface EventRow {
  id: string;
  status: string;
}

interface RoomRow {
  id: string;
  live_exam_session_id: string | null;
  session_status: string | null;
}

interface MemberRow {
  room_id: string;
  student_id: string;
  original_class_id: string;
}

interface ParticipantRow {
  id: string;
  room_id: string;
  live_exam_id: string;
  student_id: string;
  joined_at: string;
  started_at: string | null;
  submitted_at: string | null;
  score: number | null;
  correct_count: number | null;
}

interface RetestRow {
  id: string;
  student_id: string;
  status: string;
  source_result_id: string | null;
  replacement_room_id: string | null;
  incident_id: string | null;
  expires_at: string | null;
  live_exam_session_id: string | null;
  resolution: 'KEEP_ORIGINAL' | 'REPLACE_WITH_RETEST' | 'INVALIDATE_RESULT' | null;
  retest_session_status: string | null;
  retest_participant_id: string | null;
  retest_joined_at: string | null;
  retest_started_at: string | null;
  retest_submitted_at: string | null;
  retest_score: number | null;
  retest_correct_count: number | null;
}

interface ReconcileRunRow {
  id: string;
  event_id: string;
  version: number;
  status: 'QUEUED' | 'RUNNING' | 'BLOCKED' | 'SUCCEEDED' | 'FAILED';
  request_id: string;
  summary_json: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
}

interface ReconcileIssueRow {
  id: string;
  run_id: string;
  event_id: string;
  room_id: string | null;
  student_id: string | null;
  issue_type: SchoolExamReconcileIssueType;
  blocking: number;
  details_json: string;
  created_at: string;
}

interface ReconcileIssueDraft {
  issueType: SchoolExamReconcileIssueType;
  roomId?: string;
  studentId?: string;
  blocking: true;
  details: Record<string, unknown>;
}

function parseJson<T>(value: string | null, fallback: T): T {
  try {
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function secondsBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function issueKey(issue: ReconcileIssueDraft): string {
  return [issue.issueType, issue.roomId || '', issue.studentId || '', JSON.stringify(issue.details)].join('|');
}

function dedupeIssues(issues: ReconcileIssueDraft[]): ReconcileIssueDraft[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = issueKey(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapIssue(row: ReconcileIssueRow) {
  return {
    id: row.id,
    runId: row.run_id,
    eventId: row.event_id,
    roomId: row.room_id,
    studentId: row.student_id,
    issueType: row.issue_type,
    blocking: Number(row.blocking) === 1,
    details: parseJson<Record<string, unknown>>(row.details_json, {}),
    createdAt: row.created_at,
  };
}

async function issueRows(
  db: D1Database,
  runId: string,
  options: { limit?: number | string; cursor?: string } = {},
) {
  const limit = competitionLimit(options.limit);
  const cursor = competitionCursor(
    options.cursor,
    `school-exam-reconcile-issues:${runId}`,
    4,
    'SCHOOL_EXAM_RECONCILE_CURSOR_INVALID',
  );
  if (cursor && (!cursor[0] || cursor[3] === undefined)) {
    throw new Error('SCHOOL_EXAM_RECONCILE_CURSOR_INVALID');
  }
  const cursorFilter = cursor
    ? ` AND (
        issue_type > ?
        OR (issue_type = ? AND COALESCE(room_id, '') > ?)
        OR (issue_type = ? AND COALESCE(room_id, '') = ? AND COALESCE(student_id, '') > ?)
        OR (issue_type = ? AND COALESCE(room_id, '') = ? AND COALESCE(student_id, '') = ? AND id > ?)
      )`
    : '';
  const result = await db.prepare(`
    SELECT id, run_id, event_id, room_id, student_id, issue_type, blocking, details_json, created_at
    FROM competition_school_exam_reconcile_issues
     WHERE run_id = ?${cursorFilter}
     ORDER BY issue_type ASC, room_id ASC, student_id ASC, id ASC
     LIMIT ?
  `).bind(
    runId,
    ...(cursor ? [
      cursor[0],
      cursor[0], cursor[1] || '',
      cursor[0], cursor[1] || '', cursor[2] || '',
      cursor[0], cursor[1] || '', cursor[2] || '', cursor[3],
    ] : []),
    limit + 1,
  ).all<ReconcileIssueRow>();
  return competitionPage(
    result.results || [],
    limit,
    (row) => [row.issue_type, row.room_id || '', row.student_id || '', row.id],
    `school-exam-reconcile-issues:${runId}`,
  );
}

async function runById(db: D1Database, runId: string): Promise<ReconcileRunRow | null> {
  return db.prepare(`
    SELECT id, event_id, version, status, request_id, summary_json,
           started_by, started_at, completed_at
    FROM competition_school_exam_reconcile_runs
    WHERE id = ? LIMIT 1
  `).bind(runId).first<ReconcileRunRow>();
}

async function runByRequest(db: D1Database, eventId: string, requestId: string): Promise<ReconcileRunRow | null> {
  return db.prepare(`
    SELECT id, event_id, version, status, request_id, summary_json,
           started_by, started_at, completed_at
    FROM competition_school_exam_reconcile_runs
    WHERE event_id = ? AND request_id = ? LIMIT 1
  `).bind(eventId, requestId).first<ReconcileRunRow>();
}

async function latestRun(db: D1Database, eventId: string): Promise<ReconcileRunRow | null> {
  return db.prepare(`
    SELECT id, event_id, version, status, request_id, summary_json,
           started_by, started_at, completed_at
    FROM competition_school_exam_reconcile_runs
    WHERE event_id = ?
    ORDER BY version DESC, started_at DESC, id DESC
    LIMIT 1
  `).bind(eventId).first<ReconcileRunRow>();
}

async function hydrateRun(
  db: D1Database,
  row: ReconcileRunRow,
  options: { limit?: number | string; cursor?: string } = {},
) {
  const summary = parseJson<Record<string, unknown>>(row.summary_json, {});
  const issuesPage = await issueRows(db, row.id, options);
  return {
    id: row.id,
    eventId: row.event_id,
    version: Number(row.version),
    status: row.status,
    requestId: row.request_id,
    blockingIssues: Number(summary.blockingIssues || 0),
    canonicalResults: Number(summary.canonicalResults || 0),
    allRoomsClosed: summary.allRoomsClosed === true,
    eventStatus: String(summary.eventStatus || 'WITHHELD'),
    summary,
    issues: issuesPage.items.map(mapIssue),
    issuesNextCursor: issuesPage.nextCursor,
    issuesHasMore: issuesPage.hasMore,
    issuesLimit: issuesPage.limit,
    startedBy: row.started_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function addIssue(
  issues: ReconcileIssueDraft[],
  issueType: SchoolExamReconcileIssueType,
  details: Record<string, unknown>,
  roomId?: string,
  studentId?: string,
): void {
  issues.push({ issueType, roomId, studentId, blocking: true, details });
}

export async function getSchoolExamReconcile(
  db: D1Database,
  eventId: string,
  options: { limit?: number | string; cursor?: string } = {},
) {
  const event = await db.prepare('SELECT id FROM competition_school_exam_events WHERE id = ? LIMIT 1')
    .bind(eventId).first<{ id: string }>();
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  const run = await latestRun(db, eventId);
  if (!run) throw new Error('SCHOOL_EXAM_RECONCILE_NOT_FOUND');
  return hydrateRun(db, run, options);
}

export async function reconcileSchoolExam(
  db: D1Database,
  eventId: string,
  actorUsername: string,
  requestId: string,
) {
  const replay = await runByRequest(db, eventId, requestId);
  if (replay) return hydrateRun(db, replay);

  const event = await db.prepare(`
    SELECT id, status FROM competition_school_exam_events WHERE id = ? LIMIT 1
  `).bind(eventId).first<EventRow>();
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  if (event.status === 'PUBLISHED') throw new Error('SCHOOL_EXAM_RECONCILE_PUBLISHED_LOCKED');

  const roomsResult = await db.prepare(`
    SELECT rooms.id, rooms.live_exam_session_id, sessions.status AS session_status
    FROM competition_school_exam_rooms AS rooms
    LEFT JOIN live_exam_sessions AS sessions ON sessions.id = rooms.live_exam_session_id
    WHERE rooms.event_id = ?
    ORDER BY rooms.scheduled_at ASC, rooms.room_code ASC, rooms.id ASC
  `).bind(eventId).all<RoomRow>();
  const rooms = roomsResult.results || [];
  if (rooms.length === 0) throw new Error('SCHOOL_EXAM_ROOMS_REQUIRED');

  const membersResult = await db.prepare(`
    SELECT room_id, student_id, original_class_id
    FROM competition_school_exam_members
    WHERE event_id = ? AND status <> 'VOID'
    ORDER BY room_id ASC, student_id ASC
  `).bind(eventId).all<MemberRow>();
  const members = membersResult.results || [];

  const participantsResult = await db.prepare(`
    SELECT participants.id, rooms.id AS room_id, participants.live_exam_id, participants.student_id,
           participants.joined_at, participants.started_at, participants.submitted_at,
           participants.score, participants.correct_count
    FROM competition_school_exam_rooms AS rooms
    JOIN live_exam_sessions AS sessions ON sessions.id = rooms.live_exam_session_id
    JOIN live_exam_participants AS participants ON participants.live_exam_id = sessions.id
    WHERE rooms.event_id = ?
    ORDER BY rooms.id ASC, participants.student_id ASC, participants.id ASC
  `).bind(eventId).all<ParticipantRow>();
  const participants = participantsResult.results || [];

  const retestsResult = await db.prepare(`
    SELECT retests.id, retests.student_id, retests.status, retests.source_result_id,
           retests.replacement_room_id, retests.incident_id, retests.expires_at,
           retests.live_exam_session_id, retests.resolution,
           sessions.status AS retest_session_status,
           participants.id AS retest_participant_id,
           participants.joined_at AS retest_joined_at,
           participants.started_at AS retest_started_at,
           participants.submitted_at AS retest_submitted_at,
           participants.score AS retest_score,
           participants.correct_count AS retest_correct_count
    FROM competition_school_exam_retests AS retests
    LEFT JOIN live_exam_sessions AS sessions ON sessions.id = retests.live_exam_session_id
    LEFT JOIN live_exam_participants AS participants
      ON participants.live_exam_id = retests.live_exam_session_id
     AND participants.student_id = retests.student_id
    WHERE retests.event_id = ?
      AND retests.status IN ('REQUESTED', 'APPROVED', 'PROVISIONED', 'COMPLETED')
    ORDER BY retests.student_id ASC, retests.requested_at ASC, retests.id ASC
  `).bind(eventId).all<RetestRow>();
  const retests = retestsResult.results || [];

  const nextVersionRow = await db.prepare(`
    SELECT COALESCE(MAX(version), 0) + 1 AS version
    FROM competition_school_exam_reconcile_runs
    WHERE event_id = ?
  `).bind(eventId).first<{ version: number }>();
  const version = Number(nextVersionRow?.version || 1);
  const runId = generateId('school-exam-reconcile');
  const startedAt = new Date().toISOString();

  await db.batch([
    db.prepare(`
      INSERT INTO competition_school_exam_reconcile_runs (
        id, event_id, version, status, request_id, summary_json, started_by, started_at
      ) VALUES (?, ?, ?, 'RUNNING', ?, '{}', ?, ?)
    `).bind(runId, eventId, version, requestId, actorUsername, startedAt),
    db.prepare(`UPDATE competition_school_exam_events SET status = 'RECONCILING', updated_at = ? WHERE id = ?`)
      .bind(startedAt, eventId),
    db.prepare(`UPDATE competition_school_exam_rooms SET status = 'RECONCILING', updated_at = ? WHERE event_id = ?`)
      .bind(startedAt, eventId),
    auditStatement(db, {
      actorUsername,
      action: 'RECONCILE_STARTED',
      targetType: 'competition_school_exam_reconcile_run',
      targetId: runId,
      requestId,
      after: { eventId, version },
    }),
  ]);

  const issues: ReconcileIssueDraft[] = [];
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const memberByStudent = new Map(members.map((member) => [member.student_id, member]));
  const memberByRoomStudent = new Map(members.map((member) => [`${member.room_id}|${member.student_id}`, member]));
  const participantsByRoomStudent = new Map<string, ParticipantRow[]>();
  const participantsByStudent = new Map<string, ParticipantRow[]>();

  for (const participant of participants) {
    const roomStudentKey = `${participant.room_id}|${participant.student_id}`;
    participantsByRoomStudent.set(roomStudentKey, [
      ...(participantsByRoomStudent.get(roomStudentKey) || []),
      participant,
    ]);
    participantsByStudent.set(participant.student_id, [
      ...(participantsByStudent.get(participant.student_id) || []),
      participant,
    ]);
    if (!memberByRoomStudent.has(roomStudentKey)) {
      addIssue(
        issues,
        'ROOM_MEMBER_MISMATCH',
        { participantId: participant.id, liveExamId: participant.live_exam_id },
        participant.room_id,
        participant.student_id,
      );
    }
  }

  for (const room of rooms) {
    if (!room.live_exam_session_id || String(room.session_status || '').toLowerCase() !== 'closed') {
      addIssue(
        issues,
        'EXAM_NOT_CLOSED',
        { liveExamSessionId: room.live_exam_session_id, sessionStatus: room.session_status },
        room.id,
      );
    }
  }

  for (const member of members) {
    const room = roomById.get(member.room_id);
    const matches = participantsByRoomStudent.get(`${member.room_id}|${member.student_id}`) || [];
    const participant = matches[0];
    if (!room?.live_exam_session_id || !participant) {
      addIssue(
        issues,
        'MISSING_PARTICIPANT',
        { liveExamSessionId: room?.live_exam_session_id || null },
        member.room_id,
        member.student_id,
      );
      continue;
    }
    if (!participant.submitted_at) {
      addIssue(
        issues,
        'MISSING_SUBMISSION',
        { participantId: participant.id },
        member.room_id,
        member.student_id,
      );
      continue;
    }
    if (participant.score === null || participant.score === undefined) {
      addIssue(
        issues,
        'SCORE_MISSING',
        { participantId: participant.id, submittedAt: participant.submitted_at },
        member.room_id,
        member.student_id,
      );
    }
  }

  for (const [studentId, studentParticipants] of participantsByStudent) {
    if (studentParticipants.length <= 1) continue;
    const assigned = memberByStudent.get(studentId);
    addIssue(
      issues,
      'DUPLICATE_RESULT',
      {
        participantIds: studentParticipants.map((participant) => participant.id),
        liveExamIds: studentParticipants.map((participant) => participant.live_exam_id),
      },
      assigned?.room_id,
      studentId,
    );
  }

  const completedRetests: RetestRow[] = [];
  for (const retest of retests) {
    const member = memberByStudent.get(retest.student_id);
    const retestComplete = (
      Boolean(retest.live_exam_session_id)
      && String(retest.retest_session_status || '').toLowerCase() === 'closed'
      && Boolean(retest.retest_participant_id)
      && Boolean(retest.retest_submitted_at)
      && retest.retest_score !== null
      && retest.retest_score !== undefined
      && Boolean(retest.resolution)
    );
    if (retestComplete) {
      completedRetests.push(retest);
      continue;
    }
    addIssue(
      issues,
      'RETEST_PENDING',
      {
        retestId: retest.id,
        status: retest.status,
        liveExamSessionId: retest.live_exam_session_id,
        sessionStatus: retest.retest_session_status,
      },
      member?.room_id,
      retest.student_id,
    );
  }

  const finalIssues = dedupeIssues(issues);
  const blockingIssues = finalIssues.filter((issue) => issue.blocking).length;
  const allRoomsClosed = rooms.every((room) => (
    Boolean(room.live_exam_session_id) && String(room.session_status || '').toLowerCase() === 'closed'
  ));
  const eventStatus = allRoomsClosed && blockingIssues === 0 ? 'READY_TO_PUBLISH' : 'WITHHELD';
  const runStatus = eventStatus === 'READY_TO_PUBLISH' ? 'SUCCEEDED' : 'BLOCKED';
  const completedAt = new Date().toISOString();

  const canonicalStatements = members.flatMap((member) => {
    const room = roomById.get(member.room_id);
    if (!room?.live_exam_session_id) return [];
    const participant = (participantsByRoomStudent.get(`${member.room_id}|${member.student_id}`) || [])[0];
    if (!participant?.submitted_at || participant.score === null || participant.score === undefined) return [];
    return [db.prepare(`
      INSERT INTO competition_school_exam_results (
        id, event_id, room_id, student_id, original_class_id, live_exam_session_id,
        live_exam_participant_id, score, correct_count, time_taken, rank, status,
        source_result_id, computed_at, published_at, retest_id, resolution, reconcile_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'RECONCILED', NULL, ?, NULL, NULL, NULL, ?)
      ON CONFLICT(event_id, student_id) DO UPDATE SET
        room_id = excluded.room_id,
        original_class_id = excluded.original_class_id,
        live_exam_session_id = excluded.live_exam_session_id,
        live_exam_participant_id = excluded.live_exam_participant_id,
        score = excluded.score,
        correct_count = excluded.correct_count,
        time_taken = excluded.time_taken,
        rank = NULL,
        status = 'RECONCILED',
        source_result_id = NULL,
        computed_at = excluded.computed_at,
        published_at = NULL,
        retest_id = NULL,
        resolution = NULL,
        reconcile_version = excluded.reconcile_version
    `).bind(
      generateId('school-exam-result'),
      eventId,
      member.room_id,
      member.student_id,
      member.original_class_id,
      room.live_exam_session_id,
      participant.id,
      Number(participant.score),
      participant.correct_count === null || participant.correct_count === undefined
        ? null
        : Number(participant.correct_count),
      secondsBetween(participant.started_at || participant.joined_at, participant.submitted_at),
      completedAt,
      version,
    )];
  });

  const retestResolutionStatements = completedRetests.flatMap((retest) => {
    const member = memberByStudent.get(retest.student_id);
    if (!member || !retest.resolution || !retest.retest_participant_id || !retest.live_exam_session_id) return [];
    const completionStatements: D1PreparedStatement[] = [
      db.prepare(`
        UPDATE competition_school_exam_retests
        SET status = 'COMPLETED'
        WHERE id = ? AND event_id = ?
      `).bind(retest.id, eventId),
    ];
    if (retest.incident_id) {
      completionStatements.push(db.prepare(`
        UPDATE competition_school_exam_incidents
        SET resolved_at = ?, resolution_json = ?
        WHERE id = ? AND event_id = ?
      `).bind(
        completedAt,
        JSON.stringify({ retestId: retest.id, resolution: retest.resolution }),
        retest.incident_id,
        eventId,
      ));
    }

    if (retest.resolution === 'KEEP_ORIGINAL') {
      return [
        db.prepare(`
          UPDATE competition_school_exam_results
          SET retest_id = ?, resolution = 'KEEP_ORIGINAL', reconcile_version = ?
          WHERE event_id = ? AND student_id = ?
        `).bind(retest.id, version, eventId, retest.student_id),
        ...completionStatements,
      ];
    }

    if (retest.resolution === 'INVALIDATE_RESULT') {
      return [
        db.prepare(`
          UPDATE competition_school_exam_results
          SET status = 'VOID', rank = NULL, published_at = NULL,
              retest_id = ?, resolution = 'INVALIDATE_RESULT', reconcile_version = ?
          WHERE event_id = ? AND student_id = ?
        `).bind(retest.id, version, eventId, retest.student_id),
        ...completionStatements,
      ];
    }

    return [
      db.prepare(`
        INSERT OR IGNORE INTO competition_school_exam_result_history (
          id, canonical_result_id, event_id, student_id, room_id, original_class_id,
          live_exam_session_id, live_exam_participant_id, score, correct_count, time_taken,
          rank, result_status, disposition, retest_id, reconcile_version, superseded_at
        )
        SELECT ?, id, event_id, student_id, room_id, original_class_id,
               live_exam_session_id, live_exam_participant_id, score, correct_count, time_taken,
               rank, status, 'SUPERSEDED', ?, ?, ?
        FROM competition_school_exam_results
        WHERE event_id = ? AND student_id = ?
      `).bind(
        generateId('school-exam-result-history'),
        retest.id,
        version,
        completedAt,
        eventId,
        retest.student_id,
      ),
      db.prepare(`
        UPDATE competition_school_exam_results
        SET room_id = ?, live_exam_session_id = ?, live_exam_participant_id = ?,
            score = ?, correct_count = ?, time_taken = ?, rank = NULL,
            status = 'RECONCILED', published_at = NULL, computed_at = ?,
            retest_id = ?, resolution = 'REPLACE_WITH_RETEST', reconcile_version = ?
        WHERE event_id = ? AND student_id = ?
      `).bind(
        retest.replacement_room_id || member.room_id,
        retest.live_exam_session_id,
        retest.retest_participant_id,
        Number(retest.retest_score),
        retest.retest_correct_count === null || retest.retest_correct_count === undefined
          ? null
          : Number(retest.retest_correct_count),
        secondsBetween(retest.retest_started_at || retest.retest_joined_at, retest.retest_submitted_at),
        completedAt,
        retest.id,
        version,
        eventId,
        retest.student_id,
      ),
      ...completionStatements,
    ];
  });

  const issueStatements = finalIssues.map((issue) => db.prepare(`
    INSERT INTO competition_school_exam_reconcile_issues (
      id, run_id, event_id, room_id, student_id, issue_type, blocking, details_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).bind(
    generateId('school-exam-reconcile-issue'),
    runId,
    eventId,
    issue.roomId || null,
    issue.studentId || null,
    issue.issueType,
    JSON.stringify(issue.details),
    completedAt,
  ));

  const canonicalResults = canonicalStatements.length;
  const issueCounts = finalIssues.reduce<Record<string, number>>((counts, issue) => {
    counts[issue.issueType] = (counts[issue.issueType] || 0) + 1;
    return counts;
  }, {});
  const summary = {
    version,
    roomCount: rooms.length,
    memberCount: members.length,
    participantCount: participants.length,
    canonicalResults,
    completedRetests: completedRetests.length,
    issueCount: finalIssues.length,
    blockingIssues,
    issueCounts,
    allRoomsClosed,
    eventStatus,
  };

  await db.batch([
    db.prepare(`
      UPDATE competition_school_exam_results
      SET status = 'WITHHELD', rank = NULL, published_at = NULL
      WHERE event_id = ? AND status <> 'PUBLISHED'
    `).bind(eventId),
    ...canonicalStatements,
    ...retestResolutionStatements,
    ...issueStatements,
    db.prepare(`
      UPDATE competition_school_exam_reconcile_runs
      SET status = ?, summary_json = ?, completed_at = ?
      WHERE id = ?
    `).bind(runStatus, JSON.stringify(summary), completedAt, runId),
    db.prepare(`UPDATE competition_school_exam_events SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(eventStatus, completedAt, eventId),
    db.prepare(`UPDATE competition_school_exam_rooms SET status = ?, updated_at = ? WHERE event_id = ?`)
      .bind(eventStatus, completedAt, eventId),
    auditStatement(db, {
      actorUsername,
      action: 'SCHOOL_EXAM_RECONCILED',
      targetType: 'competition_school_exam_event',
      targetId: eventId,
      requestId,
      after: summary,
    }),
    auditStatement(db, {
      actorUsername,
      action: 'RECONCILE_RESOLVED',
      targetType: 'competition_school_exam_reconcile_run',
      targetId: runId,
      requestId,
      after: summary,
    }),
  ]);

  const persisted = await runById(db, runId);
  if (!persisted) throw new Error('SCHOOL_EXAM_RECONCILE_PERSIST_FAILED');
  return hydrateRun(db, persisted);
}
