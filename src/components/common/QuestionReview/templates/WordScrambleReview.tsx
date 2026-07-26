import React, { memo } from 'react';
import NewlineMathText from '../../NewlineMathText';

interface WordScrambleReviewProps {
    question: any;
    studentAnswer: any;
    status: 'correct' | 'wrong' | 'skipped';
}

const WordScrambleReview: React.FC<WordScrambleReviewProps> = memo(({ question, studentAnswer, status }) => {
    const letters = question.letters || [];
    const studentIdxs = Array.isArray(studentAnswer) ? studentAnswer : [];

    const safeRender = (val: any) => {
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val;
    };

    const studentWord = studentIdxs.map((idx: number) => {
        const char = letters[idx];
        return typeof char === 'object' ? '?' : (char || '?');
    }).join('');

    return (
        <div className="word-scramble-review-template">
            <div className="letters-pool">
                <span className="label">Chữ cái đã cho:</span>
                <div className="letters">
                    {letters.map((l: string, i: number) => (
                        <span key={i} className="letter-tile">{l}</span>
                    ))}
                </div>
            </div>

            <div className={`result-box ${status}`}>
                <div className="row">
                    <span className="label">Bạn đã ghép:</span>
                    <span className="value">
                        <NewlineMathText content={studentWord || '(Chưa ghép)'} as="span" className="quiz-text-preserve-inline" />
                    </span>
                </div>
                {status !== 'correct' && (
                    <div className="row correct-row">
                        <span className="label">Đáp án đúng:</span>
                        <span className="value">
                            <NewlineMathText content={safeRender(question.correctWord)} as="span" className="quiz-text-preserve-inline" />
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});

export default WordScrambleReview;
