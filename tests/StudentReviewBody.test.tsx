import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import StudentReviewBody from '../src/components/common/QuestionReview/StudentReviewBody';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const choicePresentation = (type: 'MCQ' | 'IMAGE_QUESTION' | 'MULTIPLE_SELECT', items: any[]) => ({
  schemaVersion: 1,
  source: 'submission' as const,
  type,
  items,
});

const review = (presentation: any, studentLines: any[] = [], correctLines: any[] = []) => ({
  questionId: 'review-question',
  type: presentation?.type ?? 'MCQ',
  status: 'wrong' as const,
  isCorrect: false,
  studentAnswer: { kind: studentLines.length ? 'text' : 'empty', lines: studentLines },
  correctAnswer: { kind: correctLines.length ? 'text' : 'empty', lines: correctLines },
  presentation,
});

describe('StudentReviewBody', () => {
  it('renders duplicate option text by stable id with selected, wrong and missed labels', () => {
    const presentation = choicePresentation('IMAGE_QUESTION', [
      { id: 'option-0', index: 0, text: 'Lặp', selected: false, correct: false, state: 'unknown' },
      { id: 'option-1', index: 1, text: 'Lặp', selected: true, correct: false, state: 'incorrect' },
      { id: 'option-2', index: 2, text: 'Đúng', selected: false, correct: true, state: 'skipped' },
    ]);

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'IMAGE_QUESTION', optionImages: ['a.png', 'b.png', 'c.png'] }}
        selectedAnswer={{ type: 'IMAGE_QUESTION', optionId: 'option-1' }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    const options = screen.getAllByTestId('student-review-option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('A. Lặp');
    expect(options[1]).toHaveTextContent('B. Lặp');
    expect(options[1]).toHaveTextContent('Em chọn · Sai');
    expect(options[2]).toHaveTextContent('Đáp án đúng · Em chưa chọn');
    expect(screen.getByRole('img', { name: 'Đáp án B: Lặp' })).toBeInTheDocument();
    expect(within(options[1]).getByText('Em chọn · Sai')).toBeInTheDocument();
  });

  it('distinguishes correct, wrong and missed choices for a partial multiple-select answer', () => {
    const presentation = choicePresentation('MULTIPLE_SELECT', [
      { id: 'option-0', index: 0, text: 'Một', selected: true, correct: true, state: 'correct' },
      { id: 'option-1', index: 1, text: 'Hai', selected: true, correct: false, state: 'incorrect' },
      { id: 'option-2', index: 2, text: 'Ba', selected: false, correct: true, state: 'skipped' },
      { id: 'option-3', index: 3, text: 'Bốn', selected: false, correct: false, state: 'unknown' },
    ]);

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'MULTIPLE_SELECT' }}
        selectedAnswer={{ type: 'MULTIPLE_SELECT', optionIds: ['option-0', 'option-1'] }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    expect(screen.getByText('Em chọn · Đúng')).toBeInTheDocument();
    expect(screen.getByText('Em chọn · Sai')).toBeInTheDocument();
    expect(screen.getByText('Đáp án đúng · Em chưa chọn')).toBeInTheDocument();
    expect(screen.getAllByTestId('student-review-option')).toHaveLength(4);
  });

  it('renders every true-false statement and marks unanswered statements separately', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'TRUE_FALSE' as const,
      items: [
        { id: 'a', index: 0, statement: 'Mệnh đề A', correctValue: true, studentValue: false, state: 'incorrect' as const },
        { id: 'b', index: 1, statement: 'Mệnh đề B', correctValue: false, state: 'skipped' as const },
      ],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'TRUE_FALSE' }}
        selectedAnswer={{ type: 'TRUE_FALSE', values: { a: false } }}
        reviewDetail={review(presentation)}
        outcome="skipped"
      />,
    );

    const rows = screen.getAllByTestId('student-review-true-false-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Mệnh đề A');
    expect(rows[0]).toHaveTextContent('Em chọn: Sai');
    expect(rows[0]).toHaveTextContent('Đáp án đúng: Đúng');
    expect(rows[1]).toHaveTextContent('Em chọn: Chưa trả lời');
    expect(rows[1]).toHaveTextContent('Đáp án đúng: Sai');
  });

  it('does not invent correctness for legacy-unverified or unsupported presentation data', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'legacy-unverified' as const,
      type: 'UNSUPPORTED' as const,
      items: [] as const,
      reason: 'insufficient-authoritative-data' as const,
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'MCQ', explanation: 'Lời giải lịch sử không được tin cậy.' }}
        selectedAnswer={{ type: 'MCQ', optionId: 'option-0' }}
        reviewDetail={review(presentation, [{ value: 'Bài em làm' }], [{ value: 'Đáp án cũ' }])}
        outcome="incorrect"
      />,
    );

    expect(screen.getByText('Dữ liệu lịch sử chưa đủ để đối chiếu từng đáp án.')).toBeInTheDocument();
    expect(screen.getByText('Bài em làm')).toBeInTheDocument();
    expect(screen.queryByText('Đáp án cũ')).not.toBeInTheDocument();
    expect(screen.queryByText('Đáp án đúng')).not.toBeInTheDocument();
    expect(screen.queryByText(/Em chọn ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Đáp án đúng ·/)).not.toBeInTheDocument();
    expect(screen.queryByText('Lời giải lịch sử không được tin cậy.')).not.toBeInTheDocument();
  });

  it('keeps the generic line fallback readable when the API has no presentation', () => {
    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'ORDERING' }}
        selectedAnswer={{ type: 'ORDERING', ranks: { 'item-0': 2 } }}
        reviewDetail={review(undefined, [{ label: 'Mục 1', value: 'Hai' }], [{ label: 'Mục 1', value: 'Một' }])}
        outcome="incorrect"
      />,
    );

    expect(screen.getByText('Câu trả lời của em')).toBeInTheDocument();
    expect(screen.getAllByText('Mục 1:')).toHaveLength(2);
    expect(screen.getByText('Hai')).toBeInTheDocument();
    expect(screen.getByText('Đáp án đúng')).toBeInTheDocument();
    expect(screen.queryByText(/\[object Object\]/i)).not.toBeInTheDocument();
  });

  it('provides a collapsed accessible explanation only when explanation exists and is enabled', () => {
    const presentation = choicePresentation('MCQ', [
      { id: 'option-0', index: 0, text: 'A', selected: true, correct: true, state: 'correct' },
    ]);

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'MCQ', explanation: 'Vì A là đáp án đúng.' }}
        selectedAnswer={{ type: 'MCQ', optionId: 'option-0' }}
        reviewDetail={review(presentation)}
        outcome="correct"
        showExplanation
      />,
    );

    const summary = screen.getByRole('button', { name: 'Xem lời giải' });
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Vì A là đáp án đúng.')).not.toBeVisible();

    fireEvent.click(summary);
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Vì A là đáp án đúng.')).toBeVisible();
  });

  it('renders non-contiguous drag-drop blanks by trusted id and preserves false, zero and empty values', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'DRAG_DROP' as const,
      items: [
        { id: 'blank-1', index: 1, blankToken: '[blank-1]', studentValue: '0', correctValue: '0', state: 'correct' as const },
        { id: 'blank-7', index: 7, blankToken: '[blank-7]', studentValue: 'false', correctValue: 'true', state: 'incorrect' as const },
        { id: 'blank-9', index: 9, correctValue: 'done', state: 'skipped' as const },
      ],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'DRAG_DROP', question: 'Tiêu đề câu hỏi', text: 'Giá trị [blank-1] và [blank-7] rồi [blank-9].' }}
        selectedAnswer={{ type: 'DRAG_DROP', values: { 'blank-1': 0, 'blank-7': false, 'blank-9': '' } }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    const rows = screen.getAllByTestId('student-review-blank-row');
    expect(screen.getByLabelText('Nội dung câu hỏi')).toHaveTextContent('Giá trị');
    const inlineBlanks = screen.getAllByTestId('student-review-inline-blank');
    expect(inlineBlanks).toHaveLength(3);
    expect(inlineBlanks[0]).toHaveAttribute('data-blank-id', 'blank-1');
    expect(inlineBlanks[1]).toHaveAttribute('data-blank-id', 'blank-7');
    expect(inlineBlanks[2]).toHaveAttribute('data-blank-id', 'blank-9');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute('data-blank-id', 'blank-1');
    expect(rows[0]).toHaveTextContent('Em làm: 0');
    expect(rows[0]).toHaveTextContent('Đúng');
    expect(rows[1]).toHaveTextContent('Em làm: false');
    expect(rows[1]).toHaveTextContent('Đáp án đúng: true');
    expect(rows[2]).toHaveTextContent('Em làm: Chưa trả lời');
    expect(rows[2]).toHaveTextContent('Đáp án đúng: done');
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('does not present the source letter bank as the student sequence when scramble is skipped', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'WORD_SCRAMBLE' as const,
      items: [{ id: 'answer', index: 0, correctValue: 'aba', letters: ['a', 'b', 'a'], state: 'skipped' as const }],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'WORD_SCRAMBLE', letters: ['a', 'b', 'a'] }}
        selectedAnswer={{ type: 'WORD_SCRAMBLE', letterIndexes: [] }}
        reviewDetail={review(presentation)}
        outcome="skipped"
      />,
    );

    expect(screen.getByText('Chưa chọn chữ cái')).toBeInTheDocument();
    expect(screen.queryAllByTestId('student-review-letter')).toHaveLength(0);
  });

  it('uses the same trusted indexed renderer for dropdown blanks', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'DROPDOWN' as const,
      items: [
        { id: 'blank-2', index: 2, blankToken: '[blank-2]', studentValue: '0', correctValue: '0', state: 'correct' as const },
        { id: 'blank-5', index: 5, blankToken: '[blank-5]', correctValue: 'false', state: 'skipped' as const },
        { id: 'blank-8', index: 8, blankToken: '[blank-8]', studentValue: '', correctValue: 'done', state: 'skipped' as const },
      ],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'DROPDOWN', text: 'Chọn [blank-2], [blank-5], [blank-8].' }}
        selectedAnswer={{ type: 'DROPDOWN', values: { 'blank-2': 0, 'blank-5': false, 'blank-8': '' } }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    const rows = screen.getAllByTestId('student-review-blank-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute('data-blank-id', 'blank-2');
    expect(rows[0]).toHaveTextContent('Em làm: 0');
    expect(rows[1]).toHaveAttribute('data-blank-id', 'blank-5');
    expect(rows[1]).toHaveTextContent('Em làm: Chưa trả lời');
    expect(rows[1]).toHaveTextContent('Đáp án đúng: false');
    expect(rows[2]).toHaveTextContent('Em làm: Chưa trả lời');
  });

  it('renders partial matching with student and trusted correct pair text', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'MATCHING' as const,
      items: [
        { id: 'left-a', index: 0, leftId: 'left-a', leftText: 'A', studentRightId: 'right-x', studentRightText: 'X', correctRightId: 'right-a', correctRightText: 'Một', state: 'incorrect' as const },
        { id: 'left-b', index: 1, leftId: 'left-b', leftText: 'B', correctRightId: 'right-b', correctRightText: 'Hai', state: 'skipped' as const },
      ],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'MATCHING' }}
        selectedAnswer={{ type: 'MATCHING', pairs: { 'left-a': 'right-x' } }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    const rows = screen.getAllByTestId('student-review-matching-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('A');
    expect(rows[0]).toHaveTextContent('Em nối: X');
    expect(rows[0]).toHaveTextContent('Đáp án đúng: Một');
    expect(rows[0]).toHaveTextContent('Sai');
    expect(rows[1]).toHaveTextContent('Em nối: Chưa nối');
    expect(rows[1]).toHaveTextContent('Đáp án đúng: Hai');
    expect(rows[1]).toHaveTextContent('Chưa trả lời');
  });

  it('renders partial ordering with explicit ranks and skipped rows', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'ORDERING' as const,
      items: [
        { id: 'item-0', index: 0, text: 'Đầu', studentRank: 2, correctRank: 1, state: 'incorrect' as const },
        { id: 'item-1', index: 1, text: 'Cuối', correctRank: 2, state: 'skipped' as const },
      ],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'ORDERING' }}
        selectedAnswer={{ type: 'ORDERING', ranks: { 'item-0': 2 } }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    const rows = screen.getAllByTestId('student-review-ordering-row');
    expect(rows[0]).toHaveTextContent('Em xếp: 2');
    expect(rows[0]).toHaveTextContent('Đáp án đúng: 1');
    expect(rows[0]).toHaveTextContent('Sai');
    expect(rows[1]).toHaveTextContent('Em xếp: Chưa xếp');
    expect(rows[1]).toHaveTextContent('Đáp án đúng: 2');
    expect(rows[1]).toHaveTextContent('Chưa trả lời');
  });

  it('renders categorization using item text and category ids', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'CATEGORIZATION' as const,
      categories: [
        { id: 'cat-a', index: 0, text: 'Nhóm A' },
        { id: 'cat-b', index: 1, text: 'Nhóm B' },
      ],
      items: [
        { id: 'item-a', index: 0, text: 'Mục chữ', studentCategoryId: 'cat-b', studentCategoryText: 'Nhóm B', correctCategoryId: 'cat-a', correctCategoryText: 'Nhóm A', state: 'incorrect' as const },
        { id: 'item-b', index: 1, text: 'Mục số', studentCategoryId: 'cat-a', studentCategoryText: 'Nhóm A', correctCategoryId: 'cat-a', correctCategoryText: 'Nhóm A', state: 'correct' as const },
      ],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'CATEGORIZATION', items: [{ id: 'item-a', text: 'Mục chữ' }, { id: 'item-b', text: 'Mục số' }] }}
        selectedAnswer={{ type: 'CATEGORIZATION', categoriesByItemId: { 'item-a': 'cat-b', 'item-b': 'cat-a' } }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    const rows = screen.getAllByTestId('student-review-categorization-row');
    expect(rows[0]).toHaveTextContent('Mục chữ');
    expect(rows[0]).toHaveTextContent('Em xếp: Nhóm B');
    expect(rows[0]).toHaveTextContent('Đáp án đúng: Nhóm A');
    expect(rows[1]).toHaveTextContent('Mục số');
    expect(rows[1]).toHaveTextContent('Đúng');
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('renders underline duplicate words by index with textual status labels', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'UNDERLINE' as const,
      items: [
        { id: 'word-0', index: 0, text: 'đỏ', selected: true, correct: false, state: 'incorrect' as const },
        { id: 'word-1', index: 1, text: 'đỏ', selected: false, correct: true, state: 'skipped' as const },
      ],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'UNDERLINE', words: ['đỏ', 'đỏ'] }}
        selectedAnswer={{ type: 'UNDERLINE', indexes: [0] }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    const rows = screen.getAllByTestId('student-review-underline-word');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-word-index', '0');
    expect(rows[0]).toHaveTextContent('Em chọn · Sai');
    expect(rows[1]).toHaveAttribute('data-word-index', '1');
    expect(rows[1]).toHaveTextContent('Đáp án đúng · Em chưa chọn');
  });

  it('renders short answer and riddle values from trusted text presentation', () => {
    for (const type of ['SHORT_ANSWER', 'RIDDLE'] as const) {
      const presentation = {
        schemaVersion: 1,
        source: 'submission' as const,
        type,
        items: [{ id: 'answer', index: 0, studentValue: 'bài làm', correctValues: ['đáp án'], state: 'incorrect' as const }],
      };

      const { unmount } = render(
        <StudentReviewBody
          question={type === 'RIDDLE'
            ? { id: `review-${type}`, type, riddleLines: ['Dòng gợi ý 1', { text: 'Dòng gợi ý 2' }], hint: 'Gợi ý thêm' }
            : { id: `review-${type}`, type }}
          selectedAnswer={{ type, value: 'bài làm' }}
          reviewDetail={review(presentation)}
          outcome="incorrect"
        />,
      );

      expect(screen.getByTestId('student-review-text-answer')).toHaveTextContent('Bài làm: bài làm');
      expect(screen.getByTestId('student-review-text-answer')).toHaveTextContent('Đáp án đúng: đáp án');
      if (type === 'RIDDLE') {
        expect(screen.getByText(/Dòng gợi ý 1/)).toBeInTheDocument();
        expect(screen.getByText(/Gợi ý thêm/)).toBeInTheDocument();
      }
      unmount();
    }
  });

  it('renders word scramble duplicate letters by trusted index sequence', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'WORD_SCRAMBLE' as const,
      items: [{ id: 'answer', index: 0, studentValue: 'aba', studentLetterIndexes: [0, 2, 1], correctValue: 'baa', letters: ['a', 'b', 'a'], state: 'incorrect' as const }],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'WORD_SCRAMBLE', letters: ['a', 'b', 'a'] }}
        selectedAnswer={{ type: 'WORD_SCRAMBLE', letterIndexes: [0, 2, 1] }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    expect(screen.getByTestId('student-review-word-scramble')).toHaveTextContent('Em ghép: aba');
    expect(screen.getByTestId('student-review-word-scramble')).toHaveTextContent('Đáp án đúng: baa');
    expect(screen.getAllByTestId('student-review-letter')).toHaveLength(3);
    expect(screen.getAllByTestId('student-review-letter')[0]).toHaveAttribute('data-letter-index', '0');
    expect(screen.getAllByTestId('student-review-letter')[1]).toHaveAttribute('data-letter-index', '2');
    expect(screen.getAllByTestId('student-review-letter')[2]).toHaveAttribute('data-letter-index', '1');
  });

  it('renders error correction pair without raw object output', () => {
    const presentation = {
      schemaVersion: 1,
      source: 'submission' as const,
      type: 'ERROR_CORRECTION' as const,
      items: [{ id: 'correction', index: 0, studentWrongWord: 'gone', studentCorrectWord: 'goed', correctWrongWord: 'go', correctWord: 'went', state: 'incorrect' as const }],
    };

    render(
      <StudentReviewBody
        question={{ id: 'review-question', type: 'ERROR_CORRECTION', wrongWord: 'go', correctWord: 'went', passage: 'They go to school.' }}
        selectedAnswer={{ type: 'ERROR_CORRECTION', wrongWord: 'go', correctWord: 'goed' }}
        reviewDetail={review(presentation)}
        outcome="incorrect"
      />,
    );

    const body = screen.getByTestId('student-review-error-correction');
    expect(screen.getByText('They go to school.')).toBeInTheDocument();
    expect(body).toHaveTextContent('Từ sai: go');
    expect(body).toHaveTextContent('Em chọn từ sai: gone');
    expect(body).toHaveTextContent('Em sửa: goed');
    expect(body).toHaveTextContent('Đáp án đúng: went');
    expect(body).toHaveTextContent('Sai');
    expect(body).not.toHaveTextContent('[object Object]');
  });
});
