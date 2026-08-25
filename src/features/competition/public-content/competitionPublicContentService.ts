import { callApi } from '../../../services/apiAdapter';
import type {
  CreateCompetitionArticleRequest,
  CreateCompetitionAwardRuleVersionRequest,
  UpdateCompetitionArticleRequest,
  UpdateCompetitionGoldenBoardConfigRequest,
  UpdateCompetitionPublicPageRequest,
} from '../../../../schemas/competitionPortal.schema';
import type {
  StaffCompetitionArticleDto,
  StaffCompetitionAwardRuleVersionDto,
  StaffCompetitionGoldenBoardConfigDto,
  StaffCompetitionPublicPageDto,
} from '../../../../shared/competition-portal.contract';

export const competitionPublicContentService = {
  async getPublicPage(campaignId: string): Promise<StaffCompetitionPublicPageDto | null> {
    const response = await callApi<{ publicPage: StaffCompetitionPublicPageDto | null }>(
      'get_competition_public_page', { campaignId },
    );
    return response.publicPage;
  },

  async updatePublicPage(
    campaignId: string,
    payload: UpdateCompetitionPublicPageRequest,
  ): Promise<StaffCompetitionPublicPageDto> {
    const response = await callApi<{ publicPage: StaffCompetitionPublicPageDto }>(
      'update_competition_public_page', { campaignId, ...payload },
    );
    return response.publicPage;
  },

  async previewPublicPage(campaignId: string, requestId: string): Promise<StaffCompetitionPublicPageDto> {
    const response = await callApi<{ preview: StaffCompetitionPublicPageDto }>(
      'preview_competition_public_page', { campaignId, requestId },
    );
    return response.preview;
  },

  async publishPublicPage(campaignId: string, requestId: string): Promise<StaffCompetitionPublicPageDto> {
    const response = await callApi<{ publicPage: StaffCompetitionPublicPageDto }>(
      'publish_competition_public_page', { campaignId, requestId },
    );
    return response.publicPage;
  },

  async archivePublicPage(campaignId: string, requestId: string): Promise<StaffCompetitionPublicPageDto> {
    const response = await callApi<{ publicPage: StaffCompetitionPublicPageDto }>(
      'archive_competition_public_page', { campaignId, requestId },
    );
    return response.publicPage;
  },

  async listArticles(campaignId: string): Promise<StaffCompetitionArticleDto[]> {
    const response = await callApi<{ items?: StaffCompetitionArticleDto[] }>('list_competition_articles', { campaignId });
    return response.items || [];
  },

  async getArticle(campaignId: string, articleId: string): Promise<StaffCompetitionArticleDto> {
    const response = await callApi<{ article: StaffCompetitionArticleDto }>(
      'get_competition_article', { campaignId, articleId },
    );
    return response.article;
  },

  async createArticle(payload: CreateCompetitionArticleRequest): Promise<StaffCompetitionArticleDto> {
    const response = await callApi<{ article: StaffCompetitionArticleDto }>('create_competition_article', payload);
    return response.article;
  },

  async updateArticle(
    campaignId: string,
    articleId: string,
    payload: UpdateCompetitionArticleRequest,
  ): Promise<StaffCompetitionArticleDto> {
    const response = await callApi<{ article: StaffCompetitionArticleDto }>(
      'update_competition_article', { campaignId, articleId, ...payload },
    );
    return response.article;
  },

  async deleteArticle(campaignId: string, articleId: string, requestId: string): Promise<StaffCompetitionArticleDto | null> {
    const response = await callApi<{ article: StaffCompetitionArticleDto | null }>(
      'delete_competition_article', { campaignId, articleId, requestId },
    );
    return response.article;
  },

  async getGoldenBoardConfig(campaignId: string): Promise<StaffCompetitionGoldenBoardConfigDto | null> {
    const response = await callApi<{ goldenBoardConfig: StaffCompetitionGoldenBoardConfigDto | null }>(
      'get_competition_golden_board_config', { campaignId },
    );
    return response.goldenBoardConfig;
  },

  async updateGoldenBoardConfig(
    campaignId: string,
    payload: UpdateCompetitionGoldenBoardConfigRequest,
  ): Promise<StaffCompetitionGoldenBoardConfigDto> {
    const response = await callApi<{ goldenBoardConfig: StaffCompetitionGoldenBoardConfigDto }>(
      'update_competition_golden_board_config', { campaignId, ...payload },
    );
    return response.goldenBoardConfig;
  },

  async listAwardRuleVersions(campaignId: string): Promise<StaffCompetitionAwardRuleVersionDto[]> {
    const response = await callApi<{ items?: StaffCompetitionAwardRuleVersionDto[] }>(
      'list_competition_award_rules', { campaignId },
    );
    return response.items || [];
  },

  async createAwardRuleVersion(
    payload: CreateCompetitionAwardRuleVersionRequest,
  ): Promise<StaffCompetitionAwardRuleVersionDto> {
    const response = await callApi<{ awardRuleVersion: StaffCompetitionAwardRuleVersionDto }>(
      'create_competition_award_rules', payload,
    );
    return response.awardRuleVersion;
  },

  async activateAwardRuleVersion(
    campaignId: string,
    version: number,
    requestId: string,
  ): Promise<StaffCompetitionAwardRuleVersionDto> {
    const response = await callApi<{ awardRuleVersion: StaffCompetitionAwardRuleVersionDto }>(
      'activate_competition_award_rules', { campaignId, version, requestId },
    );
    return response.awardRuleVersion;
  },
};
