import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionTypeSelector } from '../src/components/teacher/QuizCreator/QuestionTypeSelector';
import { AI_QUESTION_TYPE_DESCRIPTORS } from '../src/services/ai/question-contracts/questionContractRegistry';

describe('QuestionTypeSelector registry integration', () => {
  it('renders every AI-selectable descriptor from the contract registry', () => {
    render(<QuestionTypeSelector selectedTypes={{}} onChange={vi.fn()} />);

    expect(AI_QUESTION_TYPE_DESCRIPTORS).toHaveLength(13);
    for (const descriptor of AI_QUESTION_TYPE_DESCRIPTORS) {
      expect(screen.getByText(descriptor.label)).toBeInTheDocument();
    }
  });
});
