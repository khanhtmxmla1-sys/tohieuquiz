import { useEffect, useState } from 'react';
import { isCompetitionV1Enabled } from '../../config/featureFlags';
import { resolveRuntimeFeatureFlag } from '../../services/featureRolloutService';

export interface CompetitionV1FeatureFlagState {
  enabled: boolean;
  ready: boolean;
  degraded: boolean;
}

const disabledState: CompetitionV1FeatureFlagState = {
  enabled: false,
  ready: true,
  degraded: false,
};

export function useCompetitionV1FeatureFlag(): CompetitionV1FeatureFlagState {
  const buildEnabled = isCompetitionV1Enabled();
  const [state, setState] = useState<CompetitionV1FeatureFlagState>(
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
        const resolution = await resolveRuntimeFeatureFlag('competition_v1');
        if (active) setState({ enabled: resolution.enabled, ready: true, degraded: false });
      } catch {
        if (active) setState({ enabled: false, ready: true, degraded: true });
      }
    };

    void load();
    const handleFlagUpdated = () => { void load(); };
    window.addEventListener('tohieuquiz:feature-flags-updated', handleFlagUpdated);
    return () => {
      active = false;
      window.removeEventListener('tohieuquiz:feature-flags-updated', handleFlagUpdated);
    };
  }, [buildEnabled]);

  return state;
}
