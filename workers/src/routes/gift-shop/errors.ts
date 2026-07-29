import { errorResponse } from '../../utils/response';

const DATABASE_ERRORS: Array<{ code: string; status: number; message: string }> = [
    { code: 'GIFT_ITEM_UNAVAILABLE', status: 409, message: 'Phần thưởng không còn khả dụng.' },
    { code: 'GIFT_OUT_OF_STOCK', status: 409, message: 'Phần thưởng đã hết hàng.' },
    { code: 'GIFT_WEEKLY_LIMIT', status: 409, message: 'Em đã đạt giới hạn đổi món quà này trong tuần.' },
    { code: 'GIFT_SHOP_CLOSED', status: 409, message: 'Tiệm tạp hóa đang tạm đóng.' },
    { code: 'GIFT_INSUFFICIENT_COINS', status: 409, message: 'Không đủ xu để đổi quà.' },
    { code: 'GIFT_PRICE_MISMATCH', status: 409, message: 'Giá phần thưởng đã thay đổi. Vui lòng tải lại.' },
    { code: 'GIFT_SCOPE_FORBIDDEN', status: 403, message: 'Phần thưởng không áp dụng cho lớp của em.' },
    { code: 'GIFT_STUDENT_SCOPE', status: 403, message: 'Không thể đổi quà cho học sinh ngoài phạm vi.' },
    { code: 'GIFT_INVALID_TRANSITION', status: 409, message: 'Trạng thái đơn không cho phép thao tác này.' },
    { code: 'GIFT_TRANSITION_AUDIT_REQUIRED', status: 409, message: 'Thiếu thông tin kiểm toán cho thao tác.' },
    { code: 'GIFT_VOUCHER_REQUIRED', status: 409, message: 'Không thể duyệt đơn khi chưa có mã nhận quà.' },
    { code: 'GIFT_CANCEL_REASON_REQUIRED', status: 400, message: 'Vui lòng nhập lý do hủy đơn.' },
];

export const mapGiftShopDatabaseError = (error: unknown): Response | null => {
    const text = error instanceof Error ? error.message : String(error || '');
    const matched = DATABASE_ERRORS.find((entry) => text.includes(entry.code));
    return matched ? errorResponse(matched.message, matched.status) : null;
};
