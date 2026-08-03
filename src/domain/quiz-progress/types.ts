export type QuestionProgressState = 'empty' | 'partial' | 'complete';

export interface QuestionProgressResult {
  state: QuestionProgressState;
  hasInteraction: boolean;
  completedParts: number;
  requiredParts: number;
}

export type ProgressQuestionType =
  | 'MCQ'
  | 'IMAGE_QUESTION'
  | 'MULTIPLE_SELECT'
  | 'SHORT_ANSWER'
  | 'TRUE_FALSE'
  | 'MATCHING'
  | 'DRAG_DROP'
  | 'DROPDOWN'
  | 'ORDERING'
  | 'CATEGORIZATION'
  | 'UNDERLINE'
  | 'WORD_SCRAMBLE'
  | 'RIDDLE'
  | 'ERROR_CORRECTION'
  | 'MATH_INPUT'
  | 'GEOMETRY'
  | 'UNKNOWN';
