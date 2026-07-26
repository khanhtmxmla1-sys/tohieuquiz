import React from 'react';

interface Props {
    score: number;
}

const ScoreBadge: React.FC<Props> = ({ score }) => {
    const getBadgeConfig = () => {
        if (score >= 9) {
            return {
                emoji: '🏆',
                text: 'Xuất sắc',
                bgColor: 'bg-gradient-to-r from-yellow-400 to-amber-500',
                textColor: 'text-amber-900',
                glow: 'shadow-lg shadow-yellow-500/50'
            };
        }
        if (score >= 8) {
            return {
                emoji: '🌟',
                text: 'Giỏi',
                bgColor: 'bg-gradient-to-r from-sky-400 to-indigo-500',
                textColor: 'text-white',
                glow: 'shadow-lg shadow-purple-500/50'
            };
        }
        if (score >= 7) {
            return {
                emoji: '👍',
                text: 'Khá',
                bgColor: 'bg-gradient-to-r from-blue-400 to-cyan-500',
                textColor: 'text-white',
                glow: 'shadow-lg shadow-blue-500/50'
            };
        }
        if (score >= 5) {
            return {
                emoji: '✨',
                text: 'Đạt',
                bgColor: 'bg-gradient-to-r from-emerald-400 to-green-500',
                textColor: 'text-white',
                glow: 'shadow-lg shadow-emerald-500/50'
            };
        }
        return {
            emoji: '💪',
            text: 'Cố gắng thêm',
            bgColor: 'bg-gradient-to-r from-orange-400 to-red-500',
            textColor: 'text-white',
            glow: 'shadow-lg shadow-orange-500/50'
        };
    };

    const config = getBadgeConfig();

    return (
        <div
            className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-full
        ${config.bgColor} ${config.textColor} ${config.glow}
        font-bold text-sm
        transform transition-all duration-300
        motion-safe:hover:-translate-y-0.5 hover:shadow-xl
        animate-gentle-float
      `}
        >
            <span className="text-xl">{config.emoji}</span>
            <span>{config.text}</span>

            <style>{`
        .animate-gentle-float {
          animation: gentleFloat 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-gentle-float { animation: none; }
        }
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
        </div>
    );
};

export default ScoreBadge;
