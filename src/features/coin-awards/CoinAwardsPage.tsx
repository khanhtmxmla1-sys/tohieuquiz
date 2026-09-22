import { useCallback, useEffect, useRef } from 'react';
import type { CoinAwardCreateInput } from '../../../shared/coin-awards.contract';
import { useAuthStore } from '../../../stores/authStore';
import { useClassStore } from '../../stores/useClassStore';
import { useCoinAwardsFeatureFlag } from './useCoinAwardsFeatureFlag';
import { useCoinAwardsStore } from './useCoinAwardsStore';
import { AwardComposer, type CoinAwardDraft } from './components/AwardComposer';
import { AwardHistory } from './components/AwardHistory';
import { AwardReceipt } from './components/AwardReceipt';
import { AwardSettings } from './components/AwardSettings';

export interface CoinAwardsPageProps {
  initialClassId?: string;
  initialStudentIds?: string[];
}

const toStoreInput = (draft: CoinAwardDraft): Omit<CoinAwardCreateInput, 'idempotencyKey'> => draft;

const CoinAwardsPage = ({ initialClassId, initialStudentIds = [] }: CoinAwardsPageProps) => {
  const flag = useCoinAwardsFeatureFlag();
  const authStore = useAuthStore();
  const classStore = useClassStore();
  const store = useCoinAwardsStore();
  const settingsLoadStartedRef = useRef(false);
  const startSettingsLoad = useCallback(() => {
    settingsLoadStartedRef.current = true;
    void store.loadSettings();
  }, [store.loadSettings]);

  useEffect(() => {
    if (flag.ready && flag.enabled && authStore.isAdmin) void classStore.fetchClasses();
  }, [authStore.isAdmin, classStore.fetchClasses, flag.enabled, flag.ready]);

  const classes = authStore.isAdmin
    ? classStore.classes
    : authStore.teacherClasses.length > 0
    ? authStore.teacherClasses
    : (authStore.teacherClass ? [{ id: authStore.teacherClass, name: authStore.teacherClass }] : []);
  const resolvedClasses = initialClassId && !classes.some((item) => item.id === initialClassId)
    ? [...classes, { id: initialClassId, name: initialClassId }]
    : classes;
  const settingsReady = Boolean(store.settings?.updatedAt?.trim());

  useEffect(() => {
    if (!flag.enabled || !flag.ready) return;
    const shouldLoadSettings = store.view === 'award'
      || (store.view === 'settings' && authStore.isAdmin);
    if (shouldLoadSettings && !settingsReady && !store.loadingSettings && !settingsLoadStartedRef.current) {
      startSettingsLoad();
    }
    if (store.view === 'history') void store.loadHistory();
  }, [authStore.isAdmin, flag.enabled, flag.ready, settingsReady, startSettingsLoad, store.loadHistory, store.loadingSettings, store.view]);

  const adjustBatch = useCallback(async (parentBatchId: string, input: Parameters<typeof store.adjustBatch>[1]) => {
    const result = await store.adjustBatch(parentBatchId, input);
    if (result) await store.loadHistory();
    return result;
  }, [store.adjustBatch, store.loadHistory]);

  if (!flag.ready) return <div role="status" className="mx-auto w-full max-w-5xl py-12 text-center text-sm text-slate-500">Đang tải cấu hình thưởng xu…</div>;
  if (!flag.enabled) {
    return <div role="alert" className="mx-auto w-full max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950"><h1 className="text-xl font-semibold">Tính năng thưởng xu hiện đang tắt</h1><p className="mt-2 text-sm">Quản trị viên chưa bật tính năng này. Không có giao dịch nào được thực hiện.</p></div>;
  }

  const submitAward = async (draft: CoinAwardDraft) => store.submitAward(toStoreInput(draft));
  const settingsGateActive = store.view === 'award' || (store.view === 'settings' && authStore.isAdmin);
  const settingsUnavailable = settingsGateActive && !settingsReady && !store.loadingSettings && settingsLoadStartedRef.current;
  const settingsPending = settingsGateActive && !settingsReady && !settingsUnavailable;
  const retrySettings = () => {
    if (store.loadingSettings) return;
    settingsLoadStartedRef.current = false;
    startSettingsLoad();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header>
        <p className="text-sm font-medium text-blue-700">Học sinh · Động lực học tập</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Thưởng xu</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Ghi nhận tiến bộ của học sinh bằng một giao dịch minh bạch, có lý do và có thể kiểm tra lại.</p>
      </header>

      <div role="tablist" aria-label="Các khu vực thưởng xu" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button type="button" role="tab" aria-selected={store.view === 'award'} onClick={() => store.setView('award')} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${store.view === 'award' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Cộng xu</button>
        <button type="button" role="tab" aria-selected={store.view === 'history'} onClick={() => store.setView('history')} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${store.view === 'history' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Lịch sử</button>
        {authStore.isAdmin && <button type="button" role="tab" aria-selected={store.view === 'settings'} onClick={() => store.setView('settings')} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${store.view === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Cài đặt</button>}
      </div>

      {store.error && !settingsUnavailable && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{store.error}</div>}
      {store.receipt && store.view !== 'settings' && <AwardReceipt receipt={store.receipt} submitting={store.submitting} onReverse={store.reverseBatch} />}
      {settingsPending && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải cấu hình giới hạn thưởng xu…</div>}
      {settingsUnavailable && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
          <h2 className="text-lg font-semibold">Không thể tải cấu hình thưởng xu</h2>
          <p className="mt-2 text-sm">Chưa thể xác định giới hạn cộng xu. Vui lòng thử lại trước khi tiếp tục.</p>
          <button type="button" onClick={retrySettings} className="mt-4 min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Thử lại</button>
        </div>
      )}
      {store.view === 'award' && settingsReady && store.settings && (
        <>
          <AwardComposer classes={resolvedClasses} initialClassId={initialClassId} initialStudentIds={initialStudentIds} settings={store.settings} submitting={store.submitting} onPreview={(draft) => store.previewAward(toStoreInput(draft))} onSubmit={submitAward} />
        </>
      )}
      {store.view === 'history' && <AwardHistory items={store.history} loading={store.loadingHistory} nextCursor={store.nextCursor} isAdmin={authStore.isAdmin} onLoadMore={store.loadMoreHistory} onAdjust={adjustBatch} />}
      {store.view === 'settings' && authStore.isAdmin && settingsReady && store.settings && <AwardSettings settings={store.settings} loading={store.loadingSettings} submitting={store.submitting} onSubmit={store.updateSettings} />}
    </div>
  );
};

export default CoinAwardsPage;
export { CoinAwardsPage };
