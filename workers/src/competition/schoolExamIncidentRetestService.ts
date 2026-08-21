import { generateAccessCode, generateId as generateLiveExamId } from '../services/liveExam/utils';
import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';

interface IncidentRow {
  id: string;
  event_id: string;
  room_id: string | null;
  student_id: string | null;
  incident_type: string;
  severity: string;
  details_json: string;
  reported_by: string;
  occurred_at: string;
  resolved_at: string | null;
  resolution_json: string | null;
  request_id: string | null;
}

interface RetestRow {
  id: string;
  event_id: string;
  student_id: string;
  source_result_id: string | null;
  replacement_room_id: string | null;
  reason: string;
  status: string;
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  incident_id: string | null;
  reason_code: string | null;
  reason_text: string | null;
  grant_request_id: string | null;
  expires_at: string | null;
  live_exam_session_id: string | null;
  resolution: string | null;
}

function parseJson<T>(value: string | null, fallback: T): T {
  try {
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function mapIncident(row: IncidentRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    roomId: row.room_id,
    studentId: row.student_id,
    reasonCode: row.incident_type,
    severity: row.severity,
    details: parseJson<Record<string, unknown>>(row.details_json, {}),
    reportedBy: row.reported_by,
    occurredAt: row.occurred_at,
    resolvedAt: row.resolved_at,
    resolution: parseJson<Record<string, unknown> | null>(row.resolution_json, null),
  };
}

function mapRetest(row: RetestRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    studentId: row.student_id,
    originalResultId: row.source_result_id,
    incidentId: row.incident_id,
    replacementRoomId: row.replacement_room_id,
    reasonCode: row.reason_code,
    reasonText: row.reason_text || row.reason,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    grantedBy: row.decided_by,
    grantedAt: row.decided_at,
    expiresAt: row.expires_at,
    liveExamSessionId: row.live_exam_session_id,
    resolution: row.resolution,
    status: row.status,
  };
}

async function incidentById(db: D1Database, id: string): Promise<IncidentRow | null> {
  return db.prepare(`
    SELECT id, event_id, room_id, student_id, incident_type, severity, details_json,
           reported_by, occurred_at, resolved_at, resolution_json, request_id
    FROM competition_school_exam_incidents WHERE id = ? LIMIT 1
  `).bind(id).first<IncidentRow>();
}

async function retestById(db: D1Database, id: string): Promise<RetestRow | null> {
  return db.prepare(`
    SELECT id, event_id, student_id, source_result_id, replacement_room_id, reason, status,
           requested_by, requested_at, decided_by, decided_at, incident_id, reason_code,
           reason_text, grant_request_id, expires_at, live_exam_session_id, resolution
    FROM competition_school_exam_retests WHERE id = ? LIMIT 1
  `).bind(id).first<RetestRow>();
}

async function requireIncidentScope(
  db: D1Database,
  eventId: string,
  roomId: string,
  studentId: string,
  actor: { username: string; role: string },
): Promise<void> {
  const room = await db.prepare(`
    SELECT id, invigilator_ids_json
    FROM competition_school_exam_rooms
    WHERE id = ? AND event_id = ? LIMIT 1
  `).bind(roomId, eventId).first<{ id: string; invigilator_ids_json: string }>();
  if (!room) throw new Error('SCHOOL_EXAM_ROOM_NOT_FOUND');
  const invigilatorIds = parseJson<string[]>(room.invigilator_ids_json, []);
  if (actor.role !== 'admin' && !invigilatorIds.includes(actor.username)) {
    throw new Error('SCHOOL_EXAM_INCIDENT_FORBIDDEN');
  }
  const member = await db.prepare(`
    SELECT id FROM competition_school_exam_members
    WHERE event_id = ? AND room_id = ? AND student_id = ? AND status <> 'VOID'
    LIMIT 1
  `).bind(eventId, roomId, studentId).first<{ id: string }>();
  if (!member) throw new Error('SCHOOL_EXAM_INCIDENT_FORBIDDEN');
}

