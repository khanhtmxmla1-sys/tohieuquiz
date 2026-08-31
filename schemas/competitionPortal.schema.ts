import { z } from 'zod';
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

const IdentifierSchema = z.string().trim().min(1).max(128);
const RequestIdSchema = z.string().trim().min(8).max(160);
const DateTimeSchema = z.string().datetime();
const NullableDateTimeSchema = DateTimeSchema.nullable();
const GradeLevelSchema = z.number().int().min(1).max(12);
const SlugSchema = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const TitleSchema = z.string().trim().min(1).max(200);
const SummarySchema = z.string().trim().min(1).max(1000);
const OptionalImageUrlSchema = z.string().url().max(2048).optional();
const NullableImageUrlSchema = z.string().url().max(2048).nullable();

export const CompetitionPublicPageStatusSchema = z.enum(COMPETITION_PUBLIC_PAGE_STATUSES);
export const CompetitionArticleStatusSchema = z.enum(COMPETITION_ARTICLE_STATUSES);
export const CompetitionArticleTypeSchema = z.enum(COMPETITION_ARTICLE_TYPES);
export const CompetitionAwardRuleScopeSchema = z.enum(COMPETITION_AWARD_RULE_SCOPES);
export const CompetitionAwardRuleVersionStatusSchema = z.enum(COMPETITION_AWARD_RULE_VERSION_STATUSES);
export const CompetitionGoldenBoardDisplayModeSchema = z.enum(COMPETITION_GOLDEN_BOARD_DISPLAY_MODES);
export const CompetitionPublicStateSchema = z.enum(COMPETITION_PUBLIC_STATES);
export const CompetitionRoundPresentationStateSchema = z.enum(COMPETITION_ROUND_PRESENTATION_STATES);
export const CompetitionEntryPreflightStatusSchema = z.enum(COMPETITION_ENTRY_PREFLIGHT_STATUSES);
export const CompetitionEntryPreflightReasonSchema = z.enum(COMPETITION_ENTRY_PREFLIGHT_REASONS);

export const PublicCompetitionHeroDtoSchema = z.object({
  title: TitleSchema,
  subtitle: z.string().trim().min(1).max(500).optional(),
  imageUrl: OptionalImageUrlSchema,
}).strict();

export const PublicCompetitionCtaDtoSchema = z.object({
  label: z.string().trim().min(1).max(80),
}).strict();

export const PublicCompetitionRoundDtoSchema = z.object({
  roundNumber: z.number().int().min(1).max(6),
  title: TitleSchema,
  opensAt: DateTimeSchema,
  closesAt: DateTimeSchema,
  state: CompetitionRoundPresentationStateSchema,
}).strict().refine(
  (value) => Date.parse(value.opensAt) < Date.parse(value.closesAt),
  { message: 'closesAt must be after opensAt', path: ['closesAt'] },
);

export const PublicCompetitionArticleDtoSchema = z.object({
  slug: SlugSchema,
  title: TitleSchema,
  summary: SummarySchema,
  coverImageUrl: OptionalImageUrlSchema,
  content: z.string().trim().min(1).max(100_000),
  type: CompetitionArticleTypeSchema,
  publishedAt: DateTimeSchema,
}).strict();

const publicCompetitionSummaryShape = {
  slug: SlugSchema,
  title: TitleSchema,
  summary: SummarySchema,
  schoolYear: z.string().regex(/^\d{4}-\d{4}$/),
  publicState: CompetitionPublicStateSchema,
  startsAt: DateTimeSchema,
  endsAt: DateTimeSchema,
  timezone: z.string().trim().min(1).max(100),
  hero: PublicCompetitionHeroDtoSchema,
  cta: PublicCompetitionCtaDtoSchema,
  rounds: z.array(PublicCompetitionRoundDtoSchema).length(6),
  articleSummaryAvailable: z.boolean(),
  goldenBoardAvailable: z.boolean(),
};

const withValidCompetitionWindow = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => schema.refine(
  (value) => {
    const window = value as unknown as { startsAt: string; endsAt: string };
    return Date.parse(window.startsAt) < Date.parse(window.endsAt);
  },
  { message: 'endsAt must be after startsAt', path: ['endsAt'] },
);

export const PublicCompetitionSummaryDtoSchema = withValidCompetitionWindow(
  z.object(publicCompetitionSummaryShape).strict(),
);

