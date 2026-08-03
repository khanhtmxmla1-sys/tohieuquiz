import { isRawAnswerSkipped } from './answerCompleteness';
import { unwrapStoredResultAnswer } from './legacyAnswerAdapters';
import { normalizeAnswerForNormalizedQuestion } from './normalizeAnswer';
import { normalizeQuestionForGrading } from './normalizeQuestion';
import { asArray, asRecord, optionText } from './questionIdentity';
import type { GradingStatus, NormalizedGradableQuestion, QuestionGradingResult, QuizAnswer } from './types';

export interface AnswerReviewLine {
  label?: string;
  value: string;
}

export interface AnswerReviewValue {
  kind: 'empty' | 'text' | 'list' | 'mapping' | 'unsupported';
  lines: AnswerReviewLine[];
}

export interface QuestionAnswerReview {
  questionId: string;
  type: string;
  status: GradingStatus;
  isCorrect: boolean;
  studentAnswer: AnswerReviewValue;
  correctAnswer: AnswerReviewValue;
}

const emptyReview = (): AnswerReviewValue => ({
  kind: 'empty',
  lines: [{ value: 'Chưa trả lời' }],
});

const unsupportedReview = (): AnswerReviewValue => ({
  kind: 'unsupported',
  lines: [{ value: 'Không thể hiển thị câu trả lời' }],
});

const voidedReview = (): AnswerReviewValue => ({
  kind: 'unsupported',
  lines: [{ value: 'Câu hỏi không được tính điểm do lỗi dữ liệu' }],
});

const textReview = (value: unknown): AnswerReviewValue => {
  const text = String(value ?? '').trim();
  return text ? { kind: 'text', lines: [{ value: text }] } : emptyReview();
};

const listReview = (values: unknown[]): AnswerReviewValue => {
  const lines = values.map((value) => String(value ?? '').trim()).filter(Boolean).map((value) => ({ value }));
  return lines.length > 0 ? { kind: 'list', lines } : emptyReview();
};

const mappingReview = (lines: AnswerReviewLine[]): AnswerReviewValue => {
  const visible = lines.filter((line) => line.value.trim());
  return visible.length > 0 ? { kind: 'mapping', lines: visible } : emptyReview();
};

const trueFalseText = (value: boolean): string => value ? 'Đúng' : 'Sai';

const itemTextMap = (value: unknown): Map<string, string> => new Map(
  asArray(value).map((item, index) => {
    const record = asRecord(item);
    const id = String(record.id ?? `item-${index}`);
    return [id, optionText(item) || String(record.left ?? record.statement ?? `Mục ${index + 1}`)];
  }),
);

const categoryTextMap = (value: unknown): Map<string, string> => new Map(
  asArray(value).map((category, index) => {
    const record = asRecord(category);
    const id = String(record.id ?? `category-${index}`);
    return [id, optionText(category) || String(record.name ?? `Nhóm ${index + 1}`)];
  }),
);

