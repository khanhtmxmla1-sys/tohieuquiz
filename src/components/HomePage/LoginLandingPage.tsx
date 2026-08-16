import React, { Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { useClassroomStore } from '../../stores/useClassroomStore';
import { showError } from '../../utils/toast';
import PasswordChangeDialog from '../common/PasswordChangeDialog';
import CurrentAnnouncementBanner from '../common/CurrentAnnouncementBanner';
import { NotificationSurfaceStack } from '../../features/notifications/components';
import { useUnifiedNotificationsFeatureFlag } from '../../features/notifications/useUnifiedNotificationsFeatureFlag';
import { authenticateTeacherWithPasskey, passkeysSupported } from '../../services/passkeyService';

import LandingHeader from './components/LandingHeader';
import HeroSection from './components/HeroSection';
import LoginForm from './components/LoginForm';
import LandingFooter from './components/LandingFooter';

type LoginRole = 'student' | 'teacher';
type LoginDraft = { username: string; password: string; rememberLogin: boolean };
type SavedRoleAccount = { username: string; savedAt: string };
type SavedLoginState = {
    version: 2;
    lastRole: LoginRole;
    accounts: Partial<Record<LoginRole, SavedRoleAccount>>;
};

const SAVED_LOGIN_KEY = 'tohieuquiz_saved_login_v1';
const emptySavedState = (): SavedLoginState => ({ version: 2, lastRole: 'student', accounts: {} });

const readSavedLoginState = (): SavedLoginState => {
    try {
        const raw = localStorage.getItem(SAVED_LOGIN_KEY);
        if (!raw) return emptySavedState();
        const saved = JSON.parse(raw) as any;

        if (saved?.version === 2 && saved.accounts && typeof saved.accounts === 'object') {
            const accounts: SavedLoginState['accounts'] = {};
            (['student', 'teacher'] as LoginRole[]).forEach((role) => {
                const username = typeof saved.accounts?.[role]?.username === 'string'
                    ? saved.accounts[role].username.trim()
                    : '';
                if (username) {
                    accounts[role] = {
                        username,
                        savedAt: typeof saved.accounts[role].savedAt === 'string'
                            ? saved.accounts[role].savedAt
                            : new Date(0).toISOString(),
                    };
                }
            });
            const lastRole: LoginRole = saved.lastRole === 'teacher' ? 'teacher' : 'student';
            return { version: 2, lastRole, accounts };
        }

        const legacyRole: LoginRole | null = saved?.role === 'teacher'
            ? 'teacher'
            : saved?.role === 'student'
                ? 'student'
                : null;
        const legacyUsername = typeof saved?.username === 'string' ? saved.username.trim() : '';
        if (legacyRole && legacyUsername) {
            return {
                version: 2,
                lastRole: legacyRole,
                accounts: {
                    [legacyRole]: {
                        username: legacyUsername,
                        savedAt: typeof saved.savedAt === 'string' ? saved.savedAt : new Date(0).toISOString(),
                    },
                },
            };
        }
    } catch (error) {
        console.warn('Could not load saved login account:', error);
    }
    return emptySavedState();
};

const writeSavedLoginState = (state: SavedLoginState) => {
    const hasSavedAccount = Boolean(state.accounts.student || state.accounts.teacher);
    if (!hasSavedAccount) {
        localStorage.removeItem(SAVED_LOGIN_KEY);
        return;
    }
    localStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify(state));
};

