import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getSystemSettings } from '../src/services/systemSettingsService';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { useClassroomStore } from '../src/stores/useClassroomStore';

vi.mock('@vercel/analytics/react', () => ({ Analytics: () => <div data-testid="analytics" /> }));
vi.mock('react-hot-toast', () => ({ Toaster: () => <div data-testid="toaster" /> }));
vi.mock('../src/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('../src/services/systemSettingsService', () => ({ getSystemSettings: vi.fn() }));
vi.mock('../src/components/ChatBot', () => ({ ChatBot: () => <div>chatbot</div> }));
vi.mock('../src/components/StudentView', () => ({ default: () => <div>student-view</div> }));
vi.mock('../src/components/TeacherDashboard', () => ({ default: () => <div>teacher-dashboard</div> }));
vi.mock('../src/components/TeacherDashboard/TeacherResultDetailPage', () => ({ default: () => <div>teacher-result-detail</div> }));
vi.mock('../src/components/gamification/GiftShop', () => ({ default: () => <div>gift-shop</div> }));
vi.mock('../src/components/HomePage/HomePage', () => ({ default: () => <div>home-page</div> }));
vi.mock('../src/components/legal/PrivacyPolicy', () => ({
    default: ({ onBack }: { onBack: () => void }) => <button onClick={onBack}>privacy-page</button>,
}));
vi.mock('../src/components/legal/TermsOfService', () => ({
    default: ({ onBack }: { onBack: () => void }) => <button onClick={onBack}>terms-page</button>,
}));
vi.mock('../src/components/common/Footer', () => ({
    default: ({ showPublicLinks }: { showPublicLinks?: boolean }) => (
        <div>{showPublicLinks === false ? 'footer-private' : 'footer-public'}</div>
    ),
}));
vi.mock('../src/components/schoolPage/AboutPage', () => ({ default: () => <div>about-page</div> }));
vi.mock('../src/components/schoolPage/ContactPage', () => ({ default: () => <div>contact-page</div> }));
vi.mock('../src/pages/PhieuPublicPage', () => ({ default: () => <div>phieu-public-page</div> }));
vi.mock('../src/features/parent-portal/ParentPortalApp', () => ({ default: () => <div>parent-portal-app</div> }));

const originalQuizState = useQuizStore.getState();
const originalAuthState = useAuthStore.getState();
const originalClassroomState = useClassroomStore.getState();
const mockedSettings = vi.mocked(getSystemSettings);

const LocationProbe = () => {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderApp = (entry = '/') => render(
    <MemoryRouter initialEntries={[entry]}>
        <App />
        <LocationProbe />
    </MemoryRouter>,
);

const quiz = {
    id: 'quiz-1',
    title: 'Quiz One',
    classLevel: '3',
    category: 'Toán',
    timeLimit: 20,
    createdAt: '2026-07-19T00:00:00.000Z',
    createdBy: 'teacher',
    questions: [{ id: 'q-1', type: 'MCQ', question: '1 + 1?', options: ['1', '2'], correctAnswer: '2' }],
} as any;

describe('App shell routing contracts', () => {
    beforeEach(() => {
        localStorage.clear();
        window.history.replaceState({}, '', '/');
        vi.clearAllMocks();
        vi.stubEnv('VITE_FEATURE_GIFT_SHOP_V2', 'false');
        mockedSettings.mockResolvedValue({ aiAssistantEnabled: true } as any);
        useQuizStore.setState({
            ...originalQuizState,
            view: 'home',
            quizzes: [],
            selectedQuiz: null,
            results: [],
            isLoading: false,
            error: null,
            loadQuizzes: vi.fn(async () => undefined),
            loadQuizQuestions: vi.fn(async () => null),
        }, true);
        useAuthStore.setState({
            ...originalAuthState,
            isLoggedIn: false,
            username: null,
            teacherName: null,
            isAdmin: false,
            teacherClass: null,
            restoreSession: vi.fn(async () => undefined),
        }, true);
        useClassroomStore.setState({
            ...originalClassroomState,
            studentSession: null,
            isLoading: false,
            error: null,
            restoreStudentSession: vi.fn(async () => undefined),
        }, true);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('renders only the parent app for explicit localhost parent mode', async () => {
        vi.stubEnv('VITE_FEATURE_PARENT_PORTAL_V1', 'true');
        window.history.replaceState({}, '', '/?portal=parent');
        renderApp('/?portal=parent');

        expect(await screen.findByText('parent-portal-app')).toBeInTheDocument();
        expect(screen.queryByText('home-page')).not.toBeInTheDocument();
        expect(screen.queryByText('chatbot')).not.toBeInTheDocument();
        expect(screen.queryByText('footer-public')).not.toBeInTheDocument();
        expect(useQuizStore.getState().loadQuizzes).not.toHaveBeenCalled();
        expect(useAuthStore.getState().restoreSession).not.toHaveBeenCalled();
        expect(useClassroomStore.getState().restoreStudentSession).not.toHaveBeenCalled();
    });

    it('loads quizzes and system settings on mount while showing public shell globals', async () => {
        renderApp();

        await waitFor(() => expect(useQuizStore.getState().loadQuizzes).toHaveBeenCalledTimes(1));
        expect(mockedSettings).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('home-page')).toBeInTheDocument();
        expect(screen.getByText('footer-public')).toBeInTheDocument();
        expect(screen.getByText('chatbot')).toBeInTheDocument();
        expect(screen.getByTestId('analytics')).toBeInTheDocument();
        expect(screen.getByTestId('toaster')).toBeInTheDocument();
    });

    it('canonicalizes the legacy quiz query without dropping other parameters', async () => {
        renderApp('/?quiz=legacy-quiz&ref=school');

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/?ref=school&quizId=legacy-quiz');
        });
    });

    it('selects a quiz from quizId and enters student view', async () => {
        useQuizStore.setState({ quizzes: [quiz] });
        renderApp('/?quizId=quiz-1');

        expect(await screen.findByText('student-view')).toBeInTheDocument();
        expect(useQuizStore.getState().selectedQuiz?.id).toBe('quiz-1');
        expect(useQuizStore.getState().view).toBe('student');
        expect(screen.queryByText('chatbot')).not.toBeInTheDocument();
    });

    it('supports teacher autologin, seeds a mock result, and enters the dashboard', async () => {
        window.history.replaceState({}, '', '/?autologin=teacher');
        renderApp('/?autologin=teacher');

        expect(await screen.findByText('teacher-dashboard')).toBeInTheDocument();
        expect(useAuthStore.getState()).toMatchObject({
            isLoggedIn: true,
            username: 'admin',
            teacherName: 'Admin Test',
            isAdmin: true,
            teacherClass: '4A',
        });
        expect(useQuizStore.getState().results).toHaveLength(1);
        expect(useQuizStore.getState().results[0]?.id).toBe('mock-123');
    });

    it('renders the public root for unauthenticated legacy views without mutating state during render', async () => {
        useQuizStore.setState({ view: 'teacher_dash' });
        const teacherRender = renderApp();
        expect(await screen.findByText('home-page')).toBeInTheDocument();
        expect(useQuizStore.getState().view).toBe('teacher_dash');
        expect(screen.queryByText('teacher-dashboard')).not.toBeInTheDocument();
        teacherRender.unmount();

        vi.stubEnv('VITE_FEATURE_GIFT_SHOP_V2', 'false');
        useQuizStore.setState({ view: 'shop' });
        renderApp();
        expect(await screen.findByText('home-page')).toBeInTheDocument();
        expect(useQuizStore.getState().view).toBe('shop');
        expect(screen.queryByText('gift-shop')).not.toBeInTheDocument();
    });

    it('shows retry recovery when a selected quiz has no loaded questions', async () => {
        const loadQuizQuestions = vi.fn(async () => null);
        const goHome = vi.fn();
        useQuizStore.setState({
            view: 'student',
            selectedQuiz: { ...quiz, questions: [] },
            isLoading: false,
            error: 'Question load failed',
            loadQuizQuestions,
            goHome,
        });

        renderApp();

        expect(await screen.findByText('Chưa tải được câu hỏi')).toBeInTheDocument();
        expect(screen.getByText('Question load failed')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
        expect(loadQuizQuestions).toHaveBeenCalledWith('quiz-1');
        fireEvent.click(screen.getByRole('button', { name: 'Về trang chủ' }));
        expect(goHome).toHaveBeenCalledTimes(1);
    });

    it('keeps public routes and wildcard redirect contracts', async () => {
        const aboutRender = renderApp('/about');
        expect(await screen.findByText('about-page')).toBeInTheDocument();
        expect(screen.getByText('footer-public')).toBeInTheDocument();
        aboutRender.unmount();

        renderApp('/missing-page');
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
        expect(await screen.findByText('home-page')).toBeInTheDocument();
    });

    it('updates chatbot visibility from the system-settings event contract', async () => {
        mockedSettings.mockResolvedValue({ aiAssistantEnabled: false } as any);
        renderApp();

        await waitFor(() => expect(mockedSettings).toHaveBeenCalledTimes(1));
        expect(screen.queryByText('chatbot')).not.toBeInTheDocument();

        act(() => {
            window.dispatchEvent(new CustomEvent('tohieuquiz:system-settings-updated', {
                detail: { aiAssistantEnabled: true },
            }));
        });

        expect(await screen.findByText('chatbot')).toBeInTheDocument();
    });

    it('keeps the legacy App import path as a one-line compatibility barrel', async () => {
        const source = await import('../App?raw');
        expect(source.default.trim()).toBe("export { default } from './src/app';");
    });
});
