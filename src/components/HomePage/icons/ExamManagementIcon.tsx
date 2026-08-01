import React from 'react';

const ExamManagementIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <defs>
            <linearGradient id="exam-frame" x1="22" y1="18" x2="78" y2="88" gradientUnits="userSpaceOnUse">
                <stop stopColor="#93C5FD" />
                <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
            <linearGradient id="exam-pencil" x1="62" y1="74" x2="87" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1D4ED8" />
                <stop offset="1" stopColor="#60A5FA" />
            </linearGradient>
            <linearGradient id="exam-gold" x1="38" y1="13" x2="64" y2="31" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE68A" />
                <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
            <filter id="exam-shadow" x="7" y="7" width="90" height="92" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#1E3A8A" floodOpacity="0.18" />
            </filter>
        </defs>

        <g filter="url(#exam-shadow)">
            <rect x="20" y="20" width="58" height="67" rx="14" fill="url(#exam-frame)" />
            <rect x="24" y="24" width="50" height="59" rx="11" fill="#FFFFFF" />
            <rect x="36" y="13" width="28" height="18" rx="7" fill="url(#exam-gold)" />
            <circle cx="50" cy="18" r="3.5" fill="#FFF7D6" />

            <rect x="31" y="35" width="18" height="18" rx="6" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="2" />
            <path d="M36 44L40 48L46 39" stroke="#2563EB" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M55 39H67" stroke="#BFDBFE" strokeWidth="4" strokeLinecap="round" />
            <path d="M55 48H66" stroke="#DBEAFE" strokeWidth="4" strokeLinecap="round" />
            <circle cx="37" cy="62" r="3.2" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="2" />
            <path d="M45 62H63" stroke="#BFDBFE" strokeWidth="4" strokeLinecap="round" />
            <circle cx="37" cy="72" r="3.2" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="2" />
            <path d="M45 72H59" stroke="#DBEAFE" strokeWidth="4" strokeLinecap="round" />

            <g transform="rotate(-42 74 68)">
                <rect x="69" y="48" width="11" height="35" rx="5.5" fill="url(#exam-pencil)" />
                <rect x="69" y="48" width="11" height="8" rx="4" fill="#FACC15" />
                <path d="M69 83H80L74.5 92L69 83Z" fill="#FDE68A" />
                <path d="M72.5 87.2L74.5 92L76.5 87.2H72.5Z" fill="#1E3A8A" />
                <path d="M72 58V78" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" />
            </g>
        </g>
    </svg>
);

export default ExamManagementIcon;
