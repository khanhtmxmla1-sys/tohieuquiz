/**
 * Waiting Room Teacher Component
 * 
 * Shows after teacher creates session, before starting the exam.
 * Displays access code and live participant list.
 */

import React, { useState } from 'react';
import { Users, Play, Copy, Check, Loader2, Clock } from 'lucide-react';
import { useLiveExamParticipants } from '../../hooks';
import { startExam, formatAccessCode } from '../../services/liveExamService';
import type { WaitingRoomChatMessage } from '../../types/liveExam.types';
import WaitingRoomChatTeacherCard from './WaitingRoomChatTeacherCard';

interface WaitingRoomTeacherProps {
    sessionId: string;
    sessionTitle: string;
    accessCode: string;
    duration: number;
    onExamStarted: () => void;
    waitingRoomChat?: {
        enabled: boolean;
        isLoading?: boolean;
        isSending?: boolean;
        messages: WaitingRoomChatMessage[];
        onSendAnnouncement: (content: string) => Promise<void>;
        onToggleChat: (enabled: boolean) => Promise<void>;
        onHideMessage: (messageId: string) => Promise<void>;
    } | null;
}

export const WaitingRoomTeacher: React.FC<WaitingRoomTeacherProps> = ({
    sessionId,
    sessionTitle,
    accessCode,
    duration,
    onExamStarted,
    waitingRoomChat = null,
}) => {
    const { participants, isLoading } = useLiveExamParticipants({
        sessionId,
        enabled: true,
    });

    const [copied, setCopied] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState('');

    const handleCopyCode = () => {
        navigator.clipboard.writeText(accessCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStartExam = async () => {
        if (participants.length === 0) {
            setError('Chưa có học sinh nào tham gia');
            return;
        }

        setIsStarting(true);
        setError('');

        try {
            await startExam(sessionId);
            onExamStarted();
        } catch (err: any) {
            setError(err.message || 'Không thể bắt đầu bài thi');
            setIsStarting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-100 p-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">
                                {sessionTitle}
                            </h1>
                            <div className="flex items-center gap-2 text-slate-600">
                                <Clock size={18} />
                                <span>Thời gian: {duration} phút</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-slate-600 mb-1">Trạng thái</div>
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                                Đang chờ
                            </span>
                        </div>
                    </div>
                </div>

                {waitingRoomChat && (
                    <div className="mb-6">
                        <WaitingRoomChatTeacherCard
                            messages={waitingRoomChat.messages}
                            chatEnabled={waitingRoomChat.enabled}
                            isLoading={waitingRoomChat.isLoading}
                            isSending={waitingRoomChat.isSending}
                            onSendAnnouncement={waitingRoomChat.onSendAnnouncement}
                            onToggleChat={waitingRoomChat.onToggleChat}
                            onHideMessage={waitingRoomChat.onHideMessage}
                        />
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Access Code Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">
                            Mã Tham Gia
                        </h2>
                        
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border-4 border-blue-300 rounded-2xl p-8 mb-6">
                            <div className="text-center">
                                <div className="text-6xl font-bold text-blue-600 tracking-widest mb-4">
                                    {formatAccessCode(accessCode)}
                                </div>
                                <button
                                    onClick={handleCopyCode}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto font-semibold"
                                >
                                    {copied ? (
                                        <>
                                            <Check size={20} />
                                            Đã sao chép!
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={20} />
                                            Sao chép mã
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <h3 className="font-semibold text-blue-900 mb-2">
                                📢 Hướng dẫn học sinh:
                            </h3>
                            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                                <li>Truy cập trang thi trực tiếp</li>
                                <li>Nhập mã: <strong>{formatAccessCode(accessCode)}</strong></li>
                                <li>Chờ giáo viên bắt đầu</li>
                            </ol>
                        </div>
                    </div>

                    {/* Participants Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Users size={24} />
                                Học sinh đã tham gia
                            </h2>
                            <div className="text-3xl font-bold text-blue-600">
                                {participants.length}
                            </div>
                        </div>

                        {/* Participant List */}
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 max-h-[400px] overflow-y-auto">
                            {isLoading && participants.length === 0 ? (
                                <div className="text-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-2" />
                                    <p className="text-slate-500">Đang tải...</p>
                                </div>
                            ) : participants.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500">Chưa có học sinh nào tham gia</p>
                                    <p className="text-sm text-slate-400 mt-1">
                                        Chia sẻ mã tham gia với học sinh
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {participants.map((participant, index) => (
                                        <div
                                            key={participant.id}
                                            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200"
                                        >
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-slate-800">
                                                    {participant.username}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    Tham gia lúc {new Date(participant.joinedAt).toLocaleTimeString('vi-VN')}
                                                </div>
                                            </div>
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Start Button */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleStartExam}
                            disabled={isStarting || participants.length === 0}
                            className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all"
                        >
                            {isStarting ? (
                                <>
                                    <Loader2 className="animate-spin" size={24} />
                                    Đang bắt đầu...
                                </>
                            ) : (
                                <>
                                    <Play size={24} />
                                    Bắt Đầu Bài Thi
                                </>
                            )}
                        </button>

                        {participants.length === 0 && (
                            <p className="text-center text-sm text-slate-500 mt-3">
                                Cần ít nhất 1 học sinh để bắt đầu
                            </p>
                        )}
                    </div>
                </div>

                {/* Tips */}
                <div className="mt-6 bg-white rounded-2xl shadow-xl p-6">
                    <h3 className="font-bold text-slate-800 mb-3">💡 Lưu ý:</h3>
                    <ul className="grid md:grid-cols-2 gap-3 text-sm text-slate-600">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>Danh sách học sinh tự động cập nhật khi có người tham gia</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>Bài thi sẽ bắt đầu ngay khi bạn nhấn nút "Bắt đầu"</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>Tất cả học sinh sẽ nhận được thông báo bắt đầu thi</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>Thời gian đếm ngược sẽ bắt đầu cho tất cả học sinh</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
