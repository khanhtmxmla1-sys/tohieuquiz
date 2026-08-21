import { z } from 'zod';
import { CERTIFICATE_NAME_FONTS } from '../shared/certificates.contract';
import {
  COMPETITION_ATTEMPT_STATUSES,
  COMPETITION_CAMPAIGN_STATUSES,
  COMPETITION_EXAM_FORM_POLICIES,
  COMPETITION_EXPORT_STATUSES,
  COMPETITION_RANKING_POLICIES,
  COMPETITION_ROUND_STATUSES,
  LIVE_EXAM_PARTICIPANT_SCOPE_TYPES,
  SCHOOL_EXAM_STATUSES,
} from '../shared/competition.contract';

const IdentifierSchema = z.string().trim().min(1).max(128);
const RequestIdSchema = z.string().trim().min(8).max(160);
const IdempotencyKeySchema = z.string()
  .trim()
  .min(16)
  .max(160)
  .regex(/^[A-Za-z0-9:_-]+$/);
const DateTimeSchema = z.string().datetime();

export const CompetitionCampaignStatusSchema = z.enum(COMPETITION_CAMPAIGN_STATUSES);
export const CompetitionRoundStatusSchema = z.enum(COMPETITION_ROUND_STATUSES);
export const CompetitionAttemptStatusSchema = z.enum(COMPETITION_ATTEMPT_STATUSES);
export const SchoolExamStatusSchema = z.enum(SCHOOL_EXAM_STATUSES);
export const CompetitionExportStatusSchema = z.enum(COMPETITION_EXPORT_STATUSES);
export const LiveExamParticipantScopeTypeSchema = z.enum(LIVE_EXAM_PARTICIPANT_SCOPE_TYPES);

export const CompetitionAudienceRuleSchema = z.object({
  gradeLevels: z.array(z.number().int().min(1).max(12)).min(1).max(12),
  classIds: z.array(IdentifierSchema).max(500).optional(),
}).strict();

export const CompetitionEligibilityPolicySchema = z.object({
  requiredRounds: z.literal(6),
  requiredPassedRounds: z.number().int().min(1).max(6),
}).strict();

export const CreateCompetitionCampaignRequestSchema = z.object({
  title: z.string().trim().min(3).max(200),
  schoolYear: z.string().regex(/^\d{4}-\d{4}$/),
  timezone: z.string().trim().min(1).max(100),
  audienceRule: CompetitionAudienceRuleSchema,
  eligibilityPolicy: CompetitionEligibilityPolicySchema,
  startsAt: DateTimeSchema,
  endsAt: DateTimeSchema,
  requestId: RequestIdSchema,
}).strict().refine(
  (value) => Date.parse(value.startsAt) < Date.parse(value.endsAt),
  { message: 'endsAt must be after startsAt', path: ['endsAt'] },
);

export const UpdateCompetitionCampaignRequestSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  schoolYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  audienceRule: CompetitionAudienceRuleSchema.optional(),
  eligibilityPolicy: CompetitionEligibilityPolicySchema.optional(),
  startsAt: DateTimeSchema.optional(),
  endsAt: DateTimeSchema.optional(),
  requestId: RequestIdSchema,
}).strict().refine(
  (value) => Object.keys(value).some((key) => key !== 'requestId'),
  { message: 'at least one campaign field is required' },
);

export const UpdateCompetitionRoundRequestSchema = z.object({
  campaignId: IdentifierSchema,
  roundId: IdentifierSchema,
  roundNumber: z.number().int().min(1).max(6),
  opensAt: DateTimeSchema,
  closesAt: DateTimeSchema,
  maxAttempts: z.number().int().min(1).max(100),
  passingRuleType: z.literal('MIN_SCORE'),
  passingScore: z.number().min(0).max(100),
  requestId: RequestIdSchema,
}).strict().refine(
  (value) => Date.parse(value.opensAt) < Date.parse(value.closesAt),
  { message: 'closesAt must be after opensAt', path: ['closesAt'] },
);

export const FinalizeCompetitionRoundRequestSchema = z.object({
  campaignId: IdentifierSchema,
  roundId: IdentifierSchema,
  requestId: RequestIdSchema,
}).strict();

export const StartCompetitionRoundAttemptRequestSchema = z.object({
  campaignId: IdentifierSchema,
  roundId: IdentifierSchema,
  requestId: RequestIdSchema,
}).strict();

export const SubmitCompetitionRoundAttemptRequestSchema = z.object({
  attemptId: IdentifierSchema,
  answers: z.record(z.string(), z.unknown()),
  timeTaken: z.number().int().min(0),
  idempotencyKey: IdempotencyKeySchema,
}).strict();

export const FinalizeCompetitionEligibilityRequestSchema = z.object({
  campaignId: IdentifierSchema,
  requestId: RequestIdSchema,
}).strict();

export const CreateSchoolExamEventRequestSchema = z.object({
  campaignId: IdentifierSchema,
  eligibilitySnapshotVersion: z.number().int().positive(),
  title: z.string().trim().min(3).max(200),
  examDate: DateTimeSchema,
  rankingPolicy: z.enum(COMPETITION_RANKING_POLICIES),
  examFormPolicy: z.enum(COMPETITION_EXAM_FORM_POLICIES),
  capacityProfileId: IdentifierSchema.optional(),
  requestId: RequestIdSchema,
}).strict();

