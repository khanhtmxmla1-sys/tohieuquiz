import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { useAssignmentStore } from '@/src/stores/useAssignmentStore';
import { useQuizStore } from '@/stores/quizStore';
import type { AssignedQuiz } from '@/src/components/HomePage/student-dashboard';
import { getAssignmentVisualState } from '@/src/components/HomePage/student-dashboard';
import { fetchResultAnswerReview } from '@/src/services/results/resultAnswersService';
import type { StudentResult } from '@/src/types';
import { getStudentRoute } from '../../../app/navigationRoutes';
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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignments = useAssignmentStore((state) => state.assignments);
  const fetchStudentAssignments = useAssignmentStore((state) => state.fetchStudentAssignments);
  const quizzes = useQuizStore((state) => state.quizzes);
  const selectQuiz = useQuizStore((state) => state.selectQuiz);
  const setView = useQuizStore((state) => state.setView);
  const loadResults = useQuizStore((state) => state.loadResults);
  const loadQuizQuestions = useQuizStore((state) => state.loadQuizQuestions);
  const requestedPage = location.pathname === getStudentRoute('assignments')
    ? Number.parseInt(searchParams.get('page') || '1', 10)
    : 1;
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
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
  const effectivePage = Math.min(page, totalPages);
  const setPage = useCallback((nextPage: number, replace = false) => {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set('page', String(nextPage));
    const search = params.toString();
    navigate(`${getStudentRoute('assignments')}${search ? `?${search}` : ''}`, { replace });
  }, [navigate]);
  const pagedQuizzes = useMemo(() => {
    const start = (effectivePage - 1) * ASSIGNMENTS_PER_PAGE;
    return allQuizzes.slice(start, start + ASSIGNMENTS_PER_PAGE);
  }, [allQuizzes, effectivePage]);
  const hasReadyAssignment = useMemo(
    () => allQuizzes.some((quiz) => getAssignmentVisualState(quiz) === 'ready'),
    [allQuizzes],
  );

  useEffect(() => {
    if (allQuizzes.length > 0 && page > totalPages) setPage(totalPages, true);
  }, [allQuizzes.length, page, setPage, totalPages]);

  const startQuiz = useCallback((quiz: AssignedQuiz) => {
    selectQuiz(quiz);
    setView('student');
  }, [selectQuiz, setView]);

  const openAssignment = useCallback((assignmentId: string) => {
    const index = allQuizzes.findIndex((quiz) => (
      String(quiz._assignmentData?.id || '') === String(assignmentId)
    ));
    if (index < 0) {
      navigate(getStudentRoute('assignments'));
      return;
    }
    startQuiz(allQuizzes[index]);
  }, [allQuizzes, navigate, startQuiz]);

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

      const reviewPayload = await fetchResultAnswerReview(result.id);
      const storedAnswers = reviewPayload.answers;
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
        result: { ...result, answers: storedAnswers, reviewDetails: reviewPayload.reviewDetails },
        answers: buildSelectedAssignmentAnswers(storedAnswers),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể mở lại bài làm.';
      toast.error(message);
    } finally {
      setReviewingAssignmentId(null);
    }
  }, [loadQuizQuestions, loadResults]);

  return {
    pagedQuizzes,
    page: effectivePage,
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
  };
};

export type StudentAssignmentsController = ReturnType<typeof useStudentAssignments>;
