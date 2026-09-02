import type {
  PublicCompetitionArticleDto,
  PublicCompetitionDetailDto,
  PublicGoldenBoardDto,
  PublicCompetitionSummaryDto,
} from '../../../../../shared/competition-portal.contract';
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

  async getCompetition(slug: string): Promise<PublicCompetitionDetailDto> {
    const response = await callApi<PublicApiEnvelope<PublicCompetitionDetailDto>>(
      'get_public_competition',
      { slug },
    );
    return response.data;
  },

  async getArticle(campaignSlug: string, articleSlug: string): Promise<PublicCompetitionArticleDto> {
    const response = await callApi<PublicApiEnvelope<PublicCompetitionArticleDto>>(
      'get_public_competition_article',
      { slug: campaignSlug, articleSlug },
    );
    return response.data;
  },

  async getGoldenBoard(campaignSlug: string): Promise<PublicGoldenBoardDto> {
    const response = await callApi<PublicApiEnvelope<PublicGoldenBoardDto>>(
      'get_public_competition_golden_board',
      { slug: campaignSlug },
    );
    return response.data;
  },
};
