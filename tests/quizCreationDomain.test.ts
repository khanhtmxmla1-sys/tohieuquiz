import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
    createDefaultDeadline,
    createRandomAccessCode,
    parseQuizTags,
    resolvePromptProfilePreset,
} from '../src/features/quiz-generator/domain/quizCreationDefaults';
import { validateQuizGenerationInput } from '../src/features/quiz-generator/domain/quizCreationValidation';
import {
    buildPdfCustomPrompt,
    buildQuizGenerationOptions,
} from '../src/features/quiz-generator/domain/buildQuizGenerationRequest';

const difficultyLevels = { level1: 3, level2: 5, level3: 2 };
const selectedTypes = { [QuestionType.MCQ]: true, [QuestionType.TRUE_FALSE]: false };

describe('quiz creation domain helpers', () => {
    it('creates the same seven-day default deadline used by the form', () => {
        expect(createDefaultDeadline(new Date('2026-07-18T00:00:00.000Z'))).toBe('2026-07-25');
    });

    it('creates a six-character access code from the allowed alphabet', () => {
        const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
        let index = 0;
        const code = createRandomAccessCode(() => values[index++]);

        expect(code).toHaveLength(6);
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    });

    it('parses string and array tags without leaking malformed data', () => {
        expect(parseQuizTags('["#Toan", " on tap "]')).toEqual(['Toan', 'on tap']);
        expect(parseQuizTags(['#Van', null, ''])).toEqual(['Van']);
        expect(parseQuizTags('{broken')).toEqual([]);
    });

    it('keeps prompt preset totals equal to the requested question count', () => {
        const result = resolvePromptProfilePreset(10, { useThongTu27: true, learnerMode: 'gifted' });
        expect(result.presetLabel).toBe('gifted');
        expect(result.levels.level1 + result.levels.level2 + result.levels.level3).toBe(10);
    });

    it('returns the existing validation messages and derived values', () => {
        const result = validateQuizGenerationInput({
            mode: 'practice',
            uploadedFile: null,
            topic: 'Fractions',
            classLevel: '4',
            selectedTypes,
            difficultyLevels,
        });

        expect(result).toEqual({
            error: null,
            enabledTypes: [QuestionType.MCQ],
            questionCount: 10,
        });

        expect(validateQuizGenerationInput({
            mode: 'pdf',
            uploadedFile: null,
            topic: '',
            classLevel: '4',
            selectedTypes,
            difficultyLevels,
        }).error).toBe('Vui lòng tải lên file PDF hoặc ảnh');
    });

    it('builds generation options without mutating input collections', () => {
        const images = [{ id: 'img-1', name: 'Diagram', data: 'data:image/png;base64,abc', createdAt: 'now' }];
        const result = buildQuizGenerationOptions({
            title: 'Quiz title',
            questionCount: 10,
            questionTypes: [QuestionType.MCQ],
            difficultyLevels,
            promptProfile: { useThongTu27: true, learnerMode: 'default' },
            imageLibrary: images,
            customPrompt: '  explain clearly  ',
            quizMode: 'exam',
            isPdfMode: false,
        });

        expect(result.customPrompt).toBe('explain clearly');
        expect(result.blueprint).toEqual({
            intent: 'EXAM',
            sourceMode: 'TOPIC',
            totalQuestions: 10,
            typeAllocations: [{ type: QuestionType.MCQ, count: 10 }],
            difficultyLevels,
        });
        expect(result.questionCount).toBe(result.blueprint?.totalQuestions);
        expect(result.questionTypes).toEqual(result.blueprint?.typeAllocations.map(({ type }) => type));
        expect(result.imageLibrary).toEqual([{ id: 'img-1', name: 'Diagram', data: 'data:image/png;base64,abc' }]);
        expect(result.difficultyLevels).not.toBe(difficultyLevels);
        expect(result.imageLibrary).not.toBe(images);
    });

    it('keeps the PDF instruction and teacher request together', () => {
        expect(buildPdfCustomPrompt('Use chapter 2')).toContain('Yêu cầu thêm từ giáo viên: Use chapter 2');
    });
});
