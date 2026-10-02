import React, { memo } from 'react';
import type { AnswerReviewValue, QuestionAnswerReview } from '../../../../domain/quiz-scoring';
import {
    UnderlineSentence,
    type UnderlineTokenState,
} from '../../UnderlineSentence';
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

const isSelectedIndexFlag = (value: unknown): boolean => (
    value === true
    || value === 1
    || (typeof value === 'string' && ['true', '1'].includes(value.trim().toLowerCase()))
);

const isIndexSelectionMap = (value: unknown): boolean => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

    return Object.entries(value as Record<string, unknown>).some(([key, selected]) => {
        const index = Number(key);
        return /^\d+$/u.test(key)
            && Number.isInteger(index)
            && index >= 0
            && isSelectedIndexFlag(selected);
    });
};

const isIndexSource = (value: unknown): boolean => (
    Array.isArray(value) || isIndexSelectionMap(value)
);

const parseCorrectIndexSource = (value: unknown): { source: unknown; hasSource: boolean } => {
    if (typeof value !== 'string') {
        return { source: value, hasSource: isIndexSource(value) };
    }

    try {
        const parsed = JSON.parse(value);
        return { source: parsed, hasSource: Array.isArray(parsed) };
    } catch {
        return { source: undefined, hasSource: false };
    }
};

const UnderlineReview: React.FC<UnderlineReviewProps> = memo(({ question, studentAnswer, reviewDetail }) => {
    const words = Array.isArray(question.words) ? question.words : [];
    const sentence = typeof question.sentence === 'string' ? question.sentence : undefined;
    const rawCorrectSource = question.correctWordIndexes ?? question.correctAnswer;
    const { source: correctSource, hasSource: hasCorrectIndexSource } = parseCorrectIndexSource(rawCorrectSource);
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
            <UnderlineSentence
                sentence={sentence}
                words={words.map((word: unknown) => String(word))}
                stateForIndex={(index): UnderlineTokenState => {
                    const isSelectedByStudent = studentIndices.includes(index);
                    const isActuallyCorrect = correctIndices.includes(index);

                    if (hasCorrectIndexSource) {
                        if (isSelectedByStudent && isActuallyCorrect) return 'correct';
                        if (isSelectedByStudent) return 'incorrect';
                        if (isActuallyCorrect) return 'missed';
                    }

                    return isSelectedByStudent ? 'selected' : 'idle';
                }}
                ariaLabel="Kết quả câu gạch chân"
            />
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
