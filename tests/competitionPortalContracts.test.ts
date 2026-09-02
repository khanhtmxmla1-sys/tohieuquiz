import { describe, expect, it } from 'vitest';
import * as schemaBarrel from '../schemas';
import {
  COMPETITION_ARTICLE_STATUSES,
  COMPETITION_ARTICLE_TYPES,
  COMPETITION_AWARD_RULE_SCOPES,
  COMPETITION_AWARD_RULE_VERSION_STATUSES,
  COMPETITION_ENTRY_PREFLIGHT_REASONS,
  COMPETITION_ENTRY_PREFLIGHT_STATUSES,
  COMPETITION_GOLDEN_BOARD_DISPLAY_MODES,
  COMPETITION_PUBLIC_PAGE_STATUSES,
  COMPETITION_PUBLIC_STATES,
  COMPETITION_ROUND_PRESENTATION_STATES,
} from '../shared/competition-portal.contract';
import type {
  StaffCompetitionAwardRuleDto,
  StaffCompetitionGoldenBoardConfigDto,
} from '../shared/competition-portal.contract';
import {
  ActivateCompetitionAwardRuleVersionRequestSchema,
  CompetitionEntryPreflightReasonSchema,
  CompetitionEntryPreflightDtoSchema,
  CreateCompetitionArticleRequestSchema,
  CreateCompetitionAwardRuleVersionRequestSchema,
  PublicCompetitionArticleDtoSchema,
  PublicCompetitionDetailDtoSchema,
  PublicCompetitionSummaryDtoSchema,
  PublicGoldenBoardDtoSchema,
  PublicGoldenBoardWinnerDtoSchema,
  StaffCompetitionArticleDtoSchema,
  StaffCompetitionAwardRuleDtoSchema,
  StaffCompetitionAwardRuleVersionDtoSchema,
  StaffCompetitionGoldenBoardConfigDtoSchema,
  StaffCompetitionPublicPageDtoSchema,
  StudentCompetitionEntryPreflightRequestSchema,
  StudentCompetitionPortalDtoSchema,
  UpdateCompetitionArticleRequestSchema,
  UpdateCompetitionGoldenBoardConfigRequestSchema,
  UpdateCompetitionPublicPageRequestSchema,
} from '../schemas/competitionPortal.schema';
import type { CreateCompetitionAwardRuleVersionRequest } from '../schemas/competitionPortal.schema';

const requestId = 'req_competition_portal_123456';
const now = '2026-09-01T00:00:00.000Z';
const later = '2027-05-31T23:59:59.000Z';

const awardRuleFields = {
  rankFrom: 1,
  rankTo: 3,
  awardCode: 'GOLD',
  awardLabel: 'Giải Nhất',
  sortOrder: 0,
};

// @ts-expect-error GRADE award rules require a grade level.
const invalidGradeAwardRule: StaffCompetitionAwardRuleDto = { id: 'rule-1', scope: 'GRADE', ...awardRuleFields };
// @ts-expect-error EVENT award rules must not carry a grade level.
const invalidEventAwardRule: StaffCompetitionAwardRuleDto = {
  id: 'rule-1', scope: 'EVENT', gradeLevel: 5, ...awardRuleFields,
};
const invalidAwardRuleRequest: CreateCompetitionAwardRuleVersionRequest = {
  // @ts-expect-error The inferred create request must preserve the GRADE discriminator.
  campaignId: 'campaign-1', rules: [{ scope: 'GRADE', ...awardRuleFields }], requestId,
};

const goldenBoardFields = {
  id: 'board-1',
  campaignId: 'campaign-1',
  displayMode: 'AWARD_WINNERS' as const,
  title: 'Bảng vàng',
  updatedBy: 'staff-1',
  updatedAt: now,
};

