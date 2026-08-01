import React from 'react';

const DailyPracticeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <defs>
            <linearGradient id="book-cover" x1="20" y1="36" x2="82" y2="81" gradientUnits="userSpaceOnUse">
                <stop stopColor="#93C5FD" />
                <stop offset="1" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id="book-gold" x1="61" y1="28" x2="72" y2="67" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE68A" />
                <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="book-shadow" x="7" y="12" width="88" height="82" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#1E3A8A" floodOpacity="0.18" />
            </filter>
        </defs>

        <g filter="url(#book-shadow)">
            <path d="M15 40C27 35 39 36 50 43V80C38 74 26 73 15 77V40Z" fill="url(#book-cover)" />
            <path d="M85 40C73 35 61 36 50 43V80C62 74 74 73 85 77V40Z" fill="url(#book-cover)" />
            <path d="M20 36C31 32 41 34 50 40V73C41 68 31 67 20 70V36Z" fill="#FFFFFF" />
            <path d="M80 36C69 32 59 34 50 40V73C59 68 69 67 80 70V36Z" fill="#FFFFFF" />
            <path d="M50 40V74" stroke="#BFDBFE" strokeWidth="2.5" />

            <path d="M27 46H42" stroke="#BFDBFE" strokeWidth="3" strokeLinecap="round" />
            <path d="M27 54H43" stroke="#DBEAFE" strokeWidth="3" strokeLinecap="round" />
            <path d="M27 62H39" stroke="#DBEAFE" strokeWidth="3" strokeLinecap="round" />
            <path d="M58 46H73" stroke="#BFDBFE" strokeWidth="3" strokeLinecap="round" />
            <path d="M57 54H74" stroke="#DBEAFE" strokeWidth="3" strokeLinecap="round" />
            <path d="M58 62H70" stroke="#DBEAFE" strokeWidth="3" strokeLinecap="round" />

            <path d="M64 31H72V57L68 53L64 57V31Z" fill="url(#book-gold)" />
            <path d="M75 20L77.8 26.2L84 29L77.8 31.8L75 38L72.2 31.8L66 29L72.2 26.2L75 20Z" fill="#FACC15" />
            <path d="M61 20L62.3 22.7L65 24L62.3 25.3L61 28L59.7 25.3L57 24L59.7 22.7L61 20Z" fill="#FDE68A" />
            <circle cx="84" cy="22" r="2" fill="#FFF7D6" />
        </g>
    </svg>
);

export default DailyPracticeIcon;
