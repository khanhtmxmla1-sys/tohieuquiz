import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router';
import ResultsTab from '../src/components/TeacherDashboard/ResultsTab';
import ResultsTabModule from '../src/components/TeacherDashboard/results-tab';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  fetchResultAnswers: vi.fn(),
  fetchResultAnswersBulk: vi.fn(),
  getByResult: vi.fn(),
  removeResult: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mocks.navigate };
});

const ResultsLocationProbe = () => {
  const location = useLocation();
  return <div data-testid="results-location">{location.pathname}{location.search}</div>;
};

const renderResults = (component: React.ReactElement, entry = '/teacher/results') => render(
  <MemoryRouter initialEntries={[entry]}>
    {component}
    <ResultsLocationProbe />
  </MemoryRouter>,
);

vi.mock('../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isMobile: false }),
}));

vi.mock('../src/services/results/resultAnswersService', () => ({
  fetchResultAnswers: mocks.fetchResultAnswers,
  fetchResultAnswersBulk: mocks.fetchResultAnswersBulk,
}));

vi.mock('../src/features/results/services/resultPhieuLinkService', () => ({
  resultPhieuLinkService: { getByResult: mocks.getByResult },
}));

vi.mock('../stores/quizStore', () => ({
  useQuizStore: {
    getState: () => ({ removeResult: mocks.removeResult }),
  },
}));

vi.mock('../src/utils/toast', () => ({ showError: mocks.showError }));

vi.mock('../src/utils/question/scoring.util', () => ({
  checkAnswer: (_question: unknown, answer: unknown) => ({
    status: answer === 'ok' ? 'correct' : 'incorrect',
    isCorrect: answer === 'ok',
  }),
}));

vi.mock('../src/components/common', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  AsyncState: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Button: ({ children, onClick, disabled, loading, title }: any) => (
    <button onClick={onClick} disabled={disabled || loading} title={title}>{children}</button>
  ),
  ModuleIcon: ({ name }: { name: string }) => <span data-module-icon={name} />,
}));

vi.mock('../src/components/teacher/ResultsView', () => ({
  StatsCards: () => null,
  ResultsAnalytics: () => null,
  DateRangeFilter: () => <div data-testid="date-filter" />,
  ResultsTable: ({ results, resultOverrides, onRowClick, onPhieuClick, onDeleteClick }: any) => (
    <div data-testid="results-table">
      {results.map((result: any) => (
        <article key={result.id} data-testid={`result-${result.id}`}>
          <span>{result.studentName}</span>
          <span data-testid={`override-${result.id}`}>
            {JSON.stringify(resultOverrides?.[String(result.id)] ?? null)}
          </span>
          {onRowClick && <button onClick={() => onRowClick(result)}>Chi tiết {result.studentName}</button>}
          {onPhieuClick && <button onClick={() => onPhieuClick(result)}>Phiếu {result.studentName}</button>}
          {onDeleteClick && <button onClick={() => onDeleteClick(result)}>Xóa {result.studentName}</button>}
        </article>
      ))}
    </div>
  ),
  QuestionAnalysisTable: ({ cohortSize, attemptMode, isLoading, error }: any) => (
    <div data-testid="question-analysis">
      {JSON.stringify({ cohortSize, attemptMode, isLoading, error })}
    </div>
  ),
  InterventionPanel: ({ classNameFilter, quizId }: any) => (
    <div data-testid="intervention-panel">{JSON.stringify({ classNameFilter, quizId })}</div>
  ),
}));

vi.mock('../src/features/results/components/PhieuFromResultsPanel', () => ({
  PhieuFromResultsPanel: ({ results, onClose }: any) => (
    <div data-testid="phieu-panel">
      <span>{results.length} kết quả phiếu</span>
      <button onClick={onClose}>Đóng panel</button>
    </div>
  ),
}));

vi.mock('../src/features/results/components/ResultRowPhieuModal', () => ({
  default: ({ result, initialSavedPhieu, initialPublishedLink, onClose }: any) => (
    <div data-testid="phieu-modal">
      <span>{result.studentName}</span>
      <span data-testid="saved-phieu">{JSON.stringify(initialSavedPhieu)}</span>
      <span data-testid="published-link">{JSON.stringify(initialPublishedLink)}</span>
      <button onClick={onClose}>Đóng phiếu</button>
    </div>
  ),
}));

vi.mock('../src/features/results/components/result-report-delivery', () => ({
  ResultReportDeliveryWizard: ({ className, quizId, quizTitle, onClose }: any) => (
    <div data-testid="result-report-wizard">
      <span data-testid="wizard-scope">{JSON.stringify({ className, quizId, quizTitle })}</span>
      <button onClick={onClose}>Đóng wizard</button>
    </div>
  ),
}));

