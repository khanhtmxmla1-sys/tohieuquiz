import { useEffect, useState } from 'react';
import { resolveRuntimeFeatureFlag } from '../../services/featureRolloutService';

export interface SystemQuestionBankFeatureFlagState {
  ready: boolean;
  enabled: boolean;
}

export const useSystemQuestionBankFeatureFlag = (): SystemQuestionBankFeatureFlagState => {
  const [state, setState] = useState<SystemQuestionBankFeatureFlagState>({ ready: false, enabled: false });

  useEffect(() => {
    let active = true;
    const resolve = () => {
      setState((current) => ({ ...current, ready: false }));
      resolveRuntimeFeatureFlag('system_question_bank_v1')
        .then((result) => {
          if (active) setState({ ready: true, enabled: result.enabled });
        })
        .catch(() => {
          if (active) setState({ ready: true, enabled: false });
        });
    };
    const onUpdate = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (!key || key === 'system_question_bank_v1') resolve();
    };

    resolve();
    window.addEventListener('tohieuquiz:feature-flags-updated', onUpdate);
    return () => {
      active = false;
      window.removeEventListener('tohieuquiz:feature-flags-updated', onUpdate);
    };
  }, []);

  return state;
};
