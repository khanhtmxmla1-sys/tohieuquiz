import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { buildPrompt } from '../src/services/ai/prompts/quizPromptBuilder';
import type { QuizGenerationOptions } from '../src/services/geminiService';

const makeOptions = (intent: 'EXAM' | 'PRACTICE'): QuizGenerationOptions => ({
  title: 'Đề phân số',
  questionCount: 10,
  questionTypes: [
    QuestionType.MCQ,
    QuestionType.TRUE_FALSE,
    QuestionType.SHORT_ANSWER,
    QuestionType.MATCHING,
  ],
  difficultyLevels: { level1: 3, level2: 5, level3: 2 },
  blueprint: {
    intent,
    sourceMode: 'TOPIC',
    totalQuestions: 10,
    typeAllocations: [
      { type: QuestionType.MCQ, count: 4 },
      { type: QuestionType.TRUE_FALSE, count: 2 },
      { type: QuestionType.SHORT_ANSWER, count: 2 },
      { type: QuestionType.MATCHING, count: 2 },
    ],
    difficultyLevels: { level1: 3, level2: 5, level3: 2 },
  },
});

const interactiveOptions: QuizGenerationOptions = {
  title: 'Đề tương tác',
  questionCount: 2,
  questionTypes: [QuestionType.DROPDOWN, QuestionType.CATEGORIZATION],
  difficultyLevels: { level1: 1, level2: 1, level3: 0 },
  blueprint: {
    intent: 'PRACTICE',
    sourceMode: 'TOPIC',
    totalQuestions: 2,
    typeAllocations: [
      { type: QuestionType.DROPDOWN, count: 1 },
      { type: QuestionType.CATEGORIZATION, count: 1 },
    ],
    difficultyLevels: { level1: 1, level2: 1, level3: 0 },
  },
};

describe('quiz prompt builder blueprint contract', () => {
  it('writes exact question counts for every selected type', () => {
    const prompt = buildPrompt('Phân số', '4', '', makeOptions('EXAM'));

    expect(prompt).toContain('MCQ: 4 câu');
    expect(prompt).toContain('TRUE_FALSE: 2 câu');
    expect(prompt).toContain('SHORT_ANSWER: 2 câu');
    expect(prompt).toContain('MATCHING: 2 câu');
  });

  it('uses exam rules without hints', () => {
    const prompt = buildPrompt('Phân số', '4', '', makeOptions('EXAM'));

    expect(prompt).toContain('[INTENT: EXAM]');
    expect(prompt).toContain('Không đưa gợi ý trong nội dung câu hỏi');
    expect(prompt).not.toContain('Lời giải phải hướng dẫn từng bước');
  });

  it('uses practice rules with learning feedback', () => {
    const prompt = buildPrompt('Phân số', '4', '', makeOptions('PRACTICE'));

    expect(prompt).toContain('[INTENT: PRACTICE]');
    expect(prompt).toContain('Lời giải phải hướng dẫn từng bước');
    expect(prompt).not.toContain('Không đưa gợi ý trong nội dung câu hỏi');
  });

  it('includes exact dropdown and categorization JSON contracts', () => {
    const prompt = buildPrompt('Từ loại', '4', '', interactiveOptions);

    expect(prompt).toContain(
      '"blanks":[{"id":"1","options":["lựa chọn 1","lựa chọn 2"],"correctAnswer":"lựa chọn 1"}]',
    );
    expect(prompt).toContain(
      '"categories":[{"id":"nhom-1","name":"Tên nhóm 1"},{"id":"nhom-2","name":"Tên nhóm 2"}]',
    );
    expect(prompt).toContain(
      '"items":[{"id":"item-1","content":"Nội dung cần phân loại","categoryId":"nhom-1"}]',
    );
    expect(prompt).toContain(
      'Mỗi items[].categoryId phải trùng chính xác với một categories[].id đã khai báo',
    );
  });
});
