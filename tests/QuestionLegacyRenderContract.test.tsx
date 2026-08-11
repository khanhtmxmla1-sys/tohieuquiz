import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MathSpan from '../src/components/common/MathSpan';
import { normalizeQuestionForGrading } from '../src/domain/quiz-scoring/normalizeQuestion';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('legacy render and scoring compatibility', () => {
  it('normalizes FILL_IN_THE_BLANK through the dropdown scoring contract', () => {
    const normalized = normalizeQuestionForGrading({
      id: 'fill-legacy',
      type: 'FILL_IN_THE_BLANK',
      text: 'Kết quả là [1].',
      blanks: [{ id: 'blank-0', correctAnswer: '5' }],
    });

    expect(normalized.ok).toBe(true);
    if (normalized.ok) expect(normalized.question.type).toBe('DROPDOWN');
  });

  it('adds local horizontal scrolling for display math', () => {
    const { container } = render(<MathSpan content={String.raw`$$\frac{123456789}{987654321}$$`} />);
    expect(container.firstElementChild).toHaveClass('overflow-x-auto');
    expect(screen.getByText(/123456789/)).toBeInTheDocument();
  });
});
