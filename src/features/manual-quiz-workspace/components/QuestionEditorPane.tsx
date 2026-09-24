import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Braces, Check, Copy, Eye, Trash2 } from 'lucide-react';
import { QuestionType } from '../../../types';
import QuestionEditorForm from '../../quiz-editor/components/QuestionEditorModal/QuestionEditorForm';
import { createManualQuestionDraft } from '../../../components/TeacherDashboard/quiz-preview/questionTypes';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type {
    ManualQuizDraftEnvelope,
    ManualQuizQuestion,
} from '../types/manualQuizWorkspace.types';
import MathComposerPanel from '../math-composer/MathComposerPanel';
import { MathComposerProvider } from '../math-composer/useMathComposer';
import { useMathFieldValidation } from '../math-composer/useMathFieldValidation';
import { useWorkspaceKeyboardShortcuts } from '../hooks/useWorkspaceKeyboardShortcuts';
import {
    useQuestionEditSession,
    type QuestionEditSessionFlushResult,
} from '../hooks/useQuestionEditSession';

export interface QuestionEditorPaneProps {
    readOnly?: boolean;
    persistLocalNow?: (envelope: ManualQuizDraftEnvelope) => void;
    editorResetToken?: number;
    onEditorReady?: () => void;
    onBeforeAction?: () => boolean;
    currentQuestionIndex?: number;
    totalQuestions?: number;
    onBack?(): void;
    onPrevious?(): void;
    onNext?(): void;
    onPreview?(question: ManualQuizQuestion): void;
    onDone?(): void;
    keyboardShortcutsEnabled?: boolean;
}

export interface QuestionEditorPaneHandle {
    flush: () => QuestionEditSessionFlushResult;
    getPreviewQuestion: () => ManualQuizQuestion | null;
}

interface InlineQuestionEditorHandle {
    flush: () => QuestionEditSessionFlushResult;
    previewQuestion: ManualQuizQuestion;
}

interface InlineQuestionEditorProps {
    question: ManualQuizQuestion;
    readOnly: boolean;
    persistLocalNow?: (envelope: ManualQuizDraftEnvelope) => void;
    editorResetToken?: number;
    onEditorReady?: () => void;
    onBeforeAction?: () => boolean;
    onNext?(): void;
    keyboardShortcutsEnabled?: boolean;
}

const InlineQuestionEditor = React.forwardRef<InlineQuestionEditorHandle, InlineQuestionEditorProps>(
    ({ question, readOnly, persistLocalNow, editorResetToken, onEditorReady, onBeforeAction, onNext, keyboardShortcutsEnabled = true }, ref) => {
    const {
        draft,
        error,
        flush,
        onDraftChange,
        previewQuestion,
    } = useQuestionEditSession(question, readOnly, { persistLocalNow, resetToken: editorResetToken });
    const updateQuestion = useManualQuizWorkspaceStore((state) => state.updateQuestion);
    const selectQuestion = useManualQuizWorkspaceStore((state) => state.selectQuestion);
    const moveQuestion = useManualQuizWorkspaceStore((state) => state.moveQuestion);
    const questions = useManualQuizWorkspaceStore((state) => state.envelope?.quiz.questions ?? []);
    const mathValidation = useMathFieldValidation(draft);

    const saveQuestion = useCallback(() => flush(), [flush]);

    const saveQuestionAndNext = useCallback(() => {
        if (onNext) {
            onNext();
            return;
        }
        if (!saveQuestion().ok) return;
        const index = questions.findIndex((item) => item.id === question.id);
        const next = questions[index + 1];
        if (!next) return;
        selectQuestion(next.id);
    }, [onNext, question.id, questions, saveQuestion, selectQuestion]);

    useWorkspaceKeyboardShortcuts({
        enabled: keyboardShortcutsEnabled,
        onSaveQuestionAndNext: saveQuestionAndNext,
        onMoveQuestion: readOnly ? undefined : (offset) => {
            if (onBeforeAction && !onBeforeAction()) return;
            moveQuestion(question.id, offset);
        },
    });

    useImperativeHandle(ref, () => ({
        flush,
        previewQuestion,
    }), [flush, previewQuestion]);

    return (
        <div className="space-y-3">
            {error && (
                <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={saveQuestion}
                        className="min-h-10 rounded-lg border border-rose-300 bg-white px-3 font-semibold text-rose-700 hover:bg-rose-100"
                    >
                        Thử lại
                    </button>
                </div>
            )}
            {mathValidation.status === 'checking' && (
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                    Đang kiểm tra công thức toán…
                </div>
            )}
            {mathValidation.status === 'invalid' && mathValidation.issues.length > 0 && (
                <div
                    role="status"
                    aria-label="Cảnh báo công thức toán"
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                    <p className="font-semibold">{mathValidation.issues[0].message}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                        {mathValidation.issues[0].suggestion}
                        {' '}Vị trí gần ký tự {mathValidation.issues[0].position}.
                        {mathValidation.issues[0].field ? ` Trường: ${mathValidation.issues[0].field}.` : ''}
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                        Có thể lưu bản nháp; lỗi này chỉ ngăn xuất bản khi chưa sửa.
                    </p>
                </div>
            )}
            <QuestionEditorForm
            editingQuestion={question}
            draft={draft}
            onDraftChange={onDraftChange}
            onSave={saveQuestion}
            onEditorReady={onEditorReady}
            mode="inline"
            />
        </div>
    );
});