const renderAnswer = (
  question: NormalizedGradableQuestion,
  rawQuestion: unknown,
  answer: QuizAnswer,
): AnswerReviewValue => {
  switch (question.type) {
    case 'MCQ':
    case 'IMAGE_QUESTION': {
      if (answer.type !== question.type) return unsupportedReview();
      return textReview(question.options.find((option) => option.id === answer.optionId)?.text);
    }
    case 'MULTIPLE_SELECT': {
      if (answer.type !== 'MULTIPLE_SELECT') return unsupportedReview();
      return listReview(answer.optionIds.map((id) => question.options.find((option) => option.id === id)?.text));
    }
    case 'SHORT_ANSWER':
    case 'RIDDLE':
      return answer.type === question.type ? textReview(answer.value) : unsupportedReview();
    case 'TRUE_FALSE': {
      if (answer.type !== 'TRUE_FALSE') return unsupportedReview();
      const labels = itemTextMap(asRecord(rawQuestion).items);
      return mappingReview(Object.keys(question.correctValues).map((id, index) => ({
        label: labels.get(id) || `Mệnh đề ${index + 1}`,
        value: typeof answer.values[id] === 'boolean' ? trueFalseText(answer.values[id]) : 'Chưa trả lời',
      })));
    }
    case 'MATCHING': {
      if (answer.type !== 'MATCHING') return unsupportedReview();
      const rightText = new Map(question.pairs.map((pair) => [pair.rightId, pair.rightText]));
      return mappingReview(question.pairs.map((pair) => ({
        label: pair.leftText,
        value: rightText.get(answer.pairs[pair.leftId]) || 'Chưa trả lời',
      })));
    }
    case 'DROPDOWN':
    case 'DRAG_DROP': {
      if (answer.type !== question.type) return unsupportedReview();
      return mappingReview(question.blanks.map((blank, index) => ({
        label: `Chỗ trống ${index + 1}`,
        value: String(answer.values[blank.id] ?? '').trim() || 'Chưa trả lời',
      })));
    }
    case 'ORDERING': {
      if (answer.type !== 'ORDERING') return unsupportedReview();
      return listReview([...question.items]
        .sort((left, right) => (answer.ranks[left.id] ?? Number.MAX_SAFE_INTEGER) - (answer.ranks[right.id] ?? Number.MAX_SAFE_INTEGER))
        .map((item) => item.text));
    }
    case 'CATEGORIZATION': {
      if (answer.type !== 'CATEGORIZATION') return unsupportedReview();
      const raw = asRecord(rawQuestion);
      const items = itemTextMap(raw.items);
      const categories = categoryTextMap(raw.categories ?? raw.distractors);
      return mappingReview(Object.keys(question.correctCategories).map((itemId, index) => ({
        label: items.get(itemId) || `Mục ${index + 1}`,
        value: categories.get(answer.categoriesByItemId[itemId]) || answer.categoriesByItemId[itemId] || 'Chưa trả lời',
      })));
    }
    case 'UNDERLINE': {
      if (answer.type !== 'UNDERLINE') return unsupportedReview();
      const words = asArray(asRecord(rawQuestion).words ?? asRecord(rawQuestion).items).map(optionText);
      return listReview(answer.indexes.map((index) => words[index]));
    }
    case 'WORD_SCRAMBLE':
      return answer.type === 'WORD_SCRAMBLE'
        ? textReview(answer.letterIndexes.map((index) => question.letters[index] ?? '').join(''))
        : unsupportedReview();
    case 'ERROR_CORRECTION':
      return answer.type === 'ERROR_CORRECTION'
        ? mappingReview([
            { label: 'Từ sai', value: answer.wrongWord },
            { label: 'Từ sửa', value: answer.correctWord },
          ])
        : unsupportedReview();
  }
};

const renderCorrectAnswer = (
  question: NormalizedGradableQuestion,
  rawQuestion: unknown,
): AnswerReviewValue => {
  switch (question.type) {
    case 'MCQ':
    case 'IMAGE_QUESTION':
      return textReview(question.options.find((option) => option.id === question.correctOptionId)?.text);
    case 'MULTIPLE_SELECT':
      return listReview(question.correctOptionIds.map((id) => question.options.find((option) => option.id === id)?.text));
    case 'SHORT_ANSWER':
    case 'RIDDLE': {
      const raw = asRecord(rawQuestion);
      const source = raw.correctAnswers ?? raw.correctAnswer ?? raw.correct_answer;
      const originalValues = asArray(source);
      return listReview(originalValues.length > 0 ? originalValues : question.acceptedValues);
    }
    case 'TRUE_FALSE': {
      const labels = itemTextMap(asRecord(rawQuestion).items);
      return mappingReview(Object.entries(question.correctValues).map(([id, value], index) => ({
        label: labels.get(id) || `Mệnh đề ${index + 1}`,
        value: trueFalseText(value),
      })));
    }
    case 'MATCHING':
      return mappingReview(question.pairs.map((pair) => ({ label: pair.leftText, value: pair.rightText })));
    case 'DROPDOWN':
    case 'DRAG_DROP':
      return mappingReview(question.blanks.map((blank, index) => ({
        label: `Chỗ trống ${index + 1}`,
        value: question.correctValues[blank.id],
      })));
    case 'ORDERING':
      return listReview([...question.items]
        .sort((left, right) => question.correctRanks[left.id] - question.correctRanks[right.id])
        .map((item) => item.text));
    case 'CATEGORIZATION': {
      const raw = asRecord(rawQuestion);
      const items = itemTextMap(raw.items);
      const categories = categoryTextMap(raw.categories ?? raw.distractors);
      return mappingReview(Object.entries(question.correctCategories).map(([itemId, categoryId], index) => ({
        label: items.get(itemId) || `Mục ${index + 1}`,
        value: categories.get(categoryId) || categoryId,
      })));
    }
    case 'UNDERLINE': {
      const words = asArray(asRecord(rawQuestion).words ?? asRecord(rawQuestion).items).map(optionText);
      return listReview(question.correctIndexes.map((index) => words[index]));
    }
    case 'WORD_SCRAMBLE': {
      const raw = asRecord(rawQuestion);
      return textReview(raw.correctWord ?? raw.correctAnswer ?? raw.correct_answer ?? question.correctWord);
    }
    case 'ERROR_CORRECTION': {
      const raw = asRecord(rawQuestion);
      return mappingReview([
        { label: 'Từ sai', value: String(raw.wrongWord ?? raw.distractors ?? question.wrongWord) },
        { label: 'Từ sửa đúng', value: String(raw.correctWord ?? raw.correctAnswer ?? raw.correct_answer ?? question.correctWord) },
      ]);
    }
  }
};

