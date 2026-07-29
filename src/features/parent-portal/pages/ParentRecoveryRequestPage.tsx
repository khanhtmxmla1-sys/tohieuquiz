import React, { useState } from 'react';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { requestPinRecovery } from '../parentPortalService';

export default function ParentRecoveryRequestPage() {
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await requestPinRecovery(accessCode.replace(/\s+/g, '').toUpperCase(), email.trim());
      setMessage('Nếu thông tin khớp với email đã xác minh, liên kết đặt lại PIN sẽ được gửi trong ít phút.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể gửi yêu cầu lúc này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-6 shadow-xl shadow-indigo-100/70 sm:p-8">
        <Link to="/login" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
          <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
        </Link>
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
          <Mail className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Khôi phục PIN phụ huynh</h1>
        <p className="mt-2 text-sm text-slate-500">Nhập mã phụ huynh và email đã xác minh. Hệ thống luôn trả cùng một thông báo để bảo vệ tài khoản.</p>
        <form className="mt-7 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-semibold text-slate-700">
            Mã phụ huynh
            <input
              value={accessCode}
              onChange={event => setAccessCode(event.target.value.replace(/\s+/g, '').toUpperCase().slice(0, 10))}
              autoComplete="username"
              maxLength={10}
              required
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 uppercase tracking-[0.16em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Email đã xác minh
            <input
              value={email}
              onChange={event => setEmail(event.target.value.slice(0, 254))}
              type="email"
              autoComplete="email"
              required
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          {message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="min-h-12 w-full rounded-xl bg-indigo-600 px-4 font-bold text-white disabled:opacity-50">
            {isSubmitting ? 'Đang gửi…' : 'Gửi liên kết đặt lại PIN'}
          </button>
        </form>
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Liên kết chỉ dùng một lần và hết hạn sau 30 phút.
        </p>
      </section>
    </div>
  );
}
