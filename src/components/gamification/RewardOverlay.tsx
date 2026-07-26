import React, { useEffect, useMemo, useRef } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    Coins,
    Home,
    RefreshCw,
    Star,
    Trophy,
} from 'lucide-react';
import type { CompletionRewardData } from '../../features/quiz-player/hooks/useQuizPlayer';

interface RewardOverlayProps {
    data: CompletionRewardData;
    onViewResult: () => void;
    onExit: () => void;
    onRetryReward: () => void | Promise<void>;
}

const celebrationPositions = [
    ['12%', '15%'], ['25%', '8%'], ['42%', '17%'], ['58%', '9%'],
    ['76%', '16%'], ['88%', '10%'], ['18%', '72%'], ['34%', '82%'],
    ['52%', '76%'], ['68%', '84%'], ['82%', '70%'], ['92%', '80%'],
] as const;

const RewardOverlay: React.FC<RewardOverlayProps> = ({
    data,
    onViewResult,
    onExit,
    onRetryReward,
}) => {
    const primaryButtonRef = useRef<HTMLButtonElement>(null);
    const progressPercent = useMemo(() => {
        if (data.newExpToNext <= 0) return 0;
        return Math.min(100, Math.max(0, Math.round((data.newExp / data.newExpToNext) * 100)));
    }, [data.newExp, data.newExpToNext]);
    const shouldCelebrate = data.leveledUp || data.score >= 10;

    useEffect(() => {
        primaryButtonRef.current?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onViewResult();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onViewResult]);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
            {shouldCelebrate ? (
                <div
                    data-testid="completion-celebration"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
                >
                    {celebrationPositions.map(([left, top], index) => (
                        <span
                            key={`${left}-${top}`}
                            className="absolute h-2.5 w-2.5 animate-[completionSpark_900ms_ease-out_both] rounded-sm bg-amber-300"
                            style={{ left, top, animationDelay: `${index * 35}ms` }}
                        />
                    ))}
                </div>
            ) : null}

            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="completion-dialog-title"
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-[16px] border border-slate-200 bg-[#FFFDF7] font-['Be_Vietnam_Pro'] text-slate-800 shadow-[0_24px_70px_rgba(15,23,42,0.24)]"
            >
                <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] border border-emerald-200 bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-emerald-700">
                                {data.isPractice ? 'Bài luyện tập đã hoàn thành' : 'Kết quả đã được lưu'}
                            </p>
                            <h2 id="completion-dialog-title" className="mt-1 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
                                Chúc mừng em đã hoàn thành bài tập!
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                {data.isPractice
                                    ? 'Em có thể xem lại bài để biết phần nào cần luyện thêm.'
                                    : 'Kết quả của em đã được lưu.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[12px] border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Điểm số</p>
                            <p className="mt-1 text-3xl font-bold text-sky-700">{data.score}/10</p>
                        </div>
                        <div className="rounded-[12px] border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kết quả</p>
                            <p className="mt-2 text-lg font-bold text-slate-900">
                                {data.correctCount}/{data.totalQuestions} câu đúng
                            </p>
                        </div>
                    </div>

                    <div className="rounded-[12px] border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold text-slate-900">Phần thưởng</p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                    {data.isPractice
                                        ? 'Bài luyện tập không cộng EXP hoặc xu.'
                                        : data.status === 'error'
                                            ? 'Phần thưởng chưa đồng bộ được.'
                                            : data.status === 'syncing'
                                                ? 'Đang đồng bộ phần thưởng...'
                                                : 'Đã cộng vào tài khoản của em.'}
                                </p>
                            </div>
                            {data.status === 'error' && !data.isPractice ? (
                                <button
                                    type="button"
                                    onClick={onRetryReward}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                                >
                                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                    Thử đồng bộ lại
                                </button>
                            ) : null}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 rounded-[10px] bg-sky-50 px-3 py-3 text-sky-800">
                                <Star className="h-5 w-5" aria-hidden="true" />
                                <span className="font-bold">+{data.expEarned} EXP</span>
                            </div>
                            <div className="flex items-center gap-3 rounded-[10px] bg-amber-50 px-3 py-3 text-amber-800">
                                <Coins className="h-5 w-5" aria-hidden="true" />
                                <span className="font-bold">+{data.coinsEarned} xu</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[12px] border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-amber-600" aria-hidden="true" />
                                <span className="font-bold text-slate-900">Cấp {data.newLevel}</span>
                            </div>
                            <span className="text-sm font-semibold text-slate-500">
                                {data.newExp}/{data.newExpToNext} EXP
                            </span>
                        </div>
                        <div
                            role="progressbar"
                            aria-label={`Tiến độ Cấp ${data.newLevel}`}
                            aria-valuemin={0}
                            aria-valuemax={data.newExpToNext}
                            aria-valuenow={data.newExp}
                            className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
                        >
                            <div className="h-full rounded-full bg-sky-500 transition-[width] motion-reduce:transition-none" style={{ width: `${progressPercent}%` }} />
                        </div>
                        {data.leveledUp ? (
                            <p className="mt-3 text-sm font-bold text-emerald-700">Em đã lên Cấp {data.newLevel}!</p>
                        ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <button
                            ref={primaryButtonRef}
                            type="button"
                            onClick={onViewResult}
                            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                        >
                            Xem kết quả
                            <ArrowRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={onExit}
                            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                        >
                            <Home className="h-5 w-5" aria-hidden="true" />
                            Về trang chủ
                        </button>
                    </div>
                </div>
            </section>

            <style>{`
                @keyframes completionSpark {
                    0% { opacity: 0; transform: translateY(14px) scale(0.6) rotate(0deg); }
                    35% { opacity: 1; }
                    100% { opacity: 0; transform: translateY(-34px) scale(1) rotate(120deg); }
                }
            `}</style>
        </div>
    );
};

export default RewardOverlay;
