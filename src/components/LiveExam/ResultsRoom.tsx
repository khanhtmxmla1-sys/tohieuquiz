/**
 * Results Room Component
 * 
 * Shows student results after exam completion.
 * Displays score, rank, rewards, and leaderboard.
 */

import React, { useEffect, useState } from 'react';
import { Trophy, Star, Award, TrendingUp, Loader2 } from 'lucide-react';
import { getResults } from '../../services/liveExamService';
import type { LiveExamResultsResponse } from '../../types/liveExam.types';

interface ResultsRoomProps {
    sessionId: string;
    sessionTitle: string;
}

export const ResultsRoom: React.FC<ResultsRoomProps> = ({
    sessionId,
    sessionTitle,
}) => {
    const [results, setResults] = useState<LiveExamResultsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadResults();
    }, [sessionId]);

    const loadResults = async () => {
        try {
            const data = await getResults(sessionId);
            setResults(data);
        } catch (err: any) {
            setError(err.message || 'Không thể tải kết quả');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-100 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-700 mx-auto mb-4" />
                    <p className="text-slate-600">Đang tải kết quả...</p>
                </div>
            </div>
        );
    }

    if (error || !results) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">❌</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Lỗi</h2>
                    <p className="text-slate-600">{error || 'Không thể tải kết quả'}</p>
                </div>
            </div>
        );
    }

    const { participant, leaderboard } = results;
    const leaderboardVisible = results.leaderboardVisible !== false;
    const isTopThree = leaderboardVisible && participant.rank > 0 && participant.rank <= 3;

    // Medal colors
    const getMedalColor = (rank: number) => {
        if (rank === 1) return 'text-yellow-500';
        if (rank === 2) return 'text-gray-400';
        if (rank === 3) return 'text-orange-600';
        return 'text-slate-400';
    };

    const getRankBadge = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-pink-100 p-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">
                        {sessionTitle}
                    </h1>
                    <p className="text-slate-600">Kết quả bài thi</p>
                </div>

                {/* My Result Card */}
                <div className={`bg-gradient-to-br ${
                    isTopThree 
                        ? 'from-yellow-50 to-orange-50 border-4 border-yellow-300' 
                        : 'from-white to-slate-50 border-2 border-slate-200'
                } rounded-2xl shadow-2xl p-8 mb-6`}>
                    {isTopThree && (
                        <div className="text-center mb-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-bold">
                                <Trophy size={20} />
                                Top {participant.rank}!
                            </div>
                        </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                        {/* Score */}
                        <div className="text-center">
                            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Star className="text-blue-600" size={40} />
                            </div>
                            <div className="text-4xl font-bold text-blue-600 mb-1">
                                {participant.score}
                            </div>
                            <p className="text-slate-600">Điểm số</p>
                            <div className="mt-2 text-sm text-slate-500">
                                {participant.correctCount} đúng • {participant.wrongCount} sai
                            </div>
                        </div>

                        {/* Rank */}
                        <div className="text-center">
                            <div className={`w-24 h-24 ${
                                isTopThree ? 'bg-yellow-100' : 'bg-purple-100'
                            } rounded-full flex items-center justify-center mx-auto mb-3`}>
                                <Trophy className={isTopThree ? 'text-yellow-600' : 'text-blue-700'} size={40} />
                            </div>
                            <div className={`text-5xl font-bold mb-1 ${getMedalColor(participant.rank)}`}>
                                {getRankBadge(participant.rank)}
                            </div>
                            <p className="text-slate-600">{leaderboardVisible ? 'Xếp hạng' : 'Kết quả riêng tư'}</p>
                            <div className="mt-2 text-sm text-slate-500">
                                {leaderboardVisible ? `Trong ${leaderboard.length} học sinh` : 'Giáo viên đã ẩn bảng xếp hạng'}
                            </div>
                        </div>

                        {/* Submitted Time */}
                        <div className="text-center">
                            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <TrendingUp className="text-green-600" size={40} />
                            </div>
                            <div className="text-lg font-bold text-green-600 mb-1">
                                {new Date(participant.submittedAt).toLocaleTimeString('vi-VN')}
                            </div>
                            <p className="text-slate-600">Nộp bài lúc</p>
                        </div>
                    </div>

                    {/* Rewards */}
                    {isTopThree && results.rewards && (
                        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <Award className="text-yellow-600" size={24} />
                                <h3 className="font-bold text-yellow-900">Phần thưởng</h3>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-yellow-600 mb-1">
                                    +{results.rewards.coins} 🪙
                                </div>
                                <p className="text-sm text-yellow-700">
                                    {participant.rank === 1 ? 'Nhất' : participant.rank === 2 ? 'Nhì' : 'Ba'} bảng vàng!
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Leaderboard */}
                {leaderboardVisible && (
                <div className="bg-white rounded-2xl shadow-xl p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <Trophy className="text-yellow-600" size={28} />
                        <h2 className="text-2xl font-bold text-slate-800">
                            Bảng Xếp Hạng
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {leaderboard.map((entry, index) => {
                            const isMe = entry.rank === participant.rank;
                            
                            return (
                                <div
                                    key={entry.username}
                                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                                        isMe
                                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                                            : index < 3
                                            ? 'bg-yellow-50 border-yellow-200'
                                            : 'bg-slate-50 border-slate-200'
                                    }`}
                                >
                                    {/* Rank */}
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                                        index === 0 ? 'bg-yellow-100 text-yellow-600' :
                                        index === 1 ? 'bg-gray-200 text-gray-600' :
                                        index === 2 ? 'bg-orange-100 text-orange-600' :
                                        'bg-slate-200 text-slate-600'
                                    }`}>
                                        {getRankBadge(entry.rank)}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1">
                                        <div className={`font-semibold ${isMe ? 'text-blue-900' : 'text-slate-800'}`}>
                                            {entry.username}
                                            {isMe && <span className="ml-2 text-sm text-blue-600">(Bạn)</span>}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            Xếp hạng #{entry.rank}
                                        </div>
                                    </div>

                                    {/* Score */}
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-slate-800">
                                            {entry.score}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            điểm
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* Footer Message */}
                <div className="mt-6 text-center">
                    <p className="text-slate-600">
                        {isTopThree 
                            ? '🎉 Chúc mừng! Bạn đã đạt thành tích xuất sắc!' 
                            : '💪 Cố gắng lên! Lần sau sẽ tốt hơn!'}
                    </p>
                </div>
            </div>
        </div>
    );
};
