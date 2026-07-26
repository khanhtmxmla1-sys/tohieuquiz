import React, { memo } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import MathContent from '../MathContent';

interface MatchingReviewProps {
    question: any;
    studentAnswer: any;
    status: 'correct' | 'wrong' | 'skipped';
}

const toText = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
        return String(value.text ?? value.content ?? value.label ?? value.value ?? value.id ?? '').trim();
    }
    return String(value);
};

const normalize = (value: any): string => toText(value).replace(/\s+/g, ' ').trim();

const MatchingReview: React.FC<MatchingReviewProps> = memo(({ question, studentAnswer }) => {
    const pairs = question.pairs || [];
    const response = (typeof studentAnswer === 'object' && studentAnswer !== null) ? studentAnswer : {};

    let correctAnswer = question.correctAnswer || {};
    if (typeof correctAnswer === 'string') {
        try {
            correctAnswer = JSON.parse(correctAnswer);
        } catch {
            // Keep original value if parsing fails.
        }
    }

    // New DB format: question.pairs = [{left, right}]
    if (pairs.length > 0) {
        return (
            <div className="matching-review-template">
                <div className="pairs-list">
                    {pairs.map((pair: any, idx: number) => {
                        const leftText = toText(typeof pair === 'string' ? pair : (pair.left ?? pair.text ?? `Item ${idx + 1}`));
                        const correctRightText = toText(typeof pair === 'string' ? '' : (pair.right ?? pair.match ?? ''));

                        const pairKey = String(pair?.id ?? `pair-${idx}`);
                        const rawStudentRight = response[pairKey] ?? response[leftText] ?? response[String(idx)] ?? '';

                        // Some payloads store right-side by id, not text.
                        let studentRightText = toText(rawStudentRight);
                        if (!studentRightText && rawStudentRight !== 0) {
                            studentRightText = '';
                        }

                        const mappedCorrect = toText(
                            (typeof correctAnswer === 'object' && correctAnswer !== null)
                                ? (correctAnswer[pairKey] ?? correctAnswer[leftText] ?? correctAnswer[String(idx)] ?? '')
                                : correctAnswer
                        );

                        const expectedRight = correctRightText || mappedCorrect;
                        const isCorrect = normalize(studentRightText) === normalize(expectedRight);

                        return (
                            <div key={pairKey} className={`pair-item ${isCorrect ? 'correct' : 'wrong'}`}>
                                <div className="pair-side left">
                                    <MathContent content={leftText} />
                                </div>
                                <div className="pair-connector">→</div>
                                <div className="pair-side right student">
                                    <div className={`pair-answer inline-flex items-center gap-1 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                        {isCorrect ? (
                                            <CheckCircle className="w-4 h-4 shrink-0" />
                                        ) : (
                                            <XCircle className="w-4 h-4 shrink-0" />
                                        )}
                                        <MathContent content={studentRightText || '(Chưa nối)'} className="inline-block" />
                                    </div>
                                    {!isCorrect && expectedRight && (
                                        <div className="correct-hint inline-flex items-center gap-1">
                                            <span>(Đ.án:</span>
                                            <MathContent content={expectedRight} className="inline-block" />
                                            <span>)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Legacy format: leftItems/rightItems + mapping ids
    const leftItems = question.leftItems || [];
    const rightItems = question.rightItems || [];

    if (leftItems.length > 0) {
        const pairsList = leftItems.map((left: any) => {
            const studentRightId = response[left.id];
            const correctRightId = correctAnswer[left.id];
            const studentRight = rightItems.find((r: any) => r.id === studentRightId);
            const correctRight = rightItems.find((r: any) => r.id === correctRightId);
            return { left, studentRight, correctRight, isCorrect: studentRightId === correctRightId };
        });

        return (
            <div className="matching-review-template">
                <div className="pairs-list">
                    {pairsList.map((pair: any, idx: number) => (
                        <div key={idx} className={`pair-item ${pair.isCorrect ? 'correct' : 'wrong'}`}>
                            <div className="pair-side left">
                                <MathContent content={pair.left.text} />
                            </div>
                            <div className="pair-connector">→</div>
                            <div className="pair-side right student">
                                <MathContent content={pair.studentRight?.text || '(Chưa nối)'} />
                                {!pair.isCorrect && pair.correctRight && (
                                    <div className="correct-hint inline-flex items-center gap-1">
                                        <span>(Đ.án:</span>
                                        <MathContent content={pair.correctRight.text} className="inline-block" />
                                        <span>)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="matching-review-template">
            <div className="no-data">(Không có dữ liệu ghép nối)</div>
        </div>
    );
});

export default MatchingReview;
