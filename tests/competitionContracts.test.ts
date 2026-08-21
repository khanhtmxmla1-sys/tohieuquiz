import { describe, expect, it } from 'vitest';
import {
  COMPETITION_ATTEMPT_STATUSES,
  COMPETITION_CAMPAIGN_STATUSES,
  COMPETITION_EXPORT_STATUSES,
  COMPETITION_ROUND_STATUSES,
  LIVE_EXAM_PARTICIPANT_SCOPE_TYPES,
  SCHOOL_EXAM_STATUSES,
} from '../shared/competition.contract';
import {
  CompetitionAttemptStatusSchema,
  CompetitionCampaignStatusSchema,
  CompetitionExportStatusSchema,
  CompetitionRoundStatusSchema,
  CreateCompetitionCampaignRequestSchema,
  CreateCompetitionExportRequestSchema,
  CreateSchoolExamEventRequestSchema,
  CreateSchoolExamRoomRequestSchema,
  FinalizeCompetitionEligibilityRequestSchema,
  FinalizeCompetitionRoundRequestSchema,
  LiveExamParticipantScopeTypeSchema,
  PublishCompetitionResultsRequestSchema,
  RunSchoolExamPreflightRequestSchema,
  SchoolExamStatusSchema,
  StartCompetitionReconcileRequestSchema,
  StartCompetitionRoundAttemptRequestSchema,
  SubmitCompetitionRoundAttemptRequestSchema,
  UpdateCompetitionRoundRequestSchema,
} from '../schemas/competition.schema';

const requestId = 'req_competition_123456';
const idempotencyKey = 'idem_competition_123456';

