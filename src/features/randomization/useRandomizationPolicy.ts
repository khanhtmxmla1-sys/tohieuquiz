import { useEffect, useState } from 'react';
import { getSystemSettings } from '../../services/systemSettingsService';
import {
  DEFAULT_RANDOMIZATION_POLICY,
  resolveEffectiveRandomizationPolicy,
  type RandomizationPolicy,
} from '../../../shared/randomization-policy.contract';

const DEFAULT_EFFECTIVE_POLICY = resolveEffectiveRandomizationPolicy(DEFAULT_RANDOMIZATION_POLICY);

export const useRandomizationPolicy = (): RandomizationPolicy => {
  const [policy, setPolicy] = useState<RandomizationPolicy>(DEFAULT_EFFECTIVE_POLICY);

  useEffect(() => {
    let active = true;
    void getSystemSettings()
      .then((settings) => {
        if (active) setPolicy(resolveEffectiveRandomizationPolicy(settings.randomization));
      })
      .catch(() => {
        if (active) setPolicy(DEFAULT_EFFECTIVE_POLICY);
      });

    const handleSettingsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ randomization?: unknown }>).detail;
      if (!detail?.randomization) return;
      setPolicy(resolveEffectiveRandomizationPolicy(detail.randomization as Partial<RandomizationPolicy>));
    };
    window.addEventListener('tohieuquiz:system-settings-updated', handleSettingsUpdate);
    return () => {
      active = false;
      window.removeEventListener('tohieuquiz:system-settings-updated', handleSettingsUpdate);
    };
  }, []);

  return policy;
};
