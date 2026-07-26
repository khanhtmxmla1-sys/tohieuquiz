import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LatexDropdown from '../src/features/quiz-player/components/QuestionRenderer/atoms/LatexDropdown';

vi.mock('../src/features/quiz-player/components/QuestionRenderer/atoms/MathSpan', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

describe('LatexDropdown', () => {
  it('portals the LaTeX listbox outside an overflow-hidden question shell', () => {
    const onChange = vi.fn();
    render(
      <section data-testid="question-shell" className="overflow-hidden">
        <LatexDropdown
          options={['$4a^2$', '$6a^2$']}
          value=""
          onChange={onChange}
          placeholder="..."
        />
      </section>,
    );

    fireEvent.click(screen.getByRole('button', { name: /\.\.\./ }));
    const listbox = screen.getByRole('listbox');

    expect(screen.getByTestId('question-shell')).not.toContainElement(listbox);
    expect(listbox.parentElement).toBe(document.body);

    fireEvent.click(screen.getByRole('option', { name: /4a/ }));
    expect(onChange).toHaveBeenCalledWith('$4a^2$');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keeps plain-text options on the native select path', () => {
    render(
      <LatexDropdown
        options={['4a²', '6a²']}
        value=""
        onChange={vi.fn()}
        placeholder="..."
      />,
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
