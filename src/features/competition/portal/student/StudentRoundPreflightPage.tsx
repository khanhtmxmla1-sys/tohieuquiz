import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import type {
  CompetitionEntryPreflightDto,
  CompetitionEntryPreflightReason,
  StudentCompetitionPortalDto,
} from '../../../../../shared/competition-portal.contract';
import { studentCompetitionPortalService } from '../studentCompetitionPortalService';
import { hasAcknowledgedRules } from './rulesAcknowledgement';

const reasonLabels: Record<CompetitionEntryPreflightReason, string> = {
  NOT_IN_AUDIENCE: 'Em không thuộc danh sách tham gia cuộc thi.',
  ROUND_CAMPAIGN_MISMATCH: 'Vòng thi không thuộc cuộc thi này.',
  ROUND_NOT_OPEN: 'Vòng thi hiện chưa mở.',
  PREREQUISITE_NOT_MET: 'Em chưa hoàn thành điều kiện của vòng trước.',
  ELIGIBILITY_BLOCKED: 'Em chưa đủ điều kiện tham gia vòng thi.',
  ATTEMPT_LIMIT_REACHED: 'Đã hết số lượt thi cho phép.',
  QUIZ_MAPPING_UNAVAILABLE: 'Chưa có đề thi phù hợp với lớp của em.',
  SCHOOL_EXAM_NOT_QUALIFIED: 'Em chưa đủ điều kiện tham gia School Exam.',
  SCHOOL_EXAM_EVENT_NOT_READY: 'School Exam chưa sẵn sàng.',
  SCHOOL_EXAM_MEMBER_NOT_READY: 'Thông tin thí sinh School Exam chưa sẵn sàng.',
  SCHOOL_EXAM_ROOM_NOT_READY: 'Phòng School Exam chưa sẵn sàng.',
  SCHOOL_EXAM_WINDOW_NOT_OPEN: 'Chưa đến giờ vào School Exam.',
  SCHOOL_EXAM_WINDOW_CLOSED: 'Đã hết giờ vào School Exam.',
  SCHOOL_EXAM_CAPACITY_NOT_CERTIFIED: 'School Exam chưa hoàn tất kiểm tra tải.',
  SCHOOL_EXAM_SESSION_NOT_PROVISIONED: 'Phiên School Exam chưa được thiết lập.',
  SCHOOL_EXAM_PARTICIPANT_SCOPE_MISMATCH: 'Thông tin thí sinh không khớp với School Exam.',
  SCHOOL_EXAM_ACCESS_CODE_INVALID: 'Mã truy cập School Exam không hợp lệ.',
  SCHOOL_EXAM_CANDIDATE_CODE_INVALID: 'Mã thí sinh School Exam không hợp lệ.',
};

const formatServerTime = (value: string, timezone: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: timezone,
}).format(new Date(value));

const PreflightWindow = ({ window }: { window: NonNullable<CompetitionEntryPreflightDto['window']> }) => (
  <dl className="grid gap-2 text-sm sm:grid-cols-2">
    <div>Giờ mở: {formatServerTime(window.opensAt, window.timezone)}</div>
    <div>Giờ đóng: {formatServerTime(window.closesAt, window.timezone)}</div>
    <div>Múi giờ: {window.timezone}</div>
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
        <Link className="font-semibold text-sky-800 underline" to={`/thi/${portal.slug}/vong/${round.roundNumber}/quy-che`}>
          Quay lại quy chế
        </Link>
      </section>
    );
  }
  if (loading) return <p role="status">Đang kiểm tra điều kiện vào thi…</p>;
  if (transientError) {
    return (
      <section role="alert" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <h1 className="text-xl font-bold">Không thể kết nối để kiểm tra</h1>
        <p>Đây có thể là lỗi tạm thời. Vui lòng thử lại.</p>
        <button type="button" onClick={() => void runPreflight()} className="min-h-11 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white">
          Thử lại
        </button>
      </section>
    );
  }
  if (!result) return null;

  const timezone = result.window?.timezone ?? 'Asia/Ho_Chi_Minh';
  if (result.status === 'BLOCKED') {
    return (
      <section role="alert" className="space-y-3 rounded-2xl border border-red-300 bg-red-50 p-5">
        <h1 className="text-xl font-bold"><span aria-hidden="true">⚠ </span>Không thể vào thi</h1>
        <p>{reasonLabels[result.reason]}</p>
        <p className="text-sm">Giờ máy chủ: {formatServerTime(result.serverTime, timezone)}</p>
        {result.window && <PreflightWindow window={result.window} />}
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
      <h1 className="text-xl font-bold"><span aria-hidden="true">✓ </span>Sẵn sàng vào thi</h1>
      <p>Còn {result.attemptsRemaining} lượt thi.</p>
      <p className="text-sm">Giờ máy chủ: {formatServerTime(result.serverTime, timezone)}</p>
      <PreflightWindow window={result.window} />
      <Link
        to={`/thi/${portal.slug}/vong/${round.roundNumber}/lam-bai`}
        className="inline-flex min-h-11 items-center rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white"
      >
        BẮT ĐẦU
      </Link>
    </section>
  );
};

export default StudentRoundPreflightPage;
