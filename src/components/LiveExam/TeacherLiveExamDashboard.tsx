/**
 * Teacher dashboard for managing live exam sessions.
 */

import React, { useMemo, useState } from 'react';
import {
    Archive,
    BarChart3,
    CalendarClock,
    Clock,
    Filter,
    Loader2,
    Plus,
    RefreshCw,
    Users,
} from 'lucide-react';
import { showConfirm } from '../../utils/toast';
import { CreateLiveExamModal } from './CreateLiveExamModal';
import { formatAccessCode, getStatusColor, getStatusLabel } from '../../services/liveExamService';
import type { LiveExamSession, LiveExamStatus, WaitingRoomChatMessage } from '../../types/liveExam.types';
import WaitingRoomChatTeacherCard from './WaitingRoomChatTeacherCard';

interface TeacherLiveExamDashboardProps {
    sessions: LiveExamSession[];
    availableQuizzes: Array<{ id: string; title: string; questionCount: number }>;
    availableClasses: Array<{ id: string; name: string }>;
    isLoading?: boolean;
    onCreateSession: (sessionId: string, accessCode: string) => void;
    onSelectSession: (session: LiveExamSession) => void;
    onDeleteSession?: (session: LiveExamSession) => Promise<void>;
    onRefresh?: () => void;
    waitingRoomChat?: {
        sessionId: string;
        enabled: boolean;
        isLoading?: boolean;
        isSending?: boolean;
        messages: WaitingRoomChatMessage[];
        onSendAnnouncement: (content: string) => Promise<void>;
        onToggleChat: (enabled: boolean) => Promise<void>;
        onHideMessage: (messageId: string) => Promise<void>;
    } | null;
}

type LiveExamFilter = 'all' | 'scheduled' | 'waiting' | 'active' | 'scoring' | 'closed';

const filters: Array<{ value: LiveExamFilter; label: string }> = [
    { value: 'all', label: 'Tất cả' },
    { value: 'scheduled', label: 'Đã lên lịch' },
    { value: 'waiting', label: 'Đang chờ' },
    { value: 'active', label: 'Đang thi' },
    { value: 'scoring', label: 'Đang chấm' },
    { value: 'closed', label: 'Đã kết thúc' },
];

const primaryActionLabel: Record<LiveExamStatus, string> = {
    scheduled: 'Mở phòng chờ',
    waiting: 'Vào phòng chờ',
    active: 'Giám sát',
    scoring: 'Xem tiến trình chấm',
    closed: 'Xem kết quả',
};