describe('Competition V1 contracts', () => {
  it('locks the approved state-machine values', () => {
    expect(COMPETITION_CAMPAIGN_STATUSES).toEqual([
      'DRAFT',
      'SCHEDULED',
      'ACTIVE',
      'ELIGIBILITY_LOCKED',
      'EXAM_PREP',
      'EXAM_RUNNING',
      'WITHHELD',
      'RECONCILING',
      'READY_TO_PUBLISH',
      'PUBLISHED',
      'ARCHIVED',
    ]);
    expect(COMPETITION_ROUND_STATUSES).toEqual([
      'DRAFT',
      'SCHEDULED',
      'OPEN',
      'CLOSED',
      'FINALIZED',
    ]);
    expect(COMPETITION_ATTEMPT_STATUSES).toEqual([
      'STARTED',
      'SUBMITTED',
      'SCORED',
      'EXPIRED',
      'VOID',
    ]);
    expect(SCHOOL_EXAM_STATUSES).toEqual([
      'DRAFT',
      'PREFLIGHT_BLOCKED',
      'READY',
      'SCHEDULED',
      'IN_PROGRESS',
      'WITHHELD',
      'RECONCILING',
      'READY_TO_PUBLISH',
      'PUBLISHED',
    ]);
    expect(COMPETITION_EXPORT_STATUSES).toEqual([
      'QUEUED',
      'PROCESSING',
      'READY',
      'FAILED',
    ]);
    expect(LIVE_EXAM_PARTICIPANT_SCOPE_TYPES).toEqual([
      'CLASS',
      'SCHOOL_EXAM_ROOM',
    ]);

    for (const status of COMPETITION_CAMPAIGN_STATUSES) {
      expect(CompetitionCampaignStatusSchema.parse(status)).toBe(status);
    }
    for (const status of COMPETITION_ROUND_STATUSES) {
      expect(CompetitionRoundStatusSchema.parse(status)).toBe(status);
    }
    for (const status of COMPETITION_ATTEMPT_STATUSES) {
      expect(CompetitionAttemptStatusSchema.parse(status)).toBe(status);
    }
    for (const status of SCHOOL_EXAM_STATUSES) {
      expect(SchoolExamStatusSchema.parse(status)).toBe(status);
    }
    for (const status of COMPETITION_EXPORT_STATUSES) {
      expect(CompetitionExportStatusSchema.parse(status)).toBe(status);
    }
    for (const scope of LIVE_EXAM_PARTICIPANT_SCOPE_TYPES) {
      expect(LiveExamParticipantScopeTypeSchema.parse(scope)).toBe(scope);
    }

    expect(CompetitionCampaignStatusSchema.safeParse('OPEN').success).toBe(false);
    expect(SchoolExamStatusSchema.safeParse('CLOSED').success).toBe(false);
  });

  it('validates campaign creation with server-scheduling and eligibility policy inputs', () => {
    const valid = {
      title: 'Trạng Nguyên Tiếng Việt 2026-2027',
      schoolYear: '2026-2027',
      timezone: 'Asia/Ho_Chi_Minh',
      audienceRule: { gradeLevels: [1, 2, 3, 4, 5] },
      eligibilityPolicy: { requiredRounds: 6, requiredPassedRounds: 6 },
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2027-05-31T23:59:59.000Z',
      requestId,
    };

    expect(CreateCompetitionCampaignRequestSchema.safeParse(valid).success).toBe(true);
    expect(CreateCompetitionCampaignRequestSchema.safeParse({ ...valid, requestId: undefined }).success).toBe(false);
    expect(CreateCompetitionCampaignRequestSchema.safeParse({ ...valid, endsAt: valid.startsAt }).success).toBe(false);
  });

  it('enforces six-round configuration bounds and mutation request IDs', () => {
    const valid = {
      campaignId: 'campaign-1',
      roundId: 'round-1',
      roundNumber: 1,
      opensAt: '2026-09-01T00:00:00.000Z',
      closesAt: '2026-09-08T00:00:00.000Z',
      maxAttempts: 3,
      passingRuleType: 'MIN_SCORE',
      passingScore: 80,
      requestId,
    };

    expect(UpdateCompetitionRoundRequestSchema.safeParse(valid).success).toBe(true);
    expect(UpdateCompetitionRoundRequestSchema.safeParse({ ...valid, roundNumber: 7 }).success).toBe(false);
    expect(UpdateCompetitionRoundRequestSchema.safeParse({ ...valid, maxAttempts: 0 }).success).toBe(false);
    expect(UpdateCompetitionRoundRequestSchema.safeParse({ ...valid, closesAt: valid.opensAt }).success).toBe(false);
    expect(FinalizeCompetitionRoundRequestSchema.safeParse({ campaignId: 'campaign-1', roundId: 'round-1', requestId }).success).toBe(true);
    expect(FinalizeCompetitionRoundRequestSchema.safeParse({ campaignId: 'campaign-1', roundId: 'round-1' }).success).toBe(false);
  });

  it('never accepts an authoritative studentId in student attempt mutation bodies', () => {
    const start = {
      campaignId: 'campaign-1',
      roundId: 'round-1',
      requestId,
    };
    expect(StartCompetitionRoundAttemptRequestSchema.safeParse(start).success).toBe(true);
    expect(StartCompetitionRoundAttemptRequestSchema.safeParse({ ...start, studentId: 'student-other' }).success).toBe(false);

    const submit = {
      attemptId: 'attempt-1',
      answers: { q1: 'A', q2: ['B', 'C'] },
      timeTaken: 93,
      idempotencyKey,
    };
    expect(SubmitCompetitionRoundAttemptRequestSchema.safeParse(submit).success).toBe(true);
    expect(SubmitCompetitionRoundAttemptRequestSchema.safeParse({ ...submit, studentId: 'student-other' }).success).toBe(false);
    expect(SubmitCompetitionRoundAttemptRequestSchema.safeParse({ ...submit, idempotencyKey: undefined }).success).toBe(false);
  });

  it('requires replay-protection keys across eligibility and school-exam mutations', () => {
    const eligibility = { campaignId: 'campaign-1', requestId };
    expect(FinalizeCompetitionEligibilityRequestSchema.safeParse(eligibility).success).toBe(true);
    expect(FinalizeCompetitionEligibilityRequestSchema.safeParse({ campaignId: 'campaign-1' }).success).toBe(false);

    const event = {
      campaignId: 'campaign-1',
      eligibilitySnapshotVersion: 1,
      title: 'Thi cấp trường - Khối 4',
      examDate: '2027-04-15T00:00:00.000Z',
      rankingPolicy: 'SCORE_CORRECT_TIME',
      examFormPolicy: 'EQUIVALENT_FORM_SET',
      requestId,
    };
    expect(CreateSchoolExamEventRequestSchema.safeParse(event).success).toBe(true);
    expect(CreateSchoolExamEventRequestSchema.safeParse({ ...event, requestId: undefined }).success).toBe(false);

    const room = {
      eventId: 'event-1',
      name: 'Phòng 01',
      roomCode: 'P01',
      scheduledAt: '2027-04-15T01:00:00.000Z',
      durationMinutes: 60,
      checkInLeadMinutes: 15,
      closeDrainMinutes: 10,
      formCode: 'A',
      quizId: 'quiz-1',
      invigilatorIds: ['teacher-1'],
      studentIds: ['student-1'],
      formDefinition: {
        blueprintId: 'tv4-school-v1',
        durationMinutes: 60,
        totalScore: 10,
        difficulty: 'MEDIUM',
        gradeLevel: 4,
        objectiveIds: ['obj-1'],
      },
      requestId,
    };
    expect(CreateSchoolExamRoomRequestSchema.safeParse(room).success).toBe(true);
    expect(CreateSchoolExamRoomRequestSchema.safeParse({ ...room, durationMinutes: 0 }).success).toBe(false);

    expect(RunSchoolExamPreflightRequestSchema.safeParse({ eventId: 'event-1', requestId }).success).toBe(true);
    expect(RunSchoolExamPreflightRequestSchema.safeParse({ eventId: 'event-1' }).success).toBe(false);
  });

  it('requires replay-protection for reconcile, publish, and async export requests', () => {
    expect(StartCompetitionReconcileRequestSchema.safeParse({ eventId: 'event-1', requestId }).success).toBe(true);
    expect(StartCompetitionReconcileRequestSchema.safeParse({ eventId: 'event-1' }).success).toBe(false);

    expect(PublishCompetitionResultsRequestSchema.safeParse({ eventId: 'event-1', requestId }).success).toBe(true);
    expect(PublishCompetitionResultsRequestSchema.safeParse({ eventId: 'event-1' }).success).toBe(false);

    const adminExport = { eventId: 'event-1', scope: 'SCHOOL', requestId };
    const teacherExport = { eventId: 'event-1', scope: 'CLASS', classId: 'class-4a', requestId };
    expect(CreateCompetitionExportRequestSchema.safeParse(adminExport).success).toBe(true);
    expect(CreateCompetitionExportRequestSchema.safeParse(teacherExport).success).toBe(true);
    expect(CreateCompetitionExportRequestSchema.safeParse({ eventId: 'event-1', scope: 'CLASS', requestId }).success).toBe(false);
    expect(CreateCompetitionExportRequestSchema.safeParse({ ...adminExport, requestId: undefined }).success).toBe(false);
  });
});
