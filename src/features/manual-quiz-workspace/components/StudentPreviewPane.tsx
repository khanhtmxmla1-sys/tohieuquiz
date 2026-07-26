import React from 'react';
import { ChevronRight, Monitor, Smartphone } from 'lucide-react';
import MathSpan from '../../../components/common/MathSpan';
import { QuestionType } from '../../../types';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';

const StudentPreviewPane: React.FC = () => {
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const setPreviewCollapsed = useManualQuizWorkspaceStore((state) => state.setPreviewCollapsed);
    const selected = envelope?.quiz.questions.find((question) => question.id === envelope.selectedQuestionId) ?? null;
    const data = selected as any;
    const prompt = selected
        ? String(selected.type === QuestionType.TRUE_FALSE ? data.mainQuestion : data.question)
        : '';

    return (
        <aside
            aria-label="Xem trước học sinh"
            data-pane-width="380"
            className="flex min-h-0 w-full min-w-0 flex-col border-l border-slate-200 bg-slate-50 md:fixed md:bottom-12 md:right-0 md:top-[72px] md:z-40 md:w-[380px] md:max-w-[min(380px,100vw)] md:shadow-2xl xl:static xl:z-auto xl:w-[380px] xl:shadow-none"
        >
            <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-4">
                <div>
                    <h2 className="font-semibold">Xem trước học sinh</h2>
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Monitor className="h-3.5 w-3.5" /> Desktop
                        <span>•</span>
                        <Smartphone className="h-3.5 w-3.5" /> Mobile
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setPreviewCollapsed(true)}
                    className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-white"
                    aria-label="Đóng khung xem trước"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    {!selected ? (
                        <div className="py-12 text-center text-sm text-slate-500">
                            Thêm hoặc chọn một câu hỏi để xem trước.
                        </div>
                    ) : (
                        <>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700">Câu hỏi hiện tại</p>
                            <MathSpan content={prompt || 'Câu hỏi chưa có nội dung'} as="div" className="text-base font-semibold leading-7" />
                            {Array.isArray(data.options) && (
                                <div className="mt-5 space-y-3">
                                    {data.options.map((option: string, index: number) => (
                                        <div key={`${selected.id}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                                            <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-xs font-semibold">
                                                {String.fromCharCode(65 + index)}
                                            </span>
                                            <MathSpan content={option || `Phương án ${index + 1}`} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default StudentPreviewPane;
