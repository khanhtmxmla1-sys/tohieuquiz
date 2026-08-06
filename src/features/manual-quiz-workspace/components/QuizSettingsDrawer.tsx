import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock3, X } from 'lucide-react';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';
import { parseManualQuizTimeLimit } from '../domain/manualQuizTimeLimit';

interface QuizSettingsDrawerProps {
    open: boolean;
    timeLimit: number;
    readOnly?: boolean;
    onClose(): void;
    onApply(timeLimit: number): void;
}

const TIME_PRESETS = [15, 30, 45, 60, 90] as const;

const QuizSettingsDrawer: React.FC<QuizSettingsDrawerProps> = ({
    open,
    timeLimit,
    readOnly = false,
    onClose,
    onApply,
}) => {
    const drawerRef = useRef<HTMLElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const [draftValue, setDraftValue] = useState(String(timeLimit));
    const [submitted, setSubmitted] = useState(false);
    const parsed = useMemo(() => parseManualQuizTimeLimit(draftValue), [draftValue]);
    const validationMessage = 'message' in parsed ? parsed.message : null;

    useEffect(() => {
        if (!open) return;
        setDraftValue(String(timeLimit));
        setSubmitted(false);
    }, [open, timeLimit]);

    useDialogFocusTrap({
        open,
        containerRef: drawerRef,
        initialFocusRef: readOnly ? closeButtonRef : inputRef,
        onEscape: onClose,
    });

    if (!open) return null;

    const applySettings = () => {
        setSubmitted(true);
        if (!parsed.valid) return;
        onApply(parsed.value);
    };

    return (
        <div
            className="fixed inset-0 z-[85] bg-slate-900/40 backdrop-blur-[1px]"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <aside
                ref={drawerRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="quiz-settings-title"
                className="ml-auto flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
            >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div>
                        <h2 id="quiz-settings-title" className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                            <Clock3 className="h-5 w-5 text-sky-600" /> Thiết lập đề
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            Cài đặt thời gian làm toàn bộ bài kiểm tra.
                        </p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng thiết lập đề"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    <section aria-labelledby="quiz-time-heading">
                        <h3 id="quiz-time-heading" className="text-sm font-semibold text-slate-900">
                            Thời gian làm bài
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            Thời gian được tính theo phút và áp dụng cho toàn bộ đề.
                        </p>

                        {!readOnly && (
                            <div className="mt-4 grid grid-cols-5 gap-2" aria-label="Thời gian gợi ý">
                                {TIME_PRESETS.map((minutes) => (
                                    <button
                                        key={minutes}
                                        type="button"
                                        onClick={() => {
                                            setDraftValue(String(minutes));
                                            setSubmitted(false);
                                        }}
                                        aria-label={`Chọn ${minutes} phút`}
                                        aria-pressed={Number(draftValue) === minutes}
                                        className="min-h-11 rounded-[10px] border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 aria-pressed:border-sky-500 aria-pressed:bg-sky-50 aria-pressed:text-sky-700"
                                    >
                                        {minutes}
                                    </button>
                                ))}
                            </div>
                        )}

                        <label htmlFor="manual-quiz-time-limit" className="mt-5 block text-sm font-semibold text-slate-800">
                            Thời gian làm bài (phút)
                        </label>
                        <div className="relative mt-2">
                            <Clock3 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <input
                                ref={inputRef}
                                id="manual-quiz-time-limit"
                                type="number"
                                min={1}
                                step={1}
                                value={draftValue}
                                disabled={readOnly}
                                aria-invalid={submitted && !parsed.valid ? 'true' : undefined}
                                aria-describedby="manual-quiz-time-help"
                                onChange={(event) => {
                                    setDraftValue(event.target.value);
                                    setSubmitted(false);
                                }}
                                className="h-12 w-full rounded-[10px] border border-slate-200 bg-white pl-10 pr-4 text-base font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                            />
                        </div>
                        <p id="manual-quiz-time-help" className="mt-2 text-xs leading-5 text-slate-500">
                            Nhập số phút nguyên từ 1 trở lên.
                        </p>

                        {submitted && validationMessage && (
                            <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                                {validationMessage}
                            </p>
                        )}

                        {parsed.valid && parsed.isLong && (
                            <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                Thời gian này dài hơn mức thường dùng 180 phút. Bạn vẫn có thể áp dụng.
                            </p>
                        )}

                        {readOnly && (
                            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                Đề đang ở chế độ chỉ đọc.
                            </p>
                        )}
                    </section>
                </div>

                <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={readOnly ? 'Đóng' : 'Hủy thay đổi'}
                        className="min-h-11 rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                        {readOnly ? 'Đóng' : 'Hủy'}
                    </button>
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={applySettings}
                            aria-label="Áp dụng thiết lập"
                            className="min-h-11 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700"
                        >
                            Áp dụng
                        </button>
                    )}
                </footer>
            </aside>
        </div>
    );
};

export default QuizSettingsDrawer;
