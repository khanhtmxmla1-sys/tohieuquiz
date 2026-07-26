import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubjectLibrary from '../src/components/student/PracticeLibrary/SubjectLibrary';
import TopicCard from '../src/components/student/PracticeLibrary/TopicCard';

const libraryMocks = vi.hoisted(() => ({
  getTopics: vi.fn(),
  getPracticeQuiz: vi.fn(),
  selectQuiz: vi.fn(),
  setView: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../src/services/practiceService', () => ({
  practiceService: {
    getTopics: libraryMocks.getTopics,
    getPracticeQuiz: libraryMocks.getPracticeQuiz,
  },
}));

vi.mock('../stores/quizStore', () => ({
  useQuizStore: () => ({
    selectQuiz: libraryMocks.selectQuiz,
    setView: libraryMocks.setView,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: libraryMocks.toastError,
  },
}));

const defaultTopics = [
  { name: '#phep_nhan', count: 30 },
  { name: '#phan_so', count: 20 },
  { name: '#english', count: 15 },
];

const renderSubjectLibrary = ({
  subjectId = 'toan',
  isValidSubject = true,
  topics = defaultTopics,
  onBack = vi.fn(),
}: {
  subjectId?: string;
  isValidSubject?: boolean;
  topics?: { name: string; count: number }[];
  onBack?: () => void;
} = {}) => {
  libraryMocks.getTopics.mockResolvedValueOnce(topics);
  return {
    onBack,
    ...render(
      <SubjectLibrary
        subjectId={subjectId}
        isValidSubject={isValidSubject}
        onBack={onBack}
      />,
    ),
  };
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  libraryMocks.getTopics.mockReset();
  libraryMocks.getPracticeQuiz.mockReset();
  libraryMocks.selectQuiz.mockReset();
  libraryMocks.setView.mockReset();
  libraryMocks.toastError.mockReset();
});

describe('practice topic cards', () => {
  it('renders a native topic button with precise available-question copy', () => {
    render(
      <TopicCard topic="#phep_nhan" count={32} isStarting={false} onClick={vi.fn()} />,
    );

    const button = screen.getByRole('button', {
      name: /Phep nhan.*32 câu có sẵn.*Luyện 10 câu/i,
    });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('motion-reduce:transition-none');
    expect(button).not.toHaveAttribute('style');
    expect(button).not.toBeDisabled();
  });

  it('disables only the topic being prepared', () => {
    render(
      <TopicCard topic="#phep_nhan" count={32} isStarting onClick={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Đang chuẩn bị/i })).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('starts practice from the native button action', () => {
    const onClick = vi.fn();
    render(
      <TopicCard topic="#phep_nhan" count={32} isStarting={false} onClick={onClick} />,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('#phep_nhan');
  });
});

describe('practice subject library page', () => {
  it('renders a calm canonical subject header without Material Symbols text', async () => {
    const { onBack } = renderSubjectLibrary();

    expect(await screen.findByRole('heading', { level: 1, name: 'Toán học' })).toBeVisible();
    expect(await screen.findByText('2 chuyên đề · 50 câu hỏi')).toBeVisible();
    expect(screen.queryByText('calculate')).not.toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: 'Trở về thư viện' });
    expect(backButton.className).toContain('min-h-11');
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('uses the same filtered topic data for totals and topic cards', async () => {
    renderSubjectLibrary();

    expect(await screen.findByText('2 chuyên đề · 50 câu hỏi')).toBeVisible();
    expect(screen.getByRole('button', { name: /Phep nhan.*30 câu có sẵn/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Phan so.*20 câu có sẵn/i })).toBeVisible();
    expect(screen.queryByText(/english/i)).not.toBeInTheDocument();
  });

  it('distinguishes an API error and retries locally', async () => {
    libraryMocks.getTopics
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([{ name: '#phep_nhan', count: 12 }]);

    render(
      <SubjectLibrary subjectId="toan" isValidSubject onBack={vi.fn()} />,
    );

    expect(await screen.findByText('Chưa tải được thư viện luyện tập.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByRole('button', { name: /Phep nhan.*12 câu có sẵn/i })).toBeVisible();
    expect(libraryMocks.getTopics).toHaveBeenCalledTimes(2);
  });

  it('distinguishes an empty subject from an empty search result', async () => {
    const firstRender = renderSubjectLibrary({ topics: [] });
    expect(await screen.findByText('Môn này đang được chuẩn bị.')).toBeVisible();
    firstRender.unmount();

    renderSubjectLibrary();
    const search = await screen.findByRole('searchbox', { name: 'Tìm chuyên đề' });
    fireEvent.change(search, { target: { value: 'không tồn tại' } });
    expect(screen.getByText('Không tìm thấy chuyên đề phù hợp.')).toBeVisible();
  });

  it('keeps the topic grid visible and marks only the selected topic as starting', async () => {
    const pendingQuiz = deferred<any>();
    libraryMocks.getPracticeQuiz.mockReturnValueOnce(pendingQuiz.promise);
    renderSubjectLibrary();

    const multiplication = await screen.findByRole('button', { name: /Phep nhan/i });
    const fractions = screen.getByRole('button', { name: /Phan so/i });
    fireEvent.click(multiplication);

    expect(multiplication).toBeDisabled();
    expect(multiplication).toHaveAttribute('aria-busy', 'true');
    expect(fractions).not.toBeDisabled();
    expect(fractions).toBeVisible();

    pendingQuiz.resolve(null);
    await act(async () => {
      await pendingQuiz.promise;
    });
  });

  it('selects the generated quiz and preserves the existing student view flow', async () => {
    const virtualQuiz = {
      id: 'practice-quiz',
      title: 'Luyện phép nhân',
      questions: [{ id: 'question-1' }],
      isPractice: true,
    };
    libraryMocks.getPracticeQuiz.mockResolvedValueOnce(virtualQuiz);
    renderSubjectLibrary();

    fireEvent.click(await screen.findByRole('button', { name: /Phep nhan/i }));

    await waitFor(() => {
      expect(libraryMocks.selectQuiz).toHaveBeenCalledWith(virtualQuiz);
      expect(libraryMocks.setView).toHaveBeenCalledWith('student');
    });
  });

  it('renders an invalid subject state instead of a blank page', () => {
    const onBack = vi.fn();
    render(
      <SubjectLibrary subjectId="tn-xh" isValidSubject={false} onBack={onBack} />,
    );

    expect(screen.getByRole('heading', { name: 'Không tìm thấy môn học' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Trở về thư viện' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