const makeResult = (
  id: string,
  studentName: string,
  studentClass: string,
  quizId: string,
  submittedAt: string,
) => ({
  id,
  quizId,
  quizTitle: quizId === 'quiz-1' ? 'Phân số' : 'Hình học',
  studentName,
  studentClass,
  score: 8,
  correctCount: 8,
  totalQuestions: 10,
  timeTaken: 12,
  submittedAt,
  answers: {},
});

const quizzes = [
  { id: 'quiz-1', title: 'Phân số', questions: [] },
  { id: 'quiz-2', title: 'Hình học', questions: [] },
] as any;

const change = async (element: HTMLElement, value: string) => {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
  });
};

const click = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

const results = [
  makeResult('1', 'An', '3A', 'quiz-1', '2026-07-19T07:00:00.000Z'),
  makeResult('2', 'Bình', '3A', 'quiz-2', '2026-07-19T06:00:00.000Z'),
  makeResult('3', 'Chi', '3B', 'quiz-1', '2026-07-19T05:00:00.000Z'),
  makeResult('4', 'Dũng', '3B', 'quiz-2', '2026-07-19T04:00:00.000Z'),
  makeResult('5', 'Hà', '3A', 'quiz-1', '2026-07-19T03:00:00.000Z'),
  makeResult('6', 'Lan', '3B', 'quiz-2', '2026-07-19T02:00:00.000Z'),
  makeResult('7', 'Minh', '3A', 'quiz-1', '2026-07-19T01:00:00.000Z'),
] as any;

