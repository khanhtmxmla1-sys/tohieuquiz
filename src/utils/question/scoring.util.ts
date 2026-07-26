/**
 * Unified Scoring Utility
 * 
 * Central brain for grading all 13 question types in TôHiệuQuiz.
 * Ensures consistent results between student and teacher views.
 */

export type AnswerStatus = 'correct' | 'wrong' | 'skipped';

export interface ScoringResult {
    status: AnswerStatus;
    isCorrect: boolean;
    correctAnswer: any;
    studentAnswer: any;
    feedback?: string;
}

/**
 * Normalizes MCQ answers by stripping prefixes like "A. " or "1. "
 */
export const normalizeMCQ = (val: any): string => {
    if (typeof val !== 'string') return String(val || '');
    const match = val.match(/^([A-Za-z0-9])[\.\)\-\s]/);
    return match ? match[1].toUpperCase() : val.trim().toUpperCase();
};

/**
 * Normalizes short answers by trimming and removing control characters
 */
export const normalizeShortAnswer = (val: any): string => {
    if (typeof val !== 'string') return String(val || '').trim();
    return val.toLowerCase()
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Compares ordering answers by normalizing to a comma-separated string
 */
const compareOrdering = (student: any, correct: any): boolean => {
    const toIdStr = (val: any) => {
        if (Array.isArray(val)) {
            // Ép kiểu String cho từng phần tử để tránh lệch kiểu dữ liệu (Audit Fix)
            return val.map(v => String(typeof v === 'object' ? (v.id || v.value) : v)).join(',');
        }
        return String(val || '');
    };
    return toIdStr(student) === toIdStr(correct);
};

const normalizeTrueFalseAnswers = (question: any): Record<string, boolean> => {
    const normalized: Record<string, boolean> = {};

    if (Array.isArray(question?.items) && question.items.length > 0) {
        question.items.forEach((item: any, idx: number) => {
            if (item && typeof item === 'object' && 'isCorrect' in item) {
                normalized[item.id || `item-${idx}`] = Boolean(item.isCorrect);
            }
        });
        if (Object.keys(normalized).length > 0) {
            return normalized;
        }
    }

    const rawCorrect = question?.correctAnswer ?? question?.correctAnswers;

    if (rawCorrect && typeof rawCorrect === 'object' && !Array.isArray(rawCorrect)) {
        Object.entries(rawCorrect).forEach(([key, value]) => {
            normalized[key] = Boolean(value);
        });
        return normalized;
    }

    if (typeof rawCorrect === 'string') {
        try {
            const parsed = JSON.parse(rawCorrect);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                Object.entries(parsed).forEach(([key, value]) => {
                    normalized[key] = Boolean(value);
                });
                return normalized;
            }
        } catch {
            // Keep simple true/false fallback below.
        }
    }

    return normalized;
};

const normalizeMultipleSelectChoices = (value: any, options: any[] = []): string[] => {
    const normalizeOptionText = (option: any): string => {
        if (typeof option === 'string') return option.trim().toUpperCase();
        if (option && typeof option === 'object') {
            return String(option.text ?? option.content ?? option.label ?? '').trim().toUpperCase();
        }
        return String(option ?? '').trim().toUpperCase();
    };

    const toLabel = (raw: any): string => {
        if (typeof raw === 'number' && Number.isFinite(raw)) {
            return String.fromCharCode(65 + raw);
        }

        const normalized = String(raw ?? '').trim().toUpperCase();
        if (!normalized) return '';

        if (/^[A-Z]$/.test(normalized)) {
            return normalized;
        }

        const optionIndex = options.findIndex((option) => normalizeOptionText(option) === normalized);
        if (optionIndex >= 0) {
            return String.fromCharCode(65 + optionIndex);
        }

        return normalized;
    };

    let values: any[] = [];

    if (Array.isArray(value)) {
        values = value;
    } else if (typeof value === 'object' && value !== null) {
        values = Object.keys(value)
            .filter((key) => Boolean(value[key]))
            .map((key) => {
                if (key.startsWith('item-')) {
                    const idx = Number(key.replace('item-', ''));
                    return Number.isFinite(idx) ? String.fromCharCode(65 + idx) : key;
                }
                return key;
            });
    } else if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                values = parsed;
            } else {
                values = value.split('|');
            }
        } catch {
            values = value.split('|');
        }
    } else if (value !== undefined && value !== null) {
        values = [value];
    }

    return Array.from(new Set(values.map(toLabel).filter(Boolean))).sort();
};

