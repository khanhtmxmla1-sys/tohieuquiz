interface NormalizeGeneratedQuizV3Options {
  allowV2DifficultyAlias: boolean;
  expectedPromptVersion: 'ai-blueprint-v3';
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export function normalizeGeneratedQuizV3Compatibility(
  raw: unknown,
  options: NormalizeGeneratedQuizV3Options,
): unknown {
  if (!isRecord(raw)) return raw;

  const normalized: Record<string, unknown> = {
    ...raw,
    promptVersion: raw.promptVersion ?? options.expectedPromptVersion,
    blueprintVersion: raw.blueprintVersion ?? 3,
  };

  if (!Array.isArray(raw.questions)) return normalized;

  normalized.questions = raw.questions.map((question) => {
    if (!isRecord(question)) return question;

    const nextQuestion = { ...question };
    if (options.allowV2DifficultyAlias
      && nextQuestion.difficulty === undefined
      && nextQuestion.difficultyLevel !== undefined) {
      nextQuestion.difficulty = nextQuestion.difficultyLevel;
    }
    if (options.allowV2DifficultyAlias) {
      delete nextQuestion.difficultyLevel;
    }
    return nextQuestion;
  });

  return normalized;
}
