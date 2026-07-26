import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import InteractiveMathText from '../src/features/quiz-player/components/QuestionRenderer/atoms/InteractiveMathText';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <span data-testid="mathjax">{children}</span>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeAll(() => {
  Object.defineProperty(window, 'MathJax', {
    configurable: true,
    value: { typesetPromise: vi.fn(() => Promise.resolve()) },
  });
});

describe('InteractiveMathText', () => {
  it('renders a blank inside a fraction numerator without splitting invalid TeX fragments', () => {
    render(
      <InteractiveMathText
        content={'Điền $\\frac{[1]}{8}$'}
        renderBlank={(id) => <input aria-label={`blank-${id}`} />}
      />,
    );

    expect(screen.getByLabelText('blank-1')).toBeInTheDocument();
    const fraction = screen.getByTestId('interactive-fraction');
    expect(fraction).toContainElement(screen.getByLabelText('blank-1'));
    expect(screen.queryByText('$\\frac{')).not.toBeInTheDocument();
  });

  it('renders top-level blanks inside one long math block while keeping surrounding formulas typeset', () => {
    render(
      <InteractiveMathText
        content={'$\\frac{1}{8}, [1], \\frac{5}{8}, [2]$'}
        renderBlank={(id) => <input aria-label={`blank-${id}`} />}
      />,
    );

    expect(screen.getByLabelText('blank-1')).toBeInTheDocument();
    expect(screen.getByLabelText('blank-2')).toBeInTheDocument();
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThan(0);
  });

  it('assigns stable sequential ids to answer-bearing legacy placeholders', () => {
    render(
      <InteractiveMathText
        content={'Thứ tự: [$\\frac{2}{5}$], [$\\frac{3}{5}$]'}
        renderBlank={(id) => <input aria-label={`blank-${id}`} />}
      />,
    );

    expect(screen.getByLabelText('blank-0')).toBeInTheDocument();
    expect(screen.getByLabelText('blank-1')).toBeInTheDocument();
  });

  it('does not treat the optional root index in sqrt as an answer blank', () => {
    render(
      <InteractiveMathText
        content={'Tính \\(\\sqrt[3]{8}\\)'}
        renderBlank={(id) => <input aria-label={`blank-${id}`} />}
      />,
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByTestId('mathjax')).toHaveTextContent('\\(\\sqrt[3]{8}\\)');
  });
});