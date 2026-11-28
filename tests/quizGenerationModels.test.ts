import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import {
    buildGeneratedQuiz,
    type BuildGeneratedQuizContext,
} from '../src/features/quiz-generator/domain/buildGeneratedQuiz';
import { buildServerQuizGenerationRequest } from '../src/features/quiz-generator/domain/buildServerQuizGenerationRequest';

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const resultContext = (overrides: Partial<BuildGeneratedQuizContext> = {}): BuildGeneratedQuizContext => ({
    editingQuiz: null,
    teacherName: 'Teacher',
    aiBlueprintV3Enabled: true,
    form: {
        classLevel: '4',
        manualTimeLimit: 0,
        requireCode: true,
        accessCode: 'abc',
        showOnHome: true,
        category: 'manual-category',
        tags: ['manual-tag'],
    },
    ...overrides,
});

describe('quiz generation request/result models', () => {
    it('creates new quiz identity and preserves Date.now call order for generated IDs', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-28T10:00:00.000Z'));
        vi.spyOn(Date, 'now')
            .mockReturnValueOnce(111)
            .mockReturnValueOnce(222);

        const mapped = buildGeneratedQuiz(
            {
                questions: [{ type: QuestionType.MCQ, question: 'Thiếu id' }],
            },
            'Đề mới',
            null,
            '',
            [],
            'full',
            resultContext({
                editingQuiz: null,
                teacherName: 'new-teacher',
                form: {
                    classLevel: '4',
                    manualTimeLimit: '',
                    requireCode: false,
                    accessCode: '',
                    showOnHome: false,
                    category: 'toan',
                    tags: [],
                },
            }),
        );

        expect(mapped.id).toBe('quiz-111');
        expect(mapped.questions[0].id).toBe('q-222-0');
        expect(mapped.createdAt).toBe('2026-11-28T10:00:00.000Z');
        expect(mapped.createdBy).toBe('new-teacher');
    });

    it('maps result fields without changing editing identity, clock semantics, or manual metadata', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-28T10:00:00.000Z'));

        const mapped = buildGeneratedQuiz(
            {
                title: '',
                timeLimit: 20,
                promptVersion: 'fixture-prompt',
                questions: [
                    { id: 'existing-question', type: QuestionType.MCQ, question: 'Có sẵn' },
                    { type: QuestionType.MCQ, question: 'Thiếu id' },
                ],
            },
            'Đề mặc định',
            'toan',
            'phân số',
            ['lop_4'],
            'trial',
            resultContext({
                editingQuiz: {
                    id: 'existing-quiz',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    createdBy: 'original-teacher',
                } as never,
            }),
        );

        expect(mapped).toMatchObject({
            id: 'existing-quiz',
            title: 'Đề mặc định',
            createdAt: '2026-01-01T00:00:00.000Z',
            createdBy: 'original-teacher',
            timeLimit: 0,
            accessCode: 'ABC',
            requireCode: true,
            showOnHome: true,
            category: 'manual-category',
            tags: ['manual-tag'],
            detectedCategory: 'toan',
            detectedLesson: 'phân số',
            suggestedTags: ['lop_4'],
            aiGeneration: {
                promptVersion: 'fixture-prompt',
                blueprintVersion: 3,
                generationKind: 'trial',
            },
        });
        expect(mapped.questions[0].id).toBe('existing-question');
        expect(mapped.questions[1].id).toBe('q-1795860000000-1');
    });

    it('builds the server payload with title fallback, allocation filtering, and PDF refs', () => {
        const payload = buildServerQuizGenerationRequest({
            actionId: 'action-0001',
            source: 'system',
            mode: 'pdf',
            generationTopic: 'nguon.pdf',
            generationContent: 'Nội dung OCR',
            questionCount: 2,
            sourcePageNumbers: [1, 3],
            diagramMode: 'auto',
            form: {
                quizTitle: '',
                topic: '',
                uploadedFile: new File(['pdf'], 'nguon.pdf', { type: 'application/pdf' }),
                classLevel: '4',
                quizIntent: 'EXAM',
                difficultyLevels: { level1: 0, level2: 2, level3: 0 },
                promptProfile: { useThongTu27: true, learnerMode: 'default' },
                customPrompt: '  ',
                questionTypeAllocations: [
                    { type: QuestionType.MCQ, count: 2 },
                    { type: QuestionType.TRUE_FALSE, count: 0 },
                    { type: QuestionType.SHORT_ANSWER, count: -1 },
                ],
            },
        });

        expect(payload).toEqual({
            actionId: 'action-0001',
            source: 'system',
            title: 'Đề từ tài liệu: nguon',
            topic: 'nguon.pdf',
            classLevel: '4',
            content: 'Nội dung OCR',
            intent: 'EXAM',
            sourceMode: 'DOCUMENT_TEXT',
            questionCount: 2,
            typeAllocations: [{ type: 'MCQ', count: 2 }],
            difficultyLevels: { level1: 0, level2: 2, level3: 0 },
            promptProfile: { useThongTu27: true, learnerMode: 'default' },
            customPrompt: undefined,
            sourceRefs: ['page-1', 'page-3'],
            diagramMode: 'auto',
        });
    });
});
