import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';

const mocks = vi.hoisted(() => ({ getAIRecommendations: vi.fn() }));
vi.mock('../src/services/aiTutorService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/services/aiTutorService');
  return { ...actual, getAIRecommendations: mocks.getAIRecommendations };
});

import ResultScreen from '../src/components/student/ResultScreen';

const quiz: Quiz = {
  id: 'quiz-study-plan',
  title: 'Ôn tập Toán',
  classLevel: '5',
  category: 'toan',
  timeLimit: 20,
  createdAt: '2026-07-20T00:00:00.000Z',
  questions: [
    { id: 'q1', type: QuestionType.MCQ, question: '2 + 2 bằng mấy?', options: ['3', '4'], correctAnswer: 'B' },
    { id: 'q2', type: QuestionType.MCQ, question: '3 + 3 bằng mấy?', options: ['5', '6'], correctAnswer: 'B' },
  ],
};

const result: StudentResult = {
  id: 'result-study-plan',
  quizId: quiz.id,
  quizTitle: quiz.title,
  studentName: 'An',
  studentClass: '5A',
  score: 5,
  correctCount: 1,
  totalQuestions: 2,
  timeTaken: 2,
  submittedAt: '2026-07-20T00:00:00.000Z',
  answers: {
    q1: { selectedAnswer: 'A', isCorrect: false, questionSnapshot: quiz.questions[0] },
    q2: { selectedAnswer: 'B', isCorrect: true, questionSnapshot: quiz.questions[1] },
  },
};

describe('student study plan', () => {
  it('loads AI guidance only after the student opens the study-plan tab', async () => {
    mocks.getAIRecommendations.mockResolvedValue({
      analysis: 'Em cần xem lại phép cộng cơ bản.',
      weakTopics: ['Phép cộng'],
      studyTips: ['Làm lại câu đã sai', 'Dùng que tính để kiểm tra'],
      encouragement: 'Em đang tiến bộ, tiếp tục nhé!',
    });

    render(
      <ResultScreen
        quiz={quiz}
        result={result}
        answers={{ q1: 'A', q2: 'B' }}
        onExit={vi.fn()}
      />,
    );

    expect(mocks.getAIRecommendations).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Kế hoạch ôn tập' }));

    await waitFor(() => expect(mocks.getAIRecommendations).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Em cần xem lại phép cộng cơ bản.')).toBeInTheDocument();
    expect(screen.getByText('Em cần ôn lại')).toBeInTheDocument();
    expect(screen.getByText('Gợi ý học tập')).toBeInTheDocument();
    expect(screen.getByText('Gợi ý này mang tính định hướng vì bài làm hiện có ít câu sai.')).toBeInTheDocument();
    expect(screen.queryByText(/Chi tiết/i)).not.toBeInTheDocument();
  });
});
