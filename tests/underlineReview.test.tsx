import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UnderlineReview from '../src/components/common/QuestionReview/templates/UnderlineReview';

const visibleSentenceText = (element: HTMLElement) => {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.sr-only').forEach((status) => status.remove());
  return clone.textContent;
};

describe('UnderlineReview', () => {
  it('renders the original sentence and keeps repeated-word states tied to indexes', () => {
    const sentence = 'nóng, rồi nóng.';

    render(
      <UnderlineReview
        question={{
          type: 'UNDERLINE',
          sentence,
          words: ['nóng,', 'rồi', 'nóng.'],
          correctWordIndexes: [0, 2],
        }}
        studentAnswer={[0, 1]}
        status="wrong"
      />,
    );

    const sentenceRoot = screen.getByLabelText('Kết quả câu gạch chân');
    expect(visibleSentenceText(sentenceRoot)).toBe(sentence);
    expect(sentenceRoot.querySelector('.words-container')).toBeNull();

    const tokens = Array.from(sentenceRoot.querySelectorAll('[data-underline-state]'));
    expect(tokens.map((token) => token.textContent)).toEqual(['nóng', 'rồi', 'nóng']);
    expect(tokens.map((token) => token.getAttribute('data-underline-state'))).toEqual([
      'correct',
      'incorrect',
      'missed',
    ]);
    expect(sentenceRoot.querySelector('[data-underline-state="correct"]')).not.toHaveTextContent(',');
    expect(sentenceRoot.querySelector('[data-underline-state="missed"]')).not.toHaveTextContent('.');
    expect(screen.getByText('đáp án đúng')).toBeInTheDocument();
    expect(screen.getByText('chọn sai')).toBeInTheDocument();
    expect(screen.getByText('đáp án bị bỏ sót')).toBeInTheDocument();
  });

  it('preserves line breaks while presenting review text as a paragraph', () => {
    const sentence = 'Dòng một nóng.\nDòng hai nóng.';

    render(
      <UnderlineReview
        question={{
          type: 'UNDERLINE',
          sentence,
          words: ['Dòng', 'một', 'nóng.', 'Dòng', 'hai', 'nóng.'],
          correctWordIndexes: [2, 5],
        }}
        studentAnswer={[2]}
        status="wrong"
      />,
    );

    const sentenceRoot = screen.getByLabelText('Kết quả câu gạch chân');
    expect(visibleSentenceText(sentenceRoot)).toBe(sentence);
    expect(visibleSentenceText(sentenceRoot)).toContain('\n');
  });

  it('parses a legacy JSON correctAnswer string by index', () => {
    render(
      <UnderlineReview
        question={{
          type: 'UNDERLINE',
          sentence: 'nóng rồi nóng.',
          words: ['nóng', 'rồi', 'nóng.'],
          correctAnswer: '[0,2]',
        }}
        studentAnswer={[0]}
        status="wrong"
      />,
    );

    const sentenceRoot = screen.getByLabelText('Kết quả câu gạch chân');
    const tokens = Array.from(sentenceRoot.querySelectorAll('[data-underline-state]'));
    expect(tokens.map((token) => token.getAttribute('data-underline-state'))).toEqual([
      'correct',
      'idle',
      'missed',
    ]);
    expect(screen.getByText('đáp án đúng')).toBeInTheDocument();
    expect(screen.getByText('đáp án bị bỏ sót')).toBeInTheDocument();
  });

  it.each(['not-json', '{"0":true}'])('retains the historical ReviewLines fallback for invalid correctAnswer JSON (%s)', (correctAnswer) => {
    render(
      <UnderlineReview
        question={{ type: 'UNDERLINE', words: ['nóng'], correctAnswer }}
        studentAnswer={[0]}
        status="wrong"
        reviewDetail={{
          questionId: 'legacy-underline',
          type: 'UNDERLINE',
          status: 'wrong',
          isCorrect: false,
          studentAnswer: { kind: 'list', lines: [{ value: 'nóng' }] },
          correctAnswer: { kind: 'list', lines: [{ value: 'nóng' }] },
        }}
      />,
    );

    const studentLines = screen.getByText('Câu trả lời của học sinh').parentElement;
    const correctLines = screen.getByText('Đáp án đúng').parentElement;
    expect(studentLines).toBeInTheDocument();
    expect(correctLines).toBeInTheDocument();
    expect(studentLines).toHaveTextContent('nóng');
    expect(correctLines).toHaveTextContent('nóng');
    expect(screen.queryByLabelText('Kết quả câu gạch chân')).toBeNull();
  });

  it.each([
    {},
    { foo: 'bar' },
    { type: 'UNDERLINE', indexes: [0] },
  ])('retains the historical ReviewLines fallback for invalid native correctAnswer objects (%j)', (correctAnswer) => {
    render(
      <UnderlineReview
        question={{ type: 'UNDERLINE', words: ['nóng'], correctAnswer }}
        studentAnswer={[0]}
        status="wrong"
        reviewDetail={{
          questionId: 'legacy-underline-object',
          type: 'UNDERLINE',
          status: 'wrong',
          isCorrect: false,
          studentAnswer: { kind: 'list', lines: [{ value: 'nóng' }] },
          correctAnswer: { kind: 'list', lines: [{ value: 'nóng' }] },
        }}
      />,
    );

    expect(screen.getByText('Câu trả lời của học sinh').parentElement).toHaveTextContent('nóng');
    expect(screen.getByText('Đáp án đúng').parentElement).toHaveTextContent('nóng');
    expect(screen.queryByLabelText('Kết quả câu gạch chân')).toBeNull();
  });
});
