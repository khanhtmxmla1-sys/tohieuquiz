import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import QuestionBlueprintSection from '../src/features/quiz-generator/components/QuestionBlueprintSection';
import {
  buildQuestionBlueprintSlots,
  type QuizBlueprint,
  type QuizBlueprintV3,
} from '../src/features/quiz-generator/domain/quizBlueprint';

const initialBlueprint: QuizBlueprint = {
  intent: 'PRACTICE',
  sourceMode: 'TOPIC',
  totalQuestions: 10,
  typeAllocations: [
    { type: QuestionType.MCQ, count: 4 },
    { type: QuestionType.TRUE_FALSE, count: 2 },
    { type: QuestionType.SHORT_ANSWER, count: 2 },
    { type: QuestionType.MATCHING, count: 2 },
  ],
  difficultyLevels: { level1: 3, level2: 5, level3: 2 },
};

const blueprintV3: QuizBlueprintV3 = {
  version: 3,
  intent: 'PRACTICE',
  sourceMode: 'TOPIC',
  topic: 'Phân số',
  classLevel: '4',
  totalQuestions: 10,
  slots: buildQuestionBlueprintSlots({
    totalQuestions: 10,
    typeAllocations: initialBlueprint.typeAllocations,
    difficultyLevels: initialBlueprint.difficultyLevels,
    objective: 'Phân số lớp 4',
  }),
};

const Harness = ({ showV3 = false }: { showV3?: boolean }) => {
  const [blueprint, setBlueprint] = useState(initialBlueprint);
  return (
    <QuestionBlueprintSection
      blueprint={blueprint}
      blueprintV3={showV3 ? blueprintV3 : null}
      onChange={setBlueprint}
    />
  );
};

describe('QuestionBlueprintSection', () => {
  it('keeps total question count unchanged when auto balancing types', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'AI tự cân đối' }));

    expect(screen.getByText('Tổng: 10 câu')).toBeInTheDocument();
    const total = screen.getAllByRole('spinbutton')
      .slice(0, 4)
      .map((input) => Number((input as HTMLInputElement).value))
      .reduce((sum, value) => sum + value, 0);
    expect(total).toBe(10);
  });

  it('shows a blocking message when type totals do not match', async () => {
    render(<Harness />);

    const input = screen.getByLabelText('Số câu Trắc nghiệm');
    fireEvent.change(input, { target: { value: '9' } });

    expect(screen.getByText('Tổng số câu theo dạng phải bằng 10.')).toBeInTheDocument();
  });

  it('shows a read-only V3 slot summary', () => {
    render(<Harness showV3 />);

    expect(screen.getByText('10 slot đã sẵn sàng')).toBeInTheDocument();
    expect(screen.getByText('4 dạng câu')).toBeInTheDocument();
    expect(screen.getByText('Mức 1: 3 · Mức 2: 5 · Mức 3: 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Sửa slot-1')).not.toBeInTheDocument();
  });

  it('switches between exam and practice intent', async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Đề thi' }));
    expect(screen.getByRole('button', { name: 'Đề thi' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Ôn tập' }));
    expect(screen.getByRole('button', { name: 'Ôn tập' })).toHaveAttribute('aria-pressed', 'true');
  });
});