const normalizeMatchingMap = (answer: any, pairs: Array<{ left: any; right: any }> = []): Record<string, string> => {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return {};

    const cleaned: Record<string, string> = {};
    Object.entries(answer).forEach(([key, value]) => {
        if (key === 'selectedLeft' || key === '__shuffledIds') return;
        if (typeof value !== 'string') return;
        cleaned[String(key)] = value;
    });

    const leftByIndex = pairs.map((pair) => String(pair?.left ?? ''));
    const rightByIndex = pairs.map((pair) => String(pair?.right ?? ''));

    const resolved: Record<string, string> = {};
    Object.entries(cleaned).forEach(([leftKey, rightValue]) => {
        const leftMatch = leftKey.match(/^l-(\d+)$/i);
        const rightMatch = String(rightValue).match(/^r-(\d+)$/i);

        const resolvedLeft = leftMatch ? leftByIndex[Number(leftMatch[1])] ?? leftKey : leftKey;
        const resolvedRight = rightMatch ? rightByIndex[Number(rightMatch[1])] ?? rightValue : rightValue;

        resolved[String(resolvedLeft)] = String(resolvedRight);
    });

    return resolved;
};

/**
 * Main scoring function
 */
export const checkAnswer = (question: any, answer: any): ScoringResult => {
    // 1. Handle Empty/Skipped
    const isEmpty = answer === undefined ||
        answer === null ||
        answer === '' ||
        (Array.isArray(answer) && answer.length === 0) ||
        (typeof answer === 'object' && answer !== null && !Array.isArray(answer) && Object.keys(answer).length === 0);

    if (isEmpty) {
        return {
            status: 'skipped',
            isCorrect: false,
            studentAnswer: answer,
            correctAnswer: question.correctAnswer
        };
    }

    let isCorrect = false;

    // 2. Question Type Specific Logic
    switch (question.type) {
        case 'MCQ':
        case 'IMAGE_MCQ':
            isCorrect = normalizeMCQ(answer) === normalizeMCQ(question.correctAnswer);
            break;

        case 'SHORT_ANSWER':
            isCorrect = normalizeShortAnswer(answer) === normalizeShortAnswer(question.correctAnswer);
            break;

        case 'ORDERING':
            isCorrect = compareOrdering(answer, question.correctOrder || question.correctAnswer);
            break;

        case 'MULTIPLE_SELECT': {
            const studentChoices = normalizeMultipleSelectChoices(answer, question.options || []);
            const correctChoices = normalizeMultipleSelectChoices(question.correctAnswers ?? question.correctAnswer, question.options || []);
            isCorrect = studentChoices.length === correctChoices.length &&
                studentChoices.every((choice, idx) => choice === correctChoices[idx]);
            break;
        }

        case 'TRUE_FALSE':
            if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
                const correctAnswers = normalizeTrueFalseAnswers(question);
                const keys = Object.keys(correctAnswers);
                isCorrect = keys.length > 0 && keys.every((key) => answer[key] === correctAnswers[key]);
            } else {
                const correctAnswers = normalizeTrueFalseAnswers(question);
                const fallbackAnswer = Object.keys(correctAnswers).length === 1
                    ? Object.values(correctAnswers)[0]
                    : question.correctAnswer;
                isCorrect = String(answer).toLowerCase() === String(fallbackAnswer).toLowerCase();
            }
            break;

        case 'MATCHING': {
            const pairList = Array.isArray(question.pairs) ? question.pairs : [];
            const normalizedStudent = normalizeMatchingMap(answer, pairList);
            isCorrect = pairList.length > 0 && pairList.every((pair: any) => {
                const left = String(pair?.left ?? '');
                const right = String(pair?.right ?? '');
                return normalizedStudent[left] === right;
            });
            break;
        }

        case 'CATEGORIZATION': {
            const normalizeObject = (p: any) => {
                if (typeof p === 'object' && p !== null) {
                    return JSON.stringify(Object.keys(p).sort().reduce((acc: any, key) => {
                        acc[key] = p[key];
                        return acc;
                    }, {}));
                }
                return String(p);
            };
            isCorrect = normalizeObject(answer) === normalizeObject(question.correctAnswer || question.pairs);
            break;
        }

        case 'UNDERLINE':
            // So sánh mảng index cho Gạch chân
            const studentIdxs = Array.isArray(answer) ? [...answer].sort().join(',') : '';
            const correctIdxs = Array.isArray(question.correctWordIndexes)
                ? [...question.correctWordIndexes].sort().join(',')
                : '';
            isCorrect = studentIdxs === correctIdxs;
            break;

        case 'WORD_SCRAMBLE':
            // So sánh từ ghép được cho Ghép từ
            const letters = question.letters || [];
            const studentWord = Array.isArray(answer)
                ? answer.map((idx: number) => letters[idx] || '').join('')
                : String(answer);
            isCorrect = studentWord.toUpperCase() === String(question.correctWord || question.correctAnswer).toUpperCase();
            break;

        default:
            // Fallback for types not yet fully implemented in new engine
            // Using loose comparison as safety net
            isCorrect = JSON.stringify(answer) === JSON.stringify(question.correctAnswer);
            break;
    }

    return {
        status: isCorrect ? 'correct' : 'wrong',
        isCorrect,
        studentAnswer: answer,
        correctAnswer: question.correctAnswer
    };
};
