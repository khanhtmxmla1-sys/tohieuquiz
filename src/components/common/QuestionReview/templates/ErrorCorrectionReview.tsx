import React, { memo } from 'react';
import MathContent from '../MathContent';
import NewlineMathText from '../../NewlineMathText';

interface ErrorCorrectionReviewProps {
    question: any;
    studentAnswer: any; // Record<string, string> e.g. { "0": "Sửa lại thành X" }
    status: 'correct' | 'wrong' | 'skipped';
}

/**
 * ErrorCorrectionReview: Tìm lỗi sai và sửa lại
 */
const ErrorCorrectionReview: React.FC<ErrorCorrectionReviewProps> = memo(({ question, studentAnswer, status }) => {
    const originalSentence = question.questionText || question.text || question.passage || '';
    const studentResponse = (typeof studentAnswer === 'object' && studentAnswer !== null) ? studentAnswer : {};

    // Correct answer map
    let correctAnswers: Record<string, string> = {};
    if (typeof question.correctAnswer === 'object' && question.correctAnswer !== null) {
        correctAnswers = question.correctAnswer;
    } else if (question.correctWord) {
        // Handle single error case if wrongWord is also provided
        const errorKey = question.wrongWord || '0';
        correctAnswers[errorKey] = question.correctWord;
    }

    const safeRender = (val: any) => {
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return String(val || '');
    };

    const renderContent = () => {
        if (!originalSentence) return null;

        // Pattern for [errorWord]
        const parts = originalSentence.split(/(\[.*?\])/g);
        return parts.map((part: string, idx: number) => {
            if (part.startsWith('[') && part.endsWith(']')) {
                const errorId = part.slice(1, -1);
                const sAns = studentResponse[errorId] || studentResponse[String(idx)] || '...';
                const cAns = correctAnswers[errorId] || correctAnswers[String(idx)];
                const isItemCorrect = String(sAns).trim().toLowerCase() === String(cAns || '').trim().toLowerCase();

                return (
                    <span key={idx} className={`error-correction-item ${isItemCorrect ? 'correct' : 'wrong'}`}>
                        <span className="error-word">
                            <NewlineMathText content={errorId} as="span" className="quiz-text-preserve-inline" />
                        </span>
                        <div className="correction-info">
                            <span className="student-fix">
                                Bé sửa: <NewlineMathText content={safeRender(sAns)} as="span" className="quiz-text-preserve-inline" />
                            </span>
                            {!isItemCorrect && cAns && (
                                <span className="correct-fix">
                                    (Đúng: <NewlineMathText content={safeRender(cAns)} as="span" className="quiz-text-preserve-inline" />)
                                </span>
                            )}
                        </div>
                    </span>
                );
            }
            return <MathContent key={idx} content={part} />;
        });
    };

    return (
        <div className="error-correction-review-template">
            <div className="content-display">
                {renderContent() || (
                    <div className="simple-correction">
                        <span className="error-label">
                            Lỗi: <NewlineMathText content={question.wrongWord} as="span" className="quiz-text-preserve-inline" />
                        </span>
                        <span className="student-fix">
                            Bé sửa: <NewlineMathText content={safeRender(Object.values(studentResponse)[0] || studentAnswer)} as="span" className="quiz-text-preserve-inline" />
                        </span>
                        {question.correctWord && (
                            <span className="correct-fix">
                                (Đúng: <NewlineMathText content={question.correctWord} as="span" className="quiz-text-preserve-inline" />)
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

export default ErrorCorrectionReview;
