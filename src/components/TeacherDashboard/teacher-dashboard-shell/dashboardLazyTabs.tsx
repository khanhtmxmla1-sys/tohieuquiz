import React from 'react';

export const OverviewTab = React.lazy(() => import('../OverviewTab'));
export const ResultsTab = React.lazy(() => import('../ResultsTab'));
export const ManageTab = React.lazy(() => import('../ManageTab'));
export const CreateTab = React.lazy(() => import('../CreateTab'));
export const AnnouncementSettings = React.lazy(() => import('../AnnouncementSettings'));
export const ClassManagementTab = React.lazy(() => import('../ClassManagementTab'));
export const AssignmentTab = React.lazy(() => import('../AssignmentTab'));
export const TeacherManagementTab = React.lazy(() => import('../TeacherManagementTab'));
export const GiftShopTab = React.lazy(() => import('../GiftShopTab'));
export const HomeworkTab = React.lazy(() => import('../../../features/homework/components/HomeworkTab')
  .then(module => ({ default: module.HomeworkTab })));
export const LiveExamTab = React.lazy(() => import('../../LiveExam/TeacherLiveExamDashboardContainer'));
export const TeacherCertificatesPage = React.lazy(() => import('../../../features/certificates/TeacherCertificatesPage'));
export const AdminTemplatesPage = React.lazy(() => import('../../../features/certificates/AdminTemplatesPage'));
export const MathAuditPage = React.lazy(() => import('../../../features/math-audit/MathAuditPage'));
export const PersonalSettingsTab = React.lazy(() => import('../PersonalSettingsTab'));
