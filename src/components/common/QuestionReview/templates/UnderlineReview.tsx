import React, { memo } from 'react';
import type { AnswerReviewValue, QuestionAnswerReview } from '../../../../domain/quiz-scoring';
import { normalizeIndexList } from '../reviewNormalization';

interface UnderlineReviewProps {
    question: any;
    studentAnswer: any;
    status: 'correct' | 'wrong' | 'skipped';
    reviewDetail?: QuestionAnswerReview;
}

const ReviewLines: React.FC<{ title: string; value: AnswerReviewValue }> = ({ title, value }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-1 text-xs font-bold text-slate-500">{title}</div>
        {value.lines.map((line, index) => (
            <div key={`${line.label || 'value'}-${index}`} className="text-sm text-slate-700">
                {line.label ? <strong>{line.label}: </strong> : null}
                {line.value}
            </div>
        ))}
    </div>
);

const UnderlineReview: React.FC<UnderlineReviewProps> = memo(({ question, studentAnswer, reviewDetail }) => {
    const words = Array.isArray(question.words) ? question.words : [];
    const hasCorrectIndexSource = question.correctWordIndexes != null || question.correctAnswer != null;
    const correctSource = question.correctWordIndexes ?? question.correctAnswer;
    const correctIndices = normalizeIndexList(correctSource, words.length);
    const studentIndices = normalizeIndexList(studentAnswer, words.length);
    const canUseServerFallback = Boolean(
        reviewDetail
        && reviewDetail.correctAnswer.kind !== 'unsupported'
        && reviewDetail.correctAnswer.lines.length > 0
    );

    if (!hasCorrectIndexSource && canUseServerFallback) {
        return (
            <div className="underline-review-template grid gap-2 sm:grid-cols-2">
                <ReviewLines title="Câu trả lời của học sinh" value={reviewDetail!.studentAnswer} />
                <ReviewLines title="Đáp án đúng" value={reviewDetail!.correctAnswer} />
            </div>
        );
    }

    return (
        <div className="underline-review-template">
            <div className="words-container">
                {words.map((word: string, index: number) => {
                    const isSelectedByStudent = studentIndices.includes(index);
                    const isActuallyCorrect = hasCorrectIndexSource && correctIndices.includes(index);

                    let wordClass = 'word-item';
                    if (isSelectedByStudent) wordClass += ' student-selected';
                    if (isActuallyCorrect) wordClass += ' correct-word';
                    if (hasCorrectIndexSource && isSelectedByStudent && !isActuallyCorrect) wordClass += ' error-underline';
                    if (hasCorrectIndexSource && !isSelectedByStudent && isActuallyCorrect) wordClass += ' missed-underline';

                    return (
                        <span key={index} className={wordClass}>
                            {typeof word === 'object' ? JSON.stringify(word) : word}
                            {hasCorrectIndexSource && isActuallyCorrect && !isSelectedByStudent
                                ? <span className="missed-marker">^</span>
                                : null}
                        </span>
                    );
                })}
            </div>
            <div className="underline-legend small mt-2">
                <span className="legend-item student">Gạch chân của bé</span>
                {hasCorrectIndexSource
                    ? <span className="legend-item correct">Đáp án đúng</span>
                    : <span className="text-slate-500">Chưa có dữ liệu đáp án</span>}
            </div>
        </div>
    );
});

export default UnderlineReview;
