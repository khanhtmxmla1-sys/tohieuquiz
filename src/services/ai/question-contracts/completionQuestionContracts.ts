import { z } from 'zod';
import { QuestionType } from '../../../types';
import type { AiQuestionTypeContract, QuestionContractIssue } from './questionContract.types';
import {
  CommonGeneratedQuestionFields,
  NonEmptyText,
  OptionalImage,
  QuestionText,
  extractSequentialMarkers,
  hasSequentialMarkers,
  normalizeComparableText,
  uniqueNormalizedValues,
} from './questionContract.shared';

const ShortAnswerSchema = z.object({
  type: z.literal(QuestionType.SHORT_ANSWER),
  question: QuestionText,
  correctAnswer: NonEmptyText.max(120),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
});

type ShortAnswerQuestionV3 = z.infer<typeof ShortAnswerSchema>;

const DragDropSchema = z.object({
  type: z.literal(QuestionType.DRAG_DROP),
  question: QuestionText,
  text: QuestionText,
  blanks: z.array(NonEmptyText.max(500)).min(1).max(12),
  distractors: z.array(NonEmptyText.max(500)).max(20),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
});

type DragDropQuestionV3 = z.infer<typeof DragDropSchema>;

const DropdownSchema = z.object({
  type: z.literal(QuestionType.DROPDOWN),
  question: QuestionText,
  text: QuestionText,
  blanks: z.array(z.object({
    id: z.string().trim().regex(/^\d+$/),
    options: z.array(NonEmptyText.max(500)).min(2).max(5),
    correctAnswer: NonEmptyText.max(500),
  })).min(1).max(12),
  image: OptionalImage,
  ...CommonGeneratedQuestionFields,
});

type DropdownQuestionV3 = z.infer<typeof DropdownSchema>;

const issue = (code: string, path: Array<string | number>, message: string): QuestionContractIssue => ({
  code,
  path,
  message,
  repairable: true,
});

export const SHORT_ANSWER_CONTRACT: AiQuestionTypeContract<ShortAnswerQuestionV3> = {
  type: QuestionType.SHORT_ANSWER,
  label: 'Điền đáp án ngắn',
  shortLabel: 'Điền đáp án',
  emoji: '✏️',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: ShortAnswerSchema,
  promptFragment: () => `[CONTRACT: SHORT_ANSWER]\n- Đáp án là một từ, số hoặc cụm từ ngắn, tối đa 120 ký tự.\n- Không đưa nhiều đáp án thay thế bằng dấu / hoặc từ “hoặc”.\n- JSON: {"slotId":"slot-1","type":"SHORT_ANSWER","difficulty":2,"question":"...","correctAnswer":"...","explanation":"..."}`,
  validateSemantics: (question) => /\s+(?:hoặc|hay)\s+|\//iu.test(question.correctAnswer)
    ? [issue('SHORT_ANSWER_AMBIGUOUS', ['correctAnswer'], 'Đáp án ngắn không được chứa nhiều phương án thay thế.')]
    : [],
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.SHORT_ANSWER,
    difficulty: 2,
    question: 'Thủ đô của Việt Nam là thành phố nào?',
    correctAnswer: 'Hà Nội',
    explanation: 'Hà Nội là thủ đô của nước Việt Nam.',
  },
};

