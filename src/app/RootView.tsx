import React, { Suspense } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useQuizStore } from '../../stores/quizStore';
import { useClassroomStore } from '../stores/useClassroomStore';
import { HomePage } from './lazyViews';
import { PageLoading } from './PageLoading';
import { PublicPageLayout } from './PublicPageLayout';
import { StudentQuizView } from './StudentQuizView';
import type { RoutePath } from './routeTypes';
import { getStudentRoute, getTeacherRoute, resolveSafeReturnTo } from './navigationRoutes';
import { useTeacherDashboardUIStore } from '../stores/useTeacherDashboardUIStore';

export const RootView: React.FC<{ giftShopEnabled: boolean }> = ({ giftShopEnabled }) => {
    const authStore = useAuthStore();
    const quizStore = useQuizStore();
    const classroomStore = useClassroomStore();
    const legacyTeacherTab = useTeacherDashboardUIStore((state) => state.activeTab);
    const navigate = useNavigate();
    const location = useLocation();
    const loginParams = new URLSearchParams(location.search);
    const requestedReturnTo = loginParams.get('returnTo');
    const onNavigate = (path: RoutePath) => navigate(path);

    if (quizStore.view === 'student' && quizStore.selectedQuiz) return <StudentQuizView />;

    if (authStore.isLoggedIn) {
        const destination = resolveSafeReturnTo(requestedReturnTo, 'teacher')
            || getTeacherRoute(legacyTeacherTab);
        return <Navigate to={destination} replace />;
    }

    if (classroomStore.studentSession) {
        const destination = resolveSafeReturnTo(requestedReturnTo, 'student')
            || (quizStore.view === 'shop' && giftShopEnabled
                ? getStudentRoute('shop')
                : getStudentRoute('dashboard'));
        return <Navigate to={destination} replace />;
    }

    const showPublicLinks = !authStore.isLoggedIn && !classroomStore.studentSession;
    return (
        <Suspense fallback={<PageLoading />}>
            <PublicPageLayout onNavigate={onNavigate} showPublicLinks={showPublicLinks}><HomePage /></PublicPageLayout>
        </Suspense>
    );
};
