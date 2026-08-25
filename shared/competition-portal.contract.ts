export const COMPETITION_PUBLIC_PAGE_STATUSES = ['DRAFT', 'PREVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
export type CompetitionPublicPageStatus = typeof COMPETITION_PUBLIC_PAGE_STATUSES[number];

export const COMPETITION_ARTICLE_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type CompetitionArticleStatus = typeof COMPETITION_ARTICLE_STATUSES[number];

export const COMPETITION_ARTICLE_TYPES = [
  'ANNOUNCEMENT',
  'GUIDE',
  'RULES',
  'SCHEDULE',
  'RESULT',
  'AWARD',
  'CERTIFICATE',
  'INCIDENT_NOTICE',
] as const;
export type CompetitionArticleType = typeof COMPETITION_ARTICLE_TYPES[number];

export const COMPETITION_AWARD_RULE_SCOPES = ['EVENT', 'GRADE'] as const;
export type CompetitionAwardRuleScope = typeof COMPETITION_AWARD_RULE_SCOPES[number];

export const COMPETITION_AWARD_RULE_VERSION_STATUSES = ['DRAFT', 'ACTIVE', 'RETIRED'] as const;
export type CompetitionAwardRuleVersionStatus = typeof COMPETITION_AWARD_RULE_VERSION_STATUSES[number];

export const COMPETITION_GOLDEN_BOARD_DISPLAY_MODES = ['AWARD_WINNERS'] as const;
export type CompetitionGoldenBoardDisplayMode = typeof COMPETITION_GOLDEN_BOARD_DISPLAY_MODES[number];

export const COMPETITION_PUBLIC_STATES = ['UPCOMING', 'ONGOING', 'ENDED'] as const;
export type CompetitionPublicState = typeof COMPETITION_PUBLIC_STATES[number];

export const COMPETITION_ROUND_PRESENTATION_STATES = [
  'LOCKED',
  'OPEN',
  'PASSED',
  'FAILED_RETRY_AVAILABLE',
  'CLOSED',
] as const;
export type CompetitionRoundPresentationState = typeof COMPETITION_ROUND_PRESENTATION_STATES[number];

export const COMPETITION_ENTRY_PREFLIGHT_STATUSES = ['READY', 'BLOCKED'] as const;
export type CompetitionEntryPreflightStatus = typeof COMPETITION_ENTRY_PREFLIGHT_STATUSES[number];

export const COMPETITION_ENTRY_PREFLIGHT_REASONS = [
  'NOT_IN_AUDIENCE',
  'ROUND_CAMPAIGN_MISMATCH',
  'ROUND_NOT_OPEN',
  'PREREQUISITE_NOT_MET',
  'ELIGIBILITY_BLOCKED',
  'ATTEMPT_LIMIT_REACHED',
  'QUIZ_MAPPING_UNAVAILABLE',
  'SCHOOL_EXAM_NOT_QUALIFIED',
  'SCHOOL_EXAM_EVENT_NOT_READY',
  'SCHOOL_EXAM_MEMBER_NOT_READY',
  'SCHOOL_EXAM_ROOM_NOT_READY',
  'SCHOOL_EXAM_WINDOW_NOT_OPEN',
  'SCHOOL_EXAM_WINDOW_CLOSED',
  'SCHOOL_EXAM_CAPACITY_NOT_CERTIFIED',
  'SCHOOL_EXAM_SESSION_NOT_PROVISIONED',
  'SCHOOL_EXAM_PARTICIPANT_SCOPE_MISMATCH',
  'SCHOOL_EXAM_ACCESS_CODE_INVALID',
  'SCHOOL_EXAM_CANDIDATE_CODE_INVALID',
] as const;
export type CompetitionEntryPreflightReason = typeof COMPETITION_ENTRY_PREFLIGHT_REASONS[number];

export interface PublicCompetitionHeroDto {
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

export interface PublicCompetitionCtaDto {
  label: string;
}

export interface PublicCompetitionSummaryDto {
  slug: string;
  title: string;
  summary: string;
  schoolYear: string;
  publicState: CompetitionPublicState;
  startsAt: string;
  endsAt: string;
  timezone: string;
  hero: PublicCompetitionHeroDto;
  cta: PublicCompetitionCtaDto;
  rounds: PublicCompetitionRoundDto[];
  articleSummaryAvailable: boolean;
}

export interface PublicCompetitionRoundDto {
  roundNumber: number;
  title: string;
  opensAt: string;
  closesAt: string;
  state: CompetitionRoundPresentationState;
}

export interface PublicCompetitionDetailDto extends PublicCompetitionSummaryDto {
  articles: PublicCompetitionArticleDto[];
}

export interface PublicCompetitionArticleDto {
  slug: string;
  title: string;
  summary: string;
  coverImageUrl?: string;
  content: string;
  type: CompetitionArticleType;
  publishedAt: string;
}

export interface PublicGoldenBoardWinnerDto {
  fullName: string;
  className: string;
  schoolName: string;
  gradeLevel: number;
  awardCode: string;
  awardLabel: string;
}

export interface PublicGoldenBoardDto {
  winners: PublicGoldenBoardWinnerDto[];
  publicationVersion: number;
  rankingVersion: number;
  awardRuleVersion: number;
  publishedAt: string;
}

export interface StudentCompetitionRoundDto extends PublicCompetitionRoundDto {
  roundId: string;
  attemptCount: number;
  maxAttempts: number;
}

export interface StudentSchoolExamPortalDto {
  qualified: boolean;
  eventId: string;
  scheduledAt: string;
  roomName: string;
  ready: boolean;
}

export interface StudentCompetitionPortalDto {
  campaignId: string;
  slug: string;
  title: string;
  schoolYear: string;
  publicState: CompetitionPublicState;
  rounds: StudentCompetitionRoundDto[];
  schoolExam?: StudentSchoolExamPortalDto;
}

export type CompetitionEntryPreflightDto =
  | {
    status: 'READY';
    campaignId: string;
    roundId: string;
    quizId: string;
  }
  | {
    status: 'BLOCKED';
    campaignId: string;
    roundId: string;
    reason: CompetitionEntryPreflightReason;
  };

export interface StaffCompetitionPublicPageDto {
  id: string;
  campaignId: string;
  slug: string;
  status: CompetitionPublicPageStatus;
  heroTitle: string;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  summary: string | null;
  ctaLabel: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export interface StaffCompetitionArticleDto {
  id: string;
  campaignId: string;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  content: string;
  type: CompetitionArticleType;
  status: CompetitionArticleStatus;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

interface StaffCompetitionGoldenBoardConfigBaseDto {
  id: string;
  campaignId: string;
  displayMode: CompetitionGoldenBoardDisplayMode;
  title: string;
  updatedBy: string;
  updatedAt: string;
}

export type StaffCompetitionGoldenBoardConfigDto = StaffCompetitionGoldenBoardConfigBaseDto & (
  | {
    enabled: false;
    sourceEventId: string | null;
    awardRuleVersion: number | null;
  }
  | {
    enabled: true;
    sourceEventId: string;
    awardRuleVersion: number;
  }
);

interface StaffCompetitionAwardRuleBaseDto {
  id: string;
  rankFrom: number;
  rankTo: number;
  awardCode: string;
  awardLabel: string;
  sortOrder: number;
}

export type StaffCompetitionAwardRuleDto = StaffCompetitionAwardRuleBaseDto & (
  | {
    scope: 'EVENT';
    gradeLevel?: never;
  }
  | {
    scope: 'GRADE';
    gradeLevel: number;
  }
);

export interface StaffCompetitionAwardRuleVersionDto {
  id: string;
  campaignId: string;
  version: number;
  status: CompetitionAwardRuleVersionStatus;
  activatedAt: string | null;
  rules: StaffCompetitionAwardRuleDto[];
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}
