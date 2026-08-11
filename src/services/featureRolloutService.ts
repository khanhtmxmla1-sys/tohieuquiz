import type {
  FeatureFlagBatchPatch,
  FeatureFlagConfig,
  FeatureFlagPatch,
  FeatureFlagResolution,
} from '../../shared/feature-rollout.contract';
import { callApi } from './apiAdapter';

export const FEATURE_FLAG_CHANGED_EVENT = 'tohieuquiz:feature-flag-changed';

const dispatchFlagChanged = (flag: FeatureFlagConfig) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FEATURE_FLAG_CHANGED_EVENT, { detail: { key: flag.key, version: flag.version } }));
};

export async function listFeatureFlags(): Promise<FeatureFlagConfig[]> {
  const response = await callApi<{ status: string; data: FeatureFlagConfig[] }>('list_feature_flags');
  return response.data || [];
}

export async function patchRuntimeFeatureFlag(key: string, patch: FeatureFlagPatch): Promise<FeatureFlagConfig> {
  const response = await callApi<{ status: string; data: FeatureFlagConfig }>('patch_feature_flag', { key, ...patch });
  dispatchFlagChanged(response.data);
  return response.data;
}

export async function patchRuntimeFeatureFlagBatch(
  key: string,
  batch: FeatureFlagBatchPatch,
): Promise<FeatureFlagConfig> {
  const response = await callApi<{ status: string; data: FeatureFlagConfig }>('patch_feature_flag_batch', {
    key,
    ...batch,
  });
  dispatchFlagChanged(response.data);
  return response.data;
}

export async function rollbackRuntimeFeatureFlag(key: string, reason: string): Promise<FeatureFlagConfig> {
  const response = await callApi<{ status: string; data: FeatureFlagConfig }>('rollback_feature_flag', { key, reason });
  dispatchFlagChanged(response.data);
  return response.data;
}

export async function resolveRuntimeFeatureFlag(key: string): Promise<FeatureFlagResolution> {
  const response = await callApi<{ status: string; data: FeatureFlagResolution }>('resolve_feature_flag', { flag: key });
  return response.data;
}
