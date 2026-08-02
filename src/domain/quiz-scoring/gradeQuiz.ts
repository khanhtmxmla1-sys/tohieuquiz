import { asRecord } from './questionIdentity';
import { gradeQuestion } from './gradeQuestion';
import { normalizeQuestionForGrading } from './normalizeQuestion';
import {
  QUIZ_ANSWER_SCHEMA_VERSION,
  QUIZ_SCORING_ENGINE_VERSION,
  type GradingIssue,
  type QuizGradingResult,
  type QuizLike,
} from './types';

export const gradeQuiz = (quizInput: QuizLike | unknown, answersInput: Record<string, unknown> | unknown): QuizGradingResult => {
  const quiz = asRecord(quizInput);
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const answers = asRecord(answersInput);
  const details = questions.map((question) => {
    const normalized = normalizeQuestionForGrading(question);
    const id = normalized.ok === true ? normalized.question.id : normalized.questionId;
    return gradeQuestion(question, answers[id]);
  });
  const issues: GradingIssue[] = [];
  questions.forEach((question) => {
    const normalized = normalizeQuestionForGrading(question);
    if (normalized.ok === false) issues.push(...normalized.issues);
  });
  details.forEach((detail) => {
    if (detail.status === 'invalid' && !issues.some((item) => item.questionId === detail.questionId && item.code === detail.issueCode)) {
      issues.push({ questionId: detail.questionId, code: detail.issueCode ?? 'INVALID_ANSWER', message: 'Student answer could not be normalized.' });
    }
  });
  const correctCount = details.filter((detail) => detail.isCorrect).length;
  const totalQuestions = questions.length;
  const score = totalQuestions === 0 ? 0 : Number(((correctCount / totalQuestions) * 10).toFixed(1));
  return {
    engineVersion: QUIZ_SCORING_ENGINE_VERSION,
    answerSchemaVersion: QUIZ_ANSWER_SCHEMA_VERSION,
    score,
    correctCount,
    totalQuestions,
    details,
    issues,
  };
};
