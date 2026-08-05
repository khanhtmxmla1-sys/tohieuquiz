import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizStartNotice from '../src/components/student/QuizStartNotice';

const quiz = {
  title: 'Luyện tập đại từ sở hữu tiếng Anh lớp 4',
  timeLimit: 25,
  questions: Array.from({ length: 20 }, (_, index) => ({ id: `q${index + 1}` })),
  _assignmentData: {
    attemptCount: 0,
    maxAttempts: 1,
    deadline: '2099-01-01T00:00:00.000Z',
  },
} as any;

describe('QuizStartNotice', () => {
  it('shows read-only student details and the exact start button label', () => {
    const onStart = vi.fn();
    render(
      <QuizStartNotice
        quiz={quiz}
        studentName="Minh Khang"
        studentClass="4A5"
        isStarting={false}
        startError={null}
        onStart={onStart}
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Lưu ý trước khi làm bài' })).toBeInTheDocument();
    expect(screen.getByText('Minh Khang')).toBeInTheDocument();
    expect(screen.getByText('Lớp 4A5')).toBeInTheDocument();
    expect(screen.getByText('20 câu hỏi')).toBeInTheDocument();
    expect(screen.getByText('25 phút')).toBeInTheDocument();
    expect(screen.getByText('Còn 1 lượt làm')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu làm bài' }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
