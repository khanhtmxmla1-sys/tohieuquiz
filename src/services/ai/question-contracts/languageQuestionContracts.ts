import { z } from 'zod';
import { QuestionType } from '../../../types';
import type { AiQuestionTypeContract, QuestionContractIssue } from './questionContract.types';
import {
  CommonGeneratedQuestionFields,
  NonEmptyText,
  OptionalImage,
  QuestionText,
  normalizeComparableText,
  sameCharacterMultiset,
  uniqueNormalizedValues,
} from './questionContract.shared';

const UnderlineSchema = z.object({
  type: z.literal(QuestionType.UNDERLINE),
  question: QuestionText,
  sentence: QuestionText,
  targetWords: z.array(NonEmptyText.max(500)).min(1).max(20),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
});

type UnderlineQuestionV3 = z.infer<typeof UnderlineSchema>;

const WordScrambleSchema = z.object({
  type: z.literal(QuestionType.WORD_SCRAMBLE),
  question: QuestionText,
  letters: z.array(NonEmptyText.max(20)).min(2).max(40),
  correctWord: NonEmptyText.max(200),
  hint: z.string().trim().min(1).max(1_000).optional(),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
});

type WordScrambleQuestionV3 = z.infer<typeof WordScrambleSchema>;

const RiddleSchema = z.object({
  type: z.literal(QuestionType.RIDDLE),
  question: QuestionText,
  riddleLines: z.array(NonEmptyText.max(1_000)).min(2).max(6),
  correctAnswer: NonEmptyText.max(500),
  answerType: z.enum(['original', 'transformed']),
  answerLabel: NonEmptyText.max(500),
  hint: z.string().trim().min(1).max(1_000).optional(),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
});

type RiddleQuestionV3 = z.infer<typeof RiddleSchema>;

const normalizeToken = (value: string): string => normalizeComparableText(value)
  .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '');

export const tokenizeUnderlineSentence = (sentence: string): string[] => sentence
  .normalize('NFC')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

export function normalizeUnderlineTargets(input: {
  sentence: string;
  targetWords: string[];
}): { words: string[]; correctWordIndexes: number[] } {
  const words = tokenizeUnderlineSentence(input.sentence);
  const correctWordIndexes = input.targetWords.map((target) => {
    const normalizedTarget = normalizeToken(target);
    const indexes = words
      .map((word, index) => normalizeToken(word) === normalizedTarget ? index : -1)
      .filter((index) => index >= 0);
    if (indexes.length === 0) {
      throw new Error(`Không tìm thấy từ mục tiêu: ${target}`);
    }
    if (indexes.length > 1) {
      throw new Error(`Từ mục tiêu xuất hiện nhiều lần: ${target}`);
    }
    return indexes[0];
  });
  if (new Set(correctWordIndexes).size !== correctWordIndexes.length) {
    throw new Error('Các từ mục tiêu không được trùng nhau.');
  }
  return { words, correctWordIndexes };
}

const issue = (code: string, path: Array<string | number>, message: string): QuestionContractIssue => ({
  code,
  path,
  message,
  repairable: true,
});

export const UNDERLINE_CONTRACT: AiQuestionTypeContract<UnderlineQuestionV3> = {
  type: QuestionType.UNDERLINE,
  label: 'Gạch chân từ đúng',
  shortLabel: 'Gạch chân',
  emoji: '✏️',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: UnderlineSchema,
  promptFragment: () => `[CONTRACT: UNDERLINE]\n- Trả targetWords, không tự tính chỉ số. Mỗi từ mục tiêu phải xuất hiện đúng một lần trong sentence.\n- JSON: {"slotId":"slot-1","type":"UNDERLINE","difficulty":2,"question":"...","sentence":"...","targetWords":["..."],"explanation":"..."}`,
  validateSemantics: (question) => {
    if (!uniqueNormalizedValues(question.targetWords)) {
      return [issue('UNDERLINE_TARGET_DUPLICATE', ['targetWords'], 'Các từ mục tiêu không được trùng nhau.')];
    }
    try {
      normalizeUnderlineTargets(question);
      return [];
    } catch (error) {
      return [issue('UNDERLINE_TARGET_INVALID', ['targetWords'], error instanceof Error ? error.message : 'Từ mục tiêu không hợp lệ.')];
    }
  },
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.UNDERLINE,
    difficulty: 2,
    question: 'Gạch chân các tính từ trong câu.',
    sentence: 'Bầu trời xanh và cao.',
    targetWords: ['xanh', 'cao'],
    explanation: '“Xanh” và “cao” là các từ miêu tả đặc điểm.',
  },
};

export const WORD_SCRAMBLE_CONTRACT: AiQuestionTypeContract<WordScrambleQuestionV3> = {
  type: QuestionType.WORD_SCRAMBLE,
  label: 'Ghép chữ thành từ',
  shortLabel: 'Ghép chữ',
  emoji: '🔤',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: WordScrambleSchema,
  promptFragment: () => `[CONTRACT: WORD_SCRAMBLE]\n- letters phải ghép chính xác thành correctWord và giữ nguyên dấu tiếng Việt.\n- JSON: {"slotId":"slot-1","type":"WORD_SCRAMBLE","difficulty":2,"question":"...","letters":["h","o","a"],"correctWord":"hoa","explanation":"..."}`,
  validateSemantics: (question) => sameCharacterMultiset(question.letters.join(''), question.correctWord)
    ? []
    : [issue('WORD_SCRAMBLE_LETTERS_MISMATCH', ['letters'], 'Các chữ cái không ghép chính xác thành đáp án.')],
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.WORD_SCRAMBLE,
    difficulty: 2,
    question: 'Sắp xếp các chữ cái để tạo thành tên một loài hoa.',
    letters: ['h', 'o', 'a'],
    correctWord: 'hoa',
    hint: 'Loài cây thường có màu sắc đẹp.',
    explanation: 'Sắp xếp h, o, a được từ “hoa”.',
  },
};

export const RIDDLE_CONTRACT: AiQuestionTypeContract<RiddleQuestionV3> = {
  type: QuestionType.RIDDLE,
  label: 'Giải câu đố',
  shortLabel: 'Câu đố',
  emoji: '❓',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: RiddleSchema,
  promptFragment: () => `[CONTRACT: RIDDLE]\n- Có 2 đến 6 dòng, một đáp án ngắn duy nhất, phù hợp học sinh tiểu học.\n- Không tự nhận nguồn dân gian khi không có dữ liệu nguồn.\n- JSON: {"slotId":"slot-1","type":"RIDDLE","difficulty":2,"question":"...","riddleLines":["...","..."],"correctAnswer":"...","answerType":"original","answerLabel":"...","explanation":"..."}`,
  validateSemantics: () => [],
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.RIDDLE,
    difficulty: 2,
    question: 'Em hãy giải câu đố sau.',
    riddleLines: ['Thân em nhiều đốt', 'Ruột trắng áo xanh'],
    correctAnswer: 'cây mía',
    answerType: 'original',
    answerLabel: 'Đáp án',
    explanation: 'Cây mía có thân chia nhiều đốt, vỏ xanh và ruột trắng.',
  },
};
