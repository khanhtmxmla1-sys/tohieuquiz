import { useEffect, useState } from 'react';
import { resolveFeatureFlag } from '../../config/featureFlags';
import { resolveRuntimeFeatureFlag } from '../../services/featureRolloutService';

export interface CoinAwardsFeatureFlagState {
  enabled: boolean;
  ready: boolean;
  degraded: boolean;
}

const FEATURE_KEY = 'student_coin_awards_v1';
const FLAG_CHANGED_EVENT = 'tohieuquiz:feature-flag-changed';
const FLAGS_UPDATED_EVENT = 'tohieuquiz:feature-flags-updated';
const disabledState: CoinAwardsFeatureFlagState = {
  enabled: false,
  ready: true,
  degraded: false,
};

const isBuildEnabled = (): boolean => resolveFeatureFlag(
  import.meta.env.VITE_FEATURE_STUDENT_COIN_AWARDS_V1,
  false,
);

export function useCoinAwardsFeatureFlag(): CoinAwardsFeatureFlagState {
  const buildEnabled = isBuildEnabled();
  const [state, setState] = useState<CoinAwardsFeatureFlagState>(
    buildEnabled ? { enabled: false, ready: false, degraded: false } : disabledState,
  );

  useEffect(() => {
    let active = true;
    if (!buildEnabled) {
      setState(disabledState);
      return () => { active = false; };
    }

    const load = async () => {
      try {
        const resolution = await resolveRuntimeFeatureFlag(FEATURE_KEY);
        if (active) setState({ enabled: resolution.enabled === true, ready: true, degraded: false });
      } catch {
        if (active) setState({ enabled: false, ready: true, degraded: true });
      }
    };

    void load();
    const handleFlagChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (event.type === FLAG_CHANGED_EVENT && detail?.key && detail.key !== FEATURE_KEY) return;
      void load();
    };
    window.addEventListener(FLAG_CHANGED_EVENT, handleFlagChanged);
    window.addEventListener(FLAGS_UPDATED_EVENT, handleFlagChanged);
    return () => {
      active = false;
      window.removeEventListener(FLAG_CHANGED_EVENT, handleFlagChanged);
      window.removeEventListener(FLAGS_UPDATED_EVENT, handleFlagChanged);
    };
  }, [buildEnabled]);

  return state;
}
