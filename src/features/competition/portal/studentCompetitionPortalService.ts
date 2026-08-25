import type { StudentCompetitionPortalDto } from '../../../../shared/competition-portal.contract';
import { callApi } from '../../../services/apiAdapter';
import { toAppError } from '../../../services/api/errors';
import type { StudentCompetitionDetail } from '../studentCompetitionService';

export interface StudentCompetitionPortalResolution {
  competition: StudentCompetitionDetail;
  portal: StudentCompetitionPortalDto;
}

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
  classifyError: classifyStudentCompetitionPortalError,
};
