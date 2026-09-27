import { describe, expect, it } from 'vitest';
import {
  AI_SELECTABLE_QUIZ_QUESTION_TYPES,
  ServerQuizGenerationRequestSchema,
} from '../shared/quiz-generation.contract';

const makeValidRequest = () => ({
  actionId: 'quiz-action-001',
  source: 'gemini-personal' as const,
  title: 'Đề Toán lớp 3',
  topic: 'Phép nhân',
  classLevel: '3',
  content: 'Nội dung tham khảo.',
  intent: 'EXAM' as const,
  sourceMode: 'TOPIC' as const,
  questionCount: 4,
  typeAllocations: [
    { type: 'MCQ' as const, count: 2 },
    { type: 'SHORT_ANSWER' as const, count: 2 },
  ],
  difficultyLevels: { level1: 1, level2: 2, level3: 1 },
  promptProfile: {
    useThongTu27: true,
    learnerMode: 'default' as const,
  },
  customPrompt: 'Dùng tình huống gần gũi.',
  subject: 'math',
  skillCode: 'phep_nhan_chia',
  sourceRefs: ['lesson-1'],
  diagramMode: 'off' as const,
});

describe('server quiz generation contract', () => {
  it('accepts the canonical browser request shape', () => {
    const parsed = ServerQuizGenerationRequestSchema.parse(makeValidRequest());

    expect(parsed.actionId).toBe('quiz-action-001');
    expect(parsed.questionCount).toBe(4);
    expect(parsed.typeAllocations).toHaveLength(2);
  });

  it.each(['model', 'messages', 'prompt', 'apiKey', 'providerEndpoint'])(
    'rejects client-controlled provider field %s',
    (field) => {
      const payload = { ...makeValidRequest(), [field]: 'forbidden' };
      expect(ServerQuizGenerationRequestSchema.safeParse(payload).success).toBe(false);
    },
  );

  it('rejects allocation totals that do not match questionCount', () => {
    const payload = {
      ...makeValidRequest(),
      typeAllocations: [{ type: 'MCQ' as const, count: 3 }],
    };

    const result = ServerQuizGenerationRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects difficulty totals that do not match questionCount', () => {
    const payload = {
      ...makeValidRequest(),
      difficultyLevels: { level1: 1, level2: 1, level3: 1 },
    };

    const result = ServerQuizGenerationRequestSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('enforces UTF-8 byte limits instead of only JavaScript character counts', () => {
    const payload = {
      ...makeValidRequest(),
      content: 'あ'.repeat(140_000),
    };

    expect(ServerQuizGenerationRequestSchema.safeParse(payload).success).toBe(false);
  });

  it('requires document text when sourceMode is DOCUMENT_TEXT', () => {
    const payload = {
      ...makeValidRequest(),
      sourceMode: 'DOCUMENT_TEXT' as const,
      content: '',
    };

    expect(ServerQuizGenerationRequestSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects image-required questions for explicit personal sources', () => {
    const payload = {
      ...makeValidRequest(),
      typeAllocations: [{ type: 'IMAGE_QUESTION' as const, count: 4 }],
      source: 'gemini-personal' as const,
    };

    expect(ServerQuizGenerationRequestSchema.safeParse(payload).success).toBe(false);
  });

  it('exposes only the 13 AI-selectable V3 question types', () => {
    expect(AI_SELECTABLE_QUIZ_QUESTION_TYPES).toHaveLength(13);
    expect(AI_SELECTABLE_QUIZ_QUESTION_TYPES).toContain('MCQ');
    expect(AI_SELECTABLE_QUIZ_QUESTION_TYPES).toContain('RIDDLE');
    expect(AI_SELECTABLE_QUIZ_QUESTION_TYPES).not.toContain('GEOMETRY');
    expect(AI_SELECTABLE_QUIZ_QUESTION_TYPES).not.toContain('ERROR_CORRECTION');
  });
});
