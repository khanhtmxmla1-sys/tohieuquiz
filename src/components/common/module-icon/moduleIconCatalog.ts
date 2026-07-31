export const MODULE_ICON_SIZES = { sm: 40, md: 48, lg: 64, xl: 80 } as const;
export const MODULE_ICON_CATALOG = {
  'question-bank': { label: 'Ngân hàng câu hỏi', src: '/assets/module-icons/question-bank-v2.webp' },
  students: { label: 'Học sinh', src: '/assets/module-icons/students-v2.webp' },
  achievements: { label: 'Thành tích và bảng vàng', src: '/assets/module-icons/achievements-v2.webp' },
  'analytics-report': { label: 'Báo cáo phân tích', src: '/assets/module-icons/analytics-report-v2.webp' },
  'learning-resources': { label: 'Kho học liệu', src: '/assets/module-icons/learning-resources-v2.webp' },
  store: { label: 'Cửa hàng', src: '/assets/module-icons/store-v2.webp' },
  competition: { label: 'Cuộc thi', src: '/assets/module-icons/competition-v2.webp' },
  tasks: { label: 'Nhiệm vụ', src: '/assets/module-icons/tasks-v2.webp' },
  'system-settings': { label: 'Cài đặt hệ thống', src: '/assets/module-icons/system-settings-v2.webp' },
} as const;
export type ModuleIconName = keyof typeof MODULE_ICON_CATALOG;
export type ModuleIconSize = keyof typeof MODULE_ICON_SIZES;
