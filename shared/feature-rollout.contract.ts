export const FEATURE_AUDIENCES = ['all', 'admin', 'teacher', 'student', 'parent'] as const;
export type FeatureAudience = typeof FEATURE_AUDIENCES[number];

export interface FeatureRolloutStopConditions {
  max5xxRatePercent?: number;
  maxClientErrorMultiplier?: number;
  maxP95IncreasePercent?: number;
  maxSupportTickets?: number;
}

export interface FeatureFlagConfig {
  key: string;
  description: string;
  enabled: boolean;
  audience: FeatureAudience;
  percentage: number;
  allowUsers: string[];
  allowClasses: string[];
  startsAt: string | null;
  endsAt: string | null;
  owner: string;
  reason: string;
  stopConditions: FeatureRolloutStopConditions;
  version: number;
  updatedBy: string;
  updatedAt: string;
}

export interface FeatureFlagSubject {
  role: 'admin' | 'teacher' | 'student' | 'parent' | 'public';
  username?: string | null;
  classIds?: string[];
}

export type FeatureFlagPatchField =
  | 'enabled'
  | 'description'
  | 'audience'
  | 'percentage'
  | 'allowUsers'
  | 'allowClasses'
  | 'startsAt'
  | 'endsAt'
  | 'owner'
  | 'stopConditions';

export interface FeatureFlagPatch {
  field: FeatureFlagPatchField;
  value: unknown;
  reason: string;
}

export interface FeatureFlagResolution {
  key: string;
  enabled: boolean;
  reason: 'disabled' | 'outside_window' | 'allowlist' | 'audience' | 'percentage' | 'excluded';
  bucket: number | null;
  version: number;
}
