export const MODULE_ICON_SIZES = { sm: 40, md: 48, lg: 64, xl: 80 } as const;
export const MODULE_ICON_CATALOG = {
  'question-bank': { label: 'Ngân hàng câu hỏi', src: '/assets/module-icons/question-bank.webp' },
  students: { label: 'Học sinh', src: '/assets/module-icons/students.webp' },
  achievements: { label: 'Thành tích và bảng vàng', src: '/assets/module-icons/achievements.webp' },
  'analytics-report': { label: 'Báo cáo phân tích', src: '/assets/module-icons/analytics-report.webp' },
  'learning-resources': { label: 'Kho học liệu', src: '/assets/module-icons/learning-resources.webp' },
  store: { label: 'Cửa hàng', src: '/assets/module-icons/store.webp' },
  competition: { label: 'Cuộc thi', src: '/assets/module-icons/competition.webp' },
  tasks: { label: 'Nhiệm vụ', src: '/assets/module-icons/tasks.webp' },
  'system-settings': { label: 'Cài đặt hệ thống', src: '/assets/module-icons/system-settings.webp' },
} as const;
export type ModuleIconName = keyof typeof MODULE_ICON_CATALOG;
export type ModuleIconSize = keyof typeof MODULE_ICON_SIZES;
