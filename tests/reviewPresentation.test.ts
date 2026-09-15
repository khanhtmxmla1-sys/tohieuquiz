import { describe, expect, it } from 'vitest';
import {
  buildQuestionAnswerPresentation,
  type ReviewPresentation,
} from '../src/domain/quiz-scoring/reviewPresentation';
import { buildQuestionAnswerReview } from '../src/domain/quiz-scoring';
import {
  studentAnswerReviewDuplicateIdentityCases,
  studentAnswerReviewAliasCases,
  studentAnswerReviewCases,
  studentAnswerReviewFalsyValues,
} from './fixtures/studentAnswerReviewFixtures';

const presentationOf = (value: ReviewPresentation | undefined): ReviewPresentation => {
  expect(value).toBeDefined();
  return value as ReviewPresentation;
};

describe('review presentation contract', () => {
  it('keeps duplicate option text addressable by option id and preserves the saved outcome', () => {
    const fixture = studentAnswerReviewDuplicateIdentityCases.duplicateOptionText;
    const review = buildQuestionAnswerReview({
      id: fixture.questionId,
      type: 'MULTIPLE_SELECT',
      options: fixture.options,
      correctAnswers: ['A', 'D'],
    }, {
      type: 'MULTIPLE_SELECT',
      optionIds: fixture.selectedOptionIds,
    }, {
      questionId: fixture.questionId,
      type: 'MULTIPLE_SELECT',
      status: 'wrong',
      isCorrect: false,
    }, { source: 'submission' });

    const presentation = presentationOf(review.presentation);
    expect(presentation.schemaVersion).toBe(1);
    expect(presentation.source).toBe('submission');
    expect(presentation.type).toBe('MULTIPLE_SELECT');
    expect(presentation.items.map((item) => item.id)).toEqual(['option-0', 'option-1', 'option-2', 'option-3']);
    expect(presentation.items.map((item) => item.state)).toEqual([
      'skipped',
      'incorrect',
      'unknown',
      'correct',
    ]);
    expect(review.status).toBe('wrong');
    expect(review.isCorrect).toBe(false);
  });

  it('uses word indexes instead of duplicate word text as underline identity', () => {
    const fixture = studentAnswerReviewDuplicateIdentityCases.duplicateWordText;
    const presentation = presentationOf(buildQuestionAnswerPresentation({
      id: fixture.questionId,
      type: 'UNDERLINE',
      words: fixture.words,
      correctWordIndexes: fixture.correctIndexes,
    }, {
      type: 'UNDERLINE',
      indexes: fixture.selectedIndexes,
    }, {
      questionId: fixture.questionId,
      type: 'UNDERLINE',
      status: 'wrong',
      isCorrect: false,
    }, { source: 'verified-current' }));

    expect(presentation.type).toBe('UNDERLINE');
    expect(presentation.items.map((item) => item.id)).toEqual([
      'word-0', 'word-1', 'word-2', 'word-3', 'word-4',
    ]);
    expect(presentation.items[1]).toMatchObject({ text: 'ba', state: 'incorrect' });
    expect(presentation.items[3]).toMatchObject({ text: 'đi', state: 'skipped' });
  });

  it('keeps non-contiguous blank ids and marks a missing blank as skipped', () => {
    const fixture = studentAnswerReviewDuplicateIdentityCases.nonContiguousBlankIds;
    const presentation = presentationOf(buildQuestionAnswerPresentation({
      id: fixture.questionId,
      type: 'DROPDOWN',
      text: 'Em [blank-7] và [blank-12].',
      blanks: [
        { id: 'blank-7', options: ['đến'], correctAnswer: 'đến' },
        { id: 'blank-12', options: ['0', '1'], correctAnswer: '0' },
      ],
    }, {
      type: 'DROPDOWN',
      values: { 'blank-7': 'đến' },
    }, {
      questionId: fixture.questionId,
      type: 'DROPDOWN',
      status: 'wrong',
      isCorrect: false,
    }, { source: 'submission' }));

    expect(presentation.type).toBe('DROPDOWN');
    expect(presentation.items.map((item) => item.id)).toEqual(['blank-7', 'blank-12']);
    expect(presentation.items[0]).toMatchObject({ studentValue: 'đến', correctValue: 'đến', state: 'correct' });
    expect(presentation.items[1]).toMatchObject({ correctValue: '0', state: 'skipped' });
    expect(presentation.items[1]).not.toHaveProperty('studentValue');
  });

  it('uses grading text normalization when comparing blank values', () => {
    const presentation = presentationOf(buildQuestionAnswerPresentation({
      id: 'normalized-blank',
      type: 'DROPDOWN',
      text: 'Em [blank-7].',
      blanks: [{ id: 'blank-7', options: ['Đến'], correctAnswer: 'Đến' }],
    }, {
      type: 'DROPDOWN',
      values: { 'blank-7': ' đến ' },
    }, {
      questionId: 'normalized-blank',
      type: 'DROPDOWN',
      status: 'correct',
      isCorrect: true,
    }, { source: 'submission' }));

    expect(presentation.items[0]).toMatchObject({
      studentValue: ' đến ',
      correctValue: 'Đến',
      state: 'correct',
    });
  });

  it('falls back to the item index when a historical categorization item is a string', () => {
    let itemsRead = 0;
    const question = {
      id: 'string-category-item',
      type: 'CATEGORIZATION',
      categories: [{ id: 'category-1', name: 'Nhóm 1' }],
      get items() {
        itemsRead += 1;
        return itemsRead === 1
          ? [{ id: 'item-1', content: 'Mục dạng chuỗi', categoryId: 'category-1' }]
          : ['Mục dạng chuỗi'];
      },
    };
    const presentation = presentationOf(buildQuestionAnswerPresentation(question, {
      type: 'CATEGORIZATION',
      categoriesByItemId: { 'item-1': 'category-1' },
    }, {
      questionId: 'string-category-item',
      type: 'CATEGORIZATION',
      status: 'correct',
      isCorrect: true,
    }, { source: 'legacy-unverified' }));

    expect(presentation.items[0]).toMatchObject({ text: 'Mục dạng chuỗi', state: 'correct' });
  });

  it('does not treat false or zero as an empty answer', () => {
    const falsePresentation = presentationOf(buildQuestionAnswerPresentation(
      studentAnswerReviewFalsyValues.false.question,
      studentAnswerReviewFalsyValues.false.selectedAnswer,
      {
        questionId: 'falsy-false',
        type: 'TRUE_FALSE',
        status: 'correct',
        isCorrect: true,
      },
      { source: 'submission' },
    ));
    const zeroPresentation = presentationOf(buildQuestionAnswerPresentation(
      studentAnswerReviewFalsyValues.zero.question,
      studentAnswerReviewFalsyValues.zero.selectedAnswer,
      {
        questionId: 'falsy-zero',
        type: 'SHORT_ANSWER',
        status: 'correct',
        isCorrect: true,
      },
      { source: 'submission' },
    ));

    expect(falsePresentation.items[0]).toMatchObject({ studentValue: false, correctValue: false, state: 'correct' });
    expect(zeroPresentation.items[0]).toMatchObject({ studentValue: '0', state: 'correct' });
  });

  it('represents partial true/false answers without inventing values', () => {
    const presentation = presentationOf(buildQuestionAnswerPresentation({
      id: 'partial-tf',
      type: 'TRUE_FALSE',
      items: [
        { id: 'a', statement: 'A', isCorrect: true },
        { id: 'b', statement: 'B', isCorrect: false },
      ],
    }, {
      type: 'TRUE_FALSE',
      values: { a: true },
    }, {
      questionId: 'partial-tf',
      type: 'TRUE_FALSE',
      status: 'wrong',
      isCorrect: false,
    }, { source: 'submission' }));

    expect(presentation.items[0]).toMatchObject({ studentValue: true, correctValue: true, state: 'correct' });
    expect(presentation.items[1]).toMatchObject({ correctValue: false, state: 'skipped' });
    expect(presentation.items[1]).not.toHaveProperty('studentValue');
  });

  it('keeps true/false statement order when ids are numeric-like', () => {
    const presentation = presentationOf(buildQuestionAnswerPresentation({
      id: 'numeric-true-false',
      type: 'TRUE_FALSE',
      items: [
        { id: '2', statement: 'Mệnh đề thứ nhất.', isCorrect: true },
        { id: '1', statement: 'Mệnh đề thứ hai.', isCorrect: false },
      ],
    }, { '2': true, '1': false }, {
      questionId: 'numeric-true-false',
      type: 'TRUE_FALSE',
      status: 'correct',
      isCorrect: true,
    }, { source: 'submission' }));

    expect(presentation).toMatchObject({
      type: 'TRUE_FALSE',
      items: [
        { id: '2', statement: 'Mệnh đề thứ nhất.', correctValue: true },
        { id: '1', statement: 'Mệnh đề thứ hai.', correctValue: false },
      ],
    });
  });

  it('uses unknown when the normalized question contract cannot supply authoritative data', () => {
    const presentation = presentationOf(buildQuestionAnswerPresentation({
      id: 'unknown-question',
      type: 'MCQ',
      options: ['A'],
    }, {
      type: 'MCQ',
      optionId: 'option-0',
    }, {
      questionId: 'unknown-question',
      type: 'MCQ',
      status: 'wrong',
      isCorrect: false,
    }, { source: 'legacy-unverified' }));

    expect(presentation).toMatchObject({
      schemaVersion: 1,
      source: 'legacy-unverified',
      type: 'UNSUPPORTED',
    });
    expect(presentation.items).toEqual([]);
    expect(JSON.stringify(presentation)).not.toContain('correctAnswer');
  });

  it('uses unknown when a valid question has an unresolvable saved answer', () => {
    const presentation = presentationOf(buildQuestionAnswerPresentation({
      id: 'invalid-answer',
      type: 'MCQ',
      options: ['A', 'B'],
      correctAnswer: 'A',
    }, {
      type: 'MCQ',
      optionId: 'option-99',
    }, {
      questionId: 'invalid-answer',
      type: 'MCQ',
      status: 'wrong',
      isCorrect: false,
    }, { source: 'legacy-unverified' }));

    expect(presentation.items.map((item) => item.state)).toEqual(['unknown', 'unknown']);
  });

  it('keeps the legacy line model additive when presentation is attached', () => {
    const review = buildQuestionAnswerReview({
      id: 'legacy-lines',
      type: 'MCQ',
      options: ['Đúng', 'Sai'],
      correctAnswer: 'A',
    }, { type: 'MCQ', optionId: 'option-0' }, {
      questionId: 'legacy-lines',
      type: 'MCQ',
      status: 'correct',
      isCorrect: true,
    }, { source: 'submission' });

    expect(review.studentAnswer).toEqual({ kind: 'text', lines: [{ value: 'Đúng' }] });
    expect(review.correctAnswer).toEqual({ kind: 'text', lines: [{ value: 'Đúng' }] });
    expect(review.presentation?.schemaVersion).toBe(1);
  });

  it('normalizes supported aliases into the renderer contract instead of returning raw answers', () => {
    const answers = [
      { type: 'MCQ' as const, optionId: 'option-0' },
      { type: 'IMAGE_QUESTION' as const, optionId: 'option-1' },
      { type: 'IMAGE_QUESTION' as const, optionId: 'option-0' },
      { type: 'SHORT_ANSWER' as const, value: '2' },
      { type: 'DROPDOWN' as const, values: { 'blank-4': 'đi' } },
    ];

    studentAnswerReviewAliasCases.forEach((fixture, index) => {
      const review = buildQuestionAnswerReview(
        fixture.question,
        answers[index],
        {
          questionId: fixture.id,
          type: fixture.expectedType,
          status: 'correct',
          isCorrect: true,
        },
        { source: 'submission' },
      );

      expect(review.type).toBe(fixture.expectedType);
      expect(review.presentation).toMatchObject({
        schemaVersion: 1,
        source: 'submission',
        type: fixture.expectedType,
      });
      expect(review.presentation?.type).not.toBe('UNSUPPORTED');
      expect(JSON.stringify(review.presentation)).not.toContain(`"${fixture.inputType}"`);
      expect(JSON.stringify(review.presentation)).not.toContain('"question"');
    });
  });

  it('keeps geometry questions as an explicit voided fallback without inventing an answer', () => {
    const fixture = studentAnswerReviewCases.find((candidate) => candidate.type === 'GEOMETRY');
    expect(fixture).toBeDefined();

    const review = buildQuestionAnswerReview(
      fixture!.question,
      fixture!.selectedAnswer,
      fixture!.reviewDetail,
      { source: 'submission' },
    );

    expect(review.presentation).toEqual({
      schemaVersion: 1,
      source: 'submission',
      type: 'UNSUPPORTED',
      items: [],
      reason: 'voided-question',
    });
    expect(JSON.stringify(review.presentation)).not.toContain('square');
    expect(JSON.stringify(review.presentation)).not.toContain('geometryData');
  });

  it('keeps 100 rich historical review presentations bounded and free of raw question payloads', () => {
    const presentations = Array.from({ length: 100 }, (_, index) => {
      const questionId = `payload-q-${index}`;
      const promptMarker = `PAYLOAD_PROMPT_${questionId}`;
      const explanationMarker = `PAYLOAD_EXPLANATION_${questionId}`;
      const mediaMarker = `PAYLOAD_MEDIA_${questionId}`;
      const question = {
        id: questionId,
        type: 'MCQ',
        question: `${promptMarker}: ${'Đọc đoạn văn và chọn đáp án phù hợp. '.repeat(40)}`,
        text: `${promptMarker}: ${'Nội dung định dạng rich text cần được giữ ở câu hỏi. '.repeat(40)}`,
        question_rich_text: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: promptMarker }] }],
        },
        explanation: `${explanationMarker}: ${'Giải thích chi tiết chỉ thuộc nội dung câu hỏi. '.repeat(30)}`,
        media: {
          kind: 'image',
          url: `https://example.invalid/${mediaMarker}.png`,
          metadata: { alt: mediaMarker, width: 1600, height: 900 },
        },
        options: [
          `Lựa chọn A của ${questionId}`,
          `Lựa chọn B của ${questionId}`,
          `Lựa chọn C của ${questionId}`,
          `Lựa chọn D của ${questionId}`,
        ],
        correctAnswer: 'C',
      };

      const review = buildQuestionAnswerReview(
        question,
        { type: 'MCQ', optionId: 'option-1' },
        { questionId, type: 'MCQ', status: 'wrong', isCorrect: false },
        { source: 'submission' },
      );
      const presentation = presentationOf(review.presentation);
      const serialized = JSON.stringify(presentation);

      expect(presentation).toMatchObject({
        schemaVersion: 1,
        source: 'submission',
        type: 'MCQ',
      });
      expect(presentation.items).toHaveLength(4);
      expect(presentation.items.map((item) => item.id)).toEqual([
        'option-0', 'option-1', 'option-2', 'option-3',
      ]);
      presentation.items.forEach((item) => {
        expect(Object.keys(item).sort()).toEqual([
          'correct', 'id', 'index', 'selected', 'state', 'text',
        ]);
      });
      expect(serialized).not.toContain(promptMarker);
      expect(serialized).not.toContain(explanationMarker);
      expect(serialized).not.toContain(mediaMarker);
      expect(serialized).not.toContain('"correctAnswer"');
      expect(serialized).not.toContain('"question_rich_text"');
      expect(serialized).not.toContain('"explanation"');
      expect(serialized).not.toContain('"media"');

      return presentation;
    });

    // 120 KB leaves roughly 1.2 KB per question for labels/state while catching
    // accidental inclusion of the rich prompt, explanation, or media metadata.
    const serializedBytes = new TextEncoder().encode(JSON.stringify(presentations)).byteLength;
    expect(serializedBytes).toBeLessThan(120_000);
  });
});
