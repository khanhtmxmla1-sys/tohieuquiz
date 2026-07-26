import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { giftShopService } from '../src/services/giftShop.service';
import { StorageKeys } from '../src/constants/storageKeys';

vi.mock('../src/services/apiAdapter', () => ({
    callApi: vi.fn(),
}));

const getPurchasePayload = (overrides: Partial<Parameters<typeof giftShopService.purchase>[0]> = {}) => ({
    studentId: 'stu_001',
    studentName: 'Student One',
    studentUsername: 'student01',
    classId: 'class_3a',
    className: '3A',
    itemId: 'gift_snack_01',
    currentCoins: 500,
    idempotencyKey: 'idem-001',
    ...overrides,
});

describe('giftShopService (mock mode)', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv('VITE_GIFT_SHOP_MODE', 'mock');
    });

    afterEach(() => {
        localStorage.removeItem(StorageKeys.GIFT_SHOP_MOCK_STATE);
        vi.unstubAllEnvs();
    });

    it('is idempotent for repeated purchase with the same key', async () => {
        const first = await giftShopService.purchase(getPurchasePayload());
        const second = await giftShopService.purchase(getPurchasePayload());

        expect(first.idempotencyReplay).toBe(false);
        expect(second.idempotencyReplay).toBe(true);
        expect(second.orderId).toBe(first.orderId);
        expect(second.voucherCode).toBe(first.voucherCode);
        expect(second.newCoins).toBe(first.newCoins);

        const orders = await giftShopService.getOrders({ studentId: 'stu_001' });
        expect(orders).toHaveLength(1);
    });

    it('refunds 100% coins on cancel', async () => {
        const purchase = await giftShopService.purchase(getPurchasePayload());
        const result = await giftShopService.cancelOrder(
            purchase.orderId,
            { username: 'teacher_3a', isAdmin: false, teacherClass: 'class_3a' },
            'Cancel for test'
        );

        expect(result.order.status).toBe('CANCELLED_REFUNDED');
        expect(result.newCoins).toBe(500);

        const updated = await giftShopService.getOrders({ studentId: 'stu_001' });
        expect(updated[0]?.status).toBe('CANCELLED_REFUNDED');
    });

    it('blocks teacher from managing orders outside their class', async () => {
        const purchase = await giftShopService.purchase(getPurchasePayload());

        await expect(
            giftShopService.deliverOrder(purchase.orderId, {
                username: 'teacher_4a',
                isAdmin: false,
                teacherClass: 'class_4a',
            })
        ).rejects.toThrow();
    });

    it('rejects invalid order state transitions', async () => {
        const purchase = await giftShopService.purchase(getPurchasePayload());
        await giftShopService.deliverOrder(purchase.orderId, {
            username: 'teacher_3a',
            isAdmin: false,
            teacherClass: 'class_3a',
        });

        await expect(
            giftShopService.deliverOrder(purchase.orderId, {
                username: 'teacher_3a',
                isAdmin: false,
                teacherClass: 'class_3a',
            })
        ).rejects.toThrow();

        await expect(
            giftShopService.cancelOrder(
                purchase.orderId,
                { username: 'teacher_3a', isAdmin: false, teacherClass: 'class_3a' },
                'Cannot cancel delivered order'
            )
        ).rejects.toThrow();
    });

    it('prevents purchase when coins are insufficient', async () => {
        await expect(
            giftShopService.purchase(
                getPurchasePayload({
                    currentCoins: 20,
                    idempotencyKey: 'idem-insufficient',
                })
            )
        ).rejects.toThrow();
    });
});
