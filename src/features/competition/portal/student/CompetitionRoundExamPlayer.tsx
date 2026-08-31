import { useCallback, useRef } from 'react';
import { useOutletContext, useParams } from 'react-router';
import type { StudentCompetitionPortalDto } from '../../../../../shared/competition-portal.contract';
import QuestionRenderer from '../../../../components/student/QuestionRenderer';
import QuizHeader from '../../../quiz-player/components/QuizHeader';
import QuizNavigation from '../../../quiz-player/components/QuizNavigation';
import QuizPagination from '../../../quiz-player/components/QuizPagination';
import { useQuizPageNavigation } from '../../../quiz-player/hooks/useQuizPageNavigation';
import { useLiveExamTimer } from '../../../live-exam/hooks/useLiveExamTimer';
import { useQuizProgressRollout } from '../../../quiz-player/hooks/useQuizProgressRollout';
import { useCompetitionRoundAttempt } from './useCompetitionRoundAttempt';

const QUESTIONS_PER_PAGE = 10;

type RoundAttemptState = ReturnType<typeof useCompetitionRoundAttempt>;
type ActiveRoundAttempt = NonNullable<RoundAttemptState['active']>;

const getExpiresAt = (active: ActiveRoundAttempt): string | null => {
  const timeLimitMinutes = Number(active.quiz.timeLimit);
  const startedAtMs = Date.parse(active.attempt.startedAt);
  if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes <= 0 || !Number.isFinite(startedAtMs)) {
    return null;
  }
  return new Date(startedAtMs + timeLimitMinutes * 60_000).toISOString();
};

interface CompetitionActiveRoundPlayerProps {
  active: ActiveRoundAttempt;
  attempt: RoundAttemptState;
  roundTitle: string;
}

const CompetitionActiveRoundPlayer = ({
  active,
  attempt,
  roundTitle,
}: CompetitionActiveRoundPlayerProps) => {
  const { quiz } = active;
  const submitOnExpiryRef = useRef<() => void>(() => undefined);
  submitOnExpiryRef.current = () => { void attempt.submit(); };
  const handleExpiry = useCallback(() => submitOnExpiryRef.current(), []);
  const expiresAt = getExpiresAt(active);
  const { isExpired, timeRemaining } = useLiveExamTimer({
    endsAt: expiresAt,
    onExpire: handleExpiry,
  });
  const isEditingLocked = isExpired || attempt.submitting;
  const questionCount = quiz.questions.length;
  const totalPages = Math.max(1, Math.ceil(questionCount / QUESTIONS_PER_PAGE));
  const quizProgress = useQuizProgressRollout({
    quizId: quiz.id,
    questions: quiz.questions,
    answers: attempt.answers,
  });
  const { activeQuestionId, changePage } = useQuizPageNavigation({
    questions: quiz.questions,
    currentPage: attempt.currentPage,
    totalPages,
    questionsPerPage: QUESTIONS_PER_PAGE,
    setCurrentPage: attempt.setCurrentPage,
  });
  const questionsOnCurrentPage = quiz.questions.slice(
    (attempt.currentPage - 1) * QUESTIONS_PER_PAGE,
    attempt.currentPage * QUESTIONS_PER_PAGE,
  );

  return (
    <section aria-label={quiz.title} className="min-h-screen bg-gray-50">
      <QuizHeader
        title={quiz.title}
        timeLeft={timeRemaining}
        showTimer={expiresAt !== null}
        totalQuestions={questionCount}
        completedCount={quizProgress.completeCount}
        partialCount={quizProgress.partialCount}
        isPractice={false}
      />

      <div
        className="border-b border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-sky-700"
        role="status"
        aria-live="polite"
      >
        {roundTitle}
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row">
        <aside className="hidden w-72 flex-shrink-0 lg:block">
          <QuizNavigation
            questions={quiz.questions}
            progressByQuestionId={quizProgress.byQuestionId}
            activeQuestionId={activeQuestionId}
            QUESTIONS_PER_PAGE={QUESTIONS_PER_PAGE}
            onPageChange={changePage}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <div className="space-y-8">
            {questionsOnCurrentPage.map((question, index) => (
              <div
                key={question.id}
                id={`question-${question.id}`}
                tabIndex={-1}
                aria-label={`Câu ${(attempt.currentPage - 1) * QUESTIONS_PER_PAGE + index + 1}`}
                className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-5 focus:outline-none"
              >
                <QuestionRenderer
                  quizId={quiz.id}
                  question={question}
                  index={(attempt.currentPage - 1) * QUESTIONS_PER_PAGE + index}
                  answers={attempt.answers}
                  onAnswerChange={(questionId, value, subId) => {
                    if (!isEditingLocked) attempt.answerQuestion(questionId, value, subId);
                  }}
                  onMatchingClick={(questionId, item, type) => {
                    if (!isEditingLocked) attempt.matchQuestion(questionId, item, type);
                  }}
                />
              </div>
            ))}
          </div>

          <QuizPagination
            currentPage={attempt.currentPage}
            totalPages={totalPages}
            onPageChange={changePage}
            onSubmit={() => {
              if (window.confirm('Em chắc chắn muốn nộp bài?')) void attempt.submit();
            }}
            isSubmitting={attempt.submitting}
          />

          {isExpired && !attempt.error && (
            <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">
              Hết giờ. Hệ thống đang nộp bài.
            </p>
          )}

          {attempt.error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
              {attempt.error}
            </p>
          )}
        </main>
      </div>
    </section>
  );
};

const CompetitionRoundExamPlayer = () => {
  const portal = useOutletContext<StudentCompetitionPortalDto>();
  const { roundNumber = '' } = useParams<{ roundNumber: string }>();
  const round = portal.rounds.find(item => item.roundNumber === Number(roundNumber));
  const attempt = useCompetitionRoundAttempt(portal.campaignId, round?.roundId ?? '');

  if (!round) return <p role="alert">Không tìm thấy vòng thi.</p>;

  if (attempt.result) {
    return (
      <section aria-labelledby="competition-result-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-sky-700">{round.title}</p>
        <h1 id="competition-result-title" className="text-2xl font-bold">Kết quả bài thi</h1>
        <p className="text-xl font-bold">Điểm: {attempt.result.score}</p>
        <p>Số câu đúng: {attempt.result.correctCount}/{attempt.result.totalQuestions}</p>
        <p>{attempt.result.progress.isPassed ? 'Đã vượt qua vòng thi.' : 'Chưa vượt qua vòng thi.'}</p>
      </section>
    );
  }

  if (!attempt.active) {
    return (
      <section aria-labelledby="competition-start-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-sky-700">{portal.title}</p>
        <h1 id="competition-start-title" className="text-2xl font-bold">{round.title}</h1>
        <p>Hệ thống sẽ kiểm tra lại điều kiện ngay khi em bắt đầu.</p>
        {attempt.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{attempt.error}</p>}
        <button
          type="button"
          disabled={attempt.pending}
          onClick={() => void attempt.start()}
          className="min-h-11 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {attempt.pending ? 'ĐANG KIỂM TRA…' : 'BẮT ĐẦU BÀI THI'}
        </button>
      </section>
    );
  }

  return (
    <CompetitionActiveRoundPlayer
      active={attempt.active}
      attempt={attempt}
      roundTitle={round.title}
    />
  );
};

export default CompetitionRoundExamPlayer;
