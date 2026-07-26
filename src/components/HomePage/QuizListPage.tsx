import React from 'react';
import { Search, Clock, ChevronRight, ArrowLeft, Lock, ShieldCheck } from 'lucide-react';

// --- Fluent Emoji CDN Base ---
const FLUENT_CDN = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

import { SUBJECT_CONFIG } from './constants/dashboard.constants';

// --- Grade Config ---
const GRADE_LEVELS = [
    { id: 'all', label: 'Tất cả' },
    { id: '1', label: 'Lớp 1' },
    { id: '2', label: 'Lớp 2' },
    { id: '3', label: 'Lớp 3' },
    { id: '4', label: 'Lớp 4' },
    { id: '5', label: 'Lớp 5' },
];

// --- Types ---
interface Quiz {
    id: string;
    title: string;
    category?: string;
    timeLimit: number;
    questions: any[];
    requireCode?: boolean;
}

interface Props {
    category: string;
    quizzes: Quiz[];
    onBack: () => void;
    onQuizClick: (quiz: Quiz) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    selectedGrade: string | null;
    onGradeChange: (grade: string | null) => void;
    isLoggedIn?: boolean;
    onLoginClick?: () => void;
}

const QuizListPage: React.FC<Props> = ({
    category,
    quizzes,
    onBack,
    onQuizClick,
    searchTerm,
    onSearchChange,
    selectedGrade,
    onGradeChange,
    isLoggedIn,
    onLoginClick,
}) => {
    const categoryConfig = SUBJECT_CONFIG[category] || SUBJECT_CONFIG['class'];

    return (
        <div className="quiz-list-page">
            {/* Decorative Elements */}
            <img
                src={`${FLUENT_CDN}/Sun/3D/sun_3d.png`}
                alt="Hình minh họa mặt trời 3D"
                className="quiz-list-deco quiz-list-deco--sun"
            />
            <img
                src={`${FLUENT_CDN}/Cloud/3D/cloud_3d.png`}
                alt="Hình minh họa đám mây 3D"
                className="quiz-list-deco quiz-list-deco--cloud-1"
            />
            <img
                src={`${FLUENT_CDN}/Cloud/3D/cloud_3d.png`}
                alt="Hình minh họa đám mây 3D"
                className="quiz-list-deco quiz-list-deco--cloud-2"
            />

            {/* Main Container */}
            <div className="quiz-list-container">
                {/* Breadcrumb */}
                <div className="quiz-list-breadcrumb">
                    <button onClick={onBack} className="quiz-list-breadcrumb__home">
                        🏠 Home
                    </button>
                    <span className="quiz-list-breadcrumb__separator">&gt;</span>
                    <span className="quiz-list-breadcrumb__current">{categoryConfig.label}</span>
                </div>

                {/* Header */}
                <header className="quiz-list-header">
                    <div className="quiz-list-header__content">
                        <img
                            src={categoryConfig.icon}
                            alt={`Biểu tượng danh mục ${categoryConfig.label}`}
                            className="quiz-list-header__icon"
                        />
                        <div className="quiz-list-header__text">
                            <h1 className="quiz-list-header__title">{categoryConfig.title}</h1>
                            <p className="quiz-list-header__desc">{categoryConfig.desc}</p>
                        </div>
                    </div>

                </header>

                {/* Search Bar */}
                <div className="quiz-list-search">
                    <Search className="quiz-list-search__icon" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Tìm bài ôn tập..."
                        className="quiz-list-search__input"
                    />
                </div>

                {/* Grade Filter */}
                <div className="quiz-list-grade-filter">
                    {GRADE_LEVELS.map((grade) => (
                        <button
                            key={grade.id}
                            onClick={() => onGradeChange(grade.id === 'all' ? null : grade.id)}
                            className={`quiz-list-grade-pill ${(grade.id === 'all' && !selectedGrade) || selectedGrade === grade.id
                                ? 'quiz-list-grade-pill--active'
                                : ''
                                }`}
                            style={{
                                ...(((grade.id === 'all' && !selectedGrade) || selectedGrade === grade.id) && {
                                    background: categoryConfig.color,
                                    color: '#ffffff',
                                    borderColor: categoryConfig.color,
                                }),
                            }}
                        >
                            {grade.label}
                        </button>
                    ))}
                </div>

                {/* Quiz Grid */}
                <div className="quiz-list-grid">
                    {quizzes.length > 0 ? (
                        quizzes.map((quiz) => {
                            const quizCategory = quiz.category || 'class';
                            const quizConfig = SUBJECT_CONFIG[quizCategory] || categoryConfig;
                            const assignment = (quiz as any)._assignmentData;
                            const attempts = assignment?.attemptCount || 0;
                            const maxAttempts = assignment?.maxAttempts || 1;
                            const isCompleted = assignment && attempts >= maxAttempts;

                            return (
                                <button
                                    key={(quiz as any)._assignmentData?.id || quiz.id}
                                    onClick={() => !isCompleted && onQuizClick(quiz)}
                                    disabled={isCompleted}
                                    className={`quiz-list-card ${isCompleted ? 'quiz-list-card--completed' : ''}`}
                                    style={isCompleted ? { opacity: 0.8, cursor: 'default' } : {}}
                                >
                                    {/* Top Stripe */}
                                    <div
                                        className="quiz-list-card__stripe"
                                        style={{ background: isCompleted ? '#10b981' : quizConfig.color }}
                                    />

                                    {isCompleted && (
                                        <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-sm z-10">
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                    )}

                                    {/* Header with Icon */}
                                    <div className="quiz-list-card__header">
                                        <img
                                            src={quizConfig.icon}
                                            alt={`Biểu tượng môn ${quizConfig.title}`}
                                            className="quiz-list-card__icon"
                                        />
                                        {quiz.requireCode && !isCompleted && (
                                            <Lock className="quiz-list-card__lock" />
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h3 className="quiz-list-card__title">{quiz.title}</h3>

                                    {/* Metadata */}
                                    <div className="quiz-list-card__meta">
                                        <span>
                                            <Clock className="w-3.5 h-3.5" /> {quiz.timeLimit} phút
                                        </span>
                                        {isCompleted ? (
                                            <span className="text-emerald-600 font-bold">✨ Hoàn thành ({attempts}/{maxAttempts})</span>
                                        ) : (
                                            <span>📝 {quiz.questions.length} câu</span>
                                        )}
                                    </div>

                                    {/* CTA */}
                                    <div
                                        className="quiz-list-card__cta"
                                        style={{ color: isCompleted ? '#10b981' : quizConfig.color }}
                                    >
                                        {isCompleted ? 'Đã xong' : 'Bắt đầu'} <ChevronRight className="w-4 h-4" />
                                    </div>
                                </button>
                            );
                        })
                    ) : (
                        category === 'class' ? (
                            /* Loading skeleton while fetching from Google Sheets */
                            <div className="quiz-list-empty">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', width: '100%', maxWidth: '800px' }}>
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} style={{
                                            background: '#fff',
                                            borderRadius: '16px',
                                            padding: '1.5rem',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                            animation: 'pulse 1.5s ease-in-out infinite',
                                        }}>
                                            <div style={{ width: '100%', height: '8px', background: '#e0e0e0', borderRadius: '4px', marginBottom: '1rem' }} />
                                            <div style={{ width: '48px', height: '48px', background: '#f0f0f0', borderRadius: '12px', marginBottom: '0.75rem' }} />
                                            <div style={{ width: '80%', height: '14px', background: '#f0f0f0', borderRadius: '4px', marginBottom: '0.5rem' }} />
                                            <div style={{ width: '60%', height: '12px', background: '#f5f5f5', borderRadius: '4px' }} />
                                        </div>
                                    ))}
                                </div>
                                <p className="quiz-list-empty__text" style={{ marginTop: '1.5rem' }}>
                                    ⏳ Đang tải bài tập...
                                </p>
                                <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
                            </div>
                        ) : (
                            <div className="quiz-list-empty">
                                <img
                                    src={`${FLUENT_CDN}/See-no-evil%20monkey/3D/see-no-evil_monkey_3d.png`}
                                    alt="Khỉ che mắt 3D - Không có kết quả"
                                    className="quiz-list-empty__img"
                                />
                                <h3 className="quiz-list-empty__title">Không tìm thấy bài nào!</h3>
                                <p className="quiz-list-empty__text">Thử tìm từ khóa khác xem sao?</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizListPage;
