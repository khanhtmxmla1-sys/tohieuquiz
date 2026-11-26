// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  decodeStudentAnswersForGrading,
  toStudentQuestionDto,
} from '../workers/src/services/studentQuizQuestionDto';

const context = {
  quizId: 'quiz-1',
  revision: 3,
  scope: 'student:student-a:quiz-1:assignment-1',
  key: 'dto-test-secret',
};

const matchingQuestion = {
  id: 'matching-1',
  type: 'MATCHING',
  question: 'Nối cột',
  pairs: [
    { left: 'A', right: 'X' },
    { left: 'B', right: 'Y' },
    { left: 'C', right: 'X' },
  ],
  explanation: 'must not be sent',
};

const dragDropQuestion = {
  id: 'drag-1',
  type: 'DRAG_DROP',
  text: 'Chọn [1], [2] và [3]',
  blanks: [
    { id: 'drag-a', correctAnswer: 'X' },
    { id: 'drag-b', correctAnswer: 'Y' },
    { id: 'drag-c', correctAnswer: 'X' },
  ],
  distractors: ['Z'],
};

const underlineQuestion = {
  id: 'underline-1',
  type: 'UNDERLINE',
  sentence: 'Em học bài.',
  words: ['Em', 'học', 'bài'],
  correctWordIndexes: [1],
  questionRichText: {
    schemaVersion: 1,
    doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Em học bài.' }] }] },
  },
};

