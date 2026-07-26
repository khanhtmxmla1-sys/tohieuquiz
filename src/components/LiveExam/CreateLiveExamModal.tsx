/**
 * Teacher creates a live exam session for one owned class and quiz.
 */

import React, { useState } from 'react';
import { X, Loader2, Plus, Copy, Check } from 'lucide-react';
import { createLiveExam, formatAccessCode } from '../../services/liveExamService';
import type { CreateLiveExamRequest, LiveExamSettings } from '../../types/liveExam.types';

interface CreateLiveExamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateSuccess: (sessionId: string, accessCode: string) => void;
    availableQuizzes: Array<{ id: string; title: string; questionCount: number }>;
    availableClasses: Array<{ id: string; name: string }>;
}

const defaultSettings = (): LiveExamSettings => ({
    randomizeAnswers: false,
    showLeaderboard: true,
    allowLateJoin: false,
});

export const CreateLiveExamModal: React.FC<CreateLiveExamModalProps> = ({
    isOpen,
    onClose,
    onCreateSuccess,
    availableQuizzes,
    availableClasses,
}) => {
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [title, setTitle] = useState('');
    const [quizId, setQuizId] = useState('');
    const [classId, setClassId] = useState('');
    const [duration, setDuration] = useState(30);
    const [settings, setSettings] = useState<LiveExamSettings>(defaultSettings);
    const [createdSession, setCreatedSession] = useState<{ id: string; accessCode: string } | null>(null);

    const handleCreate = async () => {
        const normalizedTitle = title.trim();
        if (!normalizedTitle || !quizId || !classId) {
            setError('Vui lòng nhập tên phiên, chọn đề thi và lớp học');
            return;
        }
        if (normalizedTitle.length < 3) {
            setError('Tên phiên thi phải có ít nhất 3 ký tự');
            return;
        }
        if (duration < 5 || duration > 180) {
            setError('Thời gian làm bài phải từ 5 đến 180 phút');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const data: CreateLiveExamRequest = {
                title: normalizedTitle,
                quizId,
                classId,
                duration,
                settings: { ...settings, randomizeAnswers: false },
            };
            const session = await createLiveExam(data);
            setCreatedSession({ id: session.id, accessCode: session.accessCode });
            setStep('success');
        } catch (err: any) {
            setError(err.message || 'Không thể tạo phiên thi');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyCode = async () => {
        if (!createdSession) return;
        try {
            await navigator.clipboard.writeText(createdSession.accessCode);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Không thể sao chép mã. Vui lòng sao chép thủ công.');
        }
    };

    const reset = () => {
        setStep('form');
        setTitle('');
        setQuizId('');
        setClassId('');
        setDuration(30);
        setSettings(defaultSettings());
        setCreatedSession(null);
        setCopied(false);
        setError('');
    };

    const handleClose = () => {
        if (isLoading) return;
        reset();
        onClose();
    };

    const handleDone = () => {
        if (createdSession) onCreateSuccess(createdSession.id, createdSession.accessCode);
        reset();
        onClose();
    };

    if (!isOpen) return null;
    const formValid = title.trim().length >= 3 && Boolean(quizId) && Boolean(classId) && duration >= 5 && duration <= 180;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="create-live-exam-title">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                {step === 'form' ? (
                    <div className="p-6">
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <h2 id="create-live-exam-title" className="text-2xl font-bold text-slate-800">Tạo Phiên Thi Trực Tiếp</h2>
                            <button type="button" onClick={handleClose} disabled={isLoading} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Đóng">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="live-exam-title">Tên phiên thi *</label>
                                <input id="live-exam-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Kiểm tra Toán giữa kỳ" maxLength={200} disabled={isLoading} className="w-full rounded-lg border-2 border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none" />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="live-exam-quiz">Đề thi *</label>
                                    <select id="live-exam-quiz" value={quizId} onChange={(e) => setQuizId(e.target.value)} disabled={isLoading || availableQuizzes.length === 0} className="w-full rounded-lg border-2 border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none">
                                        <option value="">-- Chọn đề thi --</option>
                                        {availableQuizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title} ({quiz.questionCount} câu)</option>)}
                                    </select>
                                    {availableQuizzes.length === 0 && <p className="mt-2 text-sm text-amber-700">Bạn chưa có đề thi phù hợp để tạo phiên.</p>}
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="live-exam-class">Lớp học *</label>
                                    <select id="live-exam-class" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={isLoading || availableClasses.length === 0} className="w-full rounded-lg border-2 border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none">
                                        <option value="">-- Chọn lớp học --</option>
                                        {availableClasses.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
                                    </select>
                                    {availableClasses.length === 0 && <p className="mt-2 text-sm text-amber-700">Cần tạo một lớp học trước khi mở phiên thi.</p>}
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="live-exam-duration">Thời gian (phút) *</label>
                                <input id="live-exam-duration" type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={5} max={180} disabled={isLoading} className="w-full rounded-lg border-2 border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none" />
                            </div>

                            <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                                <h3 className="font-semibold text-slate-800">Cài đặt</h3>
                                <label className="flex cursor-pointer items-center gap-3">
                                    <input type="checkbox" checked={settings.showLeaderboard} onChange={(e) => setSettings({ ...settings, showLeaderboard: e.target.checked })} disabled={isLoading} className="h-5 w-5" />
                                    <span className="text-sm text-slate-700">Hiển thị bảng xếp hạng sau khi kết thúc</span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-3">
                                    <input type="checkbox" checked={settings.allowLateJoin} onChange={(e) => setSettings({ ...settings, allowLateJoin: e.target.checked })} disabled={isLoading} className="h-5 w-5" />
                                    <span className="text-sm text-slate-700">Cho phép học sinh tham gia sau khi bài thi đã bắt đầu</span>
                                </label>
                                <p className="text-xs text-slate-500">Xáo trộn đáp án đang được tạm tắt để bảo đảm cùng một cấu trúc đề và kết quả chấm chính xác.</p>
                            </div>

                            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600" role="alert">{error}</div>}

                            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
                                <button type="button" onClick={handleClose} disabled={isLoading} className="flex-1 rounded-lg border-2 border-slate-300 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
                                <button type="button" onClick={handleCreate} disabled={isLoading || !formValid} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300">
                                    {isLoading ? <><Loader2 className="animate-spin" size={20} />Đang tạo...</> : <><Plus size={20} />Tạo phiên thi</>}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-center">
                        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100"><Check className="h-10 w-10 text-green-600" /></div>
                        <h2 className="mb-2 text-2xl font-bold text-slate-800">Tạo thành công</h2>
                        <p className="mb-6 text-slate-600">Mở phòng chờ trước khi chia sẻ mã cho học sinh.</p>
                        <div className="mb-6 rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
                            <p className="mb-2 text-sm text-blue-800">Mã tham gia</p>
                            <div className="mb-4 text-5xl font-bold tracking-widest text-blue-600">{createdSession && formatAccessCode(createdSession.accessCode)}</div>
                            <button type="button" onClick={handleCopyCode} className="mx-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                                {copied ? <><Check size={16} />Đã sao chép</> : <><Copy size={16} />Sao chép mã</>}
                            </button>
                        </div>
                        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
                        <button type="button" onClick={handleDone} className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700">Tiếp tục</button>
                    </div>
                )}
            </div>
        </div>
    );
};