export const buildQuestionAnswerReview = (
  questionInput: unknown,
  answerInput: unknown,
  detail?: Pick<QuestionGradingResult, 'questionId' | 'type' | 'status' | 'isCorrect'>,
): QuestionAnswerReview => {
  const normalized = normalizeQuestionForGrading(questionInput);
  const status = detail?.status ?? (isRawAnswerSkipped(answerInput) ? 'skipped' : 'invalid');
  if (status === 'voided') {
    const raw = asRecord(questionInput);
    return {
      questionId: detail?.questionId ?? (normalized.ok === true ? normalized.question.id : normalized.questionId) ?? String(raw.id ?? ''),
      type: detail?.type ?? (normalized.ok === true ? normalized.question.type : normalized.type) ?? String(raw.type ?? ''),
      status: 'voided',
      isCorrect: false,
      studentAnswer: voidedReview(),
      correctAnswer: voidedReview(),
    };
  }
  if (normalized.ok === false) {
    return {
      questionId: normalized.questionId,
      type: normalized.type,
      status,
      isCorrect: detail?.isCorrect === true,
      studentAnswer: isRawAnswerSkipped(answerInput) ? emptyReview() : unsupportedReview(),
      correctAnswer: unsupportedReview(),
    };
  }
  const base = {
    questionId: normalized.question.id,
    type: normalized.question.type,
    status,
    isCorrect: detail?.isCorrect === true,
  };

  const selected = unwrapStoredResultAnswer(answerInput);
  if (status === 'skipped' || isRawAnswerSkipped(selected)) {
    return {
      ...base,
      status: 'skipped',
      isCorrect: false,
      studentAnswer: emptyReview(),
      correctAnswer: renderCorrectAnswer(normalized.question, questionInput),
    };
  }

  const normalizedAnswer = normalizeAnswerForNormalizedQuestion(normalized.question, selected);
  return {
    ...base,
    studentAnswer: normalizedAnswer.ok
      ? renderAnswer(normalized.question, questionInput, normalizedAnswer.answer)
      : unsupportedReview(),
    correctAnswer: renderCorrectAnswer(normalized.question, questionInput),
  };
};

export const buildQuizAnswerReview = (
  questions: readonly unknown[],
  answers: unknown,
  details: readonly QuestionGradingResult[],
): QuestionAnswerReview[] => {
  const answerMap = asRecord(answers);
  const detailMap = new Map(details.map((detail) => [detail.questionId, detail]));
  return questions.map((question) => {
    const questionId = String(asRecord(question).id ?? '');
    return buildQuestionAnswerReview(question, answerMap[questionId], detailMap.get(questionId));
  });
};
