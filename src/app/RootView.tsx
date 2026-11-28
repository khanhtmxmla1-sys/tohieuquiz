import React, { Suspense } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useQuizStore } from '../../stores/quizStore';
import { useClassroomStore } from '../stores/useClassroomStore';
import { PublicHomeLandingPage } from './lazyViews';
import { PageLoading } from './PageLoading';
import { StudentQuizView } from './StudentQuizView';
import { getStudentRoute, getTeacherRoute, resolveSafeReturnTo } from './navigationRoutes';
import { useTeacherDashboardUIStore } from '../stores/useTeacherDashboardUIStore';

export const RootView: React.FC<{ giftShopEnabled: boolean }> = ({ giftShopEnabled }) => {
    const authStore = useAuthStore();
    const quizStore = useQuizStore();
    const classroomStore = useClassroomStore();
    const legacyTeacherTab = useTeacherDashboardUIStore((state) => state.activeTab);
    const location = useLocation();
    const loginParams = new URLSearchParams(location.search);
    const requestedReturnTo = loginParams.get('returnTo');

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

    return (
        <Suspense fallback={<PageLoading />}>
            <PublicHomeLandingPage giftShopEnabled={giftShopEnabled} />
        </Suspense>
    );
};
