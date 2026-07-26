import { describe, expect, it } from 'vitest';
import { parseGeneratedQuiz } from '../src/services/ai/schemas/quizGenerationSchema';

const common = {
  explanation: 'Giải thích đầy đủ.',
  difficultyLevel: 2,
};

describe('generated quiz schema', () => {
  it('rejects MCQ when correctAnswer is outside the option range', () => {
    expect(() => parseGeneratedQuiz({
      title: 'Đề',
      questions: [{
        type: 'MCQ',
        question: '1 + 1 = ?',
        options: ['1', '2'],
        correctAnswer: 'D',
        ...common,
      }],
    })).toThrow();
  });

  it('rejects empty categorization content instead of inventing placeholders', () => {
    expect(() => parseGeneratedQuiz({
      title: 'Đề',
      questions: [{
        type: 'CATEGORIZATION',
        question: 'Phân loại',
        categories: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
        items: [{ id: 'i1', content: '', categoryId: 'a' }],
        ...common,
      }],
    })).toThrow();
  });

  it('accepts a matching question with three unique pairs', () => {
    const parsed = parseGeneratedQuiz({
      title: 'Đề',
      questions: [{
        type: 'MATCHING',
        question: 'Nối phép tính với kết quả',
        pairs: [
          { left: '1 + 1', right: '2' },
          { left: '2 + 2', right: '4' },
          { left: '3 + 3', right: '6' },
        ],
        ...common,
      }],
    });

    expect(parsed.questions).toHaveLength(1);
  });

  it('rejects multiple-select answers that are duplicated or outside the options', () => {
    expect(() => parseGeneratedQuiz({
      title: 'Đề',
      questions: [{
        type: 'MULTIPLE_SELECT',
        question: 'Chọn hai số chẵn',
        options: ['1', '2', '3', '4'],
        correctAnswers: ['B', 'B'],
        ...common,
      }],
    })).toThrow();
  });

  it('rejects drag-drop text when placeholder count differs from blanks', () => {
    expect(() => parseGeneratedQuiz({
      title: 'Đề',
      questions: [{
        type: 'DRAG_DROP',
        question: 'Điền từ',
        text: 'Bầu trời có màu [xanh].',
        blanks: ['xanh', 'cao'],
        distractors: ['đỏ'],
        ...common,
      }],
    })).toThrow();
  });

  it('rejects ordering when correctOrder is not a permutation', () => {
    expect(() => parseGeneratedQuiz({
      title: 'Đề',
      questions: [{
        type: 'ORDERING',
        question: 'Sắp xếp',
        items: ['A', 'B', 'C'],
        correctOrder: [0, 0, 2],
        ...common,
      }],
    })).toThrow();
  });

  it('rejects categorization items whose categoryId is empty or unknown', () => {
    expect(() => parseGeneratedQuiz({
      title: 'Đề phân loại',
      questions: [{
        type: 'CATEGORIZATION',
        question: 'Phân loại',
        categories: [
          { id: 'nhom-1', name: 'Nhóm 1' },
          { id: 'nhom-2', name: 'Nhóm 2' },
        ],
        items: [
          { id: 'item-1', content: 'Mục hợp lệ', categoryId: 'nhom-1' },
          { id: 'item-2', content: 'Mục lỗi', categoryId: '' },
        ],
        explanation: 'Giải thích đầy đủ.',
        difficultyLevel: 2,
      }],
    })).toThrow();
  });

  it('rejects dropdown blanks represented as plain strings', () => {
    expect(() => parseGeneratedQuiz({
      title: 'Đề dropdown',
      questions: [{
        type: 'DROPDOWN',
        question: 'Chọn đáp án',
        text: 'Thủ đô Việt Nam là [1].',
        blanks: ['Hà Nội'],
        explanation: 'Hà Nội là thủ đô Việt Nam.',
        difficultyLevel: 1,
      }],
    })).toThrow();
  });
});
