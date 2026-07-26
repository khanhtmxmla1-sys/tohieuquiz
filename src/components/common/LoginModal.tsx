import React, { useState } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { useClassroomStore } from '../../stores/useClassroomStore';
import { useQuizStore } from '../../../stores/quizStore';
import { Loader2, KeyRound, User, Lock, GraduationCap, Apple } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { showError } from '../../utils/toast';
import PasswordChangeDialog from './PasswordChangeDialog';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'student' | 'teacher';
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, initialTab = 'student' }) => {
    const [activeTab, setActiveTab] = useState<'student' | 'teacher'>(initialTab);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [pendingTeacher, setPendingTeacher] = useState<any | null>(null);

    // Stores
    const authStore = useAuthStore();
    const classroomStore = useClassroomStore();
    const quizStore = useQuizStore();



    const isLoading = activeTab === 'teacher' ? authStore.isLoggingIn : classroomStore.isLoading;

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
        
        // DEV-only bypass. Production must use real login so JWT is issued.
        if (import.meta.env.DEV && username === 'admin' && password === 'admin') {
            authStore.loginSuccess('admin', 'Admin Test', true, '4A');
            onClose();
            return;
        }

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
                    setPendingTeacher({ ...teacher, username: tUsername, fullName: tFullName, isAdmin: isTeacherAdmin, class: tClass });
                    return;
                }
                authStore.loginSuccess(tUsername, tFullName, isTeacherAdmin, tClass);
                onClose();
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
        if (success) {
            onClose();
            quizStore.setView('student_portal');
        } else {
            showError('Tên đăng nhập hoặc mật khẩu học sinh không đúng!');
        }
    };

    if (!isOpen) return null;

    if (pendingTeacher) {
        return <PasswordChangeDialog forced onCancel={() => {
            void import('../../services/apiAdapter').then(({ callApi }) => callApi('logout')).catch(() => undefined);
            setPendingTeacher(null);
        }} onComplete={() => {
            authStore.loginSuccess(pendingTeacher.username, pendingTeacher.fullName, pendingTeacher.isAdmin, pendingTeacher.class);
            setPendingTeacher(null);
            onClose();
        }} />;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with blur & blue tint */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />

            {/* Modal Container */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-[420px] bg-white rounded-[28px] md:rounded-[32px] p-5 md:p-8 pt-8 md:pt-10 shadow-2xl overflow-visible"
                style={{
                    boxShadow: '0 20px 50px rgba(0,0,0,0.15)'
                }}
            >
                {/* Mascot Peeking */}
                <div className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-[120px] h-[120px] hidden sm:flex items-center justify-center z-10 pointer-events-none">
                    <span className="text-[80px] filter drop-shadow-xl transform hover:scale-110 transition-transform cursor-pointer">🐝</span>
                </div>

                {/* Tabs */}
                <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 mb-8 relative z-0">
                    <button
                        onClick={() => setActiveTab('student')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'student'
                            ? 'bg-white text-blue-600 shadow-sm scale-[1.02]'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <GraduationCap className={`w-5 h-5 ${activeTab === 'student' ? 'text-blue-500' : ''}`} />
                        Học sinh
                    </button>
                    <button
                        onClick={() => setActiveTab('teacher')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'teacher'
                            ? 'bg-white text-blue-600 shadow-sm scale-[1.02]'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <Apple className={`w-5 h-5 ${activeTab === 'teacher' ? 'text-blue-500' : ''}`} />
                        Giáo viên
                    </button>
                </div>

                {/* Form */}
                <div className="space-y-6">
                    <div className="text-center mb-2">
                        <h2 className="text-2xl font-black text-slate-800">
                            {activeTab === 'student' ? 'Chào mừng em!' : 'Kính chào Thầy/Cô!'}
                        </h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">
                            {activeTab === 'student' ? 'Nhập tài khoản để vào lớp học ảo' : 'Đăng nhập để quản lý lớp học'}
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                {activeTab === 'student' ? 'Tên đăng nhập' : 'Username'}
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <User className="w-6 h-6" />
                                </div>
                                <input
                                    type="text"
                                    autoComplete="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-[52px] pr-4 h-14 border-2 border-slate-200 rounded-2xl focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700 bg-slate-50 focus:bg-white"
                                    placeholder="Tài Khoản"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                Mật khẩu
                            </label>
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                    <Lock className="w-6 h-6" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-[52px] pr-4 h-14 border-2 border-slate-200 rounded-2xl focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700 bg-slate-50 focus:bg-white"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>



                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-14 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    Vào lớp ngay!
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-full transition-all"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </motion.div>
        </div>
    );
};

export default LoginModal;
