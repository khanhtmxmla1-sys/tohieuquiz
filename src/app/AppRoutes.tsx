import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import { useQuizStore } from '../../stores/quizStore';
import { AboutPage, ContactPage, ManualQuizWorkspacePage, PhieuPublicPage, PrivacyPolicy, TeacherResultDetailPage, TermsOfService } from './lazyViews';
import { PageLoading } from './PageLoading';
import { PublicPageLayout } from './PublicPageLayout';
import { RootView } from './RootView';
import type { RoutePath } from './routeTypes';
import { isManualQuizWorkspaceEnabled } from '../config/featureFlags';

interface AppRoutesProps {
    giftShopEnabled: boolean;
    manualQuizWorkspaceEnabled?: boolean;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
    giftShopEnabled,
    manualQuizWorkspaceEnabled = isManualQuizWorkspaceEnabled(),
}) => {
    const quizStore = useQuizStore();
    const navigate = useNavigate();
    const onNavigate = (path: RoutePath) => navigate(path);
    const goBackHome = () => {
        quizStore.goHome();
        navigate('/');
    };
    const suspended = (content: React.ReactNode) => <Suspense fallback={<PageLoading />}>{content}</Suspense>;

    return (
        <Routes>
            <Route path="/" element={<RootView giftShopEnabled={giftShopEnabled} />} />
            <Route path="/student/practice/:subjectId" element={<RootView giftShopEnabled={giftShopEnabled} />} />
            <Route path="/teacher/results/:resultId" element={suspended(<TeacherResultDetailPage />)} />
            <Route
                path="/teacher/quizzes/manual/new"
                element={manualQuizWorkspaceEnabled
                    ? suspended(<ManualQuizWorkspacePage />)
                    : <Navigate to="/" replace state={{ manualQuizWorkspaceFallback: true }} />}
            />
            <Route
                path="/teacher/quizzes/manual/:quizId/edit"
                element={manualQuizWorkspaceEnabled
                    ? suspended(<ManualQuizWorkspacePage />)
                    : <Navigate to="/" replace state={{ manualQuizWorkspaceFallback: true }} />}
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

