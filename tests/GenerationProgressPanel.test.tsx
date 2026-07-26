import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GenerationProgressPanel from '../src/features/quiz-generator/components/GenerationProgressPanel';

describe('GenerationProgressPanel', () => {
  it('shows the active step and cancels the request', () => {
    const onCancel = vi.fn();
    render(<GenerationProgressPanel step="reading_document" onCancel={onCancel} />);

    expect(screen.getAllByText('Đang đọc tài liệu')[0]).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy tạo đề' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not show a cancel action after completion', () => {
    render(<GenerationProgressPanel step="completed" onCancel={vi.fn()} />);
    expect(screen.getAllByText('Đã hoàn thành')[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy tạo đề' })).not.toBeInTheDocument();
  });

  it('shows cancellation without fake percentages', () => {
    render(<GenerationProgressPanel step="cancelled" onCancel={vi.fn()} />);
    expect(screen.getByText('Đã hủy yêu cầu')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
