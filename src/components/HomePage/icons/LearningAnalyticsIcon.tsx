import React from 'react';

const LearningAnalyticsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <defs>
            <linearGradient id="analytics-panel" x1="18" y1="20" x2="78" y2="86" gradientUnits="userSpaceOnUse">
                <stop stopColor="#DBEAFE" />
                <stop offset="1" stopColor="#60A5FA" />
            </linearGradient>
            <linearGradient id="analytics-bar" x1="50" y1="43" x2="50" y2="76" gradientUnits="userSpaceOnUse">
                <stop stopColor="#60A5FA" />
                <stop offset="1" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id="analytics-gold" x1="64" y1="21" x2="87" y2="44" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE68A" />
                <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="analytics-shadow" x="8" y="10" width="89" height="86" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#1E3A8A" floodOpacity="0.18" />
            </filter>
        </defs>

        <g filter="url(#analytics-shadow)">
            <rect x="15" y="23" width="68" height="62" rx="16" fill="url(#analytics-panel)" />
            <rect x="20" y="28" width="58" height="52" rx="12" fill="#FFFFFF" fillOpacity="0.94" />

            <rect x="28" y="60" width="9" height="14" rx="3" fill="#BFDBFE" />
            <rect x="40" y="54" width="9" height="20" rx="3" fill="#93C5FD" />
            <rect x="52" y="47" width="9" height="27" rx="3" fill="#60A5FA" />
            <rect x="64" y="39" width="9" height="35" rx="3" fill="url(#analytics-bar)" />
            <path d="M28 51C38 48 44 43 50 41C58 38 62 33 69 29" stroke="#FACC15" strokeWidth="4" strokeLinecap="round" />
            <path d="M64 28L72 27L69 35" stroke="#FACC15" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

            <circle cx="77" cy="28" r="13" fill="url(#analytics-gold)" />
            <path d="M77 20.7L79.3 25.2L84.3 25.9L80.7 29.4L81.5 34.3L77 32L72.5 34.3L73.3 29.4L69.7 25.9L74.7 25.2L77 20.7Z" fill="#FFF7D6" />
            <circle cx="85" cy="39" r="8" fill="#2563EB" />
            <path d="M81.5 39L84.2 41.8L89 36.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
    </svg>
);

export default LearningAnalyticsIcon;
