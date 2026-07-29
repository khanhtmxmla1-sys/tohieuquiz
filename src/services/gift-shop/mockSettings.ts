import type { GiftShopSettingsResponse, GiftShopSettingsUpdate } from '../../types/giftShop.types';
import { readMockState, saveMockState } from './mockState';
import { nowIso, pushEvent, randomId } from './mockStateHelpers';

export const getSettingsMock = async (): Promise<GiftShopSettingsResponse> => readMockState().settings;
export const updateSettingsMock = async (input: GiftShopSettingsUpdate): Promise<GiftShopSettingsResponse> => {
    if (!input.isOpen && !String(input.closedReason || '').trim()) throw new Error('Vui lòng nhập lý do đóng tiệm.');
    const state = readMockState();
    const now = nowIso();
    const setting = {
        id: randomId('gset'), scope_type: input.scopeType, school_id: input.schoolId || '',
        class_id: input.scopeType === 'CLASS' ? input.classId || '' : '', is_open: input.isOpen ? 1 : 0,
        closed_reason: input.isOpen ? '' : String(input.closedReason || '').trim(), updated_by: 'mock-user', updated_at: now,
    } as const;
    state.settings = {
        effective: { isOpen: input.isOpen, closedReason: setting.closed_reason, closedScope: input.isOpen ? null : input.scopeType, schoolId: setting.school_id, classId: setting.class_id },
        settings: [setting, ...state.settings.settings.filter((item) => !(item.scope_type === setting.scope_type && item.school_id === setting.school_id && item.class_id === setting.class_id))],
    };
    pushEvent(state, { type: 'SHOP_SCOPE_UPDATED', actor: 'mock-user', metadata: { scopeType: input.scopeType, isOpen: input.isOpen } });
    saveMockState(state);
    return state.settings;
};
