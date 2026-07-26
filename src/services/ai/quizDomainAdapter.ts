import { QuestionType, type Question } from '../../types';
import type {
  GeneratedQuestionV3,
  GeneratedQuizV3,
} from './question-contracts/questionContract.types';
import { normalizeUnderlineTargets } from './question-contracts/languageQuestionContracts';

const mapQuestion = (question: GeneratedQuestionV3): Question => {
  const {
    slotId,
    difficulty,
    subject,
    skillCode,
    subskillCode,
    ...payload
  } = question;
  const record = { ...payload } as Record<string, unknown>;

  if (question.type === QuestionType.TRUE_FALSE && Array.isArray(record.items)) {
    record.items = record.items.map((item, index) => {
      const itemRecord = item as Record<string, unknown>;
      return {
        ...itemRecord,
        id: typeof itemRecord.id === 'string' && itemRecord.id.trim()
          ? itemRecord.id
          : `${slotId}-item-${index + 1}`,
      };
    });
  }

  if (question.type === QuestionType.UNDERLINE) {
    const sentence = String(record.sentence ?? '');
    const targetWords = Array.isArray(record.targetWords)
      ? record.targetWords.map(String)
      : [];
    const normalized = normalizeUnderlineTargets({ sentence, targetWords });
    delete record.targetWords;
    record.words = normalized.words;
    record.correctWordIndexes = normalized.correctWordIndexes;
  }

  delete record.promptVersion;
  delete record.blueprintVersion;

  return {
    ...record,
    id: typeof record.id === 'string' && record.id.trim() ? record.id : slotId,
    type: question.type,
    difficulty,
    subject,
    skillCode,
    subskillCode,
  } as Question;
};

export function mapGeneratedQuizV3ToDomain(quiz: GeneratedQuizV3): {
  title: string;
  questions: Question[];
  detectedCategory?: string;
  detectedLesson?: string;
  suggestedTags?: string[];
  timeLimit?: number;
} {
  return {
    title: quiz.title,
    detectedCategory: quiz.detectedCategory,
    detectedLesson: quiz.detectedLesson,
    suggestedTags: quiz.suggestedTags,
    timeLimit: quiz.timeLimit,
    questions: quiz.questions.map(mapQuestion),
  };
}
