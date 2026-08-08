import { describe, expect, it } from 'vitest';
import { mapQuestionForSave } from '../workers/src/utils/helpers';
import { sanitizeQuestionForStudent } from '../workers/src/routes/quizzes';
import { QuestionScoringContractValidationError } from '../workers/src/services/questionScoringContract';

describe('canonical scoring persistence', () => {
  it('stores new MCQ correct answers as stable option IDs and marks schema v2', () => {
    const values = mapQuestionForSave({
      id: 'q1', type: 'MCQ', question: '2 + 2?', options: ['3', '4'], correctAnswer: 'B',
    } as any, 'quiz-a');

    expect(values).toHaveLength(27);
    expect(values[4]).toBe('');
    expect(values[6]).toBe('option-1');
    expect(values[26]).toBe('2');
  });

  it('stores drag-drop blanks with stable IDs and correct answers', () => {
    const values = mapQuestionForSave({
      id: 'drag', type: 'DRAG_DROP', question: 'Điền', text: '[a] và [b]',
      blanks: ['xanh', 'đỏ'], distractors: ['vàng'],
    } as any, 'quiz-a');

    expect(JSON.parse(values[9])).toEqual([
      { id: 'blank-0', correctAnswer: 'xanh' },
      { id: 'blank-1', correctAnswer: 'đỏ' },
    ]);
    expect(values[26]).toBe('2');
  });

  it('sanitizes and persists valid SVG while dropping malicious SVG', () => {
    const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="25" /></svg>';
    const valid = mapQuestionForSave({
      id: 'q-svg', type: 'MCQ', question: 'Quan sát hình', options: ['A', 'B'], correctAnswer: 'A',
      svgContent: validSvg, svgAlt: 'Đường tròn tâm O', svgVersion: 1,
    } as any, 'quiz-a');
    expect(valid[24]).toContain('<svg');
    expect(valid[25]).toBe('Đường tròn tâm O');

    const malicious = mapQuestionForSave({
      id: 'q-xss', type: 'MCQ', question: 'Quan sát hình', options: ['A', 'B'], correctAnswer: 'A',
      svgContent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"></svg>',
      svgAlt: 'Hình lỗi', svgVersion: 1,
    } as any, 'quiz-a');
    expect(malicious[24]).toBe('');
    expect(malicious[25]).toBe('');
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

  it('keeps sanitized SVG in student DTO without exposing answers', () => {
    const safe = sanitizeQuestionForStudent({
      id: 'svg', type: 'MCQ', correct_answer: 'A',
      svg_content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2" /></svg>',
      svg_alt: 'Một đường tròn',
    });
    expect(safe.svgContent).toContain('<svg');
    expect(safe.svgAlt).toBe('Một đường tròn');
    expect(safe.svgVersion).toBe(1);
    expect(safe).not.toHaveProperty('correct_answer');
    expect(safe).not.toHaveProperty('svg_content');
  });
});