const formatDateTime = (value?: string) => {
    if (!value) return 'Chưa bắt đầu';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

export const TeacherLiveExamDashboard: React.FC<TeacherLiveExamDashboardProps> = ({
    sessions,
    availableQuizzes,
    availableClasses,
    isLoading = false,
    onCreateSession,
    onSelectSession,
    onDeleteSession,
    onRefresh,
    waitingRoomChat = null,
}) => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState<LiveExamFilter>('all');

    const filteredSessions = useMemo(
        () => statusFilter === 'all' ? sessions : sessions.filter((session) => session.status === statusFilter),
        [sessions, statusFilter],
    );

    const statusCounts = useMemo(() => ({
        all: sessions.length,
        scheduled: sessions.filter((session) => session.status === 'scheduled').length,
        waiting: sessions.filter((session) => session.status === 'waiting').length,
        active: sessions.filter((session) => session.status === 'active').length,
        scoring: sessions.filter((session) => session.status === 'scoring').length,
        closed: sessions.filter((session) => session.status === 'closed').length,
    }), [sessions]);

    const statusBadgeClass = (status: string) => {
        const colorMap: Record<string, string> = {
            gray: 'bg-slate-100 text-slate-700',
            yellow: 'bg-yellow-100 text-yellow-800',
            green: 'bg-green-100 text-green-800',
            blue: 'bg-blue-100 text-blue-800',
            purple: 'bg-purple-100 text-blue-900',
        };
        return colorMap[getStatusColor(status)] || colorMap.gray;
    };

    const statCards = [
        { key: 'all', label: 'Tổng số phiên', value: statusCounts.all, className: 'bg-slate-50 text-slate-800' },
        { key: 'scheduled', label: 'Đã lên lịch', value: statusCounts.scheduled, className: 'bg-slate-100 text-slate-700' },
        { key: 'waiting', label: 'Đang chờ', value: statusCounts.waiting, className: 'bg-yellow-50 text-yellow-700' },
        { key: 'active', label: 'Đang thi', value: statusCounts.active, className: 'bg-green-50 text-green-700' },
        { key: 'scoring', label: 'Đang chấm', value: statusCounts.scoring, className: 'bg-blue-50 text-blue-700' },
        { key: 'closed', label: 'Đã kết thúc', value: statusCounts.closed, className: 'bg-purple-50 text-blue-800' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-3 sm:p-4 lg:p-6">
            <div className="mx-auto max-w-7xl">
                <section className="mb-6 rounded-2xl bg-white p-5 shadow-xl sm:p-6">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h1 className="mb-1 text-2xl font-bold text-slate-800 sm:text-3xl">Thi Trực Tiếp</h1>
                            <p className="text-slate-600">Quản lý phòng chờ, tiến độ làm bài và kết quả theo thời gian thực.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg hover:bg-blue-700"
                        >
                            <Plus size={20} />
                            Tạo phiên thi mới
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {statCards.map((card) => (
                            <div key={card.key} className={`rounded-xl p-4 ${card.className}`}>
                                <div className="text-2xl font-bold">{card.value}</div>
                                <div className="text-sm font-medium opacity-90">{card.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

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

                <section className="mb-6 rounded-xl bg-white p-4 shadow-lg">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                        <div className="flex items-center gap-2 font-semibold text-slate-700">
                            <Filter size={20} className="text-slate-500" />
                            Lọc trạng thái
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {filters.map((filter) => (
                                <button
                                    key={filter.value}
                                    type="button"
                                    onClick={() => setStatusFilter(filter.value)}
                                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                        statusFilter === filter.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                        {onRefresh && (
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={isLoading}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 xl:ml-auto"
                            >
                                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                                Làm mới
                            </button>
                        )}
                    </div>
                </section>

                {isLoading && sessions.length === 0 ? (
                    <div className="rounded-2xl bg-white p-12 text-center shadow-xl">
                        <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
                        <p className="text-slate-600">Đang tải danh sách phiên thi...</p>
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="rounded-2xl bg-white p-10 text-center shadow-xl">
                        <CalendarClock className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                        <h2 className="mb-2 text-xl font-bold text-slate-800">
                            {statusFilter === 'all' ? 'Chưa có phiên thi nào' : 'Không có phiên ở trạng thái này'}
                        </h2>
                        <p className="mb-6 text-slate-600">
                            {statusFilter === 'all' ? 'Tạo phiên đầu tiên và chọn đúng lớp học để bắt đầu.' : 'Hãy chọn một bộ lọc khác.'}
                        </p>
                        {statusFilter === 'all' && (
                            <button type="button" onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
                                <Plus size={20} />Tạo phiên thi mới
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {filteredSessions.map((session) => {
                            const canArchive = session.status === 'scheduled' || session.status === 'closed';
                            return (
                                <article key={session.id} className="flex min-h-[310px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-lg transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl">
                                    <div className="mb-4 flex items-start justify-between gap-3">
                                        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeClass(session.status)}`}>{getStatusLabel(session.status)}</span>
                                        {session.status === 'waiting' && session.accessCode && (
                                            <span className="rounded bg-blue-50 px-2 py-1 font-mono text-xs font-bold text-blue-700">{formatAccessCode(session.accessCode)}</span>
                                        )}
                                    </div>

                                    <h3 className="mb-2 line-clamp-2 text-lg font-bold text-slate-800">{session.title}</h3>
                                    <p className="mb-1 line-clamp-1 text-sm font-medium text-slate-600">Đề: {session.quizTitle || session.quizId}</p>
                                    <p className="mb-4 line-clamp-1 text-sm text-slate-500">Lớp: {session.className || 'Chưa xác định'}</p>

                                    <div className="mb-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                                        <div className="flex items-center gap-2"><Clock size={16} />{session.duration} phút</div>
                                        <div className="flex items-center gap-2"><Users size={16} />{session.participantCount ?? 0} học sinh</div>
                                        <div className="col-span-2 flex items-center gap-2"><CalendarClock size={16} />{session.startedAt ? `Bắt đầu ${formatDateTime(session.startedAt)}` : `Tạo ${formatDateTime(session.createdAt)}`}</div>
                                    </div>

                                    {session.status === 'closed' && (
                                        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                                            <div><span className="block text-slate-500">Đã nộp</span><strong className="text-slate-800">{session.submittedCount ?? 0}/{session.participantCount ?? 0}</strong></div>
                                            <div><span className="block text-slate-500">Điểm TB</span><strong className="text-slate-800">{session.averageScore ?? '—'}</strong></div>
                                        </div>
                                    )}

                                    <div className="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                                        <button
                                            type="button"
                                            onClick={() => onSelectSession(session)}
                                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
                                        >
                                            {session.status === 'closed' && <BarChart3 size={17} />}
                                            {primaryActionLabel[session.status]}
                                        </button>
                                        {onDeleteSession && canArchive && (
                                            <button
                                                type="button"
                                                onClick={() => showConfirm({
                                                    message: `Lưu trữ phiên thi "${session.title}"? Dữ liệu tham gia và kết quả vẫn được giữ lại.`,
                                                    confirmLabel: 'Lưu trữ',
                                                    destructive: false,
                                                    onConfirm: () => onDeleteSession(session),
                                                })}
                                                className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                            >
                                                <Archive size={16} />Lưu trữ
                                            </button>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            <CreateLiveExamModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreateSuccess={onCreateSession}
                availableQuizzes={availableQuizzes}
                availableClasses={availableClasses}
            />
        </div>
    );
};

export default TeacherLiveExamDashboard;
