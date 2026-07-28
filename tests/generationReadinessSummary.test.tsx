import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GenerationReadinessSummary from '../src/features/quiz-generator/components/GenerationReadinessSummary';

describe('GenerationReadinessSummary', () => {
  it('previews blueprint and quota before launching a trial', () => {
    const onGenerateTrial = vi.fn();
    render(
      <GenerationReadinessSummary
        questionCount={12}
        selectedTypeCount={4}
        difficultyLevels={{ level1: 4, level2: 5, level3: 3 }}
        isTeacherAccount
        aiUsageRemaining={3}
        dailyAiLimit={5}
        trialMode="exam"
        trialDisabled={false}
        onGenerateTrial={onGenerateTrial}
      />,
    );

    expect(screen.getByText('12 câu · 4 dạng · Dễ 4, Trung bình 5, Khó 3')).toBeVisible();
    expect(screen.getByText('3/5 lượt còn lại')).toBeVisible();
    expect(screen.getByText(/Bản thử dùng 1 lượt AI và không thể lưu/i)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo thử 3 câu' }));

    expect(onGenerateTrial).toHaveBeenCalledWith('exam');
  });

  it('hides the trial action when the configured quiz already has three questions', () => {
    render(
      <GenerationReadinessSummary
        questionCount={3}
        selectedTypeCount={1}
        difficultyLevels={{ level1: 1, level2: 1, level3: 1 }}
        isTeacherAccount={false}
        aiUsageRemaining={0}
        dailyAiLimit={0}
        trialMode="practice"
        trialDisabled={false}
        onGenerateTrial={vi.fn()}
      />,
    );

    expect(screen.getByText('Không giới hạn')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Tạo thử 3 câu' })).not.toBeInTheDocument();
  });
});
