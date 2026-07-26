import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecommendationsTab from '../src/components/student/ResultScreen/tabs/RecommendationsTab';
import { buildStudentWeaknessFocus } from '../src/components/student/ResultScreen/studentWeaknessFocus';
import { makeWeaknessProfileSuccess } from './fixtures/weaknessProfile.fixtures';
import { getAIRecommendations, extractWrongAnswers } from '../src/services/aiTutorService';

vi.mock('../src/components/common', () => ({
    MathSpan: ({ content, className }: { content: string; className?: string }) => (
        <span className={className}>{content}</span>
    ),
}));

vi.mock('../src/services/aiTutorService', () => ({
    extractWrongAnswers: vi.fn(() => [
        {
            questionNumber: 1,
            questionText: 'Rut gon phan so 6/8',
            questionType: 'MCQ',
        },
    ]),
    getAIRecommendations: vi.fn(async () => ({
        analysis: 'Em can on lai dang phan so.',
        weakTopics: ['Phan so'],
        studyTips: ['On lai cach rut gon phan so.'],
        encouragement: 'Co gang len, em dang tien bo roi.',
    })),
}));

describe('RecommendationsTab', () => {
    it('renders weakness focus card ahead of AI recommendations', async () => {
        const profile = makeWeaknessProfileSuccess();
        const focus = buildStudentWeaknessFocus(profile.subjects[0].skills[0]);

        render(
            <RecommendationsTab
                quiz={{ id: 'quiz-1', questions: [] } as any}
                result={{ id: 'result-1', correctCount: 3, totalQuestions: 5 } as any}
                answers={{}}
                focus={focus}
            />,
        );

        expect(await screen.findByText('Uu tien on Phan so')).toBeInTheDocument();
        expect(screen.getByText(focus.nextStepLabel)).toBeInTheDocument();
        expect(screen.getByText(focus.nextStepHint)).toBeInTheDocument();
        expect(screen.getByText('Nhận xét từ bài làm')).toBeInTheDocument();
        expect(extractWrongAnswers).toHaveBeenCalled();
        expect(getAIRecommendations).toHaveBeenCalled();
    });
});