InlineQuestionEditor.displayName = 'InlineQuestionEditor';

const QuestionEditorPane = React.forwardRef<QuestionEditorPaneHandle, QuestionEditorPaneProps>(
    ({
        readOnly = false,
        persistLocalNow,
        editorResetToken,
        onEditorReady,
        onBeforeAction,
        currentQuestionIndex = 0,
        totalQuestions = 0,
        onBack,
        onPrevious,
        onNext,
        onPreview,
        onDone,
        keyboardShortcutsEnabled = true,
    }, ref) => {
    const [showMathComposer, setShowMathComposer] = useState(false);
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const addQuestion = useManualQuizWorkspaceStore((state) => state.addQuestion);
    const updateQuestion = useManualQuizWorkspaceStore((state) => state.updateQuestion);
    const duplicateQuestion = useManualQuizWorkspaceStore((state) => state.duplicateQuestion);
    const removeQuestion = useManualQuizWorkspaceStore((state) => state.removeQuestion);
    const selected = envelope?.quiz.questions.find((question) => question.id === envelope.selectedQuestionId) ?? null;
    const inlineEditorRef = useRef<InlineQuestionEditorHandle>(null);

    useImperativeHandle(ref, () => ({
        flush: () => selected
            ? inlineEditorRef.current?.flush() ?? {
                ok: false,
                error: 'Không thể truy cập phiên chỉnh sửa câu hỏi.',
            }
            : { ok: true },
        getPreviewQuestion: () => inlineEditorRef.current?.previewQuestion ?? selected,
    }), [selected]);

    if (!selected) {
        return (
            <main aria-label="Trình soạn câu hỏi" className="h-full min-h-0 min-w-0 w-full flex-1 overflow-y-auto overscroll-contain bg-white p-6 lg:p-8">
                <div className="mx-auto flex min-h-[520px] max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-[#FFFDF7] p-8 text-center">
                    <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-sky-50 text-sky-600">1</div>
                    <h2 className="text-xl font-semibold">Bắt đầu với câu hỏi đầu tiên</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                        Chọn loại câu hỏi từ danh sách bên trái. Bạn có thể sửa nội dung và xem trước ngay trên cùng màn hình.
                    </p>
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={() => addQuestion({
                                ...(createManualQuestionDraft(QuestionType.MCQ) as ManualQuizQuestion),
                                points: 1,
                            })}
                            className="mt-6 h-11 rounded-[10px] bg-sky-500 px-5 text-sm font-semibold text-white hover:bg-sky-600"
                        >
                            Thêm câu trắc nghiệm
                        </button>
                    )}
                </div>
            </main>
        );
    }

    return (
        <main
            aria-label="Trình soạn câu hỏi"
            aria-readonly={readOnly || undefined}
            data-read-only={readOnly || undefined}
            className="h-full min-h-0 min-w-0 w-full flex-1 overflow-y-auto overscroll-contain bg-white p-5 lg:p-8"
        >
            <MathComposerProvider>
                <div className="mx-auto w-full max-w-[1120px] space-y-4 pb-24">
                {readOnly && (
                    <div
                        role="note"
                        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
                    >
                        Đề đang ở chế độ chỉ đọc. Nội dung gốc được bảo vệ; hãy dùng nút “Tạo phiên bản mới để chỉnh sửa” nếu cần thay đổi.
                    </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                        <span>Điểm câu hỏi</span>
                        <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={selected.points ?? 0}
                            disabled={readOnly}
                            onChange={(event) => updateQuestion(selected.id, (question) => ({
                                ...question,
                                points: Number(event.target.value),
                            }))}
                            className="w-16 bg-transparent text-right font-semibold outline-none"
                            aria-label="Điểm câu hỏi"
                        />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowMathComposer((current) => !current)}
                            disabled={readOnly}
                            aria-expanded={showMathComposer}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-700"
                        >
                            <Braces className="h-4 w-4" /> Công thức toán
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (onBeforeAction && !onBeforeAction()) return;
                                duplicateQuestion(selected.id);
                            }}
                            disabled={readOnly}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                        >
                            <Copy className="h-4 w-4" /> Nhân bản
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (onBeforeAction && !onBeforeAction()) return;
                                removeQuestion(selected.id);
                            }}
                            disabled={readOnly}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm text-rose-700"
                        >
                            <Trash2 className="h-4 w-4" /> Xóa
                        </button>
                    </div>
                </div>

                <div
                    inert={readOnly || undefined}
                    className={readOnly ? 'pointer-events-none select-none opacity-70' : undefined}
                >
                    <MathComposerPanel
                        ownerUsername={envelope?.ownerUsername ?? ''}
                        open={showMathComposer}
                        onClose={() => setShowMathComposer(false)}
                    />
                    <InlineQuestionEditor
                        key={selected.id}
                        ref={inlineEditorRef}
                        question={selected}
                        readOnly={readOnly}
                        persistLocalNow={persistLocalNow}
                        editorResetToken={editorResetToken}
                        onEditorReady={onEditorReady}
                        onBeforeAction={onBeforeAction}
                        onNext={onNext}
                        keyboardShortcutsEnabled={keyboardShortcutsEnabled}
                    />
                </div>
                <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-white/85">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                    >
                        <ArrowLeft className="h-4 w-4" /> Về danh sách
                    </button>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onPrevious}
                            disabled={!onPrevious || currentQuestionIndex <= 0}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ArrowLeft className="h-4 w-4" /> Câu trước
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const latestQuestion = inlineEditorRef.current?.previewQuestion ?? selected;
                                if (latestQuestion) onPreview?.(latestQuestion);
                            }}
                            disabled={!onPreview}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-sky-200 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <Eye className="h-4 w-4" /> Xem trước
                        </button>
                        {currentQuestionIndex < totalQuestions - 1 ? (
                            <button
                                type="button"
                                onClick={onNext}
                                disabled={!onNext}
                                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                Lưu và câu sau <ArrowRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={onDone}
                                disabled={!onDone}
                                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                <Check className="h-4 w-4" /> Xong
                            </button>
                        )}
                    </div>
                </div>
                </div>
            </MathComposerProvider>
        </main>
    );
});

QuestionEditorPane.displayName = 'QuestionEditorPane';

export default QuestionEditorPane;
