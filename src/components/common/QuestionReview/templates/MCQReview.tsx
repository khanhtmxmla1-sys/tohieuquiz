import React, { memo } from 'react';
import MathContent from '../MathContent';
import { normalizeMCQ } from '../../../../utils/question/scoring.util';

interface MCQReviewProps {
    question: any;
    studentAnswer: any;
    status: 'correct' | 'wrong' | 'skipped';
}

const MCQReview: React.FC<MCQReviewProps> = memo(({ question, studentAnswer, status }) => {
    const options = question.options || [];

    return (
        <div className="mcq-review-template">
            <div className="options-grid">
                {options.map((option: any, idx: number) => {
                    const label = String.fromCharCode(65 + idx); // A, B, C, D

                    // Normalize labels for robust comparison in UI
                    const normalizedStudentAnswer = normalizeMCQ(studentAnswer);
                    const normalizedCorrectAnswer = normalizeMCQ(question.correctAnswer);
                    const normalizedLabel = normalizeMCQ(label);

                    const isStudentChoice = !!normalizedStudentAnswer && (normalizedStudentAnswer === normalizedLabel || normalizedStudentAnswer === normalizeMCQ(option));
                    const isCorrectOption = !!normalizedCorrectAnswer && (normalizedCorrectAnswer === normalizedLabel || normalizedCorrectAnswer === normalizeMCQ(option));

                    let itemClass = "option-item";
                    if (isStudentChoice) itemClass += " student-choice";
                    if (isCorrectOption) itemClass += " correct-option";

                    return (
                        <div key={idx} className={itemClass}>
                            <span className="option-label">{label}.</span>
                            <MathContent content={option} className="option-text" />
                            {isStudentChoice && <span className="choice-indicator">(Bạn chọn)</span>}
                            {isCorrectOption && <span className="correct-indicator">✓ Đáp án đúng</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default MCQReview;
