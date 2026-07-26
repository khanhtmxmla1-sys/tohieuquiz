import type { GiftCatalogItem } from '../../types/giftShop.types';
import { toApiCatalogPayload } from './catalogPayload';
import { readMockState, saveMockState } from './mockState';
import { nowIso, pushEvent, randomId } from './mockStateHelpers';
import type { GiftCatalogDeleteInput, GiftCatalogUpsertInput } from './types';

export const getCatalogMock = async (): Promise<GiftCatalogItem[]> => {
    const state = readMockState();
    return state.catalog
        .filter((item) => item.isActive)
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
};

export const upsertCatalogItemMock = async (
    input: GiftCatalogUpsertInput
): Promise<GiftCatalogItem> => {
    const normalized = toApiCatalogPayload(input);
    if (!normalized.name) throw new Error('Tên quà không được để trống.');
    if (!normalized.imageUrl) throw new Error('Link ảnh không được để trống.');
    if (!Number.isFinite(normalized.priceCoins) || normalized.priceCoins <= 0) {
        throw new Error('Giá xu phải lớn hơn 0.');
    }

    const state = readMockState();
    const now = nowIso();
    if (normalized.id) {
        const index = state.catalog.findIndex((item) => item.id === normalized.id);
        if (index < 0) throw new Error('Không tìm thấy quà để cập nhật.');
        const updated: GiftCatalogItem = {
            ...state.catalog[index],
            name: normalized.name,
            category: normalized.category,
            priceCoins: normalized.priceCoins,
            imageUrl: normalized.imageUrl,
            isActive: normalized.isActive ?? true,
            updatedAt: now,
        };
        state.catalog[index] = updated;
        pushEvent(state, {
            type: 'CATALOG_UPDATED',
            metadata: { itemId: updated.id, priceCoins: updated.priceCoins },
        });
        saveMockState(state);
        return updated;
    }

    const created: GiftCatalogItem = {
        id: randomId('gift'),
        name: normalized.name,
        category: normalized.category,
        priceCoins: normalized.priceCoins,
        imageUrl: normalized.imageUrl,
        isActive: normalized.isActive ?? true,
        createdAt: now,
        updatedAt: now,
    };
    state.catalog.unshift(created);
    pushEvent(state, {
        type: 'CATALOG_CREATED',
        metadata: { itemId: created.id, priceCoins: created.priceCoins },
    });
    saveMockState(state);
    return created;
};

export const deleteCatalogItemMock = async (
    input: GiftCatalogDeleteInput
): Promise<GiftCatalogItem> => {
    if (!input.id.trim()) throw new Error('Thiếu mã quà để xóa.');
    if (!input.actorIsAdmin) throw new Error('Bạn không có quyền xóa quà.');

    const state = readMockState();
    const index = state.catalog.findIndex((item) => item.id === input.id);
    if (index < 0) throw new Error('Không tìm thấy quà để xóa.');

    const updated = { ...state.catalog[index], isActive: false, updatedAt: nowIso() };
    state.catalog[index] = updated;
    pushEvent(state, {
        type: 'CATALOG_DELETED',
        actor: input.actorUsername || 'admin',
        metadata: { itemId: updated.id },
    });
    saveMockState(state);
    return updated;
};
