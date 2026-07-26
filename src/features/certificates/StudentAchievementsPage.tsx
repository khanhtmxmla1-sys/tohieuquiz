import React from 'react';
import { Trophy, Download, RefreshCw, AlertCircle, Inbox } from 'lucide-react';
import { useCertificates } from './useCertificates';
import CertificateCard from './CertificateCard';

interface StudentAchievementsPageProps {
    onBack?: () => void;
}

const StudentAchievementsPage: React.FC<StudentAchievementsPageProps> = () => {
    const { certificates, isLoading, error, refetch } = useCertificates();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-amber-50 pb-24 pt-2">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-indigo-100 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow">
                            <Trophy size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-gray-800">Thành tích của tôi</h1>
                            <p className="text-xs text-gray-500">
                                {isLoading ? 'Đang tải...' : `${certificates.length} chứng nhận`}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={refetch}
                        disabled={isLoading}
                        className="p-2 rounded-xl hover:bg-indigo-50 text-indigo-400 hover:text-blue-700 transition-colors disabled:opacity-50"
                        title="Làm mới"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 pt-6">
                {/* Error state */}
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                        <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-red-700">Không thể tải chứng nhận</p>
                            <p className="text-xs text-red-500 mt-0.5">{error}</p>
                            <button
                                onClick={refetch}
                                className="mt-2 text-xs text-red-600 underline"
                            >
                                Thử lại
                            </button>
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {isLoading && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden animate-pulse">
                                <div className="aspect-[4/3] bg-amber-100" />
                                <div className="p-4 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                                    <div className="h-8 bg-indigo-100 rounded-xl mt-3" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!isLoading && !error && certificates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                            <Inbox size={40} className="text-amber-300" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-700 mb-2">Chưa có chứng nhận nào</h2>
                        <p className="text-sm text-gray-400 max-w-xs">
                            Học thật chăm chỉ và hoàn thành các bài thi để nhận chứng nhận từ giáo viên nhé! 🌟
                        </p>
                    </div>
                )}

                {/* Certificate Grid */}
                {!isLoading && certificates.length > 0 && (
                    <>
                        {/* Summary bar */}
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-amber-100 p-4 flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-400 rounded-xl flex items-center justify-center">
                                    <Trophy size={20} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-amber-500">{certificates.length}</p>
                                    <p className="text-xs text-gray-500">Chứng nhận</p>
                                </div>
                            </div>
                            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-indigo-100 p-4 flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-xl flex items-center justify-center">
                                    <Download size={20} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-600">Nhấn vào thẻ</p>
                                    <p className="text-xs text-gray-400">để tải về hoặc chia sẻ</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {certificates.map((cert) => (
                                <CertificateCard key={cert.id} cert={cert} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default StudentAchievementsPage;
