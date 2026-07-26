import { z } from 'zod';
import { QuestionType } from '../../../types';
import type { AiQuestionTypeContract, QuestionContractIssue } from './questionContract.types';
import {
  CommonGeneratedQuestionFields,
  NonEmptyText,
  OptionalImage,
  QuestionText,
  answerLetterIndex,
  normalizeComparableText,
  uniqueNormalizedValues,
} from './questionContract.shared';

const AnswerLetter = z.enum(['A', 'B', 'C', 'D']);
const ChoiceOption = NonEmptyText.max(1_000).refine(
  (value) => !/^[A-D][.)]\s*/i.test(value),
  'Phương án không được chứa tiền tố A, B, C hoặc D.',
);

const withUniqueOptions = <T extends { options: string[] }>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  if (!uniqueNormalizedValues(value.options)) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Các phương án phải khác nhau.' });
  }
};

const McqSchema = z.object({
  type: z.literal(QuestionType.MCQ),
  question: QuestionText,
  options: z.array(ChoiceOption).length(4),
  correctAnswer: AnswerLetter,
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
}).superRefine((question, ctx) => {
  withUniqueOptions(question, ctx);
  if (answerLetterIndex(question.correctAnswer) >= question.options.length) {
    ctx.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'Đáp án không tồn tại.' });
  }
});

type McqQuestionV3 = z.infer<typeof McqSchema>;

const TrueFalseSchema = z.object({
  type: z.literal(QuestionType.TRUE_FALSE),
  mainQuestion: QuestionText,
  items: z.array(z.object({
    id: z.string().trim().min(1).max(160).optional(),
    statement: QuestionText,
    isCorrect: z.boolean(),
  })).min(2).max(4),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
}).superRefine((question, ctx) => {
  const statements = question.items.map((item) => normalizeComparableText(item.statement));
  if (new Set(statements).size !== statements.length) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Các mệnh đề phải khác nhau.' });
  }
});

type TrueFalseQuestionV3 = z.infer<typeof TrueFalseSchema>;

const MultipleSelectSchema = z.object({
  type: z.literal(QuestionType.MULTIPLE_SELECT),
  question: QuestionText,
  options: z.array(ChoiceOption).length(4),
  correctAnswers: z.array(AnswerLetter).min(2).max(3),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
}).superRefine((question, ctx) => {
  withUniqueOptions(question, ctx);
  if (new Set(question.correctAnswers).size !== question.correctAnswers.length) {
    ctx.addIssue({ code: 'custom', path: ['correctAnswers'], message: 'Các đáp án đúng không được trùng nhau.' });
  }
  if (question.correctAnswers.some((answer) => answerLetterIndex(answer) >= question.options.length)) {
    ctx.addIssue({ code: 'custom', path: ['correctAnswers'], message: 'Đáp án không tồn tại.' });
  }
});

type MultipleSelectQuestionV3 = z.infer<typeof MultipleSelectSchema>;

const noIssues = (): QuestionContractIssue[] => [];

export const MCQ_CONTRACT: AiQuestionTypeContract<McqQuestionV3> = {
  type: QuestionType.MCQ,
  label: 'Trắc nghiệm một đáp án',
  shortLabel: 'Trắc nghiệm',
  emoji: '📝',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: McqSchema,
  promptFragment: () => `[CONTRACT: MCQ]\n- Tạo đúng 4 phương án không có tiền tố A/B/C/D.\n- Chỉ một đáp án đúng.\n- JSON: {"slotId":"slot-1","type":"MCQ","difficulty":2,"question":"...","options":["...","...","...","..."],"correctAnswer":"A","explanation":"..."}`,
  validateSemantics: noIssues,
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.MCQ,
    difficulty: 2,
    question: 'Phân số nào bằng một phần hai?',
    options: ['2/4', '1/3', '3/4', '2/3'],
    correctAnswer: 'A',
    explanation: 'Hai phần tư rút gọn được một phần hai.',
  },
};

export const TRUE_FALSE_CONTRACT: AiQuestionTypeContract<TrueFalseQuestionV3> = {
  type: QuestionType.TRUE_FALSE,
  label: 'Đúng hoặc Sai',
  shortLabel: 'Đúng/Sai',
  emoji: '✅',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: TrueFalseSchema,
  promptFragment: () => `[CONTRACT: TRUE_FALSE]\n- Có 2 đến 4 mệnh đề độc lập, gồm ít nhất một Đúng và một Sai.\n- JSON: {"slotId":"slot-1","type":"TRUE_FALSE","difficulty":2,"mainQuestion":"...","items":[{"statement":"...","isCorrect":true},{"statement":"...","isCorrect":false}],"explanation":"..."}`,
  validateSemantics: (question) => {
    const values = new Set(question.items.map((item) => item.isCorrect));
    return values.size === 2 ? [] : [{
      code: 'TRUE_FALSE_BALANCE_REQUIRED',
      path: ['items'],
      message: 'Câu Đúng/Sai phải có ít nhất một mệnh đề Đúng và một mệnh đề Sai.',
      repairable: true,
    }];
  },
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.TRUE_FALSE,
    difficulty: 2,
    mainQuestion: 'Xác định tính đúng sai của các nhận định sau.',
    items: [
      { statement: 'Hai phần tư bằng một phần hai.', isCorrect: true },
      { statement: 'Một phần ba lớn hơn một phần hai.', isCorrect: false },
    ],
    explanation: 'Rút gọn và so sánh các phân số để xác định từng nhận định.',
  },
};

export const MULTIPLE_SELECT_CONTRACT: AiQuestionTypeContract<MultipleSelectQuestionV3> = {
  type: QuestionType.MULTIPLE_SELECT,
  label: 'Chọn nhiều đáp án',
  shortLabel: 'Chọn nhiều',
  emoji: '☑️',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: MultipleSelectSchema,
  promptFragment: () => `[CONTRACT: MULTIPLE_SELECT]\n- Câu dẫn yêu cầu chọn tất cả đáp án đúng.\n- Có đúng 4 phương án và 2 đến 3 đáp án đúng.\n- JSON: {"slotId":"slot-1","type":"MULTIPLE_SELECT","difficulty":2,"question":"Chọn tất cả...","options":["...","...","...","..."],"correctAnswers":["A","C"],"explanation":"..."}`,
  validateSemantics: noIssues,
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.MULTIPLE_SELECT,
    difficulty: 2,
    question: 'Chọn tất cả phân số bằng một phần hai.',
    options: ['2/4', '3/6', '2/3', '4/5'],
    correctAnswers: ['A', 'B'],
    explanation: 'Hai phần tư và ba phần sáu đều rút gọn thành một phần hai.',
  },
};
