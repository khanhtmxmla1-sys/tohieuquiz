import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuestionSettingsSection from '../src/features/quiz-generator/components/QuestionSettingsSection';

vi.mock('../src/features/quiz-generator/components/CollapsibleSection', () => ({
  default: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('../src/features/quiz-generator/components/QuestionBlueprintSection', () => ({
  default: () => null,
}));
vi.mock('../src/components/teacher/QuizCreator', () => ({
  QuestionTypeSelector: () => null,
  DifficultyLevelSelector: () => null,
}));

const baseProps = {
  selectedTypes: { MCQ: true },
  setSelectedTypes: vi.fn(),
  difficultyLevels: { level1: 1, level2: 1, level3: 1 },
  setDifficultyLevels: vi.fn(),
  questionBlueprint: {
    intent: 'PRACTICE' as const,
    sourceMode: 'TOPIC' as const,
    totalQuestions: 3,
    typeAllocations: [{ type: 'MCQ' as any, count: 3 }],
    difficultyLevels: { level1: 1, level2: 1, level3: 1 },
  },
  setQuestionBlueprint: vi.fn(),
  isOpenTypes: true,
  isOpenDifficulty: false,
  onToggle: vi.fn(),
};

describe('QuestionSettingsSection SVG option', () => {
  it('hides the control when the feature flag is disabled', () => {
    render(<QuestionSettingsSection {...baseProps} showSvgDiagramOption={false} />);
    expect(screen.queryByRole('checkbox', { name: 'Tự động thêm hình vẽ minh họa' })).toBeNull();
  });

  it('is unchecked by default and exposes accessible descriptions', () => {
    render(
      <QuestionSettingsSection
        {...baseProps}
        showSvgDiagramOption
        autoGenerateSvg={false}
        setAutoGenerateSvg={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Tự động thêm hình vẽ minh họa' });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute(
      'aria-describedby',
      'auto-generate-svg-description auto-generate-svg-note',
    );
    expect(screen.getByText(/AI sẽ tạo hình học, sơ đồ, trục số hoặc đồ thị/)).toBeInTheDocument();
    expect(screen.getByText(/Có thể làm thời gian tạo đề lâu hơn/)).toBeInTheDocument();
  });

  it('updates state through the native checkbox', () => {
    const setAutoGenerateSvg = vi.fn();
    render(
      <QuestionSettingsSection
        {...baseProps}
        showSvgDiagramOption
        autoGenerateSvg={false}
        setAutoGenerateSvg={setAutoGenerateSvg}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tự động thêm hình vẽ minh họa' }));
    expect(setAutoGenerateSvg).toHaveBeenCalledWith(true);
  });
});
