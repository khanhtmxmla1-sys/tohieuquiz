import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuizStore } from '../../../../stores/quizStore';
import { getSessionStatus } from '../../../services/liveExamService';
import { usePollingQuery } from '../../live-exam/hooks/usePollingQuery';
import type { Question } from '../../../types';
import type { LiveExamStatusResponse, LiveExamSubmissionResponse } from '../../../types/liveExam.types';
import type { JoinedLiveExam, JoinedSessionPayload, LiveExamStage } from './liveExam.types';
import { useLiveExamQuizPreparation } from './useLiveExamQuizPreparation';

const LIVE_EXAM_STORAGE_PREFIX = 'tohieuquiz_live_exam_v1:';
const STATUS_POLL_BASE_MS = 3_000;
const STATUS_POLL_JITTER_WINDOW_MS = 800;

const readStoredExam = (sessionId?: string): JoinedLiveExam | null => {
  if (!sessionId || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${LIVE_EXAM_STORAGE_PREFIX}${sessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JoinedLiveExam>;
    if (
      parsed.sessionId !== sessionId
      || typeof parsed.sessionTitle !== 'string'
      || typeof parsed.quizId !== 'string'
      || typeof parsed.duration !== 'number'
    ) return null;
    return parsed as JoinedLiveExam;
  } catch {
    return null;
  }
};

const storeJoinedExam = (exam: JoinedLiveExam) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    `${LIVE_EXAM_STORAGE_PREFIX}${exam.sessionId}`,
    JSON.stringify(exam),
  );
};

interface StudentLiveExamOptions {
  initialSessionId?: string;
  onJoined?: (sessionId: string) => void;
  onUnrestoredClose?: () => void;
}

export const useStudentLiveExam = ({
  initialSessionId,
  onJoined,
  onUnrestoredClose,
}: StudentLiveExamOptions = {}) => {
  const quizzes = useQuizStore((state) => state.quizzes);
  const [isJoinModalOpen, setJoinModalOpen] = useState(false);
  const [joinedExam, setJoinedExam] = useState<JoinedLiveExam | null>(() => readStoredExam(initialSessionId));
  const [stage, setStage] = useState<LiveExamStage>('waiting');
  const [submission, setSubmission] = useState<LiveExamSubmissionResponse['participant'] | null>(null);
  const statusPollIntervalMs = useMemo(
    () => STATUS_POLL_BASE_MS + Math.round((Math.random() - 0.5) * STATUS_POLL_JITTER_WINDOW_MS),
    [joinedExam?.sessionId],
  );
  const fetchStatus = useCallback(
    () => getSessionStatus(joinedExam?.sessionId || ''),
    [joinedExam?.sessionId],
  );
  const shouldPollStatus = useCallback(
    (data: LiveExamStatusResponse | null) => data?.session?.status !== 'closed',
    [],
  );
  const { data: status } = usePollingQuery<LiveExamStatusResponse>({
    enabled: Boolean(joinedExam),
    intervalMs: statusPollIntervalMs,
    fetcher: fetchStatus,
    shouldPoll: shouldPollStatus,
    errorLabel: '[useStudentLiveExam] Status polling error:',
    fallbackError: 'Failed to fetch live exam status',
  });
  const joinedQuiz = useMemo(() => joinedExam
    ? quizzes.find((quiz) => quiz.id === joinedExam.quizId) || null : null,
  [joinedExam, quizzes]);
  const questions = useMemo<Question[]>(
    () => Array.isArray(joinedQuiz?.questions) ? joinedQuiz.questions : [], [joinedQuiz],
  );
  const preparation = useLiveExamQuizPreparation(joinedExam, joinedQuiz, stage);

  useEffect(() => {
    if (!initialSessionId || joinedExam?.sessionId === initialSessionId) return;
    const restored = readStoredExam(initialSessionId);
    if (restored) {
      setJoinedExam(restored);
      setStage('waiting');
      setJoinModalOpen(false);
    } else {
      setJoinModalOpen(true);
    }
  }, [initialSessionId, joinedExam?.sessionId]);

  useEffect(() => {
    const sessionStatus = status?.session?.status;
    if (!sessionStatus) return;
    if (sessionStatus === 'closed') setStage('results');
    else if (status?.participantSubmittedAt) setStage('submitted');
    else if (sessionStatus === 'active') setStage('active');
    else if (sessionStatus === 'paused') setStage('paused');
    else if (stage !== 'submitted') setStage('waiting');
  }, [stage, status?.participantSubmittedAt, status?.session?.status]);

  const join = (session: JoinedSessionPayload) => {
    const exam: JoinedLiveExam = {
      sessionId: session.id,
      sessionTitle: session.title,
      quizId: session.quizId,
      duration: session.duration,
      startedAt: session.startedAt,
      endsAt: session.endsAt,
    };
    setJoinedExam(exam);
    storeJoinedExam(exam);
    setSubmission(null);
    setStage(session.status === 'active' ? 'active' : session.status === 'paused' ? 'paused' : 'waiting');
    setJoinModalOpen(false);
    onJoined?.(session.id);
  };
  const shouldRenderScreen = Boolean(joinedExam && (
    stage !== 'active' || !joinedQuiz || preparation.isPreparing || status?.session?.endsAt
  ));

  const closeJoinModal = () => {
    setJoinModalOpen(false);
    if (initialSessionId && !joinedExam) onUnrestoredClose?.();
  };

  return {
    isJoinModalOpen, joinedExam, joinedQuiz, questions, stage, status, submission,
    isPreparing: preparation.isPreparing, loadError: preparation.loadError, shouldRenderScreen,
    openJoinModal: () => setJoinModalOpen(true), closeJoinModal,
    join, markActive: () => setStage('active'),
    complete: (response: LiveExamSubmissionResponse) => {
      setSubmission(response.participant);
      setStage('submitted');
    },
  };
};

export type StudentLiveExamController = ReturnType<typeof useStudentLiveExam>;
