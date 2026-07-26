import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callApi } from '../src/services/apiAdapter';
import { StorageKeys } from '../src/constants/storageKeys';
import { giftShopService } from '../src/services/giftShop.service';
import type { GiftCatalogItem, GiftOrder } from '../src/types/giftShop.types';

vi.mock('../src/services/apiAdapter', () => ({
    callApi: vi.fn(),
}));

const callApiMock = vi.mocked(callApi);

const catalogItem: GiftCatalogItem = {
    id: 'gift_api_01',
    name: 'API Gift',
    category: 'SUPPLY',
    priceCoins: 250,
    imageUrl: 'https://cdn.test/gift.png',
    isActive: true,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
};

const getPurchasePayload = (overrides: Partial<Parameters<typeof giftShopService.purchase>[0]> = {}) => ({
    studentId: 'stu_001',
    studentName: 'Student One',
    studentUsername: 'student01',
    classId: 'class_3a',
    className: '3A',
    itemId: 'gift_snack_01',
    currentCoins: 500,
    idempotencyKey: 'idem-contract-001',
    ...overrides,
});

describe('giftShopService API contracts', () => {
    beforeEach(() => {
        callApiMock.mockReset();
        vi.stubEnv('VITE_GIFT_SHOP_MODE', 'api');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('keeps API mode and catalog action names while normalizing write payloads', async () => {
        callApiMock
            .mockResolvedValueOnce([catalogItem])
            .mockResolvedValueOnce(catalogItem)
            .mockResolvedValueOnce(catalogItem)
            .mockResolvedValueOnce(catalogItem);

        expect(giftShopService.getMode()).toBe('api');
        await expect(giftShopService.getCatalog()).resolves.toEqual([catalogItem]);
        await giftShopService.upsertCatalogItem({
            name: '  New gift  ',
            category: 'SNACK',
            priceCoins: 199.9,
            imageUrl: '  https://cdn.test/new.png  ',
            actorIsAdmin: true,
        });
        await giftShopService.upsertCatalogItem({
            id: 'gift_api_01',
            name: '  Updated gift  ',
            category: 'PRIVILEGE',
            priceCoins: 401.8,
            imageUrl: '  https://cdn.test/updated.png  ',
            isActive: false,
        });
        await giftShopService.deleteCatalogItem({
            id: 'gift_api_01',
            actorIsAdmin: true,
            actorUsername: 'admin01',
        });

        expect(callApiMock).toHaveBeenNthCalledWith(1, 'get_gift_shop_catalog');
        expect(callApiMock).toHaveBeenNthCalledWith(2, 'create_gift_shop_catalog_item', {
            id: undefined,
            name: 'New gift',
            category: 'SNACK',
            priceCoins: 199,
            imageUrl: 'https://cdn.test/new.png',
            isActive: true,
            actorIsAdmin: true,
        });
        expect(callApiMock).toHaveBeenNthCalledWith(3, 'update_gift_shop_catalog_item', {
            id: 'gift_api_01',
            name: 'Updated gift',
            category: 'PRIVILEGE',
            priceCoins: 401,
            imageUrl: 'https://cdn.test/updated.png',
            isActive: false,
            actorIsAdmin: false,
        });
        expect(callApiMock).toHaveBeenNthCalledWith(4, 'delete_gift_shop_catalog_item', {
            id: 'gift_api_01',
            actorIsAdmin: true,
            actorUsername: 'admin01',
        });
    });

    it('keeps order API actions and payload shapes unchanged', async () => {
        const actor = { username: 'teacher_3a', isAdmin: false, teacherClass: 'class_3a' };
        const query = { status: 'VOUCHER_ISSUED' as const, classId: 'class_3a' };
        const purchasePayload = getPurchasePayload();
        const order = { id: 'order_api_01' } as GiftOrder;
        const purchaseResult = {
            orderId: order.id,
            voucherCode: 'VCH-API-0001',
            newCoins: 380,
            status: 'VOUCHER_ISSUED' as const,
            idempotencyReplay: false,
            order,
        };
        const cancelResult = { order, newCoins: 500 };

        callApiMock
            .mockResolvedValueOnce([order])
            .mockResolvedValueOnce(purchaseResult)
            .mockResolvedValueOnce(order)
            .mockResolvedValueOnce(cancelResult)
            .mockResolvedValueOnce([]);

        await giftShopService.getOrders(query);
        await giftShopService.purchase(purchasePayload);
        await giftShopService.deliverOrder(order.id, actor);
        await giftShopService.cancelOrder(order.id, actor, 'Manual cancel');
        await giftShopService.getEventLogs();

        expect(callApiMock).toHaveBeenNthCalledWith(1, 'get_gift_shop_orders', query);
        expect(callApiMock).toHaveBeenNthCalledWith(2, 'purchase_gift_shop_item', purchasePayload);
        expect(callApiMock).toHaveBeenNthCalledWith(3, 'deliver_gift_shop_order', {
            orderId: order.id,
            ...actor,
        });
        expect(callApiMock).toHaveBeenNthCalledWith(4, 'cancel_gift_shop_order', {
            orderId: order.id,
            reason: 'Manual cancel',
            ...actor,
        });
        expect(callApiMock).toHaveBeenNthCalledWith(5, 'get_gift_shop_event_logs');
    });

    it('converts a non-array API catalog response to an empty catalog', async () => {
        callApiMock.mockResolvedValueOnce({ invalid: true });

        await expect(giftShopService.getCatalog()).resolves.toEqual([]);
    });

    it('keeps the legacy service path as a compatibility barrel', async () => {
        const source = await import('../src/services/giftShop.service?raw');
        expect(source.default.trim()).toBe("export * from './gift-shop';");
    });
});

describe('giftShopService mock catalog and query contracts', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv('VITE_GIFT_SHOP_MODE', 'mock');
    });

    afterEach(() => {
        localStorage.removeItem(StorageKeys.GIFT_SHOP_MOCK_STATE);
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it('sorts the active default catalog and records create, update, and delete events', async () => {
        expect(giftShopService.getMode()).toBe('mock');
        await expect(giftShopService.getCatalog()).resolves.toMatchObject([
            { id: 'gift_privilege_01' },
            { id: 'gift_snack_01' },
            { id: 'gift_supply_01' },
        ]);

        const created = await giftShopService.upsertCatalogItem({
            name: '  Sticker pack  ',
            category: 'SUPPLY',
            priceCoins: 225.8,
            imageUrl: '  https://cdn.test/stickers.png  ',
            actorIsAdmin: true,
        });
        expect(created).toMatchObject({
            name: 'Sticker pack',
            priceCoins: 225,
            imageUrl: 'https://cdn.test/stickers.png',
            isActive: true,
        });

        const updated = await giftShopService.upsertCatalogItem({
            id: created.id,
            name: 'Sticker pack XL',
            category: 'PRIVILEGE',
            priceCoins: 350,
            imageUrl: 'https://cdn.test/stickers-xl.png',
            actorIsAdmin: true,
        });
        expect(updated).toMatchObject({ id: created.id, name: 'Sticker pack XL', priceCoins: 350 });

        await giftShopService.deleteCatalogItem({
            id: created.id,
            actorIsAdmin: true,
            actorUsername: 'admin01',
        });

        const catalog = await giftShopService.getCatalog();
        expect(catalog.some((item) => item.id === created.id)).toBe(false);
        await expect(giftShopService.getEventLogs()).resolves.toMatchObject([
            { type: 'CATALOG_DELETED', actor: 'admin01', metadata: { itemId: created.id } },
            { type: 'CATALOG_UPDATED', metadata: { itemId: created.id, priceCoins: 350 } },
            { type: 'CATALOG_CREATED', metadata: { itemId: created.id, priceCoins: 225 } },
        ]);
    });

    it('filters orders by student, class, and status and sorts newest updates first', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-19T01:00:00.000Z'));
        const first = await giftShopService.purchase(getPurchasePayload());

        vi.setSystemTime(new Date('2026-07-19T02:00:00.000Z'));
        const second = await giftShopService.purchase(getPurchasePayload({
            studentId: 'stu_002',
            studentName: 'Student Two',
            studentUsername: 'student02',
            classId: 'class_4a',
            className: '4A',
            idempotencyKey: 'idem-contract-002',
        }));

        await expect(giftShopService.getOrders({ status: 'ALL' })).resolves.toMatchObject([
            { id: second.orderId },
            { id: first.orderId },
        ]);
        await expect(giftShopService.getOrders({ studentId: 'stu_001' })).resolves.toMatchObject([
            { id: first.orderId },
        ]);
        await expect(giftShopService.getOrders({ classId: 'class_4a', status: 'VOUCHER_ISSUED' })).resolves.toMatchObject([
            { id: second.orderId },
        ]);
        await expect(giftShopService.getOrders({ classId: 'class_3a', status: 'DELIVERED' })).resolves.toEqual([]);
    });

    it('falls back from corrupt storage and preserves public validation errors', async () => {
        localStorage.setItem(StorageKeys.GIFT_SHOP_MOCK_STATE, '{broken-json');
        await expect(giftShopService.getCatalog()).resolves.toHaveLength(3);

        await expect(giftShopService.upsertCatalogItem({
            name: ' ',
            category: 'SNACK',
            priceCoins: 0,
            imageUrl: ' ',
        })).rejects.toThrow('Tên quà không được để trống.');
        await expect(giftShopService.deleteCatalogItem({
            id: '',
            actorIsAdmin: true,
        })).rejects.toThrow('Thiếu mã quà để xóa.');
        await expect(giftShopService.deleteCatalogItem({
            id: 'gift_snack_01',
            actorIsAdmin: false,
        })).rejects.toThrow('Bạn không có quyền xóa quà.');
    });
});
