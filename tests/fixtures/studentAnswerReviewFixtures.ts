import type { QuestionAnswerReview } from '../../src/domain/quiz-scoring';
import type { StudentResult } from '../../src/types';
import type { ResultAnswerReviewPayload } from '../../src/services/results/resultAnswersService';

/**
 * Anonymous data for the student result review flow.
 *
 * The fixture deliberately keeps the question shape close to the published
 * question payload.  `questionSnapshot` values are generated with the same
 * correct-field stripping rules used by the worker, so tests can distinguish
 * the submission-time question from the current question loaded for a review.
 */

export type StudentReviewStatus = 'correct' | 'wrong' | 'skipped' | 'voided';
export type StudentReviewSource = 'submission' | 'verified-current' | 'legacy-unverified';

export type CanonicalStudentReviewType =
  | 'MCQ'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'MATCHING'
  | 'MULTIPLE_SELECT'
  | 'DRAG_DROP'
  | 'ORDERING'
  | 'IMAGE_QUESTION'
  | 'DROPDOWN'
  | 'UNDERLINE'
  | 'CATEGORIZATION'
  | 'WORD_SCRAMBLE'
  | 'RIDDLE'
  | 'ERROR_CORRECTION'
  | 'GEOMETRY';

export type StudentReviewAliasType =
  | 'MULTIPLE_CHOICE'
  | 'IMAGE'
  | 'IMAGE_MCQ'
  | 'MATH_INPUT'
  | 'FILL_IN_THE_BLANK';

export interface StudentReviewQuestion {
  id: string;
  type: CanonicalStudentReviewType | StudentReviewAliasType;
  [key: string]: unknown;
}

export interface StudentReviewSourceMetadata {
  source: StudentReviewSource;
  gradingVersion?: string;
  answerSchemaVersion?: number;
  questionRevision?: string;
  questionHash?: string;
  note: string;
}

export interface StoredStudentReviewAnswer {
  selectedAnswer: unknown;
  isCorrect: boolean;
  status: StudentReviewStatus;
  gradingVersion?: string;
  questionSnapshot: StudentReviewQuestion;
}

export interface StudentReviewFixtureCase {
  id: string;
  type: CanonicalStudentReviewType;
  question: StudentReviewQuestion;
  selectedAnswer: unknown;
  storedAnswer: StoredStudentReviewAnswer;
  reviewDetail: QuestionAnswerReview;
  status: StudentReviewStatus;
  source: StudentReviewSourceMetadata;
}

const gradingVersion = '2.0.0' as const;
const answerSchemaVersion = 2 as const;

const stripCorrectFields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripCorrectFields);
  if (!value || typeof value !== 'object') return value;

  const blocked = new Set([
    'correctAnswer',
    'correctAnswers',
    'correctOrder',
    'correctWordIndexes',
    'correctWord',
    'correct_answer',
    'correct_word_indexes',
    'question_rich_text',
    'isCorrect',
    'categoryId',
  ]);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.has(key))
      .map(([key, nested]) => [key, stripCorrectFields(nested)]),
  );
};

const historicalSnapshot = (question: StudentReviewQuestion): StudentReviewQuestion => (
  stripCorrectFields(question) as StudentReviewQuestion
);

const textReview = (value: string) => ({
  kind: 'text' as const,
  lines: [{ value }],
});

const listReview = (values: string[]) => ({
  kind: 'list' as const,
  lines: values.map((value) => ({ value })),
});

const mappingReview = (lines: Array<{ label: string; value: string }>) => ({
  kind: 'mapping' as const,
  lines,
});

const emptyReview = () => ({
  kind: 'empty' as const,
  lines: [{ value: 'Chưa trả lời' }],
});

const voidedReview = () => ({
  kind: 'unsupported' as const,
  lines: [{ value: 'Câu hỏi không được tính điểm do lỗi dữ liệu' }],
});

const sourceForSubmission: StudentReviewSourceMetadata = {
  source: 'submission',
  gradingVersion,
  answerSchemaVersion,
  note: 'POST /api/results returned this grading version; no question revision/hash is persisted.',
};

const sourceForLegacyHistory: StudentReviewSourceMetadata = {
  source: 'legacy-unverified',
  gradingVersion,
  note: 'The result has a snapshot but no persisted question revision/hash proves compatibility with the current quiz.',
};

