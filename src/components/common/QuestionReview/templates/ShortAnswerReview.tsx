import React, { memo } from 'react';
import NewlineMathText from '../../NewlineMathText';

interface ShortAnswerReviewProps {
    question: any;
    studentAnswer: any;
    status: 'correct' | 'wrong' | 'skipped';
}

const ShortAnswerReview: React.FC<ShortAnswerReviewProps> = memo(({ question, studentAnswer, status }) => {
    const studentValue = typeof studentAnswer === 'object' && studentAnswer !== null
        ? JSON.stringify(studentAnswer)
        : (studentAnswer || '(Bỏ trống)');
    const correctValue = typeof question.correctAnswer === 'object' && question.correctAnswer !== null
        ? JSON.stringify(question.correctAnswer)
        : question.correctAnswer;

    return (
        <div className="short-answer-review-template">
            <div className={`answer-box ${status}`}>
                <div className="answer-row">
                    <span className="label">Câu trả lời của bạn:</span>
                    <span className="value">
                        <NewlineMathText content={studentValue} as="span" className="quiz-text-preserve-inline" />
                    </span>
                </div>

                {status !== 'correct' && (
                    <div className="answer-row correct-row">
                        <span className="label">Đáp án đúng:</span>
                        <span className="value">
                            <NewlineMathText content={correctValue} as="span" className="quiz-text-preserve-inline" />
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});

export default ShortAnswerReview;
