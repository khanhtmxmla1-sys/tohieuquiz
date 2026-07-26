import { describe, expect, it } from 'vitest';
import { buildManualQuizSeed } from '../src/features/manual-quiz-workspace/domain/manualQuizSeed';

describe('buildManualQuizSeed', () => {
    it('normalizes the current create form into workspace navigation state', () => {
        expect(buildManualQuizSeed({
            quizTitle: '  Kiểm tra Toán  ',
            classLevel: '4A',
            category: 'toan',
            manualTimeLimit: 25,
            tags: ['phân số', 'giữa kỳ'],
            requireCode: true,
            accessCode: 'ab12cd',
            showOnHome: false,
        })).toEqual({
            title: 'Kiểm tra Toán',
            classLevel: '4A',
            category: 'toan',
            timeLimit: 25,
            tags: ['phân số', 'giữa kỳ'],
            requireCode: true,
            accessCode: 'AB12CD',
            showOnHome: false,
        });
    });

    it('uses safe defaults without inventing access credentials', () => {
        expect(buildManualQuizSeed({
            quizTitle: '   ',
            classLevel: '',
            category: '',
            manualTimeLimit: '',
            tags: [],
            requireCode: false,
            accessCode: 'ignored',
            showOnHome: true,
        })).toEqual(expect.objectContaining({
            title: 'Đề kiểm tra mới',
            classLevel: '3',
            category: 'toan',
            timeLimit: 15,
            requireCode: false,
            accessCode: undefined,
        }));
    });
});
