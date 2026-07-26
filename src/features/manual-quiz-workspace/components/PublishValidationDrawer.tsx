import React, { useRef } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Clock3,
    RotateCcw,
    ShieldAlert,
    Sparkles,
    X,
} from 'lucide-react';
import type { Quiz } from '../../../types';
import {
    hasBlockingManualQuizIssues,
    summarizeManualQuizIssues,
    type ManualQuizIssue,
    type ManualQuizIssueSeverity,
} from '../validation/manualQuizValidation';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

interface PublishValidationDrawerProps {
    open: boolean;
    issues: ManualQuizIssue[];
    quiz: Quiz;
    targetPoints: number;
    onClose(): void;
    onGoToQuestion(questionId: string, field?: string): void;
    onFixPoints(): void;
    onFixTime(): void;
    onPublish(): void;
    canUndoPoints?: boolean;
    onUndoPoints?(): void;
    isPublishing?: boolean;
    publishError?: string | null;
    cleanupWarning?: string | null;
}

const GROUPS: Array<{
    severity: ManualQuizIssueSeverity;
    title: string;
    icon: React.ReactNode;
    className: string;
}> = [
    {
        severity: 'error',
        title: 'Lỗi cần sửa',
        icon: <ShieldAlert className="h-5 w-5" />,
        className: 'border-rose-200 bg-rose-50 text-rose-900',
    },
    {
        severity: 'warning',
        title: 'Cảnh báo',
        icon: <AlertTriangle className="h-5 w-5" />,
        className: 'border-amber-200 bg-amber-50 text-amber-900',
    },
    {
        severity: 'success',
        title: 'Đã hoàn tất',
        icon: <CheckCircle2 className="h-5 w-5" />,
        className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    },
];

const IssueAction: React.FC<{
    issue: ManualQuizIssue;
    onGoToQuestion(questionId: string, field?: string): void;
    onFixPoints(): void;
    onFixTime(): void;
}> = ({ issue, onGoToQuestion, onFixPoints, onFixTime }) => {
    if (issue.action === 'go-to-question' && issue.questionId) {
        return (
            <button
                type="button"
                onClick={() => onGoToQuestion(issue.questionId!, issue.field)}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-sky-700 hover:bg-white"
            >
                Đi đến câu <ChevronRight className="h-3.5 w-3.5" />
            </button>
        );
    }
    if (issue.action === 'fix-points') {
        return (
            <button
                type="button"
                onClick={onFixPoints}
                className="min-h-10 rounded-lg px-3 text-xs font-semibold text-sky-700 hover:bg-white"
            >
                Chia đều điểm
            </button>
        );
    }
    if (issue.action === 'fix-time') {
        return (
            <button
                type="button"
                onClick={onFixTime}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-sky-700 hover:bg-white"
            >
                <Clock3 className="h-3.5 w-3.5" /> Đặt thời gian 30 phút
            </button>
        );
    }
    return null;
};

const PublishValidationDrawer: React.FC<PublishValidationDrawerProps> = ({
    open,
    issues,
    quiz,
    targetPoints,
    onClose,
    onGoToQuestion,
    onFixPoints,
    onFixTime,
    onPublish,
    canUndoPoints = false,
    onUndoPoints,
    isPublishing = false,
    publishError = null,
    cleanupWarning = null,
}) => {
    const drawerRef = useRef<HTMLElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const summary = summarizeManualQuizIssues(issues);
    const hasErrors = hasBlockingManualQuizIssues(issues);
    const totalPoints = quiz.questions.reduce((total, question) => total + Number(question.points || 0), 0);

    useDialogFocusTrap({
        open,
        containerRef: drawerRef,
        initialFocusRef: closeButtonRef,
        onEscape: onClose,
    });

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[75] bg-slate-900/35" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <aside
                ref={drawerRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Kiểm tra trước khi xuất bản"
                className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
            >
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 lg:px-6">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Kiểm tra trước khi xuất bản</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            {quiz.questions.length} câu • {totalPoints}/{targetPoints} điểm • {quiz.timeLimit} phút
                        </p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng kiểm tra xuất bản"
                        className="grid h-11 w-11 place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </header>

                <div className="grid grid-cols-3 gap-2 border-b border-slate-200 px-5 py-4 text-center text-xs lg:px-6">
                    <div className="rounded-xl bg-rose-50 px-2 py-3 text-rose-800">
                        <strong className="block text-lg">{summary.errorCount}</strong> lỗi
                    </div>
                    <div className="rounded-xl bg-amber-50 px-2 py-3 text-amber-800">
                        <strong className="block text-lg">{summary.warningCount}</strong> cảnh báo
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-2 py-3 text-emerald-800">
                        <strong className="block text-lg">{summary.successCount}</strong> hoàn tất
                    </div>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 lg:px-6">
                    {canUndoPoints && onUndoPoints && (
                        <button
                            type="button"
                            onClick={onUndoPoints}
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-800"
                        >
                            <RotateCcw className="h-4 w-4" /> Hoàn tác chia điểm
                        </button>
                    )}

                    {GROUPS.map((group) => {
                        const groupIssues = issues.filter((issue) => issue.severity === group.severity);
                        return (
                            <section key={group.severity}>
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    {group.icon} {group.title} ({groupIssues.length})
                                </h3>
                                <div className="mt-3 space-y-2">
                                    {groupIssues.length === 0 ? (
                                        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                                            Không có mục nào.
                                        </p>
                                    ) : groupIssues.map((issue, index) => (
                                        <article
                                            key={`${issue.code}-${issue.questionId || 'quiz'}-${index}`}
                                            className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${group.className}`}
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium leading-6">{issue.message}</p>
                                                {issue.questionId && (
                                                    <p className="mt-0.5 text-xs opacity-70">
                                                        Câu {quiz.questions.findIndex((question) => question.id === issue.questionId) + 1}
                                                        {issue.field ? ` • ${issue.field}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                            <IssueAction
                                                issue={issue}
                                                onGoToQuestion={onGoToQuestion}
                                                onFixPoints={onFixPoints}
                                                onFixTime={onFixTime}
                                            />
                                        </article>
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>

                <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 lg:px-6">
                    {publishError && (
                        <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                            {publishError}
                        </p>
                    )}
                    {cleanupWarning && (
                        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {cleanupWarning}
                        </p>
                    )}
                    <button
                        type="button"
                        disabled={hasErrors || isPublishing}
                        onClick={onPublish}
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        <Sparkles className="h-4 w-4" />
                        {isPublishing ? 'Đang xuất bản…' : 'Xuất bản đề'}
                    </button>
                    {hasErrors && (
                        <p className="mt-2 text-center text-xs text-rose-700">
                            Cần sửa hết lỗi bắt buộc trước khi xuất bản.
                        </p>
                    )}
                </footer>
            </aside>
        </div>
    );
};

export default PublishValidationDrawer;
