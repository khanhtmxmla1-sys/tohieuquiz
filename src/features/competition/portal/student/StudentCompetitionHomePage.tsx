import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import type {
  CompetitionPublicState,
  CompetitionRoundPresentationState,
  StudentCompetitionPortalDto,
} from '../../../../../shared/competition-portal.contract';
import {
  studentCompetitionService,
  type StudentCompetitionDetail,
  type StudentCompetitionOfficialResult,
} from '../../studentCompetitionService';
import {
  studentCompetitionPortalService,
  type StudentSchoolExamPreflightDto,
} from '../studentCompetitionPortalService';
import { mapRoundPresentation } from './roundPresentation';
import { getCompetitionPreflightReasonMessage } from './studentCompetitionPresentation';

const campaignStatus: Record<CompetitionPublicState, string> = {
  UPCOMING: 'Sắp diễn ra',
  ONGOING: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
};

const roundStatus: Record<CompetitionRoundPresentationState, string> = {
  LOCKED: 'Chưa mở',
  OPEN: 'Đang mở',
  PASSED: 'Đã vượt qua',
  FAILED_RETRY_AVAILABLE: 'Có thể thi lại',
  CLOSED: 'Đã đóng',
};

const StudentCompetitionHomePage = () => {
  const portal = useOutletContext<StudentCompetitionPortalDto>();
  const [competition, setCompetition] = useState<StudentCompetitionDetail | null>(null);
  const [officialResult, setOfficialResult] = useState<StudentCompetitionOfficialResult | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [schoolExamPreflight, setSchoolExamPreflight] = useState<
    StudentSchoolExamPreflightDto | 'LOADING' | 'ERROR' | null
  >(null);

  useEffect(() => {
    let active = true;
    setCompetition(null);
    setOfficialResult(null);
    setLoadFailed(false);
    setSchoolExamPreflight(null);

    void Promise.allSettled([
      studentCompetitionService.get(portal.campaignId),
      studentCompetitionService.officialResult(portal.campaignId),
    ]).then(([detail, result]) => {
      if (!active) return;
      if (detail.status === 'fulfilled') setCompetition(detail.value);
      else setLoadFailed(true);
      if (result.status === 'fulfilled') setOfficialResult(result.value);
    });

    return () => {
      active = false;
    };
  }, [portal.campaignId]);

  const qualified = competition?.eligibility?.qualified === true;
  const eligibilityBlocked = competition?.status === 'ELIGIBILITY_LOCKED'
    && competition.eligibility?.qualified === false;
  const rounds = competition?.rounds.map(round => ({
    canonical: round,
    portal: portal.rounds.find(item => item.roundId === round.id || item.roundNumber === round.roundNumber),
    presentation: mapRoundPresentation(round, eligibilityBlocked),
  })) ?? [];
  const nextRound = rounds.find(item => item.presentation.actionLabel);
  const nextRoundId = nextRound?.canonical.id;
  const hasPassedRound = rounds.some(item => item.presentation.state === 'PASSED');
  const waitingForRoundToOpen = !nextRound && rounds.some(item => item.presentation.state === 'LOCKED');

  const nextStepMessage = competition
    ? eligibilityBlocked
      ? 'Em chưa đủ điều kiện tham gia lúc này. Em hãy chờ giáo viên cập nhật điều kiện cho em.'
      : nextRound
        ? `${nextRound.presentation.actionLabel}. Em có thể tiếp tục hành trình ngay.`
        : waitingForRoundToOpen
          ? hasPassedRound
            ? 'Em hãy chờ vòng tiếp theo mở để tiếp tục hành trình.'
            : 'Em hãy chờ vòng đầu tiên mở để bắt đầu hành trình.'
        : qualified
          ? 'Em đã hoàn thành các vòng đang mở. Em hãy theo dõi lịch để biết khi vòng tiếp theo bắt đầu.'
          : 'Em hãy theo dõi lịch để biết bước tiếp theo của cuộc thi.'
    : null;

  const checkSchoolExam = async () => {
    setSchoolExamPreflight('LOADING');
    try {
      setSchoolExamPreflight(await studentCompetitionPortalService.preflightSchoolExam(portal.campaignId));
    } catch {
      setSchoolExamPreflight('ERROR');
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="competition-home-title">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-sky-700">{campaignStatus[portal.publicState]}</p>
        <h1 id="competition-home-title" className="mt-1 text-2xl font-bold text-slate-950">
          {portal.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">Năm học {portal.schoolYear}</p>
        {competition?.eligibility && (
          <p className="mt-3 font-medium text-slate-800">
            {qualified ? 'Em đủ điều kiện tham gia.' : 'Hiện tại em chưa đủ điều kiện tham gia.'}
          </p>
        )}
      </header>

      {!competition && !loadFailed && <p role="status" aria-live="polite">Đang tải hành trình cuộc thi…</p>}
      {loadFailed && <p role="alert">Không thể tải tiến độ cuộc thi. Vui lòng thử lại sau.</p>}

      {competition && (
        <>
          {nextStepMessage && (
            <section aria-labelledby="next-step-title" className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
              <h2 id="next-step-title" className="text-xl font-bold text-slate-950">Bước tiếp theo</h2>
              <p className="mt-2 text-slate-700">{nextStepMessage}</p>
            </section>
          )}
          <section aria-labelledby="six-round-journey-title">
            <h2 id="six-round-journey-title" className="text-xl font-bold text-slate-950">
              Hành trình 6 vòng thi
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {rounds.map(({ canonical, portal: portalRound, presentation }) => (
                <article key={canonical.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-bold text-slate-900">
                    {portalRound?.title ?? `Vòng ${canonical.roundNumber}`}
                  </h3>
                  <p className="mt-2 font-semibold text-slate-700">{roundStatus[presentation.state]}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Đã dùng {canonical.attemptsUsed}/{canonical.maxAttempts} lượt
                  </p>
                  {presentation.actionLabel && canonical.id === nextRoundId && (
                    <Link
                      to={`/thi/${portal.slug}/vong/${canonical.roundNumber}`}
                      className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                    >
                      {presentation.actionLabel}
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {portal.schoolExam && (
        <section aria-labelledby="school-exam-title" className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 id="school-exam-title" className="text-xl font-bold text-slate-950">Thi cấp trường</h2>
          <p className="mt-2 text-slate-700">
            {portal.schoolExam.qualified ? 'Em đã đủ điều kiện dự thi cấp trường.' : 'Em chưa đủ điều kiện dự thi cấp trường.'}
          </p>
          <p className="mt-1 text-sm text-slate-600">Phòng thi: {portal.schoolExam.roomName}</p>
          <p className="mt-1 text-sm text-slate-600">
            {portal.schoolExam.ready ? 'Phòng thi đã sẵn sàng.' : 'Phòng thi đang được chuẩn bị.'}
          </p>
          {portal.schoolExam.qualified && portal.schoolExam.ready && (
            <button
              type="button"
              onClick={() => void checkSchoolExam()}
              disabled={schoolExamPreflight === 'LOADING'}
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              Kiểm tra thi cấp trường
            </button>
          )}
          {schoolExamPreflight === 'LOADING' && (
            <p role="status" aria-live="polite" className="mt-3">Đang kiểm tra thi cấp trường…</p>
          )}
          {schoolExamPreflight === 'ERROR' && (
            <p role="alert" className="mt-3">Không thể kiểm tra thi cấp trường. Vui lòng thử lại.</p>
          )}
          {schoolExamPreflight && typeof schoolExamPreflight === 'object' && (
            <div className="mt-3">
              <p role="status" aria-live="polite">
                {schoolExamPreflight.status === 'READY'
                  ? `Thi cấp trường sẵn sàng. Mã truy cập: ${schoolExamPreflight.accessCode}`
                  : getCompetitionPreflightReasonMessage(schoolExamPreflight.reason)}
              </p>
              {schoolExamPreflight.status === 'READY' && (
                <Link
                  to={`/thi/${portal.slug}/school-exam/lam-bai`}
                  className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                >
                  VÀO THI CẤP TRƯỜNG
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {officialResult && (
        <section aria-labelledby="official-result-title" className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 id="official-result-title" className="text-xl font-bold text-slate-950">Kết quả chính thức</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>Điểm: <strong>{officialResult.score}</strong></div>
            <div>Hạng toàn trường: <strong>{officialResult.rankEvent}</strong></div>
            <div>Hạng khối: <strong>{officialResult.rankGrade}</strong></div>
            <div>Hạng lớp: <strong>{officialResult.rankClass}</strong></div>
          </dl>
        </section>
      )}
    </section>
  );
};

export default StudentCompetitionHomePage;
