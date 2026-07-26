export type {
  ParentApiError,
  ParentApiSuccess,
  ParentCertificateHistoryItem,
  ParentDashboardPayload,
  ParentHistoryPage,
  ParentHomeworkHistoryItem,
  ParentNotificationItem,
  ParentNotificationKind,
  ParentResultHistoryItem,
  ParentStudentProfile,
} from '../../../shared/parent-portal.contract';

import type {
  ParentNotificationItem,
  ParentStudentProfile,
} from '../../../shared/parent-portal.contract';

export interface ParentSessionResponse {
  student: ParentStudentProfile;
  accessCodeMasked?: string;
}

export interface ParentActivationPreview {
  student: Omit<ParentStudentProfile, 'id'>;
  expiresAt: string;
}

export interface ParentNotificationPage {
  items: ParentNotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface ParentAnnouncementView {
  id: string;
  classId: string;
  title: string;
  body: string;
  isImportant: boolean;
  status: 'PUBLISHED' | 'REVOKED';
  createdBy: string;
  publishedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  targetCount: number;
  readCount: number;
  unreadCount: number;
}

export interface ParentDeliveryView {
  studentId: string;
  studentName: string;
  parentAccessStatus: 'not_issued' | 'pending' | 'active' | 'revoked';
  unreadCount: number;
  lastViewedAt: string | null;
}

export interface ParentLinkSafeView {
  id: string;
  studentId: string;
  accessCode: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  tokenVersion: number;
  createdBy: string;
  createdAt: string;
  activatedAt: string | null;
  revokedAt: string | null;
  lastAccessedAt: string | null;
}
