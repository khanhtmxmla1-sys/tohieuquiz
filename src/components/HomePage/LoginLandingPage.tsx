import React, { useState, useEffect, Suspense } from 'react';
import { useLocation } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { useClassroomStore } from '../../stores/useClassroomStore';
import { showError, showConfirm } from '../../utils/toast';
import PasswordChangeDialog from '../common/PasswordChangeDialog';
import CurrentAnnouncementBanner from '../common/CurrentAnnouncementBanner';
import { NotificationSurfaceStack } from '../../features/notifications/components';
import { useUnifiedNotificationsFeatureFlag } from '../../features/notifications/useUnifiedNotificationsFeatureFlag';

// Sub-components
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
    const [pendingTeacher, setPendingTeacher] = useState<any | null>(null);

    const authStore = useAuthStore();
    const classroomStore = useClassroomStore();
    const notificationFlag = useUnifiedNotificationsFeatureFlag();

    // Session Persistence
    useEffect(() => {
        try {
            const raw = localStorage.getItem(SAVED_LOGIN_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw) as Partial<SavedLoginAccount>;
            if (typeof saved.username === 'string' && saved.username.trim()) {
                setUsername(saved.username.trim());
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

    // askToSaveAccount has been removed as per user request to avoid annoying popups

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
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

    const handleTeacherLogin = async () => {
        authStore.loginStart();
        try {
            const { callApi } = await import('../../services/apiAdapter');
            const result = await callApi<{ status?: string; data?: any; message?: string }>('login', { username, password });
            
            if (result?.status === 'success' && result.data) {
                const teacher = result.data;
                const tUsername = String(teacher.username || '').trim();
                const tFullNameRaw = String(teacher.fullName || teacher.fullname || teacher.full_name || teacher.name || '').trim();
                const tFullName = tFullNameRaw || tUsername;
                const isTeacherAdmin = String(teacher.role || '').trim().toLowerCase() === 'admin';
                const tClass = teacher.class ? String(teacher.class).trim() : undefined;
                if (teacher.requiresPasswordChange) {
                    authStore.loginPendingPasswordChange();
                    setPendingTeacher({
                        username: tUsername,
                        fullName: tFullName,
                        isAdmin: isTeacherAdmin,
                        class: tClass,
                    });
                    return;
                }
                
                authStore.loginSuccess(tUsername, tFullName, isTeacherAdmin, tClass);
                return;
            }
            authStore.loginFailure();
            showError(result?.message || 'Tên đăng nhập hoặc mật khẩu không đúng!');
        } catch (error) {
            console.error('Login error:', error);
            authStore.loginFailure();
            showError('Có lỗi xảy ra khi kết nối. Vui lòng thử lại!');
        }
    };

    const handleStudentLogin = async () => {
        const success = await classroomStore.loginStudent({ username, password });
        if (!success) {
            showError('Tên đăng nhập hoặc mật khẩu học sinh không đúng!');
        }
    };

    return (
        <div className="min-h-screen flex flex-col relative font-baloo bg-[url('/meadow-bg.webp')] bg-cover bg-bottom bg-no-repeat transition-all duration-500">
            {pendingTeacher && (
                <PasswordChangeDialog forced onCancel={() => {
                    void import('../../services/apiAdapter').then(({ callApi }) => callApi('logout')).catch(() => undefined);
                    setPendingTeacher(null);
                }} onComplete={() => {
                    authStore.loginSuccess(pendingTeacher.username, pendingTeacher.fullName, pendingTeacher.isAdmin, pendingTeacher.class);
                    setPendingTeacher(null);
                }} />
            )}
            <LandingHeader />
            {notificationFlag.ready && (
                notificationFlag.enabled
                    ? <NotificationSurfaceStack surface="LOGIN" />
                    : <CurrentAnnouncementBanner role={activeTab} />
            )}

            <main className="flex-1 flex flex-col md:flex-row items-center justify-between gap-10 px-4 md:px-20 pb-16 max-w-[1280px] mx-auto w-full z-10">
                <Suspense fallback={<div className="flex-1 h-64 animate-pulse bg-white/10 rounded-3xl" />}>
                    <HeroSection />
                </Suspense>
                
                <Suspense fallback={<div className="w-full max-w-md h-96 animate-pulse bg-white/20 rounded-3xl" />}>
                    <LoginForm 
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        username={username}
                        setUsername={setUsername}
                        password={password}
                        setPassword={setPassword}
                        isLoading={isLoading}
                        onSubmit={handleLogin}
                    />
                </Suspense>
            </main>

            <LandingFooter />
        </div>
    );
};

export default LoginLandingPage;
