import React, { useState } from 'react';
import {
    ArrowRight,
    Eye,
    EyeOff,
    Fingerprint,
    GraduationCap,
    Loader2,
    Lock,
    UserRound,
} from 'lucide-react';

interface LoginFormProps {
    activeTab: 'student' | 'teacher';
    setActiveTab: (tab: 'student' | 'teacher') => void;
    username: string;
    setUsername: (value: string) => void;
    password: string;
    setPassword: (value: string) => void;
    rememberLogin?: boolean;
    setRememberLogin?: (value: boolean) => void;
    isLoading: boolean;
    onSubmit: (event: React.FormEvent) => void;
    onPasskey?: () => void;
    isPasskeyLoading?: boolean;
    passkeyAvailable?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({
    activeTab,
    setActiveTab,
    username,
    setUsername,
    password,
    setPassword,
    rememberLogin = false,
    setRememberLogin,
    isLoading,
    onSubmit,
    onPasskey,
    isPasskeyLoading = false,
    passkeyAvailable = false,
}) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const roleButtonClass = (role: 'student' | 'teacher') => (
        `flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[13px] px-3 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 active:scale-[0.98] ${
            activeTab === role
                ? 'bg-white text-[#1d4ed8] shadow-[0_5px_16px_-10px_rgba(15,23,42,0.7)]'
                : 'text-[#64748b] hover:bg-white/65 hover:text-[#1e3a8a]'
        }`
    );

    const inputClassName = 'h-[52px] w-full rounded-[14px] border border-[#dbe4f0] bg-[#f8fafc] pl-11 pr-12 text-base text-[#0f172a] outline-none transition-[background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-[#94a3b8] hover:border-[#bfdbfe] focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-[#2563eb]/10 disabled:cursor-not-allowed disabled:opacity-65';

