import React, { useCallback, useEffect, useState } from 'react';
import QuestionRenderer from '../../components/student/QuestionRenderer';
import { updateMatchingAnswer } from '../quiz-player/utils/structuredAnswerUpdates';
import {
  studentCompetitionService,
  type StudentCompetitionAttempt,
  type StudentCompetitionDetail,
  type StudentCompetitionOfficialResult,
  type StudentCompetitionQuiz,
  type StudentCompetitionSummary,
} from './studentCompetitionService';

const requestId = (prefix: string) => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
};

const StudentCompetitionPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<StudentCompetitionSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [competition, setCompetition] = useState<StudentCompetitionDetail | null>(null);
  const [officialResult, setOfficialResult] = useState<StudentCompetitionOfficialResult | null>(null);
  const [attempt, setAttempt] = useState<StudentCompetitionAttempt | null>(null);
  const [quiz, setQuiz] = useState<StudentCompetitionQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [startedAt, setStartedAt] = useState(0);
  const [roundScore, setRoundScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void studentCompetitionService.list()
      .then(items => {
        if (cancelled) return;
        setCampaigns(items);
        setSelectedCampaignId(items[0]?.id || '');
      })
      .catch(() => { if (!cancelled) setError('Không tải được danh sách cuộc thi.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) {
      setCompetition(null);
      setOfficialResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.allSettled([
      studentCompetitionService.get(selectedCampaignId),
      studentCompetitionService.officialResult(selectedCampaignId),
    ]).then(([detail, result]) => {
      if (cancelled) return;
      if (detail.status === 'fulfilled') setCompetition(detail.value);
      else setError('Không tải được thông tin cuộc thi.');
      setOfficialResult(result.status === 'fulfilled' ? result.value : null);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCampaignId]);

  const handleAnswerChange = useCallback((questionId: string, value: any, subId?: string) => {
    setAnswers(current => subId
      ? { ...current, [questionId]: { ...(current[questionId] || {}), [subId]: value } }
      : { ...current, [questionId]: value });
  }, []);

  const handleMatchingClick = useCallback((questionId: string, item: string, type: 'left' | 'right') => {
    setAnswers(current => ({
      ...current,
      [questionId]: updateMatchingAnswer(current[questionId], item, type),
    }));
  }, []);

  const startRound = async (roundId: string) => {
    if (!competition || pending) return;
    setPending(true);
    setError(null);
    setRoundScore(null);
    try {
      const session = await studentCompetitionService.start(
        competition.id,
        roundId,
        requestId('competition-start'),
      );
      setAttempt(session.attempt);
      setQuiz(session.quiz);
      setAnswers({});
      setStartedAt(Date.now());
    } catch {
      setError('Không thể bắt đầu vòng thi này.');
    } finally {
      setPending(false);
    }
  };

  const submitAttempt = async () => {
    if (!attempt || !quiz || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await studentCompetitionService.submit({
        campaignId: attempt.campaignId,
        roundId: attempt.roundId,
        attemptId: attempt.id,
        answers,
        timeTaken: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
        idempotencyKey: requestId('competition-submit'),
      });
      setRoundScore(response.result.score);
      setAttempt(null);
      setQuiz(null);
      const refreshed = await studentCompetitionService.get(attempt.campaignId);
      setCompetition(refreshed);
    } catch {
      setError('Không thể nộp bài. Đáp án vẫn được giữ trên màn hình.');
    } finally {
      setPending(false);
    }
  };

  if (quiz && attempt) {
    return (
      <section aria-labelledby="student-competition-quiz-title" className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h1 id="student-competition-quiz-title" className="text-2xl font-bold text-slate-950">{quiz.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{quiz.questions.length} câu · {quiz.timeLimit || '—'} phút</p>
        </div>
        {quiz.questions.map((question, index) => (
          <div key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <QuestionRenderer
              quizId={quiz.id}
              question={question}
              index={index}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              onMatchingClick={handleMatchingClick}
            />
          </div>
        ))}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={submitAttempt} disabled={pending} className="min-h-11 rounded-lg bg-sky-600 px-5 py-2 font-semibold text-white disabled:opacity-50">Nộp bài</button>
      </section>
    );
  }

  return (
    <section aria-labelledby="student-competition-title" className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h1 id="student-competition-title" className="text-2xl font-bold text-slate-950">Cuộc thi của em</h1>
        <p className="mt-2 text-sm text-slate-600">Theo dõi sáu vòng thi và kết quả cấp trường đã được công bố.</p>
        {campaigns.length > 1 && (
          <select aria-label="Chọn cuộc thi" value={selectedCampaignId} onChange={event => setSelectedCampaignId(event.target.value)} className="mt-4 rounded-lg border px-3 py-2">
            {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
          </select>
        )}
      </div>

      {loading && !competition && <p className="text-sm text-slate-500">Đang tải cuộc thi…</p>}
      {!loading && campaigns.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Em chưa thuộc đối tượng của cuộc thi nào.</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {roundScore !== null && <p className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-800">Điểm vòng: {roundScore}</p>}

      {competition && (
        <div className="grid gap-4 md:grid-cols-2">
          {competition.rounds.map(round => {
            const canStart = round.status === 'OPEN' && round.attemptsUsed < round.maxAttempts;
            return (
              <article key={round.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Vòng {round.roundNumber}</h2>
                  <span className="text-xs font-semibold text-slate-500">{round.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">Đã dùng {round.attemptsUsed}/{round.maxAttempts} lượt · Điểm đạt {round.passingScore}</p>
                {round.bestScore !== null && <p className="mt-1 text-sm font-semibold text-sky-700">Điểm tốt nhất {round.bestScore}</p>}
                <button type="button" onClick={() => startRound(round.id)} disabled={!canStart || pending} className="mt-4 min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Bắt đầu vòng {round.roundNumber}</button>
              </article>
            );
          })}
        </div>
      )}

      <article className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Kết quả chính thức</h2>
        {officialResult ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <span>Điểm: <strong>{officialResult.score}</strong></span>
            <span>Hạng toàn trường: <strong>{officialResult.rankEvent}</strong></span>
            <span>Hạng khối: <strong>{officialResult.rankGrade}</strong></span>
            <span>Hạng lớp: <strong>{officialResult.rankClass}</strong></span>
          </div>
        ) : <p className="mt-2 text-sm text-slate-600">Kết quả chính thức chưa được công bố.</p>}
      </article>
    </section>
  );
};

export default StudentCompetitionPage;
