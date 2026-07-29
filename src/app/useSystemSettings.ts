import { useEffect, useState } from 'react';
import { getSystemSettings } from '../services/systemSettingsService';
import { resolveRuntimeFeatureFlag } from '../services/featureRolloutService';

export const useSystemSettings = () => {
    const [aiAssistantEnabled, setAiAssistantEnabled] = useState(true);

    useEffect(() => {
        const loadSystemSettings = async () => {
            try {
                const resolution = await resolveRuntimeFeatureFlag('ai_assistant_enabled');
                setAiAssistantEnabled(resolution.enabled);
            } catch {
                try {
                    const settings = await getSystemSettings();
                    setAiAssistantEnabled(Boolean(settings.aiAssistantEnabled));
                } catch {
                    setAiAssistantEnabled(false);
                }
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
    }, []);

    return aiAssistantEnabled;
};
