import { StudentCompetitionPortalDtoSchema } from '../../../schemas/competitionPortal.schema';
import { JoinLiveExamRequestSchema } from '../../../schemas/liveExam.schema';
import type {
  CompetitionPublicState,
  CompetitionRoundPresentationState,
  StudentCompetitionPortalDto,
} from '../../../shared/competition-portal.contract';
import {
  getStudentCompetition,
  listStudentCompetitions,
} from './studentCompetitionService';
import { evaluateRoundEntry } from './roundService';
import type {
  CompetitionEntryPreflightDto,
  CompetitionEntryPreflightReason,
  CompetitionEntryPreflightWindowDto,
} from '../../../shared/competition-portal.contract';

export const STUDENT_COMPETITION_PORTAL_NOT_FOUND = 'COMPETITION_STUDENT_PORTAL_NOT_FOUND';
export const STUDENT_COMPETITION_PORTAL_UNAVAILABLE = 'COMPETITION_STUDENT_PORTAL_UNAVAILABLE';

interface StudentPortalPageRow {
  campaign_id: string;
  slug: string;
}

export type StudentCompetitionPortalCompetition = Awaited<ReturnType<typeof getStudentCompetition>>;

export interface StudentCompetitionPortalResolution {
  competition: StudentCompetitionPortalCompetition;
  portal: StudentCompetitionPortalDto;
}

export async function preflightStudentCompetitionRound(
  db: D1Database,
  campaignId: string,
  roundId: string,
  studentId: string,
  now = new Date(),
): Promise<CompetitionEntryPreflightDto> {
  return (await evaluateRoundEntry(db, { campaignId, roundId, studentId }, now)).preflight;
}

export type StudentSchoolExamPreflightDto =
  | {
    status: 'READY';
    campaignId: string;
    title: string;
    roomName: string;
    scheduledAt: string;
    serverTime: string;
    window: CompetitionEntryPreflightWindowDto;
    accessCode: string;
  }
  | {
    status: 'BLOCKED';
    campaignId: string;
    reason: CompetitionEntryPreflightReason;
    serverTime: string;
    window: CompetitionEntryPreflightWindowDto | null;
  };

interface SchoolExamCampaignRow {
  id: string;
  timezone: string;
  status: string;
}

interface StudentSchoolExamEventRow {
  id: string;
  eligibility_snapshot_version: number;
  title: string;
  capacity_profile_id: string | null;
  preflight_json: string | null;
}

interface StudentSchoolExamRoomRow {
  id: string;
  eligibility_snapshot_version: number;
  name: string;
  scheduled_at: string;
  duration_minutes: number;
  check_in_lead_minutes: number;
  close_drain_minutes: number;
  live_exam_session_id: string | null;
  provision_status: string;
  status: string;
}

interface StudentSchoolExamSessionRow {
  status: string;
  access_code: string;
  settings: string;
  participant_scope_type: string;
  participant_scope_id: string | null;
  result_visibility: string;
}

function schoolExamWindow(
  room: StudentSchoolExamRoomRow,
  timezone: string,
): CompetitionEntryPreflightWindowDto {
  const scheduledAt = Date.parse(room.scheduled_at);
  return {
    opensAt: new Date(scheduledAt - (Number(room.check_in_lead_minutes) * 60_000)).toISOString(),
    closesAt: new Date(
      scheduledAt + ((Number(room.duration_minutes) + Number(room.close_drain_minutes)) * 60_000),
    ).toISOString(),
    timezone,
  };
}

function blockedSchoolExamPreflight(
  campaignId: string,
  reason: CompetitionEntryPreflightReason,
  now: Date,
  window: CompetitionEntryPreflightWindowDto | null = null,
): StudentSchoolExamPreflightDto {
  return { status: 'BLOCKED', campaignId, reason, serverTime: now.toISOString(), window };
}

function hasCertifiedCapacityPreflight(event: StudentSchoolExamEventRow): boolean {
  try {
    const value = event.preflight_json ? JSON.parse(event.preflight_json) as Record<string, unknown> : null;
    return Boolean(
      value
      && value.status === 'READY'
      && typeof value.capacityProfileId === 'string'
      && value.capacityProfileId.length > 0
      && value.capacityProfileId === event.capacity_profile_id
      && Number(value.certifiedConcurrentStudents) > 0,
    );
  } catch {
    return false;
  }
}

