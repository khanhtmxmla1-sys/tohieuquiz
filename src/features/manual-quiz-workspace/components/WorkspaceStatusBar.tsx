import React from 'react';
import { AlertCircle } from 'lucide-react';
import { selectManualQuizTotalPoints } from '../store/manualQuizWorkspaceSelectors';
import { summarizeManualQuizIssues, validateManualQuiz } from '../validation/manualQuizValidation';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';

interface WorkspaceStatusBarProps {
    onOpenValidation(): void;
}

const WorkspaceStatusBar: React.FC<WorkspaceStatusBarProps> = ({ onOpenValidation }) => {
    const questionCount = useManualQuizWorkspaceStore(
        (state) => state.envelope?.quiz.questions.length ?? 0,
    );
    const totalPoints = useManualQuizWorkspaceStore(selectManualQuizTotalPoints);
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const targetPoints = envelope?.targetPoints ?? 10;
    const summary = envelope
        ? summarizeManualQuizIssues(validateManualQuiz(envelope.quiz, { targetPoints }))
        : { errorCount: 0, warningCount: 0, successCount: 0 };

    return (
        <div
            role="status"
            aria-label="Trạng thái đề kiểm tra"
            aria-live="polite"
            className="sticky bottom-0 z-20 flex min-h-12 max-w-full items-center justify-between gap-2 overflow-hidden border-t border-slate-200 bg-white px-3 py-2 text-xs sm:px-4 sm:text-sm lg:px-6"
        >
            <p className="min-w-0 truncate text-slate-600">
                <strong className="text-slate-800">{questionCount} câu</strong>
                {' • '}Tổng {totalPoints}/{targetPoints} điểm
                {' • '}{summary.errorCount + summary.warningCount} mục cần kiểm tra
            </p>
            <button
                type="button"
                onClick={onOpenValidation}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2 font-medium text-rose-700 hover:bg-rose-50 sm:px-3"
            >
                <AlertCircle className="h-4 w-4" /> Xem lỗi
            </button>
        </div>
    );
};

export default WorkspaceStatusBar;
