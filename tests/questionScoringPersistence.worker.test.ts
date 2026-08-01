import { describe, expect, it } from 'vitest';
import { mapQuestionForSave } from '../workers/src/utils/helpers';
import { sanitizeQuestionForStudent } from '../workers/src/routes/quizzes';
import { QuestionScoringContractValidationError } from '../workers/src/services/questionScoringContract';

describe('canonical scoring persistence', () => {
  it('stores new MCQ correct answers as stable option IDs and marks schema v2', () => {
    const values = mapQuestionForSave({
      id: 'q1', type: 'MCQ', question: '2 + 2?', options: ['3', '4'], correctAnswer: 'B',
    } as any, 'quiz-a');

    expect(values).toHaveLength(24);
    expect(values[5]).toBe('option-1');
    expect(values[23]).toBe('2');
  });

  it('stores drag-drop blanks with stable IDs and correct answers', () => {
    const values = mapQuestionForSave({
      id: 'drag', type: 'DRAG_DROP', question: 'Điền', text: '[a] và [b]',
      blanks: ['xanh', 'đỏ'], distractors: ['vàng'],
    } as any, 'quiz-a');

    expect(JSON.parse(values[8])).toEqual([
      { id: 'blank-0', correctAnswer: 'xanh' },
      { id: 'blank-1', correctAnswer: 'đỏ' },
    ]);
    expect(values[23]).toBe('2');
  });

  it('rejects ungradable question contracts at the API persistence boundary', () => {
    expect(() => mapQuestionForSave({
      id: 'geometry', type: 'GEOMETRY', question: 'Hình học', geometryData: {},
    } as any, 'quiz-a')).toThrow(QuestionScoringContractValidationError);
  });

  it('gives student matching DTOs stable IDs independent of content', () => {
    const safe = sanitizeQuestionForStudent({
      id: 'match', type: 'MATCHING',
      items: JSON.stringify([{ left: 'A', right: '1' }, { left: 'A', right: '2' }]),
    });
    expect(JSON.parse(safe.left_items)).toEqual([
      { id: 'left-0', content: 'A' },
      { id: 'left-1', content: 'A' },
    ]);
    expect(JSON.parse(safe.right_items).map((item: any) => item.id).sort()).toEqual(['right-0', 'right-1']);
  });

  it('preserves drag-drop blank IDs without exposing correct answers', () => {
    const safe = sanitizeQuestionForStudent({
      id: 'drag', type: 'DRAG_DROP', text_field: '[a] và [b]',
      blanks: JSON.stringify([
        { id: 'custom-a', correctAnswer: 'xanh' },
        { id: 'custom-b', correctAnswer: 'đỏ' },
      ]),
      distractors: JSON.stringify(['vàng']),
    });
    expect(JSON.parse(safe.blanks)).toEqual([{ id: 'custom-a' }, { id: 'custom-b' }]);
    expect(JSON.parse(safe.distractors).sort()).toEqual(['vàng', 'xanh', 'đỏ'].sort());
    expect(JSON.stringify(safe)).not.toContain('correctAnswer');
  });
});