function liveExamSessionPermitsJoin(session: StudentSchoolExamSessionRow): boolean {
  if (session.status === 'waiting') return true;
  if (session.status !== 'active') return false;
  try {
    const settings = session.settings ? JSON.parse(session.settings) as { allowLateJoin?: unknown } : {};
    return settings.allowLateJoin === true;
  } catch {
    return false;
  }
}

export async function preflightStudentCompetitionSchoolExam(
  db: D1Database,
  campaignId: string,
  studentId: string,
  now = new Date(),
): Promise<StudentSchoolExamPreflightDto> {
  const campaign = await db.prepare(`
    SELECT id, timezone, status
    FROM competition_campaigns
    WHERE id = ?
    LIMIT 1
  `).bind(campaignId).first<SchoolExamCampaignRow>();
  if (!campaign || !['EXAM_PREP', 'EXAM_RUNNING'].includes(campaign.status)) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_EVENT_NOT_READY', now);
  }

  const event = await db.prepare(`
    SELECT id, eligibility_snapshot_version, title, capacity_profile_id, preflight_json
    FROM competition_school_exam_events
    WHERE campaign_id = ?
      AND status IN ('READY', 'SCHEDULED', 'IN_PROGRESS')
    ORDER BY
      CASE status WHEN 'IN_PROGRESS' THEN 0 WHEN 'SCHEDULED' THEN 1 ELSE 2 END,
      exam_date DESC,
      created_at DESC,
      id DESC
    LIMIT 1
  `).bind(campaignId).first<StudentSchoolExamEventRow>();
  if (!event) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_EVENT_NOT_READY', now);
  }

  const eligibility = await db.prepare(`
    SELECT qualified
    FROM competition_eligibility
    WHERE campaign_id = ?
      AND eligibility_snapshot_version = ?
      AND student_id = ?
    LIMIT 1
  `).bind(campaignId, event.eligibility_snapshot_version, studentId).first<{ qualified: number }>();
  if (!eligibility || Number(eligibility.qualified) !== 1) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_NOT_QUALIFIED', now);
  }

  const room = await db.prepare(`
    SELECT rooms.id, members.eligibility_snapshot_version, rooms.name, rooms.scheduled_at,
           rooms.duration_minutes, rooms.check_in_lead_minutes, rooms.close_drain_minutes,
           rooms.live_exam_session_id, rooms.provision_status, rooms.status
    FROM competition_school_exam_members AS members
    JOIN competition_school_exam_rooms AS rooms
      ON rooms.id = members.room_id AND rooms.event_id = members.event_id
    WHERE members.event_id = ?
      AND members.student_id = ?
      AND members.status IN ('ASSIGNED', 'CHECKED_IN', 'STARTED')
    LIMIT 1
  `).bind(event.id, studentId).first<StudentSchoolExamRoomRow>();
  if (!room || Number(room.eligibility_snapshot_version) !== Number(event.eligibility_snapshot_version)) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_MEMBER_NOT_READY', now);
  }

  const window = schoolExamWindow(room, campaign.timezone);
  const nowMs = now.getTime();
  if (nowMs < Date.parse(window.opensAt)) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_WINDOW_NOT_OPEN', now, window);
  }
  if (nowMs >= Date.parse(window.closesAt)) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_WINDOW_CLOSED', now, window);
  }

  if (!hasCertifiedCapacityPreflight(event)) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_CAPACITY_NOT_CERTIFIED', now, window);
  }

  if (room.provision_status !== 'READY' || !room.live_exam_session_id) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_SESSION_NOT_PROVISIONED', now, window);
  }

  const session = await db.prepare(`
    SELECT status, access_code, settings, participant_scope_type, participant_scope_id, result_visibility
    FROM live_exam_sessions
    WHERE id = ?
    LIMIT 1
  `).bind(room.live_exam_session_id).first<StudentSchoolExamSessionRow>();
  if (!session) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_SESSION_NOT_PROVISIONED', now, window);
  }
  if (
    session.participant_scope_type !== 'SCHOOL_EXAM_ROOM'
    || session.participant_scope_id !== room.id
    || session.result_visibility !== 'WITHHELD'
  ) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_PARTICIPANT_SCOPE_MISMATCH', now, window);
  }
  if (!['READY', 'SCHEDULED', 'IN_PROGRESS'].includes(room.status) || !liveExamSessionPermitsJoin(session)) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_ROOM_NOT_READY', now, window);
  }

  const accessCode = String(session.access_code || '').trim();
  if (!JoinLiveExamRequestSchema.shape.accessCode.safeParse(accessCode).success) {
    return blockedSchoolExamPreflight(campaignId, 'SCHOOL_EXAM_ACCESS_CODE_INVALID', now, window);
  }

  return {
    status: 'READY',
    campaignId,
    title: event.title,
    roomName: room.name,
    scheduledAt: room.scheduled_at,
    serverTime: now.toISOString(),
    window,
    accessCode,
  };
}

