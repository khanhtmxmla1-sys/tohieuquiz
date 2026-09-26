import { Bot, Check, KeyRound, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { QuizAiSource } from '../../../../shared/teacher-ai-credentials.contract';
import AiCredentialSettings from '../../../features/quiz-generator/components/AiCredentialSettings';
import type { AiCredentialsController } from '../../../features/quiz-generator/hooks/useAiCredentials';
import { useDialogFocus } from '../../../hooks/useDialogFocus';

interface AiAccountSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  controller: AiCredentialsController;
}

const SOURCE_OPTIONS: Array<{
  source: QuizAiSource;
  label: string;
  description: string;
}> = [
  {
    source: 'system',
    label: 'AI TôHiệuQuiz',
    description: 'Dùng nguồn AI do hệ thống quản lý.',
  },
  {
    source: 'gemini-personal',
    label: 'Gemini cá nhân',
    description: 'Dùng API key Gemini đã lưu của bạn.',
  },
  {
    source: 'deepseek-personal',
    label: 'DeepSeek cá nhân',
    description: 'Dùng API key DeepSeek đã lưu của bạn.',
  },
];

const sourceAvailable = (
  source: QuizAiSource,
  controller: AiCredentialsController,
): boolean => {
  if (source === 'system') return true;
  if (!controller.enabled) return false;
  return source === 'gemini-personal'
    ? controller.summaries.gemini.configured
    : controller.summaries.deepseek.configured;
};

const AiAccountSettingsDialog = ({
  open,
  onClose,
  controller,
}: AiAccountSettingsDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceStatus, setPreferenceStatus] = useState('');

  useDialogFocus({
    isOpen: open,
    dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  if (!open) return null;

  const defaultUnavailable = !sourceAvailable(controller.defaultSource, controller);

  const selectDefaultSource = async (source: QuizAiSource) => {
    if (source === controller.defaultSource || !sourceAvailable(source, controller)) return;
    setSavingPreference(true);
    setPreferenceStatus('');
    try {
      await controller.setDefaultSource(source);
      setPreferenceStatus('Đã cập nhật nguồn AI mặc định.');
    } catch {
      // The shared controller exposes a safe, user-facing error message.
    } finally {
      setSavingPreference(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-account-settings-title"
        tabIndex={-1}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-slate-50 shadow-2xl sm:max-w-3xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <Bot aria-hidden="true" className="size-6" />
            </span>
            <div>
              <h2 id="ai-account-settings-title" className="text-lg font-bold text-slate-950">
                Cài đặt AI
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Quản lý API key và nguồn mặc định cho tài khoản giáo viên này.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Đóng cài đặt AI"
            onClick={onClose}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <section aria-labelledby="default-ai-source-title" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <Check aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 id="default-ai-source-title" className="font-semibold text-slate-900">Nguồn AI mặc định</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Tự động chọn nguồn này khi bạn mở trang tạo đề bằng AI. Bạn vẫn có thể đổi cho từng đề.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {SOURCE_OPTIONS.map((option) => {
                const selected = controller.defaultSource === option.source;
                const available = sourceAvailable(option.source, controller);
                return (
                  <button
                    key={option.source}
                    type="button"
                    aria-label={`Dùng ${option.label} làm nguồn mặc định`}
                    aria-pressed={selected}
                    disabled={savingPreference || controller.loading || !available}
                    onClick={() => void selectDefaultSource(option.source)}
                    className={`rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-950'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                  </button>
                );
              })}
            </div>

            {defaultUnavailable && (
              <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Nguồn mặc định hiện chưa có API key. Hãy lưu key tương ứng hoặc chọn một nguồn khác.
              </p>
            )}
            {preferenceStatus && <p aria-live="polite" className="mt-3 text-sm text-emerald-700">{preferenceStatus}</p>}
          </section>

          <section aria-labelledby="personal-ai-keys-title">
            <div className="flex items-start gap-3 px-1">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                <KeyRound aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 id="personal-ai-keys-title" className="font-semibold text-slate-900">API key cá nhân</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Key được mã hóa trên server. Hệ thống không gửi lại giá trị key sau khi lưu.
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <AiCredentialSettings provider="gemini" controller={controller} />
              <AiCredentialSettings provider="deepseek" controller={controller} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AiAccountSettingsDialog;
