/**
 * Join Live Exam Modal
 * 
 * Student enters 6-digit access code to join a live exam session.
 * Validates code format and calls API to join.
 */

import React, { useState } from 'react';
import { X, Loader2, LogIn } from 'lucide-react';
import { joinLiveExam, parseAccessCode, isValidAccessCode } from '../../services/liveExamService';

interface JoinLiveExamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onJoinSuccess: (session: {
        id: string;
        title: string;
        quizId: string;
        duration: number;
        status: string;
        startedAt?: string;
        endsAt?: string;
    }) => void;
}

export const JoinLiveExamModal: React.FC<JoinLiveExamModalProps> = ({
    isOpen,
    onClose,
    onJoinSuccess,
}) => {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (value.length <= 6) {
            setCode(value);
            setError(''); // Clear error on input
        }
    };

    const handleJoin = async () => {
        const parsedCode = parseAccessCode(code);

        if (!isValidAccessCode(parsedCode)) {
            setError('Mã không hợp lệ. Vui lòng nhập 6 ký tự (A-Z, 0-9).');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await joinLiveExam(parsedCode);
            onJoinSuccess(result.session);
            onClose();
            setCode(''); // Reset for next time
        } catch (err: any) {
            setError(err.message || 'Không thể tham gia. Vui lòng kiểm tra mã và thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && code.length === 6 && !isLoading) {
            handleJoin();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <LogIn className="text-blue-600" size={20} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">
                            Tham Gia Thi Trực Tiếp
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        disabled={isLoading}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Description */}
                <p className="text-slate-600 mb-6">
                    Nhập mã 6 ký tự mà giáo viên cung cấp để tham gia bài thi.
                </p>

                {/* Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Mã Thi
                    </label>
                    <input
                        type="text"
                        value={code}
                        onChange={handleCodeChange}
                        onKeyPress={handleKeyPress}
                        maxLength={6}
                        placeholder="ABC123"
                        className="w-full px-4 py-4 text-3xl text-center font-mono tracking-widest border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all"
                        disabled={isLoading}
                        autoFocus
                    />
                    <p className="text-xs text-slate-500 mt-2 text-center">
                        {code.length}/6 ký tự
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-2">
                        <span className="text-red-500 font-bold">⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleJoin}
                        disabled={isLoading || code.length !== 6}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Đang tham gia...
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Tham Gia
                            </>
                        )}
                    </button>
                </div>

                {/* Help Text */}
                <p className="text-xs text-slate-500 mt-4 text-center">
                    💡 Mẹo: Mã thi gồm 6 ký tự chữ và số (ví dụ: ABC123)
                </p>
            </div>
        </div>
    );
};
