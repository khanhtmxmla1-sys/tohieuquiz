import type {
  FeatureFlagBatchChange,
  FeatureFlagConfig,
  FeatureFlagPatchField,
  FeatureRolloutStopConditions,
} from '../../../shared/feature-rollout.contract';
import { systemDateTimeLocalToIso, toSystemDateTimeLocal } from '../../utils/dateTime';

export interface FeatureRolloutDraft extends Omit<FeatureFlagConfig, 'startsAt' | 'endsAt'> {
  startsAt: string;
  endsAt: string;
}

const CHANGE_ORDER: FeatureFlagPatchField[] = [
  'enabled',
  'description',
  'audience',
  'percentage',
  'allowUsers',
  'allowClasses',
  'startsAt',
  'endsAt',
  'owner',
  'stopConditions',
];

const localDate = (value: string | null): string => {
  if (!value) return '';
  try {
    return toSystemDateTimeLocal(value);
  } catch {
    return '';
  }
};

const apiDate = (value: string): string | null => {
  if (!value) return null;
  return systemDateTimeLocalToIso(value);
};

const normalizedStrings = (values: string[]): string[] => [
  ...new Set(values.map((item) => item.trim()).filter(Boolean)),
];

const stableStopConditions = (value: FeatureRolloutStopConditions): FeatureRolloutStopConditions => ({
  ...(value.max5xxRatePercent !== undefined ? { max5xxRatePercent: value.max5xxRatePercent } : {}),
  ...(value.maxClientErrorMultiplier !== undefined ? { maxClientErrorMultiplier: value.maxClientErrorMultiplier } : {}),
  ...(value.maxP95IncreasePercent !== undefined ? { maxP95IncreasePercent: value.maxP95IncreasePercent } : {}),
  ...(value.maxSupportTickets !== undefined ? { maxSupportTickets: value.maxSupportTickets } : {}),
});

export function featureFlagToDraft(flag: FeatureFlagConfig): FeatureRolloutDraft {
  return {
    ...flag,
    allowUsers: [...flag.allowUsers],
    allowClasses: [...flag.allowClasses],
    stopConditions: { ...flag.stopConditions },
    startsAt: localDate(flag.startsAt),
    endsAt: localDate(flag.endsAt),
  };
}

const draftApiValue = (draft: FeatureRolloutDraft, field: FeatureFlagPatchField): unknown => {
  switch (field) {
    case 'startsAt': return apiDate(draft.startsAt);
    case 'endsAt': return apiDate(draft.endsAt);
    case 'allowUsers': return normalizedStrings(draft.allowUsers);
    case 'allowClasses': return normalizedStrings(draft.allowClasses);
    case 'stopConditions': return stableStopConditions(draft.stopConditions);
    default: return draft[field];
  }
};

const configValue = (flag: FeatureFlagConfig, field: FeatureFlagPatchField): unknown => {
  if (field === 'allowUsers') return normalizedStrings(flag.allowUsers);
  if (field === 'allowClasses') return normalizedStrings(flag.allowClasses);
  if (field === 'stopConditions') return stableStopConditions(flag.stopConditions);
  return flag[field];
};

const equal = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

export function getFeatureRolloutChanges(
  current: FeatureFlagConfig,
  draft: FeatureRolloutDraft,
): FeatureFlagBatchChange[] {
  return CHANGE_ORDER.flatMap((field) => {
    const nextValue = draftApiValue(draft, field);
    return equal(configValue(current, field), nextValue) ? [] : [{ field, value: nextValue }];
  });
}

const IMPACT_GROUPS: Record<FeatureFlagPatchField, string> = {
  enabled: 'Phạm vi phát hành',
  audience: 'Phạm vi phát hành',
  percentage: 'Phạm vi phát hành',
  allowUsers: 'Danh sách ưu tiên',
  allowClasses: 'Danh sách ưu tiên',
  startsAt: 'Thời gian',
  endsAt: 'Thời gian',
  owner: 'Thông tin quản trị',
  description: 'Thông tin quản trị',
  stopConditions: 'Giám sát',
};

export function countFeatureRolloutImpactGroups(changes: FeatureFlagBatchChange[]): number {
  return new Set(changes.map((change) => IMPACT_GROUPS[change.field])).size;
}

export function validateFeatureRolloutDraft(draft: FeatureRolloutDraft): string | null {
  if (!Number.isInteger(draft.percentage) || draft.percentage < 0 || draft.percentage > 100) {
    return 'Tỷ lệ thử nghiệm phải là số nguyên từ 0 đến 100.';
  }
  if (draft.startsAt && draft.endsAt) {
    const startsAt = new Date(apiDate(draft.startsAt) as string).getTime();
    const endsAt = new Date(apiDate(draft.endsAt) as string).getTime();
    if (startsAt >= endsAt) return 'Thời điểm kết thúc phải sau thời điểm bắt đầu.';
  }
  const conditions = Object.values(draft.stopConditions).filter((value) => value !== undefined);
  if (conditions.some((value) => !Number.isFinite(value as number) || Number(value) < 0)) {
    return 'Các ngưỡng theo dõi phải là số không âm.';
  }
  return null;
}
