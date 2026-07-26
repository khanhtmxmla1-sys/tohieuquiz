import React from 'react';
import { Cloud, Laptop, Loader2, TriangleAlert } from 'lucide-react';
import type { ManualQuizDraftRecord } from '../../../../shared/manual-quiz-draft.contract';
import type { ManualQuizDraftEnvelope } from '../types/manualQuizWorkspace.types';

interface DraftConflictDialogProps {
    localDraft: ManualQuizDraftEnvelope;
    serverRecord: ManualQuizDraftRecord;
    isResolving: boolean;
    onUseLocal(): void | Promise<void>;
    onUseServer(): void | Promise<void>;
}

const formatDateTime = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Không rõ thời gian';
    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
};

const DraftVersionCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    draft: ManualQuizDraftEnvelope;
    accent: 'local' | 'server';
}> = ({ icon, title, draft, accent }) => (
    <div className={`rounded-xl border p-4 ${accent === 'local'
        ? 'border-sky-200 bg-sky-50/60'
        : 'border-amber-200 bg-amber-50/60'}`}
    >
        <div className="flex items-center gap-2 font-semibold text-slate-900">
            {icon}
            {title}
        </div>
        <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-800">{draft.quiz.title}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div>
                <dt className="text-slate-500">Cập nhật</dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(draft.updatedAt)}</dd>
            </div>
            <div>
                <dt className="text-slate-500">Số câu</dt>
                <dd className="mt-0.5 font-medium">{draft.quiz.questions.length} câu</dd>
            </div>
            <div>
                <dt className="text-slate-500">Revision</dt>
                <dd className="mt-0.5 font-medium">{draft.revision}</dd>
            </div>
            <div>
                <dt className="text-slate-500">Thiết bị</dt>
                <dd className="mt-0.5 font-medium">{accent === 'local' ? 'Thiết bị này' : 'Hệ thống'}</dd>
            </div>
        </dl>
    </div>
);

const DraftConflictDialog: React.FC<DraftConflictDialogProps> = ({
    localDraft,
    serverRecord,
    isResolving,
    onUseLocal,
    onUseServer,
}) => (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/55 p-4 backdrop-blur-sm">
        <section
            role="dialog"
            aria-modal="true"
            aria-label="Bản nháp có thay đổi ở nơi khác"
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        >
            <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
                    <TriangleAlert className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900">Bản nháp có thay đổi ở nơi khác</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                        Hệ thống không tự ghi đè. Hãy chọn phiên bản bạn muốn tiếp tục sử dụng.
                    </p>
                </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DraftVersionCard
                    icon={<Laptop className="h-4 w-4 text-sky-700" />}
                    title="Bản trên máy"
                    draft={localDraft}
                    accent="local"
                />
                <DraftVersionCard
                    icon={<Cloud className="h-4 w-4 text-amber-700" />}
                    title="Bản trên hệ thống"
                    draft={serverRecord.draft as ManualQuizDraftEnvelope}
                    accent="server"
                />
            </div>

            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                Chọn bản trên máy sẽ gửi nội dung hiện tại lên hệ thống. Chọn bản trên hệ thống sẽ thay nội dung đang mở trên thiết bị này.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    disabled={isResolving}
                    onClick={() => void onUseServer()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                >
                    <Cloud className="h-4 w-4" /> Dùng bản trên hệ thống
                </button>
                <button
                    type="button"
                    disabled={isResolving}
                    onClick={() => void onUseLocal()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-sky-600 px-5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60"
                >
                    {isResolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Laptop className="h-4 w-4" />}
                    Giữ bản trên máy
                </button>
            </div>
        </section>
    </div>
);

export default DraftConflictDialog;
