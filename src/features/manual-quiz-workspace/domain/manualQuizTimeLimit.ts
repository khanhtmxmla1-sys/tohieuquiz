export const RECOMMENDED_MAX_MANUAL_QUIZ_TIME_MINUTES = 180;

export type ManualQuizTimeLimitResult =
    | { valid: true; value: number; isLong: boolean }
    | { valid: false; message: string };

export const parseManualQuizTimeLimit = (
    rawValue: string | number,
): ManualQuizTimeLimitResult => {
    if (typeof rawValue === 'string' && rawValue.trim() === '') {
        return { valid: false, message: 'Hãy nhập thời gian làm bài.' };
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
        return { valid: false, message: 'Thời gian làm bài phải là số phút nguyên.' };
    }
    if (value < 1) {
        return { valid: false, message: 'Thời gian làm bài phải từ 1 phút trở lên.' };
    }

    return {
        valid: true,
        value,
        isLong: value > RECOMMENDED_MAX_MANUAL_QUIZ_TIME_MINUTES,
    };
};
