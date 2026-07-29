import React, { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { verifyParentEmail } from '../parentPortalService';

export default function ParentVerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyParentEmail(token);
      setVerified(true);
      window.history.replaceState({}, document.title, '/verify-email');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Liên kết không hợp lệ hoặc đã hết hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-7 text-center shadow-xl shadow-indigo-100/70">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><MailCheck className="h-8 w-8" /></div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">Xác minh email phụ huynh</h1>
        {verified ? (
          <>
            <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Email đã được xác minh và có thể nhận bản tin tuần.</p>
            <Link to="/profile" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-4 font-bold text-white">Mở cài đặt phụ huynh</Link>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-500">Nhấn nút bên dưới để hoàn tất. Liên kết chỉ dùng một lần và hết hạn sau 24 giờ.</p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
            <button type="button" onClick={verify} disabled={!token || isSubmitting} className="mt-6 min-h-12 w-full rounded-xl bg-indigo-600 px-4 font-bold text-white disabled:opacity-50">
              {isSubmitting ? 'Đang xác minh…' : 'Xác minh email'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
