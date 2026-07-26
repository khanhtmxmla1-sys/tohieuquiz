import React, { memo } from 'react';
import MathContent from '../MathContent';

interface DropdownReviewProps {
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
    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
    return String(val ?? '');
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

const isPlaceholderPart = (part: string): boolean =>
    /^(?:\[\[.*\]\]|\{\{.*\}\}|\[.*\])$/.test(part);

const getPlaceholderId = (part: string): string => {
    if (part.startsWith('[[') && part.endsWith(']]')) return part.slice(2, -2).trim();
    if (part.startsWith('{{') && part.endsWith('}}')) return part.slice(2, -2).trim();
    if (part.startsWith('[') && part.endsWith(']')) return part.slice(1, -1).trim();
    return '';
};

const DropdownReview: React.FC<DropdownReviewProps> = memo(({ question, studentAnswer, status }) => {
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];
    const response = parseResponse(studentAnswer);

    let parsedCorrectAnswer: any = question.correctAnswer;
    if (typeof parsedCorrectAnswer === 'string') {
        try {
            parsedCorrectAnswer = JSON.parse(parsedCorrectAnswer);
        } catch {
            // Keep raw string if not JSON.
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

    const findBlankById = (placeholderId: string): { blank: any; blankIndex: number } | null => {
        if (!placeholderId) return null;
        const idx = blanks.findIndex((blank: any) => String(blank?.id ?? '') === placeholderId);
        if (idx >= 0) return { blank: blanks[idx], blankIndex: idx };
        return null;
    };

    const resolveBlankForPlaceholder = (placeholderId: string, fallbackIndex: number): { blank: any; blankIndex: number } => {
        if (/^\d+$/.test(placeholderId)) {
            const oneBasedIndex = Number(placeholderId);
            const idx = oneBasedIndex - 1;
            if (idx >= 0 && idx < blanks.length) {
                return { blank: blanks[idx], blankIndex: idx };
            }
        }

        const byId = findBlankById(placeholderId);
        if (byId) return byId;

        return { blank: blanks[fallbackIndex], blankIndex: fallbackIndex };
    };

    const resolveCorrectAnswer = (blank: any, blankIndex: number, placeholderId?: string): any => {
        if (blank && typeof blank === 'object') {
            if (hasValue(blank.correctAnswer)) return blank.correctAnswer;
            if (hasValue(blank.answer)) return blank.answer;
        }

        if (parsedCorrectAnswer && typeof parsedCorrectAnswer === 'object' && !Array.isArray(parsedCorrectAnswer)) {
            const candidates = [blank?.id, placeholderId, String(blankIndex), String(blankIndex + 1)];
            for (const candidate of candidates) {
                if (candidate === undefined || candidate === null) continue;
                const key = String(candidate);
                if (hasOwn(parsedCorrectAnswer, key)) return parsedCorrectAnswer[key];
            }
        }

        return '';
    };

    const resolveStudentAnswer = (blank: any, blankIndex: number, partIndex?: number, placeholderId?: string): any => {
        const candidates: any[] = [blank?.id, placeholderId, String(blankIndex), String(blankIndex + 1)];

        if (placeholderId && /^\d+$/.test(placeholderId)) {
            const n = Number(placeholderId);
            candidates.push(String(n - 1), String(n));
        }

        if (typeof partIndex === 'number') {
            candidates.push(String(partIndex));
        }

        for (const candidate of candidates) {
            const value = getResponseValue(candidate);
            if (value !== undefined) return value;
        }

        // Legacy fallback: map sorted numeric answers to blank order.
        if (sortedNumericValues.length >= blanks.length && blankIndex < sortedNumericValues.length) {
            return sortedNumericValues[blankIndex];
        }

        return undefined;
    };

    const textContent = question.text || question.questionText || '';
    const placeholderRegex = /(\[\[.*?\]\]|\{\{.*?\}\}|\[.*?\])/g;

    const renderContent = () => {
        if (!textContent) return null;

        const parts = textContent.split(placeholderRegex);
        if (!parts.some(isPlaceholderPart)) return null;

        let blankCursor = 0;

        return parts.map((part: string, idx: number) => {
            if (isPlaceholderPart(part)) {
                const placeholderId = getPlaceholderId(part);
                const { blank, blankIndex } = resolveBlankForPlaceholder(placeholderId, blankCursor);
                blankCursor++;

                const sAnsRaw = resolveStudentAnswer(blank, blankIndex, idx, placeholderId);
                const cAnsRaw = resolveCorrectAnswer(blank, blankIndex, placeholderId);
                const isItemCorrect = hasValue(cAnsRaw)
                    ? normalizeComparable(sAnsRaw) === normalizeComparable(cAnsRaw)
                    : status === 'correct';
                const sAns = hasValue(sAnsRaw) ? sAnsRaw : '...';

                return (
                    <span key={idx} className={`inline-dropdown-review ${isItemCorrect ? 'correct' : 'wrong'}`}>
                        <span className="student-val">{safeRender(sAns)}</span>
                        {!isItemCorrect && hasValue(cAnsRaw) && (
                            <span className="correct-hint"> (Đúng: {safeRender(cAnsRaw)})</span>
                        )}
                    </span>
                );
            }
            return <MathContent key={idx} content={part} className="inline-text" />;
        });
    };

    return (
        <div className="dropdown-review-template">
            <div className="content-display inline-fill">
                {renderContent() || (
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
                                    <span className="blank-label">Chỗ trống {idx + 1}:</span>
                                    <span className="student-ans">{safeRender(sAns)}</span>
                                    {!isCorrect && hasValue(cAnsRaw) && (
                                        <span className="correct-ans"> (Đáp án: {safeRender(cAnsRaw)})</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
});

export default DropdownReview;
