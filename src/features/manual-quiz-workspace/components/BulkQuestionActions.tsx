import React, { useMemo, useState } from 'react';
import { Bot, RotateCcw, Sparkles, X } from 'lucide-react';
import type { Question, Quiz } from '../../../types';
import { QuestionType } from '../../../types';
import { testBankService } from '../../../services/testBankService';
import { explainAnswer } from '../../../services/aiTutorService';
import { useSmartDistractors } from '../../quiz-editor/hooks/useSmartDistractors';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';

interface BulkQuestionActionsProps {
    selectedIds: Set<string>;
    teacherId: string;
    onClear: () => void;
}

type BulkAction = 'difficulty' | 'points' | 'delete' | 'save-bank';

interface HistorySnapshot {
    questions: ManualQuizQuestion[];
    selectedQuestionId: string | null;
}

const cloneQuestions = (questions: ManualQuizQuestion[]): ManualQuizQuestion[] => (
    typeof globalThis.structuredClone === 'function'
        ? globalThis.structuredClone(questions)
        : JSON.parse(JSON.stringify(questions)) as ManualQuizQuestion[]
);

const supportsAiDistractors = (question?: ManualQuizQuestion): boolean => Boolean(question && [
    QuestionType.MCQ,
    QuestionType.MULTIPLE_SELECT,
    QuestionType.IMAGE_QUESTION,
].includes(question.type));

const getCorrectAnswerText = (question: ManualQuizQuestion): string => {
    const loose = question as ManualQuizQuestion & {
        options?: string[];
        correctAnswer?: string;
        correctAnswers?: string[];
    };
    const letters = Array.isArray(loose.correctAnswers)
        ? loose.correctAnswers
        : loose.correctAnswer ? [loose.correctAnswer] : [];
    if (loose.options?.length) {
        return letters.map((letter) => loose.options?.[letter.charCodeAt(0) - 65] || letter).join(', ');
    }
    return letters.join(', ');
};