export const PublicCompetitionDetailDtoSchema = withValidCompetitionWindow(
  z.object({
    ...publicCompetitionSummaryShape,
    articles: z.array(PublicCompetitionArticleDtoSchema).max(100),
  }).strict(),
);

export const PublicGoldenBoardWinnerDtoSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  className: z.string().trim().min(1).max(100),
  schoolName: z.string().trim().min(1).max(200),
  gradeLevel: GradeLevelSchema,
  awardCode: z.string().trim().min(1).max(100),
  awardLabel: z.string().trim().min(1).max(200),
}).strict();

export const PublicGoldenBoardDtoSchema = z.object({
  winners: z.array(PublicGoldenBoardWinnerDtoSchema).max(1000),
  publicationVersion: z.number().int().positive(),
  rankingVersion: z.number().int().positive(),
  awardRuleVersion: z.number().int().positive(),
  publishedAt: DateTimeSchema,
}).strict();

export const StudentCompetitionRoundDtoSchema = z.object({
  roundId: IdentifierSchema,
  roundNumber: z.number().int().min(1).max(6),
  title: TitleSchema,
  opensAt: DateTimeSchema,
  closesAt: DateTimeSchema,
  state: CompetitionRoundPresentationStateSchema,
  attemptCount: z.number().int().min(0).max(100),
  maxAttempts: z.number().int().positive().max(100),
}).strict();

export const StudentSchoolExamPortalDtoSchema = z.object({
  qualified: z.boolean(),
  eventId: IdentifierSchema,
  scheduledAt: DateTimeSchema,
  roomName: z.string().trim().min(1).max(100),
  ready: z.boolean(),
}).strict();

export const StudentCompetitionPortalDtoSchema = z.object({
  campaignId: IdentifierSchema,
  slug: SlugSchema,
  title: TitleSchema,
  schoolYear: z.string().regex(/^\d{4}-\d{4}$/),
  publicState: CompetitionPublicStateSchema,
  rounds: z.array(StudentCompetitionRoundDtoSchema).min(1).max(6),
  schoolExam: StudentSchoolExamPortalDtoSchema.optional(),
}).strict();

export const CompetitionEntryPreflightDtoSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('READY'),
    campaignId: IdentifierSchema,
    roundId: IdentifierSchema,
    quizId: IdentifierSchema,
    serverTime: DateTimeSchema,
    window: z.object({
      opensAt: DateTimeSchema,
      closesAt: DateTimeSchema,
      timezone: z.string().trim().min(1).max(100),
    }).strict(),
    attemptsRemaining: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    status: z.literal('BLOCKED'),
    campaignId: IdentifierSchema,
    roundId: IdentifierSchema,
    reason: CompetitionEntryPreflightReasonSchema,
    serverTime: DateTimeSchema,
    window: z.object({
      opensAt: DateTimeSchema,
      closesAt: DateTimeSchema,
      timezone: z.string().trim().min(1).max(100),
    }).strict().nullable(),
    attemptsRemaining: z.number().int().nonnegative().nullable(),
  }).strict(),
]);

export const StudentCompetitionEntryPreflightRequestSchema = z.object({
  requestId: RequestIdSchema,
}).strict();

const auditShape = {
  createdBy: IdentifierSchema,
  createdAt: DateTimeSchema,
  updatedBy: IdentifierSchema.nullable(),
  updatedAt: DateTimeSchema,
};

const staffCompetitionPublicPageShape = {
  id: IdentifierSchema,
  campaignId: IdentifierSchema,
  slug: SlugSchema,
  heroTitle: TitleSchema,
  heroSubtitle: z.string().trim().min(1).max(500).nullable(),
  heroImageUrl: NullableImageUrlSchema,
  summary: z.string().trim().min(1).max(1000).nullable(),
  ctaLabel: z.string().trim().min(1).max(80),
  seoTitle: z.string().trim().min(1).max(200).nullable(),
  seoDescription: z.string().trim().min(1).max(500).nullable(),
  ogImageUrl: NullableImageUrlSchema,
  ...auditShape,
};

