import React from 'react';
import { Clock } from 'lucide-react';
import { Quiz } from '../../types';
import { SCHOOL_NAME } from '../../config/constants';

interface StudentInfoFormProps {
    quiz: Quiz;
    studentName: string;
    studentClass: string;
    onNameChange: (name: string) => void;
    onClassChange: (className: string) => void;
    onStart: () => void;
    onExit: () => void;
}

/**
 * Form for entering student name and class before starting quiz
 */
const StudentInfoForm: React.FC<StudentInfoFormProps> = ({
    quiz,
    studentName,
    studentClass,
    onNameChange,
    onClassChange,
    onStart,
    onExit
}) => {
    const isValid = studentName.trim() && studentClass;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-blue-50 to-purple-100 p-4 relative overflow-hidden">
            {/* Background Decorations */}
            <span className="student-bg-decoration top-10 left-10 student-animate-float">🎨</span>
            <span className="student-bg-decoration bottom-20 right-10 student-animate-wiggle">🚀</span>
            <span className="student-bg-decoration top-1/3 right-20">⭐</span>
            <span className="student-bg-decoration bottom-1/3 left-20">📚</span>

            <div className="max-w-md w-full student-card student-animate-pop relative z-10">
                {/* Hero Header */}
                <div className="student-hero rounded-t-[1.5rem]">
                    <div className="student-hero-icon student-animate-float">🌍</div>
                    <h2 className="student-hero-title">{SCHOOL_NAME}</h2>
                    <p className="student-hero-subtitle">{quiz.title}</p>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-5">
                    {/* Student Name */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                            <span>👤</span> Họ và tên học sinh
                        </label>
                        <input
                            type="text"
                            value={studentName}
                            onChange={(e) => onNameChange(e.target.value)}
                            className="student-input"
                            placeholder="Ví dụ: Lò Văn A"
                            autoFocus
                        />
                    </div>

                    {/* Class Selection */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                            <span>🏫</span> Lớp
                        </label>
                        <select
                            value={studentClass}
                            onChange={(e) => onClassChange(e.target.value)}
                            className="student-input student-select"
                        >
                            <option value="">Chọn lớp của em...</option>
                            {Array.from({ length: 9 }, (_, i) => i + 1).map(num => (
                                <option key={`${quiz.classLevel}A${num}`} value={`${quiz.classLevel}A${num}`}>
                                    {quiz.classLevel}A{num}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Time Info Box */}
                    <div className="student-info-box">
                        <span className="student-info-icon">⏰</span>
                        <span className="student-info-text">
                            Thời gian làm bài: {quiz.timeLimit} phút
                        </span>
                    </div>

                    {/* Start Button */}
                    <button
                        onClick={onStart}
                        disabled={!isValid}
                        className="w-full student-btn student-btn-success text-lg"
                    >
                        <span>🚀</span>
                        <span>Bắt đầu làm bài!</span>
                    </button>

                    {/* Back Button */}
                    <button
                        onClick={onExit}
                        className="w-full text-gray-500 hover:text-gray-700 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <span>←</span> Quay lại trang chủ
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentInfoForm;
