import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

export const DASHBOARD_SEARCH_ITEMS: Array<{
  tab: TeacherDashboardTab;
  label: string;
  keywords: string;
}> = [
  { tab: 'overview', label: 'Tổng quan', keywords: 'dashboard trang chủ thống kê' },
  { tab: 'create', label: 'Tạo đề mới', keywords: 'tạo bài kiểm tra' },
  { tab: 'manage', label: 'Đề kiểm tra', keywords: 'quản lý sửa đề' },
  { tab: 'results', label: 'Kết quả học tập', keywords: 'điểm bài nộp' },
  { tab: 'classes', label: 'Lớp học', keywords: 'học sinh lớp' },
  { tab: 'assignments', label: 'Giao bài', keywords: 'bài tập hạn nộp' },
  { tab: 'homework', label: 'Bài tập tự luận', keywords: 'phiếu bài tập ai' },
  { tab: 'live-exam', label: 'Thi trực tiếp', keywords: 'live exam phòng thi' },
  { tab: 'certificates', label: 'Cấp chứng nhận', keywords: 'giấy khen chứng chỉ' },
  { tab: 'announcements', label: 'Thông báo', keywords: 'cài đặt hệ thống' },
];

export const isGiftShopFeatureEnabled = () => String(
  import.meta.env.VITE_FEATURE_GIFT_SHOP_V2 || 'false',
).toLowerCase() === 'true';
