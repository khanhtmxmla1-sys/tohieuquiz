import type { GiftCategory, GiftOrderStatus, GiftShopEventLog } from '../../../types/giftShop.types';
import type { GiftCatalogFormState } from './types';

export const CATEGORY_OPTIONS: Array<{ value: GiftCategory; label: string }> = [
  { value: 'SNACK', label: 'Ăn vặt' },
  { value: 'SUPPLY', label: 'Đồ dùng học tập' },
  { value: 'PRIVILEGE', label: 'Đặc quyền lớp' },
];
export const STATUS_OPTIONS: Array<{ value: GiftOrderStatus | 'ALL'; label: string }> = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Chờ trao' },
  { value: 'DELIVERED', label: 'Đã trao' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'ALL', label: 'Tất cả' },
];
export const CATEGORY_LABEL_MAP: Record<GiftCategory, string> = { SNACK: 'Ăn vặt', SUPPLY: 'Đồ dùng học tập', PRIVILEGE: 'Đặc quyền lớp' };
export const STATUS_LABEL_MAP: Record<GiftOrderStatus, string> = {
  PENDING: 'Chờ giáo viên duyệt', APPROVED: 'Đã duyệt · chờ trao', DELIVERED: 'Đã trao quà', CANCELLED: 'Đã hủy và hoàn xu',
};
export const STATUS_CLASS_MAP: Record<GiftOrderStatus, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800',
  APPROVED: 'border-sky-200 bg-sky-50 text-sky-800',
  DELIVERED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  CANCELLED: 'border-rose-200 bg-rose-50 text-rose-800',
};
export const EVENT_LABEL_MAP: Record<GiftShopEventLog['type'], string> = {
  ORDER_CREATED: 'Đã tạo đơn đổi quà', ORDER_APPROVED: 'Đã duyệt và cấp mã nhận quà',
  ORDER_DELIVERED: 'Giáo viên đã trao quà', ORDER_CANCELLED: 'Đã hủy đơn đổi quà',
  WALLET_REFUNDED: 'Đã hoàn xu cho học sinh', CATALOG_UPDATED: 'Đã cập nhật món quà',
  CATALOG_CREATED: 'Đã thêm món quà', CATALOG_DELETED: 'Đã ngừng món quà',
  SHOP_SCOPE_UPDATED: 'Đã cập nhật trạng thái tiệm',
};
export const EMPTY_CATALOG_FORM: GiftCatalogFormState = {
  name: '', category: 'SNACK', priceCoins: '', imageUrl: '', stockTotal: '100',
  lowStockThreshold: '5', weeklyLimitPerStudent: '1', scopeType: 'SCHOOL',
  schoolId: '', classId: '', gradeLevel: '',
};
