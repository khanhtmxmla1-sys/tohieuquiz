import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { confirmPinRecovery } from '../parentPortalService';

export default function ParentRecoveryConfirmPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pin !== confirmPin) {
      setError('Hai lần nhập PIN chưa khớp.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await confirmPinRecovery(token, pin);
      setDone(true);
      window.history.replaceState({}, document.title, '/recover/confirm');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Liên kết không hợp lệ hoặc đã hết hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-6 shadow-xl shadow-indigo-100/70 sm:p-8">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><KeyRound className="h-7 w-7" /></div>
        <h1 className="text-2xl font-bold text-slate-900">Đặt PIN mới</h1>
        {done ? (
          <div className="mt-6 space-y-4">
            <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">PIN đã được cập nhật. Các phiên đăng nhập cũ đã bị vô hiệu hóa.</p>
            <Link to="/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-4 font-bold text-white">Đăng nhập bằng PIN mới</Link>
          </div>
        ) : (
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <p className="text-sm text-slate-500">PIN gồm đúng 6 chữ số và liên kết chỉ có thể sử dụng một lần.</p>
            {[
              { label: 'PIN mới', value: pin, setValue: setPin, autoComplete: 'new-password' },
              { label: 'Nhập lại PIN', value: confirmPin, setValue: setConfirmPin, autoComplete: 'new-password' },
            ].map(field => (
              <label key={field.label} className="block text-sm font-semibold text-slate-700">
                {field.label}
                <input
                  value={field.value}
                  onChange={event => field.setValue(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete={field.autoComplete}
                  required
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 tracking-[0.4em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            ))}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={!token || isSubmitting || pin.length !== 6 || confirmPin.length !== 6} className="min-h-12 w-full rounded-xl bg-indigo-600 px-4 font-bold text-white disabled:opacity-50">
              {isSubmitting ? 'Đang cập nhật…' : 'Cập nhật PIN'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
