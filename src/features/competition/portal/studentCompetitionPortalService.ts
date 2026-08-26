import type {
  CompetitionEntryPreflightDto,
  CompetitionEntryPreflightReason,
  CompetitionEntryPreflightWindowDto,
  StudentCompetitionPortalDto,
} from '../../../../shared/competition-portal.contract';
import { callApi } from '../../../services/apiAdapter';
import { toAppError } from '../../../services/api/errors';
import type { StudentCompetitionDetail } from '../studentCompetitionService';

export interface StudentCompetitionPortalResolution {
  competition: StudentCompetitionDetail;
  portal: StudentCompetitionPortalDto;
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

export type StudentCompetitionPortalErrorKind =
  | 'NOT_FOUND'
  | 'AUTH'
  | 'TRANSIENT'
  | 'BUSINESS_RULE';

export interface StudentCompetitionPortalError {
  kind: StudentCompetitionPortalErrorKind;
  code: string;
  message: string;
  status: number;
  retryable: boolean;
}

export function classifyStudentCompetitionPortalError(error: unknown): StudentCompetitionPortalError {
  const appError = toAppError(error);
  let kind: StudentCompetitionPortalErrorKind = 'BUSINESS_RULE';
  if (appError.retryable) kind = 'TRANSIENT';
  else if (appError.status === 404) kind = 'NOT_FOUND';
  else if (appError.status === 401 || appError.status === 403) kind = 'AUTH';
  return { kind, ...appError };
}

export const studentCompetitionPortalService = {
  async resolveBySlug(campaignSlug: string): Promise<StudentCompetitionPortalResolution> {
    return callApi<StudentCompetitionPortalResolution>('get_student_competition_by_slug', { campaignSlug });
  },
  async preflightRound(campaignId: string, roundId: string): Promise<CompetitionEntryPreflightDto> {
    const response = await callApi<{ preflight: CompetitionEntryPreflightDto }>(
      'preflight_student_competition_round', { campaignId, roundId },
    );
    return response.preflight;
  },
  async preflightSchoolExam(campaignId: string): Promise<StudentSchoolExamPreflightDto> {
    const response = await callApi<{ preflight: StudentSchoolExamPreflightDto }>(
      'preflight_student_competition_school_exam', { campaignId },
    );
    return response.preflight;
  },
  classifyError: classifyStudentCompetitionPortalError,
};