const createStoredAnswer = (
  question: StudentReviewQuestion,
  selectedAnswer: unknown,
  status: StudentReviewStatus,
  isCorrect = status === 'correct',
): StoredStudentReviewAnswer => ({
  selectedAnswer,
  isCorrect,
  status,
  gradingVersion,
  questionSnapshot: historicalSnapshot(question),
});

export const studentAnswerReviewQuestions: StudentReviewQuestion[] = [
  {
    id: 'review-mcq',
    type: 'MCQ',
    question: 'Chọn kết quả đúng của 2 + 2.',
    options: ['4', '4', '5'],
    correctAnswer: 'A',
    explanation: 'Ghép hai nhóm, mỗi nhóm có hai phần tử.',
  },
  {
    id: 'review-true-false',
    type: 'TRUE_FALSE',
    mainQuestion: 'Đọc từng mệnh đề và chọn Đúng hoặc Sai.',
    items: [
      { id: 'tf-a', statement: 'Số 0 là số chẵn.', isCorrect: true },
      { id: 'tf-b', statement: 'Số 5 chia hết cho 2.', isCorrect: false },
      { id: 'tf-c', statement: 'Số 10 lớn hơn số 8.', isCorrect: true },
    ],
  },
  {
    id: 'review-short-answer',
    type: 'SHORT_ANSWER',
    question: 'Viết kết quả của 1/2 + 1/2.',
    correctAnswer: '1',
  },
  {
    id: 'review-matching',
    type: 'MATCHING',
    question: 'Nối phép tính với kết quả đúng.',
    pairs: [
      { left: '2 + 2', right: '4' },
      { left: '2 + 2', right: '5' },
      { left: '3 + 3', right: '6' },
    ],
  },
  {
    id: 'review-multiple-select',
    type: 'MULTIPLE_SELECT',
    question: 'Chọn tất cả số chẵn.',
    options: ['2', '2', '3', '4'],
    correctAnswers: ['A', 'D'],
  },
  {
    id: 'review-drag-drop',
    type: 'DRAG_DROP',
    question: 'Kéo số thích hợp vào từng chỗ trống.',
    text: 'Số [blank-2] lớn hơn số [blank-7].',
    blanks: [
      { id: 'blank-2', options: ['9', '8'], correctAnswer: '9' },
      { id: 'blank-7', options: ['3', '2'], correctAnswer: '3' },
    ],
    distractors: ['1', '7'],
  },
  {
    id: 'review-ordering',
    type: 'ORDERING',
    question: 'Sắp xếp các bước theo đúng thứ tự.',
    items: ['Kết luận', 'Tính toán', 'Đọc đề'],
    correctOrder: [2, 1, 0],
  },
  {
    id: 'review-image-question',
    type: 'IMAGE_QUESTION',
    question: 'Quan sát hình và chọn đáp án.',
    image: 'https://example.invalid/student-review/main.png',
    options: ['Hình A', 'Hình B'],
    optionImages: [
      'https://example.invalid/student-review/option-a.png',
      'https://example.invalid/student-review/option-b.png',
    ],
    correctAnswer: 'B',
  },
  {
    id: 'review-dropdown',
    type: 'DROPDOWN',
    question: 'Chọn từ hoặc số phù hợp.',
    text: 'Em [blank-7] lớp và có [blank-12] quyển vở.',
    blanks: [
      { id: 'blank-7', options: ['đến', 'đi'], correctAnswer: 'đến' },
      { id: 'blank-12', options: ['0', '1'], correctAnswer: '0' },
    ],
  },
  {
    id: 'review-underline',
    type: 'UNDERLINE',
    question: 'Gạch chân các từ chỉ hoạt động.',
    sentence: 'Ba ba ba đi học.',
    words: ['Ba', 'ba', 'ba', 'đi', 'học'],
    correctWordIndexes: [3],
  },
  {
    id: 'review-categorization',
    type: 'CATEGORIZATION',
    question: 'Kéo mỗi từ vào đúng nhóm.',
    categories: [
      { id: 'category-noun', name: 'Danh từ' },
      { id: 'category-verb', name: 'Động từ' },
    ],
    items: [
      { id: 'item-school', content: 'trường học', categoryId: 'category-noun' },
      { id: 'item-run', content: 'chạy', categoryId: 'category-verb' },
      { id: 'item-book', content: 'quyển sách', categoryId: 'category-noun' },
    ],
  },
  {
    id: 'review-word-scramble',
    type: 'WORD_SCRAMBLE',
    question: 'Sắp xếp các chữ cái thành một từ.',
    letters: ['T', 'O', 'Á', 'N'],
    correctWord: 'TOÁN',
    hint: 'Môn học có các phép tính.',
  },
  {
    id: 'review-riddle',
    type: 'RIDDLE',
    question: 'Đọc câu đố và tìm đáp án.',
    riddleLines: ['Có cánh mà chẳng biết bay.', 'Có chân mà chẳng biết đi.'],
    correctAnswer: 'cái bàn',
    answerType: 'original',
    answerLabel: 'Đáp án câu đố',
    hint: 'Đồ vật ở trong lớp học.',
  },
  {
    id: 'review-error-correction',
    type: 'ERROR_CORRECTION',
    question: 'Tìm từ viết sai và sửa lại.',
    passage: 'Em rất chăm trỉ học bài.',
    wrongWord: 'trỉ',
    correctWord: 'chỉ',
  },
  {
    id: 'review-geometry',
    type: 'GEOMETRY',
    question: 'Quan sát hình hình học và ghi nhận xét.',
    geometryData: { shape: 'square', sides: 4 },
    geometryType: 'square',
  },
];

