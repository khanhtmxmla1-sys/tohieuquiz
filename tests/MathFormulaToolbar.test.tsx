import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  insertFormulaTemplate,
  MathTextarea,
} from '../src/features/quiz-editor/components/QuestionEditorModal/editors/shared';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('teacher math formula toolbar', () => {
  it('inserts a selection as the numerator and places the caret in the denominator', () => {
    const result = insertFormulaTemplate('Tính 12', 5, 7, 'fraction');

    expect(result.value).toBe('Tính $\\frac{12}{}$');
    expect(result.value[result.selectionStart - 1]).toBe('{');
    expect(result.value[result.selectionStart]).toBe('}');
  });

  it('creates the requested geometry templates without requiring TeX knowledge', () => {
    expect(insertFormulaTemplate('', 0, 0, 'angle').value).toBe('$\\angle ABC$');
    expect(insertFormulaTemplate('', 0, 0, 'segment').value).toBe('$\\overline{AB}$');
    expect(insertFormulaTemplate('', 0, 0, 'triangle').value).toBe('$\\triangle ABC$');
    expect(insertFormulaTemplate('', 0, 0, 'parallel').value).toBe('$AB \\parallel CD$');
    expect(insertFormulaTemplate('', 0, 0, 'perpendicular').value).toBe('$AB \\perp CD$');
  });

  it('updates a controlled textarea from the fraction button', () => {
    const Controlled = () => {
      const [value, setValue] = useState('12');
      return (
        <MathTextarea
          aria-label="Nội dung câu hỏi"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    };

    render(<Controlled />);
    const textarea = screen.getByLabelText('Nội dung câu hỏi') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(0, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Phân số' }));

    expect(textarea.value).toBe('$\\frac{12}{}$');
  });

  it('offers all requested shortcuts and geometry choices', () => {
    render(<MathTextarea value="" onChange={() => undefined} />);
    const textarea = screen.getByRole('textbox');
    textarea.focus();

    for (const name of ['Phân số', 'Căn bậc hai', 'Số mũ', 'Chỉ số dưới', 'Góc', 'Hình học']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Hình học' }));
    expect(screen.getByRole('button', { name: 'Đoạn thẳng AB' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tam giác ABC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Song song' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vuông góc' })).toBeInTheDocument();
  });
});