export const StaffCompetitionPublicPageDtoSchema = z.discriminatedUnion('status', [
  z.object({
    ...staffCompetitionPublicPageShape,
    status: z.enum(['DRAFT', 'PREVIEW']),
    publishedAt: NullableDateTimeSchema,
    archivedAt: NullableDateTimeSchema,
  }).strict(),
  z.object({
    ...staffCompetitionPublicPageShape,
    status: z.literal('PUBLISHED'),
    publishedAt: DateTimeSchema,
    archivedAt: NullableDateTimeSchema,
  }).strict(),
  z.object({
    ...staffCompetitionPublicPageShape,
    status: z.literal('ARCHIVED'),
    publishedAt: DateTimeSchema,
    archivedAt: DateTimeSchema,
  }).strict(),
]);

const staffCompetitionArticleShape = {
  id: IdentifierSchema,
  campaignId: IdentifierSchema,
  title: TitleSchema,
  slug: SlugSchema,
  summary: z.string().trim().min(1).max(1000).nullable(),
  coverImageUrl: NullableImageUrlSchema,
  content: z.string().max(100_000),
  type: CompetitionArticleTypeSchema,
  ...auditShape,
};

export const StaffCompetitionArticleDtoSchema = z.discriminatedUnion('status', [
  z.object({
    ...staffCompetitionArticleShape,
    status: z.literal('DRAFT'),
    publishedAt: NullableDateTimeSchema,
  }).strict(),
  z.object({
    ...staffCompetitionArticleShape,
    status: z.enum(['PUBLISHED', 'ARCHIVED']),
    publishedAt: DateTimeSchema,
  }).strict(),
]);

const competitionAwardRuleFieldsShape = {
  rankFrom: z.number().int().positive(),
  rankTo: z.number().int().positive(),
  awardCode: z.string().trim().min(1).max(100),
  awardLabel: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0),
};

const withValidAwardRankRange = <T extends z.ZodType<{ rankFrom: number; rankTo: number }>>(schema: T) => (
  schema.superRefine((value, ctx) => {
  if (value.rankTo < value.rankFrom) {
    ctx.addIssue({ code: 'custom', message: 'rankTo must be greater than or equal to rankFrom', path: ['rankTo'] });
  }
  })
);

export const CompetitionAwardRuleFieldsSchema = withValidAwardRankRange(z.discriminatedUnion('scope', [
  z.object({ ...competitionAwardRuleFieldsShape, scope: z.literal('EVENT') }).strict(),
  z.object({ ...competitionAwardRuleFieldsShape, scope: z.literal('GRADE'), gradeLevel: GradeLevelSchema }).strict(),
]));

export const StaffCompetitionAwardRuleDtoSchema = withValidAwardRankRange(z.discriminatedUnion('scope', [
  z.object({ id: IdentifierSchema, ...competitionAwardRuleFieldsShape, scope: z.literal('EVENT') }).strict(),
  z.object({
    id: IdentifierSchema,
    ...competitionAwardRuleFieldsShape,
    scope: z.literal('GRADE'),
    gradeLevel: GradeLevelSchema,
  }).strict(),
]));

export const StaffCompetitionAwardRuleVersionDtoSchema = z.object({
  id: IdentifierSchema,
  campaignId: IdentifierSchema,
  version: z.number().int().positive(),
  status: CompetitionAwardRuleVersionStatusSchema,
  activatedAt: NullableDateTimeSchema,
  rules: z.array(StaffCompetitionAwardRuleDtoSchema).max(1000),
  ...auditShape,
}).strict();

const staffCompetitionGoldenBoardConfigShape = {
  id: IdentifierSchema,
  campaignId: IdentifierSchema,
  displayMode: CompetitionGoldenBoardDisplayModeSchema,
  title: TitleSchema,
  updatedBy: IdentifierSchema,
  updatedAt: DateTimeSchema,
};

export const StaffCompetitionGoldenBoardConfigDtoSchema = z.discriminatedUnion('enabled', [
  z.object({
    ...staffCompetitionGoldenBoardConfigShape,
    enabled: z.literal(false),
    sourceEventId: IdentifierSchema.nullable(),
    awardRuleVersion: z.number().int().positive().nullable(),
  }).strict(),
  z.object({
    ...staffCompetitionGoldenBoardConfigShape,
    enabled: z.literal(true),
    sourceEventId: IdentifierSchema,
    awardRuleVersion: z.number().int().positive(),
  }).strict(),
]);

