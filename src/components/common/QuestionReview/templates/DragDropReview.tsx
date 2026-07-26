import React, { memo } from 'react';
import MathContent from '../MathContent';

interface DragDropReviewProps {
    question: any;
    studentAnswer: any;
    status: 'correct' | 'wrong' | 'skipped';
}

const hasOwn = (obj: Record<string, any>, key: string) =>
    Object.prototype.hasOwnProperty.call(obj, key);

const hasValue = (val: any): boolean => {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return val.trim() !== '';
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return true;
};

const normalizeComparable = (val: any): string => String(val ?? '').trim().toLowerCase();

const safeRender = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const parseResponse = (studentAnswer: any): Record<string, any> => {
    if (typeof studentAnswer === 'object' && studentAnswer !== null && !Array.isArray(studentAnswer)) {
        return studentAnswer as Record<string, any>;
    }

    if (Array.isArray(studentAnswer)) {
        const mapped: Record<string, any> = {};
        studentAnswer.forEach((value, idx) => {
            mapped[String(idx)] = value;
        });
        return mapped;
    }

    if (typeof studentAnswer === 'string') {
        try {
            const parsed = JSON.parse(studentAnswer);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, any>;
            }
        } catch {
            // Ignore parse error and fallback to empty object.
        }
    }

    return {};
};

const getPlaceholderId = (part: string): string => {
    if (part.startsWith('[[') && part.endsWith(']]')) return part.slice(2, -2).trim();
    if (part.startsWith('{{') && part.endsWith('}}')) return part.slice(2, -2).trim();
    if (part.startsWith('[') && part.endsWith(']')) return part.slice(1, -1).trim();
    return '';
};

const isPlaceholderPart = (part: string): boolean =>
    /^(?:\[\[.*\]\]|\{\{.*\}\}|\[.*\])$/.test(part);

const DragDropReview: React.FC<DragDropReviewProps> = memo(({ question, studentAnswer, status }) => {
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];
    const response = parseResponse(studentAnswer);

    let parsedCorrectAnswer: any = question.correctAnswer;
    if (typeof parsedCorrectAnswer === 'string') {
        try {
            parsedCorrectAnswer = JSON.parse(parsedCorrectAnswer);
        } catch {
            // Keep raw string if it is not JSON.
        }
    }

    const sortedNumericValues = Object.entries(response)
        .filter(([k]) => /^-?\d+$/.test(k))
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, value]) => value);

    const getResponseValue = (key: any): any => {
        if (key === undefined || key === null) return undefined;
        const k = String(key);
        return hasOwn(response, k) ? response[k] : undefined;
    };

    const resolveCorrectAnswer = (blank: any, idx: number, placeholderId?: string): any => {
        if (typeof blank === 'string') return blank;
        if (blank && typeof blank === 'object') {
            if (hasValue(blank.correctAnswer)) return blank.correctAnswer;
            if (hasValue(blank.answer)) return blank.answer;
        }

        if (parsedCorrectAnswer && typeof parsedCorrectAnswer === 'object' && !Array.isArray(parsedCorrectAnswer)) {
            const candidates = [blank?.id, placeholderId, String(idx), String(idx + 1)];
            for (const candidate of candidates) {
                if (candidate === undefined || candidate === null) continue;
                const key = String(candidate);
                if (hasOwn(parsedCorrectAnswer, key)) return parsedCorrectAnswer[key];
            }
        }

        return '';
    };

    const resolveStudentAnswer = (blank: any, idx: number, partIdx?: number, placeholderId?: string): any => {
        const candidates: any[] = [blank?.id, placeholderId, String(idx), String(idx + 1)];
        if (typeof partIdx === 'number') {
            candidates.push(String(partIdx));
        }

        for (const candidate of candidates) {
            const value = getResponseValue(candidate);
            if (value !== undefined) return value;
        }

        // Legacy path: DRAG_DROP answers often persisted by part index (1,3,5,...)
        if (sortedNumericValues.length >= blanks.length && idx < sortedNumericValues.length) {
            return sortedNumericValues[idx];
        }

        return undefined;
    };

    const textContent = question.text || question.questionText || '';
    const placeholderRegex = /(\[\[.*?\]\]|\{\{.*?\}\}|\[.*?\])/g;
    const parts = textContent ? textContent.split(placeholderRegex) : [];

    if (textContent && parts.some(isPlaceholderPart)) {
        let blankCursor = 0;

        return (
            <div className="drag-drop-review-template">
                <div className="content-display inline-fill">
                    {parts.map((part: string, idx: number) => {
                        if (isPlaceholderPart(part)) {
                            const placeholderId = getPlaceholderId(part);
                            const blankIndex = blankCursor;
                            const blank = blanks[blankCursor];
                            blankCursor++;

                            const sAnsRaw = resolveStudentAnswer(blank, blankIndex, idx, placeholderId);
                            const cAnsRaw = resolveCorrectAnswer(blank, blankIndex, placeholderId);
                            const isItemCorrect = hasValue(cAnsRaw)
                                ? normalizeComparable(sAnsRaw) === normalizeComparable(cAnsRaw)
                                : status === 'correct';
                            const sAns = hasValue(sAnsRaw) ? sAnsRaw : '...';

                            return (
                                <span key={idx} className={`inline-drop-review ${isItemCorrect ? 'correct' : 'wrong'}`}>
                                    <span className="student-val">{safeRender(sAns)}</span>
                                    {!isItemCorrect && hasValue(cAnsRaw) && (
                                        <span className="correct-hint"> ({safeRender(cAnsRaw)})</span>
                                    )}
                                </span>
                            );
                        }

                        return <MathContent key={idx} content={part} className="inline-text" />;
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="drag-drop-review-template">
            <div className="blanks-list">
                {blanks.map((blank: any, idx: number) => {
                    const sAnsRaw = resolveStudentAnswer(blank, idx);
                    const cAnsRaw = resolveCorrectAnswer(blank, idx);
                    const sAns = hasValue(sAnsRaw) ? sAnsRaw : '(Trống)';
                    const isCorrect = hasValue(cAnsRaw)
                        ? normalizeComparable(sAnsRaw) === normalizeComparable(cAnsRaw)
                        : status === 'correct';

                    return (
                        <div key={idx} className={`blank-item ${isCorrect ? 'correct' : 'wrong'}`}>
                            <span className="blank-label">Ô {idx + 1}:</span>
                            <span className={`blank-answer ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                {safeRender(sAns)}
                            </span>
                            {!isCorrect && hasValue(cAnsRaw) && (
                                <span className="correct-hint"> (Đ.án: {safeRender(cAnsRaw)})</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default DragDropReview;
