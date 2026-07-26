import type { Question, StudentResult } from '../../../types';

const getQuestionText = (question: Question): string => {
  if ('mainQuestion' in question) return question.mainQuestion;
  if ('question' in question) return question.question;
  return 'Unknown question';
};

export const buildQuestionAnalysisInput = (questions: Question[]) => questions.map(question => ({
  id: question.id,
  question: getQuestionText(question),
  type: question.type,
  correctAnswer: 'correctAnswer' in question ? question.correctAnswer : undefined,
  correctAnswers: 'correctAnswers' in question ? (question as any).correctAnswers : undefined,
  items: 'items' in question ? (question as any).items : undefined,
  blanks: 'blanks' in question ? (question as any).blanks : undefined,
  pairs: 'pairs' in question ? (question as any).pairs : undefined,
  options: 'options' in question ? (question as any).options : undefined,
}));

export const hydrateAnalysisResults = (
  results: StudentResult[],
  answersByResultId: Record<string, Record<string, any>>,
  selectedQuestionIds: Set<string>,
): StudentResult[] => results
  .map(result => ({
    ...result,
    answers: Object.prototype.hasOwnProperty.call(answersByResultId, String(result.id))
      ? answersByResultId[String(result.id)]
      : result.answers,
  }))
  .filter(result => Object.keys(result.answers || {}).some(questionId => selectedQuestionIds.has(questionId)));
