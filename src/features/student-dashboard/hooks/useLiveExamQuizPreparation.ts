import { useEffect, useState } from 'react';
import { useQuizStore } from '@/stores/quizStore';
import type { Quiz } from '@/src/types';
import type { JoinedLiveExam, LiveExamStage } from './liveExam.types';

export const useLiveExamQuizPreparation = (
  joinedExam: JoinedLiveExam | null,
  joinedQuiz: Quiz | null,
  stage: LiveExamStage,
) => {
  const loadQuizzes = useQuizStore((state) => state.loadQuizzes);
  const loadQuizQuestions = useQuizStore((state) => state.loadQuizQuestions);
  const [isPreparing, setIsPreparing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const prepare = async () => {
      if (!joinedExam || stage !== 'active' || joinedQuiz?.questions?.length) {
        if (!cancelled) { setIsPreparing(false); setLoadError(null); }
        return;
      }
      setIsPreparing(true);
      setLoadError(null);
      try {
        await loadQuizzes({ force: true });
        const loaded = useQuizStore.getState().quizzes
          .find((quiz) => quiz.id === joinedExam.quizId);
        if (loaded && (!Array.isArray(loaded.questions) || loaded.questions.length === 0)) {
          await loadQuizQuestions(joinedExam.quizId);
        }
        if (!cancelled && !useQuizStore.getState().quizzes
          .some((quiz) => quiz.id === joinedExam.quizId)) {
          setLoadError('Không tải được đề thi trực tiếp. Vui lòng chờ giây lát rồi thử lại.');
        }
      } catch (error) {
        console.error('Failed to prepare live exam quiz:', error);
        if (!cancelled) setLoadError('Không tải được đề thi trực tiếp. Vui lòng thử lại.');
      } finally {
        if (!cancelled) setIsPreparing(false);
      }
    };
    void prepare();
    return () => { cancelled = true; };
  }, [joinedExam, joinedQuiz, loadQuizQuestions, loadQuizzes, stage]);

  return { isPreparing, loadError };
};
