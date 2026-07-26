import { jsonResponse } from '../../utils/response';
import { mapOrder } from './mappers';
import type { GiftOrderRow } from './types';

export const purchaseResponse = (
    order: GiftOrderRow,
    newCoins: number,
    idempotencyReplay: boolean,
    orderId = order.id,
    voucherCode = order.voucher_code,
): Response => jsonResponse({
    orderId,
    voucherCode,
    newCoins,
    status: order.status,
    idempotencyReplay,
    order: mapOrder(order),
});
