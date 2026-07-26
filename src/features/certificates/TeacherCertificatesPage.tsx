import React, { useState, Suspense } from 'react';
import { Award, Plus, RefreshCw, AlertCircle, Inbox, CheckCircle2, Clock, Send, XCircle, Eye, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBatches } from './useBatches';
import type { BatchRecord } from './useBatches';
import type { CertificateBatchDetail } from '../../../shared/certificates.contract';

const BatchCreateModal = React.lazy(() => import('./BatchCreateModal'));

function statusBadge(status: BatchRecord['status']) {
    switch (status) {
        case 'sent': return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 size={11} />Đã gửi</span>;
        case 'processing': return <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"><Send size={11} />Đang xử lý</span>;
        case 'partial': return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"><AlertCircle size={11} />Một phần</span>;
        case 'failed': return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><XCircle size={11} />Lỗi</span>;
        default: return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"><Clock size={11} />Chờ xử lý</span>;
    }
}

const TeacherCertificatesPage: React.FC = () => {
    const { batches, isLoading, error, refetch, createBatch, fetchBatchDetail, retryBatch } = useBatches();
    const [showModal, setShowModal] = useState(false);
    const [detail, setDetail] = useState<CertificateBatchDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const openDetail = async (batchId: string) => {
        setDetailLoading(true);
        try {
            setDetail(await fetchBatchDetail(batchId));
        } catch (loadError) {
            toast.error(loadError instanceof Error ? loadError.message : 'Không thể tải chi tiết');
        } finally {
            setDetailLoading(false);
        }
    };

    const retryFailed = async (batchId: string) => {
        try {
            await retryBatch(batchId);
            toast.success('Đã đưa các chứng nhận lỗi vào hàng đợi xử lý lại');
            setDetail(null);
        } catch (retryError) {
            toast.error(retryError instanceof Error ? retryError.message : 'Không thể thử lại');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow">
                        <Award size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Cấp phát Chứng nhận</h2>
                        <p className="text-xs text-slate-500">Tạo và gửi chứng nhận cho học sinh</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={refetch}
                        disabled={isLoading}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                        title="Làm mới"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                    >
                        <Plus size={15} /> Cấp mới
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-red-700">Không thể tải dữ liệu</p>
                        <p className="text-xs text-red-500 mt-0.5">{error}</p>
                        <button onClick={refetch} className="mt-2 text-xs text-red-600 underline">Thử lại</button>
                    </div>
                </div>
            )}

            {/* Skeleton loading */}
            {isLoading && (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <div className="h-4 bg-slate-200 rounded w-48" />
                                    <div className="h-3 bg-slate-100 rounded w-32" />
                                </div>
                                <div className="h-6 bg-slate-100 rounded-full w-20" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty */}
            {!isLoading && !error && batches.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                        <Inbox size={36} className="text-amber-300" />
                    </div>
                    <h3 className="text-base font-bold text-slate-700 mb-1">Chưa có đợt cấp phát nào</h3>
                    <p className="text-sm text-slate-400 max-w-xs mb-5">Nhấn "Cấp mới" để tạo đợt cấp chứng nhận đầu tiên cho học sinh.</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        <Plus size={15} /> Cấp chứng nhận ngay
                    </button>
                </div>
            )}

            {/* Batch list */}
            {!isLoading && batches.length > 0 && (
                <div className="space-y-3">
                    {batches.map((b) => (
                        <div key={b.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-slate-800 text-sm truncate">{b.title}</h3>
                                        {statusBadge(b.status)}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Mẫu: <span className="font-medium">{b.template_name ?? '—'}</span>
                                        {' · '}
                                        {b.sent_certificates}/{b.total_certificates} chứng nhận xong
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {new Date(b.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                {/* Progress bar */}
                                {b.total_certificates > 0 && (
                                    <div className="shrink-0 w-20">
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-400 rounded-full transition-all"
                                                style={{ width: `${Math.round((b.sent_certificates / b.total_certificates) * 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 text-right mt-0.5">
                                            {Math.round((b.sent_certificates / b.total_certificates) * 100)}%
                                        </p>
                                    </div>
                                )}
                                <button type="button" onClick={() => openDetail(b.id)} disabled={detailLoading} className="shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Xem chi tiết" aria-label={`Xem chi tiết ${b.title}`}><Eye size={16} /></button>
                                {(b.status === 'failed' || b.status === 'partial') && b.failed_certificates > 0 && (
                                    <button type="button" onClick={() => retryFailed(b.id)} className="shrink-0 p-2 text-amber-600 hover:bg-amber-50 rounded-lg" title="Thử lại phần lỗi" aria-label={`Thử lại ${b.title}`}><RotateCcw size={16} /></button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {detail && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Chi tiết đợt cấp chứng nhận">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                        <div className="p-5 border-b flex items-center justify-between">
                            <div><h3 className="font-bold text-slate-800">{detail.batch.title}</h3><p className="text-xs text-slate-500">{detail.certificates.length} học sinh</p></div>
                            <button type="button" onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Đóng"><XCircle size={18} /></button>
                        </div>
                        <div className="overflow-auto max-h-[60vh] divide-y">
                            {detail.certificates.map((certificate) => (
                                <div key={certificate.id} className="p-4 flex items-start justify-between gap-4">
                                    <div><p className="font-medium text-sm text-slate-800">{certificate.student_name}</p><p className="text-xs text-slate-500">{certificate.quiz_title || 'Không gắn bài kiểm tra'}{certificate.student_score !== null ? ` · ${certificate.student_score} điểm` : ''}</p>{certificate.error_message && <p className="text-xs text-red-600 mt-1">{certificate.error_message}</p>}</div>
                                    {statusBadge(certificate.status === 'revoked' ? 'failed' : certificate.status)}
                                </div>
                            ))}
                        </div>
                        {detail.certificates.some((certificate) => certificate.status === 'failed') && <div className="p-4 border-t flex justify-end"><button type="button" onClick={() => retryFailed(detail.batch.id)} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold"><RotateCcw size={15} /> Thử lại phần lỗi</button></div>}
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <Suspense fallback={null}>
                    <BatchCreateModal
                        onClose={() => setShowModal(false)}
                        onCreated={() => { setShowModal(false); refetch(); }}
                        createBatch={createBatch}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default TeacherCertificatesPage;
