import type {
  ParentApiSuccess,
  ParentCertificateHistoryItem,
  ParentDashboardPayload,
  ParentHistoryPage,
  ParentHomeworkHistoryItem,
  ParentNotificationKind,
  ParentResultHistoryItem,
} from '../../../shared/parent-portal.contract';
import { executeApiAction } from '../../services/api/apiClient';
import type {
  ParentActivationPreview,
  ParentAnnouncementView,
  ParentDeliveryView,
  ParentLinkSafeView,
  ParentNotificationPage,
  ParentSessionResponse,
} from './types';

const unwrap = async <T>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
  const response = await executeApiAction<ParentApiSuccess<T>>(action, payload);
  return response.data;
};

export const getParentActivation = (token: string) => unwrap<ParentActivationPreview>(
  'get_parent_activation', { token },
);
export const activate = (token: string, pin: string) => unwrap<ParentSessionResponse>(
  'activate_parent_link', { token, pin },
);
export const login = (accessCode: string, pin: string) => unwrap<ParentSessionResponse>(
  'parent_login', { accessCode, pin },
);
export const getSession = () => unwrap<ParentSessionResponse>('get_parent_session');
export const logout = async (): Promise<void> => {
  await executeApiAction('parent_logout');
};
export const getDashboard = (weekStart?: string) => unwrap<ParentDashboardPayload>(
  'get_parent_dashboard', weekStart ? { weekStart } : {},
);
export const listNotifications = (input: {
  kind?: ParentNotificationKind;
  unread?: boolean;
  cursor?: string;
  limit?: number;
} = {}) => unwrap<ParentNotificationPage>('list_parent_notifications', input);
export const markNotificationRead = (notificationId: string) => unwrap<{
  id: string;
  isRead: boolean;
  readAt?: string;
}>('mark_parent_notification_read', { notificationId });
export const markAllNotificationsRead = () => unwrap<{ updatedCount: number }>(
  'mark_all_parent_notifications_read',
);

export const listResults = (filters: Record<string, unknown> = {}) => unwrap<
  ParentHistoryPage<ParentResultHistoryItem>
>('list_parent_results', filters);
export const getResult = (resultId: string) => unwrap<ParentResultHistoryItem>(
  'get_parent_result', { resultId },
);
export const listAssignments = (filters: Record<string, unknown> = {}) => unwrap<
  ParentHistoryPage<ParentHomeworkHistoryItem>
>('list_parent_assignments', filters);
export const listCertificates = (filters: Record<string, unknown> = {}) => unwrap<
  ParentHistoryPage<ParentCertificateHistoryItem>
>('list_parent_certificates', filters);

export const createParentLink = (studentId: string) => unwrap<{
  link: ParentLinkSafeView;
  activationUrl?: string;
}>('create_parent_link', { studentId });
export const getParentLink = (studentId: string) => unwrap<{
  link: ParentLinkSafeView | null;
}>('get_parent_link', { studentId });
export const reissueParentLink = (linkId: string) => unwrap<{
  link: ParentLinkSafeView;
  activationUrl: string;
}>('reissue_parent_link', { linkId });
export const revokeParentLink = (linkId: string) => unwrap<{
  id: string;
  status: 'REVOKED';
}>('revoke_parent_link', { linkId });

export const createParentAnnouncement = (input: {
  classId: string;
  title: string;
  body: string;
  isImportant: boolean;
  expiresAt?: string;
}) => unwrap<{
  announcement: ParentAnnouncementView;
  delivery: { targetCount: number; createdCount: number };
}>('create_parent_announcement', input);
export const listParentAnnouncements = (classId: string) => unwrap<{
  items: ParentAnnouncementView[];
}>('list_parent_announcements', { classId });
export const revokeParentAnnouncement = (announcementId: string) => unwrap<{
  id: string;
  status: 'REVOKED';
}>('revoke_parent_announcement', { announcementId });
export const getParentDelivery = (classId: string, kind?: ParentNotificationKind) => unwrap<{
  items: ParentDeliveryView[];
}>('get_parent_delivery', { classId, kind });
