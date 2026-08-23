// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildCompetitionQuestionPresentation,
  restoreCompetitionPresentationAnswers,
} from '../workers/src/competition/competitionQuestionPresentation';

describe('Competition student question presentation', () => {
  it('removes answer keys while preserving every interaction surface required by the quiz renderer', () => {
    const quiz = buildCompetitionQuestionPresentation({
      quiz: { id: 'quiz-1', title: 'Vòng 1', time_limit: 30 },
      questions: [
        { id: 'mcq', type: 'MCQ', question: 'Chọn', options: 'A|B', correct_answer: 'B', explanation: 'secret' },
        { id: 'tf', type: 'TRUE_FALSE', question: 'Đúng sai', items: JSON.stringify([{ id: 'tf-1', statement: 'Mệnh đề', isCorrect: true }]) },
        { id: 'match', type: 'MATCHING', question: 'Nối', items: JSON.stringify([{ left: 'A', right: 'X' }, { left: 'B', right: 'Y' }]) },
        { id: 'drag', type: 'DRAG_DROP', question: 'Điền', text_field: '[blank-1]', blanks: JSON.stringify([{ id: 'blank-1', correctAnswer: 'đúng' }]), distractors: JSON.stringify(['sai']) },
        { id: 'dropdown', type: 'DROPDOWN', question: 'Chọn', text_field: '[blank-1]', blanks: JSON.stringify([{ id: 'blank-1', options: ['A', 'B'], correctAnswer: 'B', value: 'B' }]) },
        { id: 'category', type: 'CATEGORIZATION', question: 'Phân loại', items: JSON.stringify([{ id: 'i-1', content: 'Mục', categoryId: 'secret-category' }]), distractors: JSON.stringify([{ id: 'c-1', name: 'Nhóm' }]) },
        { id: 'error', type: 'ERROR_CORRECTION', question: 'Sửa lỗi', text_field: 'Đoạn', distractors: 'từ-sai', correct_answer: 'từ-đúng' },
      ],
    });

    const serialized = JSON.stringify(quiz);
    expect(serialized).not.toMatch(/correctAnswer|correctAnswers|correct_answer|isCorrect|explanation|categoryId|wrongWord/);
    expect(quiz.questions[2]).toMatchObject({
      leftItems: [{ id: 'l-0', content: 'A' }, { id: 'l-1', content: 'B' }],
      rightItems: [{ id: 'r-0', content: 'Y' }, { id: 'r-1', content: 'X' }],
    });
    expect(quiz.questions[2]).not.toHaveProperty('pairs');
    expect(quiz.questions[3]).toMatchObject({
      blanks: [{ id: 'blank-1' }],
      answerPool: ['đúng', 'sai'],
    });
    expect(quiz.questions[4]).toMatchObject({ blanks: [{ id: 'blank-1', options: ['A', 'B'] }] });

    expect(restoreCompetitionPresentationAnswers(
      [{ id: 'match', type: 'MATCHING', items: JSON.stringify([{ left: 'A', right: 'X' }, { left: 'B', right: 'Y' }]) }],
      { match: { 'l-0': 'r-0', 'l-1': 'r-1' } },
    )).toEqual({ match: { 'l-0': 'r-1', 'l-1': 'r-0' } });
  });
});
