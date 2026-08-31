import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import type {
  PublicCompetitionDetailDto,
  StudentCompetitionPortalDto,
} from '../../../../../shared/competition-portal.contract';
import { callApi } from '../../../../services/apiAdapter';
import { acknowledgeRules } from './rulesAcknowledgement';

const StudentRoundRulesPage = () => {
  const portal = useOutletContext<StudentCompetitionPortalDto>();
  const { roundNumber = '' } = useParams<{ roundNumber: string }>();
  const navigate = useNavigate();
  const round = portal.rounds.find(item => item.roundNumber === Number(roundNumber));
  const [detail, setDetail] = useState<PublicCompetitionDetailDto | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setAccepted(false);
    setFailed(false);
    void callApi<PublicCompetitionDetailDto>('get_public_competition', { slug: portal.slug }).then(
      value => {
        if (!active) return;
        if (value.slug !== portal.slug) setFailed(true);
        else setDetail(value);
      },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [portal.slug, round?.roundId]);

  if (!round) return <p role="alert">Không tìm thấy vòng thi.</p>;
  if (!detail && !failed) return <p role="status" aria-live="polite">Đang tải quy chế…</p>;

  const rules = detail?.articles.find(article => article.type === 'RULES');

  const continueToPreflight = () => {
    acknowledgeRules(portal.campaignId, round.roundId);
    navigate(`/thi/${portal.slug}/vong/${round.roundNumber}/kiem-tra`);
  };

  return (
    <article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <header>
        <p className="text-sm font-semibold text-sky-700">Quy chế trước khi vào thi</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">
          {rules?.title ?? 'Xác nhận quy chế cuộc thi'}
        </h1>
      </header>
      {rules ? (
        <p className="whitespace-pre-wrap text-slate-700">{rules.content}</p>
      ) : (
        <p role="alert" className="text-slate-700">
          {failed
            ? 'Không thể tải nội dung quy chế lúc này. Đây có thể là lỗi kết nối tạm thời.'
            : 'Chưa có quy chế được công bố cho cuộc thi này.'}
        </p>
      )}
      <label className="flex min-h-11 items-center gap-3 font-medium text-slate-800">
        <input
          type="checkbox"
          checked={accepted}
          onChange={event => setAccepted(event.target.checked)}
          className="h-5 w-5 rounded border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
        />
        Tôi đã đọc và đồng ý với quy chế
      </label>
      <button
        type="button"
        disabled={!accepted}
        onClick={continueToPreflight}
        className="min-h-11 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        TIẾP TỤC KIỂM TRA
      </button>
    </article>
  );
};

export default StudentRoundRulesPage;
