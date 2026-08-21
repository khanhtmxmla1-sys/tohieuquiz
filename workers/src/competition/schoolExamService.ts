import { generateAccessCode, generateId as generateLiveExamId } from '../services/liveExam/utils';
import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';
import { evaluateCapacityPreflight } from './capacityService';
import { createOrReuseQuizSnapshot } from './quizSnapshotService';

export interface SchoolExamFormDefinition {
  blueprintId: string;
  durationMinutes: number;
  totalScore: number;
  difficulty: string;
  gradeLevel: number;
  objectiveIds: string[];
}

interface SchoolExamEventRow {
  id: string;
  campaign_id: string;
  eligibility_snapshot_version: number;
  title: string;
  exam_date: string;
  status: string;
  ranking_policy: string;
  exam_form_policy: 'SAME_FORM' | 'EQUIVALENT_FORM_SET';
  capacity_profile_id: string | null;
  create_request_id: string | null;
  preflight_json: string | null;
  preflight_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SchoolExamRoomRow {
  id: string;
  event_id: string;
  name: string;
  room_code: string;
  scheduled_at: string;
  duration_minutes: number;
  check_in_lead_minutes: number;
  close_drain_minutes: number;
  form_code: string;
  quiz_id: string;
  quiz_snapshot_id: string | null;
  live_exam_session_id: string | null;
  invigilator_ids_json: string;
  member_count: number;
  form_definition_json: string;
  equivalent_form_approved_by: string | null;
  equivalent_form_approved_at: string | null;
  provision_status: 'PENDING' | 'READY' | 'FAILED';
  provision_error_code: string | null;
  status: string;
  create_request_id: string | null;
  created_at: string;
  updated_at: string;
}

interface QualifiedMemberRow {
  student_id: string;
  original_class_id: string;
}

interface CapacityProfileRow {
  id: string;
  certified_concurrent_students: number;
}

function parseJson<T>(value: string | null, fallback: T): T {
  try {
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function normalizedFormDefinition(value: SchoolExamFormDefinition): SchoolExamFormDefinition {
  return {
    blueprintId: String(value.blueprintId || '').trim(),
    durationMinutes: Number(value.durationMinutes),
    totalScore: Number(value.totalScore),
    difficulty: String(value.difficulty || '').trim().toUpperCase(),
    gradeLevel: Number(value.gradeLevel),
    objectiveIds: [...new Set((value.objectiveIds || []).map((item) => String(item).trim()).filter(Boolean))].sort(),
  };
}

function sameFormDefinition(left: SchoolExamFormDefinition, right: SchoolExamFormDefinition): boolean {
  return JSON.stringify(normalizedFormDefinition(left)) === JSON.stringify(normalizedFormDefinition(right));
}

function mapEvent(row: SchoolExamEventRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    eligibilitySnapshotVersion: Number(row.eligibility_snapshot_version),
    title: row.title,
    examDate: row.exam_date,
    status: row.status,
    rankingPolicy: row.ranking_policy,
    examFormPolicy: row.exam_form_policy,
    capacityProfileId: row.capacity_profile_id,
    preflight: parseJson(row.preflight_json, null),
    preflightAt: row.preflight_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoom(row: SchoolExamRoomRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    roomCode: row.room_code,
    scheduledAt: row.scheduled_at,
    durationMinutes: Number(row.duration_minutes),
    checkInLeadMinutes: Number(row.check_in_lead_minutes),
    closeDrainMinutes: Number(row.close_drain_minutes),
    formCode: row.form_code,
    quizId: row.quiz_id,
    quizSnapshotId: row.quiz_snapshot_id,
    liveExamSessionId: row.live_exam_session_id,
    invigilatorIds: parseJson<string[]>(row.invigilator_ids_json, []),
    memberCount: Number(row.member_count || 0),
    formDefinition: parseJson<SchoolExamFormDefinition | null>(row.form_definition_json, null),
    equivalentFormApprovedBy: row.equivalent_form_approved_by,
    equivalentFormApprovedAt: row.equivalent_form_approved_at,
    provisionStatus: row.provision_status,
    provisionErrorCode: row.provision_error_code,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function eventRow(db: D1Database, eventId: string): Promise<SchoolExamEventRow | null> {
  return db.prepare(`
    SELECT id, campaign_id, eligibility_snapshot_version, title, exam_date, status,
           ranking_policy, exam_form_policy, capacity_profile_id, create_request_id,
           preflight_json, preflight_at, created_by, created_at, updated_at
    FROM competition_school_exam_events WHERE id = ? LIMIT 1
  `).bind(eventId).first<SchoolExamEventRow>();
}

async function roomRows(db: D1Database, eventId: string): Promise<SchoolExamRoomRow[]> {
  const result = await db.prepare(`
    SELECT id, event_id, name, room_code, scheduled_at, duration_minutes,
           check_in_lead_minutes, close_drain_minutes, form_code, quiz_id,
           quiz_snapshot_id, live_exam_session_id, invigilator_ids_json, member_count,
           form_definition_json, equivalent_form_approved_by, equivalent_form_approved_at,
           provision_status, provision_error_code, status, create_request_id, created_at, updated_at
    FROM competition_school_exam_rooms
    WHERE event_id = ? ORDER BY scheduled_at ASC, room_code ASC, id ASC
  `).bind(eventId).all<SchoolExamRoomRow>();
  return result.results || [];
}

async function validateQuizAgainstFormDefinition(
  canonicalPayloadJson: string,
  definitionInput: SchoolExamFormDefinition,
  roomDurationMinutes: number,
): Promise<SchoolExamFormDefinition> {
  const definition = normalizedFormDefinition(definitionInput);
  if (
    !definition.blueprintId
    || !Number.isFinite(definition.totalScore)
    || definition.totalScore <= 0
    || !Number.isInteger(definition.gradeLevel)
    || definition.gradeLevel <= 0
    || !definition.difficulty
    || definition.objectiveIds.length === 0
    || definition.durationMinutes !== roomDurationMinutes
  ) throw new Error('SCHOOL_EXAM_FORM_DEFINITION_INVALID');

  const payload = parseJson<any>(canonicalPayloadJson, {});
  const quizDuration = Number(payload?.quiz?.time_limit || 0);
  if (quizDuration > 0 && quizDuration !== definition.durationMinutes) {
    throw new Error('SCHOOL_EXAM_FORM_DURATION_MISMATCH');
  }
  const quizGrade = Number(payload?.quiz?.class_level || 0);
  if (quizGrade > 0 && quizGrade !== definition.gradeLevel) {
    throw new Error('SCHOOL_EXAM_FORM_GRADE_MISMATCH');
  }
  const difficulties = [...new Set((Array.isArray(payload?.questions) ? payload.questions : [])
    .map((question: any) => String(question?.difficulty || '').trim().toUpperCase())
    .filter(Boolean))];
  const quizDifficulty = difficulties.length === 1 ? difficulties[0] : difficulties.length > 1 ? 'MIXED' : null;
  if (quizDifficulty && quizDifficulty !== definition.difficulty) {
    throw new Error('SCHOOL_EXAM_FORM_DIFFICULTY_MISMATCH');
  }
  return definition;
}

export async function createSchoolExamEvent(
  db: D1Database,
  input: {
    campaignId: string;
    eligibilitySnapshotVersion: number;
    title: string;
    examDate: string;
    rankingPolicy: string;
    examFormPolicy: 'SAME_FORM' | 'EQUIVALENT_FORM_SET';
    capacityProfileId?: string;
    requestId: string;
  },
  actorUsername: string,
) {
  const existing = await db.prepare(`
    SELECT id FROM competition_school_exam_events
    WHERE campaign_id = ? AND create_request_id = ? LIMIT 1
  `).bind(input.campaignId, input.requestId).first<{ id: string }>();
  if (existing) {
    const row = await eventRow(db, existing.id);
    if (!row) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
    return mapEvent(row);
  }

  const campaign = await db.prepare('SELECT id, status FROM competition_campaigns WHERE id = ? LIMIT 1')
    .bind(input.campaignId).first<{ id: string; status: string }>();
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');
  const eligibility = await db.prepare(`
    SELECT COUNT(*) AS count FROM competition_eligibility
    WHERE campaign_id = ? AND eligibility_snapshot_version = ?
  `).bind(input.campaignId, input.eligibilitySnapshotVersion).first<{ count: number }>();
  if (Number(eligibility?.count || 0) <= 0) throw new Error('COMPETITION_ELIGIBILITY_VERSION_NOT_FOUND');

  if (input.capacityProfileId) {
    const profile = await db.prepare(`
      SELECT id FROM live_exam_capacity_profiles WHERE id = ? AND status = 'CERTIFIED' LIMIT 1
    `).bind(input.capacityProfileId).first<{ id: string }>();
    if (!profile) throw new Error('SCHOOL_EXAM_CAPACITY_PROFILE_NOT_FOUND');
  }

  const id = generateId('school-exam-event');
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      INSERT INTO competition_school_exam_events (
        id, campaign_id, eligibility_snapshot_version, title, exam_date, status,
        ranking_policy, exam_form_policy, capacity_profile_id, create_request_id,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, input.campaignId, input.eligibilitySnapshotVersion, input.title, input.examDate,
      input.rankingPolicy, input.examFormPolicy, input.capacityProfileId || null,
      input.requestId, actorUsername, now, now,
    ),
    db.prepare(`UPDATE competition_campaigns SET status = 'EXAM_PREP', updated_at = ? WHERE id = ?`)
      .bind(now, input.campaignId),
    auditStatement(db, {
      actorUsername,
      action: 'SCHOOL_EXAM_EVENT_CREATED',
      targetType: 'competition_school_exam_event',
      targetId: id,
      requestId: input.requestId,
      after: { campaignId: input.campaignId, eligibilitySnapshotVersion: input.eligibilitySnapshotVersion },
    }),
  ]);
  const created = await eventRow(db, id);
  if (!created) throw new Error('SCHOOL_EXAM_EVENT_PERSIST_FAILED');
  return mapEvent(created);
}

export async function listSchoolExamEvents(
  db: D1Database,
  campaignId: string,
  options: { classIds?: string[] } = {},
) {
  const result = await db.prepare(`
    SELECT id, campaign_id, eligibility_snapshot_version, title, exam_date, status,
           ranking_policy, exam_form_policy, capacity_profile_id, create_request_id,
           preflight_json, preflight_at, created_by, created_at, updated_at
    FROM competition_school_exam_events
    WHERE campaign_id = ?
    ORDER BY exam_date DESC, created_at DESC, id DESC
  `).bind(campaignId).all<SchoolExamEventRow>();
  const events = result.results || [];

  if (options.classIds !== undefined && options.classIds.length === 0) return [];

  let allowedRoomIds: Set<string> | null = null;
  if (options.classIds !== undefined) {
    const placeholders = options.classIds.map(() => '?').join(', ');
    const scoped = await db.prepare(`
      SELECT DISTINCT member.room_id
      FROM competition_school_exam_members AS member
      INNER JOIN competition_school_exam_events AS event ON event.id = member.event_id
      WHERE event.campaign_id = ?
        AND member.original_class_id IN (${placeholders})
    `).bind(campaignId, ...options.classIds).all<{ room_id: string }>();
    allowedRoomIds = new Set((scoped.results || []).map((row) => row.room_id));
  }

  const items = [];
  for (const event of events) {
    let rooms = await roomRows(db, event.id);
    if (allowedRoomIds) rooms = rooms.filter((room) => allowedRoomIds!.has(room.id));
    if (allowedRoomIds && rooms.length === 0) continue;
    items.push({ ...mapEvent(event), rooms: rooms.map(mapRoom) });
  }
  return items;
}

export async function getSchoolExamEvent(
  db: D1Database,
  eventId: string,
  viewer?: { username: string; role: string },
) {
  const event = await eventRow(db, eventId);
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  let rooms = await roomRows(db, eventId);
  if (viewer && viewer.role !== 'admin') {
    rooms = rooms.filter((room) => parseJson<string[]>(room.invigilator_ids_json, []).includes(viewer.username));
    if (rooms.length === 0) throw new Error('SCHOOL_EXAM_EVENT_FORBIDDEN');
  }
  return { ...mapEvent(event), rooms: rooms.map(mapRoom) };
}

export async function createSchoolExamRoom(
  db: D1Database,
  input: {
    eventId: string;
    name: string;
    roomCode: string;
    scheduledAt: string;
    durationMinutes: number;
    checkInLeadMinutes: number;
    closeDrainMinutes: number;
    formCode: string;
    quizId: string;
    invigilatorIds: string[];
    studentIds: string[];
    formDefinition: SchoolExamFormDefinition;
    equivalentFormApproved?: boolean;
    requestId: string;
  },
  actorUsername: string,
): Promise<{ room: ReturnType<typeof mapRoom>; warnings: string[] }> {
  const event = await eventRow(db, input.eventId);
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  if (!['DRAFT', 'PREFLIGHT_BLOCKED'].includes(event.status)) throw new Error('SCHOOL_EXAM_EVENT_CONFIG_LOCKED');

  const existingByRequest = await db.prepare(`
    SELECT id FROM competition_school_exam_rooms
    WHERE event_id = ? AND create_request_id = ? LIMIT 1
  `).bind(input.eventId, input.requestId).first<{ id: string }>();
  if (existingByRequest) {
    const existingRooms = await roomRows(db, input.eventId);
    const existing = existingRooms.find((room) => room.id === existingByRequest.id);
    if (!existing) throw new Error('SCHOOL_EXAM_ROOM_NOT_FOUND');
    return { room: mapRoom(existing), warnings: [] };
  }

  const studentIds = [...new Set(input.studentIds.map((value) => String(value || '').trim()).filter(Boolean))];
  if (studentIds.length === 0 || studentIds.length !== input.studentIds.length) {
    throw new Error('SCHOOL_EXAM_ROOM_MEMBERS_INVALID');
  }
  const placeholders = studentIds.map(() => '?').join(', ');
  const qualified = await db.prepare(`
    SELECT eligibility.student_id, member.class_id_at_snapshot AS original_class_id
    FROM competition_eligibility AS eligibility
    JOIN competition_campaigns AS campaign ON campaign.id = eligibility.campaign_id
    JOIN competition_audience_members AS member
      ON member.audience_snapshot_id = campaign.audience_snapshot_id
     AND member.student_id = eligibility.student_id
    WHERE eligibility.campaign_id = ?
      AND eligibility.eligibility_snapshot_version = ?
      AND eligibility.qualified = 1
      AND eligibility.student_id IN (${placeholders})
    ORDER BY eligibility.student_id ASC
  `).bind(event.campaign_id, event.eligibility_snapshot_version, ...studentIds)
    .all<QualifiedMemberRow>();
  if ((qualified.results || []).length !== studentIds.length) {
    throw new Error('SCHOOL_EXAM_ROOM_MEMBER_NOT_QUALIFIED');
  }

  const alreadyAssigned = await db.prepare(`
    SELECT student_id FROM competition_school_exam_members
    WHERE event_id = ? AND student_id IN (${placeholders}) LIMIT 1
  `).bind(input.eventId, ...studentIds).first<{ student_id: string }>();
  if (alreadyAssigned) throw new Error('SCHOOL_EXAM_MEMBER_ALREADY_ASSIGNED');

  const snapshot = await createOrReuseQuizSnapshot(db, input.quizId);
  const formDefinition = await validateQuizAgainstFormDefinition(
    snapshot.canonicalPayloadJson,
    input.formDefinition,
    input.durationMinutes,
  );
  const existingRooms = await roomRows(db, input.eventId);

  if (event.exam_form_policy === 'SAME_FORM' && existingRooms.length > 0) {
    const reference = existingRooms[0];
    if (reference.quiz_snapshot_id !== snapshot.id || reference.form_code !== input.formCode) {
      throw new Error('SCHOOL_EXAM_SAME_FORM_REQUIRED');
    }
  }
  if (event.exam_form_policy === 'EQUIVALENT_FORM_SET') {
    if (input.equivalentFormApproved !== true) throw new Error('SCHOOL_EXAM_EQUIVALENT_FORM_APPROVAL_REQUIRED');
    const reference = existingRooms[0];
    if (reference) {
      const referenceDefinition = parseJson<SchoolExamFormDefinition | null>(reference.form_definition_json, null);
      if (!referenceDefinition || !sameFormDefinition(referenceDefinition, formDefinition)) {
        throw new Error('SCHOOL_EXAM_EQUIVALENT_FORM_MISMATCH');
      }
    }
  }

  const warnings: string[] = [];
  const scheduledAtMs = Date.parse(input.scheduledAt);
  if (existingRooms.some((room) => (
    room.quiz_snapshot_id === snapshot.id
    && Date.parse(room.scheduled_at) < scheduledAtMs
  ))) warnings.push('LATER_SHIFT_FORM_REUSE');

  const id = generateId('school-exam-room');
  const now = new Date().toISOString();
  const approvalActor = event.exam_form_policy === 'EQUIVALENT_FORM_SET' ? actorUsername : null;
  const approvalAt = approvalActor ? now : null;
  const memberStatements = (qualified.results || []).map((member) => db.prepare(`
    INSERT INTO competition_school_exam_members (
      id, event_id, room_id, student_id, original_class_id,
      eligibility_snapshot_version, status, assigned_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'ASSIGNED', ?, ?)
  `).bind(
    generateId('school-exam-member'), input.eventId, id, member.student_id,
    member.original_class_id, event.eligibility_snapshot_version, now, now,
  ));

  await db.batch([
    db.prepare(`
      INSERT INTO competition_school_exam_rooms (
        id, event_id, name, room_code, scheduled_at, duration_minutes,
        check_in_lead_minutes, close_drain_minutes, form_code, quiz_id,
        quiz_snapshot_id, invigilator_ids_json, member_count, form_definition_json,
        equivalent_form_approved_by, equivalent_form_approved_at, provision_status,
        status, create_request_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'DRAFT', ?, ?, ?)
    `).bind(
      id, input.eventId, input.name, input.roomCode, input.scheduledAt, input.durationMinutes,
      input.checkInLeadMinutes, input.closeDrainMinutes, input.formCode, input.quizId,
      snapshot.id, JSON.stringify(input.invigilatorIds), studentIds.length, JSON.stringify(formDefinition),
      approvalActor, approvalAt, input.requestId, now, now,
    ),
    ...memberStatements,
    db.prepare(`
      UPDATE competition_school_exam_events
      SET status = 'DRAFT', preflight_json = NULL, preflight_at = NULL, updated_at = ?
      WHERE id = ?
    `).bind(now, input.eventId),
    auditStatement(db, {
      actorUsername,
      action: 'SCHOOL_EXAM_ROOM_CREATED',
      targetType: 'competition_school_exam_room',
      targetId: id,
      requestId: input.requestId,
      after: { memberCount: studentIds.length, warnings, quizSnapshotId: snapshot.id },
    }),
  ]);

  const createdRooms = await roomRows(db, input.eventId);
  const created = createdRooms.find((room) => room.id === id);
  if (!created) throw new Error('SCHOOL_EXAM_ROOM_PERSIST_FAILED');
  return { room: mapRoom(created), warnings };
}

export async function runSchoolExamPreflight(
  db: D1Database,
  eventId: string,
  actorUsername: string,
  requestId: string,
) {
  const event = await eventRow(db, eventId);
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  const rooms = await roomRows(db, eventId);
  if (rooms.length === 0) throw new Error('SCHOOL_EXAM_ROOMS_REQUIRED');

  let profile: CapacityProfileRow | null = null;
  if (event.capacity_profile_id) {
    profile = await db.prepare(`
      SELECT id, certified_concurrent_students FROM live_exam_capacity_profiles
      WHERE id = ? AND status = 'CERTIFIED' LIMIT 1
    `).bind(event.capacity_profile_id).first<CapacityProfileRow>();
  } else {
    profile = await db.prepare(`
      SELECT id, certified_concurrent_students FROM live_exam_capacity_profiles
      WHERE status = 'CERTIFIED' ORDER BY passed_at DESC, certified_concurrent_students DESC LIMIT 1
    `).first<CapacityProfileRow>();
  }

  const preflight = evaluateCapacityPreflight(rooms.map((room) => ({
    scheduledAt: room.scheduled_at,
    durationMinutes: Number(room.duration_minutes),
    checkInLeadMinutes: Number(room.check_in_lead_minutes),
    closeDrainMinutes: Number(room.close_drain_minutes),
    assignedStudents: Number(room.member_count),
  })), profile ? {
    id: profile.id,
    certifiedConcurrentStudents: Number(profile.certified_concurrent_students),
  } : null);

  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      UPDATE competition_school_exam_events
      SET status = ?, capacity_profile_id = ?, preflight_json = ?, preflight_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      preflight.status === 'PREFLIGHT_BLOCKED' ? 'PREFLIGHT_BLOCKED' : 'DRAFT',
      preflight.capacityProfileId,
      JSON.stringify(preflight),
      now,
      now,
      eventId,
    ),
    auditStatement(db, {
      actorUsername,
      action: 'SCHOOL_EXAM_PREFLIGHT_RUN',
      targetType: 'competition_school_exam_event',
      targetId: eventId,
      requestId,
      after: preflight,
    }),
  ]);
  return preflight;
}

function provisionErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'UNKNOWN');
  return message.slice(0, 160) || 'SCHOOL_EXAM_PROVISION_FAILED';
}

export async function provisionSchoolExam(
  db: D1Database,
  eventId: string,
  actorUsername: string,
  requestId: string,
) {
  const event = await eventRow(db, eventId);
  if (!event) throw new Error('SCHOOL_EXAM_EVENT_NOT_FOUND');
  const preflight = parseJson<{ status?: string } | null>(event.preflight_json, null);
  if (preflight?.status !== 'READY') throw new Error('SCHOOL_EXAM_PREFLIGHT_REQUIRED');

  const roomsBefore = await roomRows(db, eventId);
  if (roomsBefore.length === 0) throw new Error('SCHOOL_EXAM_ROOMS_REQUIRED');
  const candidates = roomsBefore.filter((room) => (
    !room.live_exam_session_id && ['PENDING', 'FAILED'].includes(room.provision_status)
  ));
  let provisioned = 0;
  let failed = 0;
  const failures: Array<{ roomId: string; errorCode: string }> = [];

  for (const room of candidates) {
    const liveExamId = generateLiveExamId();
    const accessCode = generateAccessCode();
    const now = new Date().toISOString();
    try {
      await db.batch([
        db.prepare(`
          INSERT INTO live_exam_sessions (
            id, title, quiz_id, teacher_id, class_id, duration, scheduled_at,
            settings, status, access_code, created_at, updated_at,
            participant_scope_type, participant_scope_id, result_visibility
          ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'scheduled', ?, ?, ?,
            'SCHOOL_EXAM_ROOM', ?, 'WITHHELD')
        `).bind(
          liveExamId,
          `${event.title} - ${room.name}`,
          room.quiz_id,
          actorUsername,
          room.duration_minutes,
          room.scheduled_at,
          JSON.stringify({ showLeaderboard: false, randomizeAnswers: false }),
          accessCode,
          now,
          now,
          room.id,
        ),
        db.prepare(`
          UPDATE competition_school_exam_rooms
          SET live_exam_session_id = ?, provision_status = 'READY', provision_error_code = NULL,
              status = 'READY', updated_at = ?
          WHERE id = ? AND live_exam_session_id IS NULL
        `).bind(liveExamId, now, room.id),
      ]);
      provisioned += 1;
    } catch (error) {
      const errorCode = provisionErrorCode(error);
      await db.prepare(`
        UPDATE competition_school_exam_rooms
        SET provision_status = 'FAILED', provision_error_code = ?, updated_at = ?
        WHERE id = ? AND live_exam_session_id IS NULL
      `).bind(errorCode, now, room.id).run();
      failed += 1;
      failures.push({ roomId: room.id, errorCode });
    }
  }

  const roomsAfter = await roomRows(db, eventId);
  const allReady = roomsAfter.length > 0 && roomsAfter.every((room) => (
    room.provision_status === 'READY' && Boolean(room.live_exam_session_id)
  ));
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE competition_school_exam_events SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(allReady ? 'READY' : 'DRAFT', now, eventId),
    auditStatement(db, {
      actorUsername,
      action: 'SCHOOL_EXAM_PROVISION_RUN',
      targetType: 'competition_school_exam_event',
      targetId: eventId,
      requestId,
      after: { provisioned, failed, skipped: roomsBefore.length - candidates.length, allReady, failures },
    }),
  ]);

  return {
    status: allReady ? 'READY' : 'PARTIAL',
    provisioned,
    failed,
    skipped: roomsBefore.length - candidates.length,
    failures,
    rooms: roomsAfter.map(mapRoom),
  };
}
