import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router';
import type { StudentCompetitionPortalDto } from '../../../../../shared/competition-portal.contract';
import { joinLiveExam } from '../../../../services/liveExamService';
import { StudentLiveExamScreen } from '../../../student-dashboard/components/StudentLiveExamScreen';
import { useStudentLiveExam } from '../../../student-dashboard/hooks/useStudentLiveExam';
import { studentCompetitionPortalService } from '../studentCompetitionPortalService';
import {
  getCompetitionPreflightErrorMessage,
  getCompetitionPreflightReasonMessage,
} from './studentCompetitionPresentation';

const EMBARGO_MESSAGE = 'Bài thi đã được ghi nhận. Kết quả chính thức sẽ được công bố sau khi Ban tổ chức hoàn tất đối soát.';

const CompetitionSchoolExamPlayer = () => {
  const portal = useOutletContext<StudentCompetitionPortalDto>();
  const controller = useStudentLiveExam();
  const startInFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (startInFlight.current) return;
    startInFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const preflight = await studentCompetitionPortalService.preflightSchoolExam(portal.campaignId);
      if (preflight.status !== 'READY') {
        setError(getCompetitionPreflightReasonMessage(preflight.reason));
        return;
      }
      const joined = await joinLiveExam(preflight.accessCode);
      controller.join(joined.session);
    } catch (cause) {
      setError(getCompetitionPreflightErrorMessage(cause));
    } finally {
      startInFlight.current = false;
      setPending(false);
    }
  };

  if (controller.joinedExam) {
    if (controller.stage === 'submitted' || controller.stage === 'results') {
      return (
        <section
          aria-labelledby="school-exam-submitted-title"
          className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-sky-700">{portal.title}</p>
          <h1 id="school-exam-submitted-title" className="mt-2 text-2xl font-bold text-slate-950">
            Thi cấp trường
          </h1>
          <p role="status" className="mt-4 text-slate-700">{EMBARGO_MESSAGE}</p>
        </section>
      );
    }
    return <StudentLiveExamScreen controller={controller} />;
  }

  return (
    <section
      aria-labelledby="school-exam-start-title"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <p className="text-sm font-semibold text-sky-700">{portal.title}</p>
      <h1 id="school-exam-start-title" className="text-2xl font-bold text-slate-950">Thi cấp trường</h1>
      <p>Hệ thống sẽ kiểm tra lại phòng thi, thành viên và thời gian ngay khi em bắt đầu.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => void start()}
        className="min-h-11 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {pending ? 'ĐANG KIỂM TRA…' : 'BẮT ĐẦU THI CẤP TRƯỜNG'}
      </button>
    </section>
  );
};

export default CompetitionSchoolExamPlayer;
