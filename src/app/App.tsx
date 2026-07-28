import React, { Suspense } from 'react';
import { useLocation } from 'react-router';
import { useQuizStore } from '../../stores/quizStore';
import { useSeo } from '../hooks/useSeo';
import { AppGlobals } from './AppGlobals';
import { AppRoutes } from './AppRoutes';
import { useLegacyQuizQuery } from './useLegacyQuizQuery';
import { useLoadQuizzes } from './useLoadQuizzes';
import { useQuizUrlSelection } from './useQuizUrlSelection';
import { useScrollReset } from './useScrollReset';
import { useSystemSettings } from './useSystemSettings';
import { useTeacherEntry } from './useTeacherEntry';
import { useSessionBootstrap } from './useSessionBootstrap';
import { resolveHostContext } from './hostContext';
import { isParentPortalEnabled } from '../config/featureFlags';
import { ParentPortalApp } from './lazyViews';
import { ParentPortalFallback } from '../features/parent-portal/layout/ParentPortalLayout';
import { OfflineBanner } from '../components/common';

const MainApp: React.FC = () => {
    const quizStore = useQuizStore();
    const location = useLocation();
    const sessionsReady = useSessionBootstrap();
    const giftShopEnabled = String(import.meta.env.VITE_FEATURE_GIFT_SHOP_V2 || 'false').toLowerCase() === 'true';

    useSeo(location.pathname, quizStore.view, quizStore.selectedQuiz, giftShopEnabled);
    useLoadQuizzes();
    useTeacherEntry();
    useLegacyQuizQuery();
    const aiAssistantEnabled = useSystemSettings();
    useQuizUrlSelection();
    useScrollReset(quizStore.view);

    return (
        <>
            <AppRoutes giftShopEnabled={giftShopEnabled} sessionsReady={sessionsReady} />
            <AppGlobals showChatbot={aiAssistantEnabled && quizStore.view !== 'student'} />
        </>
    );
};

const ParentPortalUnavailable = () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">Cổng phụ huynh đang được chuẩn bị</h1>
            <p className="mt-2 text-sm text-slate-500">Vui lòng liên hệ giáo viên để biết thời điểm mở quyền truy cập.</p>
        </div>
    </div>
);

const App: React.FC = () => {
    const hostContext = resolveHostContext(
        typeof window === 'undefined' ? '' : window.location.hostname,
        typeof window === 'undefined' ? '' : window.location.search,
    );
    const content = hostContext === 'parent'
        ? (isParentPortalEnabled() ? (
            <Suspense fallback={<ParentPortalFallback />}>
                <ParentPortalApp />
            </Suspense>
        ) : <ParentPortalUnavailable />)
        : <MainApp />;

    return (
        <>
            <OfflineBanner />
            {content}
        </>
    );
};

export default App;
