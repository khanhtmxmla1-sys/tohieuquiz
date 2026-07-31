import React from 'react';
import { KeyRound, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import ParentCommunicationPreferences from '../components/ParentCommunicationPreferences';
import { useParentPortalStore } from '../useParentPortalStore';

export default function ParentProfilePage() {
  const session = useParentPortalStore(state => state.session);
  const accessCodeMasked = useParentPortalStore(state => state.accessCodeMasked);
  const logout = useParentPortalStore(state => state.logout);
  const navigate = useNavigate();
  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Tài khoản gia đình</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#0f172a] sm:text-3xl">Thông tin học sinh</h1>
        <p className="mt-1 text-sm text-[#64748b]">Quyền truy cập này chỉ liên kết với một học sinh đã được gia đình xác nhận.</p>
      </div>

      <section className="overflow-hidden rounded-[24px] border border-[#e2e8f0] bg-white shadow-[0_20px_48px_-40px_rgba(30,58,138,0.7)]">
        <div className="border-b border-[#e2e8f0] bg-[#f8fbff] p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[19px] bg-[#dbeafe] text-[#1d4ed8] shadow-[0_12px_28px_-22px_rgba(37,99,235,0.8)]">
              {session?.avatar ? <img src={session.avatar} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8" aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2563eb]">Học sinh đang theo dõi</p>
              <h2 className="mt-1 truncate text-xl font-bold tracking-[-0.025em] text-[#1e293b]">{session?.fullName}</h2>
              <p className="mt-1 text-sm text-[#64748b]">Lớp {session?.className}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <article className="rounded-[18px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#eff6ff] text-[#2563eb]"><KeyRound className="h-5 w-5" aria-hidden="true" /></span>
            <p className="mt-4 text-sm font-semibold text-[#64748b]">Mã phụ huynh</p>
            <p className="mt-1 font-mono text-lg font-bold tracking-[0.15em] text-[#1e293b]">{accessCodeMasked || '••••••••••'}</p>
          </article>
          <article className="rounded-[18px] border border-[#bbf7d0] bg-[#f0fdf4] p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[#15803d]"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
            <p className="mt-4 text-sm font-bold text-[#166534]">Thông tin được bảo vệ</p>
            <p className="mt-1 text-xs leading-5 text-[#4b5563]">Mã đầy đủ và PIN không được hiển thị lại trên Cổng phụ huynh.</p>
          </article>
        </div>
      </section>

      <ParentCommunicationPreferences />

      <button type="button" onClick={signOut} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-[#e2e8f0] bg-white px-5 font-bold text-[#475569] transition-colors hover:border-[#fecaca] hover:bg-[#fef2f2] hover:text-[#b91c1c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 sm:w-auto"><LogOut className="h-5 w-5" aria-hidden="true" />Đăng xuất</button>
    </div>
  );
}
