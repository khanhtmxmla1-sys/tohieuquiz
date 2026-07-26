import { z } from 'zod';
import { QuestionType } from '../../../types';
import type { AiQuestionTypeContract, QuestionContractIssue } from './questionContract.types';
import {
  CommonGeneratedQuestionFields,
  NonEmptyText,
  OptionalImage,
  QuestionText,
  normalizeComparableText,
  uniqueNormalizedValues,
} from './questionContract.shared';

const MatchingSchema = z.object({
  type: z.literal(QuestionType.MATCHING),
  question: QuestionText,
  pairs: z.array(z.object({
    left: NonEmptyText.max(1_000),
    right: NonEmptyText.max(1_000),
    image: OptionalImage,
  })).min(3).max(5),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
}).superRefine((question, ctx) => {
  const left = question.pairs.map((pair) => pair.left);
  const right = question.pairs.map((pair) => pair.right);
  if (!uniqueNormalizedValues(left) || !uniqueNormalizedValues(right)) {
    ctx.addIssue({ code: 'custom', path: ['pairs'], message: 'Mỗi vế nối phải là duy nhất.' });
  }
});

type MatchingQuestionV3 = z.infer<typeof MatchingSchema>;

const OrderingSchema = z.object({
  type: z.literal(QuestionType.ORDERING),
  question: QuestionText,
  items: z.array(NonEmptyText.max(2_000)).min(3).max(8),
  correctOrder: z.array(z.number().int().min(0)).min(3).max(8),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
}).superRefine((question, ctx) => {
  if (!uniqueNormalizedValues(question.items)) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Các mục sắp xếp phải khác nhau.' });
  }
  const expected = question.items.map((_, index) => index).sort((a, b) => a - b);
  const actual = [...question.correctOrder].sort((a, b) => a - b);
  if (question.correctOrder.length !== question.items.length
    || actual.some((value, index) => value !== expected[index])) {
    ctx.addIssue({ code: 'custom', path: ['correctOrder'], message: 'correctOrder phải là hoán vị đầy đủ từ 0 đến n-1.' });
  }
});

type OrderingQuestionV3 = z.infer<typeof OrderingSchema>;

const CategorizationSchema = z.object({
  type: z.literal(QuestionType.CATEGORIZATION),
  question: QuestionText,
  instruction: z.string().trim().min(1).max(2_000).optional(),
  categories: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    name: NonEmptyText.max(1_000),
  })).min(2).max(4),
  items: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    content: NonEmptyText.max(2_000),
    categoryId: z.string().trim().min(1).max(160),
  })).min(4).max(10),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
}).superRefine((question, ctx) => {
  const categoryIds = question.categories.map((category) => category.id);
  const itemIds = question.items.map((item) => item.id);
  if (new Set(categoryIds).size !== categoryIds.length) {
    ctx.addIssue({ code: 'custom', path: ['categories'], message: 'ID nhóm phải khác nhau.' });
  }
  if (new Set(itemIds).size !== itemIds.length) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'ID mục phải khác nhau.' });
  }
  const categorySet = new Set(categoryIds);
  question.items.forEach((item, index) => {
    if (!categorySet.has(item.categoryId)) {
      ctx.addIssue({ code: 'custom', path: ['items', index, 'categoryId'], message: 'categoryId phải tham chiếu nhóm hiện có.' });
    }
  });
});

type CategorizationQuestionV3 = z.infer<typeof CategorizationSchema>;

const issue = (code: string, path: Array<string | number>, message: string): QuestionContractIssue => ({
  code,
  path,
  message,
  repairable: true,
});

export const MATCHING_CONTRACT: AiQuestionTypeContract<MatchingQuestionV3> = {
  type: QuestionType.MATCHING,
  label: 'Nối hai cột',
  shortLabel: 'Nối cột',
  emoji: '🔗',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: MatchingSchema,
  promptFragment: () => `[CONTRACT: MATCHING]\n- Tạo 3 đến 5 cặp một-một; mỗi vế là duy nhất.\n- JSON: {"slotId":"slot-1","type":"MATCHING","difficulty":2,"question":"...","pairs":[{"left":"...","right":"..."},{"left":"...","right":"..."},{"left":"...","right":"..."}],"explanation":"..."}`,
  validateSemantics: () => [],
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.MATCHING,
    difficulty: 2,
    question: 'Nối phép tính với kết quả.',
    pairs: [
      { left: '1 + 1', right: '2' },
      { left: '2 + 2', right: '4' },
      { left: '3 + 3', right: '6' },
    ],
    explanation: 'Thực hiện từng phép cộng rồi nối với kết quả tương ứng.',
  },
};

export const ORDERING_CONTRACT: AiQuestionTypeContract<OrderingQuestionV3> = {
  type: QuestionType.ORDERING,
  label: 'Sắp xếp thứ tự',
  shortLabel: 'Sắp xếp',
  emoji: '🔢',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: OrderingSchema,
  promptFragment: () => `[CONTRACT: ORDERING]\n- Có 3 đến 8 mục đã xáo trộn; correctOrder là hoán vị chỉ số 0..n-1.\n- JSON: {"slotId":"slot-1","type":"ORDERING","difficulty":2,"question":"...","items":["...","...","..."],"correctOrder":[1,0,2],"explanation":"..."}`,
  validateSemantics: () => [],
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.ORDERING,
    difficulty: 2,
    question: 'Sắp xếp các bước trồng cây theo thứ tự hợp lý.',
    items: ['Tưới nước', 'Đặt cây vào hố', 'Đào hố'],
    correctOrder: [2, 1, 0],
    explanation: 'Cần đào hố, đặt cây rồi mới tưới nước.',
  },
};

export const CATEGORIZATION_CONTRACT: AiQuestionTypeContract<CategorizationQuestionV3> = {
  type: QuestionType.CATEGORIZATION,
  label: 'Phân loại vào nhóm',
  shortLabel: 'Phân loại',
  emoji: '📦',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: CategorizationSchema,
  promptFragment: () => `[CONTRACT: CATEGORIZATION]\n- Có 2 đến 4 nhóm, 4 đến 10 mục; mọi nhóm phải có ít nhất một mục.\n- JSON: {"slotId":"slot-1","type":"CATEGORIZATION","difficulty":2,"question":"...","categories":[{"id":"a","name":"..."},{"id":"b","name":"..."}],"items":[{"id":"i1","content":"...","categoryId":"a"}],"explanation":"..."}`,
  validateSemantics: (question) => {
    const used = new Set(question.items.map((item) => item.categoryId));
    const empty = question.categories.filter((category) => !used.has(category.id));
    return empty.length === 0 ? [] : [issue(
      'CATEGORIZATION_EMPTY_GROUP',
      ['categories'],
      `Các nhóm sau chưa có mục: ${empty.map((category) => normalizeComparableText(category.name)).join(', ')}.`,
    )];
  },
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.CATEGORIZATION,
    difficulty: 2,
    question: 'Phân loại các số vào nhóm chẵn hoặc lẻ.',
    categories: [{ id: 'chan', name: 'Số chẵn' }, { id: 'le', name: 'Số lẻ' }],
    items: [
      { id: 'i-1', content: '2', categoryId: 'chan' },
      { id: 'i-2', content: '3', categoryId: 'le' },
      { id: 'i-3', content: '4', categoryId: 'chan' },
      { id: 'i-4', content: '5', categoryId: 'le' },
    ],
    explanation: 'Số chẵn chia hết cho 2, số lẻ không chia hết cho 2.',
  },
};
