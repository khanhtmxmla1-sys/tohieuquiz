import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import type {
  CompetitionEntryPreflightDto,
  StudentCompetitionPortalDto,
} from '../../../../../shared/competition-portal.contract';
import { SYSTEM_TIME_ZONE } from '../../../../../shared/time-zone.contract';
import { studentCompetitionPortalService } from '../studentCompetitionPortalService';
import { formatSystemDateTime } from '../../../../utils/dateTime';
import { hasAcknowledgedRules } from './rulesAcknowledgement';
import { getCompetitionPreflightReasonMessage } from './studentCompetitionPresentation';

const PreflightWindow = ({
  window,
  timezoneLabel = window.timezone,
}: {
  window: NonNullable<CompetitionEntryPreflightDto['window']>;
  timezoneLabel?: string;
}) => (
  <dl className="grid gap-2 text-sm sm:grid-cols-2">
    <div><dt>Giờ mở</dt><dd>{formatSystemDateTime(window.opensAt)}</dd></div>
    <div><dt>Giờ đóng</dt><dd>{formatSystemDateTime(window.closesAt)}</dd></div>
    <div><dt>Múi giờ</dt><dd>{timezoneLabel}</dd></div>
  </dl>
);

const StudentRoundPreflightPage = () => {
  const portal = useOutletContext<StudentCompetitionPortalDto>();
  const { roundNumber = '' } = useParams<{ roundNumber: string }>();
  const round = portal.rounds.find(item => item.roundNumber === Number(roundNumber));
  const acknowledged = Boolean(round && hasAcknowledgedRules(portal.campaignId, round.roundId));
  const [result, setResult] = useState<CompetitionEntryPreflightDto | null>(null);
  const [loading, setLoading] = useState(acknowledged);
  const [transientError, setTransientError] = useState(false);

  const runPreflight = useCallback(async () => {
    if (!round || !acknowledged) return;
    setLoading(true);
    setTransientError(false);
    setResult(null);
    try {
      const preflight = await studentCompetitionPortalService.preflightRound(portal.campaignId, round.roundId);
      if (preflight.campaignId !== portal.campaignId || preflight.roundId !== round.roundId) {
        setTransientError(true);
        return;
      }
      setResult(preflight);
    } catch {
      setTransientError(true);
    } finally {
      setLoading(false);
    }
  }, [acknowledged, portal.campaignId, round]);

  useEffect(() => { void runPreflight(); }, [runPreflight]);

  if (!round) return <p role="alert">Không tìm thấy vòng thi.</p>;
  if (!acknowledged) {
    return (
      <section role="alert" className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <h1 className="text-xl font-bold">Cần xác nhận quy chế trước khi kiểm tra</h1>
        <Link className="inline-flex min-h-11 items-center rounded font-semibold text-sky-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2" to={`/thi/${portal.slug}/vong/${round.roundNumber}/quy-che`}>
          Quay lại quy chế
        </Link>
      </section>
    );
  }
  if (loading) return <p role="status" aria-live="polite">Đang kiểm tra điều kiện vào thi…</p>;
  if (transientError) {
    return (
      <section role="alert" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <h1 className="text-xl font-bold">Không thể kết nối để kiểm tra</h1>
        <p>Đây có thể là lỗi tạm thời. Vui lòng thử lại.</p>
        <button type="button" onClick={() => void runPreflight()} className="min-h-11 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2">
          Thử lại
        </button>
      </section>
    );
  }
  if (!result) return null;

  const timezone = result.window?.timezone ?? SYSTEM_TIME_ZONE;
  if (result.status === 'BLOCKED') {
    return (
      <section role="alert" className="space-y-3 rounded-2xl border border-red-300 bg-red-50 p-5">
        <h1 className="text-xl font-bold"><span aria-hidden="true">⚠ </span>Không thể vào thi</h1>
        <p>{getCompetitionPreflightReasonMessage(result.reason)}</p>
        <p className="text-sm">Giờ máy chủ: {formatSystemDateTime(result.serverTime)}</p>
        {result.window && <PreflightWindow window={result.window} timezoneLabel={timezone} />}
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
      <h1 className="text-xl font-bold"><span aria-hidden="true">✓ </span>Sẵn sàng vào thi</h1>
      <p>Còn {result.attemptsRemaining} lượt thi.</p>
      <p className="text-sm">Giờ máy chủ: {formatSystemDateTime(result.serverTime)}</p>
      <PreflightWindow window={result.window} timezoneLabel={timezone} />
      <Link
        to={`/thi/${portal.slug}/vong/${round.roundNumber}/lam-bai`}
        className="inline-flex min-h-11 items-center rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
      >
        BẮT ĐẦU
      </Link>
    </section>
  );
};

export default StudentRoundPreflightPage;
