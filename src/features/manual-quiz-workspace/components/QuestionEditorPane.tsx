import React, { useCallback, useState } from 'react';
import { Braces, Copy, Trash2 } from 'lucide-react';
import { QuestionType } from '../../../types';
import QuestionEditorForm from '../../quiz-editor/components/QuestionEditorModal/QuestionEditorForm';
import type { AnyEditorDraft } from '../../quiz-editor/types/quiz-editor.types';
import { draftToQuestion, questionToDraft } from '../../quiz-editor/utils/questionDraftMapper';
import { normalizeQuestionMath } from '../../../utils/questionMath';
import { createManualQuestionDraft } from '../../../components/TeacherDashboard/quiz-preview/questionTypes';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import MathComposerPanel from '../math-composer/MathComposerPanel';
import { MathComposerProvider } from '../math-composer/useMathComposer';
import { useMathFieldValidation } from '../math-composer/useMathFieldValidation';
import { useWorkspaceKeyboardShortcuts } from '../hooks/useWorkspaceKeyboardShortcuts';

const InlineQuestionEditor: React.FC<{ question: ManualQuizQuestion }> = ({ question }) => {
    const [draft, setDraft] = useState<AnyEditorDraft>(() => questionToDraft(question));
    const updateQuestion = useManualQuizWorkspaceStore((state) => state.updateQuestion);
    const selectQuestion = useManualQuizWorkspaceStore((state) => state.selectQuestion);
    const moveQuestion = useManualQuizWorkspaceStore((state) => state.moveQuestion);
    const questions = useManualQuizWorkspaceStore((state) => state.envelope?.quiz.questions ?? []);
    const mathValidation = useMathFieldValidation(draft);

    const saveQuestion = useCallback(() => {
        const rawQuestion = draftToQuestion(draft, question);
        const normalizedQuestion = normalizeQuestionMath(rawQuestion);
        updateQuestion(question.id, (current) => ({
            ...current,
            ...normalizedQuestion,
            points: current.points,
            explanation: current.explanation,
            imageAlt: normalizedQuestion.imageAlt ?? current.imageAlt,
            showExplanation: current.showExplanation,
        }) as ManualQuizQuestion);
    }, [draft, question, updateQuestion]);

    const saveQuestionAndNext = useCallback(() => {
        saveQuestion();
        const index = questions.findIndex((item) => item.id === question.id);
        const next = questions[index + 1];
        if (!next) return;
        selectQuestion(next.id);
        window.setTimeout(() => {
            document.querySelector<HTMLElement>('[aria-label="Trình soạn câu hỏi"] textarea')?.focus();
        }, 0);
    }, [question.id, questions, saveQuestion, selectQuestion]);

    useWorkspaceKeyboardShortcuts({
        onSaveQuestionAndNext: saveQuestionAndNext,
        onMoveQuestion: (offset) => moveQuestion(question.id, offset),
    });

    return (
        <div className="space-y-3">
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
            onDraftChange={(updater) => setDraft((current) => updater(current))}
            onSave={saveQuestion}
                mode="inline"
            />
        </div>
    );
};

const QuestionEditorPane: React.FC = () => {
    const [showMathComposer, setShowMathComposer] = useState(false);
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const addQuestion = useManualQuizWorkspaceStore((state) => state.addQuestion);
    const updateQuestion = useManualQuizWorkspaceStore((state) => state.updateQuestion);
    const duplicateQuestion = useManualQuizWorkspaceStore((state) => state.duplicateQuestion);
    const removeQuestion = useManualQuizWorkspaceStore((state) => state.removeQuestion);
    const selected = envelope?.quiz.questions.find((question) => question.id === envelope.selectedQuestionId) ?? null;

    if (!selected) {
        return (
            <main aria-label="Trình soạn câu hỏi" className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-white p-6 lg:p-8">
                <div className="mx-auto flex min-h-[520px] max-w-2xl flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-[#FFFDF7] p-8 text-center">
                    <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-sky-50 text-sky-600">1</div>
                    <h2 className="text-xl font-semibold">Bắt đầu với câu hỏi đầu tiên</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                        Chọn loại câu hỏi từ danh sách bên trái. Bạn có thể sửa nội dung và xem trước ngay trên cùng màn hình.
                    </p>
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
                </div>
            </main>
        );
    }

    return (
        <main aria-label="Trình soạn câu hỏi" className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-white p-5 lg:p-8">
            <MathComposerProvider>
                <div className="mx-auto max-w-4xl space-y-4 pb-24">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                        <span>Điểm câu hỏi</span>
                        <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={selected.points ?? 0}
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
                            aria-expanded={showMathComposer}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-sm font-medium text-sky-700"
                        >
                            <Braces className="h-4 w-4" /> Công thức toán
                        </button>
                        <button
                            type="button"
                            onClick={() => duplicateQuestion(selected.id)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                        >
                            <Copy className="h-4 w-4" /> Nhân bản
                        </button>
                        <button
                            type="button"
                            onClick={() => removeQuestion(selected.id)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm text-rose-700"
                        >
                            <Trash2 className="h-4 w-4" /> Xóa
                        </button>
                    </div>
                </div>

                <MathComposerPanel
                    ownerUsername={envelope?.ownerUsername ?? ''}
                    open={showMathComposer}
                    onClose={() => setShowMathComposer(false)}
                />
                <InlineQuestionEditor key={selected.id} question={selected} />
                </div>
            </MathComposerProvider>
        </main>
    );
};

export default QuestionEditorPane;