// @ts-expect-error Enabled Golden Boards require a source event.
const invalidEnabledBoardSource: StaffCompetitionGoldenBoardConfigDto = {
  ...goldenBoardFields, enabled: true, sourceEventId: null, awardRuleVersion: 1,
};
// @ts-expect-error Enabled Golden Boards require an award-rule version.
const invalidEnabledBoardVersion: StaffCompetitionGoldenBoardConfigDto = {
  ...goldenBoardFields, enabled: true, sourceEventId: 'event-1', awardRuleVersion: null,
};

type EnabledGoldenBoardState = Extract<StaffCompetitionGoldenBoardConfigDto, { enabled: true }>;
const enabledGoldenBoardStateIsDiscriminated: [EnabledGoldenBoardState] extends [never] ? false : true = true;

void [
  invalidGradeAwardRule,
  invalidEventAwardRule,
  invalidAwardRuleRequest,
  invalidEnabledBoardSource,
  invalidEnabledBoardVersion,
  enabledGoldenBoardStateIsDiscriminated,
];

const article = {
  slug: 'the-le-cuoc-thi',
  title: 'Thể lệ cuộc thi',
  summary: 'Thông tin thể lệ dành cho học sinh.',
  coverImageUrl: 'https://example.edu/rules.jpg',
  content: 'Nội dung thể lệ.',
  type: 'RULES' as const,
  publishedAt: now,
};

const round = {
  roundNumber: 1,
  title: 'Vòng 1',
  state: 'OPEN' as const,
  opensAt: now,
  closesAt: later,
};

const summary = {
  slug: 'san-choi-tri-tue-2026-2027',
  title: 'Sân chơi trí tuệ',
  summary: 'Sáu vòng thi dành cho học sinh.',
  schoolYear: '2026-2027',
  publicState: 'ONGOING' as const,
  startsAt: now,
  endsAt: later,
  timezone: 'Asia/Ho_Chi_Minh',
  hero: {
    title: 'Sân chơi trí tuệ',
    subtitle: 'Cùng học, cùng vui',
    imageUrl: 'https://example.edu/hero.jpg',
  },
  cta: { label: 'VÀO THI' },
  rounds: Array.from({ length: 6 }, (_, index) => ({
    ...round,
    roundNumber: index + 1,
    title: `Vòng ${index + 1}`,
  })),
  articleSummaryAvailable: true,
  goldenBoardAvailable: true,
};

