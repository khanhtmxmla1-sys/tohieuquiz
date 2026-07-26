import React from 'react';
import { ArrowRight, Clock3, FilePlus2, Files, ListChecks } from 'lucide-react';
import type { Quiz } from '../../../types';

interface RecentQuizzesPanelProps {
    quizzes: Quiz[];
    onCreateQuiz: () => void;
    onManageQuizzes: () => void;
}

const formatQuizDate = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const RecentQuizzesPanel: React.FC<RecentQuizzesPanelProps> = ({ quizzes, onCreateQuiz, onManageQuizzes }) => (
    <section aria-labelledby="recent-quizzes-heading" className="min-w-0 max-w-full overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#E5E7EB] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
                <p className="text-sm font-medium text-[#0284C7]">Nội dung giảng dạy</p>
                <h2 id="recent-quizzes-heading" className="mt-1 text-xl font-semibold tracking-tight text-[#172033] sm:text-2xl">
                    Đề kiểm tra gần đây
                </h2>
                <p className="mt-1 text-sm text-[#526174]">Mở danh sách quản lý hoặc bắt đầu tạo một đề mới.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onCreateQuiz}
                    className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[#0EA5E9] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
                >
                    <FilePlus2 aria-hidden="true" className="size-4" />
                    Tạo đề
                </button>
                <button
                    type="button"
                    onClick={onManageQuizzes}
                    className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-3.5 py-2 text-sm font-medium text-[#526174] transition-colors hover:bg-[#F8FAFC] hover:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
                >
                    Xem tất cả
                    <ArrowRight aria-hidden="true" className="size-4" />
                </button>
            </div>
        </div>

        {quizzes.length > 0 ? (
            <>
                <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[760px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium text-[#7A8796]">
                                <th className="px-5 py-3">Tên đề</th>
                                <th className="px-4 py-3">Lớp</th>
                                <th className="px-4 py-3">Số câu</th>
                                <th className="px-4 py-3">Thời gian</th>
                                <th className="px-4 py-3">Ngày tạo</th>
                                <th className="px-5 py-3 text-right"><span className="sr-only">Thao tác</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                            {quizzes.map((quiz) => (
                                <tr key={quiz.id} className="transition-colors hover:bg-[#F8FAFC]">
                                    <td className="px-5 py-4">
                                        <div className="min-w-0">
                                            <p className="max-w-md truncate text-sm font-semibold text-[#172033]">{quiz.title}</p>
                                            <p className="mt-0.5 text-xs text-[#7A8796]">{quiz.topic || quiz.detectedCategory || 'Chưa phân loại'}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm font-medium text-[#526174]">{quiz.classLevel || '—'}</td>
                                    <td className="px-4 py-4 text-sm font-medium text-[#526174]">{quiz.questions?.length || 0}</td>
                                    <td className="px-4 py-4 text-sm text-[#526174]">{quiz.timeLimit || 0} phút</td>
                                    <td className="px-4 py-4 text-sm text-[#7A8796]">{formatQuizDate(quiz.createdAt)}</td>
                                    <td className="px-5 py-4 text-right">
                                        <button
                                            type="button"
                                            onClick={onManageQuizzes}
                                            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-2.5 text-xs font-medium text-[#0284C7] transition-colors hover:bg-[#F0F9FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
                                        >
                                            Quản lý
                                            <ArrowRight aria-hidden="true" className="size-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="divide-y divide-[#E5E7EB] lg:hidden">
                    {quizzes.map((quiz) => (
                        <article key={quiz.id} className="p-4">
                            <div className="flex items-start gap-3">
                                <Files aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#0284C7]" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="line-clamp-2 text-sm font-semibold text-[#172033]">{quiz.title}</h3>
                                    <p className="mt-1 text-xs text-[#7A8796]">{quiz.topic || quiz.detectedCategory || 'Chưa phân loại'}</p>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#526174]">
                                <span>Lớp {quiz.classLevel || '—'}</span>
                                <span className="inline-flex items-center gap-1"><ListChecks aria-hidden="true" className="size-3.5" />{quiz.questions?.length || 0} câu</span>
                                <span className="inline-flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3.5" />{quiz.timeLimit || 0} phút</span>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#E5E7EB] pt-3">
                                <span className="text-xs text-[#7A8796]">{formatQuizDate(quiz.createdAt)}</span>
                                <button
                                    type="button"
                                    onClick={onManageQuizzes}
                                    className="inline-flex min-h-9 items-center gap-1 rounded-[8px] px-2.5 text-xs font-medium text-[#0284C7] hover:bg-[#F0F9FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
                                >
                                    Quản lý
                                    <ArrowRight aria-hidden="true" className="size-3.5" />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </>
        ) : (
            <div className="px-5 py-12 text-center">
                <Files aria-hidden="true" className="mx-auto size-8 text-[#9AA5B1]" />
                <h3 className="mt-4 text-lg font-semibold text-[#172033]">Chưa có đề kiểm tra</h3>
                <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#526174]">Tạo đề đầu tiên để bắt đầu giao bài và theo dõi kết quả học tập.</p>
                <button
                    type="button"
                    onClick={onCreateQuiz}
                    className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0284C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
                >
                    <FilePlus2 aria-hidden="true" className="size-4" />
                    Tạo đề mới
                </button>
            </div>
        )}
    </section>
);

export default RecentQuizzesPanel;