export const SchoolExamFormDefinitionSchema = z.object({
  blueprintId: IdentifierSchema,
  durationMinutes: z.number().int().min(1).max(300),
  totalScore: z.number().positive().max(1000),
  difficulty: z.string().trim().min(1).max(64),
  gradeLevel: z.number().int().min(1).max(12),
  objectiveIds: z.array(IdentifierSchema).min(1).max(100),
}).strict();

export const CreateSchoolExamRoomRequestSchema = z.object({
  eventId: IdentifierSchema,
  name: z.string().trim().min(1).max(100),
  roomCode: z.string().trim().min(1).max(32),
  scheduledAt: DateTimeSchema,
  durationMinutes: z.number().int().min(1).max(300),
  checkInLeadMinutes: z.number().int().min(0).max(120),
  closeDrainMinutes: z.number().int().min(0).max(120),
  formCode: z.string().trim().min(1).max(32),
  quizId: IdentifierSchema,
  invigilatorIds: z.array(IdentifierSchema).min(1).max(20),
  studentIds: z.array(IdentifierSchema).min(1).max(1000),
  formDefinition: SchoolExamFormDefinitionSchema,
  equivalentFormApproved: z.boolean().optional(),
  requestId: RequestIdSchema,
}).strict();

export const RunSchoolExamPreflightRequestSchema = z.object({
  eventId: IdentifierSchema,
  requestId: RequestIdSchema,
}).strict();

export const ProvisionSchoolExamRequestSchema = z.object({
  eventId: IdentifierSchema,
  requestId: RequestIdSchema,
}).strict();

export const SCHOOL_EXAM_INCIDENT_REASONS = [
  'NETWORK_FAILURE',
  'DEVICE_FAILURE',
  'SERVER_INCIDENT',
  'EXAM_INTERRUPTED',
  'ADMINISTRATIVE_ERROR',
] as const;

export const SCHOOL_EXAM_RECONCILE_RESOLUTIONS = [
  'KEEP_ORIGINAL',
  'REPLACE_WITH_RETEST',
  'INVALIDATE_RESULT',
] as const;

export const CreateSchoolExamIncidentRequestSchema = z.object({
  eventId: IdentifierSchema,
  roomId: IdentifierSchema,
  studentId: IdentifierSchema,
  originalResultId: IdentifierSchema,
  reasonCode: z.enum(SCHOOL_EXAM_INCIDENT_REASONS),
  reasonText: z.string().trim().min(1).max(1000).optional(),
  occurredAt: DateTimeSchema.optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: RequestIdSchema,
}).strict();

export const GrantSchoolExamRetestRequestSchema = z.object({
  eventId: IdentifierSchema,
  expiresAt: DateTimeSchema,
  resolution: z.enum(SCHOOL_EXAM_RECONCILE_RESOLUTIONS),
  requestId: RequestIdSchema,
}).strict();

export const StartCompetitionReconcileRequestSchema = z.object({
  eventId: IdentifierSchema,
  requestId: RequestIdSchema,
}).strict();

export const PublishCompetitionResultsRequestSchema = z.object({
  eventId: IdentifierSchema,
  requestId: RequestIdSchema,
}).strict();

export const CreateCompetitionCertificateBatchRequestSchema = z.object({
  eventId: IdentifierSchema,
  publicationVersion: z.number().int().positive(),
  rankingVersion: z.number().int().positive(),
  winnerStudentIds: z.array(IdentifierSchema).min(1).max(1000),
  templateId: IdentifierSchema,
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().max(500).optional(),
  achievementPrefix: z.string().trim().max(160).optional(),
  dateLine: z.string().trim().max(200).optional(),
  studentNameFont: z.enum(CERTIFICATE_NAME_FONTS).optional(),
  requestId: RequestIdSchema,
}).strict();

export const CreateCompetitionExportRequestSchema = z.object({
  eventId: IdentifierSchema,
  scope: z.enum(['SCHOOL', 'CLASS']),
  classId: IdentifierSchema.optional(),
  requestId: RequestIdSchema,
}).strict().superRefine((value, ctx) => {
  if (value.scope === 'CLASS' && !value.classId) {
    ctx.addIssue({
      code: 'custom',
      message: 'classId is required for CLASS export scope',
      path: ['classId'],
    });
  }
});

export type CreateCompetitionCampaignRequest = z.infer<typeof CreateCompetitionCampaignRequestSchema>;
export type UpdateCompetitionCampaignRequest = z.infer<typeof UpdateCompetitionCampaignRequestSchema>;
export type UpdateCompetitionRoundRequest = z.infer<typeof UpdateCompetitionRoundRequestSchema>;
export type StartCompetitionRoundAttemptRequest = z.infer<typeof StartCompetitionRoundAttemptRequestSchema>;
export type SubmitCompetitionRoundAttemptRequest = z.infer<typeof SubmitCompetitionRoundAttemptRequestSchema>;
export type FinalizeCompetitionEligibilityRequest = z.infer<typeof FinalizeCompetitionEligibilityRequestSchema>;
export type CreateSchoolExamEventRequest = z.infer<typeof CreateSchoolExamEventRequestSchema>;
export type CreateSchoolExamRoomRequest = z.infer<typeof CreateSchoolExamRoomRequestSchema>;
export type CreateSchoolExamIncidentRequest = z.infer<typeof CreateSchoolExamIncidentRequestSchema>;
export type GrantSchoolExamRetestRequest = z.infer<typeof GrantSchoolExamRetestRequestSchema>;
export type CreateCompetitionCertificateBatchRequest = z.infer<typeof CreateCompetitionCertificateBatchRequestSchema>;
export type CreateCompetitionExportRequest = z.infer<typeof CreateCompetitionExportRequestSchema>;
