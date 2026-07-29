import React from 'react';
import { Loader2, GraduationCap, UserRound, Lock, Fingerprint } from 'lucide-react';

interface LoginFormProps {
    activeTab: 'student' | 'teacher';
    setActiveTab: (tab: 'student' | 'teacher') => void;
    username: string;
    setUsername: (val: string) => void;
    password: string;
    setPassword: (val: string) => void;
    isLoading: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onPasskey?: () => void;
    isPasskeyLoading?: boolean;
    passkeyAvailable?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({
    activeTab, setActiveTab, username, setUsername, password, setPassword, isLoading, onSubmit,
    onPasskey, isPasskeyLoading = false, passkeyAvailable = false,
}) => {
    return (
        <div className="w-full max-w-[440px] px-0 md:px-0 order-1 md:order-2">
            <div className="bg-white rounded-[32px] shadow-2xl relative overflow-visible p-6 md:p-10 pt-10 pb-8 border-2 border-white/50 ring-1 ring-black/5">
                {/* Decorative leaves using SVGs directly to avoid escaping issues in Tailwind bg-[url] */}
                <svg className="absolute top-[-15px] left-5 w-[70px] h-[70px] opacity-70 pointer-events-none z-0" viewBox="0 0 100 100">
                    <path d="M30,90 C10,70 10,30 30,10 C50,-10 90,-10 90,30 C90,60 60,95 30,90 Z" fill="#dcfce7" />
                </svg>
                <svg className="absolute bottom-0 right-10 w-[150px] h-[150px] opacity-50 pointer-events-none z-0" viewBox="0 0 100 100">
                    <path d="M80,10 C100,30 100,70 80,90 C60,110 20,110 20,70 C20,40 50,5 80,10 Z" fill="#dcfce7" />
                </svg>

                {/* Card Header */}
                <div className="text-center mb-6 relative z-10">
                    <h2 className="font-extrabold text-[1.8rem] text-[#111827] mb-1">
                        {activeTab === 'student' ? 'Chào mừng em!' : 'Chào Thầy/Cô!'}
                    </h2>
                    <p className="text-[#6b7280] text-[0.95rem] font-medium">
                        {activeTab === 'student' ? 'Đăng nhập để vào lớp học ảo của em' : 'Truy cập bảng điều khiển quản lý'}
                    </p>
                </div>

                {/* Role Toggle */}
                <div className="bg-[#22c55e] rounded-[20px] p-1 flex mb-7 relative z-10 shadow-inner" data-purpose="role-switcher">
                    <button
                        type="button"
                        className={`flex-1 py-2.5 rounded-[20px] flex items-center justify-center gap-2 font-bold text-[0.95rem] transition-all duration-200 border-none outline-none ${
                            activeTab === 'student' ? 'bg-white text-[#064E3B] shadow-sm' : 'bg-transparent text-[#064E3B] hover:bg-white/30'
                        }`}
                        onClick={() => { setActiveTab('student'); }}
                    >
                        <GraduationCap size={18} /> Học sinh
                    </button>
                    <button
                        type="button"
                        className={`flex-1 py-2.5 rounded-[20px] flex items-center justify-center gap-2 font-bold text-[0.95rem] transition-all duration-200 border-none outline-none ${
                            activeTab === 'teacher' ? 'bg-white text-[#064E3B] shadow-sm' : 'bg-transparent text-[#064E3B] hover:bg-white/30'
                        }`}
                        onClick={() => { setActiveTab('teacher'); }}
                    >
                        <UserRound size={18} /> Giáo viên
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit} className="relative z-10">
                    {/* Username */}
                    <div className="mb-5">
                        <label className="block text-[0.8rem] font-extrabold text-[#111827] mb-2 tracking-widest uppercase">
                            Tên đăng nhập
                        </label>
                        <div className="relative">
                            <UserRound size={18} className="text-[#9ca3af] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                autoComplete="username"
                                className="w-full pl-11 pr-4 py-3 bg-[#f9fafb] border-2 border-[#f3f4f6] rounded-[14px] text-[0.95rem] text-[#1f2937] outline-none transition-all focus:border-[#22c55e] focus:bg-white focus:ring-4 focus:ring-green-500/10 placeholder:text-[#9ca3af] placeholder:font-medium"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder={activeTab === 'student' ? 'Mã học sinh' : 'Tài khoản giáo viên'}
                                required
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="mb-7">
                        <label className="block text-[0.8rem] font-extrabold text-[#111827] mb-2 tracking-widest uppercase">
                            Mật khẩu
                        </label>
                        <div className="relative">
                            <Lock size={18} className="text-[#9ca3af] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="password"
                                autoComplete="current-password"
                                className="w-full pl-11 pr-4 py-3 bg-[#f9fafb] border-2 border-[#f3f4f6] rounded-[14px] text-[0.95rem] text-[#1f2937] outline-none transition-all focus:border-[#22c55e] focus:bg-white focus:ring-4 focus:ring-green-500/10 placeholder:text-[#9ca3af] placeholder:font-medium"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={activeTab === 'student' ? 'Mật khẩu học sinh' : '••••••••'}
                                required
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button 
                        type="submit" 
                        className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold text-[1.1rem] rounded-[14px] shadow-lg shadow-green-600/30 transition-all hover:translate-y-[-2px] active:translate-y-[1px] disabled:opacity-65 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="animate-spin" size={20} /> Đang xử lý...
                            </span>
                        ) : 'Đăng nhập ngay'}
                    </button>

                    {activeTab === 'teacher' && passkeyAvailable && onPasskey && (
                        <>
                            <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />ho?c<span className="h-px flex-1 bg-slate-200" /></div>
                            <button
                                type="button"
                                onClick={onPasskey}
                                disabled={isLoading || isPasskeyLoading}
                                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border-2 border-emerald-200 bg-white font-bold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50"
                            >
                                {isPasskeyLoading ? <Loader2 className="animate-spin" size={20} /> : <Fingerprint size={20} />}
                                ??ng nh?p b?ng passkey
                            </button>
                        </>
                    )}
                </form>

                {/* Support */}
                <p className="text-center text-[0.9rem] text-[#6b7280] mt-6 font-medium relative z-10">
                    Cần hỗ trợ?{' '}
                    <a href="mailto:support@thtohieu.com" className="text-[#16a34a] font-bold hover:underline">
                        Liên hệ Quản trị viên
                    </a>
                </p>
            </div>
        </div>
    );
};

export default LoginForm;
