import { useEffect, useState } from 'react';
import { getSystemSettings } from '../services/systemSettingsService';

export const useSystemSettings = () => {
    const [aiAssistantEnabled, setAiAssistantEnabled] = useState(true);

    useEffect(() => {
        const loadSystemSettings = async () => {
            try {
                const settings = await getSystemSettings();
                setAiAssistantEnabled(Boolean(settings.aiAssistantEnabled));
            } catch {
                setAiAssistantEnabled(true);
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
        return () => window.removeEventListener('tohieuquiz:system-settings-updated', handleSettingsUpdated);
    }, []);

    return aiAssistantEnabled;
};