export async function reportSchoolExamIncident(
  db: D1Database,
  input: {
    eventId: string;
    roomId: string;
    studentId: string;
    originalResultId: string;
    reasonCode: string;
    reasonText?: string;
    occurredAt?: string;
    details?: Record<string, unknown>;
    requestId: string;
  },
  actor: { username: string; role: string },
) {
  const replay = await db.prepare(`
    SELECT id FROM competition_school_exam_incidents
    WHERE event_id = ? AND request_id = ? LIMIT 1
  `).bind(input.eventId, input.requestId).first<{ id: string }>();
  if (replay) {
    const incident = await incidentById(db, replay.id);
    if (!incident) throw new Error('SCHOOL_EXAM_INCIDENT_NOT_FOUND');
    const retestRef = await db.prepare(`
      SELECT id FROM competition_school_exam_retests WHERE incident_id = ? LIMIT 1
    `).bind(replay.id).first<{ id: string }>();
    const retest = retestRef ? await retestById(db, retestRef.id) : null;
    if (
      incident.room_id !== input.roomId
      || incident.student_id !== input.studentId
      || incident.incident_type !== input.reasonCode
      || retest?.source_result_id !== input.originalResultId
    ) throw new Error('SCHOOL_EXAM_INCIDENT_REQUEST_CONFLICT');
    await requireIncidentScope(db, incident.event_id, input.roomId, input.studentId, actor);
    return { incident: mapIncident(incident), retest: retest ? mapRetest(retest) : null };
  }

  const event = await db.prepare(`
    SELECT id, status FROM competition_school_exam_events WHERE id = ? LIMIT 1
  `).bind(input.eventId).first<{ id: string; status: string }>();
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  if (event.status === 'PUBLISHED') throw new Error('SCHOOL_EXAM_RETEST_PUBLISHED_LOCKED');

  await requireIncidentScope(db, input.eventId, input.roomId, input.studentId, actor);

  const original = await db.prepare(`
    SELECT id FROM competition_school_exam_results
    WHERE id = ? AND event_id = ? AND room_id = ? AND student_id = ? LIMIT 1
  `).bind(input.originalResultId, input.eventId, input.roomId, input.studentId).first<{ id: string }>();
  if (!original) throw new Error('SCHOOL_EXAM_ORIGINAL_RESULT_NOT_FOUND');

  const now = new Date().toISOString();
  const incidentId = generateId('school-exam-incident');
  const retestId = generateId('school-exam-retest');
  const reasonText = String(input.reasonText || input.reasonCode).trim();
  const occurredAt = input.occurredAt || now;

  await db.batch([
    db.prepare(`
      INSERT INTO competition_school_exam_incidents (
        id, event_id, room_id, student_id, incident_type, severity, details_json,
        reported_by, occurred_at, request_id
      ) VALUES (?, ?, ?, ?, ?, 'WARNING', ?, ?, ?, ?)
    `).bind(
      incidentId,
      input.eventId,
      input.roomId,
      input.studentId,
      input.reasonCode,
      JSON.stringify(input.details || {}),
      actor.username,
      occurredAt,
      input.requestId,
    ),
    db.prepare(`
      INSERT INTO competition_school_exam_retests (
        id, event_id, student_id, source_result_id, reason, status,
        requested_by, requested_at, incident_id, reason_code, reason_text
      ) VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, ?, ?, ?, ?)
    `).bind(
      retestId,
      input.eventId,
      input.studentId,
      input.originalResultId,
      reasonText,
      actor.username,
      now,
      incidentId,
      input.reasonCode,
      reasonText,
    ),
    db.prepare(`UPDATE competition_school_exam_events SET status = 'WITHHELD', updated_at = ? WHERE id = ?`)
      .bind(now, input.eventId),
    auditStatement(db, {
      actorUsername: actor.username,
      action: 'INCIDENT_REPORTED',
      targetType: 'competition_school_exam_incident',
      targetId: incidentId,
      requestId: input.requestId,
      after: {
        eventId: input.eventId,
        roomId: input.roomId,
        studentId: input.studentId,
        originalResultId: input.originalResultId,
        reasonCode: input.reasonCode,
        retestId,
      },
    }),
  ]);

  const incident = await incidentById(db, incidentId);
  const retest = await retestById(db, retestId);
  if (!incident || !retest) throw new Error('SCHOOL_EXAM_INCIDENT_PERSIST_FAILED');
  return { incident: mapIncident(incident), retest: mapRetest(retest) };
}

