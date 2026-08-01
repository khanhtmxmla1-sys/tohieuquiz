import React from 'react';
import { AlertTriangle, CopyPlus, LockKeyhole } from 'lucide-react';
import type { QuizEditorEditability } from '../types/manualQuizWorkspace.types';

interface QuizEditorAccessBannerProps {
    editability: QuizEditorEditability;
    onCreateVersion(): void;
    isCreatingVersion: boolean;
    error?: string | null;
}

const QuizEditorAccessBanner: React.FC<QuizEditorAccessBannerProps> = ({
    editability,
    onCreateVersion,
    isCreatingVersion,
    error,
}) => {
    if (editability.mode === 'READONLY') {
        const message = editability.reason === 'LIVE_EXAM_ACTIVE'
            ? `Đề đang được sử dụng trong ${editability.activeLiveExamCount} ca thi trực tiếp. Nội dung đã được khóa để bảo vệ bài làm.`
            : `Đề đã có ${editability.resultCount} bài nộp. Nội dung gốc được giữ nguyên để bảo vệ kết quả học sinh.`;
        return (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 lg:px-6">
                <div className="flex min-w-0 items-start gap-2">
                    <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div>
                        <p className="font-semibold">Đề đang ở chế độ chỉ đọc</p>
                        <p>{message}</p>
                        {error && <p className="mt-1 font-medium text-rose-700">{error}</p>}
                    </div>
                </div>
                {editability.canCreateVersion && (
                    <button
                        type="button"
                        onClick={onCreateVersion}
                        disabled={isCreatingVersion}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-700 px-4 font-semibold text-white hover:bg-amber-800 disabled:cursor-wait disabled:opacity-60"
                    >
                        <CopyPlus className="h-4 w-4" />
                        {isCreatingVersion ? 'Đang tạo phiên bản…' : 'Tạo phiên bản mới để chỉnh sửa'}
                    </button>
                )}
            </div>
        );
    }

    if (editability.requiresPublishedWarning) {
        return (
            <div role="status" className="flex items-start gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-950 lg:px-6">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                <p>
                    Đề đã được giao cho học sinh nhưng chưa có bài nộp. Hệ thống sẽ yêu cầu xác nhận trước khi lưu thay đổi.
                </p>
            </div>
        );
    }

    return null;
};

export default QuizEditorAccessBanner;
