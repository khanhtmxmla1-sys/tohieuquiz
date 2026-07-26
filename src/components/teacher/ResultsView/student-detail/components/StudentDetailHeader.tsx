import React from 'react';
import {
    BarChart3,
    ChevronRight,
    Clock,
    CloudDownload,
    Sparkles,
    User,
    XCircle,
} from 'lucide-react';
import type { StudentResult } from '../../../../../types';

export type StudentDetailTab = 'review' | 'analytics';

interface StudentDetailHeaderProps {
    result: StudentResult;
    activeTab: StudentDetailTab;
    hasAiInsight: boolean;
    onTabChange: (tab: StudentDetailTab) => void;
    onExportImage: () => void;
    onClose: () => void;
}

export const StudentDetailHeader: React.FC<StudentDetailHeaderProps> = (props) => (
    <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white p-4 md:p-6 relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex flex-col items-center justify-center border border-white/30 shadow-lg rotate-3">
                    <span className="text-2xl font-black leading-none">{props.result.score}</span>
                    <span className="text-[10px] text-blue-100 font-bold uppercase tracking-wider mt-1">Điểm số</span>
                </div>
                <div className="min-w-0">
                    <h2 className="text-xl font-black flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-200" />
                        <span className="truncate">{props.result.studentName}</span>
                    </h2>
                    <p className="text-blue-100/80 text-sm font-medium flex items-center gap-1">
                        <span>{props.result.studentClass}</span>
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        <span className="truncate">{props.result.quizTitle || 'Bài kiểm tra'}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg backdrop-blur-sm border border-white/5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-[11px] font-bold uppercase tracking-wide">
                                {props.result.correctCount}/{props.result.totalQuestions} Câu đúng
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg backdrop-blur-sm border border-white/5">
                            <Clock className="w-3 h-3 text-blue-200" />
                            <span className="text-[11px] font-bold uppercase tracking-wide">{props.result.timeTaken} Phút</span>
                        </div>
                        <span className="w-px h-4 bg-white/20 mx-1" />
                        {([
                            ['review', 'Xem lại bài', Sparkles],
                            ['analytics', 'Phân tích năng lực', BarChart3],
                        ] as const).map(([tab, label, Icon]) => (
                            <button
                                key={tab}
                                onClick={() => props.onTabChange(tab)}
                                className={`relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                                    props.activeTab === tab
                                        ? 'bg-white text-blue-700 border-white shadow-sm'
                                        : 'bg-white/10 text-blue-100 border-white/10 hover:bg-white/20'
                                }`}
                            >
                                <Icon className="w-3 h-3" /> {label}
                                {tab === 'analytics' && !props.hasAiInsight && props.activeTab !== 'analytics' && (
                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500" />
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-end gap-2">
                <button
                    onClick={props.onExportImage}
                    disabled={props.activeTab !== 'analytics'}
                    title={props.activeTab === 'analytics' ? 'Xuất báo cáo PNG' : 'Chuyển sang tab Phân tích năng lực để xuất báo cáo PNG'}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                    <CloudDownload className="w-4 h-4" /> Xuất PNG
                </button>
                <button onClick={props.onClose} aria-label="Đóng modal" className="p-3 bg-black/10 hover:bg-white/20 rounded-2xl transition-all active:scale-95">
                    <XCircle className="w-7 h-7" />
                </button>
            </div>
        </div>
    </div>
);
