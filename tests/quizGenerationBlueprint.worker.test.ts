import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { buildQuestionBlueprintSlots } from '../src/features/quiz-generator/domain/quizBlueprint';
import { canonicalizeQuizGenerationRequest } from '../workers/src/services/quizGeneration/request';
import { buildServerBlueprint } from '../workers/src/services/quizGeneration/blueprint';

const makeRequest = () => ({
  actionId: 'quiz-action-002',
  source: 'system' as const,
  title: '  Đề phân số  ',
  topic: '  Phân số  ',
  classLevel: ' 4 ',
  content: 'Nguồn tham khảo',
  intent: 'PRACTICE' as const,
  sourceMode: 'TOPIC' as const,
  questionCount: 4,
  typeAllocations: [
    { type: 'MCQ' as const, count: 2 },
    { type: 'MATCHING' as const, count: 1 },
    { type: 'SHORT_ANSWER' as const, count: 1 },
  ],
  difficultyLevels: { level1: 1, level2: 2, level3: 1 },
  promptProfile: { useThongTu27: true, learnerMode: 'default' as const },
  subject: 'math',
  skillCode: 'phan_so',
  diagramMode: 'off' as const,
});

describe('server canonical quiz blueprint', () => {
  it('trims and canonicalizes the request before blueprint construction', () => {
    const request = canonicalizeQuizGenerationRequest(makeRequest());

    expect(request.title).toBe('Đề phân số');
    expect(request.topic).toBe('Phân số');
    expect(request.classLevel).toBe('4');
  });

  it('matches the existing V3 slot allocation behavior', () => {
    const request = canonicalizeQuizGenerationRequest(makeRequest());
    const serverBlueprint = buildServerBlueprint(request);

    const legacySlots = buildQuestionBlueprintSlots({
      totalQuestions: request.questionCount,
      typeAllocations: [
        { type: QuestionType.MCQ, count: 2 },
        { type: QuestionType.MATCHING, count: 1 },
        { type: QuestionType.SHORT_ANSWER, count: 1 },
      ],
      difficultyLevels: request.difficultyLevels,
      objective: request.skillCode!,
      subject: 'math',
      skillCode: request.skillCode,
      subskillCode: request.subskillCode,
      sourceRefs: request.sourceRefs,
      diagramMode: 'off',
    });

    expect(serverBlueprint).toEqual({
      version: 3,
      intent: 'PRACTICE',
      sourceMode: 'TOPIC',
      topic: 'Phân số',
      classLevel: '4',
      totalQuestions: 4,
      slots: legacySlots,
    });
  });

  it('maps DOCUMENT_TEXT request mode to DOCUMENT blueprint mode', () => {
    const request = canonicalizeQuizGenerationRequest({
      ...makeRequest(),
      sourceMode: 'DOCUMENT_TEXT',
    });

    expect(buildServerBlueprint(request).sourceMode).toBe('DOCUMENT');
  });

  it('rejects forged client slots before blueprint construction', () => {
    const result = (() => {
      try {
        canonicalizeQuizGenerationRequest({
          ...makeRequest(),
          slots: [{ slotId: 'slot-999', type: 'RIDDLE' }],
        });
        return null;
      } catch (error) {
        return error;
      }
    })();

    expect(result).toBeInstanceOf(Error);
  });

  it('assigns optional diagram policy in auto mode without accepting legacy GEOMETRY', () => {
    const request = canonicalizeQuizGenerationRequest({
      ...makeRequest(),
      diagramMode: 'auto',
    });
    const blueprint = buildServerBlueprint(request);

    expect(blueprint.slots.every((slot) => slot.diagramPolicy === 'optional')).toBe(true);
    expect(blueprint.slots.some((slot) => slot.type === ('GEOMETRY' as never))).toBe(false);
  });
});
