export const COMPETITION_CAMPAIGN_STATUSES = [
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
] as const;

export type CompetitionCampaignStatus = typeof COMPETITION_CAMPAIGN_STATUSES[number];

export const COMPETITION_ROUND_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'OPEN',
  'CLOSED',
  'FINALIZED',
] as const;

export type CompetitionRoundStatus = typeof COMPETITION_ROUND_STATUSES[number];

export const COMPETITION_ATTEMPT_STATUSES = [
  'STARTED',
  'SUBMITTED',
  'SCORED',
  'EXPIRED',
  'VOID',
] as const;

export type CompetitionAttemptStatus = typeof COMPETITION_ATTEMPT_STATUSES[number];

export const SCHOOL_EXAM_STATUSES = [
  'DRAFT',
  'PREFLIGHT_BLOCKED',
  'READY',
  'SCHEDULED',
  'IN_PROGRESS',
  'WITHHELD',
  'RECONCILING',
  'READY_TO_PUBLISH',
  'PUBLISHED',
] as const;

export type SchoolExamStatus = typeof SCHOOL_EXAM_STATUSES[number];

export const COMPETITION_EXPORT_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
] as const;

export type CompetitionExportStatus = typeof COMPETITION_EXPORT_STATUSES[number];

export const LIVE_EXAM_PARTICIPANT_SCOPE_TYPES = [
  'CLASS',
  'SCHOOL_EXAM_ROOM',
] as const;

export type LiveExamParticipantScopeType = typeof LIVE_EXAM_PARTICIPANT_SCOPE_TYPES[number];

export const COMPETITION_ELIGIBILITY_REASON_CODES = [
  'QUALIFIED',
  'ROUND_1_NOT_PASSED',
  'ROUND_2_NOT_PASSED',
  'ROUND_3_NOT_PASSED',
  'ROUND_4_NOT_PASSED',
  'ROUND_5_NOT_PASSED',
  'ROUND_6_NOT_PASSED',
  'ONLY_5_OF_6_ROUNDS_PASSED',
  'NOT_IN_AUDIENCE',
  'ADMINISTRATIVE_BLOCK',
] as const;

export type CompetitionEligibilityReasonCode = typeof COMPETITION_ELIGIBILITY_REASON_CODES[number];

export const COMPETITION_RANKING_POLICIES = ['SCORE_CORRECT_TIME'] as const;
export type CompetitionRankingPolicy = typeof COMPETITION_RANKING_POLICIES[number];

export const COMPETITION_EXAM_FORM_POLICIES = [
  'SAME_FORM',
  'EQUIVALENT_FORM_SET',
] as const;

export type CompetitionExamFormPolicy = typeof COMPETITION_EXAM_FORM_POLICIES[number];
