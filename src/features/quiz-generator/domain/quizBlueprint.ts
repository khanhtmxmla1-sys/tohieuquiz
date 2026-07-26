import { QuestionType } from '../../../types';
import type { SupportedSkillSubject } from '../../../shared/skillTaxonomy';
import type {
  BlueprintDifficulty,
  BlueprintImagePolicy,
  QuestionContractSlot,
} from '../../../services/ai/question-contracts/questionContract.types';
import {
  isAiSelectableQuestionType,
  type AiSelectableQuestionType,
} from '../../../services/ai/question-contracts/questionTypeAvailability';

export type QuizIntent = 'EXAM' | 'PRACTICE';
export type QuizSourceMode = 'TOPIC' | 'DOCUMENT';

export interface QuestionTypeAllocation {
  type: QuestionType;
  count: number;
}

export interface QuizBlueprint {
  intent: QuizIntent;
  sourceMode: QuizSourceMode;
  totalQuestions: number;
  typeAllocations: QuestionTypeAllocation[];
  difficultyLevels: {
    level1: number;
    level2: number;
    level3: number;
  };
}

const uniqueQuestionTypes = (types: QuestionType[]): QuestionType[] => {
  const seen = new Set<QuestionType>();
  return types.filter((type) => {
    if (seen.has(type)) return false;
    seen.add(type);
    return true;
  });
};

export function buildBalancedTypeAllocations(
  types: QuestionType[],
  total: number,
): QuestionTypeAllocation[] {
  const uniqueTypes = uniqueQuestionTypes(types);
  if (uniqueTypes.length === 0) return [];

  const safeTotal = Number.isInteger(total) && total > 0 ? total : 0;
  const baseCount = Math.floor(safeTotal / uniqueTypes.length);
  const remainder = safeTotal % uniqueTypes.length;

  return uniqueTypes.map((type, index) => ({
    type,
    count: baseCount + (index < remainder ? 1 : 0),
  }));
}

export function validateQuizBlueprint(blueprint: QuizBlueprint): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(blueprint.totalQuestions)
    || blueprint.totalQuestions < 1
    || blueprint.totalQuestions > 40) {
    errors.push('Tổng số câu phải từ 1 đến 40.');
  }

  if (blueprint.typeAllocations.length === 0) {
    errors.push('Cần chọn ít nhất một dạng câu.');
  }

  if (blueprint.typeAllocations.some(({ count }) => !Number.isInteger(count) || count < 0)) {
    errors.push('Số câu theo từng dạng phải là số nguyên không âm.');
  }

  const uniqueTypes = new Set(blueprint.typeAllocations.map(({ type }) => type));
  if (uniqueTypes.size !== blueprint.typeAllocations.length) {
    errors.push('Mỗi dạng câu chỉ được xuất hiện một lần.');
  }

  const typeTotal = blueprint.typeAllocations.reduce((sum, allocation) => sum + allocation.count, 0);
  if (typeTotal !== blueprint.totalQuestions) {
    errors.push(`Tổng số câu theo dạng phải bằng ${blueprint.totalQuestions}.`);
  }

  const difficultyValues = Object.values(blueprint.difficultyLevels);
  if (difficultyValues.some((count) => !Number.isInteger(count) || count < 0)) {
    errors.push('Số câu theo độ khó phải là số nguyên không âm.');
  }

  const difficultyTotal = difficultyValues.reduce((sum, count) => sum + count, 0);
  if (difficultyTotal !== blueprint.totalQuestions) {
    errors.push(`Tổng số câu theo độ khó phải bằng ${blueprint.totalQuestions}.`);
  }

  return errors;
}

export interface QuestionBlueprintSlot extends QuestionContractSlot {
  slotId: `slot-${number}`;
  type: AiSelectableQuestionType;
  difficulty: BlueprintDifficulty;
  imagePolicy: BlueprintImagePolicy;
  sourceRefs?: string[];
}

export interface QuizBlueprintV3 {
  version: 3;
  intent: QuizIntent;
  sourceMode: QuizSourceMode;
  topic: string;
  classLevel: string;
  totalQuestions: number;
  slots: QuestionBlueprintSlot[];
}

interface BuildQuestionBlueprintSlotsInput {
  totalQuestions: number;
  typeAllocations: QuestionTypeAllocation[];
  difficultyLevels: QuizBlueprint['difficultyLevels'];
  objective: string;
  subject?: SupportedSkillSubject;
  skillCode?: string;
  subskillCode?: string;
  sourceRefs?: string[];
}

