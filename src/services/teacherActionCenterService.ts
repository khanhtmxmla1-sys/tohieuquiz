import type {
  TeacherActionCenter,
  TeacherActionCenterResponse,
  TeacherActionItem,
  TeacherActionMutation,
} from '../../shared/teacher-action-center.contract';
import { callApi } from './apiAdapter';

const isSecondaryAction = (value: unknown): value is TeacherActionMutation => {
  if (!value || typeof value !== 'object') return false;
  const action = value as Partial<TeacherActionMutation>;
  return action.kind === 'delete_draft'
    && typeof action.label === 'string'
    && action.label.trim().length > 0
    && typeof action.resourceId === 'string'
    && action.resourceId.trim().length > 0
    && typeof action.resourceLabel === 'string'
    && action.resourceLabel.trim().length > 0
    && typeof action.ownerUsername === 'string'
    && action.ownerUsername.trim().length > 0;
};

const isActionItem = (value: unknown): value is TeacherActionItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TeacherActionItem>;
  const secondaryActionValid = item.secondaryAction === undefined
    || (item.kind === 'draft_unpublished' && isSecondaryAction(item.secondaryAction));

  return typeof item.id === 'string'
    && typeof item.kind === 'string'
    && ['critical', 'warning', 'info'].includes(String(item.severity))
    && typeof item.title === 'string'
    && typeof item.explanation === 'string'
    && typeof item.count === 'number'
    && typeof item.generatedAt === 'string'
    && Boolean(item.cta && typeof item.cta.label === 'string' && typeof item.cta.url === 'string')
    && String(item.cta?.url || '').startsWith('/teacher/')
    && secondaryActionValid;
};

const isActionCenter = (value: unknown): value is TeacherActionCenter => {
  if (!value || typeof value !== 'object') return false;
  const center = value as Partial<TeacherActionCenter>;
  return typeof center.generatedAt === 'string'
    && Array.isArray(center.items)
    && center.items.length <= 8
    && center.items.every(isActionItem);
};

export async function fetchTeacherActionCenter(): Promise<TeacherActionCenter> {
  const response = await callApi<TeacherActionCenterResponse>('get_teacher_action_center');
  if (response?.status !== 'success' || !isActionCenter(response.data)) {
    throw new Error('Dữ liệu việc cần chú ý không hợp lệ.');
  }
  return response.data;
}
