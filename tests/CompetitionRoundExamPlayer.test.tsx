import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Link, MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentCompetitionPortalDto } from '../shared/competition-portal.contract';
import CompetitionRoundExamPlayer from '../src/features/competition/portal/student/CompetitionRoundExamPlayer';
import {
  loadQuizAttemptDraft,
  saveQuizAttemptDraft,
} from '../src/features/quiz-player/quizAttemptDraft';

const mocks = vi.hoisted(() => ({
  preflightRound: vi.fn(),
  start: vi.fn(),
  submit: vi.fn(),
  showConfirm: vi.fn(),
  renderer: vi.fn(),
}));

vi.mock('../src/features/competition/portal/studentCompetitionPortalService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/competition/portal/studentCompetitionPortalService')>(),
  studentCompetitionPortalService: {
    ...(
      await importOriginal<typeof import('../src/features/competition/portal/studentCompetitionPortalService')>()
    ).studentCompetitionPortalService,
    preflightRound: mocks.preflightRound,
  },
}));

vi.mock('../src/features/competition/studentCompetitionService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/competition/studentCompetitionService')>(),
  studentCompetitionService: {
    ...(
      await importOriginal<typeof import('../src/features/competition/studentCompetitionService')>()
    ).studentCompetitionService,
    start: mocks.start,
    submit: mocks.submit,
  },
}));

vi.mock('../src/components/student/QuestionRenderer', () => ({
  default: (props: {
    question: { id: string; question: string };
    answers: Record<string, unknown>;
    onAnswerChange: (questionId: string, value: unknown) => void;
  }) => {
    mocks.renderer(props);
    return (
      <div data-testid="canonical-question-renderer">
        <p>{props.question.question}</p>
        <output aria-label={`answer-${props.question.id}`}>
          {String(props.answers[props.question.id] ?? '')}
        </output>
        <button type="button" onClick={() => props.onAnswerChange(props.question.id, 'changed-answer')}>
          Answer current question
        </button>
      </div>
    );
  },
}));

vi.mock('../src/utils/toast', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/utils/toast')>(),
  showConfirm: mocks.showConfirm,
}));

const portal: StudentCompetitionPortalDto = {
  campaignId: 'campaign-1',
  slug: 'olympic-toan',
  title: 'Olympic Toán 2026',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  rounds: [{
    roundId: 'round-2',
    roundNumber: 2,
    title: 'Vòng 2 — Tăng tốc',
    opensAt: '2026-09-02T01:00:00.000Z',
    closesAt: '2026-09-30T10:00:00.000Z',
    state: 'OPEN',
    attemptCount: 1,
    maxAttempts: 3,
  }],
};

const readyPreflight = {
  status: 'READY' as const,
  campaignId: 'campaign-1',
  roundId: 'round-2',
  quizId: 'quiz-2',
  serverTime: '2026-09-10T01:00:00.000Z',
  window: {
    opensAt: '2026-09-02T01:00:00.000Z',
    closesAt: '2026-09-30T10:00:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
  },
  attemptsRemaining: 2,
};

const session = {
  attempt: {
    id: 'attempt-1',
    campaignId: 'campaign-1',
    roundId: 'round-2',
    startedAt: '2026-09-10T01:00:00.000Z',
  },
  quiz: {
    id: 'quiz-2',
    title: 'Đề thi vòng 2',
    timeLimit: 30,
    questions: [
      { id: 'q-1', type: 'MCQ', question: 'Question one', options: ['A', 'B'] },
      { id: 'q-2', type: 'MCQ', question: 'Question two', options: ['A', 'B'] },
    ],
  },
};

const draftIdentity = 'competition:attempt-1:quiz-2';

