import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAssignmentStore } from '@/src/stores/useAssignmentStore';
import { useQuizStore } from '@/stores/quizStore';
import type { AssignedQuiz } from '@/src/components/HomePage/student-dashboard';
import { getAssignmentVisualState } from '@/src/components/HomePage/student-dashboard';
import { fetchResultAnswers } from '@/src/services/results/resultAnswersService';
import type { StudentResult } from '@/src/types';
import {
  ASSIGNMENTS_PER_PAGE,
  buildAssignmentReviewQuiz,
  buildAssignedQuizzes,
  buildSelectedAssignmentAnswers,
} from '../model';

interface AssignmentReviewState {
  quiz: AssignedQuiz;
  result: StudentResult;
  answers: Record<string, unknown>;
}

export const useStudentAssignments = (studentId?: string) => {
  const assignments = useAssignmentStore((state) => state.assignments);
  const fetchStudentAssignments = useAssignmentStore((state) => state.fetchStudentAssignments);
  const quizzes = useQuizStore((state) => state.quizzes);
  const selectQuiz = useQuizStore((state) => state.selectQuiz);
  const setView = useQuizStore((state) => state.setView);
  const loadResults = useQuizStore((state) => state.loadResults);
  const loadQuizQuestions = useQuizStore((state) => state.loadQuizQuestions);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewingAssignmentId, setReviewingAssignmentId] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<AssignmentReviewState | null>(null);

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (studentId) {
        await fetchStudentAssignments(studentId);
        const storeError = useAssignmentStore.getState().error;
        if (storeError) throw new Error(storeError);
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
      setErrorMessage('Chưa tải được bài giáo viên giao. Em hãy thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchStudentAssignments, studentId]);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  const allQuizzes = useMemo(
    () => buildAssignedQuizzes(assignments, quizzes),
    [assignments, quizzes],
  );
  const totalPages = Math.max(1, Math.ceil(allQuizzes.length / ASSIGNMENTS_PER_PAGE));
  const pagedQuizzes = useMemo(() => {
    const start = (page - 1) * ASSIGNMENTS_PER_PAGE;
    return allQuizzes.slice(start, start + ASSIGNMENTS_PER_PAGE);
  }, [allQuizzes, page]);
  const hasReadyAssignment = useMemo(
    () => allQuizzes.some((quiz) => getAssignmentVisualState(quiz) === 'ready'),
    [allQuizzes],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startQuiz = useCallback((quiz: AssignedQuiz) => {
    selectQuiz(quiz);
    setView('student');
  }, [selectQuiz, setView]);

  const openAssignment = useCallback((assignmentId: string) => {
    const index = allQuizzes.findIndex((quiz) => (
      String(quiz._assignmentData?.id || '') === String(assignmentId)
    ));
    if (index < 0) {
      document.getElementById('assigned-work')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setPage(Math.floor(index / ASSIGNMENTS_PER_PAGE) + 1);
    startQuiz(allQuizzes[index]);
  }, [allQuizzes, startQuiz]);

  const reviewQuiz = useCallback(async (quiz: AssignedQuiz) => {
    const assignmentId = String(quiz._assignmentData?.id || quiz.id);
    setReviewingAssignmentId(assignmentId);

    try {
      await loadResults();
      const result = useQuizStore.getState().results
        .filter((item) => String(item.quizId) === String(quiz.id))
        .sort((first, second) => (
          Date.parse(second.submittedAt || '') - Date.parse(first.submittedAt || '')
        ))[0];

      if (!result) {
        throw new Error('Không tìm thấy bài làm đã nộp.');
      }

      const storedAnswers = await fetchResultAnswers(result.id);
      const answeredQuestionIds = Object.keys(storedAnswers)
        .filter((questionId) => !questionId.startsWith('_'));
      if (answeredQuestionIds.length === 0) {
        throw new Error('Bài làm này chưa có dữ liệu câu trả lời để xem lại.');
      }

      let reviewQuizData = buildAssignmentReviewQuiz(quiz, storedAnswers);
      if (reviewQuizData.questions.length < result.totalQuestions) {
        const loadedQuiz = await loadQuizQuestions(quiz.id);
        if (loadedQuiz) {
          reviewQuizData = buildAssignmentReviewQuiz({
            ...loadedQuiz,
            _assignmentData: quiz._assignmentData,
          }, storedAnswers);
        }
      }

      if (reviewQuizData.questions.length === 0) {
        throw new Error('Không tải được nội dung câu hỏi của bài làm.');
      }

      setReviewState({
        quiz: reviewQuizData,
        result: { ...result, answers: storedAnswers },
        answers: buildSelectedAssignmentAnswers(storedAnswers),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể mở lại bài làm.';
      toast.error(message);
    } finally {
      setReviewingAssignmentId(null);
    }
  }, [loadQuizQuestions, loadResults]);

  const scrollToPrimaryTarget = useCallback(() => {
    const targetId = hasReadyAssignment ? 'assigned-work' : 'practice-library';
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hasReadyAssignment]);

  return {
    pagedQuizzes,
    page,
    totalPages,
    isLoading,
    errorMessage,
    hasReadyAssignment,
    reviewingAssignmentId,
    reviewState,
    setPage,
    retry: fetchAssignments,
    startQuiz,
    openAssignment,
    reviewQuiz,
    closeReview: () => setReviewState(null),
    scrollToPrimaryTarget,
  };
};

export type StudentAssignmentsController = ReturnType<typeof useStudentAssignments>;