function normalizedSlug(value: string): string {
  const slug = String(value || '').trim();
  if (!slug || slug.includes('/')) throw new Error(STUDENT_COMPETITION_PORTAL_NOT_FOUND);
  return slug;
}

function campaignPublicState(startsAt: string, endsAt: string, now: Date): CompetitionPublicState {
  const timestamp = now.getTime();
  if (timestamp < Date.parse(startsAt)) return 'UPCOMING';
  if (timestamp >= Date.parse(endsAt)) return 'ENDED';
  return 'ONGOING';
}

function roundPresentationState(
  round: StudentCompetitionPortalCompetition['rounds'][number],
): CompetitionRoundPresentationState {
  if (round.isPassed) return 'PASSED';
  if (round.status === 'OPEN') {
    if (round.attemptsUsed >= round.maxAttempts) return 'CLOSED';
    if (round.attemptsUsed > 0) return 'FAILED_RETRY_AVAILABLE';
    return 'OPEN';
  }
  if (round.status === 'CLOSED' || round.status === 'FINALIZED') return 'CLOSED';
  return 'LOCKED';
}

export async function resolveStudentCompetitionBySlug(
  db: D1Database,
  campaignSlugInput: string,
  studentId: string,
  now = new Date(),
): Promise<StudentCompetitionPortalResolution> {
  const campaignSlug = normalizedSlug(campaignSlugInput);

  // Keep ownership semantics canonical: the existing student list is the membership projection.
  const ownedCampaigns = await listStudentCompetitions(db, studentId);
  const page = await db.prepare(`
    SELECT campaign_id, slug
    FROM competition_public_pages
    WHERE slug = ?
    LIMIT 1
  `).bind(campaignSlug).first<StudentPortalPageRow>();

  if (!page || !ownedCampaigns.some((campaign) => campaign.id === page.campaign_id)) {
    throw new Error(STUDENT_COMPETITION_PORTAL_NOT_FOUND);
  }

  let competition: StudentCompetitionPortalCompetition;
  try {
    competition = await getStudentCompetition(db, page.campaign_id, studentId);
  } catch (error) {
    if (error instanceof Error && error.message === 'COMPETITION_STUDENT_NOT_IN_AUDIENCE') {
      throw new Error(STUDENT_COMPETITION_PORTAL_NOT_FOUND);
    }
    throw error;
  }

  const portalCandidate = {
    campaignId: competition.id,
    slug: page.slug,
    title: competition.title,
    schoolYear: competition.schoolYear,
    publicState: campaignPublicState(competition.startsAt, competition.endsAt, now),
    rounds: competition.rounds.map((round) => ({
      roundId: round.id,
      roundNumber: round.roundNumber,
      title: `Vòng ${round.roundNumber}`,
      opensAt: round.opensAt,
      closesAt: round.closesAt,
      state: roundPresentationState(round),
      attemptCount: round.attemptsUsed,
      maxAttempts: round.maxAttempts,
    })),
  };
  const parsed = StudentCompetitionPortalDtoSchema.safeParse(portalCandidate);
  if (!parsed.success) throw new Error('COMPETITION_STUDENT_PORTAL_PROJECTION_INVALID');

  return { competition, portal: parsed.data };
}
