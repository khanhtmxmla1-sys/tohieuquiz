import React, { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useQuizStore } from '../../stores/quizStore';
import { useClassroomStore } from '../stores/useClassroomStore';
import {
    AboutPage,
    ContactPage,
    DesignSystemPage,
    GiftShop,
    LoginLandingPage,
    ManualQuizWorkspacePage,
    PhieuPublicPage,
    PrivacyPolicy,
    CompetitionStudentRoute,
    StudentCompetitionHomePage,
    StudentDashboardUI,
    TeacherDashboard,
    TeacherResultDetailPage,
    TermsOfService,
} from './lazyViews';
import { PageLoading } from './PageLoading';
import { PublicPageLayout } from './PublicPageLayout';
import { RootView } from './RootView';
import { resolveSafeReturnTo } from './navigationRoutes';
import type { RoutePath } from './routeTypes';
import {
    isCompetitionLegacyRedirectUxEnabled,
    isCompetitionStudentPortalUxEnabled,
    isCompetitionV1Enabled,
    isManualQuizWorkspaceEnabled,
} from '../config/featureFlags';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';
import LegacyCompetitionRedirect from '../features/competition/portal/student/LegacyCompetitionRedirect';

const StudentRoundPage = React.lazy(() => import('../features/competition/portal/student/StudentRoundPage'));
const StudentRoundRulesPage = React.lazy(() => import('../features/competition/portal/student/StudentRoundRulesPage'));
const StudentRoundPreflightPage = React.lazy(() => import('../features/competition/portal/student/StudentRoundPreflightPage'));
const CompetitionRoundExamPlayer = React.lazy(() => import('../features/competition/portal/student/CompetitionRoundExamPlayer'));
const CompetitionSchoolExamPlayer = React.lazy(() => import('../features/competition/portal/student/CompetitionSchoolExamPlayer'));
const CompetitionIndexPage = React.lazy(() => import('../features/competition/portal/public/CompetitionIndexPage'));
const CompetitionCampaignPage = React.lazy(() => import('../features/competition/portal/public/CompetitionCampaignPage'));
const CompetitionArticlePage = React.lazy(() => import('../features/competition/portal/public/CompetitionArticlePage'));
const CompetitionGoldenBoardPage = React.lazy(() => import('../features/competition/portal/public/CompetitionGoldenBoardPage'));

const CompetitionStudentHomeRoute = () => <StudentCompetitionHomePage />;

const LegacyManualQuizNewRedirect = () => {
    const location = useLocation();
    return (
        <Navigate
            to={{ pathname: '/teacher/quizzes/new', search: location.search }}
            state={location.state}
            replace
        />
    );
};

