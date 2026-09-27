import { useEffect, useState } from 'react';
import { resolveFeatureFlag } from '../../../config/featureFlags';
import {
  FEATURE_FLAG_CHANGED_EVENT,
  resolveRuntimeFeatureFlag,
} from '../../../services/featureRolloutService';

const FEATURE_KEY = 'server_quiz_generation_v1';
const FLAGS_UPDATED_EVENT = 'tohieuquiz:feature-flags-updated';

export interface ServerQuizGenerationFeatureFlagState {
  enabled: boolean;
  ready: boolean;
  degraded: boolean;
}

const disabledState: ServerQuizGenerationFeatureFlagState = {
  enabled: false,
  ready: true,
  degraded: false,
};

const isBuildEnabled = (): boolean => resolveFeatureFlag(
  import.meta.env.VITE_FEATURE_SERVER_QUIZ_GENERATION_V1,
  false,
);

export function useServerQuizGenerationFeatureFlag(): ServerQuizGenerationFeatureFlagState {
  const buildEnabled = isBuildEnabled();
  const [state, setState] = useState<ServerQuizGenerationFeatureFlagState>(
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
        if (active) {
          setState({
            enabled: resolution.enabled === true,
            ready: true,
            degraded: false,
          });
        }
      } catch {
        if (active) setState({ enabled: false, ready: true, degraded: true });
      }
    };

    void load();
    const handleFlagChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (event.type === FEATURE_FLAG_CHANGED_EVENT && detail?.key && detail.key !== FEATURE_KEY) {
        return;
      }
      void load();
    };
    window.addEventListener(FEATURE_FLAG_CHANGED_EVENT, handleFlagChanged);
    window.addEventListener(FLAGS_UPDATED_EVENT, handleFlagChanged);

    return () => {
      active = false;
      window.removeEventListener(FEATURE_FLAG_CHANGED_EVENT, handleFlagChanged);
      window.removeEventListener(FLAGS_UPDATED_EVENT, handleFlagChanged);
    };
  }, [buildEnabled]);

  return state;
}
