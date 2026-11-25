import type { QuestionType } from '../../types';
import type { QuizBlueprint, QuizBlueprintV3 } from '../../features/quiz-generator/domain/quizBlueprint';
import type { DiagramGenerationMode } from './question-contracts/questionContract.types';

export type AIProvider =
  | 'gemini'
  | 'perplexity'
  | 'openai'
  | 'llm-mux'
  | 'localhost'
  | 'native-ocr'
  | 'gemini-personal'
  | 'deepseek-personal';

export type LearnerPromptMode = 'default' | 'gifted' | 'remedial';
export type QuizGenerationStep = 'generating' | 'reviewing' | 'repairing' | 'completed';

export interface PromptProfileOptions {
  useThongTu27: boolean;
  learnerMode: LearnerPromptMode;
}

export interface QuizGenerationOptions {
  title: string;
  blueprint?: QuizBlueprint;
  blueprintV3?: QuizBlueprintV3;
  promptVersion?: 'ai-blueprint-v3';
  questionCount: number;
  questionTypes: QuestionType[];
  difficultyLevels?: { level1: number; level2: number; level3: number };
  promptProfile?: PromptProfileOptions;
  imageLibrary?: Array<{ id: string; name: string; data?: string }>;
  customPrompt?: string;
  isPdfMode?: boolean;
  diagramMode?: DiagramGenerationMode;
}
