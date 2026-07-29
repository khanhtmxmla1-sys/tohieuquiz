import type {
  FeatureFlagConfig,
  FeatureFlagPatch,
  FeatureFlagResolution,
} from '../../shared/feature-rollout.contract';
import { callApi } from './apiAdapter';

export const listFeatureFlags = async (): Promise<FeatureFlagConfig[]> => {
  const response = await callApi<{ status: string; data: FeatureFlagConfig[] }>('list_feature_flags');
  return response.data || [];
};

export const resolveRuntimeFeatureFlag = async (flag: string): Promise<FeatureFlagResolution> => {
  const response = await callApi<{ status: string; data: FeatureFlagResolution }>('resolve_feature_flag', { flag });
  return response.data;
};

export const patchRuntimeFeatureFlag = async (
  key: string,
  patch: FeatureFlagPatch,
): Promise<FeatureFlagConfig> => {
  const response = await callApi<{ status: string; data: FeatureFlagConfig }>('patch_feature_flag', {
    key,
    ...patch,
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tohieuquiz:feature-flags-updated', { detail: { key } }));
  return response.data;
};

export const rollbackRuntimeFeatureFlag = async (
  key: string,
  reason: string,
): Promise<FeatureFlagConfig> => {
  const response = await callApi<{ status: string; data: FeatureFlagConfig }>('rollback_feature_flag', { key, reason });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tohieuquiz:feature-flags-updated', { detail: { key } }));
  return response.data;
};