describe('Competition portal contracts', () => {
  it('locks every portal enum and the five round presentation states', () => {
    expect(COMPETITION_PUBLIC_PAGE_STATUSES).toEqual(['DRAFT', 'PREVIEW', 'PUBLISHED', 'ARCHIVED']);
    expect(COMPETITION_ARTICLE_STATUSES).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
    expect(COMPETITION_ARTICLE_TYPES).toEqual([
      'ANNOUNCEMENT', 'GUIDE', 'RULES', 'SCHEDULE', 'RESULT', 'AWARD',
      'CERTIFICATE', 'INCIDENT_NOTICE',
    ]);
    expect(COMPETITION_AWARD_RULE_SCOPES).toEqual(['EVENT', 'GRADE']);
    expect(COMPETITION_AWARD_RULE_VERSION_STATUSES).toEqual(['DRAFT', 'ACTIVE', 'RETIRED']);
    expect(COMPETITION_GOLDEN_BOARD_DISPLAY_MODES).toEqual(['AWARD_WINNERS']);
    expect(COMPETITION_PUBLIC_STATES).toEqual(['UPCOMING', 'ONGOING', 'ENDED']);
    expect(COMPETITION_ROUND_PRESENTATION_STATES).toEqual([
      'LOCKED', 'OPEN', 'PASSED', 'FAILED_RETRY_AVAILABLE', 'CLOSED',
    ]);
    expect(COMPETITION_ENTRY_PREFLIGHT_STATUSES).toEqual(['READY', 'BLOCKED']);
  });

  it('parses valid public summary, detail, article, and Golden Board DTOs', () => {
    expect(PublicCompetitionSummaryDtoSchema.safeParse(summary).success).toBe(true);
    expect(PublicCompetitionDetailDtoSchema.safeParse({ ...summary, articles: [article] }).success).toBe(true);
    expect(PublicCompetitionArticleDtoSchema.safeParse(article).success).toBe(true);

    const winner = {
      fullName: 'Nguyễn Văn An', className: '5A', schoolName: 'Tiểu học Tô Hiệu',
      gradeLevel: 5, awardCode: 'GOLD', awardLabel: 'Giải Nhất',
    };
    expect(PublicGoldenBoardWinnerDtoSchema.safeParse(winner).success).toBe(true);
    expect(PublicGoldenBoardDtoSchema.safeParse({
      winners: [winner], publicationVersion: 2, rankingVersion: 3,
      awardRuleVersion: 1, publishedAt: now,
    }).success).toBe(true);
  });

  it('strictly rejects private or unknown public keys at every representative level', () => {
    expect(PublicCompetitionSummaryDtoSchema.safeParse({ ...summary, campaignId: 'campaign-1' }).success).toBe(false);
    expect(PublicCompetitionSummaryDtoSchema.safeParse({
      ...summary, hero: { ...summary.hero, storagePath: '/private/hero.jpg' },
    }).success).toBe(false);
    expect(PublicCompetitionSummaryDtoSchema.safeParse({
      ...summary, rounds: [{ ...summary.rounds[0], quizId: 'quiz-private' }, ...summary.rounds.slice(1)],
    }).success).toBe(false);
    expect(PublicCompetitionSummaryDtoSchema.safeParse({
      ...summary, goldenBoardAvailable: 'true',
    }).success).toBe(false);
    expect(PublicCompetitionDetailDtoSchema.safeParse({
      ...summary, articles: [{ ...article, createdBy: 'staff-1' }],
    }).success).toBe(false);
  });

  it('locks the Golden Board winner allowlist and board metadata restriction', () => {
    const winner = {
      fullName: 'Nguyễn Văn An', className: '5A', schoolName: 'Tiểu học Tô Hiệu',
      gradeLevel: 5, awardCode: 'GOLD', awardLabel: 'Giải Nhất',
    };
    expect(Object.keys(PublicGoldenBoardWinnerDtoSchema.parse(winner)).sort()).toEqual(Object.keys(winner).sort());
    expect(PublicGoldenBoardWinnerDtoSchema.safeParse({ ...winner, username: 'an' }).success).toBe(false);
    expect(PublicGoldenBoardDtoSchema.safeParse({
      winners: [winner], publicationVersion: 2, rankingVersion: 3,
      awardRuleVersion: 1, publishedAt: now, eventId: 'event-private',
    }).success).toBe(false);
  });

  it('parses valid staff and authenticated student DTO/request shapes', () => {
    expect(StudentCompetitionPortalDtoSchema.safeParse({
      campaignId: 'campaign-1', slug: summary.slug, title: summary.title,
      schoolYear: summary.schoolYear, publicState: summary.publicState,
      rounds: [{ roundId: 'round-1', ...round, attemptCount: 0, maxAttempts: 3 }],
      schoolExam: { qualified: true, eventId: 'event-1', scheduledAt: later, roomName: 'Phòng 1', ready: true },
    }).success).toBe(true);
    expect(CompetitionEntryPreflightDtoSchema.safeParse({
      status: 'READY', campaignId: 'campaign-1', roundId: 'round-1', quizId: 'quiz-1',
      serverTime: now, window: { opensAt: now, closesAt: later, timezone: 'Asia/Ho_Chi_Minh' },
      attemptsRemaining: 2,
    }).success).toBe(true);
    expect(CompetitionEntryPreflightDtoSchema.safeParse({
      status: 'BLOCKED', campaignId: 'campaign-1', roundId: 'round-1', reason: 'ROUND_NOT_OPEN',
      serverTime: now, window: { opensAt: now, closesAt: later, timezone: 'Asia/Ho_Chi_Minh' },
      attemptsRemaining: 2,
    }).success).toBe(true);
    expect(CompetitionEntryPreflightDtoSchema.safeParse({
      status: 'BLOCKED', campaignId: 'campaign-1', roundId: 'round-private',
      reason: 'ROUND_CAMPAIGN_MISMATCH', serverTime: now, window: null, attemptsRemaining: null,
    }).success).toBe(true);
    expect(StudentCompetitionEntryPreflightRequestSchema.safeParse({ requestId }).success).toBe(true);

    const audit = { createdBy: 'staff-1', createdAt: now, updatedBy: 'staff-2', updatedAt: now };
    expect(StaffCompetitionPublicPageDtoSchema.safeParse({
      id: 'page-1', campaignId: 'campaign-1', slug: summary.slug, status: 'DRAFT',
      heroTitle: summary.title, heroSubtitle: null, heroImageUrl: null, summary: null,
      ctaLabel: 'VÀO THI', seoTitle: null, seoDescription: null, ogImageUrl: null,
      publishedAt: null, archivedAt: null, ...audit,
    }).success).toBe(true);
    expect(StaffCompetitionArticleDtoSchema.safeParse({
      id: 'article-1', campaignId: 'campaign-1', ...article, coverImageUrl: null,
      summary: null, status: 'DRAFT', publishedAt: null, ...audit,
    }).success).toBe(true);
    expect(StaffCompetitionGoldenBoardConfigDtoSchema.safeParse({
      id: 'board-1', campaignId: 'campaign-1', sourceEventId: null, enabled: false,
      displayMode: 'AWARD_WINNERS', title: 'Bảng vàng', awardRuleVersion: null,
      updatedBy: 'staff-1', updatedAt: now,
    }).success).toBe(true);
    expect(StaffCompetitionAwardRuleVersionDtoSchema.safeParse({
      id: 'version-1', campaignId: 'campaign-1', version: 1, status: 'DRAFT',
      activatedAt: null, rules: [{ id: 'rule-1', scope: 'GRADE', gradeLevel: 5,
        rankFrom: 1, rankTo: 3, awardCode: 'GOLD', awardLabel: 'Giải Nhất', sortOrder: 0 }],
      ...audit,
    }).success).toBe(true);
  });

  it('rejects browser-supplied identity fields in student preflight requests', () => {
    for (const override of [
      { studentId: 'student-other' }, { username: 'other' }, { identity: { studentId: 'student-other' } },
    ]) {
      expect(StudentCompetitionEntryPreflightRequestSchema.safeParse({ requestId, ...override }).success).toBe(false);
    }
  });

  it('accepts stable business preflight reasons and rejects transport failures', () => {
    const required = [
      'NOT_IN_AUDIENCE', 'ROUND_CAMPAIGN_MISMATCH', 'ROUND_NOT_OPEN', 'PREREQUISITE_NOT_MET',
      'ELIGIBILITY_BLOCKED', 'ATTEMPT_LIMIT_REACHED', 'QUIZ_MAPPING_UNAVAILABLE',
      'SCHOOL_EXAM_NOT_QUALIFIED', 'SCHOOL_EXAM_EVENT_NOT_READY', 'SCHOOL_EXAM_MEMBER_NOT_READY',
      'SCHOOL_EXAM_ROOM_NOT_READY', 'SCHOOL_EXAM_WINDOW_NOT_OPEN', 'SCHOOL_EXAM_WINDOW_CLOSED',
      'SCHOOL_EXAM_CAPACITY_NOT_CERTIFIED', 'SCHOOL_EXAM_SESSION_NOT_PROVISIONED',
      'SCHOOL_EXAM_PARTICIPANT_SCOPE_MISMATCH', 'SCHOOL_EXAM_ACCESS_CODE_INVALID',
      'SCHOOL_EXAM_CANDIDATE_CODE_INVALID',
    ];
    expect(COMPETITION_ENTRY_PREFLIGHT_REASONS).toEqual(required);
    for (const reason of required) expect(CompetitionEntryPreflightReasonSchema.parse(reason)).toBe(reason);
    expect(CompetitionEntryPreflightReasonSchema.safeParse('NETWORK_ERROR').success).toBe(false);
  });

  it('enforces award-rule scope, grade, and rank range invariants', () => {
    const base = { rankFrom: 1, rankTo: 3, awardCode: 'GOLD', awardLabel: 'Giải Nhất', sortOrder: 0 };
    expect(CreateCompetitionAwardRuleVersionRequestSchema.safeParse({
      campaignId: 'campaign-1', rules: [{ ...base, scope: 'EVENT' }], requestId,
    }).success).toBe(true);
    expect(CreateCompetitionAwardRuleVersionRequestSchema.safeParse({
      campaignId: 'campaign-1', rules: [{ ...base, scope: 'GRADE', gradeLevel: 5 }], requestId,
    }).success).toBe(true);
    expect(CreateCompetitionAwardRuleVersionRequestSchema.safeParse({
      campaignId: 'campaign-1', rules: [{ ...base, scope: 'GRADE' }], requestId,
    }).success).toBe(false);
    expect(CreateCompetitionAwardRuleVersionRequestSchema.safeParse({
      campaignId: 'campaign-1', rules: [{ ...base, scope: 'EVENT', gradeLevel: 5 }], requestId,
    }).success).toBe(false);
    expect(CreateCompetitionAwardRuleVersionRequestSchema.safeParse({
      campaignId: 'campaign-1', rules: [{ ...base, scope: 'EVENT', rankFrom: 4, rankTo: 3 }], requestId,
    }).success).toBe(false);
    expect(CreateCompetitionAwardRuleVersionRequestSchema.safeParse({
      campaignId: 'campaign-1', rules: [{ ...base, scope: 'EVENT', rankFrom: 0 }], requestId,
    }).success).toBe(false);
    for (const gradeLevel of [0, 13]) {
      expect(CreateCompetitionAwardRuleVersionRequestSchema.safeParse({
        campaignId: 'campaign-1', rules: [{ ...base, scope: 'GRADE', gradeLevel }], requestId,
      }).success).toBe(false);
    }

    expect(StaffCompetitionAwardRuleDtoSchema.safeParse({
      id: 'rule-1', ...base, scope: 'EVENT',
    }).success).toBe(true);
    expect(StaffCompetitionAwardRuleDtoSchema.safeParse({
      id: 'rule-1', ...base, scope: 'GRADE', gradeLevel: 5,
    }).success).toBe(true);
    expect(StaffCompetitionAwardRuleDtoSchema.safeParse({
      id: 'rule-1', ...base, scope: 'GRADE',
    }).success).toBe(false);
    expect(StaffCompetitionAwardRuleDtoSchema.safeParse({
      id: 'rule-1', ...base, scope: 'EVENT', gradeLevel: 5,
    }).success).toBe(false);
  });

  it('enforces enabled Golden Board source invariants', () => {
    expect(StaffCompetitionGoldenBoardConfigDtoSchema.safeParse({
      ...goldenBoardFields, enabled: true, sourceEventId: 'event-1', awardRuleVersion: 1,
    }).success).toBe(true);
    expect(StaffCompetitionGoldenBoardConfigDtoSchema.safeParse({
      ...goldenBoardFields, enabled: true, sourceEventId: null, awardRuleVersion: 1,
    }).success).toBe(false);
    expect(StaffCompetitionGoldenBoardConfigDtoSchema.safeParse({
      ...goldenBoardFields, enabled: true, sourceEventId: 'event-1', awardRuleVersion: null,
    }).success).toBe(false);
  });

  it('enforces persisted staff publication timestamp invariants', () => {
    const audit = { createdBy: 'staff-1', createdAt: now, updatedBy: null, updatedAt: now };
    const page = {
      id: 'page-1', campaignId: 'campaign-1', slug: summary.slug,
      heroTitle: summary.title, heroSubtitle: null, heroImageUrl: null, summary: null,
      ctaLabel: 'VÀO THI', seoTitle: null, seoDescription: null, ogImageUrl: null,
      publishedAt: null, archivedAt: null, ...audit,
    };
    expect(StaffCompetitionPublicPageDtoSchema.safeParse({
      ...page, status: 'PUBLISHED',
    }).success).toBe(false);
    expect(StaffCompetitionPublicPageDtoSchema.safeParse({
      ...page, status: 'ARCHIVED', archivedAt: now,
    }).success).toBe(false);
    expect(StaffCompetitionPublicPageDtoSchema.safeParse({
      ...page, status: 'ARCHIVED', publishedAt: now,
    }).success).toBe(false);
    expect(StaffCompetitionPublicPageDtoSchema.safeParse({
      ...page, status: 'PUBLISHED', publishedAt: now,
    }).success).toBe(true);
    expect(StaffCompetitionPublicPageDtoSchema.safeParse({
      ...page, status: 'ARCHIVED', publishedAt: now, archivedAt: later,
    }).success).toBe(true);

    const staffArticle = {
      id: 'article-1', campaignId: 'campaign-1', title: article.title, slug: article.slug,
      summary: null, coverImageUrl: null, content: article.content, type: article.type,
      publishedAt: null, ...audit,
    };
    expect(StaffCompetitionArticleDtoSchema.safeParse({
      ...staffArticle, status: 'PUBLISHED',
    }).success).toBe(false);
    expect(StaffCompetitionArticleDtoSchema.safeParse({
      ...staffArticle, status: 'ARCHIVED',
    }).success).toBe(false);
    expect(StaffCompetitionArticleDtoSchema.safeParse({
      ...staffArticle, status: 'PUBLISHED', publishedAt: now,
    }).success).toBe(true);
    expect(StaffCompetitionArticleDtoSchema.safeParse({
      ...staffArticle, status: 'ARCHIVED', publishedAt: now,
    }).success).toBe(true);
  });

  it('parses all required staff portal mutation requests', () => {
    expect(UpdateCompetitionPublicPageRequestSchema.safeParse({ heroTitle: 'Trang thi', requestId }).success).toBe(true);
    expect(CreateCompetitionArticleRequestSchema.safeParse({
      campaignId: 'campaign-1', title: article.title, slug: article.slug, content: article.content,
      type: article.type, status: 'DRAFT', requestId,
    }).success).toBe(true);
    expect(UpdateCompetitionArticleRequestSchema.safeParse({ title: 'Thể lệ mới', requestId }).success).toBe(true);
    expect(UpdateCompetitionGoldenBoardConfigRequestSchema.safeParse({
      enabled: true, sourceEventId: 'event-1', displayMode: 'AWARD_WINNERS', title: 'Bảng vàng',
      awardRuleVersion: 1, requestId,
    }).success).toBe(true);
    expect(ActivateCompetitionAwardRuleVersionRequestSchema.safeParse({ requestId }).success).toBe(true);
    expect(UpdateCompetitionPublicPageRequestSchema.safeParse({
      heroTitle: 'Trang thi', requestId, createdBy: 'staff-1',
    }).success).toBe(false);
    expect(CreateCompetitionArticleRequestSchema.safeParse({
      campaignId: 'campaign-1', title: article.title, slug: article.slug, content: article.content,
      type: article.type, requestId, publishedAt: now,
    }).success).toBe(false);
  });

  it('rejects invalid slug forms and exports the schemas from the barrel', () => {
    for (const slug of ['Uppercase', 'has_underscore', '-leading', 'trailing-', 'double--hyphen']) {
      expect(PublicCompetitionSummaryDtoSchema.safeParse({ ...summary, slug }).success).toBe(false);
    }
    expect(schemaBarrel.PublicCompetitionSummaryDtoSchema).toBe(PublicCompetitionSummaryDtoSchema);
    expect(schemaBarrel.StaffCompetitionGoldenBoardConfigDtoSchema).toBe(
      StaffCompetitionGoldenBoardConfigDtoSchema,
    );
  });
});
