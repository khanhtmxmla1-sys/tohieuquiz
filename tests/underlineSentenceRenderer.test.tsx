import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { UnderlineSentence } from '../src/components/common/UnderlineSentence';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <span data-testid="mathjax">{children}</span>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('UnderlineSentence', () => {
  it('renders the source sentence exactly once and in its original order', () => {
    const sentence = 'Dòng một.\nDòng hai.';

    const { container } = render(
      <UnderlineSentence
        sentence={sentence}
        words={['Dòng', 'một.', 'Dòng', 'hai.']}
      />,
    );

    expect(container.textContent).toBe(sentence);
  });

  it('keeps idle and selected interactive tokens free of chip styling', () => {
    render(
      <UnderlineSentence
        sentence="Trời xanh và cao."
        words={['Trời', 'xanh', 'và', 'cao.']}
        interactive
        stateForIndex={(index) => (index === 1 ? 'selected' : 'idle')}
        onToggle={vi.fn()}
      />,
    );

    for (const token of screen.getAllByRole('button')) {
      expect(token).not.toHaveClass('border', 'bg-sky-100', 'px-4');
    }

    expect(screen.getByRole('button', { name: /xanh/i })).toHaveClass(
      'underline',
      'decoration-sky-600',
    );
  });

  it('reports the clicked token index to its toggle handler', () => {
    const onToggle = vi.fn();

    render(
      <UnderlineSentence
        sentence="Một hai ba."
        words={['Một', 'hai', 'ba.']}
        interactive
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ba' }));
    expect(onToggle).toHaveBeenCalledWith(2);
  });

  it('marks selected state with aria-pressed and underline decoration', () => {
    render(
      <UnderlineSentence
        sentence="Trời nóng, rất xanh."
        words={['Trời', 'nóng,', 'rất', 'xanh.']}
        interactive
        stateForIndex={(index) => (index === 1 ? 'selected' : 'idle')}
        onToggle={vi.fn()}
      />,
    );

    const token = screen.getByRole('button', { name: /nóng/i });
    expect(token).toHaveAttribute('aria-pressed', 'true');
    expect(token).toHaveClass('underline', 'decoration-2');
  });

  it('keeps punctuation siblings outside the clickable underlined core', () => {
    render(
      <UnderlineSentence
        sentence="Trời nóng, rất xanh."
        words={['Trời', 'nóng,', 'rất', 'xanh.']}
        interactive
        onToggle={vi.fn()}
      />,
    );

    const token = screen.getByRole('button', { name: 'nóng' });
    expect(token).toHaveTextContent('nóng');
    expect(token.textContent).not.toContain(',');
    expect(token.parentElement?.parentElement?.textContent).toBe('Trời nóng, rất xanh.');
  });

  it('passes complete TeX tokens through MathSpan while keeping punctuation outside the clickable core', () => {
    render(
      <UnderlineSentence
        sentence="Tính “$x$,” nhé."
        words={['Tính', '“$x$,”', 'nhé.']}
        interactive
        stateForIndex={(index) => (index === 1 ? 'selected' : 'idle')}
        onToggle={vi.fn()}
      />,
    );

    const token = screen.getByRole('button', { name: '$x$' });
    expect(token).toHaveTextContent('$x$');
    expect(token).not.toHaveTextContent(',');
    expect(token.querySelector('[data-testid="mathjax"]')).toBeInTheDocument();
    expect(token.parentElement?.textContent).toContain('“$x$,”');
  });

  it('does not render punctuation-only emoji tokens as interactive buttons', () => {
    render(
      <UnderlineSentence
        sentence="— 👩‍💻 ❤️"
        words={['—', '👩‍💻', '❤️']}
        interactive
        onToggle={vi.fn()}
      />,
    );

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('retains native button semantics for Enter and Space activation', () => {
    render(
      <UnderlineSentence
        sentence="Chọn từ."
        words={['Chọn', 'từ.']}
        interactive
        onToggle={vi.fn()}
      />,
    );

    const token = screen.getByRole('button', { name: 'Chọn' });
    expect(token.tagName).toBe('BUTTON');
    expect(token).toHaveAttribute('type', 'button');
    expect(token).not.toHaveAttribute('tabindex', '-1');
  });

  it('exposes distinct review states with assistive status descriptions', () => {
    render(
      <UnderlineSentence
        sentence="Đúng sai thiếu."
        words={['Đúng', 'sai', 'thiếu.']}
        stateForIndex={(index) =>
          index === 0 ? 'correct' : index === 1 ? 'incorrect' : 'missed'
        }
      />,
    );

    const correct = document.querySelector('[data-underline-state="correct"]');
    const incorrect = document.querySelector('[data-underline-state="incorrect"]');
    const missed = document.querySelector('[data-underline-state="missed"]');

    expect(correct).toHaveAttribute('aria-describedby');
    expect(incorrect).toHaveAttribute('aria-describedby');
    expect(missed).toHaveAttribute('aria-describedby');
    expect(screen.getByText('đáp án đúng')).toHaveClass('sr-only');
    expect(screen.getByText('chọn sai')).toHaveClass('sr-only');
    expect(screen.getByText('đáp án bị bỏ sót')).toHaveClass('sr-only');
    expect(correct).toHaveClass('decoration-emerald-600');
    expect(incorrect).toHaveClass('decoration-red-600');
    expect(missed).toHaveClass('decoration-dotted');
    expect(correct).not.toHaveAttribute('aria-pressed');
    expect(incorrect).not.toHaveAttribute('aria-pressed');
    expect(missed).not.toHaveAttribute('aria-pressed');
  });
});
