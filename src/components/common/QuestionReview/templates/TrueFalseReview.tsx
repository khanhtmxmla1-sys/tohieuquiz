import React, { memo } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { AnswerReviewValue, QuestionAnswerReview } from '../../../../domain/quiz-scoring';
import MathContent from '../MathContent';
import { normalizeBooleanValue } from '../reviewNormalization';

interface TrueFalseReviewProps {
    question: any;
    studentAnswer: any;
    status: 'correct' | 'wrong' | 'skipped';
    reviewDetail?: QuestionAnswerReview;
}

const normalizeReviewBoolean = (value: unknown): boolean | undefined => {
    const direct = normalizeBooleanValue(value);
    if (direct !== undefined) return direct;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLocaleLowerCase('vi');
    if (normalized === 'đúng') return true;
    if (normalized === 'sai') return false;
    return undefined;
};

const itemText = (item: any, index: number): string => (
    typeof item === 'string'
        ? item
        : String(item?.text || item?.statement || `Phát biểu ${index + 1}`)
);

const reviewMapForItems = (items: any[], value?: AnswerReviewValue): Record<string, boolean> | null => {
    if (!value || value.kind === 'unsupported' || value.lines.length === 0 || items.length === 0) return null;
    const lines = value.lines;
    const byLabel = new Map(lines
        .filter((line) => line.label)
        .map((line) => [String(line.label).trim(), normalizeReviewBoolean(line.value)] as const));
    const canUseIndex = lines.length === items.length && lines.every((line, index) => (
        !line.label || String(line.label).trim() === itemText(items[index], index).trim()
    ));
    const mapped: Record<string, boolean> = {};

    items.forEach((item, index) => {
        const key = item?.id || `item-${index}`;
        const label = itemText(item, index).trim();
        const valueFromLabel = byLabel.get(label);
        const parsed = valueFromLabel !== undefined
            ? valueFromLabel
            : canUseIndex
                ? normalizeReviewBoolean(lines[index]?.value)
                : undefined;
        if (parsed !== undefined) mapped[key] = parsed;
    });

    return Object.keys(mapped).length === items.length ? mapped : null;
};

const buildLocalCorrectAnswers = (items: any[], correctAnswer: unknown): Record<string, boolean> => {
    const normalized: Record<string, boolean> = {};

    items.forEach((item: any, index: number) => {
        if (!item || typeof item !== 'object' || !('isCorrect' in item)) return;
        const value = normalizeBooleanValue(item.isCorrect);
        if (value !== undefined) normalized[item.id || `item-${index}`] = value;
    });
    if (Object.keys(normalized).length > 0) return normalized;

    const addObjectValues = (value: unknown) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        Object.entries(value).forEach(([key, raw]) => {
            const parsed = normalizeBooleanValue(raw);
            if (parsed !== undefined) normalized[key] = parsed;
        });
        return Object.keys(normalized).length > 0;
    };

    if (addObjectValues(correctAnswer)) return normalized;
    if (typeof correctAnswer === 'string') {
        try {
            addObjectValues(JSON.parse(correctAnswer));
        } catch {
            // Simple-value handling is performed separately below.
        }
    }
    return normalized;
};

