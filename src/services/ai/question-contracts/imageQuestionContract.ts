import { z } from 'zod';
import { QuestionType } from '../../../types';
import type { AiQuestionTypeContract, QuestionContractIssue } from './questionContract.types';
import {
  CommonGeneratedQuestionFields,
  NonEmptyText,
  QuestionText,
  answerLetterIndex,
  uniqueNormalizedValues,
} from './questionContract.shared';

const ImageQuestionSchema = z.object({
  type: z.literal(QuestionType.IMAGE_QUESTION),
  question: QuestionText,
  image: z.string().trim().min(1).max(2_000_000),
  imageAlt: NonEmptyText.max(1_000),
  options: z.array(NonEmptyText.max(1_000)).length(4),
  optionImages: z.array(z.string().trim().min(1).max(2_000_000)).length(4).optional(),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  ...CommonGeneratedQuestionFields,
}).superRefine((question, ctx) => {
  if (!uniqueNormalizedValues(question.options)) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'Các phương án phải khác nhau.' });
  }
  if (answerLetterIndex(question.correctAnswer) >= question.options.length) {
    ctx.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'Đáp án không tồn tại.' });
  }
});

type ImageQuestionV3 = z.infer<typeof ImageQuestionSchema>;

const issue = (code: string, path: Array<string | number>, message: string): QuestionContractIssue => ({
  code,
  path,
  message,
  repairable: true,
});

export const IMAGE_QUESTION_CONTRACT: AiQuestionTypeContract<ImageQuestionV3> = {
  type: QuestionType.IMAGE_QUESTION,
  label: 'Câu hỏi dựa vào hình',
  shortLabel: 'Dựa vào hình',
  emoji: '🖼️',
  availability: 'aiSelectable',
  requiresPrimaryImage: true,
  schema: ImageQuestionSchema,
  promptFragment: (context) => `[CONTRACT: IMAGE_QUESTION]\n- Bắt buộc có image và imageAlt; câu hỏi phải phụ thuộc trực tiếp vào hình.\n- ${context.hasImageLibrary ? 'Chỉ dùng ID ảnh có trong thư viện được cung cấp.' : 'Dùng image token theo pipeline tạo ảnh hiện có; không dùng URL placeholder.'}\n- Có đúng 4 phương án và một đáp án đúng.\n- JSON: {"slotId":"slot-1","type":"IMAGE_QUESTION","difficulty":2,"question":"...","image":"image-id","imageAlt":"...","options":["...","...","...","..."],"correctAnswer":"A","explanation":"..."}`,
  validateSemantics: (question, slot) => {
    const issues: QuestionContractIssue[] = [];
    if (slot.imagePolicy !== 'required') {
      issues.push(issue('IMAGE_POLICY_MISMATCH', ['image'], 'Slot câu hỏi hình phải yêu cầu ảnh.'));
    }
    if (/^https:\/\/placehold\.co\//i.test(question.image)) {
      issues.push(issue('IMAGE_PLACEHOLDER_FORBIDDEN', ['image'], 'Không được dùng ảnh placeholder trong kết quả cuối.'));
    }
    return issues;
  },
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.IMAGE_QUESTION,
    difficulty: 2,
    question: 'Quan sát hình và chọn hình vuông.',
    image: 'image-library-square-1',
    imageAlt: 'Bốn hình cơ bản gồm hình vuông, tròn, tam giác và chữ nhật.',
    options: ['Hình thứ nhất', 'Hình thứ hai', 'Hình thứ ba', 'Hình thứ tư'],
    correctAnswer: 'A',
    explanation: 'Hình thứ nhất có bốn cạnh bằng nhau và bốn góc vuông.',
  },
};
