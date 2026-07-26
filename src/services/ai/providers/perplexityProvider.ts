/**
 * @module perplexityProvider
 * Generates quiz JSON through the authenticated Worker AI proxy.
 */

import { SYSTEM_INSTRUCTION } from '../../../config/constants';
import type { QuizAiExecutionContext } from '../aiAction';
import { parseAndRepairJSON, validateAndFixQuiz } from '../utils/jsonRepair';
import { requestWorkerAiText } from '../workerAiClient';

export const generateWithPerplexity = async (
  promptText: string,
  _apiKey: string,
  execution?: QuizAiExecutionContext,
  systemInstruction?: string,
): Promise<unknown> => {
  const text = await requestWorkerAiText({
    model: 'sonar',
    messages: [
      { role: 'system', content: systemInstruction ?? SYSTEM_INSTRUCTION },
      { role: 'user', content: promptText },
    ],
    temperature: 0.4,
    max_tokens: 8192,
  }, execution ? {
    action: {
      ...execution.action,
      stage: execution.stage,
      ...(execution.diagnostics ?? {}),
    },
    signal: execution.signal,
  } : undefined);

  const parsed = parseAndRepairJSON(text);
  return systemInstruction ? parsed : validateAndFixQuiz(parsed);
};
