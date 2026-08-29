import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  StudentCompetitionAttempt,
  StudentCompetitionQuiz,
} from '../../studentCompetitionService';
import {
  clearQuizAttemptDraft,
  loadQuizAttemptDraft,
  saveQuizAttemptDraft,
} from '../../../quiz-player/quizAttemptDraft';
import { updateMatchingAnswer } from '../../../quiz-player/utils/structuredAnswerUpdates';
import { studentCompetitionPortalService } from '../studentCompetitionPortalService';

const createRequestId = (prefix: string) => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
};

interface CompetitionResumeMetadata {
  version: 1;
  startRequestId: string;
  attemptId?: string;
  quizId?: string;
  submission?: {
    attemptId: string;
    answersFingerprint: string;
    idempotencyKey: string;
  };
}

const resumeMetadataKey = (campaignId: string, roundId: string) => (
  `competition-round-resume:${campaignId}:${roundId}`
);

const loadResumeMetadata = (campaignId: string, roundId: string): CompetitionResumeMetadata | null => {
  try {
    const raw = sessionStorage.getItem(resumeMetadataKey(campaignId, roundId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CompetitionResumeMetadata>;
    if (parsed.version !== 1 || typeof parsed.startRequestId !== 'string' || !parsed.startRequestId) {
      return null;
    }
    return parsed as CompetitionResumeMetadata;
  } catch {
    return null;
  }
};

const saveResumeMetadata = (
  campaignId: string,
  roundId: string,
  metadata: CompetitionResumeMetadata,
) => {
  sessionStorage.setItem(resumeMetadataKey(campaignId, roundId), JSON.stringify(metadata));
};

const clearResumeMetadata = (campaignId: string, roundId: string) => {
  sessionStorage.removeItem(resumeMetadataKey(campaignId, roundId));
};

const normalizeForFingerprint = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForFingerprint);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForFingerprint(entry)]),
    );
  }
  return value;
};

const fingerprintAnswers = (answers: Record<string, unknown>) => (
  JSON.stringify(normalizeForFingerprint(answers))
);

const ensureSubmissionIntent = (
  metadata: CompetitionResumeMetadata,
  attemptId: string,
  answers: Record<string, unknown>,
): CompetitionResumeMetadata => {
  const answersFingerprint = fingerprintAnswers(answers);
  if (
    metadata.submission?.attemptId === attemptId
    && metadata.submission.answersFingerprint === answersFingerprint
  ) {
    return metadata;
  }
  return {
    ...metadata,
    submission: {
      attemptId,
      answersFingerprint,
      idempotencyKey: createRequestId('competition-submit'),
    },
  };
};

export const competitionAttemptDraftIdentity = (attemptId: string, quizId: string) => (
  `competition:${attemptId}:${quizId}`
);

type SubmissionResult = Awaited<ReturnType<typeof studentCompetitionPortalService.submitRoundAttempt>>['result'];

interface ActiveRoundAttempt {
  attempt: StudentCompetitionAttempt;
  quiz: StudentCompetitionQuiz;
  draftIdentity: string;
}

