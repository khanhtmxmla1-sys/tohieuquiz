export const TEACHER_ACTION_CENTER_MAX_ITEMS = 8;

export type TeacherActionKind =
  | 'assignment_at_risk'
  | 'draft_unpublished'
  | 'gift_order_pending'
  | 'gift_low_stock'
  | 'live_exam_upcoming';

export type TeacherActionSeverity = 'critical' | 'warning' | 'info';

export interface TeacherActionCta {
  label: string;
  url: string;
}

export interface TeacherActionItem {
  id: string;
  kind: TeacherActionKind;
  severity: TeacherActionSeverity;
  title: string;
  explanation: string;
  count: number;
  generatedAt: string;
  cta: TeacherActionCta;
}

export interface TeacherActionCenter {
  generatedAt: string;
  items: TeacherActionItem[];
}

export interface TeacherActionCenterResponse {
  status: 'success';
  data: TeacherActionCenter;
}
