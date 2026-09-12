import type { CompetitionCampaignView, CompetitionRoundView } from '../competitionDashboardService';
import { formatSystemDateTime } from '../../../utils/dateTime';
import type { CompetitionArticleType } from '../../../../shared/competition-portal.contract';

export type CompetitionArticleTemplateType = Extract<CompetitionArticleType, 'RULES' | 'SCHEDULE' | 'GUIDE'>;

export interface CompetitionArticleTemplateContext {
  campaign: CompetitionCampaignView;
  rounds: CompetitionRoundView[];
}

export interface CompetitionArticleTemplate {
  title: string;
  slug: string;
  summary: string;
  content: string;
  type: CompetitionArticleTemplateType;
  coverImageUrl: string;
}

const TEMPLATE_TYPES: readonly CompetitionArticleTemplateType[] = ['RULES', 'SCHEDULE', 'GUIDE'];

export const competitionArticleTemplateTypes = TEMPLATE_TYPES;

const ARTICLE_TYPE_LABELS: Record<CompetitionArticleType, string> = {
  ANNOUNCEMENT: 'Thông báo',
  GUIDE: 'Hướng dẫn',
  RULES: 'Thể lệ',
  SCHEDULE: 'Lịch thi',
  RESULT: 'Kết quả',
  AWARD: 'Giải thưởng',
  CERTIFICATE: 'Chứng nhận',
  INCIDENT_NOTICE: 'Thông báo sự cố',
};

export const competitionArticleTypeLabel = (type: CompetitionArticleType): string => ARTICLE_TYPE_LABELS[type];

const toSlugPart = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const campaignSlug = (campaign: CompetitionCampaignView): string => {
  const titlePart = toSlugPart(campaign.title);
  return titlePart || `cuoc-thi-${toSlugPart(campaign.schoolYear) || 'moi'}`;
};

const listOrFallback = (items: Array<string | number> | undefined, fallback: string): string => (
  items && items.length > 0 ? items.join(', ') : fallback
);

const audienceLines = (campaign: CompetitionCampaignView): string[] => [
  `- Khối: ${listOrFallback(campaign.audienceRule?.gradeLevels, 'Chưa cấu hình')}`,
  `- Lớp: ${listOrFallback(campaign.audienceRule?.classIds, 'Chưa cấu hình')}`,
];

const qualificationLine = (campaign: CompetitionCampaignView): string => {
  const policy = campaign.eligibilityPolicy;
  return policy
    ? `- Cần đạt: ${policy.requiredPassedRounds}/${policy.requiredRounds} vòng thi.`
    : '- Cần đạt: Chưa cấu hình.';
};

const roundsByNumber = (rounds: CompetitionRoundView[], campaignId: string): CompetitionRoundView[] => rounds
  .filter(round => round.campaignId === campaignId)
  .sort((left, right) => left.roundNumber - right.roundNumber);

const roundLines = (rounds: CompetitionRoundView[], campaignId: string): string[] => {
  const sortedRounds = roundsByNumber(rounds, campaignId);
  if (sortedRounds.length === 0) return ['Chưa có vòng thi được cấu hình.'];
  return sortedRounds.flatMap(round => [
    `### Vòng ${round.roundNumber}`,
    `- Mở: ${formatSystemDateTime(round.opensAt, 'Chưa cấu hình')}`,
    `- Đóng: ${formatSystemDateTime(round.closesAt, 'Chưa cấu hình')}`,
    `- Số lượt tối đa: ${round.maxAttempts}`,
    `- Điểm đạt: ${round.passingScore}`,
  ]);
};

const rulesTemplate = (context: CompetitionArticleTemplateContext): CompetitionArticleTemplate => {
  const { campaign } = context;
  return {
    type: 'RULES',
    title: `Thể lệ ${campaign.title}`,
    slug: `the-le-${campaignSlug(campaign)}`,
    summary: `Thông tin thể lệ của ${campaign.title}, năm học ${campaign.schoolYear}.`,
    coverImageUrl: '',
    content: [
      `# Thể lệ ${campaign.title}`,
      '',
      `- Năm học: ${campaign.schoolYear}`,
      '',
      '## Đối tượng dự thi',
      ...audienceLines(campaign),
      '',
      '## Điều kiện hoàn thành',
      qualificationLine(campaign),
      '',
      'Nội dung điểm đạt, số lượt và thời gian của từng vòng được nêu trong mục Lịch thi.',
    ].join('\n'),
  };
};

const scheduleTemplate = (context: CompetitionArticleTemplateContext): CompetitionArticleTemplate => {
  const { campaign } = context;
  return {
    type: 'SCHEDULE',
    title: `Lịch thi ${campaign.title}`,
    slug: `lich-thi-${campaignSlug(campaign)}`,
    summary: `Lịch mở và đóng các vòng thi của ${campaign.title}.`,
    coverImageUrl: '',
    content: [
      `# Lịch thi ${campaign.title}`,
      '',
      `- Năm học: ${campaign.schoolYear}`,
      `- Múi giờ: ${campaign.timezone}`,
      '',
      ...roundLines(context.rounds, campaign.id),
    ].join('\n'),
  };
};

const guideTemplate = (context: CompetitionArticleTemplateContext): CompetitionArticleTemplate => {
  const { campaign } = context;
  return {
    type: 'GUIDE',
    title: `Hướng dẫn tham gia ${campaign.title}`,
    slug: `huong-dan-tham-gia-${campaignSlug(campaign)}`,
    summary: `Hướng dẫn tham gia ${campaign.title}, năm học ${campaign.schoolYear}.`,
    coverImageUrl: '',
    content: [
      `# Hướng dẫn tham gia ${campaign.title}`,
      '',
      `- Năm học: ${campaign.schoolYear}`,
      '',
      '## Thông tin áp dụng',
      ...audienceLines(campaign),
      qualificationLine(campaign),
      '',
      '## Các bước tham gia',
      '1. Đăng nhập bằng tài khoản được cấp và mở cuộc thi.',
      '2. Chọn vòng thi đang trong thời gian mở.',
      '3. Kiểm tra số lượt tối đa và điểm đạt của vòng trước khi bắt đầu.',
      '4. Hoàn thành bài thi, gửi bài và theo dõi trạng thái kết quả.',
      '',
      'Thông tin thời gian, số lượt tối đa và điểm đạt của từng vòng được cập nhật trong mục Lịch thi.',
      '',
      '## Thông tin từng vòng',
      ...roundLines(context.rounds, campaign.id),
    ].join('\n'),
  };
};

export const createCompetitionArticleTemplate = (
  type: CompetitionArticleType,
  context: CompetitionArticleTemplateContext,
): CompetitionArticleTemplate | null => {
  if (!TEMPLATE_TYPES.includes(type as CompetitionArticleTemplateType)) return null;
  if (type === 'RULES') return rulesTemplate(context);
  if (type === 'SCHEDULE') return scheduleTemplate(context);
  return guideTemplate(context);
};
