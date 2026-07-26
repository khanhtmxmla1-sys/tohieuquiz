import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MathAuditPage from '../src/features/math-audit/MathAuditPage';

const listIssues = vi.fn();
const listTelemetry = vi.fn();

vi.mock('../src/features/math-audit/mathAuditService', () => ({
  mathAuditService: {
    listIssues: (...args: unknown[]) => listIssues(...args),
    listTelemetry: (...args: unknown[]) => listTelemetry(...args),
  },
}));

vi.mock('../src/components/common/MathSpan', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock('../src/utils/toast', () => ({
  showError: vi.fn(),
}));

describe('MathAuditPage read-only monitoring mode', () => {
  beforeEach(() => {
    listIssues.mockResolvedValue({
      data: [{
        questionId: 'q-1',
        quizId: 'quiz-1',
        quizTitle: 'Đề Toán lớp 5',
        questionType: 'MCQ',
        currentVersion: 1,
        targetVersion: 2,
        needsUpgrade: true,
        changedFields: ['question'],
        currentIssues: [{ field: 'question', code: 'UNCLOSED_DELIMITER', message: 'Thiếu dấu đóng công thức', index: 8 }],
        remainingIssues: [],
        previewBefore: 'Tính $\\frac{1}{2',
        previewAfter: 'Tính $\\frac{1}{2}$',
      }],
      summary: { scanned: 1357, affected: 1, autoFixable: 1, blocked: 0, currentVersion: 2 },
    });
    listTelemetry.mockResolvedValue({
      data: [{
        fingerprint: 'event-1',
        quiz_id: 'quiz-1',
        question_id: 'q-1',
        question_type: 'MCQ',
        error_code: 'MATHJAX_MERROR',
        route: '/quiz',
        math_format_version: 1,
        count: 2,
        first_seen_at: '2026-07-16T00:00:00.000Z',
        last_seen_at: '2026-07-16T01:00:00.000Z',
      }],
      summary: { events: 1, occurrences: 2, days: 7 },
    });
  });

  it('shows monitoring data without bulk repair or rollback controls', async () => {
    render(<MathAuditPage />);

    expect(await screen.findByText('Theo dõi lỗi công thức')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Đề Toán lớp 5')).toBeInTheDocument());

    expect(screen.getByText('Dashboard này không có quyền sửa dữ liệu câu hỏi.')).toBeInTheDocument();
    expect(screen.getByText('MATHJAX_MERROR')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chuẩn hóa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hoàn tác/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