const buildDifficultySequence = (
  levels: QuizBlueprint['difficultyLevels'],
): BlueprintDifficulty[] => [
  ...Array.from({ length: levels.level1 }, () => 1 as const),
  ...Array.from({ length: levels.level2 }, () => 2 as const),
  ...Array.from({ length: levels.level3 }, () => 3 as const),
];

const resolveImagePolicy = (type: AiSelectableQuestionType): BlueprintImagePolicy => (
  type === QuestionType.IMAGE_QUESTION ? 'required' : 'optional'
);

export function buildQuestionBlueprintSlots(
  input: BuildQuestionBlueprintSlotsInput,
): QuestionBlueprintSlot[] {
  if (!Number.isInteger(input.totalQuestions)
    || input.totalQuestions < 1
    || input.totalQuestions > 40) {
    throw new Error('Tổng số câu phải từ 1 đến 40.');
  }
  if (!input.objective.trim()) {
    throw new Error('Mục tiêu của blueprint không được để trống.');
  }
  if (input.typeAllocations.length === 0) {
    throw new Error('Cần chọn ít nhất một dạng câu.');
  }
  if (new Set(input.typeAllocations.map(({ type }) => type)).size !== input.typeAllocations.length) {
    throw new Error('Mỗi dạng câu chỉ được xuất hiện một lần.');
  }
  if (input.typeAllocations.some(({ count }) => !Number.isInteger(count) || count < 0)) {
    throw new Error('Số câu theo từng dạng phải là số nguyên không âm.');
  }
  const allocationTotal = input.typeAllocations.reduce((sum, allocation) => sum + allocation.count, 0);
  if (allocationTotal !== input.totalQuestions) {
    throw new Error(`Tổng số câu theo dạng phải bằng ${input.totalQuestions}.`);
  }
  const difficultySequence = buildDifficultySequence(input.difficultyLevels);
  if (difficultySequence.length !== input.totalQuestions) {
    throw new Error(`Tổng số câu theo độ khó phải bằng ${input.totalQuestions}.`);
  }

  const allocations = input.typeAllocations.map((allocation, index) => {
    if (!isAiSelectableQuestionType(allocation.type)) {
      throw new Error(`Dạng ${allocation.type} không thuộc 13 dạng AI được hỗ trợ.`);
    }
    return {
      type: allocation.type,
      configuredCount: allocation.count,
      remaining: allocation.count,
      index,
    };
  });

  return difficultySequence.map((difficulty, index) => {
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
      objective: input.objective.trim(),
      subject: input.subject,
      skillCode: input.skillCode?.trim() || undefined,
      subskillCode: input.subskillCode?.trim() || undefined,
      imagePolicy: resolveImagePolicy(selected.type),
      sourceRefs: input.sourceRefs ? [...input.sourceRefs] : undefined,
    };
  });
}

export function validateQuizBlueprintV3(blueprint: QuizBlueprintV3): string[] {
  const errors: string[] = [];
  if (blueprint.version !== 3) {
    errors.push('Phiên bản blueprint phải là 3.');
  }
  if (!Number.isInteger(blueprint.totalQuestions)
    || blueprint.totalQuestions < 1
    || blueprint.totalQuestions > 40) {
    errors.push('Tổng số câu phải từ 1 đến 40.');
  }
  if (blueprint.slots.length !== blueprint.totalQuestions) {
    errors.push(`Số slot phải bằng ${blueprint.totalQuestions}.`);
  }
  if (new Set(blueprint.slots.map(({ slotId }) => slotId)).size !== blueprint.slots.length) {
    errors.push('Mỗi slot phải có một slotId duy nhất.');
  }
  if (blueprint.slots.some((slot, index) => slot.ordinal !== index + 1
    || slot.slotId !== `slot-${index + 1}`)) {
    errors.push('Slot phải có ordinal và slotId tuần tự.');
  }
  if (blueprint.slots.some(({ type }) => !isAiSelectableQuestionType(type))) {
    errors.push('Blueprint chứa dạng câu không thuộc 13 dạng AI.');
  }
  if (blueprint.slots.some(({ difficulty }) => ![1, 2, 3].includes(difficulty))) {
    errors.push('Độ khó của slot chỉ được là 1, 2 hoặc 3.');
  }
  if (blueprint.slots.some((slot) => slot.type === QuestionType.IMAGE_QUESTION
    && slot.imagePolicy !== 'required')) {
    errors.push('Slot câu hỏi hình phải bắt buộc có ảnh.');
  }
  if (blueprint.slots.some(({ objective }) => !objective.trim())) {
    errors.push('Mỗi slot phải có mục tiêu học tập.');
  }
  return errors;
}
