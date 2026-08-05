import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, HeartHandshake, KeyRound, LockKeyhole, QrCode, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router';
import SchoolLogo from '../../../components/common/SchoolLogo';
import { useParentPortalStore } from '../useParentPortalStore';

export default function ParentLoginPage() {
  const session = useParentPortalStore(state => state.session);
  const login = useParentPortalStore(state => state.login);
  const isLoading = useParentPortalStore(state => state.isLoading);
  const error = useParentPortalStore(state => state.error);
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  if (session) return <Navigate to="/dashboard" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setHasSubmitted(true);
    const normalizedCode = accessCode.replace(/\s+/g, '').toUpperCase();
    if (await login(normalizedCode, pin)) navigate('/dashboard', { replace: true });
  };

  const inputClassName = 'mt-2 h-[52px] w-full rounded-[14px] border border-[#dbe4f0] bg-[#f8fafc] px-4 text-base text-[#0f172a] outline-none transition-[background-color,border-color,box-shadow] placeholder:text-[#94a3b8] hover:border-[#bfdbfe] focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-[#2563eb]/10 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#f8fafc] font-vietnam text-[#0f172a]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-28 h-72 w-72 rounded-full bg-[#dbeafe]/55 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-16 h-72 w-72 rounded-full bg-[#fef3c7]/50 blur-2xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <a href="https://thtohieu.com/" className="inline-flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2" aria-label="Về trang chính TôHiệuQuiz">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#dbe4f0] bg-white shadow-[0_10px_28px_-22px_rgba(30,58,138,0.8)]"><SchoolLogo size={32} decorative /></span>
          <span className="text-lg font-bold tracking-[-0.03em] text-[#1e3a8a]">TôHiệu<span className="text-[#d6a900]">Quiz</span></span>
        </a>
        <a href="https://thtohieu.com/" aria-label="Đăng nhập học sinh hoặc giáo viên" className="inline-flex min-h-11 items-center gap-2 rounded-[13px] px-3 text-sm font-semibold text-[#64748b] transition-colors hover:bg-white hover:text-[#1e3a8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Đăng nhập học sinh / giáo viên</span>
          <span className="sm:hidden">Quay lại</span>
        </a>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1180px] items-center gap-8 px-4 pb-12 pt-3 sm:px-6 lg:min-h-[calc(100dvh-84px)] lg:grid-cols-[minmax(0,1fr)_minmax(390px,0.78fr)] lg:gap-16 lg:px-8 lg:pb-20">
        <section className="hidden max-w-[580px] lg:block" aria-labelledby="parent-login-intro">
          <div className="inline-flex min-h-8 items-center gap-2 rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff] px-3 text-xs font-bold uppercase tracking-[0.15em] text-[#1d4ed8]"><HeartHandshake className="h-4 w-4" aria-hidden="true" />Đồng hành cùng con</div>
          <h2 id="parent-login-intro" className="mt-5 text-[clamp(2.5rem,4.3vw,4rem)] font-bold leading-[1.08] tracking-[-0.045em] text-[#1e3a8a]">Hiểu rõ tiến bộ,<span className="block text-[#2563eb]">động viên đúng lúc</span></h2>
          <p className="mt-5 max-w-[540px] text-[1.03rem] leading-8 text-[#475569]">Xem kết quả, bài tập, chứng nhận và những gợi ý thiết thực để đồng hành cùng quá trình học tập của con mỗi tuần.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <article className="rounded-[20px] border border-[#e2e8f0] bg-white/85 p-5 shadow-[0_18px_48px_-40px_rgba(30,58,138,0.75)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#eff6ff] text-[#2563eb]"><QrCode className="h-5 w-5" aria-hidden="true" /></span>
              <h3 className="mt-4 font-bold text-[#1e293b]">Mã riêng của gia đình</h3>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">Mã phụ huynh được tạo khi kích hoạt tài khoản từ lời mời QR của nhà trường.</p>
            </article>
            <article className="rounded-[20px] border border-[#e2e8f0] bg-white/85 p-5 shadow-[0_18px_48px_-40px_rgba(30,58,138,0.75)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#ecfdf5] text-[#15803d]"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
              <h3 className="mt-4 font-bold text-[#1e293b]">Dữ liệu được bảo vệ</h3>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">Chỉ hiển thị dữ liệu tổng hợp cần thiết của học sinh đã được liên kết.</p>
            </article>
          </div>
        </section>

        <section className="w-full max-w-[470px] justify-self-center lg:justify-self-end" aria-labelledby="parent-login-title">
          <div className="rounded-[30px] border border-[#dbe4f0] bg-white/60 p-1.5 shadow-[0_30px_80px_-44px_rgba(30,58,138,0.55)]">
            <div className="rounded-[25px] bg-white px-5 py-6 sm:px-8 sm:py-8">
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <span className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[#eff6ff] text-[#2563eb]"><HeartHandshake className="h-6 w-6" aria-hidden="true" /></span>
                <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Cổng phụ huynh</p><p className="text-sm text-[#64748b]">Đồng hành cùng quá trình học của con</p></div>
              </div>
              <span className="hidden h-12 w-12 items-center justify-center rounded-[15px] bg-[#eff6ff] text-[#2563eb] lg:flex"><KeyRound className="h-6 w-6" aria-hidden="true" /></span>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-[#2563eb]">TôHiệuQuiz · Cổng phụ huynh</p>
              <h1 id="parent-login-title" className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#0f172a] sm:text-[1.75rem]">Đăng nhập phụ huynh</h1>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">Nhập mã phụ huynh và PIN 6 số đã tạo khi kích hoạt tài khoản.</p>

              <form className="mt-7 space-y-5" onSubmit={submit}>
                <label className="block text-sm font-semibold text-[#1e293b]">Mã phụ huynh
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-[30px] h-5 w-5 text-[#94a3b8]" aria-hidden="true" />
                    <input value={accessCode} onChange={event => setAccessCode(event.target.value.replace(/\s+/g, '').toUpperCase().slice(0, 10))} autoCapitalize="characters" autoComplete="username" maxLength={10} placeholder="VD: ABCDEFG234" className={`${inputClassName} pl-11 uppercase tracking-[0.13em]`} required />
                  </div>
                </label>
                <label className="block text-sm font-semibold text-[#1e293b]">PIN 6 số
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-[30px] h-5 w-5 text-[#94a3b8]" aria-hidden="true" />
                    <input value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} type={showPin ? 'text' : 'password'} inputMode="numeric" pattern="[0-9]*" autoComplete="current-password" maxLength={6} placeholder="••••••" className={`${inputClassName} pl-11 pr-12 tracking-[0.35em]`} required />
                    <button type="button" onClick={() => setShowPin(value => !value)} className="absolute right-1 top-[24px] flex h-11 w-11 items-center justify-center rounded-[11px] text-[#64748b] transition-colors hover:bg-[#eff6ff] hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]" aria-label={showPin ? 'Ẩn PIN' : 'Hiện PIN'}>
                      {showPin ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                    </button>
                  </div>
                </label>
                {hasSubmitted && error && <p role="alert" className="rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-medium text-[#b91c1c]">{error}</p>}
                <button type="submit" disabled={isLoading || accessCode.replace(/\s+/g, '').length !== 10 || pin.length !== 6} className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2563eb] px-4 font-bold text-white shadow-[0_16px_32px_-20px_rgba(37,99,235,0.9)] transition-[background-color,box-shadow,transform] hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/25 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50">
                  {isLoading ? 'Đang đăng nhập…' : 'Đăng nhập'}{!isLoading && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
                </button>
                <Link to="/recover" className="flex min-h-11 items-center justify-center text-sm font-semibold text-[#2563eb] underline-offset-4 hover:text-[#1d4ed8] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">Quên PIN?</Link>
              </form>
              <div className="mt-4 flex items-start gap-2.5 rounded-[14px] bg-[#f8fafc] px-3.5 py-3 text-xs leading-5 text-[#64748b]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" aria-hidden="true" />Mã và PIN chỉ dùng để truy cập dữ liệu của học sinh đã được gia đình xác nhận.</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
