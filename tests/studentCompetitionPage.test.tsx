import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentCompetitionPage from '../src/features/competition/StudentCompetitionPage';
import type { StudentCompetitionDetail } from '../src/features/competition/studentCompetitionService';
import * as apiAdapter from '../src/services/apiAdapter';

type DetailHasRequiredSlug = StudentCompetitionDetail extends { slug: string } ? true : false;
const detailMustNotRequireSlug: DetailHasRequiredSlug = false;

describe('Student Competition experience', () => {
  void detailMustNotRequireSlug;
  beforeEach(() => vi.restoreAllMocks());

  it('loads the student-scoped campaign, starts a snapshot attempt and submits answers', async () => {
    const callApi = vi.spyOn(apiAdapter, 'callApi').mockImplementation(async (action: string) => {
      if (action === 'list_student_competitions') return { items: [{ id: 'campaign-1', title: 'Hội thi 2026', status: 'ACTIVE' }] };
      if (action === 'get_student_competition') return {
        competition: {
          id: 'campaign-1', title: 'Hội thi 2026', status: 'ACTIVE', eligibility: null,
          rounds: [{ id: 'round-1', roundNumber: 1, status: 'OPEN', maxAttempts: 2, attemptsUsed: 0, passingScore: 7 }],
        },
      };
      if (action === 'get_student_competition_official_result') throw new Error('SCHOOL_EXAM_PUBLICATION_NOT_FOUND');
      if (action === 'start_student_competition_round_attempt') return {
        attempt: { id: 'attempt-1', campaignId: 'campaign-1', roundId: 'round-1', startedAt: new Date().toISOString() },
        quiz: { id: 'quiz-1', title: 'Đề vòng 1', timeLimit: 30, questions: [{ id: 'q-1', type: 'MCQ', question: '1 + 1 = ?', options: ['1', '2'] }] },
      };
      if (action === 'submit_student_competition_round_attempt') return {
        result: { id: 'attempt-1', score: 10, correctCount: 1, totalQuestions: 1, timeTaken: 4, progress: { attemptsUsed: 1, bestScore: 10, isPassed: true } },
      };
      return {};
    });

    render(<StudentCompetitionPage />);
    expect(await screen.findByRole('heading', { name: 'Cuộc thi của em' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Vòng 1' })).toBeInTheDocument();
    expect(screen.getByText('Kết quả chính thức chưa được công bố.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu vòng 1' }));
    expect(await screen.findByRole('heading', { name: 'Đề vòng 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));

    await waitFor(() => expect(callApi).toHaveBeenCalledWith(
      'submit_student_competition_round_attempt',
      expect.objectContaining({
        campaignId: 'campaign-1', roundId: 'round-1', attemptId: 'attempt-1', answers: {},
        idempotencyKey: expect.any(String),
      }),
    ));
    expect(await screen.findByText('Điểm vòng: 10')).toBeInTheDocument();
  });
});
