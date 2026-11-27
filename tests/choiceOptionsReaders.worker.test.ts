// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { parseChoiceOptions } from '../workers/src/services/choiceOptions';
import { mapLiveExamQuestionRow } from '../workers/src/services/liveExamQuestionMapper';
import { mapPracticeSourceRow } from '../workers/src/services/practiceGrading';

describe('shared choice option readers', () => {
  it('keeps native and JSON arrays as values, reads legacy pipe text, and fails closed', () => {
    const objectOptions = [{ text: 'A' }, { content: 'B' }];
    expect(parseChoiceOptions(objectOptions)).toBe(objectOptions);
    expect(parseChoiceOptions('[{"text":"A"},{"content":"B"}]')).toEqual(objectOptions);
    expect(parseChoiceOptions('A|B|C')).toEqual(['A', 'B', 'C']);
    expect(parseChoiceOptions(' A|B ')).toEqual([' A', 'B ']);
    expect(parseChoiceOptions('')).toEqual([]);
    expect(parseChoiceOptions('malformed')).toEqual([]);
  });

  it('lets live exam mapping convert parsed values to its string contract', () => {
    expect(mapLiveExamQuestionRow({
      id: 'live-json',
      type: 'MCQ',
      question: 'Chọn',
      options: '["A","B"]',
      correct_answer: 'A',
    }).options).toEqual(['A', 'B']);
  });

  it('keeps practice source options renderable from JSON arrays', () => {
    expect(mapPracticeSourceRow({
      id: 'practice-json',
      quiz_id: 'quiz-practice',
      type: 'MCQ',
      question: 'Chọn',
      options: '["A","B"]',
      correct_answer: 'A',
    }).options).toEqual(['A', 'B']);
  });
});
