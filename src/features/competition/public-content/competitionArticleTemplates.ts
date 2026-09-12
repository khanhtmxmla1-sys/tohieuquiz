import type { CompetitionCampaignView, CompetitionRoundView } from '../competitionDashboardService';
import { formatSystemDateTime } from '../../../utils/dateTime';
import type { CompetitionArticleType } from '../../../../shared/competition-portal.contract';

export type CompetitionArticleTemplateType = Extract<CompetitionArticleType, 'RULES' | 'SCHEDULE' | 'GUIDE'>;

export interface CompetitionArticleTemplateContext {
  campaign: CompetitionCampaignView;
  rounds: CompetitionRoundView[];
  occupiedSlugs?: readonly string[];
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
const MAX_ARTICLE_TITLE_LENGTH = 200;
const MAX_ARTICLE_SLUG_LENGTH = 160;
const MAX_SLUG_SUFFIX = 999;

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

const truncateTitle = (prefix: string, title: string): string => (
  `${prefix}${title}`.slice(0, MAX_ARTICLE_TITLE_LENGTH).trim()
);

const trimSlug = (slug: string): string => slug
  .slice(0, MAX_ARTICLE_SLUG_LENGTH)
  .replace(/-+$/g, '');

const uniqueArticleSlug = (baseSlug: string, occupiedSlugs: readonly string[] = []): string | null => {
  const occupied = new Set(occupiedSlugs.map(slug => slug.trim().toLowerCase()).filter(Boolean));
  const base = trimSlug(baseSlug);
  if (!base) return null;
  if (!occupied.has(base)) return base;

  for (let suffix = 2; suffix <= MAX_SLUG_SUFFIX; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidateBase = trimSlug(base.slice(0, MAX_ARTICLE_SLUG_LENGTH - suffixText.length));
    const candidate = `${candidateBase}${suffixText}`;
    if (!occupied.has(candidate)) return candidate;
  }
  return null;
};

const listOrFallback = (items: Array<string | number> | undefined, fallback: string): string => (
  items && items.length > 0 ? items.join(', ') : fallback
);

const audienceLines = (campaign: CompetitionCampaignView): string[] => [
  `- Khối: ${listOrFallback(campaign.audienceRule?.gradeLevels, 'Chưa cấu hình')}`,
  `- Lớp: ${listOrFallback(campaign.audienceRule?.classIds, 'Chưa cấu hình')}`,
];

const plainAudienceLines = (campaign: CompetitionCampaignView): string[] => [
  `Khối: ${listOrFallback(campaign.audienceRule?.gradeLevels, 'Chưa cấu hình')}`,
  `Lớp: ${listOrFallback(campaign.audienceRule?.classIds, 'Chưa cấu hình')}`,
];

const qualificationLine = (campaign: CompetitionCampaignView): string => {
  const policy = campaign.eligibilityPolicy;
  return policy
    ? `- Cần đạt: ${policy.requiredPassedRounds}/${policy.requiredRounds} vòng thi.`
    : '- Cần đạt: Chưa cấu hình.';
};

const plainQualificationLine = (campaign: CompetitionCampaignView): string => {
  const policy = campaign.eligibilityPolicy;
  return policy
    ? `Cần đạt: ${policy.requiredPassedRounds}/${policy.requiredRounds} vòng thi.`
    : 'Cần đạt: Chưa cấu hình.';
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

const rulesTemplate = (context: CompetitionArticleTemplateContext): CompetitionArticleTemplate | null => {
  const { campaign } = context;
  const slug = uniqueArticleSlug(`the-le-${campaignSlug(campaign)}`, context.occupiedSlugs);
  if (!slug) return null;
  return {
    type: 'RULES',
    title: truncateTitle('Thể lệ ', campaign.title),
    slug,
    summary: `Thông tin thể lệ của ${campaign.title}, năm học ${campaign.schoolYear}.`,
    coverImageUrl: '',
    content: [
      `THỂ LỆ ${campaign.title}`.slice(0, MAX_ARTICLE_TITLE_LENGTH),
      '',
      `Năm học: ${campaign.schoolYear}`,
      '',
      'Đối tượng dự thi',
      ...plainAudienceLines(campaign),
      '',
      'Điều kiện hoàn thành',
      plainQualificationLine(campaign),
      '',
      'Nội dung điểm đạt, số lượt và thời gian của từng vòng được nêu trong mục Lịch thi.',
    ].join('\n'),
  };
};

const scheduleTemplate = (context: CompetitionArticleTemplateContext): CompetitionArticleTemplate | null => {
  const { campaign } = context;
  const slug = uniqueArticleSlug(`lich-thi-${campaignSlug(campaign)}`, context.occupiedSlugs);
  if (!slug) return null;
  return {
    type: 'SCHEDULE',
    title: truncateTitle('Lịch thi ', campaign.title),
    slug,
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

const guideTemplate = (context: CompetitionArticleTemplateContext): CompetitionArticleTemplate | null => {
  const { campaign } = context;
  const slug = uniqueArticleSlug(`huong-dan-tham-gia-${campaignSlug(campaign)}`, context.occupiedSlugs);
  if (!slug) return null;
  return {
    type: 'GUIDE',
    title: truncateTitle('Hướng dẫn tham gia ', campaign.title),
    slug,
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
