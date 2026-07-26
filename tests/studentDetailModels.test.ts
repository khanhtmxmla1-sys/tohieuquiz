import { describe, expect, it } from 'vitest';
import {
    buildDisplayQuestions,
    filterDisplayQuestions,
    getQuestionResultCounts,
    getQuestionTypeLabel,
} from '../src/components/teacher/ResultsView/student-detail/models/questionModel';
import {
    getFocusSkills,
    getSkillStatusLabel,
    shouldShowCoverageWarning,
} from '../src/components/teacher/ResultsView/student-detail/models/weaknessModel';
import {
    studentDetailQuestions,
    studentDetailResult,
} from './fixtures/studentDetailModalFixture';

const weaknessProfile = {
    coveragePercent: 70,
    unclassifiedQuestionCount: 2,
    subjects: [{
        skills: [
            { subject: 'math', subjectLabel: 'Toán', skillCode: 'a', skillLabel: 'Cộng', status: 'needs_practice', accuracy: 60, attempted: 5, wrong: 2 },
            { subject: 'math', subjectLabel: 'Toán', skillCode: 'b', skillLabel: 'Trừ', status: 'weak', accuracy: 25, attempted: 4, wrong: 3 },
            { subject: 'math', subjectLabel: 'Toán', skillCode: 'c', skillLabel: 'Nhân', status: 'stable', accuracy: 90, attempted: 5, wrong: 0 },
            { subject: 'math', subjectLabel: 'Toán', skillCode: 'd', skillLabel: 'Chia', status: 'weak', accuracy: 40, attempted: 5, wrong: 3 },
        ],
    }],
} as any;

describe('student detail question model', () => {
    it('uses snapshots and keeps empty answers as skipped even when persisted as correct', () => {
        const questions = buildDisplayQuestions(studentDetailResult, studentDetailQuestions);
        expect(questions.map(({ id, question, isCorrect }) => ({ id, question, isCorrect }))).toEqual([
            { id: 'q1', question: 'Hai cộng hai bằng bao nhiêu?', isCorrect: true },
            { id: 'q2', question: 'Viết số liền sau số 9', isCorrect: undefined },
        ]);
        expect(getQuestionResultCounts(questions)).toEqual({ correctCount: 1, wrongCount: 0 });
        expect(filterDisplayQuestions(questions, 'wrong')).toHaveLength(0);
    });

    it('treats matching shuffle metadata without any pair as skipped', () => {
        const questions = buildDisplayQuestions({
            ...studentDetailResult,
            answers: {
                matching: {
                    selectedAnswer: { __shuffledIds: ['r-1', 'r-0'] },
                    isCorrect: false,
                    questionSnapshot: {
                        id: 'matching',
                        type: 'MATCHING',
                        question: 'Nối cặp',
                        pairs: [
                            { left: 'Một', right: '1' },
                            { left: 'Hai', right: '2' },
                        ],
                    },
                },
            },
        }, []);

        expect(questions).toHaveLength(1);
        expect(questions[0].isCorrect).toBeUndefined();
    });

    it('keeps an empty review when legacy answers contain metadata only', () => {
        expect(buildDisplayQuestions({
            ...studentDetailResult,
            answers: { _metadata: { source: 'legacy' } },
        }, studentDetailQuestions)).toEqual([]);
    });

    it('keeps the existing short type labels and fallback', () => {
        expect(getQuestionTypeLabel('TRUE_FALSE')).toBe('ĐS');
        expect(getQuestionTypeLabel('UNKNOWN_TYPE')).toBe('UNK');
        expect(getQuestionTypeLabel('')).toBe('?');
    });
});

describe('student detail weakness model', () => {
    it('prioritizes weak skills by accuracy and limits the list to three', () => {
        expect(getFocusSkills(weaknessProfile).map((skill) => skill.skillCode)).toEqual(['b', 'd', 'a']);
        expect(getSkillStatusLabel('weak')).toBe('Can uu tien');
        expect(getSkillStatusLabel('needs_practice')).toBe('Can luyen them');
    });

    it('warns when coverage is below 80 or questions remain unclassified', () => {
        expect(shouldShowCoverageWarning(weaknessProfile)).toBe(true);
        expect(shouldShowCoverageWarning({
            ...weaknessProfile, coveragePercent: 100, unclassifiedQuestionCount: 0,
        })).toBe(false);
    });
});