export const DRAG_DROP_CONTRACT: AiQuestionTypeContract<DragDropQuestionV3> = {
  type: QuestionType.DRAG_DROP,
  label: 'Kéo thả điền khuyết',
  shortLabel: 'Kéo thả',
  emoji: '🎯',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: DragDropSchema,
  promptFragment: () => `[CONTRACT: DRAG_DROP]\n- text dùng marker tuần tự [1], [2], ...; đáp án nằm trong blanks, không đặt trong marker.\n- JSON: {"slotId":"slot-1","type":"DRAG_DROP","difficulty":2,"question":"...","text":"... [1] ...","blanks":["..."],"distractors":["..."],"explanation":"..."}`,
  validateSemantics: (question) => {
    const issues: QuestionContractIssue[] = [];
    const markers = extractSequentialMarkers(question.text);
    if (markers.length !== question.blanks.length || !hasSequentialMarkers(markers)) {
      issues.push(issue('DRAG_DROP_MARKERS_INVALID', ['text'], 'Marker kéo thả phải tuần tự và khớp số đáp án.'));
    }
    if (!uniqueNormalizedValues(question.blanks)
      || !uniqueNormalizedValues(question.distractors)) {
      issues.push(issue('DRAG_DROP_DUPLICATE_VALUES', ['blanks'], 'Đáp án và phương án nhiễu không được trùng nhau.'));
    }
    const answers = new Set(question.blanks.map(normalizeComparableText));
    if (question.distractors.some((value) => answers.has(normalizeComparableText(value)))) {
      issues.push(issue('DRAG_DROP_DISTRACTOR_CONFLICT', ['distractors'], 'Phương án nhiễu không được trùng đáp án.'));
    }
    return issues;
  },
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.DRAG_DROP,
    difficulty: 2,
    question: 'Kéo từ thích hợp vào chỗ trống.',
    text: 'Bầu trời thường có màu [1].',
    blanks: ['xanh'],
    distractors: ['đỏ', 'đen'],
    explanation: 'Trong ngày quang đãng, bầu trời thường có màu xanh.',
  },
};

export const DROPDOWN_CONTRACT: AiQuestionTypeContract<DropdownQuestionV3> = {
  type: QuestionType.DROPDOWN,
  label: 'Chọn từ danh sách',
  shortLabel: 'Danh sách chọn',
  emoji: '🔽',
  availability: 'aiSelectable',
  requiresPrimaryImage: false,
  schema: DropdownSchema,
  promptFragment: () => `[CONTRACT: DROPDOWN]\n- text dùng marker [1], [2], ...; blank.id phải đúng số marker.\n- Mỗi blank có 2 đến 5 lựa chọn và correctAnswer thuộc options.\n- JSON: {"slotId":"slot-1","type":"DROPDOWN","difficulty":2,"question":"...","text":"... [1] ...","blanks":[{"id":"1","options":["...","..."],"correctAnswer":"..."}],"explanation":"..."}`,
  validateSemantics: (question) => {
    const issues: QuestionContractIssue[] = [];
    const markers = extractSequentialMarkers(question.text);
    const ids = question.blanks.map((blank) => blank.id);
    if (markers.length !== question.blanks.length
      || !hasSequentialMarkers(markers)
      || markers.some((marker, index) => marker !== ids[index])) {
      issues.push(issue('DROPDOWN_MARKER_ID_MISMATCH', ['blanks'], 'ID ô chọn phải khớp marker tuần tự trong văn bản.'));
    }
    question.blanks.forEach((blank, index) => {
      if (!uniqueNormalizedValues(blank.options)) {
        issues.push(issue('DROPDOWN_OPTIONS_DUPLICATE', ['blanks', index, 'options'], 'Các lựa chọn không được trùng nhau.'));
      }
      const normalizedAnswer = normalizeComparableText(blank.correctAnswer);
      if (!blank.options.some((option) => normalizeComparableText(option) === normalizedAnswer)) {
        issues.push(issue('DROPDOWN_ANSWER_MISSING', ['blanks', index, 'correctAnswer'], 'Đáp án phải thuộc danh sách lựa chọn.'));
      }
    });
    return issues;
  },
  validFixture: {
    slotId: 'slot-1',
    type: QuestionType.DROPDOWN,
    difficulty: 2,
    question: 'Chọn từ đúng cho ô trống.',
    text: 'Thủ đô Việt Nam là [1].',
    blanks: [{ id: '1', options: ['Hà Nội', 'Huế', 'Đà Nẵng'], correctAnswer: 'Hà Nội' }],
    explanation: 'Hà Nội là thủ đô của Việt Nam.',
  },
};
