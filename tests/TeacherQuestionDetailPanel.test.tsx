import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestionDetailPanel } from '../src/components/teacher/ResultsView/student-detail/components/QuestionDetailPanel';
import type { DisplayQuestion } from '../src/components/teacher/ResultsView/student-detail/models/questionModel';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const question = {
  id: 'q-1',
  index: 0,
  type: 'MCQ',
  question: '1 + 1 = ?',
  options: ['1', '2', '3', '4'],
  correctAnswer: 'B',
  selectedAnswer: 'A',
  isCorrect: false,
  explanation: 'Một cộng một bằng hai.',
} as DisplayQuestion;

describe('teacher student question detail', () => {
  it('hides legacy explanations from the teacher result detail', () => {
    render(
      <QuestionDetailPanel
        selectedQuestion={question}
        selectedQuestionIndex={0}
        filteredQuestionCount={1}
        displayQuestionCount={1}
        onQuestionSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('1 + 1 = ?')).toBeTruthy();
    expect(screen.getAllByText('Sai').length).toBeGreaterThan(0);
    expect(screen.queryByText('Một cộng một bằng hai.')).toBeNull();
    expect(document.querySelector('.explanation-section')).toBeNull();
  });
});
