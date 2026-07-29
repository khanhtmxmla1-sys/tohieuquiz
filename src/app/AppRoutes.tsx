import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { useQuizStore } from '../../stores/quizStore';
import {
    AboutPage,
    ContactPage,
    GiftShop,
    ManualQuizWorkspacePage,
    PhieuPublicPage,
    PrivacyPolicy,
    StudentDashboardUI,
    TeacherDashboard,
    TeacherResultDetailPage,
    TermsOfService,
} from './lazyViews';
import { PageLoading } from './PageLoading';
import { PublicPageLayout } from './PublicPageLayout';
import { RootView } from './RootView';
import type { RoutePath } from './routeTypes';
import { isManualQuizWorkspaceEnabled } from '../config/featureFlags';
import { ProtectedRoute } from './ProtectedRoute';

interface AppRoutesProps {
    giftShopEnabled: boolean;
    manualQuizWorkspaceEnabled?: boolean;
    sessionsReady?: boolean;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
    giftShopEnabled,
    manualQuizWorkspaceEnabled = isManualQuizWorkspaceEnabled(),
    sessionsReady = true,
}) => {
    const quizStore = useQuizStore();
    const navigate = useNavigate();
    const location = useLocation();
    const onNavigate = (path: RoutePath) => navigate(path);
    const goBackHome = () => {
        quizStore.goHome();
        // Same reason as TeacherResultDetailPage.handleBack: navigate('/') is a PUSH and
        // useScrollReset sends those to the top, so a reader who opened the policy from the home
        // page footer would come back to the top of home instead of the footer they left.
        // react-router keys the first history entry "default", so a deep link or a fresh tab still
        // gets a replace and is never walked off the site.
        if (location.key === 'default') navigate('/', { replace: true });
        else navigate(-1);
    };
    const suspended = (content: React.ReactNode) => <Suspense fallback={<PageLoading />}>{content}</Suspense>;
    const protectedRoute = (role: 'teacher' | 'student', content: React.ReactNode) => (
        <ProtectedRoute role={role} sessionsReady={sessionsReady}>
            {suspended(content)}
        </ProtectedRoute>
    );

    return (
        <Routes>
            <Route path="/" element={<RootView giftShopEnabled={giftShopEnabled} />} />

            <Route path="/teacher/overview" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/quizzes" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/assignments" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/results" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/classes" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/live-exams" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/gift-shop" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/homework" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/certificates" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/certificate-templates" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/announcements" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/teachers" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/math-audit" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/operations" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/settings" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/results/:resultId" element={protectedRoute('teacher', <TeacherResultDetailPage />)} />

            <Route path="/student/dashboard" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/assignments" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/practice" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/practice/:subjectId" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/achievements" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/results" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/live-exam/:sessionId" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route
                path="/student/shop"
                element={giftShopEnabled
                    ? protectedRoute('student', <GiftShop />)
                    : <Navigate to="/student/dashboard" replace />}
            />
            <Route
                path="/teacher/quizzes/manual/new"
                element={manualQuizWorkspaceEnabled
                    ? protectedRoute('teacher', <ManualQuizWorkspacePage />)
                    : <Navigate to="/teacher/quizzes" replace state={{ manualQuizWorkspaceFallback: true }} />}
            />
            <Route
                path="/teacher/quizzes/manual/:quizId/edit"
                element={manualQuizWorkspaceEnabled
                    ? protectedRoute('teacher', <ManualQuizWorkspacePage />)
                    : <Navigate to="/teacher/quizzes" replace state={{ manualQuizWorkspaceFallback: true }} />}
            />
            <Route path="/about" element={suspended(<PublicPageLayout onNavigate={onNavigate}><AboutPage /></PublicPageLayout>)} />
            <Route path="/contact" element={suspended(<PublicPageLayout onNavigate={onNavigate}><ContactPage /></PublicPageLayout>)} />
            <Route path="/phieu/p/:publicToken" element={suspended(<PhieuPublicPage />)} />
            <Route path="/privacy" element={suspended(<PublicPageLayout onNavigate={onNavigate}><PrivacyPolicy onBack={goBackHome} /></PublicPageLayout>)} />
            <Route path="/tos" element={suspended(<PublicPageLayout onNavigate={onNavigate}><TermsOfService onBack={goBackHome} /></PublicPageLayout>)} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

