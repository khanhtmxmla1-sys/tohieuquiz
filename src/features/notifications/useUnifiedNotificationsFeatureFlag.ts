import { useEffect, useState } from 'react';
import { getSystemSettings } from '../../services/systemSettingsService';

export interface UnifiedNotificationsFeatureFlag {
  enabled: boolean;
  ready: boolean;
  degraded: boolean;
}

const initialState: UnifiedNotificationsFeatureFlag = {
  enabled: false,
  ready: false,
  degraded: false,
};

export function useUnifiedNotificationsFeatureFlag(): UnifiedNotificationsFeatureFlag {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const settings = await getSystemSettings();
        if (!active) return;
        setState({
          enabled: settings.unifiedNotificationsEnabled === true,
          ready: true,
          degraded: Boolean(settings.degraded),
        });
      } catch {
        if (active) setState({ enabled: false, ready: true, degraded: true });
      }
    };

    void load();
    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        unifiedNotificationsEnabled?: boolean;
      }>).detail;
      if (typeof detail?.unifiedNotificationsEnabled === 'boolean') {
        setState({
          enabled: detail.unifiedNotificationsEnabled,
          ready: true,
          degraded: false,
        });
        return;
      }
      void load();
    };
    window.addEventListener('tohieuquiz:system-settings-updated', handleSettingsUpdated);
    return () => {
      active = false;
      window.removeEventListener('tohieuquiz:system-settings-updated', handleSettingsUpdated);
    };
  }, []);

  return state;
}
