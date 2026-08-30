import type { PublicCompetitionSummaryDto } from '../../../../../shared/competition-portal.contract';
import { callApi } from '../../../../services/apiAdapter';

interface PublicApiEnvelope<T> {
  status: 'success';
  data: T;
}

export const publicCompetitionPortalService = {
  async listCompetitions(): Promise<PublicCompetitionSummaryDto[]> {
    const response = await callApi<PublicApiEnvelope<PublicCompetitionSummaryDto[]>>(
      'list_public_competitions',
    );
    return response.data;
  },
};
