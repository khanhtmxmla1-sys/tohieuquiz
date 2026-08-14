import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Save, Shuffle } from 'lucide-react';
import type { RandomizationPolicy } from '../../../../shared/randomization-policy.contract';
import { getSystemSettings, saveRandomizationSettings } from '../../../services/systemSettingsService';
import { showError, showSuccess } from '../../../utils/toast';

type RandomizationField = Exclude<keyof RandomizationPolicy, 'enabled'>;

const CHILD_SETTINGS: Array<{
  field: RandomizationField;
  label: string;
  description: string;
}> = [
  {
    field: 'shuffleQuestions',
    label: 'Đảo thứ tự câu hỏi',
    description: 'Đổi thứ tự câu trong bài thường; khi tắt, giữ đúng thứ tự đề đã lưu.',
  },
  {
    field: 'shuffleChoices',
    label: 'Đảo đáp án A/B/C/D',
    description: 'Đảo vị trí lựa chọn nhưng vẫn chấm theo ID đáp án gốc.',
  },
  {
    field: 'shuffleMatching',
    label: 'Đảo cột Matching',
    description: 'Đảo thứ tự cột B của dạng nối cặp.',
  },
  {
    field: 'shuffleOrdering',
    label: 'Đảo câu Ordering',
    description: 'Đảo vị trí hiển thị ban đầu của các mục cần sắp xếp.',
  },
  {
    field: 'shuffleDragDrop',
    label: 'Đảo pool Drag & Drop',
    description: 'Đảo ngân hàng từ/lựa chọn của câu kéo-thả điền khuyết.',
  },
  {
    field: 'randomizePracticeSelection',
    label: 'Chọn ngẫu nhiên câu Practice',
    description: 'Chọn ngẫu nhiên tập câu theo chủ đề; khi tắt, lấy theo thứ tự lưu.',
  },
];

const Toggle = ({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-label={label}
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
      checked
        ? 'border-sky-600 bg-sky-600'
        : 'border-slate-300 bg-slate-200'
    } ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
  >
    <span
      aria-hidden="true"
      className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
    />
  </button>
);

export function RandomizationSettingsPanel() {
  const [draft, setDraft] = useState<RandomizationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const settings = await getSystemSettings();
      setDraft(settings.randomization);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Không thể tải cấu hình random.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const saved = await saveRandomizationSettings(draft);
      setDraft(saved);
      showSuccess('Đã lưu cấu hình random.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Không thể lưu cấu hình random.';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !draft) {
    return (
      <section aria-label="Cấu hình random" className="rounded-2xl border border-slate-200 bg-white p-5">
        <div role="status" className="flex min-h-32 items-center justify-center gap-3 text-sm text-slate-500">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          Đang tải cấu hình random...
        </div>
      </section>
    );
  }

  if (!draft) {
    return (
      <section aria-label="Cấu hình random" className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p role="alert" className="text-sm font-semibold text-red-800">{error || 'Không thể tải cấu hình random.'}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Thử lại
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="randomization-settings-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-700">
            <Shuffle aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h3 id="randomization-settings-title" className="text-lg font-bold text-slate-900">Quản lý Random bài kiểm tra</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Công tắc tổng có quyền ưu tiên cao nhất. Khi tắt tổng, mọi random trong quiz được vô hiệu hóa nhưng lựa chọn con vẫn được ghi nhớ để dùng lại khi bật tổng.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">Random toàn bộ bài kiểm tra</p>
            <p className="text-xs text-slate-500">{draft.enabled ? 'Đang bật' : 'Đang tắt toàn bộ'}</p>
          </div>
          <Toggle
            label="Random toàn bộ bài kiểm tra"
            checked={draft.enabled}
            disabled={saving}
            onChange={() => setDraft((current) => current ? { ...current, enabled: !current.enabled } : current)}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {CHILD_SETTINGS.map((setting) => (
          <div
            key={setting.field}
            className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
              draft.enabled ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">{setting.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{setting.description}</p>
            </div>
            <Toggle
              label={setting.label}
              checked={draft[setting.field]}
              disabled={!draft.enabled || saving}
              onChange={() => setDraft((current) => current ? {
                ...current,
                [setting.field]: !current[setting.field],
              } : current)}
            />
          </div>
        ))}
      </div>

      {error ? <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Tải lại
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        >
          {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
          Lưu cấu hình random
        </button>
      </div>
    </section>
  );
}
