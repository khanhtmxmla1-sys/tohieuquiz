import React, { memo } from 'react';

interface UnderlineReviewProps {
    question: any;
    studentAnswer: any; // Array of indices [0, 5, 12] or object {"0": true}
    status: 'correct' | 'wrong' | 'skipped';
}

/**
 * UnderlineReview: Hiển thị gạch chân các từ đúng/sai
 */
const UnderlineReview: React.FC<UnderlineReviewProps> = memo(({ question, studentAnswer, status }) => {
    const words = question.words || [];
    const correctAnswer = question.correctAnswer || [];

    // Normalize correct indices
    let correctIndices: number[] = [];
    if (Array.isArray(correctAnswer)) {
        correctIndices = correctAnswer.map(v => Number(v));
    } else if (typeof correctAnswer === 'object' && correctAnswer !== null) {
        correctIndices = Object.keys(correctAnswer).filter(k => correctAnswer[k]).map(k => Number(k));
    }

    // Normalize student indices
    let studentIndices: number[] = [];
    if (Array.isArray(studentAnswer)) {
        studentIndices = studentAnswer.map(v => Number(v));
    } else if (typeof studentAnswer === 'object' && studentAnswer !== null) {
        studentIndices = Object.keys(studentAnswer).filter(k => studentAnswer[k]).map(k => Number(k));
    }

    return (
        <div className="underline-review-template">
            <div className="words-container">
                {words.map((word: string, idx: number) => {
                    const isSelectedByStudent = studentIndices.includes(idx);
                    const isActuallyCorrect = correctIndices.includes(idx);

                    let wordClass = "word-item";
                    if (isSelectedByStudent) wordClass += " student-selected";
                    if (isActuallyCorrect) wordClass += " correct-word";

                    // Highlight mismatch
                    if (isSelectedByStudent && !isActuallyCorrect) wordClass += " error-underline";
                    if (!isSelectedByStudent && isActuallyCorrect) wordClass += " missed-underline";

                    return (
                        <span key={idx} className={wordClass}>
                            {typeof word === 'object' ? JSON.stringify(word) : word}
                            {isActuallyCorrect && !isSelectedByStudent && <span className="missed-marker">^</span>}
                        </span>
                    );
                })}
            </div>
            <div className="underline-legend small mt-2">
                <span className="legend-item student">Gạch chân của bé</span>
                <span className="legend-item correct">Đáp án đúng</span>
            </div>
        </div>
    );
});

export default UnderlineReview;