const byId = (id: string): StudentReviewQuestion => {
  const question = studentAnswerReviewQuestions.find((item) => item.id === id);
  if (!question) throw new Error(`Unknown student review fixture question: ${id}`);
  return question;
};

const studentAnswerReviewCasesDraft: Array<Omit<StudentReviewFixtureCase, 'storedAnswer'> & {
  storedAnswer?: StoredStudentReviewAnswer;
}> = [
  {
    id: 'review-mcq',
    type: 'MCQ',
    question: byId('review-mcq'),
    selectedAnswer: { type: 'MCQ', optionId: 'option-0' },
    status: 'correct',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-mcq', type: 'MCQ', status: 'correct', isCorrect: true,
      studentAnswer: textReview('4'), correctAnswer: textReview('4'),
    },
  },
  {
    id: 'review-true-false',
    type: 'TRUE_FALSE',
    question: byId('review-true-false'),
    selectedAnswer: {
      type: 'TRUE_FALSE',
      values: { 'tf-a': false, 'tf-b': false },
    },
    status: 'wrong',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-true-false', type: 'TRUE_FALSE', status: 'wrong', isCorrect: false,
      studentAnswer: mappingReview([
        { label: 'Số 0 là số chẵn.', value: 'Sai' },
        { label: 'Số 5 chia hết cho 2.', value: 'Sai' },
        { label: 'Số 10 lớn hơn số 8.', value: 'Chưa trả lời' },
      ]),
      correctAnswer: mappingReview([
        { label: 'Số 0 là số chẵn.', value: 'Đúng' },
        { label: 'Số 5 chia hết cho 2.', value: 'Sai' },
        { label: 'Số 10 lớn hơn số 8.', value: 'Đúng' },
      ]),
    },
  },
  {
    id: 'review-short-answer',
    type: 'SHORT_ANSWER',
    question: byId('review-short-answer'),
    selectedAnswer: null,
    status: 'skipped',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-short-answer', type: 'SHORT_ANSWER', status: 'skipped', isCorrect: false,
      studentAnswer: emptyReview(), correctAnswer: textReview('1'),
    },
  },
  {
    id: 'review-matching',
    type: 'MATCHING',
    question: byId('review-matching'),
    selectedAnswer: {
      type: 'MATCHING',
      pairs: { 'left-0': 'right-1' },
    },
    status: 'wrong',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-matching', type: 'MATCHING', status: 'wrong', isCorrect: false,
      studentAnswer: mappingReview([
        { label: '2 + 2', value: '5' },
        { label: '2 + 2 (mục thứ hai)', value: 'Chưa trả lời' },
        { label: '3 + 3', value: 'Chưa trả lời' },
      ]),
      correctAnswer: mappingReview([
        { label: '2 + 2 (mục thứ nhất)', value: '4' },
        { label: '2 + 2 (mục thứ hai)', value: '5' },
        { label: '3 + 3', value: '6' },
      ]),
    },
  },
  {
    id: 'review-multiple-select',
    type: 'MULTIPLE_SELECT',
    question: byId('review-multiple-select'),
    selectedAnswer: {
      type: 'MULTIPLE_SELECT',
      optionIds: ['option-1', 'option-3'],
    },
    status: 'wrong',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-multiple-select', type: 'MULTIPLE_SELECT', status: 'wrong', isCorrect: false,
      studentAnswer: listReview(['2', '4']),
      correctAnswer: listReview(['2', '4']),
    },
  },
  {
    id: 'review-drag-drop',
    type: 'DRAG_DROP',
    question: byId('review-drag-drop'),
    selectedAnswer: null,
    status: 'skipped',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-drag-drop', type: 'DRAG_DROP', status: 'skipped', isCorrect: false,
      studentAnswer: emptyReview(),
      correctAnswer: mappingReview([
        { label: 'Chỗ trống 1', value: '9' },
        { label: 'Chỗ trống 2', value: '3' },
      ]),
    },
  },
  {
    id: 'review-ordering',
    type: 'ORDERING',
    question: byId('review-ordering'),
    selectedAnswer: {
      type: 'ORDERING',
      ranks: { 'item-0': 1, 'item-2': 2 },
    },
    status: 'wrong',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-ordering', type: 'ORDERING', status: 'wrong', isCorrect: false,
      studentAnswer: listReview(['Kết luận', 'Đọc đề']),
      correctAnswer: listReview(['Đọc đề', 'Tính toán', 'Kết luận']),
    },
  },
  {
    id: 'review-image-question',
    type: 'IMAGE_QUESTION',
    question: byId('review-image-question'),
    selectedAnswer: { type: 'IMAGE_QUESTION', optionId: 'option-1' },
    status: 'correct',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-image-question', type: 'IMAGE_QUESTION', status: 'correct', isCorrect: true,
      studentAnswer: textReview('Hình B'), correctAnswer: textReview('Hình B'),
    },
  },
  {
    id: 'review-dropdown',
    type: 'DROPDOWN',
    question: byId('review-dropdown'),
    selectedAnswer: {
      type: 'DROPDOWN',
      values: { 'blank-7': 'đến', 'blank-12': '1' },
    },
    status: 'wrong',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-dropdown', type: 'DROPDOWN', status: 'wrong', isCorrect: false,
      studentAnswer: mappingReview([
        { label: 'Chỗ trống 1', value: 'đến' },
        { label: 'Chỗ trống 2', value: '1' },
      ]),
      correctAnswer: mappingReview([
        { label: 'Chỗ trống 1', value: 'đến' },
        { label: 'Chỗ trống 2', value: '0' },
      ]),
    },
  },
  {
    id: 'review-underline',
    type: 'UNDERLINE',
    question: byId('review-underline'),
    selectedAnswer: { type: 'UNDERLINE', indexes: [1] },
    status: 'wrong',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-underline', type: 'UNDERLINE', status: 'wrong', isCorrect: false,
      studentAnswer: listReview(['ba']), correctAnswer: listReview(['đi']),
    },
  },
  {
    id: 'review-categorization',
    type: 'CATEGORIZATION',
    question: byId('review-categorization'),
    selectedAnswer: {
      type: 'CATEGORIZATION',
      categoriesByItemId: {
        'item-school': 'category-verb',
        'item-run': 'category-verb',
      },
    },
    status: 'wrong',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-categorization', type: 'CATEGORIZATION', status: 'wrong', isCorrect: false,
      studentAnswer: mappingReview([
        { label: 'trường học', value: 'Động từ' },
        { label: 'chạy', value: 'Động từ' },
        { label: 'quyển sách', value: 'Chưa trả lời' },
      ]),
      correctAnswer: mappingReview([
        { label: 'trường học', value: 'Danh từ' },
        { label: 'chạy', value: 'Động từ' },
        { label: 'quyển sách', value: 'Danh từ' },
      ]),
    },
  },
  {
    id: 'review-word-scramble',
    type: 'WORD_SCRAMBLE',
    question: byId('review-word-scramble'),
    selectedAnswer: { type: 'WORD_SCRAMBLE', letterIndexes: [0, 1, 2, 3] },
    status: 'correct',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-word-scramble', type: 'WORD_SCRAMBLE', status: 'correct', isCorrect: true,
      studentAnswer: textReview('TOÁN'), correctAnswer: textReview('TOÁN'),
    },
  },
  {
    id: 'review-riddle',
    type: 'RIDDLE',
    question: byId('review-riddle'),
    selectedAnswer: null,
    status: 'skipped',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-riddle', type: 'RIDDLE', status: 'skipped', isCorrect: false,
      studentAnswer: emptyReview(), correctAnswer: textReview('cái bàn'),
    },
  },
  {
    id: 'review-error-correction',
    type: 'ERROR_CORRECTION',
    question: byId('review-error-correction'),
    selectedAnswer: {
      type: 'ERROR_CORRECTION',
      wrongWord: 'trỉ',
      correctWord: 'trị',
    },
    status: 'wrong',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-error-correction', type: 'ERROR_CORRECTION', status: 'wrong', isCorrect: false,
      studentAnswer: mappingReview([
        { label: 'Từ sai', value: 'trỉ' },
        { label: 'Từ sửa', value: 'trị' },
      ]),
      correctAnswer: mappingReview([
        { label: 'Từ sai', value: 'trỉ' },
        { label: 'Từ sửa đúng', value: 'chỉ' },
      ]),
    },
  },
  {
    id: 'review-geometry',
    type: 'GEOMETRY',
    question: byId('review-geometry'),
    selectedAnswer: { type: 'GEOMETRY', value: 'square' },
    status: 'voided',
    source: sourceForSubmission,
    reviewDetail: {
      questionId: 'review-geometry', type: 'GEOMETRY', status: 'voided', isCorrect: false,
      studentAnswer: voidedReview(), correctAnswer: voidedReview(),
    },
  },
];