describe('TeacherDashboard ResultsTab contracts', () => {
  it('keeps the dashboard compatibility export stable', () => {
    expect(ResultsTab).toBe(ResultsTabModule);
  });

  it('shows the analytics module identity in the page header', () => {
    renderResults(<ResultsTab results={results.slice(0, 1)} quizzes={quizzes} />);
    expect(screen.getByRole('heading', { name: 'Báo cáo phân tích' })).toBeInTheDocument();
    expect(document.querySelector('[data-module-icon="analytics-report"]')).toBeInTheDocument();
  });

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    mocks.navigate.mockReset();
    mocks.fetchResultAnswers.mockReset().mockResolvedValue({});
    mocks.fetchResultAnswersBulk.mockReset().mockResolvedValue({});
    mocks.getByResult.mockReset().mockResolvedValue(null);
    mocks.removeResult.mockReset().mockResolvedValue(undefined);
    mocks.showError.mockReset();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('paginates results in groups of five and preserves the Vietnamese range label', () => {
    renderResults(<ResultsTab results={results} quizzes={quizzes} />);

    expect(screen.getByText('Danh sách kết quả (7)')).toBeTruthy();
    expect(within(screen.getByTestId('results-table')).getAllByRole('article')).toHaveLength(5);
    expect(screen.getByText('Hiển thị 1-5 / 7 kết quả')).toBeTruthy();
    expect(screen.getByText('Trang 1/2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));

    expect(within(screen.getByTestId('results-table')).getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('Hiển thị 6-7 / 7 kết quả')).toBeTruthy();
    expect(screen.getByText('Trang 2/2')).toBeTruthy();
  });

  it('restores filters and pagination from URL search params and updates history', async () => {
    renderResults(
      <ResultsTab results={results} quizzes={quizzes} />,
      '/teacher/results?page=2&sort=score&order=asc',
    );

    expect(screen.getByText('Trang 2/2')).toBeInTheDocument();
    expect(screen.getByTestId('results-location')).toHaveTextContent(
      '/teacher/results?page=2&sort=score&order=asc',
    );

    await change(screen.getByPlaceholderText('Tìm học sinh...'), 'Lan');
    await waitFor(() => {
      const location = screen.getByTestId('results-location').textContent || '';
      expect(location).toContain('q=Lan');
      expect(location).not.toContain('page=');
    });
    expect(screen.getByText('Danh sách kết quả (1)')).toBeInTheDocument();
    expect(screen.getByText('Lan')).toBeInTheDocument();
  });

  it('reconstructs quiz, class, and name filters from a deep link', () => {
    renderResults(
      <ResultsTab results={results} quizzes={quizzes} />,
      '/teacher/results?q=Lan&quiz=quiz-2&class=3B',
    );

    expect(screen.getByText('Danh sách kết quả (1)')).toBeInTheDocument();
    expect(screen.getByText('Lan')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tìm học sinh...')).toHaveValue('Lan');
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('quiz-2');
    expect(selects[1]).toHaveValue('3B');
  });

  it('combines name, quiz, and class filters and clears them together', async () => {
    renderResults(<ResultsTab results={results} quizzes={quizzes} />);

    await change(screen.getByPlaceholderText('Tìm học sinh...'), 'Lan');
    expect(screen.getByText('Danh sách kết quả (1)')).toBeTruthy();
    expect(screen.getByText('Lan')).toBeTruthy();
    expect(screen.getByText('🔍 "Lan"')).toBeTruthy();

    await click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(screen.getByText('Danh sách kết quả (7)')).toBeTruthy();

    const selects = screen.getAllByRole('combobox');
    await change(selects[0], 'quiz-1');
    await change(selects[1], '3A');

    expect(screen.getByText('Danh sách kết quả (3)')).toBeTruthy();
    expect(screen.getByText('An')).toBeTruthy();
    expect(screen.getByText('Hà')).toBeTruthy();
    expect(screen.getByText('Minh')).toBeTruthy();
    expect(screen.getByTestId('question-analysis')).toBeTruthy();
  });

  it('requires one class and one quiz before opening the class delivery wizard', async () => {
    renderResults(<ResultsTab results={results} quizzes={quizzes} />);

    const deliveryButton = screen.getByRole('button', { name: 'Tạo và gửi phiếu' });
    expect(deliveryButton).toBeDisabled();
    expect(deliveryButton).toHaveAttribute('title', 'Hãy chọn một lớp và một bài kiểm tra trước khi tạo phiếu.');

    const selects = screen.getAllByRole('combobox');
    await change(selects[0], 'quiz-1');
    expect(deliveryButton).toBeDisabled();
    await change(selects[1], '3A');
    expect(deliveryButton).toBeEnabled();

    await change(screen.getByPlaceholderText('Tìm học sinh...'), 'An');
    await click(deliveryButton);

    expect(screen.getByTestId('result-report-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-scope')).toHaveTextContent(JSON.stringify({
      className: '3A', quizId: 'quiz-1', quizTitle: 'Phân số',
    }));
  });

  it('navigates to result detail and caches the loaded phieu across reopen', async () => {
    mocks.getByResult.mockResolvedValue({
      phieu: { id: 'phieu-1' },
      link: { publicToken: 'token-1' },
    });
    renderResults(<ResultsTab results={results.slice(0, 1)} quizzes={quizzes} />);

    fireEvent.click(screen.getByRole('button', { name: 'Chi tiết An' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/results/1');

    fireEvent.click(screen.getByRole('button', { name: 'Phiếu An' }));
    await waitFor(() => expect(mocks.getByResult).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('saved-phieu').textContent).toContain('phieu-1'));

    fireEvent.click(screen.getByRole('button', { name: 'Đóng phiếu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Phiếu An' }));

    expect(mocks.getByResult).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('published-link').textContent).toContain('token-1');
  });

  it('exports CSV and summary report with the current date in their filenames', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T08:00:00.000Z'));
    const downloads: string[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'download', {
          configurable: true,
          get: () => downloads[downloads.length - 1] || '',
          set: (value: string) => { downloads.push(value); },
        });
      }
      return element;
    }) as typeof document.createElement);

    renderResults(<ResultsTab results={results.slice(0, 1)} quizzes={quizzes} />);

    fireEvent.click(screen.getByRole('button', { name: /Xuất/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Xuất Excel (CSV)' }));
    fireEvent.click(screen.getByRole('button', { name: /Xuất/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Báo cáo tổng hợp' }));

    expect(downloads).toContain('ket-qua-2026-07-19.csv');
    expect(downloads).toContain('bao-cao-tong-hop-2026-07-19.txt');
  });

  it('hides server-backed row actions offline while keeping local export available', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    renderResults(<ResultsTab results={results.slice(0, 1)} quizzes={quizzes} />);

    expect(screen.queryByRole('button', { name: 'Chi tiết An' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Phiếu An' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa An' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất/ })).toBeEnabled();
  });

  it('recalculates visible result display values from fetched answer snapshots', async () => {
    mocks.fetchResultAnswers.mockResolvedValue({
      questionA: { selectedAnswer: 'ok', questionSnapshot: { type: 'multiple-choice' } },
      questionB: { selectedAnswer: 'wrong', questionSnapshot: { type: 'multiple-choice' } },
    });
    const result = { ...results[0], totalQuestions: 2 };

    renderResults(<ResultsTab results={[result] as any} quizzes={quizzes} />);

    await waitFor(() => {
      expect(screen.getByTestId('override-1')).toHaveTextContent(
        JSON.stringify({ correctCount: 1, totalQuestions: 2, score: 5 }),
      );
    });
  });
});
