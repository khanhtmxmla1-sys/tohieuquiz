import type { z } from 'zod';
import type { SupportedSkillSubject } from '../../../shared/skillTaxonomy';
import type { AiSelectableQuestionType } from './questionTypeAvailability';

export type BlueprintDifficulty = 1 | 2 | 3;
export type BlueprintImagePolicy = 'forbidden' | 'optional' | 'required';

export interface QuestionContractContext {
  classLevel: string;
  intent: 'EXAM' | 'PRACTICE';
  sourceMode: 'TOPIC' | 'DOCUMENT';
  hasImageLibrary: boolean;
}

export interface QuestionContractSlot {
  slotId: string;
  ordinal: number;
  type: AiSelectableQuestionType;
  difficulty: BlueprintDifficulty;
  objective: string;
  subject?: SupportedSkillSubject;
  skillCode?: string;
  subskillCode?: string;
  imagePolicy: BlueprintImagePolicy;
}

export interface QuestionContractIssue {
  code: string;
  path: Array<string | number>;
  message: string;
  repairable: boolean;
}

export interface GeneratedQuestionCommonV3 {
  slotId: string;
  difficulty: BlueprintDifficulty;
  explanation: string;
  subject?: SupportedSkillSubject;
  skillCode?: string;
  subskillCode?: string;
}

export type GeneratedQuestionV3 = GeneratedQuestionCommonV3 & {
  type: AiSelectableQuestionType;
} & Record<string, unknown>;

export interface GeneratedQuizV3 {
  promptVersion: 'ai-blueprint-v3';
  blueprintVersion: 3;
  title: string;
  detectedCategory?: string;
  detectedLesson?: string;
  suggestedTags?: string[];
  timeLimit?: number;
  questions: GeneratedQuestionV3[];
}

export interface AiQuestionTypeContract<TQuestion> {
  type: AiSelectableQuestionType;
  label: string;
  shortLabel: string;
  emoji: string;
  availability: 'aiSelectable';
  requiresPrimaryImage: boolean;
  schema: z.ZodType<TQuestion>;
  promptFragment(context: QuestionContractContext): string;
  validateSemantics(
    question: TQuestion,
    slot: QuestionContractSlot,
  ): QuestionContractIssue[];
  validFixture: TQuestion;
}