describe('student quiz question DTO', () => {
  it('preserves legacy pipe-separated options for choice questions without exposing answer keys', async () => {
    const questions = [
      { id: 'mcq-legacy', type: 'MCQ', question: 'Chọn một', options: 'A|B|C|D', correct_answer: 'B' },
      { id: 'multi-legacy', type: 'MULTIPLE_SELECT', question: 'Chọn nhiều', options: 'A|B|C|D', correct_answer: '["A","C"]' },
      { id: 'image-legacy', type: 'IMAGE_QUESTION', question: 'Chọn hình', options: 'A|B|C|D', correct_answer: 'A' },
    ];

    for (const question of questions) {
      const dto = await toStudentQuestionDto(question, context);
      expect(dto.options).toEqual(['A', 'B', 'C', 'D']);
      expect(dto).not.toHaveProperty('correct_answer');
      expect(dto).not.toHaveProperty('correctAnswer');
      expect(JSON.stringify(dto)).not.toMatch(/correctAnswer|correct_answer/);
    }
  });

  it('keeps modern option arrays and fails closed for malformed scalar options', async () => {
    const nativeArray = await toStudentQuestionDto({
      id: 'mcq-native', type: 'MCQ', question: 'Mảng', options: ['A', 'B'],
    }, context);
    const jsonArray = await toStudentQuestionDto({
      id: 'mcq-json', type: 'MCQ', question: 'JSON', options: '["A","B"]',
    }, context);
    const empty = await toStudentQuestionDto({
      id: 'mcq-empty', type: 'MCQ', question: 'Rỗng', options: '',
    }, context);
    const malformed = await toStudentQuestionDto({
      id: 'mcq-malformed', type: 'MCQ', question: 'Sai định dạng', options: 'not-an-array',
    }, context);

    expect(nativeArray.options).toEqual(['A', 'B']);
    expect(jsonArray.options).toEqual(['A', 'B']);
    expect(empty.options).toEqual([]);
    expect(malformed.options).toEqual([]);
  });

  it('does not expose matching pairs or correlated canonical IDs', async () => {
    const dto = await toStudentQuestionDto(matchingQuestion, context);
    const raw = JSON.stringify(dto);

    expect(dto.type).toBe('MATCHING');
    expect(dto).not.toHaveProperty('pairs');
    expect(raw).not.toContain('correct');
    expect(dto.leftItems).toHaveLength(3);
    expect(dto.rightItems).toHaveLength(3);
    expect(dto.leftItems.every((item: any) => item.id !== 'left-0')).toBe(true);
    expect(dto.rightItems.every((item: any) => item.id !== 'right-0')).toBe(true);
    expect(dto.leftItems.map((item: any) => item.id)).not.toEqual(dto.rightItems.map((item: any) => item.id));
  });

  it('keeps duplicate right content independently addressable', async () => {
    const dto = await toStudentQuestionDto(matchingQuestion, context);
    expect(dto.rightItems.filter((item: any) => item.content === 'X')).toHaveLength(2);
    expect(new Set(dto.rightItems.filter((item: any) => item.content === 'X').map((item: any) => item.id)).size).toBe(2);
  });

  it('builds a drag-drop answer pool with duplicate occurrences and no answer fields', async () => {
    const dto = await toStudentQuestionDto(dragDropQuestion, context);
    const repeat = await toStudentQuestionDto(dragDropQuestion, context);
    const otherScope = await toStudentQuestionDto(dragDropQuestion, { ...context, scope: 'student:student-b:quiz-1' });
    expect(dto.type).toBe('DRAG_DROP');
    expect(dto).not.toHaveProperty('distractors');
    expect(dto.answerPool).toEqual(expect.arrayContaining(['X', 'X', 'Y', 'Z']));
    expect(dto.answerPool.filter((value: string) => value === 'X')).toHaveLength(2);
    expect(dto.answerPool).toEqual(repeat.answerPool);
    expect(dto.answerPool).not.toEqual(['X', 'Y', 'X', 'Z']);
    expect(otherScope.answerPool).not.toEqual(dto.answerPool);
    expect(dto.blanks.every((blank: any) => blank.id && !('correctAnswer' in blank))).toBe(true);
    expect(JSON.stringify(dto)).not.toContain('correctAnswer');
  });

  it('preserves underline content and rich text while omitting indexes', async () => {
    const dto = await toStudentQuestionDto(underlineQuestion, context);
    expect(dto.sentence).toBe('Em học bài.');
    expect(dto.words).toEqual(['Em', 'học', 'bài']);
    expect(dto.questionRichText).toEqual(underlineQuestion.questionRichText);
    expect(dto).not.toHaveProperty('correctWordIndexes');
  });

  it('uses explicit safe fields for structured question types', async () => {
    const trueFalse = await toStudentQuestionDto({
      id: 'tf-1', type: 'TRUE_FALSE', question: 'Đọc',
      items: [{ id: 'a', statement: 'Mệnh đề', isCorrect: true, correctAnswer: 'leak' }],
    }, context);
    const categorization = await toStudentQuestionDto({
      id: 'cat-1', type: 'CATEGORIZATION', question: 'Phân loại',
      categories: [{ id: 'yes', name: 'Có', categoryId: 'secret' }],
      items: [{ id: 'item-1', content: 'Nội dung', categoryId: 'yes', correctAnswer: 'leak' }],
    }, context);
    const riddle = await toStudentQuestionDto({
      id: 'riddle-1', type: 'RIDDLE', question: 'Đố vui',
      riddleLines: ['Dòng 1'], correctAnswer: 'đáp án bí mật', answerLabel: 'Trả lời',
    }, context);
    const errorCorrection = await toStudentQuestionDto({
      id: 'error-1', type: 'ERROR_CORRECTION', question: 'Tìm lỗi',
      passage: 'Em đi học.', wrongWord: 'họk', correctWord: 'học',
    }, context);
    const svg = await toStudentQuestionDto({
      id: 'svg-1', type: 'MCQ', question: 'Hình', options: ['A'],
      svgContent: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle cx="1" cy="1" r="1" onload="alert(1)"/></svg>',
      svgAlt: 'Hình tròn',
    }, context);

    expect(trueFalse.items).toEqual([{ id: 'a', statement: 'Mệnh đề' }]);
    expect(categorization.categories).toEqual([{ id: 'yes', name: 'Có' }]);
    expect(categorization.items).toEqual([{ id: 'item-1', content: 'Nội dung' }]);
    expect(riddle.riddleLines).toEqual(['Dòng 1']);
    expect(errorCorrection.passage).toBe('Em đi học.');
    expect(errorCorrection).not.toHaveProperty('wrongWord');
    expect(svg.svgContent === undefined || (!String(svg.svgContent).includes('<script') && !String(svg.svgContent).includes('onload'))).toBe(true);
    const forbidden = new Set([
      'correctAnswer', 'correctAnswers', 'correctOrder', 'correctWordIndexes', 'correctWord',
      'correct_answer', 'correct_answers', 'correct_order', 'correct_word_indexes', 'correct_word',
      'wrongWord', 'wrong_word', 'categoryId', 'category_id', 'isCorrect', 'isTrue', 'explanation',
    ]);
    const assertNoForbiddenKeys = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(assertNoForbiddenKeys);
      if (!value || typeof value !== 'object') return;
      Object.entries(value).forEach(([key, nested]) => {
        expect(forbidden.has(key)).toBe(false);
        assertNoForbiddenKeys(nested);
      });
    };
    assertNoForbiddenKeys({ trueFalse, categorization, riddle, errorCorrection });
  });

  it('is stable for a scope and changes IDs across scopes', async () => {
    const first = await toStudentQuestionDto(matchingQuestion, context);
    const repeat = await toStudentQuestionDto(matchingQuestion, context);
    const other = await toStudentQuestionDto(matchingQuestion, { ...context, scope: 'student:student-b:quiz-1' });
    expect(first).toEqual(repeat);
    expect(first.leftItems.map((item: any) => item.id)).not.toEqual(other.leftItems.map((item: any) => item.id));
  });

  it('decodes opaque matching and drag-drop answers only in the same scope', async () => {
    const matchingDto = await toStudentQuestionDto(matchingQuestion, context);
    const dragDto = await toStudentQuestionDto(dragDropQuestion, context);
    const answers = {
      [matchingQuestion.id]: {
        type: 'MATCHING',
        pairs: {
          [matchingDto.leftItems[0].id]: matchingDto.rightItems.find((item: any) => item.content === 'Y').id,
        },
      },
      [dragDropQuestion.id]: {
        type: 'DRAG_DROP',
        values: { [dragDto.blanks[0].id]: 'X', [dragDto.blanks[1].id]: 'Y' },
      },
    };
    const decoded = await decodeStudentAnswersForGrading(
      [matchingQuestion, dragDropQuestion],
      answers,
      context,
    );
    expect(decoded[matchingQuestion.id].pairs).toEqual({ 'left-0': 'right-1' });
    expect(decoded[dragDropQuestion.id].values).toEqual({ 'drag-a': 'X', 'drag-b': 'Y' });

    await expect(decodeStudentAnswersForGrading(
      [matchingQuestion],
      { [matchingQuestion.id]: answers[matchingQuestion.id] },
      { ...context, scope: 'student:student-b:quiz-1' },
    )).rejects.toMatchObject({ code: 'STUDENT_ANSWER_SCOPE_INVALID' });
  });

  it('unwraps the real result envelope without trusting client grading metadata', async () => {
    const envelopeMatchingQuestion = { ...matchingQuestion, pairs: matchingQuestion.pairs.slice(0, 2) };
    const matchingDto = await toStudentQuestionDto(envelopeMatchingQuestion, context);
    const dragDto = await toStudentQuestionDto(dragDropQuestion, context);
    const decoded = await decodeStudentAnswersForGrading(
      [envelopeMatchingQuestion, dragDropQuestion],
      {
        _questionOrder: [envelopeMatchingQuestion.id, dragDropQuestion.id],
        [envelopeMatchingQuestion.id]: {
          selectedAnswer: {
            type: 'MATCHING',
            pairs: {
              [matchingDto.leftItems[0].id]: matchingDto.rightItems.find((item: any) => item.content === 'X').id,
            },
          },
          isCorrect: true,
          status: 'correct',
          gradingVersion: 'client-forged',
          questionSnapshot: { correctAnswer: 'client-forged' },
        },
        [dragDropQuestion.id]: {
          selectedAnswer: { type: 'DRAG_DROP', values: { [dragDto.blanks[0].id]: 'X' } },
          isCorrect: false,
          status: 'wrong',
          questionSnapshot: { correctAnswer: 'client-forged' },
        },
      },
      context,
    );
    expect(decoded[envelopeMatchingQuestion.id]).toEqual({
      type: 'MATCHING',
      pairs: { 'left-0': 'right-0' },
    });
    expect(decoded[dragDropQuestion.id]).toEqual({
      type: 'DRAG_DROP',
      values: { 'drag-a': 'X' },
    });
    expect(decoded).not.toHaveProperty('_questionOrder');
    await expect(decodeStudentAnswersForGrading(
      [envelopeMatchingQuestion],
      { _questionOrder: [], 'unknown-question': { selectedAnswer: 'x' } },
      context,
    )).rejects.toMatchObject({ code: 'STUDENT_ANSWER_QUESTION_INVALID' });
  });

  it('rejects opaque IDs for an unknown question or revision', async () => {
    const dto = await toStudentQuestionDto(matchingQuestion, context);
    const answers = {
      [matchingQuestion.id]: {
        type: 'MATCHING',
        pairs: { [dto.leftItems[0].id]: dto.rightItems[0].id },
      },
    };
    await expect(decodeStudentAnswersForGrading(
      [{ ...matchingQuestion, id: 'other-question' }],
      answers,
      context,
    )).rejects.toMatchObject({ code: 'STUDENT_ANSWER_QUESTION_INVALID' });
    await expect(decodeStudentAnswersForGrading(
      [matchingQuestion],
      answers,
      { ...context, revision: 4 },
    )).rejects.toMatchObject({ code: 'STUDENT_ANSWER_SCOPE_INVALID' });
  });

  it('keeps legacy matching and blank IDs compatible', async () => {
    const decoded = await decodeStudentAnswersForGrading(
      [matchingQuestion, dragDropQuestion],
      {
        [matchingQuestion.id]: { type: 'MATCHING', pairs: { 'left-0': 'right-0' } },
        [dragDropQuestion.id]: { type: 'DRAG_DROP', values: { 'drag-a': 'X' } },
      },
      context,
    );
    expect(decoded[matchingQuestion.id].pairs).toEqual({ 'left-0': 'right-0' });
    expect(decoded[dragDropQuestion.id].values).toEqual({ 'drag-a': 'X' });
  });
});