export const useCompetitionRoundAttempt = (campaignId: string, roundId: string) => {
  const [active, setActive] = useState<ActiveRoundAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [pending, setPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startInFlightRef = useRef(false);
  const submissionInFlightRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    saveQuizAttemptDraft({
      version: 1,
      quizId: active.draftIdentity,
      studentName: '',
      studentClass: '',
      answers,
      questionOrder: active.quiz.questions.map(question => question.id),
      currentPage,
      startedAt: active.attempt.startedAt,
      expiresAt: null,
    });
    const existingMetadata = loadResumeMetadata(campaignId, roundId);
    if (!existingMetadata) return;
    const nextMetadata = ensureSubmissionIntent(existingMetadata, active.attempt.id, answers);
    if (nextMetadata !== existingMetadata) {
      saveResumeMetadata(campaignId, roundId, nextMetadata);
    }
  }, [active, answers, campaignId, currentPage, roundId]);

  useEffect(() => {
    if (!submitting) return;
    const protectedUrl = window.location.href;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      const anchor = target instanceof Element ? target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== new URL(protectedUrl).origin) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      window.history.pushState(null, '', protectedUrl);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('popstate', handlePopState, true);
    };
  }, [submitting]);

  const start = useCallback(async () => {
    if (pending || active || startInFlightRef.current) return;
    startInFlightRef.current = true;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const preflight = await studentCompetitionPortalService.preflightRound(campaignId, roundId);
      if (
        preflight.status !== 'READY'
        || preflight.campaignId !== campaignId
        || preflight.roundId !== roundId
      ) {
        setError('Điều kiện đã thay đổi. Không thể bắt đầu bài thi.');
        return;
      }

      const existingMetadata = loadResumeMetadata(campaignId, roundId);
      const resumeMetadata: CompetitionResumeMetadata = existingMetadata ?? {
        version: 1,
        startRequestId: createRequestId('competition-start'),
      };
      saveResumeMetadata(campaignId, roundId, resumeMetadata);
      const session = await studentCompetitionPortalService.startRoundAttempt(
        campaignId,
        roundId,
        resumeMetadata.startRequestId,
      );
      const draftIdentity = competitionAttemptDraftIdentity(session.attempt.id, session.quiz.id);
      const draft = loadQuizAttemptDraft(draftIdentity);
      const questionCount = session.quiz.questions.length;
      const restoredAnswers = draft?.answers ?? {};
      const confirmedMetadata = ensureSubmissionIntent({
        ...resumeMetadata,
        attemptId: session.attempt.id,
        quizId: session.quiz.id,
      }, session.attempt.id, restoredAnswers);
      saveResumeMetadata(campaignId, roundId, confirmedMetadata);
      setActive({ ...session, draftIdentity });
      setAnswers(restoredAnswers);
      setCurrentPage(Math.min(Math.max(draft?.currentPage ?? 1, 1), Math.max(questionCount, 1)));
    } catch {
      setError('Không thể bắt đầu bài thi. Vui lòng kiểm tra điều kiện và thử lại.');
    } finally {
      startInFlightRef.current = false;
      setPending(false);
    }
  }, [active, campaignId, pending, roundId]);

  const answerQuestion = useCallback((questionId: string, value: unknown, subId?: string) => {
    setAnswers(current => subId
      ? {
        ...current,
        [questionId]: {
          ...((current[questionId] as Record<string, unknown> | undefined) ?? {}),
          [subId]: value,
        },
      }
      : { ...current, [questionId]: value });
  }, []);

  const matchQuestion = useCallback((questionId: string, item: string, type: 'left' | 'right') => {
    setAnswers(current => ({
      ...current,
      [questionId]: updateMatchingAnswer(current[questionId], item, type),
    }));
  }, []);

  const submit = useCallback(async () => {
    if (!active || pending || submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    setPending(true);
    setSubmitting(true);
    setError(null);
    const existingMetadata = loadResumeMetadata(campaignId, roundId) ?? {
      version: 1,
      startRequestId: createRequestId('competition-start'),
    };
    const resumeMetadata = ensureSubmissionIntent(existingMetadata, active.attempt.id, answers);
    saveResumeMetadata(campaignId, roundId, resumeMetadata);
    try {
      const response = await studentCompetitionPortalService.submitRoundAttempt({
        campaignId: active.attempt.campaignId,
        roundId: active.attempt.roundId,
        attemptId: active.attempt.id,
        answers,
        timeTaken: Math.max(0, Math.round((Date.now() - Date.parse(active.attempt.startedAt)) / 1000)),
        idempotencyKey: resumeMetadata.submission!.idempotencyKey,
      });
      clearQuizAttemptDraft(active.draftIdentity);
      clearResumeMetadata(campaignId, roundId);
      setResult(response.result);
      setActive(null);
    } catch {
      setError('Không thể nộp bài. Đáp án vẫn được giữ để em thử lại.');
    } finally {
      submissionInFlightRef.current = false;
      setSubmitting(false);
      setPending(false);
    }
  }, [active, answers, campaignId, pending, roundId]);

  return {
    active,
    answers,
    currentPage,
    error,
    pending,
    submitting,
    result,
    start,
    submit,
    answerQuestion,
    matchQuestion,
    setCurrentPage,
  };
};
