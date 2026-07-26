import React, { Suspense } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useQuizStore } from '../../stores/quizStore';
import { useClassroomStore } from '../stores/useClassroomStore';
import { GiftShop, HomePage, TeacherDashboard } from './lazyViews';
import { PageLoading } from './PageLoading';
import { PublicPageLayout } from './PublicPageLayout';
import { StudentQuizView } from './StudentQuizView';
import type { RoutePath } from './routeTypes';

export const RootView: React.FC<{ giftShopEnabled: boolean }> = ({ giftShopEnabled }) => {
    const authStore = useAuthStore();
    const quizStore = useQuizStore();
    const classroomStore = useClassroomStore();
    const navigate = useNavigate();
    const onNavigate = (path: RoutePath) => navigate(path);

    if (quizStore.view === 'shop') {
        if (!giftShopEnabled || !classroomStore.studentSession) {
            quizStore.setView('home');
            return null;
        }
        return <Suspense fallback={<PageLoading />}><GiftShop /></Suspense>;
    }

    if (quizStore.view === 'teacher_dash') {
        if (!authStore.isLoggedIn) {
            quizStore.setView('home');
            return null;
        }
        return <Suspense fallback={<PageLoading />}><TeacherDashboard /></Suspense>;
    }

    if (quizStore.view === 'student' && quizStore.selectedQuiz) return <StudentQuizView />;

    const showPublicLinks = !authStore.isLoggedIn && !classroomStore.studentSession;
    return (
        <Suspense fallback={<PageLoading />}>
            <PublicPageLayout onNavigate={onNavigate} showPublicLinks={showPublicLinks}><HomePage /></PublicPageLayout>
        </Suspense>
    );
};
