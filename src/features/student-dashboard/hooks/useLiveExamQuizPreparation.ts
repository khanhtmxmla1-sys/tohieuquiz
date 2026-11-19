import { useEffect, useRef, useState } from 'react';
import { useQuizStore } from '@/stores/quizStore';
import { getLiveExamQuestions } from '../../../services/liveExamService';
import type { Quiz } from '@/src/types';
import type { JoinedLiveExam, LiveExamStage } from './liveExam.types';

export const useLiveExamQuizPreparation = (
  joinedExam: JoinedLiveExam | null,
  joinedQuiz: Quiz | null,
  stage: LiveExamStage,
) => {
  const loadQuizzes = useQuizStore((state) => state.loadQuizzes);
  const updateQuiz = useQuizStore((state) => state.updateQuiz);
  const loadedSessionRef = useRef<string | null>(null);
  const loadedQuestionsRef = useRef<Quiz['questions'] | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasParticipantQuestions = Boolean(
    joinedExam
    && stage === 'active'
    && loadedSessionRef.current === joinedExam.sessionId
    && Array.isArray(joinedQuiz?.questions)
    && joinedQuiz.questions.length > 0
    && joinedQuiz.questions === loadedQuestionsRef.current
  );

  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      if (!joinedExam || stage !== 'active') {
        if (!cancelled) { setIsPreparing(false); setLoadError(null); }
        return;
      }
      const currentQuiz = useQuizStore.getState().quizzes
        .find((quiz) => quiz.id === joinedExam.quizId);
      if (
        loadedSessionRef.current === joinedExam.sessionId
        && Array.isArray(currentQuiz?.questions)
        && currentQuiz.questions.length > 0
        && currentQuiz.questions === loadedQuestionsRef.current
      ) {
        if (!cancelled) setIsPreparing(false);
        return;
      }
      setIsPreparing(true);
      setLoadError(null);
      try {
        // Refresh only quiz metadata if the page was restored after a reload.
        // Question content must come from the participant-scoped Live Exam DTO.
        if (!joinedQuiz && !useQuizStore.getState().quizzes.some((quiz) => quiz.id === joinedExam.quizId)) {
          await loadQuizzes({ force: true });
        }
        const loaded = useQuizStore.getState().quizzes
          .find((quiz) => quiz.id === joinedExam.quizId);
        if (!loaded) {
          setLoadError('Không tải được đề thi trực tiếp. Vui lòng chờ giây lát rồi thử lại.');
          return;
        }
        const response = await getLiveExamQuestions(joinedExam.sessionId);
        if (cancelled) return;
        if (response.sessionId !== joinedExam.sessionId || response.quizId !== joinedExam.quizId) {
          throw new Error('Live Exam question response scope mismatch');
        }
        // The Worker response is already a student-safe DTO. Do not pass it
        // through the catalogue normalizer: that function reconstructs
        // authoring-only fields such as MATCHING.pairs/correctAnswer.
        const questions = Array.isArray(response.questions) ? response.questions : [];
        if (questions.length === 0) throw new Error('Live Exam question response is empty');
        updateQuiz({ ...loaded, questions });
        loadedSessionRef.current = joinedExam.sessionId;
        loadedQuestionsRef.current = questions;
      } catch (error) {
        console.error('Failed to prepare live exam quiz:', error);
        if (!cancelled) setLoadError('Không tải được đề thi trực tiếp. Vui lòng thử lại.');
      } finally {
        if (!cancelled) setIsPreparing(false);
      }
    };
    void prepare();
    return () => { cancelled = true; };
  }, [joinedExam, joinedQuiz, loadQuizzes, stage, updateQuiz]);

  return {
    isPreparing: joinedExam && stage === 'active' ? !hasParticipantQuestions : isPreparing,
    loadError,
  };
};