export const studentAnswerReviewCases: StudentReviewFixtureCase[] = studentAnswerReviewCasesDraft.map((fixture) => ({
  ...fixture,
  storedAnswer: fixture.storedAnswer ?? createStoredAnswer(
    fixture.question,
    fixture.selectedAnswer,
    fixture.status,
    fixture.reviewDetail.isCorrect,
  ),
}));

export const studentAnswerReviewAnswers = Object.fromEntries([
  ['_questionOrder', studentAnswerReviewCases.map((fixture) => fixture.id)],
  ...studentAnswerReviewCases.map((fixture) => [fixture.id, fixture.storedAnswer]),
]);

export const studentAnswerReviewReviewDetails: QuestionAnswerReview[] = studentAnswerReviewCases.map(
  (fixture) => fixture.reviewDetail,
);

export const studentAnswerReviewResult: StudentResult = {
  id: 'result-student-review-fixture',
  assignmentId: 'assignment-student-review-fixture',
  studentId: 'student-fixture',
  studentName: 'Fixture student',
  studentClass: 'Fixture class',
  quizId: 'quiz-student-review-fixture',
  quizTitle: 'Bài kiểm tra fixture',
  score: 2.1,
  correctCount: 3,
  questionCount: 15,
  totalQuestions: 14,
  voidedCount: 1,
  timeTaken: 1.5,
  submittedAt: '2026-09-14T00:00:00.000Z',
  gradingVersion,
  answers: studentAnswerReviewAnswers,
  reviewDetails: studentAnswerReviewReviewDetails,
  validationDetails: studentAnswerReviewCases.map((fixture) => ({
    questionId: fixture.id,
    isCorrect: fixture.reviewDetail.isCorrect,
    status: fixture.status,
    ...(fixture.status === 'voided' ? { issueCode: 'QUESTION_NOT_AUTO_GRADABLE' } : {}),
  })),
};

