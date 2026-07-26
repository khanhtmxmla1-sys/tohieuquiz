/**
 * Waiting Room Student Component
 * 
 * Shows after student joins, before teacher starts the exam.
 * Polls session status every 3 seconds to detect when exam starts.
 */

import React, { useEffect } from 'react';
import { Clock, Users, Loader2 } from 'lucide-react';
import { useLiveExamStatus } from '../../hooks';
import { getStatusLabel } from '../../services/liveExamService';
import { useWaitingRoomChat } from '../../hooks/useWaitingRoomChat';
import { useClassroomStore } from '../../stores/useClassroomStore';
import WaitingRoomChatPanel from './WaitingRoomChatPanel';

interface WaitingRoomStudentProps {
    sessionId: string;
    sessionTitle: string;
    onExamStart: () => void;
}

export const WaitingRoomStudent: React.FC<WaitingRoomStudentProps> = ({
    sessionId,
    sessionTitle,
    onExamStart,
}) => {
    const studentSession = useClassroomStore((state) => state.studentSession);
    const { status, isLoading } = useLiveExamStatus({
        sessionId,
        enabled: true,
    });
    const chat = useWaitingRoomChat({
        sessionId,
        enabled: status?.session.status !== 'active' && status?.session.status !== 'closed',
        asTeacher: false,
    });

    // Detect when exam starts
    useEffect(() => {
        if (status?.session.status === 'active') {
            onExamStart();
        }
    }, [status?.session.status, onExamStart]);

    if (isLoading && !status) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-slate-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    const participantCount = status?.participantCount || 0;
    const duration = status?.session.duration || 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start">
            <div className="bg-white rounded-2xl shadow-2xl w-full p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-10 h-10 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">
                        {sessionTitle}
                    </h1>
                    <p className="text-slate-600">
                        Thời gian: {duration} phút
                    </p>
                </div>

                {/* Status */}
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <Loader2 className="w-6 h-6 animate-spin text-yellow-600" />
                        <h2 className="text-xl font-semibold text-yellow-800">
                            Đang chờ giáo viên bắt đầu...
                        </h2>
                    </div>
                    <p className="text-yellow-700 text-center">
                        Bài thi sẽ bắt đầu khi giáo viên nhấn nút "Bắt đầu"
                    </p>
                </div>

                {/* Participant Count */}
                <div className="bg-slate-50 rounded-xl p-6 mb-6">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Users className="w-6 h-6 text-slate-600" />
                        <h3 className="text-lg font-semibold text-slate-800">
                            Học sinh đã tham gia
                        </h3>
                    </div>
                    <div className="text-center">
                        <div className="text-5xl font-bold text-blue-600 mb-2">
                            {participantCount}
                        </div>
                        <p className="text-slate-600">học sinh</p>
                    </div>
                </div>

                {/* Animated Dots */}
                <div className="flex justify-center gap-2 mb-6">
                    <div className="w-3 h-3 bg-blue-400 rounded-full motion-safe:animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 bg-blue-400 rounded-full motion-safe:animate-pulse" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 bg-blue-400 rounded-full motion-safe:animate-pulse" style={{ animationDelay: '300ms' }}></div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">
                        📝 Lưu ý quan trọng:
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Không tắt trình duyệt hoặc chuyển tab</li>
                        <li>• Đảm bảo kết nối internet ổn định</li>
                        <li>• Chuẩn bị sẵn giấy nháp nếu cần</li>
                        <li>• Bài thi sẽ tự động bắt đầu khi giáo viên cho phép</li>
                    </ul>
                </div>

                {/* Status Badge */}
                <div className="mt-6 text-center">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                        {getStatusLabel(status?.session.status || 'waiting')}
                    </span>
                </div>
            </div>
            <WaitingRoomChatPanel
                messages={chat.messages}
                chatEnabled={chat.chatEnabled}
                isLoading={chat.isLoading}
                isSending={chat.isSending}
                currentUsername={studentSession?.username}
                onSendMessage={async (content) => {
                    await chat.sendMessage(content);
                }}
            />
            </div>
        </div>
    );
};
