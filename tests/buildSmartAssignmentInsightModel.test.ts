import { describe, expect, it } from 'vitest';
import type { Quiz } from '../src/types';
import type { AssignmentComposerDraft } from '../src/stores/useTeacherDashboardUIStore';
import type { SmartAssignmentWarning } from '../src/types/classroom.types';
import { buildSmartAssignmentInsightModel } from '../src/components/TeacherDashboard/buildSmartAssignmentInsightModel';

const quizzes: Quiz[] = [
    {
        id: 'quiz-phan-so-01',
        title: 'On luyen phan so co ban',
        classLevel: '2',
        category: 'on-tap',
        timeLimit: 15,
        createdAt: '2026-04-22T10:00:00.000Z',
        questions: [],
    },
    {
        id: 'quiz-khac',
        title: 'On tap tong hop cuoi tuan',
        classLevel: '2',
        category: 'on-tap',
        timeLimit: 20,
        createdAt: '2026-04-22T10:00:00.000Z',
        questions: [],
    },
];

const draft: AssignmentComposerDraft = {
    source: 'smart-preview',
    sourceResultId: 'result-301',
    studentName: 'Lan',
    className: '2A',
    classId: 'c-001',
    studentId: 's-001',
    quizId: 'quiz-phan-so-01',
    deadline: '2026-04-29T16:59:00.000Z',
    maxAttempts: 1,
    weaknessSummary: {
        skillCode: 'phan_so',
        skillLabel: 'Phan so',
        subskillCode: 'rut_gon_phan_so',
        subskillLabel: 'Rut gon phan so',
        status: 'weak',
        accuracy: 25,
        coveragePercent: 100,
        targetDifficulty: 1,
    },
    recommendedQuizzes: [
        {
            quizId: 'quiz-phan-so-01',
            title: 'On luyen phan so co ban',
            matchReason: 'Khop sat subskill Rut gon phan so',
            questionCount: 10,
            timeLimit: 15,
            confidence: 0.95,
            matchBreakdown: {
                subjectMatched: true,
                skillMatched: true,
                subskillMatched: true,
                matchedViaTags: false,
                avgDifficulty: 1,
                targetDifficulty: 1,
                difficultyDistance: 0,
                totalScore: 94,
            },
        },
    ],
    warnings: [],
    createdAt: '2026-04-24T07:00:00.000Z',
};

describe('buildSmartAssignmentInsightModel', () => {
    it('returns review when the recommended quiz is no longer available in the selector', () => {
        const warnings: SmartAssignmentWarning[] = [
            {
                code: 'QUIZ_NOT_FOUND',
                message: 'De goi y khong con ton tai. Thay co vui long chon mot de khac.',
            },
        ];

        const model = buildSmartAssignmentInsightModel({
            activeDraft: {
                ...draft,
                warnings,
            },
            quizzes,
            selectedQuizId: '',
            selectedClassId: 'c-001',
            selectedStudentId: 's-001',
            selectedRecommendedQuiz: undefined,
            draftWarnings: warnings,
            manualNotice: null,
            tagsFallbackMessage: 'Fallback tu tags.',
        });

        expect(model?.state).toBe('review');
        expect(model?.summary).toMatch(/chon lai de bai/i);
        expect(model?.warningMessages).toContain('De goi y khong con ton tai. Thay co vui long chon mot de khac.');
    });

    it('returns manual-adjusted when the teacher changes the selected quiz', () => {
        const model = buildSmartAssignmentInsightModel({
            activeDraft: draft,
            quizzes,
            selectedQuizId: 'quiz-khac',
            selectedClassId: 'c-001',
            selectedStudentId: 's-001',
            selectedRecommendedQuiz: undefined,
            draftWarnings: [],
            manualNotice: null,
            tagsFallbackMessage: 'Fallback tu tags.',
        });

        expect(model?.state).toBe('manual-adjusted');
        expect(model?.quizTitle).toBe('On tap tong hop cuoi tuan');
        expect(model?.summary).toMatch(/Ban da chinh de bai hoac doi tuong khac so voi goi y ban dau/i);
    });

    it('returns low-confidence when metadata coverage is low and warnings exist', () => {
        const warnings: SmartAssignmentWarning[] = [
            {
                code: 'LOW_METADATA_COVERAGE',
                message: 'Do phu metadata chua cao, thay co nen xem nhanh de bai truoc khi giao.',
            },
        ];

        const model = buildSmartAssignmentInsightModel({
            activeDraft: {
                ...draft,
                warnings,
                weaknessSummary: {
                    ...draft.weaknessSummary!,
                    coveragePercent: 55,
                },
                recommendedQuizzes: [
                    {
                        ...draft.recommendedQuizzes![0],
                        confidence: 0.45,
                    },
                ],
            },
            quizzes,
            selectedQuizId: 'quiz-phan-so-01',
            selectedClassId: 'c-001',
            selectedStudentId: 's-001',
            selectedRecommendedQuiz: {
                ...draft.recommendedQuizzes![0],
                confidence: 0.45,
            },
            draftWarnings: warnings,
            manualNotice: null,
            tagsFallbackMessage: 'Fallback tu tags.',
        });

        expect(model?.state).toBe('low-confidence');
        expect(model?.confidencePercent).toBe(45);
        expect(model?.warningMessages).toContain('Do phu metadata chua cao, thay co nen xem nhanh de bai truoc khi giao.');
        expect(model?.warningMessages).toContain('Do phu metadata duoi 60%, thay co nen xem nhanh de bai truoc khi giao.');
    });
});
