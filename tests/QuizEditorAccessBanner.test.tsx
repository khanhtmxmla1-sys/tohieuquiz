import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizEditorAccessBanner from '../src/features/manual-quiz-workspace/components/QuizEditorAccessBanner';

describe('QuizEditorAccessBanner', () => {
  it('explains readonly submissions and offers a new version', () => {
    const onCreateVersion = vi.fn();
    render(<QuizEditorAccessBanner
      editability={{
        mode: 'READONLY', canEditStructure: false, canCreateVersion: true,
        reason: 'HAS_SUBMISSIONS', requiresPublishedWarning: false,
        resultCount: 4, activeLiveExamCount: 0, openAssignmentCount: 1,
      }}
      onCreateVersion={onCreateVersion}
      isCreatingVersion={false}
    />);

    expect(screen.getByRole('alert')).toHaveTextContent('đã có 4 bài nộp');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' }));
    expect(onCreateVersion).toHaveBeenCalledTimes(1);
  });

  it('warns without locking when the quiz is assigned but untouched', () => {
    render(<QuizEditorAccessBanner
      editability={{
        mode: 'EDIT', canEditStructure: true, canCreateVersion: true,
        reason: null, requiresPublishedWarning: true,
        resultCount: 0, activeLiveExamCount: 0, openAssignmentCount: 2,
      }}
      onCreateVersion={vi.fn()}
      isCreatingVersion={false}
    />);

    expect(screen.getByRole('status')).toHaveTextContent('đã được giao cho học sinh');
    expect(screen.queryByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' })).not.toBeInTheDocument();
  });
});
