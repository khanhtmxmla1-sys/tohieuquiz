import { describe, expect, it } from 'vitest';
import {
    parseManualQuizTimeLimit,
    RECOMMENDED_MAX_MANUAL_QUIZ_TIME_MINUTES,
} from '../src/features/manual-quiz-workspace/domain/manualQuizTimeLimit';

describe('parseManualQuizTimeLimit', () => {
    it.each([
        ['', 'Hãy nhập thời gian làm bài.'],
        [0, 'Thời gian làm bài phải từ 1 phút trở lên.'],
        [-1, 'Thời gian làm bài phải từ 1 phút trở lên.'],
        [15.5, 'Thời gian làm bài phải là số phút nguyên.'],
        ['abc', 'Thời gian làm bài phải là số phút nguyên.'],
        [Number.POSITIVE_INFINITY, 'Thời gian làm bài phải là số phút nguyên.'],
    ])('rejects invalid value %p', (raw, message) => {
        expect(parseManualQuizTimeLimit(raw)).toEqual({ valid: false, message });
    });

    it.each([1, 15, RECOMMENDED_MAX_MANUAL_QUIZ_TIME_MINUTES])(
        'accepts %i minutes without a long-duration warning',
        (value) => {
            expect(parseManualQuizTimeLimit(value)).toEqual({
                valid: true,
                value,
                isLong: false,
            });
        },
    );

    it.each([181, 300])('accepts %i minutes but marks it as unusually long', (value) => {
        expect(parseManualQuizTimeLimit(value)).toEqual({
            valid: true,
            value,
            isLong: true,
        });
    });
});
