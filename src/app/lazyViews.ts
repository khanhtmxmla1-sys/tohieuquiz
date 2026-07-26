import React from 'react';

export const StudentView = React.lazy(() => import('../components/StudentView'));
export const TeacherDashboard = React.lazy(() => import('../components/TeacherDashboard'));
export const TeacherResultDetailPage = React.lazy(() => import('../components/TeacherDashboard/TeacherResultDetailPage'));
export const GiftShop = React.lazy(() => import('../components/gamification/GiftShop'));
export const HomePage = React.lazy(() => import('../components/HomePage/HomePage'));
export const PrivacyPolicy = React.lazy(() => import('../components/legal/PrivacyPolicy'));
export const TermsOfService = React.lazy(() => import('../components/legal/TermsOfService'));
export const Footer = React.lazy(() => import('../components/common/Footer'));
export const AboutPage = React.lazy(() => import('../components/schoolPage/AboutPage'));
export const ContactPage = React.lazy(() => import('../components/schoolPage/ContactPage'));
export const PhieuPublicPage = React.lazy(() => import('../pages/PhieuPublicPage'));
export const ManualQuizWorkspacePage = React.lazy(() => import('../features/manual-quiz-workspace/ManualQuizWorkspacePage'));
export const ParentPortalApp = React.lazy(() => import('../features/parent-portal/ParentPortalApp'));
