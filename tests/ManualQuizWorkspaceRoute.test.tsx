import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

vi.mock('../src/app/RootView', () => ({
    RootView: () => <div>root-view</div>,
}));
vi.mock('../src/components/TeacherDashboard/TeacherResultDetailPage', () => ({ default: () => <div>teacher-result</div> }));
vi.mock('../src/components/schoolPage/AboutPage', () => ({ default: () => <div>about</div> }));
vi.mock('../src/components/schoolPage/ContactPage', () => ({ default: () => <div>contact</div> }));
vi.mock('../src/pages/PhieuPublicPage', () => ({ default: () => <div>phieu</div> }));
vi.mock('../src/components/legal/PrivacyPolicy', () => ({ default: () => <div>privacy</div> }));
vi.mock('../src/components/legal/TermsOfService', () => ({ default: () => <div>tos</div> }));
vi.mock('../src/app/PublicPageLayout', () => ({ PublicPageLayout: ({ children }: any) => <>{children}</> }));
vi.mock('../src/app/lazyViews', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/app/lazyViews')>();
    const { Navigate, useParams } = await import('react-router');
    const { useAuthStore: useAuthStoreInStub } = await import('../stores/authStore');
    return {
        ...actual,
        TeacherDashboard: () => <div>teacher-dashboard</div>,
        ManualQuizWorkspacePage: () => {
            const isLoggedIn = useAuthStoreInStub(state => state.isLoggedIn);
            const { quizId } = useParams();
            if (!isLoggedIn) return <Navigate to="/" replace />;
            return (
                <div
                    data-testid="manual-quiz-workspace"
                    data-mode={quizId ? 'edit' : 'new'}
                    data-quiz-id={quizId || undefined}
                />
            );
        },
    };
});

const originalAuth = useAuthStore.getState();
const originalQuiz = useQuizStore.getState();

const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
};

const renderRoute = (entry: string, manualQuizWorkspaceEnabled = true) => render(
    <MemoryRouter initialEntries={[entry]}>
        <AppRoutes giftShopEnabled={false} manualQuizWorkspaceEnabled={manualQuizWorkspaceEnabled} />
        <LocationProbe />
    </MemoryRouter>,
);

describe('manual quiz workspace routes', () => {
    beforeEach(() => {
        useManualQuizWorkspaceStore.getState().reset();
        useAuthStore.setState({
            ...originalAuth,
            isLoggedIn: true,
            username: 'teacher-a',
            teacherName: 'Cô An',
            isAdmin: false,
        }, true);
        useQuizStore.setState({ ...originalQuiz, view: 'home' }, true);
    });

    it('opens the new manual quiz workspace without changing the legacy view', async () => {
        renderRoute('/teacher/quizzes/manual/new');

        expect(await screen.findByTestId('manual-quiz-workspace', {}, { timeout: 3_000 })).toHaveAttribute('data-mode', 'new');
        expect(useQuizStore.getState().view).toBe('home');
    });

    it('passes the quiz id to the edit workspace route', async () => {
        renderRoute('/teacher/quizzes/manual/quiz-123/edit');

        expect(await screen.findByTestId('manual-quiz-workspace', {}, { timeout: 3_000 })).toHaveAttribute('data-quiz-id', 'quiz-123');
    });

    it('redirects direct workspace URLs to canonical quiz management when the flag is disabled', async () => {
        renderRoute('/teacher/quizzes/manual/new', false);

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/teacher/quizzes'));
        expect(screen.getByText('teacher-dashboard')).toBeInTheDocument();
        expect(screen.queryByTestId('manual-quiz-workspace')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated visitors home', async () => {
        useAuthStore.setState({ isLoggedIn: false, username: null });
        renderRoute('/teacher/quizzes/manual/new');

        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
        expect(screen.queryByTestId('manual-quiz-workspace')).not.toBeInTheDocument();
    });
});
