import type { FeatureAudience, FeatureFlagConfig } from '../../../shared/feature-rollout.contract';

export const FEATURE_AUDIENCE_LABELS: Record<FeatureAudience, string> = {
  all: 'Mọi người',
  admin: 'Quản trị viên',
  teacher: 'Giáo viên',
  student: 'Học sinh',
  parent: 'Phụ huynh',
};

const PRESENTATION: Record<string, { displayName: string; summary: string }> = {
  unified_notifications_v1: {
    displayName: 'Thông báo hợp nhất',
    summary: 'Kiểm soát trải nghiệm thông báo thống nhất trên các bề mặt của hệ thống.',
  },
  ai_assistant_enabled: {
    displayName: 'Trợ lý AI',
    summary: 'Cho phép mở dần trải nghiệm trợ lý AI cho từng nhóm người dùng.',
  },
};

export function getFeatureFlagPresentation(flag: Pick<FeatureFlagConfig, 'key' | 'description'>) {
  const known = PRESENTATION[flag.key];
  if (known) return known;
  return {
    displayName: flag.description.trim() || flag.key.replace(/[_-]+/g, ' '),
    summary: 'Tính năng runtime chưa có mô tả trình bày riêng; đang dùng mô tả cấu hình hiện tại.',
  };
}

export function formatFeatureRolloutState(
  flag: Pick<FeatureFlagConfig, 'enabled' | 'percentage' | 'audience'>,
): string {
  if (!flag.enabled) return 'Đang tắt';
  const audience = FEATURE_AUDIENCE_LABELS[flag.audience];
  if (flag.percentage < 100) return `Đang thử nghiệm ${flag.percentage}% · ${audience}`;
  return `Đang bật 100% · ${audience}`;
}
