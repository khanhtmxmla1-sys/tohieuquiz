import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useParentPortalStore } from '../useParentPortalStore';

export default function ParentLoginPage() {
  const session = useParentPortalStore(state => state.session);
  const login = useParentPortalStore(state => state.login);
  const isLoading = useParentPortalStore(state => state.isLoading);
  const error = useParentPortalStore(state => state.error);
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState('');
  const [pin, setPin] = useState('');

  if (session) return <Navigate to="/dashboard" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedCode = accessCode.replace(/\s+/g, '').toUpperCase();
    if (await login(normalizedCode, pin)) navigate('/dashboard', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white bg-white p-6 shadow-xl shadow-indigo-100/70 sm:p-8">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
          <KeyRound className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold text-indigo-600">TôHiệuQuiz · Cổng phụ huynh</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Đăng nhập phụ huynh</h1>
        <p className="mt-2 text-sm text-slate-500">Nhập mã phụ huynh và PIN 6 số đã tạo khi quét QR.</p>

        <form className="mt-7 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-semibold text-slate-700">
            Mã phụ huynh
            <input
              value={accessCode}
              onChange={event => setAccessCode(event.target.value.replace(/\s+/g, '').toUpperCase().slice(0, 10))}
              autoCapitalize="characters"
              autoComplete="username"
              maxLength={10}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 uppercase tracking-[0.16em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              required
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            PIN 6 số
            <input
              value={pin}
              onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="current-password"
              maxLength={6}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 tracking-[0.4em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              required
            />
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || accessCode.replace(/\s+/g, '').length !== 10 || pin.length !== 6}
            className="min-h-12 w-full rounded-xl bg-indigo-600 px-4 font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
          <Link to="/recover" className="block text-center text-sm font-semibold text-indigo-700 hover:underline">Quên PIN?</Link>
        </form>
      </section>
    </div>
  );
}