export async function grantSchoolExamRetest(
  db: D1Database,
  eventId: string,
  retestId: string,
  input: {
    expiresAt: string;
    resolution: 'KEEP_ORIGINAL' | 'REPLACE_WITH_RETEST' | 'INVALIDATE_RESULT';
    requestId: string;
  },
  actorUsername: string,
) {
  const existing = await retestById(db, retestId);
  if (!existing || existing.event_id !== eventId) throw new Error('SCHOOL_EXAM_RETEST_NOT_FOUND');
  if (existing.grant_request_id === input.requestId && existing.live_exam_session_id) return mapRetest(existing);
  if (existing.status !== 'REQUESTED') throw new Error('SCHOOL_EXAM_RETEST_NOT_REQUESTED');
  if (!existing.source_result_id || !existing.incident_id) throw new Error('SCHOOL_EXAM_RETEST_LINEAGE_INVALID');

  const expiresAtMs = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error('SCHOOL_EXAM_RETEST_EXPIRY_INVALID');
  }

  const source = await db.prepare(`
    SELECT results.room_id, rooms.name AS room_name, rooms.quiz_id, rooms.duration_minutes,
           events.title AS event_title, events.status AS event_status
    FROM competition_school_exam_results AS results
    JOIN competition_school_exam_rooms AS rooms ON rooms.id = results.room_id
    JOIN competition_school_exam_events AS events ON events.id = results.event_id
    WHERE results.id = ? AND results.event_id = ? AND results.student_id = ? LIMIT 1
  `).bind(existing.source_result_id, eventId, existing.student_id).first<{
    room_id: string;
    room_name: string;
    quiz_id: string;
    duration_minutes: number;
    event_title: string;
    event_status: string;
  }>();
  if (!source) throw new Error('SCHOOL_EXAM_ORIGINAL_RESULT_NOT_FOUND');
  if (source.event_status === 'PUBLISHED') throw new Error('SCHOOL_EXAM_RETEST_PUBLISHED_LOCKED');

  const liveExamSessionId = generateLiveExamId();
  const accessCode = generateAccessCode();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      INSERT INTO live_exam_sessions (
        id, title, quiz_id, teacher_id, class_id, duration, scheduled_at,
        settings, status, access_code, created_at, updated_at,
        participant_scope_type, participant_scope_id, result_visibility
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'scheduled', ?, ?, ?,
        'SCHOOL_EXAM_ROOM', ?, 'WITHHELD')
    `).bind(
      liveExamSessionId,
      `${source.event_title} - Retest - ${source.room_name}`,
      source.quiz_id,
      actorUsername,
      source.duration_minutes,
      now,
      JSON.stringify({ showLeaderboard: false, randomizeAnswers: false, retestId }),
      accessCode,
      now,
      now,
      source.room_id,
    ),
    db.prepare(`
      UPDATE competition_school_exam_retests
      SET replacement_room_id = ?, status = 'PROVISIONED', decided_by = ?, decided_at = ?,
          grant_request_id = ?, expires_at = ?, live_exam_session_id = ?, resolution = ?
      WHERE id = ? AND event_id = ? AND status = 'REQUESTED'
    `).bind(
      source.room_id,
      actorUsername,
      now,
      input.requestId,
      input.expiresAt,
      liveExamSessionId,
      input.resolution,
      retestId,
      eventId,
    ),
    db.prepare(`UPDATE competition_school_exam_events SET status = 'WITHHELD', updated_at = ? WHERE id = ?`)
      .bind(now, eventId),
    auditStatement(db, {
      actorUsername,
      action: 'RETEST_GRANTED',
      targetType: 'competition_school_exam_retest',
      targetId: retestId,
      requestId: input.requestId,
      before: { status: existing.status },
      after: {
        eventId,
        studentId: existing.student_id,
        originalResultId: existing.source_result_id,
        incidentId: existing.incident_id,
        reasonCode: existing.reason_code,
        expiresAt: input.expiresAt,
        resolution: input.resolution,
        liveExamSessionId,
      },
    }),
  ]);

  const granted = await retestById(db, retestId);
  if (!granted) throw new Error('SCHOOL_EXAM_RETEST_PERSIST_FAILED');
  return mapRetest(granted);
}
