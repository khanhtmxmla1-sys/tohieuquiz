import { callApi } from './apiAdapter';

export interface SystemSettings {
    aiAssistantEnabled: boolean;
    unifiedNotificationsEnabled: boolean;
    updatedAt?: string;
    degraded?: boolean;
}

export const getSystemSettings = async (): Promise<SystemSettings> => {
    const data = await callApi<any>('get_system_settings');
    if (data?.status !== 'success' || !data?.data) throw new Error('Cấu hình tạm không khả dụng.');
    return {
        aiAssistantEnabled: Boolean(data.data.aiAssistantEnabled),
        unifiedNotificationsEnabled: data.data.unified_notifications_v1 === true
            || data.data.unifiedNotificationsEnabled === true,
        updatedAt: data.data.updatedAt || '',
        degraded: Boolean(data.data.degraded),
    };
};

export const saveSystemSettings = async (payload: {
    actorUsername: string;
    aiAssistantEnabled: boolean;
    unifiedNotificationsEnabled: boolean;
}): Promise<boolean> => {
        const data = await callApi<any>('save_system_settings', payload);
        const success = data?.status === 'success';
        if (success && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tohieuquiz:system-settings-updated', {
                detail: {
                    aiAssistantEnabled: payload.aiAssistantEnabled,
                    unifiedNotificationsEnabled: payload.unifiedNotificationsEnabled,
                },
            }));
        }
        if (!success) throw new Error(data?.message || 'Không thể lưu cài đặt hệ thống.');
        return true;
};