/** Payload returned immediately after a new submission is accepted. */
export const studentAnswerReviewSubmissionPayload = {
  status: 'success' as const,
  resultId: studentAnswerReviewResult.id,
  assignmentId: studentAnswerReviewResult.assignmentId,
  quizId: studentAnswerReviewResult.quizId,
  score: studentAnswerReviewResult.score,
  correctCount: studentAnswerReviewResult.correctCount,
  questionCount: studentAnswerReviewResult.questionCount,
  totalQuestions: studentAnswerReviewResult.totalQuestions,
  voidedCount: studentAnswerReviewResult.voidedCount,
  gradingVersion,
  answerSchemaVersion,
  answers: studentAnswerReviewAnswers,
  validationDetails: studentAnswerReviewResult.validationDetails,
  reviewDetails: studentAnswerReviewReviewDetails,
};

/** Payload loaded after dashboard -> result list -> GET /api/results/:id/answers. */
export const studentAnswerReviewHistoryPayload: ResultAnswerReviewPayload = {
  answers: studentAnswerReviewAnswers,
  reviewDetails: studentAnswerReviewReviewDetails,
  result: studentAnswerReviewResult,
};

export const studentAnswerReviewDashboardFlow = {
  assignment: {
    id: studentAnswerReviewResult.assignmentId,
    quizId: studentAnswerReviewResult.quizId,
    quizTitle: studentAnswerReviewResult.quizTitle,
    attemptCount: 2,
    maxAttempts: 2,
    allowReview: true,
  },
  resultListItem: {
    id: studentAnswerReviewResult.id,
    quizId: studentAnswerReviewResult.quizId,
    assignmentId: studentAnswerReviewResult.assignmentId,
    submittedAt: studentAnswerReviewResult.submittedAt,
  },
  answersRequest: {
    method: 'GET' as const,
    path: `/api/results/${studentAnswerReviewResult.id}/answers`,
  },
  response: studentAnswerReviewHistoryPayload,
};

