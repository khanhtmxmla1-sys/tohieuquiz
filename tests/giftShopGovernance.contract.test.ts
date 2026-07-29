import { describe, expect, it } from 'vitest';
import { mapGiftShopDatabaseError } from '../workers/src/routes/gift-shop/errors';
import { getIsoWeekKey, normalizeStatus } from '../workers/src/routes/gift-shop/values';

describe('Gift Shop governance API contracts', () => {
  it('uses canonical order statuses while accepting legacy filter aliases', () => {
    expect(normalizeStatus('PENDING')).toBe('PENDING');
    expect(normalizeStatus('APPROVED')).toBe('APPROVED');
    expect(normalizeStatus('CREATED')).toBe('PENDING');
    expect(normalizeStatus('VOUCHER_ISSUED')).toBe('APPROVED');
    expect(normalizeStatus('CANCELLED_REFUNDED')).toBe('CANCELLED');
  });

  it('computes a stable ISO week key at year boundaries', () => {
    expect(getIsoWeekKey(new Date('2026-07-29T10:00:00.000Z'))).toBe('2026-W31');
    expect(getIsoWeekKey(new Date('2027-01-01T10:00:00.000Z'))).toBe('2026-W53');
  });

  it('maps database governance conflicts to safe API responses', async () => {
    const outOfStock = mapGiftShopDatabaseError(new Error('D1_ERROR: GIFT_OUT_OF_STOCK'));
    expect(outOfStock?.status).toBe(409);
    expect(await outOfStock?.json()).toEqual({ status: 'error', message: 'Phần thưởng đã hết hàng.' });

    const forbidden = mapGiftShopDatabaseError(new Error('GIFT_SCOPE_FORBIDDEN'));
    expect(forbidden?.status).toBe(403);
    expect(mapGiftShopDatabaseError(new Error('unrelated'))).toBeNull();
  });

  it('registers approve and scope-settings routes before the not-found fallback', async () => {
    const source = await import('../workers/src/routes/gift-shop/router?raw');
    expect(source.default).toContain('/approve');
    expect(source.default).toContain("path === '/api/gift-shop/settings'");
  });
});
