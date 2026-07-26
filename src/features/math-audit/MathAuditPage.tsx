import React, { useCallback, useEffect, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Eye,
    Loader2,
    PencilLine,
    RefreshCw,
    ScanSearch,
    ShieldCheck,
} from 'lucide-react';
import MathSpan from '../../components/common/MathSpan';
import { showError } from '../../utils/toast';
import { mathAuditService } from './mathAuditService';
import type { MathAuditIssue, MathAuditSummary, MathRenderEvent } from './mathAudit.types';

const emptySummary: MathAuditSummary = {
    scanned: 0,
    affected: 0,
    autoFixable: 0,
    blocked: 0,
    currentVersion: 0,
};

type SummaryCard = {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
};

const Preview: React.FC<{
    title: string;
    content: string;
    tone: 'current' | 'suggested';
}> = ({ title, content, tone }) => (
    <div className={`rounded-xl border p-3 ${tone === 'current' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
        <p className={`mb-2 text-[10px] font-black uppercase tracking-wide ${tone === 'current' ? 'text-amber-700' : 'text-blue-700'}`}>
            {title}
        </p>
        <div className="rounded-lg bg-white px-3 py-2">
            <MathSpan content={content || '—'} as="div" className="text-sm text-slate-800" />
        </div>
        <code className="mt-2 block max-h-20 overflow-auto whitespace-pre-wrap break-all text-[10px] text-slate-500">
            {content || '—'}
        </code>
    </div>
);

const MathAuditPage: React.FC = () => {
    const [issues, setIssues] = useState<MathAuditIssue[]>([]);
    const [summary, setSummary] = useState<MathAuditSummary>(emptySummary);
    const [telemetry, setTelemetry] = useState<MathRenderEvent[]>([]);
    const [telemetrySummary, setTelemetrySummary] = useState({ events: 0, occurrences: 0, days: 7 });
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const [issueResponse, telemetryResponse] = await Promise.all([
                mathAuditService.listIssues(1000),
                mathAuditService.listTelemetry(7),
            ]);
            setIssues(issueResponse.data);
            setSummary(issueResponse.summary);
            setTelemetry(telemetryResponse.data);
            setTelemetrySummary(telemetryResponse.summary);
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Không thể tải dữ liệu theo dõi công thức');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const cards: SummaryCard[] = [
        { label: 'Đã quét', value: summary.scanned, icon: ScanSearch, tone: 'text-blue-600' },
        { label: 'Có cảnh báo', value: summary.affected, icon: AlertTriangle, tone: 'text-amber-600' },
        { label: 'Có gợi ý hiển thị', value: summary.autoFixable, icon: Eye, tone: 'text-sky-600' },
        { label: 'Cần sửa trong đề', value: summary.blocked, icon: PencilLine, tone: 'text-red-600' },
        { label: 'Định dạng mới', value: summary.currentVersion, icon: ShieldCheck, tone: 'text-indigo-600' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 text-white shadow">
                        <ScanSearch className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Theo dõi lỗi công thức</h2>
                        <p className="text-xs text-slate-500">
                            Chế độ chỉ đọc: phát hiện lỗi cú pháp và lỗi MathJax production, không thay đổi quiz cũ.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Quét lại
                </button>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div>
                        <p className="font-bold">Dashboard này không có quyền sửa dữ liệu câu hỏi.</p>
                        <p className="mt-1 text-xs text-blue-700">
                            Khi cần xử lý một câu lỗi, mở <strong>Đề kiểm tra → Sửa đề</strong>. Worker sẽ chuẩn hóa và kiểm tra công thức trước khi lưu.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {cards.map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <Icon className={`mb-2 h-4 w-4 ${tone}`} />
                        <p className="text-2xl font-black text-slate-800">{value}</p>
                        <p className="text-xs text-slate-500">{label}</p>
                    </div>
                ))}
            </div>

            <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4">
                    <h3 className="font-bold text-slate-800">Câu hỏi có cảnh báo cú pháp</h3>
                    <p className="text-xs text-slate-500">
                        Danh sách chỉ hiển thị lỗi cú pháp thực tế; câu định dạng cũ nhưng không lỗi sẽ không xuất hiện.
                    </p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-14">
                        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                    </div>
                ) : issues.length === 0 ? (
                    <div className="py-14 text-center text-sm text-emerald-700">
                        <CheckCircle2 className="mr-2 inline h-5 w-5" />Không ghi nhận lỗi cú pháp công thức.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {issues.map((issue, issueIndex) => {
                            const requiresManualEdit = issue.remainingIssues.length > 0;
                            const stableKey = `${issue.quizId}-${issue.questionId}-${issueIndex}`;
                            return (
                                <article key={stableKey} className="p-4">
                                    <div className="mb-3 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-slate-800">{issue.quizTitle || issue.quizId || 'Không xác định đề'}</span>
                                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                                {issue.questionType || 'UNKNOWN'}
                                            </span>
                                            <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${requiresManualEdit ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {requiresManualEdit ? 'Cần sửa trong đề' : 'Có gợi ý hiển thị'}
                                            </span>
                                        </div>
                                        <p className="mt-1 break-all text-[11px] text-slate-400">{issue.questionId || 'Không có mã câu hỏi'}</p>
                                        {issue.changedFields.length > 0 && (
                                            <p className="mt-1 text-xs text-slate-500">Trường liên quan: {issue.changedFields.join(', ')}</p>
                                        )}
                                    </div>

                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <Preview title="Hiện tại" content={issue.previewBefore} tone="current" />
                                        <Preview title="Gợi ý hiển thị" content={issue.previewAfter} tone="suggested" />
                                    </div>

                                    {issue.currentIssues.length > 0 && (
                                        <div className="mt-3 space-y-1 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                                            {issue.currentIssues.map((item, index) => (
                                                <p key={`${item.field}-${item.code}-${index}`}>• {item.field}: {item.message}</p>
                                            ))}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-amber-600" />
                        <h3 className="font-bold text-slate-800">Lỗi MathJax production</h3>
                    </div>
                    <span className="text-xs text-slate-400">
                        {telemetrySummary.occurrences} lượt / {telemetrySummary.days} ngày
                    </span>
                </div>
                <div className="max-h-[520px] space-y-2 overflow-y-auto">
                    {telemetry.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-400">Chưa ghi nhận lỗi MathJax.</p>
                    )}
                    {telemetry.map((event) => (
                        <div key={event.fingerprint} className="rounded-xl border border-slate-100 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-600">
                                    {event.error_code}
                                </span>
                                <span className="text-xs font-bold text-slate-700">×{event.count}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                                {event.question_type || 'UNKNOWN'} · quiz {event.quiz_id || '—'} · câu {event.question_id || '—'}
                            </p>
                            <p className="break-all text-[10px] text-slate-400">
                                {event.route || '/'} · v{event.math_format_version}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                                Gần nhất: {new Date(event.last_seen_at).toLocaleString('vi-VN')}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default MathAuditPage;
