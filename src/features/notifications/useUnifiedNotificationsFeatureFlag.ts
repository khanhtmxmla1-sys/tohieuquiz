import { useEffect, useState } from 'react';
import { getSystemSettings } from '../../services/systemSettingsService';
import { resolveRuntimeFeatureFlag } from '../../services/featureRolloutService';
import { useAuthStore } from '../../../stores/authStore';
import { useClassroomStore } from '../../stores/useClassroomStore';

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
  const teacherAuthenticated = useAuthStore((store) => store.status === 'authenticated');
  const studentAuthenticated = useClassroomStore((store) => Boolean(store.studentSession));
  const usePersonalizedResolution = teacherAuthenticated || studentAuthenticated;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (usePersonalizedResolution) {
        try {
          const resolution = await resolveRuntimeFeatureFlag('unified_notifications_v1');
          if (!active) return;
          setState({ enabled: resolution.enabled, ready: true, degraded: false });
          return;
        } catch {
          // Fall back to the public setting when personalized resolution is unavailable.
        }
      }
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
    window.addEventListener('tohieuquiz:feature-flags-updated', handleSettingsUpdated);
    return () => {
      active = false;
      window.removeEventListener('tohieuquiz:system-settings-updated', handleSettingsUpdated);
      window.removeEventListener('tohieuquiz:feature-flags-updated', handleSettingsUpdated);
    };
  }, [usePersonalizedResolution]);

  return state;
}