const createFreshSession = () => ({
  ...session,
  attempt: {
    ...session.attempt,
    startedAt: new Date(Date.now() - 60_000).toISOString(),
  },
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const playerRouteElement = <Outlet context={portal} />;

const renderPlayerRoute = () => render(
  <MemoryRouter initialEntries={['/thi/olympic-toan/vong/2/lam-bai']}>
    <Routes>
      <Route path="/thi/:campaignSlug" element={<><Link to="/leaving">Leave player</Link>{playerRouteElement}</>}>
        <Route path="vong/:roundNumber/lam-bai" element={<CompetitionRoundExamPlayer />} />
      </Route>
      <Route path="/leaving" element={<p>navigation-target</p>} />
    </Routes>
  </MemoryRouter>,
);

const renderBrowserPlayerRoute = () => render(
  <BrowserRouter>
    <Routes>
      <Route path="/thi/:campaignSlug" element={<><Link to="/leaving">Leave player</Link>{playerRouteElement}</>}>
        <Route path="vong/:roundNumber/lam-bai" element={<CompetitionRoundExamPlayer />} />
      </Route>
      <Route path="/leaving" element={<p>navigation-target</p>} />
    </Routes>
  </BrowserRouter>,
);

describe('CompetitionRoundExamPlayer', () => {
  beforeEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    mocks.preflightRound.mockReset().mockResolvedValue(readyPreflight);
    mocks.start.mockReset().mockResolvedValue(createFreshSession());
    mocks.submit.mockReset();
    mocks.showConfirm.mockReset().mockResolvedValue(true);
    mocks.renderer.mockReset();
    vi.restoreAllMocks();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('does not start on route render and explicitly starts only after a fresh READY preflight', async () => {
    renderPlayerRoute();

    expect(screen.getByRole('heading', { name: 'Vòng 2 — Tăng tốc' })).toBeInTheDocument();
    expect(mocks.preflightRound).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(screen.queryByTestId('canonical-question-renderer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));

    await waitFor(() => expect(mocks.preflightRound).toHaveBeenCalledWith('campaign-1', 'round-2'));
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledWith('campaign-1', 'round-2', expect.any(String));
    expect(await screen.findAllByTestId('canonical-question-renderer')).toHaveLength(2);
  });

  it('blocks start when the fresh preflight changed since the earlier entry check', async () => {
    mocks.preflightRound.mockResolvedValue({
      status: 'BLOCKED',
      campaignId: 'campaign-1',
      roundId: 'round-2',
      reason: 'ATTEMPT_LIMIT_REACHED',
      serverTime: '2026-09-10T01:01:00.000Z',
      window: null,
      attemptsRemaining: 0,
    });
    renderPlayerRoute();

    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/không thể bắt đầu/i);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(screen.queryByTestId('canonical-question-renderer')).not.toBeInTheDocument();
  });

  it('reuses the start request across an explicit remount resume and restores the canonical draft', async () => {
    const firstRender = renderPlayerRoute();
    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    await screen.findAllByTestId('canonical-question-renderer');
    fireEvent.click(screen.getAllByRole('button', { name: 'Answer current question' })[0]);
    await waitFor(() => expect(loadQuizAttemptDraft(draftIdentity)?.answers).toEqual({
      'q-1': 'changed-answer',
    }));
    const firstStartRequestId = mocks.start.mock.calls[0][2];

    firstRender.unmount();
    renderPlayerRoute();

    expect(mocks.preflightRound).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('canonical-question-renderer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    await waitFor(() => expect(mocks.preflightRound).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(2));
    expect(mocks.start.mock.calls[1][2]).toBe(firstStartRequestId);
    expect(await screen.findByLabelText('answer-q-1')).toHaveTextContent('changed-answer');
  });

  it('uses the quiz-player timer, progress, question navigation, pagination, submit controls, and renderer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-09-10T01:01:00.000Z');
    mocks.start.mockResolvedValue({
      attempt: { ...session.attempt, startedAt: '2026-09-10T01:00:00.000Z' },
      quiz: {
        ...session.quiz,
        timeLimit: 2,
        questions: Array.from({ length: 11 }, (_, index) => ({
          id: `q-${index + 1}`,
          type: 'MCQ',
          question: `Question ${index + 1}`,
          options: ['A', 'B'],
        })),
      },
    });
    renderPlayerRoute();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    });

    expect(screen.getByText('Vòng 2 — Tăng tốc')).toBeInTheDocument();
    expect(screen.getByLabelText('Thời gian còn lại 1:00')).toBeInTheDocument();
    expect(screen.getByText(/Đã hoàn thành 0\/11 câu/)).toBeInTheDocument();
    expect(screen.getAllByTestId('canonical-question-renderer')).toHaveLength(10);
    fireEvent.click(screen.getAllByRole('button', { name: 'Answer current question' })[0]);
    expect(screen.getByText(/Đã hoàn thành 1\/11 câu/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đi đến câu 11' }));
    expect(screen.getByText('Question 11')).toBeInTheDocument();
    expect(screen.getAllByRole('status').some(status => status.textContent?.includes('Trang 2 / 2'))).toBe(true);
    expect(screen.getByRole('button', { name: 'Nộp bài' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('Thời gian còn lại 0:59')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('does not render a countdown when the canonical quiz has no positive time limit', async () => {
    mocks.start.mockResolvedValue({
      ...session,
      quiz: { ...session.quiz, timeLimit: 0 },
    });
    renderPlayerRoute();

    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));

    await screen.findAllByTestId('canonical-question-renderer');
    expect(screen.queryByLabelText(/Thời gian còn lại/)).not.toBeInTheDocument();
    expect(screen.queryByText('Luyện tập')).not.toBeInTheDocument();
  });

  it('starts only one fresh preflight and canonical attempt for synchronous repeated clicks', async () => {
    const deferredPreflight = createDeferred<typeof readyPreflight>();
    mocks.preflightRound.mockReturnValue(deferredPreflight.promise);
    renderPlayerRoute();

    const startButton = screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' });
    fireEvent.click(startButton);
    fireEvent.click(startButton);
    expect(mocks.preflightRound).toHaveBeenCalledTimes(1);
    expect(mocks.start).not.toHaveBeenCalled();

    deferredPreflight.resolve(readyPreflight);
    await screen.findAllByTestId('canonical-question-renderer');
    expect(mocks.start).toHaveBeenCalledTimes(1);
  });

  it('auto-submits the expired timed attempt exactly once and locks answer editing while it is pending', async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof mocks.submit>>>();
    mocks.submit.mockReturnValue(deferred.promise);
    mocks.start.mockResolvedValue({
      attempt: {
        ...session.attempt,
        startedAt: new Date(Date.now() - 60_000).toISOString(),
      },
      quiz: { ...session.quiz, timeLimit: 1 },
    });
    renderPlayerRoute();

    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    await screen.findAllByTestId('canonical-question-renderer');
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Đang nộp bài...' })).toBeDisabled();
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Answer current question' })[0]);
    expect(screen.getByLabelText('answer-q-1')).toHaveTextContent('');

    deferred.resolve({
      result: {
        score: 8,
        correctCount: 1,
        totalQuestions: 2,
        progress: { attemptsUsed: 2, bestScore: 80, isPassed: true },
      },
    });
    await screen.findByText('Điểm: 8');
  });

  it('requires accessible manual confirmation, ignores duplicate requests, and submits once after confirmation', async () => {
    const confirmation = createDeferred<boolean>();
    mocks.showConfirm.mockReturnValueOnce(confirmation.promise).mockResolvedValueOnce(true);
    renderPlayerRoute();

    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    await screen.findAllByTestId('canonical-question-renderer');

    const submitButton = screen.getByRole('button', { name: 'Nộp bài' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    expect(mocks.showConfirm).toHaveBeenCalledWith({
      message: 'Em chắc chắn muốn nộp bài?',
      confirmLabel: 'Nộp bài',
      cancelLabel: 'Tiếp tục làm bài',
      signal: expect.any(AbortSignal),
    });
    expect(mocks.submit).not.toHaveBeenCalled();

    await act(async () => {
      confirmation.resolve(false);
      await confirmation.promise;
    });
    expect(mocks.submit).not.toHaveBeenCalled();

    fireEvent.click(submitButton);
    await waitFor(() => expect(mocks.showConfirm).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
  });

  it('does not submit again when a stale manual confirmation resolves after timer expiry completed submission', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-09-10T01:01:00.000Z');
    const confirmation = createDeferred<boolean>();
    const submittedResult = {
      result: {
        score: 8,
        correctCount: 1,
        totalQuestions: 2,
        progress: { attemptsUsed: 2, bestScore: 80, isPassed: true },
      },
    };
    mocks.showConfirm.mockReturnValue(confirmation.promise);
    mocks.submit.mockResolvedValue(submittedResult);
    mocks.start.mockResolvedValue({
      attempt: {
        ...session.attempt,
        startedAt: new Date(Date.now() - 59_000).toISOString(),
      },
      quiz: { ...session.quiz, timeLimit: 1 },
    });
    renderPlayerRoute();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    });
    expect(screen.getByLabelText('Thời gian còn lại 0:01')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    const confirmationOptions = mocks.showConfirm.mock.calls[0]?.[0] as { signal?: AbortSignal };
    expect(confirmationOptions.signal).toBeInstanceOf(AbortSignal);
    expect(confirmationOptions.signal?.aborted).toBe(false);
    expect(mocks.submit).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    expect(confirmationOptions.signal?.aborted).toBe(true);
    expect(screen.getByText('Điểm: 8')).toBeInTheDocument();

    await act(async () => {
      confirmation.resolve(true);
      await confirmation.promise;
      await Promise.resolve();
    });

    expect(mocks.submit).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('aborts a pending manual confirmation when the active player unmounts', async () => {
    const confirmation = createDeferred<boolean>();
    mocks.showConfirm.mockReturnValue(confirmation.promise);
    const view = renderPlayerRoute();

    fireEvent.click(screen.getByRole('button', { name: /^B.*THI$/i }));
    await screen.findAllByTestId('canonical-question-renderer');
    fireEvent.click(screen.getByRole('button', { name: /^N.*b.*i$/i }));

    const confirmationOptions = mocks.showConfirm.mock.calls[0]?.[0] as { signal?: AbortSignal };
    expect(confirmationOptions.signal).toBeInstanceOf(AbortSignal);
    expect(confirmationOptions.signal?.aborted).toBe(false);

    view.unmount();

    expect(confirmationOptions.signal?.aborted).toBe(true);
    expect(mocks.submit).not.toHaveBeenCalled();
  });


  it('reuses the unchanged submission intent across remount and clears the draft only after server success', async () => {
    mocks.submit
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({
        result: {
          score: 3,
          correctCount: 0,
          totalQuestions: 2,
          progress: { attemptsUsed: 2, bestScore: 62, isPassed: false },
        },
      });
    const firstRender = renderPlayerRoute();
    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    await screen.findAllByTestId('canonical-question-renderer');
    fireEvent.click(screen.getAllByRole('button', { name: 'Answer current question' })[0]);
    await waitFor(() => expect(loadQuizAttemptDraft(draftIdentity)?.answers).toEqual({
      'q-1': 'changed-answer',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/đáp án.*được giữ/i);
    const firstSubmitKey = mocks.submit.mock.calls[0][0].idempotencyKey;
    expect(loadQuizAttemptDraft(draftIdentity)?.answers).toEqual({ 'q-1': 'changed-answer' });

    firstRender.unmount();
    renderPlayerRoute();
    expect(mocks.preflightRound).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    expect(await screen.findByLabelText('answer-q-1')).toHaveTextContent('changed-answer');
    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(mocks.submit.mock.calls[1][0].idempotencyKey).toBe(firstSubmitKey);
    expect(loadQuizAttemptDraft(draftIdentity)).toBeNull();
    expect(await screen.findByText('Điểm: 3')).toBeInTheDocument();
    expect(screen.getByText('Số câu đúng: 0/2')).toBeInTheDocument();
    expect(screen.queryByText('Điểm: 10')).not.toBeInTheDocument();
  });

  it('prevents unload and same-document navigation only while a submission promise is unresolved', async () => {
    const deferred = createDeferred<Awaited<ReturnType<typeof mocks.submit>>>();
    mocks.submit.mockReturnValue(deferred.promise);
    renderPlayerRoute();
    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    await screen.findAllByTestId('canonical-question-renderer');

    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đang nộp bài...' })).toBeDisabled());
    const pendingUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(pendingUnload);
    expect(pendingUnload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Leave player' }));
    expect(screen.queryByText('navigation-target')).not.toBeInTheDocument();

    deferred.resolve({
      result: {
        score: 8,
        correctCount: 1,
        totalQuestions: 2,
        progress: { attemptsUsed: 2, bestScore: 80, isPassed: true },
      },
    });
    expect(await screen.findByText('Điểm: 8')).toBeInTheDocument();
    const completedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(completedUnload);
    expect(completedUnload.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole('link', { name: 'Leave player' }));
    expect(await screen.findByText('navigation-target')).toBeInTheDocument();
  });

  it('restores the player after actual browser back navigation while submission is pending, then releases history after submit', async () => {
    window.history.replaceState(null, '', '/leaving');
    window.history.pushState(null, '', '/thi/olympic-toan/vong/2/lam-bai');
    const deferred = createDeferred<Awaited<ReturnType<typeof mocks.submit>>>();
    mocks.submit.mockReturnValue(deferred.promise);
    renderBrowserPlayerRoute();

    fireEvent.click(screen.getByRole('button', { name: 'BẮT ĐẦU BÀI THI' }));
    await screen.findAllByTestId('canonical-question-renderer');
    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));

    act(() => window.history.back());

    await waitFor(() => expect(window.location.pathname).toBe('/thi/olympic-toan/vong/2/lam-bai'));
    expect(screen.queryByText('navigation-target')).not.toBeInTheDocument();

    deferred.resolve({
      result: {
        score: 8,
        correctCount: 1,
        totalQuestions: 2,
        progress: { attemptsUsed: 2, bestScore: 80, isPassed: true },
      },
    });
    await screen.findByText('Điểm: 8');
    act(() => window.history.back());
    expect(await screen.findByText('navigation-target')).toBeInTheDocument();
  });
});