/**
 * These are the aliases currently normalized by normalizeQuestionForGrading.
 * The expected type is deliberately explicit so renderer tests can verify
 * that aliases do not fall through to a raw JSON answer view.
 */
export const studentAnswerReviewAliasCases = [
  {
    id: 'alias-multiple-choice',
    inputType: 'MULTIPLE_CHOICE',
    expectedType: 'MCQ',
    question: {
      id: 'alias-multiple-choice', type: 'MULTIPLE_CHOICE',
      question: 'Chọn đáp án đúng.', options: ['A', 'B'], correctAnswer: 'A',
    },
  },
  {
    id: 'alias-image',
    inputType: 'IMAGE',
    expectedType: 'IMAGE_QUESTION',
    question: {
      id: 'alias-image', type: 'IMAGE', question: 'Chọn hình.',
      image: 'https://example.invalid/student-review/alias-image.png',
      options: ['Hình A', 'Hình B'], correctAnswer: 'B',
    },
  },
  {
    id: 'alias-image-mcq',
    inputType: 'IMAGE_MCQ',
    expectedType: 'IMAGE_QUESTION',
    question: {
      id: 'alias-image-mcq', type: 'IMAGE_MCQ', question: 'Chọn phương án.',
      image: 'https://example.invalid/student-review/alias-image-mcq.png',
      options: ['A', 'B'], correctAnswer: 'A',
    },
  },
  {
    id: 'alias-math-input',
    inputType: 'MATH_INPUT',
    expectedType: 'SHORT_ANSWER',
    question: {
      id: 'alias-math-input', type: 'MATH_INPUT', question: 'Tính 1 + 1.', correctAnswer: '2',
    },
  },
  {
    id: 'alias-fill-in-the-blank',
    inputType: 'FILL_IN_THE_BLANK',
    expectedType: 'DROPDOWN',
    question: {
      id: 'alias-fill-in-the-blank', type: 'FILL_IN_THE_BLANK',
      question: 'Chọn từ đúng.', text: 'Em [blank-4] học.',
      blanks: [{ id: 'blank-4', options: ['đi', 'ăn'], correctAnswer: 'đi' }],
    },
  },
] as const;

export const studentAnswerReviewSourceMatrix: StudentReviewSourceMetadata[] = [
  sourceForSubmission,
  {
    source: 'verified-current',
    gradingVersion,
    answerSchemaVersion,
    questionRevision: 'quiz-revision-fixture-1',
    questionHash: 'sha256:fixture-current-question-set',
    note: 'Synthetic future contract: both revision and hash are available for safe per-item comparison.',
  },
  sourceForLegacyHistory,
];

