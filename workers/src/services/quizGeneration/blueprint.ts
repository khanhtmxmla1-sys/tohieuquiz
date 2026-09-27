import type {
  AiSelectableQuizQuestionType,
  ServerQuizBlueprintSlot,
  ServerQuizBlueprintV3,
  ServerQuizDifficulty,
  ServerQuizGenerationRequest,
} from '../../../../shared/quiz-generation.contract';

const buildDifficultySequence = (
  levels: ServerQuizGenerationRequest['difficultyLevels'],
): ServerQuizDifficulty[] => [
  ...Array.from({ length: levels.level1 }, () => 1 as const),
  ...Array.from({ length: levels.level2 }, () => 2 as const),
  ...Array.from({ length: levels.level3 }, () => 3 as const),
];

const resolveImagePolicy = (
  type: AiSelectableQuizQuestionType,
): ServerQuizBlueprintSlot['imagePolicy'] => (
  type === 'IMAGE_QUESTION' ? 'required' : 'optional'
);

const resolveDiagramPolicy = (
  mode: ServerQuizGenerationRequest['diagramMode'],
): ServerQuizBlueprintSlot['diagramPolicy'] => (
  mode === 'off' ? 'forbidden' : 'optional'
);

export function buildServerBlueprint(
  request: ServerQuizGenerationRequest,
): ServerQuizBlueprintV3 {
  const difficultySequence = buildDifficultySequence(request.difficultyLevels);
  if (difficultySequence.length !== request.questionCount) {
    throw new Error(`Tổng số câu theo độ khó phải bằng ${request.questionCount}.`);
  }

  const allocations = request.typeAllocations.map((allocation, index) => ({
    type: allocation.type,
    configuredCount: allocation.count,
    remaining: allocation.count,
    index,
  }));
  const allocationTotal = allocations.reduce((sum, allocation) => sum + allocation.remaining, 0);
  if (allocationTotal !== request.questionCount) {
    throw new Error(`Tổng số câu theo dạng phải bằng ${request.questionCount}.`);
  }

  const objective = request.skillCode?.trim() || request.topic;
  const slots = difficultySequence.map((difficulty, index): ServerQuizBlueprintSlot => {
    const candidates = allocations.filter((allocation) => allocation.remaining > 0);
    const selected = candidates.sort((left, right) => {
      const leftRatio = left.remaining / left.configuredCount;
      const rightRatio = right.remaining / right.configuredCount;
      return rightRatio - leftRatio || left.index - right.index;
    })[0];

    if (!selected) {
      throw new Error('Không thể phân bổ đủ dạng câu cho blueprint.');
    }

    selected.remaining -= 1;
    return {
      slotId: `slot-${index + 1}`,
      ordinal: index + 1,
      type: selected.type,
      difficulty,
      objective,
      subject: request.subject,
      skillCode: request.skillCode,
      subskillCode: request.subskillCode,
      imagePolicy: resolveImagePolicy(selected.type),
      diagramPolicy: resolveDiagramPolicy(request.diagramMode),
      sourceRefs: request.sourceRefs ? [...request.sourceRefs] : undefined,
    };
  });

  return {
    version: 3,
    intent: request.intent,
    sourceMode: request.sourceMode === 'DOCUMENT_TEXT' ? 'DOCUMENT' : 'TOPIC',
    topic: request.topic,
    classLevel: request.classLevel,
    totalQuestions: request.questionCount,
    slots,
  };
}
