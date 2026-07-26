import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { getParentActivation } from '../parentPortalService';
import type { ParentActivationPreview } from '../types';
import { useParentPortalStore } from '../useParentPortalStore';

export default function ParentActivatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activate = useParentPortalStore(state => state.activate);
  const isLoading = useParentPortalStore(state => state.isLoading);
  const storeError = useParentPortalStore(state => state.error);
  const token = searchParams.get('token')?.trim() || '';
  const [preview, setPreview] = useState<ParentActivationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setPreviewError('Liên kết kích hoạt không hợp lệ. Vui lòng xin giáo viên cấp lại QR.');
      return () => { active = false; };
    }
    void getParentActivation(token)
      .then(value => { if (active) setPreview(value); })
      .catch(() => {
        if (active) setPreviewError('Liên kết kích hoạt đã hết hạn hoặc không còn sử dụng được.');
      });
    return () => { active = false; };
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!/^\d{6}$/.test(pin)) {
      setFormError('PIN phải gồm đúng 6 chữ số.');
      return;
    }
    if (pin !== confirmPin) {
      setFormError('Hai lần nhập PIN chưa giống nhau.');
      return;
    }
    if (await activate(token, pin)) navigate('/dashboard', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-indigo-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl shadow-emerald-100/70 sm:p-8">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold text-emerald-700">Kích hoạt quyền phụ huynh</p>
        <h1 className="mt-1 text-2xl font-bold">Xác nhận học sinh</h1>

        {!preview && !previewError && <p role="status" className="mt-6 text-sm text-slate-500">Đang kiểm tra mã QR…</p>}
        {previewError && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{previewError}</p>}
        {preview && (
          <>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-lg font-bold text-slate-900">{preview.student.fullName}</p>
              <p className="text-sm text-slate-500">Lớp {preview.student.className}</p>
            </div>
            <form className="mt-6 space-y-5" onSubmit={submit}>
              <label className="block text-sm font-semibold text-slate-700">
                Tạo PIN 6 số
                <input
                  aria-label="Tạo PIN 6 số"
                  value={pin}
                  onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  maxLength={6}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 tracking-[0.4em] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Nhập lại PIN
                <input
                  aria-label="Nhập lại PIN"
                  value={confirmPin}
                  onChange={event => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  maxLength={6}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 tracking-[0.4em] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </label>
              {(formError || storeError) && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{formError || storeError}</p>}
              <button
                type="submit"
                disabled={isLoading || pin.length !== 6 || confirmPin.length !== 6}
                className="min-h-12 w-full rounded-xl bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isLoading ? 'Đang kích hoạt…' : 'Kích hoạt và đăng nhập'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