const LegacyManualQuizEditRedirect = () => {
    const { quizId } = useParams<{ quizId: string }>();
    const location = useLocation();
    return (
        <Navigate
            to={{
                pathname: `/teacher/quizzes/${encodeURIComponent(quizId || '')}/edit`,
                search: location.search,
            }}
            state={location.state}
            replace
        />
    );
};

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
    const authStore = useAuthStore();
    const quizStore = useQuizStore();
    const classroomStore = useClassroomStore();
    const navigate = useNavigate();
    const location = useLocation();
    const competitionV1Enabled = isCompetitionV1Enabled();
    const competitionLegacyRedirectUxEnabled = isCompetitionLegacyRedirectUxEnabled();
    const competitionStudentPortalUxEnabled = isCompetitionStudentPortalUxEnabled();
    const loginParams = new URLSearchParams(location.search);
    const requestedLogin = loginParams.get('login');
    const hasExplicitLoginRequest = requestedLogin === 'student' || requestedLogin === 'teacher';
    const requestedReturnTo = loginParams.get('returnTo');
    const explicitLoginDestination = requestedLogin === 'student' && classroomStore.studentSession
        ? resolveSafeReturnTo(requestedReturnTo, 'student') || '/student/dashboard'
        : requestedLogin === 'teacher' && authStore.isLoggedIn
            ? resolveSafeReturnTo(requestedReturnTo, 'teacher') || '/teacher/overview'
            : null;
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
            <Route
                path="/"
                element={explicitLoginDestination
                    ? <Navigate to={explicitLoginDestination} replace />
                    : hasExplicitLoginRequest
                    ? suspended(<LoginLandingPage />)
                    : <RootView giftShopEnabled={giftShopEnabled} />}
            />

            <Route path="/teacher/overview" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/quizzes" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/assignments" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/results" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/classes" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/live-exams" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/competition" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/gift-shop" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/homework" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/certificates" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/certificate-templates" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/announcements" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/feature-rollout" element={protectedRoute('teacher', <AdminRoute><TeacherDashboard /></AdminRoute>)} />
            <Route path="/teacher/login-media" element={protectedRoute('teacher', <AdminRoute><TeacherDashboard /></AdminRoute>)} />
            <Route path="/teacher/teachers" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/math-audit" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/operations" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route path="/teacher/system-question-bank" element={protectedRoute('teacher', <AdminRoute><TeacherDashboard /></AdminRoute>)} />
            <Route path="/teacher/settings" element={protectedRoute('teacher', <TeacherDashboard />)} />
            <Route
                path="/design-system"
                element={protectedRoute('teacher', <AdminRoute><DesignSystemPage /></AdminRoute>)}
            />
            <Route path="/teacher/results/:resultId" element={protectedRoute('teacher', <TeacherResultDetailPage />)} />

            <Route path="/student/dashboard" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/assignments" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/practice" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/practice/:subjectId" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/achievements" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route path="/student/results" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route
                path="/thi/:campaignSlug"
                element={protectedRoute('student', competitionStudentPortalUxEnabled
                    ? <CompetitionStudentRoute />
                    : <StudentDashboardUI />)}
            >
                <Route index element={<CompetitionStudentHomeRoute />} />
                <Route path="vong/:roundNumber" element={suspended(<StudentRoundPage />)} />
                <Route path="vong/:roundNumber/quy-che" element={suspended(<StudentRoundRulesPage />)} />
                <Route path="vong/:roundNumber/kiem-tra" element={suspended(<StudentRoundPreflightPage />)} />
                <Route path="vong/:roundNumber/lam-bai" element={suspended(<CompetitionRoundExamPlayer />)} />
                <Route path="school-exam/lam-bai" element={suspended(<CompetitionSchoolExamPlayer />)} />
            </Route>
            <Route
                path="/student/competition"
                element={competitionV1Enabled
                    ? protectedRoute('student', competitionLegacyRedirectUxEnabled
                        ? <LegacyCompetitionRedirect fallback={<StudentDashboardUI />} />
                        : <StudentDashboardUI />)
                    : <Navigate to="/student/dashboard" replace />}
            />
            <Route path="/student/live-exam/:sessionId" element={protectedRoute('student', <StudentDashboardUI />)} />
            <Route
                path="/student/shop"
                element={giftShopEnabled
                    ? protectedRoute('student', <GiftShop />)
                    : <Navigate to="/student/dashboard" replace />}
            />
            <Route
                path="/teacher/quizzes/new"
                element={manualQuizWorkspaceEnabled
                    ? protectedRoute('teacher', <ManualQuizWorkspacePage />)
                    : <Navigate to="/teacher/quizzes" replace state={{ manualQuizWorkspaceFallback: true }} />}
            />
            <Route
                path="/teacher/quizzes/:quizId/edit"
                element={manualQuizWorkspaceEnabled
                    ? protectedRoute('teacher', <ManualQuizWorkspacePage />)
                    : <Navigate to="/teacher/quizzes" replace state={{ manualQuizWorkspaceFallback: true }} />}
            />
            <Route path="/teacher/quizzes/manual/new" element={<LegacyManualQuizNewRedirect />} />
            <Route path="/teacher/quizzes/manual/:quizId/edit" element={<LegacyManualQuizEditRedirect />} />
            <Route path="/about" element={suspended(<PublicPageLayout onNavigate={onNavigate}><AboutPage /></PublicPageLayout>)} />
            <Route path="/contact" element={suspended(<PublicPageLayout onNavigate={onNavigate}><ContactPage /></PublicPageLayout>)} />
            <Route path="/phieu/p/:publicToken" element={suspended(<PhieuPublicPage />)} />
            <Route path="/cuoc-thi" element={suspended(<CompetitionIndexPage />)} />
            <Route path="/cuoc-thi/:campaignSlug/tin-tuc/:articleSlug" element={suspended(<CompetitionArticlePage />)} />
            <Route path="/cuoc-thi/:campaignSlug/bang-vang" element={suspended(<CompetitionGoldenBoardPage />)} />
            <Route path="/cuoc-thi/:campaignSlug" element={suspended(<CompetitionCampaignPage />)} />
            <Route path="/privacy" element={suspended(<PublicPageLayout onNavigate={onNavigate}><PrivacyPolicy onBack={goBackHome} /></PublicPageLayout>)} />
            <Route path="/tos" element={suspended(<PublicPageLayout onNavigate={onNavigate}><TermsOfService onBack={goBackHome} /></PublicPageLayout>)} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};
