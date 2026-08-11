import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

export type DashboardSearchDestination =
  | {
    id: string;
    kind: 'tab';
    tab: TeacherDashboardTab;
    label: string;
    keywords: string;
  }
  | {
    id: 'manual-quiz';
    kind: 'manual-quiz';
    label: string;
    keywords: string;
  };

export const DASHBOARD_SEARCH_ITEMS: DashboardSearchDestination[] = [
  { id: 'overview', kind: 'tab', tab: 'overview', label: 'Tổng quan', keywords: 'dashboard trang chủ thống kê' },
  {
    id: 'create',
    kind: 'tab',
    tab: 'create',
    label: 'Tạo đề bằng AI',
    keywords: 'tạo đề mới ai trí tuệ nhân tạo chủ đề nội dung pdf',
  },
  {
    id: 'manual-quiz',
    kind: 'manual-quiz',
    label: 'Soạn đề thủ công',
    keywords: 'tạo đề thủ công nhập từng câu trình soạn đề',
  },
  { id: 'manage', kind: 'tab', tab: 'manage', label: 'Đề kiểm tra', keywords: 'quản lý sửa đề' },
  { id: 'results', kind: 'tab', tab: 'results', label: 'Kết quả học tập', keywords: 'điểm bài nộp' },
  { id: 'classes', kind: 'tab', tab: 'classes', label: 'Lớp học', keywords: 'học sinh lớp' },
  { id: 'assignments', kind: 'tab', tab: 'assignments', label: 'Giao bài', keywords: 'bài tập hạn nộp' },
  { id: 'homework', kind: 'tab', tab: 'homework', label: 'Bài tập tự luận', keywords: 'phiếu bài tập ai' },
  { id: 'live-exam', kind: 'tab', tab: 'live-exam', label: 'Thi trực tiếp', keywords: 'live exam phòng thi' },
  { id: 'certificates', kind: 'tab', tab: 'certificates', label: 'Cấp chứng nhận', keywords: 'giấy khen chứng chỉ' },
  { id: 'announcements', kind: 'tab', tab: 'announcements', label: 'Thông báo', keywords: 'cài đặt hệ thống' },
  { id: 'feature-rollout', kind: 'tab', tab: 'feature-rollout', label: 'Tính năng thử nghiệm', keywords: 'feature rollout bật tắt tính năng thử nghiệm' },
  { id: 'operations', kind: 'tab', tab: 'operations', label: 'Operations Center', keywords: 'health dependency operations request id release' },
];

export const isGiftShopFeatureEnabled = () => String(
  import.meta.env.VITE_FEATURE_GIFT_SHOP_V2 || 'false',
).toLowerCase() === 'true';