    return (
        <section className="login-page-reveal w-full max-w-[460px] justify-self-end" aria-labelledby="login-title">
            <div className="rounded-[30px] border border-[#dbe4f0] bg-white/55 p-1.5 shadow-[0_28px_80px_-42px_rgba(30,58,138,0.5)]">
                <div className="rounded-[25px] bg-white px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:px-7 sm:py-8 lg:px-8">
                    <header className="mb-5 sm:mb-6">
                        <div className="mb-3 hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#2563eb] sm:flex">
                            <span className="h-2 w-2 rounded-[3px] bg-[#facc15]" aria-hidden="true" />
                            Khu vực đăng nhập
                        </div>
                        <h2 id="login-title" className="text-[1.35rem] font-bold leading-tight tracking-[-0.025em] text-[#0f172a] sm:text-[1.75rem]">
                            Đăng nhập vào TôHiệuQuiz
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[#64748b] sm:text-[0.95rem]">
                            Chọn vai trò và nhập thông tin tài khoản của bạn.
                        </p>
                    </header>

                    <div
                        className="mb-5 flex rounded-[17px] bg-[#eff4ff] p-1 sm:mb-6"
                        data-purpose="role-switcher"
                        role="group"
                        aria-label="Chọn vai trò đăng nhập"
                    >
                        <button
                            type="button"
                            className={roleButtonClass('student')}
                            aria-pressed={activeTab === 'student'}
                            onClick={() => setActiveTab('student')}
                        >
                            <GraduationCap size={18} strokeWidth={1.9} aria-hidden="true" />
                            Học sinh
                        </button>
                        <button
                            type="button"
                            className={roleButtonClass('teacher')}
                            aria-pressed={activeTab === 'teacher'}
                            onClick={() => setActiveTab('teacher')}
                        >
                            <UserRound size={18} strokeWidth={1.9} aria-hidden="true" />
                            Giáo viên
                        </button>
                    </div>

                    <form onSubmit={onSubmit} aria-label="Đăng nhập">
                        <div className="mb-4">
                            <label htmlFor="landing-login-username" className="mb-2 block text-sm font-semibold text-[#1e293b]">
                                Tên đăng nhập
                            </label>
                            <div className="relative">
                                <UserRound
                                    size={19}
                                    strokeWidth={1.8}
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"
                                    aria-hidden="true"
                                />
                                <input
                                    id="landing-login-username"
                                    type="text"
                                    autoComplete="username"
                                    className={inputClassName}
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    placeholder={activeTab === 'student' ? 'Mã học sinh' : 'Tài khoản giáo viên'}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label htmlFor="landing-login-password" className="mb-2 block text-sm font-semibold text-[#1e293b]">
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <Lock
                                    size={19}
                                    strokeWidth={1.8}
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"
                                    aria-hidden="true"
                                />
                                <input
                                    id="landing-login-password"
                                    type={isPasswordVisible ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    className={inputClassName}
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder={activeTab === 'student' ? 'Mật khẩu học sinh' : '••••••••'}
                                    disabled={isLoading}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[11px] text-[#64748b] transition-colors hover:bg-[#eaf1ff] hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    aria-controls="landing-login-password"
                                    onClick={() => setIsPasswordVisible((visible) => !visible)}
                                    disabled={isLoading}
                                >
                                    {isPasswordVisible
                                        ? <EyeOff size={19} strokeWidth={1.8} aria-hidden="true" />
                                        : <Eye size={19} strokeWidth={1.8} aria-hidden="true" />}
                                </button>
                            </div>
                        </div>

                        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
                            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[#475569]">
                                <input
                                    type="checkbox"
                                    className="h-[18px] w-[18px] rounded border-[#cbd5e1] accent-[#2563eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                                    checked={rememberLogin}
                                    onChange={(event) => setRememberLogin?.(event.target.checked)}
                                />
                                Ghi nhớ đăng nhập
                            </label>
                            <a
                                href="mailto:support@thtohieu.com?subject=Hỗ trợ đặt lại mật khẩu TôHiệuQuiz"
                                className="flex min-h-11 items-center font-semibold text-[#2563eb] underline-offset-4 hover:text-[#1d4ed8] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                            >
                                Quên mật khẩu?
                            </a>
                        </div>

                        <button
                            type="submit"
                            className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2563eb] px-5 text-base font-bold text-white shadow-[0_14px_28px_-18px_rgba(37,99,235,0.9)] transition-[background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#1d4ed8] hover:shadow-[0_18px_34px_-18px_rgba(29,78,216,0.95)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/25 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-65"
                            disabled={isLoading}
                            aria-busy={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2" aria-live="polite">
                                    <Loader2 className="animate-spin motion-reduce:animate-none" size={20} aria-hidden="true" />
                                    Đang đăng nhập…
                                </span>
                            ) : (
                                <>
                                    Đăng nhập
                                    <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white/15 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true">
                                        <ArrowRight size={16} strokeWidth={2} />
                                    </span>
                                </>
                            )}
                        </button>

                        {activeTab === 'teacher' && passkeyAvailable && onPasskey && (
                            <>
                                <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-[#94a3b8]">
                                    <span className="h-px flex-1 bg-[#dbe4f0]" />
                                    hoặc
                                    <span className="h-px flex-1 bg-[#dbe4f0]" />
                                </div>
                                <button
                                    type="button"
                                    onClick={onPasskey}
                                    disabled={isLoading || isPasskeyLoading}
                                    aria-busy={isPasskeyLoading}
                                    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#bfdbfe] bg-[#eff6ff] px-5 text-base font-bold text-[#1d4ed8] transition-[background-color,border-color,transform] hover:border-[#93c5fd] hover:bg-[#dbeafe] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/20 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isPasskeyLoading
                                        ? <Loader2 className="animate-spin motion-reduce:animate-none" size={20} aria-hidden="true" />
                                        : <Fingerprint size={20} strokeWidth={1.9} aria-hidden="true" />}
                                    Đăng nhập bằng passkey
                                </button>
                            </>
                        )}
                    </form>

                    <p className="mt-5 text-center text-sm leading-6 text-[#64748b]">
                        Cần hỗ trợ?{' '}
                        <a
                            href="mailto:support@thtohieu.com"
                            className="font-semibold text-[#2563eb] underline-offset-4 hover:text-[#1d4ed8] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                        >
                            Liên hệ Quản trị viên
                        </a>
                    </p>
                </div>
            </div>
        </section>
    );
};

export default LoginForm;
