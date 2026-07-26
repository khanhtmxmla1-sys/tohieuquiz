/**
 * Container for the teacher live-exam lifecycle.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Loader2, Play, Radio } from 'lucide-react';
import { TeacherLiveExamDashboard } from './TeacherLiveExamDashboard';
import { WaitingRoomTeacher } from './WaitingRoomTeacher';
import { ActiveExamMonitor } from './ActiveExamMonitor';
import { LiveExamAnalyticsDashboard } from './Analytics/LiveExamAnalyticsDashboard';
import * as liveExamService from '../../services/liveExamService';
import { useQuizStore } from '../../../stores/quizStore';
import { useAuthStore } from '../../../stores/authStore';
import { useClassStore } from '../../stores/useClassStore';
import { showError, showSuccess } from '../../utils/toast';
import type { LiveExamSession } from '../../types/liveExam.types';
import { useWaitingRoomChat } from '../../hooks/useWaitingRoomChat';
import { isQuizOwnedByCurrentTeacher } from './quizOwnership';

export const TeacherLiveExamDashboardContainer: React.FC = () => {
    const [sessions, setSessions] = useState<LiveExamSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<LiveExamSession | null>(null);
    const [isOpeningSession, setIsOpeningSession] = useState(false);
    const [scoringError, setScoringError] = useState('');

    const quizzes = useQuizStore((state) => state.quizzes);
    const username = useAuthStore((state) => state.username);
    const teacherName = useAuthStore((state) => state.teacherName);
    const isAdmin = useAuthStore((state) => state.isAdmin);
    const classes = useClassStore((state) => state.classes);
    const fetchClasses = useClassStore((state) => state.fetchClasses);

    const loadSessions = useCallback(async () => {
        if (!username) {
            setSessions([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            setSessions(await liveExamService.getTeacherSessions(username));
        } catch (error: any) {
            console.error('Failed to load live exam sessions:', error);
            if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
                setSessions([]);
            } else {
                showError('Không thể tải danh sách phiên thi');
            }
        } finally {
            setIsLoading(false);
        }
    }, [username]);

    useEffect(() => {
        void loadSessions();
    }, [loadSessions]);

    useEffect(() => {
        if (!username) return;
        void fetchClasses(isAdmin ? undefined : username);
    }, [fetchClasses, isAdmin, username]);

    useEffect(() => {
        if (!selectedSession || selectedSession.status !== 'scoring') return;
        let cancelled = false;
        setScoringError('');

        const poll = async () => {
            try {
                const updated = await liveExamService.getLiveExamSession(selectedSession.id);
                if (cancelled) return;
                setSelectedSession(updated);
                setSessions((current) => current.map((session) => session.id === updated.id ? updated : session));
            } catch (error: any) {
                if (!cancelled) setScoringError(error?.message || 'Không thể cập nhật trạng thái chấm điểm');
            }
        };

        void poll();
        const timer = window.setInterval(() => void poll(), 2000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [selectedSession?.id, selectedSession?.status]);

    const handleCreateSession = async (sessionId: string, accessCode: string) => {
        showSuccess(`Đã tạo phiên thi với mã: ${accessCode}`);
        await loadSessions();
        try {
            setSelectedSession(await liveExamService.getLiveExamSession(sessionId));
        } catch (error) {
            console.error('Failed to load created session:', error);
        }
    };

    const handleDeleteSession = async (session: LiveExamSession) => {
        try {
            await liveExamService.deleteLiveExamSession(session.id);
            setSessions((current) => current.filter((item) => item.id !== session.id));
            if (selectedSession?.id === session.id) setSelectedSession(null);
            showSuccess('Đã lưu trữ phiên thi');
        } catch (error: any) {
            console.error('Failed to archive session:', error);
            showError(error?.message || 'Không thể lưu trữ phiên thi');
        }
    };

    const handleBackToList = async () => {
        setSelectedSession(null);
        await loadSessions();
    };

    const updateSelectedSession = (updated: LiveExamSession) => {
        setSelectedSession(updated);
        setSessions((current) => current.map((session) => session.id === updated.id ? updated : session));
    };

    const handleOpenSession = async () => {
        if (!selectedSession) return;
        setIsOpeningSession(true);
        try {
            const updated = await liveExamService.openSession(selectedSession.id);
            updateSelectedSession(updated);
            showSuccess('Đã mở phòng chờ cho học sinh tham gia');
        } catch (error: any) {
            console.error('Failed to open session:', error);
            showError(error?.message || 'Không thể mở phòng chờ');
        } finally {
            setIsOpeningSession(false);
        }
    };

    const refreshSelectedSession = async (message: string) => {
        if (!selectedSession) return;
        const updated = await liveExamService.getLiveExamSession(selectedSession.id);
        updateSelectedSession(updated);
        showSuccess(message);
    };

    const availableQuizzes = useMemo(() => quizzes
        .filter((quiz) => isQuizOwnedByCurrentTeacher(quiz.createdBy, {
            username,
            teacherName,
            isAdmin,
        }))
        .map((quiz) => ({ id: quiz.id, title: quiz.title, questionCount: quiz.questions.length })),
    [isAdmin, quizzes, teacherName, username]);

    const availableClasses = useMemo(() => classes.map((classroom) => ({
        id: classroom.id,
        name: classroom.name,
    })), [classes]);

    const selectedQuiz = selectedSession
        ? quizzes.find((quiz) => quiz.id === selectedSession.quizId)
        : null;

    const waitingRoomChat = useWaitingRoomChat({
        sessionId: selectedSession?.id || '',
        enabled: selectedSession?.status === 'waiting',
        asTeacher: true,
    });

    if (selectedSession?.status === 'scheduled') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
                <div className="mx-auto max-w-5xl space-y-6">
                    <button type="button" onClick={handleBackToList} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-slate-700 shadow hover:shadow-md">
                        <ArrowLeft size={18} />Quay lại danh sách phiên thi
                    </button>
                    <div className="rounded-3xl bg-white p-8 shadow-xl">
                        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"><Radio size={16} />Phiên đã lên lịch</div>
                                <h1 className="mb-3 text-3xl font-bold text-slate-800">{selectedSession.title}</h1>
                                <div className="space-y-2 text-slate-600">
                                    <p>Thời gian làm bài: {selectedSession.duration} phút</p>
                                    <p>Đề thi: {selectedSession.quizTitle || selectedQuiz?.title || selectedSession.quizId}</p>
                                    <p>Lớp: {selectedSession.className || selectedSession.classId}</p>
                                    <p>Mã tham gia: <span className="font-mono font-bold text-blue-600">{liveExamService.formatAccessCode(selectedSession.accessCode)}</span></p>
                                </div>
                            </div>
                            <div className="md:w-72">
                                <button type="button" onClick={handleOpenSession} disabled={isOpeningSession} className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-lg font-bold text-white hover:bg-blue-700 disabled:bg-slate-300">
                                    {isOpeningSession ? <><Loader2 className="animate-spin" size={22} />Đang mở phòng chờ...</> : <><Play size={22} />Mở phòng chờ</>}
                                </button>
                                <p className="mt-3 text-sm text-slate-500">Học sinh chỉ có thể nhập mã sau khi phòng chờ được mở.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (selectedSession?.status === 'waiting') {
        return (
            <div>
                <div className="p-4 pb-0"><button type="button" onClick={handleBackToList} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-slate-700 shadow hover:shadow-md"><ArrowLeft size={18} />Quay lại danh sách phiên thi</button></div>
                <WaitingRoomTeacher
                    sessionId={selectedSession.id}
                    sessionTitle={selectedSession.title}
                    accessCode={selectedSession.accessCode}
                    duration={selectedSession.duration}
                    onExamStarted={() => refreshSelectedSession('Đã bắt đầu bài thi')}
                    waitingRoomChat={{
                        enabled: waitingRoomChat.chatEnabled,
                        isLoading: waitingRoomChat.isLoading,
                        isSending: waitingRoomChat.isSending,
                        messages: waitingRoomChat.messages,
                        onSendAnnouncement: async (content: string) => { await waitingRoomChat.sendMessage(content); },
                        onToggleChat: waitingRoomChat.toggleChat,
                        onHideMessage: waitingRoomChat.hideMessage,
                    }}
                />
            </div>
        );
    }

    if (selectedSession?.status === 'active') {
        if (!selectedSession.endsAt) {
            return (
                <div className="min-h-screen bg-red-50 p-6">
                    <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-xl">
                        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                        <h2 className="mb-2 text-xl font-bold text-slate-800">Phiên thi thiếu thời điểm kết thúc</h2>
                        <p className="mb-6 text-slate-600">Không thể mở màn giám sát an toàn. Hãy kết thúc phiên từ trang quản trị hoặc kiểm tra dữ liệu.</p>
                        <button type="button" onClick={handleBackToList} className="rounded-lg bg-slate-800 px-5 py-3 font-semibold text-white">Quay lại</button>
                    </div>
                </div>
            );
        }
        return (
            <div>
                <div className="p-4 pb-0"><button type="button" onClick={handleBackToList} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-slate-700 shadow hover:shadow-md"><ArrowLeft size={18} />Quay lại danh sách phiên thi</button></div>
                <ActiveExamMonitor
                    sessionId={selectedSession.id}
                    sessionTitle={selectedSession.title}
                    endsAt={selectedSession.endsAt}
                    totalQuestions={selectedQuiz?.questions?.length || 0}
                    onExamEnded={() => refreshSelectedSession('Bài thi đã kết thúc')}
                />
            </div>
        );
    }

    if (selectedSession?.status === 'scoring') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
                <div className="mx-auto max-w-2xl rounded-3xl bg-white p-10 text-center shadow-xl">
                    <Loader2 className="mx-auto mb-5 h-14 w-14 animate-spin text-blue-600" />
                    <h1 className="mb-2 text-2xl font-bold text-slate-800">Đang chấm điểm</h1>
                    <p className="mb-6 text-slate-600">Hệ thống đang chấm và xếp hạng phiên “{selectedSession.title}”. Màn hình tự cập nhật khi hoàn tất.</p>
                    {scoringError && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{scoringError}</div>}
                    <button type="button" onClick={handleBackToList} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200"><ArrowLeft size={18} />Quay lại danh sách</button>
                </div>
            </div>
        );
    }

    if (selectedSession?.status === 'closed') {
        return <LiveExamAnalyticsDashboard sessionId={selectedSession.id} onBack={handleBackToList} />;
    }

    return (
        <TeacherLiveExamDashboard
            sessions={sessions}
            availableQuizzes={availableQuizzes}
            availableClasses={availableClasses}
            isLoading={isLoading}
            onCreateSession={handleCreateSession}
            onSelectSession={setSelectedSession}
            onDeleteSession={handleDeleteSession}
            onRefresh={loadSessions}
            waitingRoomChat={null}
        />
    );
};

export default TeacherLiveExamDashboardContainer;
