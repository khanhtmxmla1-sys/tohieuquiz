import { useEffect, useMemo, useState } from 'react';
import { useQuizStore } from '@/stores/quizStore';
import { useLiveExamStatus } from '@/src/hooks/useLiveExamStatus';
import type { Question } from '@/src/types';
import type { LiveExamSubmissionResponse } from '@/src/types/liveExam.types';
import type { JoinedLiveExam, JoinedSessionPayload, LiveExamStage } from './liveExam.types';
import { useLiveExamQuizPreparation } from './useLiveExamQuizPreparation';

export const useStudentLiveExam = () => {
  const quizzes = useQuizStore((state) => state.quizzes);
  const [isJoinModalOpen, setJoinModalOpen] = useState(false);
  const [joinedExam, setJoinedExam] = useState<JoinedLiveExam | null>(null);
  const [stage, setStage] = useState<LiveExamStage>('waiting');
  const [submission, setSubmission] = useState<LiveExamSubmissionResponse['participant'] | null>(null);
  const { status } = useLiveExamStatus({
    sessionId: joinedExam?.sessionId || '', enabled: Boolean(joinedExam),
  });
  const joinedQuiz = useMemo(() => joinedExam
    ? quizzes.find((quiz) => quiz.id === joinedExam.quizId) || null : null,
  [joinedExam, quizzes]);
  const questions = useMemo<Question[]>(
    () => Array.isArray(joinedQuiz?.questions) ? joinedQuiz.questions : [], [joinedQuiz],
  );
  const preparation = useLiveExamQuizPreparation(joinedExam, joinedQuiz, stage);

  useEffect(() => {
    const sessionStatus = status?.session?.status;
    if (!sessionStatus) return;
    if (sessionStatus === 'active' && stage !== 'submitted') setStage('active');
    else if (sessionStatus === 'closed') setStage('results');
    else if (stage !== 'submitted') setStage('waiting');
  }, [stage, status?.session?.status]);

  const join = (session: JoinedSessionPayload) => {
    setJoinedExam({
      sessionId: session.id, sessionTitle: session.title, quizId: session.quizId,
      duration: session.duration, startedAt: session.startedAt, endsAt: session.endsAt,
    });
    setSubmission(null);
    setStage(session.status === 'active' ? 'active' : 'waiting');
    setJoinModalOpen(false);
  };
  const shouldRenderScreen = Boolean(joinedExam && (
    stage !== 'active' || !joinedQuiz || preparation.isPreparing || status?.session?.endsAt
  ));

  return {
    isJoinModalOpen, joinedExam, joinedQuiz, questions, stage, status, submission,
    isPreparing: preparation.isPreparing, loadError: preparation.loadError, shouldRenderScreen,
    openJoinModal: () => setJoinModalOpen(true), closeJoinModal: () => setJoinModalOpen(false),
    join, markActive: () => setStage('active'),
    complete: (response: LiveExamSubmissionResponse) => {
      setSubmission(response.participant); setStage('submitted');
    },
  };
};

export type StudentLiveExamController = ReturnType<typeof useStudentLiveExam>;
