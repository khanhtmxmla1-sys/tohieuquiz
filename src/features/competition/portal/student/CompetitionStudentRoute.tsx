import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import type { StudentCompetitionPortalDto } from '../../../../../shared/competition-portal.contract';
import {
  studentCompetitionPortalService,
  type StudentCompetitionPortalErrorKind,
  type StudentCompetitionPortalResolution,
} from '../studentCompetitionPortalService';
import CompetitionStudentShell from './CompetitionStudentShell';

type RouteState =
  | { status: 'loading'; slug: string }
  | { status: 'ready'; slug: string; portal: StudentCompetitionPortalDto }
  | { status: 'error'; slug: string; kind: StudentCompetitionPortalErrorKind };

const failureContent: Record<Exclude<StudentCompetitionPortalErrorKind, 'TRANSIENT'>, string> = {
  BUSINESS_RULE: 'Không thể tham gia cuộc thi',
  NOT_FOUND: 'Không tìm thấy cuộc thi',
  AUTH: 'Phiên học sinh không hợp lệ',
};

const CompetitionStudentRoute = () => {
  const { campaignSlug = '' } = useParams<{ campaignSlug: string }>();
  const [attempt, setAttempt] = useState(0);
  const requests = useRef(new Map<string, Promise<StudentCompetitionPortalResolution>>());
  const [state, setState] = useState<RouteState>({ status: 'loading', slug: campaignSlug });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', slug: campaignSlug });
    let request = requests.current.get(campaignSlug);
    if (!request) {
      request = studentCompetitionPortalService.resolveBySlug(campaignSlug);
      requests.current.set(campaignSlug, request);
      void request.then(
        () => {
          if (requests.current.get(campaignSlug) === request) requests.current.delete(campaignSlug);
        },
        () => {
          if (requests.current.get(campaignSlug) === request) requests.current.delete(campaignSlug);
        },
      );
    }
    void request
      .then(({ portal }) => {
        if (active) setState({ status: 'ready', slug: campaignSlug, portal });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: 'error',
            slug: campaignSlug,
            kind: studentCompetitionPortalService.classifyError(error).kind,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [campaignSlug, attempt]);

  if (state.status === 'loading' || state.slug !== campaignSlug) {
    return (
      <CompetitionStudentShell>
        <p role="status" aria-live="polite">Đang tải cuộc thi…</p>
      </CompetitionStudentShell>
    );
  }

  if (state.status === 'error') {
    const transient = state.kind === 'TRANSIENT';
    return (
      <CompetitionStudentShell>
        <section role="alert" className="rounded-xl border border-slate-200 bg-white p-5">
          <h1 className="text-xl font-bold">
            {transient ? 'Không thể kết nối đến cuộc thi' : failureContent[state.kind]}
          </h1>
          {transient && (
            <button
              type="button"
              onClick={() => {
                requests.current.delete(campaignSlug);
                setAttempt(current => current + 1);
              }}
              className="mt-4 min-h-11 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white"
            >
              Thử lại
            </button>
          )}
        </section>
      </CompetitionStudentShell>
    );
  }

  return <CompetitionStudentShell portal={state.portal} />;
};

export default CompetitionStudentRoute;