const LoginLandingPage: React.FC = () => {
    const location = useLocation();
    const requestedRole = new URLSearchParams(location.search).get('login');
    const [activeTab, setActiveTab] = useState<LoginRole>(requestedRole === 'teacher' ? 'teacher' : 'student');
    const [drafts, setDrafts] = useState<Record<LoginRole, LoginDraft>>({
        student: { username: '', password: '', rememberLogin: false },
        teacher: { username: '', password: '', rememberLogin: false },
    });
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [pendingTeacher, setPendingTeacher] = useState<any | null>(null);
    const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

    const authStore = useAuthStore();
    const classroomStore = useClassroomStore();
    const notificationFlag = useUnifiedNotificationsFeatureFlag();
    const { username, password, rememberLogin } = drafts[activeTab];

    useEffect(() => {
        const saved = readSavedLoginState();
        setDrafts((current) => ({
            student: {
                ...current.student,
                username: saved.accounts.student?.username || '',
                password: '',
                rememberLogin: Boolean(saved.accounts.student),
            },
            teacher: {
                ...current.teacher,
                username: saved.accounts.teacher?.username || '',
                password: '',
                rememberLogin: Boolean(saved.accounts.teacher),
            },
        }));
        if (requestedRole !== 'teacher' && requestedRole !== 'student') {
            setActiveTab(saved.lastRole);
        }
    }, [requestedRole]);

    const isLoading = activeTab === 'teacher' ? authStore.isLoggingIn : classroomStore.isLoading;

    const updateActiveDraft = (patch: Partial<LoginDraft>) => {
        setDrafts((current) => ({
            ...current,
            [activeTab]: { ...current[activeTab], ...patch },
        }));
    };

    const clearErrors = () => {
        setUsernameError(null);
        setPasswordError(null);
        setFormError(null);
    };

    const handleRoleChange = (role: LoginRole) => {
        setActiveTab(role);
        clearErrors();
    };

    const persistSavedLoginAccount = () => {
        try {
            const saved = readSavedLoginState();
            const accounts = { ...saved.accounts };
            if (rememberLogin && username.trim()) {
                accounts[activeTab] = { username: username.trim(), savedAt: new Date().toISOString() };
            } else {
                delete accounts[activeTab];
            }
            writeSavedLoginState({ version: 2, lastRole: activeTab, accounts });
        } catch (error) {
            console.warn('Could not save login account:', error);
        }
    };

    const handleRememberLoginChange = (checked: boolean) => {
        updateActiveDraft({ rememberLogin: checked });
        if (!checked) {
            try {
                const saved = readSavedLoginState();
                const accounts = { ...saved.accounts };
                delete accounts[activeTab];
                writeSavedLoginState({ ...saved, lastRole: activeTab, accounts });
            } catch (error) {
                console.warn('Could not clear saved login account:', error);
            }
        }
    };

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        const nextUsernameError = username ? null : 'Vui lòng nhập tên đăng nhập.';
        const nextPasswordError = password ? null : 'Vui lòng nhập mật khẩu.';
        setUsernameError(nextUsernameError);
        setPasswordError(nextPasswordError);
        setFormError(null);
        if (nextUsernameError || nextPasswordError) {
            showError('Vui lòng nhập đầy đủ thông tin!');
            return;
        }
        if (activeTab === 'teacher') {
            await handleTeacherLogin();
        } else {
            await handleStudentLogin();
        }
    };

    const acceptTeacherSession = (teacher: any): boolean => {
        const teacherUsername = String(teacher?.username || '').trim();
        const teacherFullNameRaw = String(
            teacher?.fullName || teacher?.fullname || teacher?.full_name || teacher?.name || '',
        ).trim();
        const teacherFullName = teacherFullNameRaw || teacherUsername;
        const isTeacherAdmin = String(teacher?.role || '').trim().toLowerCase() === 'admin';
        const teacherClass = teacher?.class ? String(teacher.class).trim() : undefined;
        if (!teacherUsername) return false;

        setFormError(null);
        persistSavedLoginAccount();
        if (teacher.requiresPasswordChange) {
            authStore.loginPendingPasswordChange();
            setPendingTeacher({
                username: teacherUsername,
                fullName: teacherFullName,
                isAdmin: isTeacherAdmin,
                class: teacherClass,
            });
            return true;
        }

        authStore.loginSuccess(teacherUsername, teacherFullName, isTeacherAdmin, teacherClass);
        return true;
    };

    const handleTeacherLogin = async () => {
        authStore.loginStart();
        try {
            const { callApi } = await import('../../services/apiAdapter');
            const result = await callApi<{ status?: string; data?: any; message?: string }>('login', { username, password });
            if (result?.status === 'success' && result.data && acceptTeacherSession(result.data)) return;
            authStore.loginFailure();
            const message = result?.message || 'Tên đăng nhập hoặc mật khẩu không đúng!';
            setFormError(message);
            showError(message);
        } catch (error) {
            console.error('Login error:', error);
            authStore.loginFailure();
            const message = 'Có lỗi xảy ra khi kết nối. Vui lòng thử lại!';
            setFormError(message);
            showError(message);
        }
    };

    const handlePasskeyLogin = async () => {
        if (!username.trim()) {
            const message = 'Hãy nhập tài khoản giáo viên trước.';
            setUsernameError('Vui lòng nhập tên đăng nhập.');
            setFormError(message);
            showError(message);
            return;
        }
        setFormError(null);
        authStore.loginStart();
        setIsPasskeyLoading(true);
        try {
            const teacher = await authenticateTeacherWithPasskey<any>(username);
            if (!acceptTeacherSession(teacher)) throw new Error('Phản hồi tài khoản không hợp lệ.');
        } catch (error) {
            authStore.loginFailure();
            const message = error instanceof Error ? error.message : 'Không thể đăng nhập bằng passkey.';
            setFormError(message);
            showError(message);
        } finally {
            setIsPasskeyLoading(false);
        }
    };

    const handleStudentLogin = async () => {
        const success = await classroomStore.loginStudent({ username, password });
        if (success) {
            setFormError(null);
            persistSavedLoginAccount();
            return;
        }
        const message = 'Tên đăng nhập hoặc mật khẩu học sinh không đúng!';
        setFormError(message);
        showError(message);
    };

    return (
        <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#f7f9fc] font-vietnam text-[#0f172a]">
            <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(219,234,254,0.62)_0%,rgba(219,234,254,0)_72%)]" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-28 bottom-14 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(254,243,199,0.38)_0%,rgba(254,243,199,0)_72%)]" />

            {pendingTeacher && (
                <PasswordChangeDialog forced onCancel={() => {
                    void import('../../services/apiAdapter').then(({ callApi }) => callApi('logout')).catch(() => undefined);
                    setPendingTeacher(null);
                }} onComplete={() => {
                    authStore.loginSuccess(
                        pendingTeacher.username,
                        pendingTeacher.fullName,
                        pendingTeacher.isAdmin,
                        pendingTeacher.class,
                    );
                    setPendingTeacher(null);
                }} />
            )}

            <LandingHeader />
            {notificationFlag.ready && (
                notificationFlag.enabled
                    ? <NotificationSurfaceStack surface="LOGIN" />
                    : <CurrentAnnouncementBanner role={activeTab} />
            )}

            <main className="relative z-10 mx-auto grid w-full max-w-[1280px] flex-1 items-start gap-8 px-4 pb-10 pt-2 md:gap-10 md:px-8 md:pb-12 md:pt-3 lg:grid-cols-[minmax(0,1.16fr)_minmax(400px,0.84fr)] lg:items-center lg:gap-10 lg:px-10 lg:py-6">
                <Suspense fallback={<div className="h-[560px] w-full max-w-[460px] animate-pulse justify-self-end rounded-[28px] bg-white" />}>
                    <LoginForm
                        activeTab={activeTab}
                        setActiveTab={handleRoleChange}
                        username={username}
                        setUsername={(value) => {
                            updateActiveDraft({ username: value });
                            setUsernameError(null);
                            setFormError(null);
                        }}
                        password={password}
                        setPassword={(value) => {
                            updateActiveDraft({ password: value });
                            setPasswordError(null);
                            setFormError(null);
                        }}
                        rememberLogin={rememberLogin}
                        setRememberLogin={handleRememberLoginChange}
                        isLoading={isLoading}
                        onSubmit={handleLogin}
                        onPasskey={() => void handlePasskeyLogin()}
                        isPasskeyLoading={isPasskeyLoading}
                        passkeyAvailable={passkeysSupported()}
                        usernameError={usernameError}
                        passwordError={passwordError}
                        formError={formError}
                    />
                </Suspense>

                <Suspense fallback={<div className="h-64 animate-pulse rounded-[28px] bg-white/70" />}>
                    <HeroSection />
                </Suspense>
            </main>

            <LandingFooter />
        </div>
    );
};

export default LoginLandingPage;
