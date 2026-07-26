import React from 'react';

interface LoadingSpinnerProps {
    text?: string;
    fullScreen?: boolean;
}

/**
 * LoadingSpinner - Component hiển thị khi đang tải lazy components
 * Sử dụng với React.Suspense
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    text = 'Đang tải...',
    fullScreen = true
}) => {
    const containerClass = fullScreen
        ? 'min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50'
        : 'flex flex-col items-center justify-center p-8';

    return (
        <div className={containerClass}>
            {/* Animated Spinner */}
            <div className="relative mb-4">
                <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            </div>

            {/* Loading Text */}
            <p className="text-gray-600 font-medium animate-pulse">{text}</p>

            {/* Subtext */}
            <p className="text-gray-400 text-sm mt-1">Vui lòng đợi trong giây lát</p>
        </div>
    );
};

export default LoadingSpinner;
