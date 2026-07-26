/**
 * Active Exam Monitor Component
 * 
 * Teacher monitors exam progress in real-time.
 * Shows participant activity, timer, and end early option.
 */

import React, { useState } from 'react';
import { Users, Clock, AlertCircle, Loader2, StopCircle } from 'lucide-react';
import { useLiveExamParticipants, useLiveExamTimer } from '../../hooks';
import { endExamEarly } from '../../services/liveExamService';

interface ActiveExamMonitorProps {
    sessionId: string;
    sessionTitle: string;
    endsAt: string;
    totalQuestions: number;
    onExamEnded: () => void;
}

export const ActiveExamMonitor: React.FC<ActiveExamMonitorProps> = ({
    sessionId,
    sessionTitle,
    endsAt,
    totalQuestions,
    onExamEnded,
}) => {
    const { participants, isLoading, error: participantsError } = useLiveExamParticipants({
        sessionId,
        enabled: true,
    });

    const { timeRemaining, formattedTime, progress } = useLiveExamTimer({
        endsAt,
    });

    const [isEnding, setIsEnding] = useState(false);
    const [error, setError] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    const handleEndEarly = async () => {
        setIsEnding(true);
        setError('');

        try {
            await endExamEarly(sessionId);
            onExamEnded();
        } catch (err: any) {
            setError(err.message || 'Không thể kết thúc bài thi');
            setIsEnding(false);
        }
    };

    // Calculate stats
    const totalParticipants = participants.length;
    const submittedCount = participants.filter(p => p.submittedAt).length;
    const activeCount = totalParticipants - submittedCount;
    const avgProgress = totalParticipants > 0 && totalQuestions > 0
        ? Math.round(participants.reduce((sum, p) => sum + p.answeredCount, 0) / totalParticipants / totalQuestions * 100)
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">
                                {sessionTitle}
                            </h1>
                            <p className="text-slate-600">Đang theo dõi bài thi trực tiếp</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm text-slate-600 mb-1">Trạng thái</div>
                                <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    Đang thi
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Timer */}
                    <div className="flex items-center justify-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                        <Clock size={32} className="text-blue-600" />
                        <div>
                            <div className="text-sm text-slate-600">Thời gian còn lại</div>
                            <div className={`text-4xl font-bold ${
                                timeRemaining <= 60 ? 'text-red-600' : 
                                timeRemaining <= 300 ? 'text-yellow-600' : 
                                'text-green-600'
                            }`}>
                                {formattedTime}
                            </div>
                        </div>
                        <div className="flex-1 ml-8">
                            <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-1000"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Users className="text-blue-600" size={24} />
                            <h3 className="font-semibold text-slate-700">Tổng số</h3>
                        </div>
                        <div className="text-3xl font-bold text-blue-600">{totalParticipants}</div>
                        <p className="text-sm text-slate-500">học sinh</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Clock className="text-green-600" size={24} />
                            <h3 className="font-semibold text-slate-700">Đang làm</h3>
                        </div>
                        <div className="text-3xl font-bold text-green-600">{activeCount}</div>
                        <p className="text-sm text-slate-500">học sinh</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <StopCircle className="text-blue-700" size={24} />
                            <h3 className="font-semibold text-slate-700">Đã nộp</h3>
                        </div>
                        <div className="text-3xl font-bold text-blue-700">{submittedCount}</div>
                        <p className="text-sm text-slate-500">học sinh</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <AlertCircle className="text-orange-600" size={24} />
                            <h3 className="font-semibold text-slate-700">Tiến độ TB</h3>
                        </div>
                        <div className="text-3xl font-bold text-orange-600">{avgProgress}%</div>
                        <p className="text-sm text-slate-500">hoàn thành</p>
                    </div>
                </div>

                {/* Participants List */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    {participantsError && (
                        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                            <AlertCircle size={16} />
                            Không thể cập nhật danh sách học sinh: {participantsError}
                        </div>
                    )}
                    <h2 className="text-xl font-bold text-slate-800 mb-4">
                        Danh sách học sinh ({totalParticipants})
                    </h2>

                    {isLoading && participants.length === 0 ? (
                        <div className="text-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-2" />
                            <p className="text-slate-500">Đang tải...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b-2 border-slate-200">
                                        <th className="text-left py-3 px-4 font-semibold text-slate-700">#</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-700">Học sinh</th>
                                        <th className="text-center py-3 px-4 font-semibold text-slate-700">Tiến độ</th>
                                        <th className="text-center py-3 px-4 font-semibold text-slate-700">Đã trả lời</th>
                                        <th className="text-center py-3 px-4 font-semibold text-slate-700">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participants.map((participant, index) => {
                                        const progressPercent = totalQuestions > 0
                                            ? Math.min(100, Math.round((participant.answeredCount / totalQuestions) * 100))
                                            : 0;
                                        return (
                                            <tr key={participant.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="py-3 px-4 text-slate-600">{index + 1}</td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-800">{participant.username}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-600 transition-all"
                                                                style={{ width: `${progressPercent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm text-slate-600 w-12">{progressPercent}%</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="text-slate-700 font-medium">
                                                        {participant.answeredCount}/{totalQuestions}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {participant.submittedAt ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-blue-800 rounded-full text-sm">
                                                            <StopCircle size={14} />
                                                            Đã nộp
                                                        </span>
                                                    ) : participant.isOnline ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                            Đang làm
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                                                            Offline
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* End Early Button */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {!showConfirm ? (
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={isEnding}
                            className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 disabled:bg-slate-300 flex items-center justify-center gap-3"
                        >
                            <StopCircle size={24} />
                            Kết Thúc Bài Thi Sớm
                        </button>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
                                <h3 className="font-bold text-yellow-900 mb-2">⚠️ Xác nhận kết thúc sớm</h3>
                                <p className="text-yellow-800 text-sm mb-2">
                                    Bạn có chắc muốn kết thúc bài thi ngay bây giờ?
                                </p>
                                <ul className="text-sm text-yellow-700 space-y-1">
                                    <li>• {activeCount} học sinh đang làm bài sẽ bị buộc nộp</li>
                                    <li>• Không thể hoàn tác sau khi kết thúc</li>
                                    <li>• Hệ thống sẽ tự động chấm điểm</li>
                                </ul>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    disabled={isEnding}
                                    className="flex-1 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleEndEarly}
                                    disabled={isEnding}
                                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-slate-300 flex items-center justify-center gap-2"
                                >
                                    {isEnding ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Đang kết thúc...
                                        </>
                                    ) : (
                                        <>
                                            <StopCircle size={20} />
                                            Xác nhận kết thúc
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
