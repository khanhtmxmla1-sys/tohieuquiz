import type { Assignment, Quiz } from '@/src/types';
import type { AssignedQuiz } from '@/src/components/HomePage/student-dashboard';
import type { ResultAnswers } from '@/src/services/results/resultAnswersService';

const parseDate = (value?: string, fallback = 0) => {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : fallback;
};

export const buildAssignedQuizzes = (
  assignments: Assignment[],
  quizzes: Quiz[],
): AssignedQuiz[] => assignments.map((assignment) => {
  const realQuiz = quizzes.find((quiz) => quiz.id === assignment.quizId);
  if (realQuiz) return { ...realQuiz, _assignmentData: assignment } as AssignedQuiz;
  return {
    id: assignment.quizId,
    title: assignment.quizTitle || 'Bài tập được giao',
    category: 'class', questions: [], duration: 0, timeLimit: 0,
    requireCode: false, allowReview: false, classLevel: '', subject: 'class',
    createdAt: assignment.createdAt, maxScore: 0, _assignmentData: assignment,
  } as AssignedQuiz;
}).sort((first, second) => {
  const firstAssignment = first._assignmentData;
  const secondAssignment = second._assignmentData;
  const firstAttempts = Number(firstAssignment?.attemptCount) || 0;
  const secondAttempts = Number(secondAssignment?.attemptCount) || 0;
  const firstMax = Math.max(1, Number(firstAssignment?.maxAttempts) || 1);
  const secondMax = Math.max(1, Number(secondAssignment?.maxAttempts) || 1);
  const firstCompleted = firstAttempts >= firstMax;
  const secondCompleted = secondAttempts >= secondMax;

  if (firstCompleted !== secondCompleted) return firstCompleted ? 1 : -1;
  if (!firstCompleted && !secondCompleted) {
    const firstDeadline = parseDate(firstAssignment?.deadline, Number.MAX_SAFE_INTEGER);
    const secondDeadline = parseDate(secondAssignment?.deadline, Number.MAX_SAFE_INTEGER);
    if (firstDeadline !== secondDeadline) return firstDeadline - secondDeadline;
  }
  const firstCreated = parseDate(firstAssignment?.createdAt);
  const secondCreated = parseDate(secondAssignment?.createdAt);
  if (firstCreated !== secondCreated) return secondCreated - firstCreated;
  return String(first.title || '').localeCompare(String(second.title || ''), 'vi');
});

const getQuestionSnapshot = (answer: unknown): Quiz['questions'][number] | null => {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null;
  const snapshot = (answer as { questionSnapshot?: unknown }).questionSnapshot;
  return snapshot && typeof snapshot === 'object'
    ? snapshot as Quiz['questions'][number]
    : null;
};

export const buildAssignmentReviewQuiz = (
  quiz: AssignedQuiz,
  answers: ResultAnswers,
): AssignedQuiz => {
  const currentQuestions = new Map(
    (quiz.questions || []).map((question) => [String(question.id), question]),
  );
  const answeredQuestionIds = Object.keys(answers).filter((key) => !key.startsWith('_'));
  const storedOrder = Array.isArray(answers._questionOrder)
    ? answers._questionOrder.map(String).filter(Boolean)
    : [];
  const orderedIds = Array.from(new Set([
    ...storedOrder,
    ...answeredQuestionIds,
  ]));
  const reviewedQuestions = orderedIds
    .map((questionId) => getQuestionSnapshot(answers[questionId]) ?? currentQuestions.get(questionId))
    .filter((question): question is Quiz['questions'][number] => Boolean(question));

  return {
    ...quiz,
    questions: reviewedQuestions.length > 0 ? reviewedQuestions : quiz.questions,
  };
};

export const buildSelectedAssignmentAnswers = (
  answers: ResultAnswers,
): Record<string, unknown> => Object.fromEntries(
  Object.entries(answers)
    .filter(([questionId]) => !questionId.startsWith('_'))
    .map(([questionId, answer]) => {
      if (
        answer
        && typeof answer === 'object'
        && !Array.isArray(answer)
        && Object.prototype.hasOwnProperty.call(answer, 'selectedAnswer')
      ) {
        return [questionId, (answer as { selectedAnswer?: unknown }).selectedAnswer];
      }
      return [questionId, answer];
    }),
);