const BulkQuestionActions: React.FC<BulkQuestionActionsProps> = ({ selectedIds, teacherId, onClear }) => {
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const replaceQuestions = useManualQuizWorkspaceStore((state) => state.replaceQuestions);
    const bulkUpdateQuestions = useManualQuizWorkspaceStore((state) => state.bulkUpdateQuestions);
    const removeQuestions = useManualQuizWorkspaceStore((state) => state.removeQuestions);
    const [action, setAction] = useState<BulkAction>('difficulty');
    const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
    const [points, setPoints] = useState(1);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [history, setHistory] = useState<HistorySnapshot[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [pendingExplanation, setPendingExplanation] = useState<{ questionId: string; text: string } | null>(null);
    const [aiExplanationLoading, setAiExplanationLoading] = useState(false);
    const selectedQuestions = useMemo(() => envelope?.quiz.questions.filter((question) => selectedIds.has(question.id)) ?? [], [envelope, selectedIds]);
    const singleQuestion = selectedQuestions.length === 1 ? selectedQuestions[0] : undefined;

    const pushSnapshot = () => {
        if (!envelope) return;
        setHistory((current) => [
            ...current.slice(-4),
            {
                questions: cloneQuestions(envelope.quiz.questions),
                selectedQuestionId: envelope.selectedQuestionId,
            },
        ]);
    };

    const smartDistractors = useSmartDistractors({
        quiz: envelope?.quiz as Quiz | null,
        requireConfirmation: true,
        onUpdateQuestions: (questions: Question[]) => replaceQuestions(questions as ManualQuizQuestion[]),
    });

    if (!envelope || selectedQuestions.length === 0) return null;

    const applyPreviewedAction = async () => {
        const ids = Array.from(selectedIds);
        setMessage(null);
        if (action === 'save-bank') {
            await Promise.all(selectedQuestions.map((question) => {
                const tags = Array.isArray(question.tags)
                    ? question.tags
                    : typeof question.tags === 'string' ? question.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
                return testBankService.saveQuestion(teacherId, question, tags);
            }));
            setMessage(`Đã lưu ${selectedQuestions.length} câu vào kho.`);
            setPreviewOpen(false);
            return;
        }
        pushSnapshot();
        if (action === 'difficulty') bulkUpdateQuestions(ids, { difficulty });
        if (action === 'points') bulkUpdateQuestions(ids, { points: Number.isFinite(points) && points > 0 ? points : 1 });
        if (action === 'delete') {
            removeQuestions(ids);
            onClear();
        }
        setPreviewOpen(false);
    };

    const undo = () => {
        const snapshot = history[history.length - 1];
        if (!snapshot) return;
        replaceQuestions(snapshot.questions, snapshot.selectedQuestionId);
        setHistory((current) => current.slice(0, -1));
        setMessage('Đã hoàn tác thao tác hàng loạt.');
    };

    const generateExplanation = async () => {
        if (!singleQuestion) return;
        setAiExplanationLoading(true);
        setMessage(null);
        try {
            const result = await explainAnswer(singleQuestion, 'Chưa có câu trả lời', getCorrectAnswerText(singleQuestion));
            if (result.error || !result.explanation.trim()) throw new Error(result.error || 'AI chưa tạo được lời giải.');
            setPendingExplanation({ questionId: singleQuestion.id, text: result.explanation.trim() });
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Không thể tạo lời giải.');
        } finally {
            setAiExplanationLoading(false);
        }
    };

    const acceptExplanation = () => {
        if (!pendingExplanation) return;
        pushSnapshot();
        bulkUpdateQuestions([pendingExplanation.questionId], { explanation: pendingExplanation.text });
        setPendingExplanation(null);
    };

    const acceptDistractors = () => {
        pushSnapshot();
        smartDistractors.acceptPendingDistractors();
    };

    return (
        <section aria-label="Bảng thao tác hàng loạt" className="border-t border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
                <strong className="text-sm text-slate-800">Đã chọn {selectedQuestions.length} câu</strong>
                <button type="button" aria-label="Bỏ chọn tất cả" onClick={onClear} className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
                <select aria-label="Thao tác hàng loạt" value={action} onChange={(event) => setAction(event.target.value as BulkAction)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    <option value="difficulty">Đổi độ khó</option>
                    <option value="points">Đổi điểm</option>
                    <option value="delete">Xóa câu đã chọn</option>
                    <option value="save-bank">Lưu vào kho cá nhân</option>
                </select>
                {action === 'difficulty' && <select aria-label="Độ khó mới" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value) as 1 | 2 | 3)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="1">Dễ</option><option value="2">Trung bình</option><option value="3">Khó</option></select>}
                {action === 'points' && <input aria-label="Điểm mới" type="number" min="0.01" step="0.01" value={points} onChange={(event) => setPoints(Number(event.target.value))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" />}
                <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Xem trước thay đổi" className="min-h-10 w-full rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white">Xem trước thay đổi</button>
            </div>

            {singleQuestion && (
                <div className="mt-3 grid gap-2">
                    <button type="button" disabled={!supportsAiDistractors(singleQuestion) || smartDistractors.generatingDistractorId !== null} onClick={() => void smartDistractors.generateDistractors(singleQuestion.id, 3)} aria-label="AI tạo đáp án nhiễu" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-800 disabled:opacity-50"><Sparkles className="h-4 w-4" /> AI tạo đáp án nhiễu</button>
                    <button type="button" disabled={aiExplanationLoading} onClick={() => void generateExplanation()} aria-label="AI tạo lời giải" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-800 disabled:opacity-50"><Bot className="h-4 w-4" /> AI tạo lời giải</button>
                </div>
            )}

            {history.length > 0 && <button type="button" onClick={undo} aria-label="Hoàn tác thao tác hàng loạt" className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800"><RotateCcw className="h-4 w-4" /> Hoàn tác</button>}
            {message && <p role="status" className="mt-2 text-xs text-slate-600">{message}</p>}

            {previewOpen && (
                <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
                    <section role="dialog" aria-modal="true" aria-label="Xác nhận thay đổi hàng loạt" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-900">Xác nhận thay đổi hàng loạt</h3>
                        <p className="mt-2 text-sm text-slate-600">Thao tác sẽ áp dụng cho {selectedQuestions.length} câu. Bạn có thể hoàn tác sau khi áp dụng.</p>
                        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setPreviewOpen(false)} className="min-h-10 rounded-lg px-4 text-sm">Hủy</button><button type="button" onClick={() => void applyPreviewedAction()} aria-label="Áp dụng thay đổi" className="min-h-10 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white">Áp dụng thay đổi</button></div>
                    </section>
                </div>
            )}

            {smartDistractors.pendingDistractorProposal && (
                <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
                    <section role="dialog" aria-modal="true" aria-label="Duyệt đề xuất AI" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-900">Duyệt đáp án nhiễu AI</h3>
                        <p className="mt-3 text-sm text-slate-600">Đề xuất: {smartDistractors.pendingDistractorProposal.proposedOptions.join(' · ')}</p>
                        <div className="mt-5 flex justify-end gap-2"><button type="button" aria-label="Từ chối đề xuất AI" onClick={smartDistractors.rejectPendingDistractors} className="min-h-10 rounded-lg px-4 text-sm">Từ chối</button><button type="button" aria-label="Chấp nhận đề xuất AI" onClick={acceptDistractors} className="min-h-10 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white">Chấp nhận</button></div>
                    </section>
                </div>
            )}

            {pendingExplanation && (
                <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
                    <section role="dialog" aria-modal="true" aria-label="Duyệt lời giải AI" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-900">Duyệt lời giải AI</h3>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{pendingExplanation.text}</p>
                        <div className="mt-5 flex justify-end gap-2"><button type="button" aria-label="Từ chối lời giải AI" onClick={() => setPendingExplanation(null)} className="min-h-10 rounded-lg px-4 text-sm">Từ chối</button><button type="button" aria-label="Chấp nhận lời giải AI" onClick={acceptExplanation} className="min-h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white">Chấp nhận</button></div>
                    </section>
                </div>
            )}
        </section>
    );
};

export default BulkQuestionActions;
