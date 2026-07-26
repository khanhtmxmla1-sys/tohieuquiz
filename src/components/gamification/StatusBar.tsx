/**
 * StatusBar Component
 *
 * Cute & Cartoon style EXP bar, coin counter, and level badge.
 * Features: chunky EXP bar with gradient, 3D level badge, animated coin counter.
 */

import React, { useEffect, useState } from 'react';

interface StatusBarProps {
    level: number;
    exp: number;
    expToNext: number;
    coins: number;
    showLevelUp?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
    level,
    exp,
    expToNext,
    coins,
    showLevelUp = false,
}) => {
    const [animatedWidth, setAnimatedWidth] = useState(0);
    const [displayCoins, setDisplayCoins] = useState(coins);
    const percentage = expToNext > 0 ? Math.min((exp / expToNext) * 100, 100) : 0;

    // Animate EXP bar on mount/change
    useEffect(() => {
        const timer = setTimeout(() => setAnimatedWidth(percentage), 100);
        return () => clearTimeout(timer);
    }, [percentage]);

    // Animate coin counter
    useEffect(() => {
        if (displayCoins === coins) return;

        const diff = coins - displayCoins;
        const step = diff > 0 ? Math.max(1, Math.ceil(diff / 20)) : Math.min(-1, Math.floor(diff / 20));
        const timer = setInterval(() => {
            setDisplayCoins((prev) => {
                const next = prev + step;
                if ((step > 0 && next >= coins) || (step < 0 && next <= coins)) {
                    clearInterval(timer);
                    return coins;
                }
                return next;
            });
        }, 30);
        return () => clearInterval(timer);
    }, [coins]);

    return (
        <div className="w-full space-y-3" style={{ fontFamily: "'Quicksand', sans-serif" }}>
            {/* Level + Coins Row */}
            <div className="flex items-center justify-between">
                {/* Level Badge (3D Pushy) */}
                <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full font-extrabold text-sm text-white transition-all"
                    style={{
                        background: showLevelUp ? '#FFD900' : '#58CC02',
                        borderBottom: showLevelUp ? '3px solid #E5C400' : '3px solid #58A700',
                        color: showLevelUp ? '#4B4B4B' : '#FFFFFF',
                        animation: showLevelUp ? 'levelUpPulse 0.6s ease-out' : undefined,
                    }}
                >
                    <span className="text-base">⭐</span>
                    <span>Lv.{level}</span>
                    {showLevelUp && <span className="ml-0.5">🎉</span>}
                </div>

                {/* Coins Badge (Golden Pill) */}
                <div
                    className="flex items-center gap-2 px-4 py-2 rounded-full font-extrabold text-sm"
                    style={{
                        background: '#FFF5CC',
                        border: '2px solid #FFD900',
                        color: '#B8860B',
                    }}
                >
                    <span className="text-base">💰</span>
                    <span className="tabular-nums min-w-[40px] text-right">
                        {displayCoins}
                    </span>
                </div>
            </div>

            {/* EXP Bar (Chunky & Colorful) */}
            <div className="relative">
                {/* Track */}
                <div
                    className="h-7 rounded-full overflow-hidden relative"
                    style={{
                        background: '#E5E5E5',
                        border: '3px solid #FFFFFF',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.05)',
                    }}
                >
                    {/* Fill */}
                    <div
                        className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                        style={{
                            width: `${animatedWidth}%`,
                            background: 'linear-gradient(90deg, #FFC800, #FF9600)',
                            minWidth: animatedWidth > 0 ? '20px' : '0',
                        }}
                    >
                        {/* Shimmer effect */}
                        <div
                            className="absolute inset-0"
                            style={{
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                animation: 'shimmer 2s infinite',
                            }}
                        />
                        {/* Highlight stripe */}
                        <div
                            className="absolute top-0 left-0 right-0 h-1/3 rounded-full"
                            style={{
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.5), transparent)',
                            }}
                        />
                    </div>
                </div>

                {/* EXP text overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-extrabold drop-shadow-sm" style={{ color: animatedWidth > 40 ? '#FFFFFF' : '#4B4B4B', textShadow: animatedWidth > 40 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}>
                        {exp} / {expToNext} EXP
                    </span>
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                @keyframes levelUpPulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.3); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default StatusBar;
