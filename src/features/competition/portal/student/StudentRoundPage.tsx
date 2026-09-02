import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import type {
  PublicCompetitionDetailDto,
  StudentCompetitionPortalDto,
} from '../../../../../shared/competition-portal.contract';
import { callApi } from '../../../../services/apiAdapter';
import { formatSystemDateTime } from '../../../../utils/dateTime';
import {
  studentCompetitionService,
  type StudentCompetitionDetail,
} from '../../studentCompetitionService';
import { mapRoundPresentation } from './roundPresentation';

const stateLabels = {
  LOCKED: 'Chưa mở',
  OPEN: 'Đang mở',
  PASSED: 'Đã vượt qua',
  FAILED_RETRY_AVAILABLE: 'Có thể thi lại',
  CLOSED: 'Đã đóng',
} as const;

type PublicCompetitionResponse = PublicCompetitionDetailDto | {
  status: 'success';
  data: PublicCompetitionDetailDto;
};

const unwrapPublicCompetition = (response: PublicCompetitionResponse): PublicCompetitionDetailDto => {
  if ('status' in response && response.status === 'success') return response.data;
  return response as PublicCompetitionDetailDto;
};

const StudentRoundPage = () => {
  const portal = useOutletContext<StudentCompetitionPortalDto>();
  const { roundNumber = '' } = useParams<{ roundNumber: string }>();
  const parsedRoundNumber = Number(roundNumber);
  const portalRound = portal.rounds.find(round => round.roundNumber === parsedRoundNumber);
  const [competition, setCompetition] = useState<StudentCompetitionDetail | null>(null);
  const [publicDetail, setPublicDetail] = useState<PublicCompetitionDetailDto | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setCompetition(null);
    setPublicDetail(null);
    setFailed(false);
    void Promise.all([
      studentCompetitionService.get(portal.campaignId),
      callApi<PublicCompetitionResponse>(
        'get_public_competition',
        { slug: portal.slug },
      ),
    ]).then(
      ([detail, response]) => {
        if (!active) return;
        const publicPage = unwrapPublicCompetition(response);
        if (detail.id !== portal.campaignId || publicPage.slug !== portal.slug) {
          setFailed(true);
        } else {
          setCompetition(detail);
          setPublicDetail(publicPage);
        }
      },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [portal.campaignId, portal.slug]);

  const round = competition?.rounds.find(item => item.id === portalRound?.roundId);

  if (!portalRound) return <p role="alert">Không tìm thấy vòng thi.</p>;
  if (failed) return <p role="alert">Không thể tải thông tin vòng thi. Vui lòng thử lại sau.</p>;
  if (!round || !publicDetail) return <p role="status" aria-live="polite">Đang tải thông tin vòng thi…</p>;

  const eligibilityBlocked = competition?.status === 'ELIGIBILITY_LOCKED'
    && competition.eligibility?.qualified === false;
  const presentation = mapRoundPresentation(round, eligibilityBlocked);
  const timezone = publicDetail.timezone;

  return (
    <article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <header>
        <p className="text-sm font-semibold text-sky-700">Vòng {portalRound.roundNumber}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">{portalRound.title}</h1>
        <p className="mt-2 font-semibold text-slate-700">{stateLabels[presentation.state]}</p>
      </header>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold">Múi giờ</dt><dd>{timezone}</dd></div>
        <div><dt className="font-semibold">Mở vòng</dt><dd>{formatSystemDateTime(portalRound.opensAt)}</dd></div>
        <div><dt className="font-semibold">Đóng vòng</dt><dd>{formatSystemDateTime(portalRound.closesAt)}</dd></div>
      </dl>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>Điểm đạt: {round.passingScore}</div>
        <div>Đã dùng: {round.attemptsUsed}/{round.maxAttempts} lượt</div>
        <div>Còn lại: {presentation.attemptsRemaining} lượt</div>
        {round.bestScore !== null && <div>Điểm tốt nhất: {round.bestScore}</div>}
      </div>

      <Link
        to={`/thi/${portal.slug}/vong/${portalRound.roundNumber}/quy-che`}
        className="inline-flex min-h-11 items-center rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
      >
        VÀO THI
      </Link>
    </article>
  );
};

export default StudentRoundPage;
