import { QuestionType } from '../../../types';
import type {
  AiQuestionTypeContract,
  GeneratedQuestionV3,
  QuestionContractContext,
} from './questionContract.types';
import {
  AI_SELECTABLE_QUESTION_TYPES,
  type AiSelectableQuestionType,
  isAiSelectableQuestionType,
} from './questionTypeAvailability';
import {
  MCQ_CONTRACT,
  MULTIPLE_SELECT_CONTRACT,
  TRUE_FALSE_CONTRACT,
} from './choiceQuestionContracts';
import {
  DRAG_DROP_CONTRACT,
  DROPDOWN_CONTRACT,
  SHORT_ANSWER_CONTRACT,
} from './completionQuestionContracts';
import {
  CATEGORIZATION_CONTRACT,
  MATCHING_CONTRACT,
  ORDERING_CONTRACT,
} from './interactionQuestionContracts';
import {
  RIDDLE_CONTRACT,
  UNDERLINE_CONTRACT,
  WORD_SCRAMBLE_CONTRACT,
} from './languageQuestionContracts';
import { IMAGE_QUESTION_CONTRACT } from './imageQuestionContract';

const contracts = [
  MCQ_CONTRACT,
  TRUE_FALSE_CONTRACT,
  SHORT_ANSWER_CONTRACT,
  MATCHING_CONTRACT,
  MULTIPLE_SELECT_CONTRACT,
  DRAG_DROP_CONTRACT,
  ORDERING_CONTRACT,
  IMAGE_QUESTION_CONTRACT,
  DROPDOWN_CONTRACT,
  UNDERLINE_CONTRACT,
  CATEGORIZATION_CONTRACT,
  WORD_SCRAMBLE_CONTRACT,
  RIDDLE_CONTRACT,
] as const;

if (new Set(contracts.map((contract) => contract.type)).size !== contracts.length) {
  throw new Error('Registry hợp đồng câu hỏi có type bị trùng.');
}

export const AI_QUESTION_CONTRACTS = new Map<
  AiSelectableQuestionType,
  AiQuestionTypeContract<any>
>(contracts.map((contract) => [contract.type, contract]));

if (AI_QUESTION_CONTRACTS.size !== AI_SELECTABLE_QUESTION_TYPES.length) {
  throw new Error('Registry hợp đồng câu hỏi chưa phủ đủ 13 dạng AI.');
}

export const AI_QUESTION_TYPE_DESCRIPTORS = contracts.map((contract) => ({
  type: contract.type,
  label: contract.label,
  shortLabel: contract.shortLabel,
  emoji: contract.emoji,
})) as readonly {
  type: AiSelectableQuestionType;
  label: string;
  shortLabel: string;
  emoji: string;
}[];

export function getAiQuestionContract(
  type: QuestionType,
): AiQuestionTypeContract<any> {
  if (!isAiSelectableQuestionType(type)) {
    throw new Error(`Dạng câu hỏi không thuộc hợp đồng AI V3: ${type}`);
  }
  const contract = AI_QUESTION_CONTRACTS.get(type);
  if (!contract) {
    throw new Error(`Không tìm thấy hợp đồng cho dạng câu hỏi: ${type}`);
  }
  return contract;
}

export function getSelectedContractPromptFragments(
  types: readonly QuestionType[],
  context: QuestionContractContext,
): string[] {
  const uniqueTypes = [...new Set(types)];
  return uniqueTypes.map((type) => getAiQuestionContract(type).promptFragment(context));
}

export function validateGeneratedQuestionSemantics(
  question: GeneratedQuestionV3,
  slot: Parameters<AiQuestionTypeContract<any>['validateSemantics']>[1],
) {
  return getAiQuestionContract(question.type).validateSemantics(question, slot);
}

export const GENERATED_QUESTION_V3_SCHEMAS = contracts.map((contract) => contract.schema);
