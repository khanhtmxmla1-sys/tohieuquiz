import { useEffect, useState } from 'react';
import { getSystemSettings } from '../services/systemSettingsService';
import { resolveRuntimeFeatureFlag } from '../services/featureRolloutService';
import { useAuthStore } from '../../stores/authStore';
import { useClassroomStore } from '../stores/useClassroomStore';

export const useSystemSettings = () => {
    const [aiAssistantEnabled, setAiAssistantEnabled] = useState(true);
    const teacherAuthenticated = useAuthStore((state) => state.status === 'authenticated');
    const studentAuthenticated = useClassroomStore((state) => Boolean(state.studentSession));
    const usePersonalizedResolution = teacherAuthenticated || studentAuthenticated;

    useEffect(() => {
        const loadSystemSettings = async () => {
            if (usePersonalizedResolution) {
                try {
                    const resolution = await resolveRuntimeFeatureFlag('ai_assistant_enabled');
                    setAiAssistantEnabled(resolution.enabled);
                    return;
                } catch {
                    // Fall back to the public setting when personalized resolution is unavailable.
                }
            }
            try {
                const settings = await getSystemSettings();
                setAiAssistantEnabled(Boolean(settings.aiAssistantEnabled));
            } catch {
                setAiAssistantEnabled(false);
            }
        };

        loadSystemSettings();
        const handleSettingsUpdated = (event: Event) => {
            const customEvent = event as CustomEvent<{ aiAssistantEnabled?: boolean }>;
            if (typeof customEvent.detail?.aiAssistantEnabled === 'boolean') {
                setAiAssistantEnabled(customEvent.detail.aiAssistantEnabled);
                return;
            }
            loadSystemSettings();
        };

        window.addEventListener('tohieuquiz:system-settings-updated', handleSettingsUpdated);
        window.addEventListener('tohieuquiz:feature-flags-updated', handleSettingsUpdated);
        return () => {
            window.removeEventListener('tohieuquiz:system-settings-updated', handleSettingsUpdated);
            window.removeEventListener('tohieuquiz:feature-flags-updated', handleSettingsUpdated);
        };
    }, [usePersonalizedResolution]);

    return aiAssistantEnabled;
};