export const studentAnswerReviewHistoryCompatibilityFixtures = {
  reorderedOptions: {
    questionId: 'history-option-order-changed',
    historicalQuestion: {
      id: 'history-option-order-changed',
      type: 'MCQ',
      question: 'Chọn số lớn hơn.',
      options: ['Một', 'Hai', 'Ba'],
      correctAnswer: 'A',
    } satisfies StudentReviewQuestion,
    currentQuestion: {
      id: 'history-option-order-changed',
      type: 'MCQ',
      question: 'Chọn số lớn hơn.',
      options: ['Ba', 'Một', 'Hai'],
      correctAnswer: 'B',
    } satisfies StudentReviewQuestion,
    storedAnswer: {
      selectedAnswer: 'A',
      isCorrect: true,
      status: 'correct',
      gradingVersion,
      questionSnapshot: {
        id: 'history-option-order-changed',
        type: 'MCQ',
        question: 'Chọn số lớn hơn.',
        options: ['Một', 'Hai', 'Ba'],
      },
    } satisfies StoredStudentReviewAnswer,
    source: sourceForLegacyHistory,
  },
  deletedQuestion: {
    questionId: 'history-deleted-question',
    currentQuestion: null,
    storedAnswer: {
      selectedAnswer: { type: 'SHORT_ANSWER', value: '42' },
      isCorrect: false,
      status: 'wrong',
      gradingVersion,
      questionSnapshot: {
        id: 'history-deleted-question',
        type: 'SHORT_ANSWER',
        question: 'Câu hỏi đã bị xóa khỏi đề hiện tại.',
      },
    } satisfies StoredStudentReviewAnswer,
    source: sourceForLegacyHistory,
  },
  missingReviewDetails: {
    payload: {
      answers: studentAnswerReviewAnswers,
      reviewDetails: [],
      result: { ...studentAnswerReviewResult, reviewDetails: [] },
    } satisfies ResultAnswerReviewPayload,
    source: sourceForLegacyHistory,
  },
} as const;

export const studentAnswerReviewLegacyJson = JSON.stringify({
  _questionOrder: ['legacy-json-q1'],
  'legacy-json-q1': {
    selectedAnswer: { type: 'SHORT_ANSWER', value: '0' },
    isCorrect: true,
    status: 'correct',
    questionSnapshot: {
      id: 'legacy-json-q1',
      type: 'MATH_INPUT',
      question: 'Giá trị của 0 + 0 là bao nhiêu?',
    },
  },
});

export const studentAnswerReviewFalsyValues = {
  zero: {
    questionId: 'falsy-zero',
    question: {
      id: 'falsy-zero', type: 'SHORT_ANSWER', question: 'Nhập giá trị bằng 0.', correctAnswer: '0',
    } satisfies StudentReviewQuestion,
    selectedAnswer: { type: 'SHORT_ANSWER', value: 0 },
  },
  false: {
    questionId: 'falsy-false',
    question: {
      id: 'falsy-false', type: 'TRUE_FALSE', mainQuestion: 'Chọn Sai.',
      items: [{ id: 'falsy-item', statement: 'Mệnh đề này sai.', isCorrect: false }],
    } satisfies StudentReviewQuestion,
    selectedAnswer: { type: 'TRUE_FALSE', values: { 'falsy-item': false } },
  },
} as const;

export const studentAnswerReviewDuplicateIdentityCases = {
  duplicateOptionText: {
    questionId: 'review-multiple-select',
    options: ['2', '2', '3', '4'],
    correctOptionIds: ['option-0', 'option-3'],
    selectedOptionIds: ['option-1', 'option-3'],
  },
  duplicateWordText: {
    questionId: 'review-underline',
    words: ['Ba', 'ba', 'ba', 'đi', 'học'],
    correctIndexes: [3],
    selectedIndexes: [1],
  },
  nonContiguousBlankIds: {
    questionId: 'review-dropdown',
    blankIds: ['blank-7', 'blank-12'],
    selectedValues: { 'blank-7': 'đến', 'blank-12': '1' },
    correctValues: { 'blank-7': 'đến', 'blank-12': '0' },
  },
} as const;
