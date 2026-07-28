import type {
  AiQuestionQualityInput,
  AiQuestionQualitySummary,
} from '../../../shared/ai-question-quality.contract';
import { evaluateAiQuestionQuality } from '../../../shared/ai-question-quality';

export const inspectAiQuestionQuality = (
  input: AiQuestionQualityInput,
): AiQuestionQualitySummary => evaluateAiQuestionQuality(input);
