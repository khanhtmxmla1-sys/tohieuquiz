import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuizStore } from '../stores/quizStore';
import TeacherResultDetailPage from '../src/components/TeacherDashboard/TeacherResultDetailPage';
import { fetchResultAnswerReview } from '../src/services/results/resultAnswersService';

vi.mock('../src/components/teacher/ResultsView', () => ({
    StudentDetailModal: ({ result }: any) => (
        <>
            <div data-testid="resolved-review-count">{result.reviewDetails?.length ?? 0}</div>
            <div data-testid="resolved-selected-answer">{result.answers?.q1?.selectedAnswer ?? ''}</div>
        </>
    ),
}));

vi.mock('../src/services/results/resultAnswersService', () => ({
    fetchResultAnswers: vi.fn(),
    fetchResultAnswerReview: vi.fn(),
}));

const fetchReviewMock = vi.mocked(fetchResultAnswerReview);
const originalQuizState = useQuizStore.getState();

describe('TeacherResultDetailPage review hydration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useQuizStore.setState({
            ...originalQuizState,
            quizzes: [{ id: 'quiz-1', questions: [] } as any],
            results: [{
                id: 'result-1',
                quizId: 'quiz-1',
                studentName: 'An',
                score: 1,
                submittedAt: '2026-08-10T10:00:00.000Z',
                answers: { q1: { selectedAnswer: 'A', isCorrect: true } },
            } as any],
        }, true);
    });

    it('hydrates reviewDetails even when answers are already present', async () => {
        fetchReviewMock.mockResolvedValue({
            answers: {},
            reviewDetails: [{
                questionId: 'q1',
                type: 'MCQ',
                status: 'correct',
                isCorrect: true,
                studentAnswer: { kind: 'text', lines: [{ value: 'A' }] },
                correctAnswer: { kind: 'text', lines: [{ value: 'A' }] },
            }],
        });

        render(
            <MemoryRouter initialEntries={['/teacher/results/result-1']}>
                <Routes>
                    <Route path="/teacher/results/:resultId" element={<TeacherResultDetailPage />} />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => expect(fetchReviewMock).toHaveBeenCalledWith('result-1'));
        expect(await screen.findByTestId('resolved-review-count')).toHaveTextContent('1');
        expect(screen.getByTestId('resolved-selected-answer')).toHaveTextContent('A');
    });
});
