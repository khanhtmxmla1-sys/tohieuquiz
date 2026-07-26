import React from 'react';

interface AccessCodeFormProps {
    quizTitle: string;
    enteredCode: string;
    codeError: string;
    onCodeChange: (code: string) => void;
    onVerify: () => void;
    onExit: () => void;
}

/**
 * Form for entering quiz access code
 * Displayed when quiz requires access code verification
 */
const AccessCodeForm: React.FC<AccessCodeFormProps> = ({
    quizTitle,
    enteredCode,
    codeError,
    onCodeChange,
    onVerify,
    onExit
}) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onVerify();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-orange-100 p-4 relative overflow-hidden">
            {/* Background Decorations */}
            <span className="student-bg-decoration top-10 left-10 student-animate-wiggle">🔐</span>
            <span className="student-bg-decoration bottom-20 right-10 student-animate-float">🎯</span>
            <span className="student-bg-decoration top-1/4 right-16">🔑</span>
            <span className="student-bg-decoration bottom-1/3 left-16">✨</span>

            <div className="max-w-md w-full student-card student-animate-pop relative z-10">
                {/* Hero Header - Purple Theme */}
                <div className="student-hero rounded-t-[1.5rem]" style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)' }}>
                    <div className="student-hero-icon student-animate-wiggle">🔐</div>
                    <h2 className="student-hero-title">{quizTitle}</h2>
                    <p className="student-hero-subtitle">Bài kiểm tra này yêu cầu mã truy cập</p>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-5">
                    {/* Code Input */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                            <span>🎫</span> Nhập mã làm bài
                        </label>
                        <input
                            type="text"
                            value={enteredCode}
                            onChange={e => onCodeChange(e.target.value.toUpperCase())}
                            onKeyDown={handleKeyDown}
                            placeholder="ABC123"
                            maxLength={6}
                            className="student-code-input"
                            autoFocus
                        />
                        {codeError && (
                            <div className="mt-3 flex items-center justify-center gap-2 text-red-500 font-semibold animate-shake">
                                <span>❌</span>
                                <span>{codeError}</span>
                            </div>
                        )}
                    </div>

                    {/* Verify Button */}
                    <button
                        onClick={onVerify}
                        disabled={enteredCode.length < 1}
                        className="w-full student-btn student-btn-primary text-lg"
                        style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)', boxShadow: '0 4px 0 #6d28d9, 0 6px 20px rgba(139, 92, 246, 0.4)' }}
                    >
                        <span>✓</span>
                        <span>Xác nhận mã</span>
                    </button>

                    {/* Back Button */}
                    <button
                        onClick={onExit}
                        className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                    >
                        <span>←</span> Quay lại trang chủ
                    </button>

                    {/* Help Text */}
                    <p className="text-xs text-gray-400 text-center pt-2 flex items-center justify-center gap-1">
                        <span>💡</span>
                        Mã làm bài được cô/thầy giáo cung cấp trước khi kiểm tra
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AccessCodeForm;
