import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';

const mocks = vi.hoisted(() => ({ requestWorkerAiText: vi.fn() }));
vi.mock('../src/services/ai/workerAiClient', () => ({
  requestWorkerAiText: mocks.requestWorkerAiText,
}));

import {
  extractWrongAnswers,
  getAIRecommendations,
} from '../src/services/aiTutorService';

const quiz: Quiz = {
  id: 'quiz-ai-context',
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
  id: 'result-ai',
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
    q2: { selectedAnswer: '', isCorrect: false, questionSnapshot: quiz.questions[1] },
  },
  validationDetails: [
    { questionId: 'q1', isCorrect: false, correctAnswer: 'B' },
    { questionId: 'q2', isCorrect: false, correctAnswer: 'B' },
  ],
};

describe('AI tutor result context', () => {
  beforeEach(() => {
    mocks.requestWorkerAiText.mockReset();
    mocks.requestWorkerAiText.mockResolvedValue(JSON.stringify({
      analysis: 'Em cần xem lại phép cộng.',
      weakTopics: ['Phép cộng'],
      studyTips: ['Làm lại câu đã sai'],
      encouragement: 'Em tiếp tục cố gắng nhé!',
    }));
  });

  it('excludes skipped questions from weakness analysis', () => {
    const wrongAnswers = extractWrongAnswers(quiz, { q1: 'A', q2: '' }, result);

    expect(wrongAnswers).toHaveLength(1);
    expect(wrongAnswers[0]).toMatchObject({ questionNumber: 1, userAnswer: 'A' });
  });

  it('sends score and accuracy as separate units to the AI', async () => {
    const wrongAnswers = extractWrongAnswers(quiz, { q1: 'A', q2: '' }, result);
    await getAIRecommendations(quiz, result, wrongAnswers);

    const request = mocks.requestWorkerAiText.mock.calls[0][0];
    const systemPrompt = request.messages.find((message: any) => message.role === 'system')?.content ?? '';
    const prompt = request.messages.find((message: any) => message.role === 'user')?.content ?? '';

    expect(systemPrompt).toContain('gia sư AI thân thiện');
    expect(systemPrompt).not.toContain('B?n');
    expect(prompt).toContain('Điểm: 5/10');
    expect(prompt).toContain('Độ chính xác: 50%');
    expect(prompt).not.toContain('Điểm: 5%');
  });
});