export const UpdateCompetitionPublicPageRequestSchema = z.object({
  slug: SlugSchema.optional(),
  status: CompetitionPublicPageStatusSchema.optional(),
  heroTitle: TitleSchema.optional(),
  heroSubtitle: z.string().trim().min(1).max(500).nullable().optional(),
  heroImageUrl: NullableImageUrlSchema.optional(),
  summary: z.string().trim().min(1).max(1000).nullable().optional(),
  ctaLabel: z.string().trim().min(1).max(80).optional(),
  seoTitle: z.string().trim().min(1).max(200).nullable().optional(),
  seoDescription: z.string().trim().min(1).max(500).nullable().optional(),
  ogImageUrl: NullableImageUrlSchema.optional(),
  requestId: RequestIdSchema,
}).strict().refine(
  (value) => Object.keys(value).some((key) => key !== 'requestId'),
  { message: 'at least one public page field is required' },
);

export const CreateCompetitionPublicPageRequestSchema = z.object({
  slug: SlugSchema,
  heroTitle: TitleSchema,
  heroSubtitle: z.string().trim().min(1).max(500).optional(),
  heroImageUrl: OptionalImageUrlSchema,
  summary: z.string().trim().min(1).max(1000).optional(),
  ctaLabel: z.string().trim().min(1).max(80).optional(),
  seoTitle: z.string().trim().min(1).max(200).optional(),
  seoDescription: z.string().trim().min(1).max(500).optional(),
  ogImageUrl: OptionalImageUrlSchema,
  requestId: RequestIdSchema,
}).strict();

export const CreateCompetitionArticleRequestSchema = z.object({
  campaignId: IdentifierSchema,
  title: TitleSchema,
  slug: SlugSchema,
  summary: z.string().trim().min(1).max(1000).optional(),
  coverImageUrl: OptionalImageUrlSchema,
  content: z.string().max(100_000),
  type: CompetitionArticleTypeSchema,
  status: CompetitionArticleStatusSchema.optional(),
  requestId: RequestIdSchema,
}).strict();

export const UpdateCompetitionArticleRequestSchema = z.object({
  title: TitleSchema.optional(),
  slug: SlugSchema.optional(),
  summary: z.string().trim().min(1).max(1000).nullable().optional(),
  coverImageUrl: NullableImageUrlSchema.optional(),
  content: z.string().max(100_000).optional(),
  type: CompetitionArticleTypeSchema.optional(),
  status: CompetitionArticleStatusSchema.optional(),
  requestId: RequestIdSchema,
}).strict().refine(
  (value) => Object.keys(value).some((key) => key !== 'requestId'),
  { message: 'at least one article field is required' },
);

export const UpdateCompetitionGoldenBoardConfigRequestSchema = z.object({
  sourceEventId: IdentifierSchema.nullable().optional(),
  enabled: z.boolean().optional(),
  displayMode: CompetitionGoldenBoardDisplayModeSchema.optional(),
  title: TitleSchema.optional(),
  awardRuleVersion: z.number().int().positive().nullable().optional(),
  requestId: RequestIdSchema,
}).strict().refine(
  (value) => Object.keys(value).some((key) => key !== 'requestId'),
  { message: 'at least one Golden Board field is required' },
);

export const CreateCompetitionAwardRuleVersionRequestSchema = z.object({
  campaignId: IdentifierSchema,
  rules: z.array(CompetitionAwardRuleFieldsSchema).min(1).max(1000),
  requestId: RequestIdSchema,
}).strict();

export const ActivateCompetitionAwardRuleVersionRequestSchema = z.object({
  requestId: RequestIdSchema,
}).strict();

export type UpdateCompetitionPublicPageRequest = z.infer<typeof UpdateCompetitionPublicPageRequestSchema>;
export type CreateCompetitionPublicPageRequest = z.infer<typeof CreateCompetitionPublicPageRequestSchema>;
export type CreateCompetitionArticleRequest = z.infer<typeof CreateCompetitionArticleRequestSchema>;
export type UpdateCompetitionArticleRequest = z.infer<typeof UpdateCompetitionArticleRequestSchema>;
export type UpdateCompetitionGoldenBoardConfigRequest = z.infer<typeof UpdateCompetitionGoldenBoardConfigRequestSchema>;
export type CreateCompetitionAwardRuleVersionRequest = z.infer<typeof CreateCompetitionAwardRuleVersionRequestSchema>;
export type ActivateCompetitionAwardRuleVersionRequest = z.infer<typeof ActivateCompetitionAwardRuleVersionRequestSchema>;
export type StudentCompetitionEntryPreflightRequest = z.infer<typeof StudentCompetitionEntryPreflightRequestSchema>;
