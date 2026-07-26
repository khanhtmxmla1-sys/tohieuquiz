import React from 'react';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useParentPortalStore } from '../useParentPortalStore';

export default function ParentProfilePage() {
  const session = useParentPortalStore(state => state.session);
  const accessCodeMasked = useParentPortalStore(state => state.accessCodeMasked);
  const logout = useParentPortalStore(state => state.logout);
  const navigate = useNavigate();
  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Thông tin học sinh</h1><p className="mt-1 text-sm text-slate-500">Quyền truy cập này chỉ liên kết với một học sinh.</p></div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-indigo-100 text-indigo-700">{session?.avatar ? <img src={session.avatar} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8" />}</div><div><h2 className="text-xl font-bold">{session?.fullName}</h2><p className="text-slate-500">Lớp {session?.className}</p></div></div>
        <div className="mt-6 rounded-2xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">Mã phụ huynh</p><p className="mt-1 font-mono text-lg font-bold tracking-[0.15em] text-slate-800">{accessCodeMasked || '••••••••••'}</p><p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" />Mã đầy đủ và PIN không được hiển thị lại trên cổng phụ huynh.</p></div>
      </section>
      <button type="button" onClick={signOut} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 font-bold text-white sm:w-auto"><LogOut className="h-5 w-5" />Đăng xuất</button>
    </div>
  );
}
