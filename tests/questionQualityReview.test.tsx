import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuestionQualityReview from '../src/features/quiz-generator/components/QuestionQualityReview';
import type { AiQuestionQualitySummary } from '../shared/ai-question-quality.contract';

const warningSummary: AiQuestionQualitySummary = {
  version: 'ai-question-quality-v1',
  checkedAt: '2026-07-28T00:00:00.000Z',
  questionCount: 1,
  blockingCount: 0,
  warningCount: 1,
  canPublish: true,
  issues: [{
    id: 'GRADE_MISMATCH:q-1',
    code: 'GRADE_MISMATCH',
    severity: 'warning',
    questionIndex: 0,
    questionId: 'q-1',
    message: 'Câu 1 nhắc tới khối lớp khác với lớp 4A.',
    path: 'question',
  }],
};

describe('QuestionQualityReview', () => {
  it('renders a clean state when no issue is detected', () => {
    render(
      <QuestionQualityReview
        summary={{ ...warningSummary, warningCount: 0, issues: [] }}
        acknowledgedWarningIds={new Set()}
        onToggleWarning={vi.fn()}
      />,
    );

    expect(screen.getByText(/chưa phát hiện lỗi chất lượng/i)).toBeVisible();
  });

  it('lets the teacher acknowledge a warning', () => {
    const onToggleWarning = vi.fn();
    render(
      <QuestionQualityReview
        summary={warningSummary}
        acknowledgedWarningIds={new Set()}
        onToggleWarning={onToggleWarning}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /Xác nhận:/i }));

    expect(onToggleWarning).toHaveBeenCalledWith('GRADE_MISMATCH:q-1');
    expect(screen.getByText('Cần xác nhận')).toBeVisible();
  });

  it('marks blocking issues as not saveable', () => {
    render(
      <QuestionQualityReview
        summary={{
          ...warningSummary,
          blockingCount: 1,
          warningCount: 0,
          canPublish: false,
          issues: [{
            id: 'ANSWER_OUTSIDE_OPTIONS:q-1',
            code: 'ANSWER_OUTSIDE_OPTIONS',
            severity: 'blocking',
            questionIndex: 0,
            questionId: 'q-1',
            message: 'Câu 1 có đáp án đúng không thuộc các phương án đã cho.',
            path: 'correctAnswer',
          }],
        }}
        acknowledgedWarningIds={new Set()}
        onToggleWarning={vi.fn()}
      />,
    );

    expect(screen.getByText('Chưa thể lưu')).toBeVisible();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