const ReviewValueLines: React.FC<{ title: string; value: AnswerReviewValue }> = ({ title, value }) => (
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

const TrueFalseReview: React.FC<TrueFalseReviewProps> = memo(({ question, studentAnswer, reviewDetail }) => {
    const items = Array.isArray(question.items) ? question.items : [];
    const correctAnswer = question.correctAnswer;
    const serverCorrectAnswers = reviewMapForItems(items, reviewDetail?.correctAnswer);
    const serverStudentAnswers = reviewMapForItems(items, reviewDetail?.studentAnswer);
    const hasServerReview = Boolean(
        reviewDetail
        && reviewDetail.correctAnswer.kind !== 'unsupported'
        && reviewDetail.correctAnswer.lines.length > 0
    );

    if (hasServerReview && items.length > 0 && !serverCorrectAnswers) {
        return (
            <div className="true-false-review-template grid gap-2 sm:grid-cols-2">
                <ReviewValueLines title="Câu trả lời của học sinh" value={reviewDetail!.studentAnswer} />
                <ReviewValueLines title="Đáp án đúng" value={reviewDetail!.correctAnswer} />
            </div>
        );
    }

    const correctAnswers = serverCorrectAnswers || buildLocalCorrectAnswers(items, correctAnswer);

    if (typeof studentAnswer === 'string' || typeof studentAnswer === 'boolean') {
        const studentVal = normalizeBooleanValue(studentAnswer);
        const serverCorrect = reviewDetail?.correctAnswer.lines.length === 1
            ? normalizeReviewBoolean(reviewDetail.correctAnswer.lines[0]?.value)
            : undefined;
        const singleDerivedAnswer = Object.keys(correctAnswers).length === 1
            ? Object.values(correctAnswers)[0]
            : undefined;
        const correctVal = serverCorrect ?? singleDerivedAnswer ?? normalizeBooleanValue(correctAnswer);
        const hasComparableValues = studentVal !== undefined && correctVal !== undefined;
        const isCorrect = hasComparableValues && studentVal === correctVal;

        return (
            <div className="true-false-review-template">
                <div className="tf-simple-row">
                    <span className="tf-label">Câu trả lời:</span>
                    <span className={`tf-value ${hasComparableValues ? (isCorrect ? 'correct' : 'wrong') : 'neutral'}`}>
                        {studentVal === true ? 'Đúng' : studentVal === false ? 'Sai' : String(studentAnswer)}
                    </span>
                    {correctVal !== undefined && !isCorrect ? (
                        <span className="tf-correct-hint"> (Đáp án: {correctVal ? 'Đúng' : 'Sai'})</span>
                    ) : null}
                    {correctVal === undefined ? (
                        <span className="ml-2 text-sm text-slate-500">Chưa có dữ liệu đáp án</span>
                    ) : null}
                </div>
            </div>
        );
    }

    if (typeof studentAnswer === 'object' && studentAnswer !== null) {
        return (
            <div className="true-false-review-template">
                <div className="tf-items-list">
                    {items.length > 0 ? items.map((item: any, index: number) => {
                        const key = item?.id || `item-${index}`;
                        const studentVal = serverStudentAnswers?.[key] ?? normalizeBooleanValue(studentAnswer[key]);
                        const correctVal = correctAnswers[key];
                        const hasCorrectValue = correctVal !== undefined;
                        const isCorrect = hasCorrectValue && studentVal !== undefined && studentVal === correctVal;
                        const rowState = hasCorrectValue ? (isCorrect ? 'correct' : 'wrong') : 'neutral';

                        return (
                            <div key={key} className={`tf-item-row ${rowState}`}>
                                <span className="tf-item-index">{index + 1}.</span>
                                <MathContent content={itemText(item, index)} className="tf-item-text" />
                                <span className="tf-item-answer">
                                    {hasCorrectValue ? (
                                        isCorrect
                                            ? <CheckCircle className="w-4 h-4 text-green-500 inline" />
                                            : <XCircle className="w-4 h-4 text-red-500 inline" />
                                    ) : null}
                                    <span className="tf-item-val">
                                        {studentVal === true ? ' Đúng' : studentVal === false ? ' Sai' : ' Chưa trả lời'}
                                    </span>
                                    {!hasCorrectValue ? (
                                        <span className="text-xs font-medium text-slate-500">Chưa có dữ liệu đáp án</span>
                                    ) : !isCorrect ? (
                                        <span className="tf-correct-hint"> (Đ.án: {correctVal ? 'Đúng' : 'Sai'})</span>
                                    ) : null}
                                </span>
                            </div>
                        );
                    }) : Object.entries(studentAnswer).map(([key, rawValue], index) => {
                        const studentVal = normalizeBooleanValue(rawValue);
                        const correctVal = correctAnswers[key];
                        const hasCorrectValue = correctVal !== undefined;
                        const isCorrect = hasCorrectValue && studentVal !== undefined && studentVal === correctVal;
                        return (
                            <div key={key} className={`tf-item-row ${hasCorrectValue ? (isCorrect ? 'correct' : 'wrong') : 'neutral'}`}>
                                <span className="tf-item-index">{index + 1}.</span>
                                <span className="tf-item-answer">
                                    {hasCorrectValue ? (isCorrect
                                        ? <CheckCircle className="w-4 h-4 text-green-500 inline" />
                                        : <XCircle className="w-4 h-4 text-red-500 inline" />) : null}
                                    <span className="tf-item-val">
                                        {studentVal === true ? ' Đúng' : studentVal === false ? ' Sai' : ' Chưa trả lời'}
                                    </span>
                                    {!hasCorrectValue ? (
                                        <span className="text-xs font-medium text-slate-500">Chưa có dữ liệu đáp án</span>
                                    ) : !isCorrect ? (
                                        <span className="tf-correct-hint"> (Đ.án: {correctVal ? 'Đúng' : 'Sai'})</span>
                                    ) : null}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="true-false-review-template">
            <span className="tf-no-answer">(Bỏ trống)</span>
        </div>
    );
});

export default TrueFalseReview;
