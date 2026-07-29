import { useEffect, useState } from 'react';
import { LockKeyhole, Store } from 'lucide-react';
import type { GiftShopSettingsResponse, GiftShopSettingsUpdate } from '../../../types/giftShop.types';

interface Props {
  isAdmin: boolean;
  username: string;
  teacherClass: string | null | undefined;
  settings: GiftShopSettingsResponse | null;
  pending: boolean;
  onUpdate: (input: GiftShopSettingsUpdate) => Promise<boolean>;
}

export const GiftShopGovernancePanel = ({
  isAdmin,
  username,
  teacherClass,
  settings,
  pending,
  onUpdate,
}: Props) => {
  const [scopeType, setScopeType] = useState<'SCHOOL' | 'CLASS'>(isAdmin ? 'SCHOOL' : 'CLASS');
  const [schoolId, setSchoolId] = useState(username || '');
  const [classId, setClassId] = useState(String(teacherClass || ''));
  const [closedReason, setClosedReason] = useState('');
  const effective = settings?.effective;

  useEffect(() => {
    if (effective?.schoolId) setSchoolId(effective.schoolId);
    if (effective?.classId) setClassId(effective.classId);
  }, [effective?.schoolId, effective?.classId]);

  const changeState = async (isOpen: boolean) => {
    const success = await onUpdate({
      scopeType: isAdmin ? scopeType : 'CLASS',
      schoolId: isAdmin ? schoolId.trim() : undefined,
      classId: isAdmin ? classId.trim() : undefined,
      isOpen,
      closedReason: isOpen ? '' : closedReason.trim(),
    });
    if (success && isOpen) setClosedReason('');
  };

  return (
    <section className={`rounded-2xl border p-4 md:p-5 ${effective?.isOpen === false ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`} aria-label="Điều hành tiệm tạp hóa">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${effective?.isOpen === false ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {effective?.isOpen === false ? <LockKeyhole className="h-5 w-5" /> : <Store className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="font-bold text-slate-900">{effective?.isOpen === false ? 'Tiệm đang tạm đóng' : 'Tiệm đang mở'}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {effective?.isOpen === false
                ? effective.closedReason || 'Học sinh không thể tạo đơn mới trong phạm vi này.'
                : 'Học sinh trong phạm vi được phép đổi các phần thưởng còn hàng.'}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 lg:w-[560px] lg:grid-cols-2">
          {isAdmin && (
            <>
              <label className="text-sm font-semibold text-slate-700">
                Phạm vi điều khiển
                <select value={scopeType} onChange={(event) => setScopeType(event.target.value as 'SCHOOL' | 'CLASS')} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3">
                  <option value="SCHOOL">Toàn trường</option>
                  <option value="CLASS">Một lớp</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Mã trường
                <input value={schoolId} onChange={(event) => setSchoolId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3" placeholder="Mã trường" />
              </label>
              {scopeType === 'CLASS' && (
                <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
                  Mã lớp
                  <input value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3" placeholder="Mã lớp" />
                </label>
              )}
            </>
          )}
          {effective?.isOpen !== false && (
            <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
              Lý do đóng tiệm
              <input value={closedReason} onChange={(event) => setClosedReason(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3" placeholder="Ví dụ: Đang kiểm kê phần thưởng" />
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
            {effective?.isOpen === false ? (
              <button type="button" onClick={() => void changeState(true)} disabled={pending} className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Mở lại tiệm</button>
            ) : (
              <button type="button" onClick={() => void changeState(false)} disabled={pending || !closedReason.trim() || (isAdmin && (!schoolId.trim() || (scopeType === 'CLASS' && !classId.trim())))} className="min-h-11 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Tạm đóng tiệm</button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
