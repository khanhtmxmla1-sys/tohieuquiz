import React from 'react';
import { ArrowLeft, CheckCircle2, Eye, List, Settings2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';

const SAVE_STATUS_COPY = {
    idle: 'Chưa lưu thay đổi mới',
    'saving-local': 'Đang lưu trên thiết bị…',
    'saving-remote': 'Đang đồng bộ…',
    saved: 'Đã tự động lưu',
    offline: 'Ngoại tuyến – đã lưu trên thiết bị',
    conflict: 'Có xung đột bản nháp',
    error: 'Chưa thể lưu bản nháp',
} as const;

const SOURCE_TYPE_COPY: Record<string, string> = {
    ai: 'Được tạo bằng AI',
    word_import: 'Nhập từ Word',
    excel_import: 'Nhập từ Excel',
    question_bank: 'Từ ngân hàng câu hỏi',
    template: 'Từ đề mẫu',
    duplicated: 'Bản sao',
};

interface WorkspaceHeaderProps {
    onOpenValidation(): void;
    readOnly?: boolean;
}

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({ onOpenValidation, readOnly = false }) => {
    const navigate = useNavigate();
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const saveStatus = useManualQuizWorkspaceStore((state) => state.saveStatus);
    const saveError = useManualQuizWorkspaceStore((state) => state.saveError);
    const isNavigatorCollapsed = useManualQuizWorkspaceStore((state) => state.isNavigatorCollapsed);
    const isPreviewCollapsed = useManualQuizWorkspaceStore((state) => state.isPreviewCollapsed);
    const updateQuiz = useManualQuizWorkspaceStore((state) => state.updateQuiz);
    const setNavigatorCollapsed = useManualQuizWorkspaceStore((state) => state.setNavigatorCollapsed);
    const setPreviewCollapsed = useManualQuizWorkspaceStore((state) => state.setPreviewCollapsed);
    const sourceLabel = envelope?.quiz.sourceType ? SOURCE_TYPE_COPY[envelope.quiz.sourceType] : undefined;
    const versionNumber = Number(envelope?.quiz.versionNumber || 1);

    return (
        <header
            role="banner"
            aria-label="Thanh công cụ Trình soạn đề"
            className="sticky top-0 z-30 flex min-h-[72px] max-w-full items-center gap-2 overflow-hidden border-b border-slate-200 bg-white px-2 sm:gap-3 sm:px-4 lg:px-6"
        >
            <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                aria-label="Quay lại trang tạo đề"
            >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden xl:inline">Quay lại</span>
            </button>

            <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                    <span>{envelope?.quizId ? 'Chỉnh sửa đề' : 'Tạo đề mới'}</span>
                    {sourceLabel && <span className="normal-case tracking-normal text-violet-700">{sourceLabel}</span>}
                    {versionNumber > 1 && <span className="normal-case tracking-normal text-slate-500">Phiên bản {versionNumber}</span>}
                </p>
                <label htmlFor="manual-quiz-title" className="sr-only">Tên đề kiểm tra</label>
                <input
                    id="manual-quiz-title"
                    value={envelope?.quiz.title ?? ''}
                    onChange={(event) => updateQuiz({ title: event.target.value })}
                    disabled={readOnly}
                    className="w-full truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-base font-semibold text-[#172033] outline-none hover:border-slate-200 focus:border-sky-500 disabled:cursor-not-allowed disabled:text-slate-500 lg:text-lg"
                />
                <p
                    className="flex min-w-0 items-center gap-1 px-2 text-xs text-slate-500"
                    aria-live="polite"
                    title={saveError || undefined}
                >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="shrink-0">
                        {readOnly ? 'Chỉ đọc – dữ liệu gốc được bảo vệ' : SAVE_STATUS_COPY[saveStatus]}
                    </span>
                    {saveError && <span className="truncate text-rose-600">— {saveError}</span>}
                </p>
            </div>

            <div className="flex items-center gap-2">
                {isNavigatorCollapsed && (
                    <button
                        type="button"
                        onClick={() => setNavigatorCollapsed(false)}
                        className="hidden h-11 items-center gap-2 rounded-[10px] border border-slate-200 px-3 text-sm font-medium md:inline-flex"
                        aria-label="Mở danh sách câu hỏi"
                    >
                        <List className="h-4 w-4" />
                        <span className="hidden xl:inline">Câu hỏi</span>
                    </button>
                )}
                <button
                    type="button"
                    className="hidden h-11 items-center gap-2 rounded-[10px] border border-slate-200 px-3 text-sm font-medium xl:inline-flex"
                >
                    <Settings2 className="h-4 w-4" /> Thiết lập đề
                </button>
                <button
                    type="button"
                    onClick={() => setPreviewCollapsed(!isPreviewCollapsed)}
                    className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-slate-200 px-3 text-sm font-medium"
                    aria-label={isPreviewCollapsed ? 'Mở xem trước' : 'Thu gọn xem trước'}
                >
                    <Eye className="h-4 w-4" />
                    <span className="hidden xl:inline">Xem trước</span>
                </button>
                <button
                    type="button"
                    onClick={onOpenValidation}
                    disabled={readOnly}
                    aria-label={readOnly ? 'Đề đang ở chế độ chỉ đọc' : 'Kiểm tra và xuất bản'}
                    className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-sky-500 px-3 text-sm font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 lg:px-4"
                >
                    <ShieldCheck className="h-4 w-4" />
                    <span className="hidden lg:inline">Kiểm tra và xuất bản</span>
                    <span className="lg:hidden">Kiểm tra</span>
                </button>
            </div>
        </header>
    );
};

export default WorkspaceHeader;
