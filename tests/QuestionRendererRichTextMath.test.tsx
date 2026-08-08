import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuestionRenderer from '../src/features/quiz-player/components/QuestionRenderer';
import { plainTextToRichText } from '../shared/question-rich-text.contract';
import FillInTheBlankRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/FillInTheBlankRenderer';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('question renderer rich text + math integration', () => {
  it('prefers structured rich prompt presentation while keeping the normal player shell', () => {
    const rich = plainTextToRichText('Câu hỏi có $x^2$');
    rich.doc.content[0] = {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', text: 'Câu hỏi có $x^2$', marks: [{ type: 'bold' }] }],
    };
    const { container } = render(
      <QuestionRenderer
        question={{
          id: 'rich-prompt',
          type: 'MCQ',
          question: 'Câu hỏi plain',
          questionRichText: rich,
          options: ['A', 'B'],
        } as any}
        index={0}
        answers={{}}
        onAnswerChange={vi.fn()}
      />,
    );

    expect(container.querySelector('strong')).toHaveTextContent('Câu hỏi có $x^2$');
    expect(container.querySelector('p')?.style.textAlign).toBe('center');
    expect(container).not.toHaveTextContent('Câu hỏi plain');
  });

  it('renders a strong question heading even when the formatted range crosses inline math', () => {
    const { container } = render(
      <QuestionRenderer
        question={{
          id: 'tf-rich-math',
          type: 'TRUE_FALSE',
          question: '<strong>Có $48$ lít dầu rót đều vào $6$ can.</strong>\nChọn Đúng hoặc Sai cho mỗi nhận định sau.',
          items: [
            { id: 'TF1', statement: 'Mỗi can chứa 8 lít dầu.' },
          ],
        } as any}
        index={10}
        answers={{}}
        onAnswerChange={vi.fn()}
      />,
    );

    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong).toHaveTextContent('Có $48$ lít dầu rót đều vào $6$ can.');
    expect(container).not.toHaveTextContent('<strong>');
  });

  it('renders a selected drag-drop math answer through SmartText rather than an input value', () => {
    render(
      <FillInTheBlankRenderer
        question={{
          id: 'drag-rich-math',
          type: 'DRAG_DROP',
          question: 'Kéo số thích hợp vào chỗ trống.',
          text: 'Mỗi bao gạo nặng: 350 : 7 = [1] (kg).',
          blanks: [{ id: 'blank-0', correctAnswer: '$50$' }],
        } as any}
        index={0}
        answers={{ 'drag-rich-math': { 'blank-0': '$50$' } }}
        onAnswerChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('textbox', { name: 'Ô trống blank-0' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa đáp án ô blank-0' })).toHaveTextContent('$50$');
  });
});
