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

type SavedLoginAccount = {
    username: string;
    role: 'student' | 'teacher';
    savedAt: string;
};

const SAVED_LOGIN_KEY = 'tohieuquiz_saved_login_v1';

const LoginLandingPage: React.FC = () => {
    const location = useLocation();
    const requestedRole = new URLSearchParams(location.search).get('login');
    const [activeTab, setActiveTab] = useState<'student' | 'teacher'>(
        requestedRole === 'teacher' ? 'teacher' : 'student',
    );
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberLogin, setRememberLogin] = useState(false);
    const [pendingTeacher, setPendingTeacher] = useState<any | null>(null);
    const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

    const authStore = useAuthStore();
    const classroomStore = useClassroomStore();
    const notificationFlag = useUnifiedNotificationsFeatureFlag();

    useEffect(() => {
        try {
            const raw = localStorage.getItem(SAVED_LOGIN_KEY);
            if (!raw) return;

            const saved = JSON.parse(raw) as Partial<SavedLoginAccount>;
            if (typeof saved.username === 'string' && saved.username.trim()) {
                setUsername(saved.username.trim());
                setRememberLogin(true);
            }
            if (
                requestedRole !== 'teacher'
                && requestedRole !== 'student'
                && (saved.role === 'teacher' || saved.role === 'student')
            ) {
                setActiveTab(saved.role);
            }
        } catch (error) {
            console.warn('Could not load saved login account:', error);
        }
    }, [requestedRole]);

    const isLoading = activeTab === 'teacher' ? authStore.isLoggingIn : classroomStore.isLoading;

    const persistSavedLoginAccount = () => {
        try {
            if (!rememberLogin) {
                localStorage.removeItem(SAVED_LOGIN_KEY);
                return;
            }

            localStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify({
                username: username.trim(),
                role: activeTab,
                savedAt: new Date().toISOString(),
            } satisfies SavedLoginAccount));
        } catch (error) {
            console.warn('Could not save login account:', error);
        }
    };

    const handleRememberLoginChange = (checked: boolean) => {
        setRememberLogin(checked);
        if (!checked) {
            try {
                localStorage.removeItem(SAVED_LOGIN_KEY);
            } catch (error) {
                console.warn('Could not clear saved login account:', error);
            }
        }
    };

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!username || !password) {
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
            showError(result?.message || 'Tên đăng nhập hoặc mật khẩu không đúng!');
        } catch (error) {
            console.error('Login error:', error);
            authStore.loginFailure();
            showError('Có lỗi xảy ra khi kết nối. Vui lòng thử lại!');
        }
    };

    const handlePasskeyLogin = async () => {
        if (!username.trim()) {
            showError('Hãy nhập tài khoản giáo viên trước.');
            return;
        }
        authStore.loginStart();
        setIsPasskeyLoading(true);
        try {
            const teacher = await authenticateTeacherWithPasskey<any>(username);
            if (!acceptTeacherSession(teacher)) throw new Error('Phản hồi tài khoản không hợp lệ.');
        } catch (error) {
            authStore.loginFailure();
            showError(error instanceof Error ? error.message : 'Không thể đăng nhập bằng passkey.');
        } finally {
            setIsPasskeyLoading(false);
        }
    };

    const handleStudentLogin = async () => {
        const success = await classroomStore.loginStudent({ username, password });
        if (success) {
            persistSavedLoginAccount();
            return;
        }
        showError('Tên đăng nhập hoặc mật khẩu học sinh không đúng!');
    };

    return (
        <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#f8fafc] font-vietnam text-[#0f172a]">
            <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-28 h-64 w-64 rounded-full bg-[#dbeafe]/60" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-24 h-72 w-72 rounded-full bg-[#fef3c7]/55" />

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

            <main className="relative z-10 mx-auto grid w-full max-w-[1280px] flex-1 items-center gap-6 px-4 pb-8 pt-2 md:gap-8 md:px-8 md:pb-10 md:pt-3 lg:grid-cols-[minmax(0,1.16fr)_minmax(380px,0.84fr)] lg:gap-14 lg:px-10 lg:py-6">
                <Suspense fallback={<div className="h-64 animate-pulse rounded-[28px] bg-white/70" />}>
                    <HeroSection />
                </Suspense>

                <Suspense fallback={<div className="h-[560px] w-full max-w-[460px] animate-pulse justify-self-end rounded-[28px] bg-white" />}>
                    <LoginForm
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        username={username}
                        setUsername={setUsername}
                        password={password}
                        setPassword={setPassword}
                        rememberLogin={rememberLogin}
                        setRememberLogin={handleRememberLoginChange}
                        isLoading={isLoading}
                        onSubmit={handleLogin}
                        onPasskey={() => void handlePasskeyLogin()}
                        isPasskeyLoading={isPasskeyLoading}
                        passkeyAvailable={passkeysSupported()}
                    />
                </Suspense>
            </main>

            <LandingFooter />
        </div>
    );
};

export default LoginLandingPage;
