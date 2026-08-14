export interface RandomizationPolicy {
  enabled: boolean;
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  shuffleMatching: boolean;
  shuffleOrdering: boolean;
  shuffleDragDrop: boolean;
  randomizePracticeSelection: boolean;
}

export const DEFAULT_RANDOMIZATION_POLICY: Readonly<RandomizationPolicy> = Object.freeze({
  enabled: true,
  shuffleQuestions: true,
  shuffleChoices: false,
  shuffleMatching: true,
  shuffleOrdering: true,
  shuffleDragDrop: true,
  randomizePracticeSelection: true,
});

export const RANDOMIZATION_SETTING_KEY_BY_FIELD: Readonly<Record<keyof RandomizationPolicy, string>> = Object.freeze({
  enabled: 'quiz_randomization_enabled',
  shuffleQuestions: 'quiz_shuffle_questions',
  shuffleChoices: 'quiz_shuffle_choices',
  shuffleMatching: 'quiz_shuffle_matching',
  shuffleOrdering: 'quiz_shuffle_ordering',
  shuffleDragDrop: 'quiz_shuffle_drag_drop',
  randomizePracticeSelection: 'quiz_randomize_practice_selection',
});

export const RANDOMIZATION_FIELDS = Object.freeze(
  Object.keys(RANDOMIZATION_SETTING_KEY_BY_FIELD) as Array<keyof RandomizationPolicy>,
);

const booleanOrFallback = (value: unknown, fallback: boolean): boolean => (
  typeof value === 'boolean' ? value : fallback
);

export const normalizeRandomizationPolicy = (
  input?: Partial<Record<keyof RandomizationPolicy, unknown>> | null,
): RandomizationPolicy => ({
  enabled: booleanOrFallback(input?.enabled, DEFAULT_RANDOMIZATION_POLICY.enabled),
  shuffleQuestions: booleanOrFallback(input?.shuffleQuestions, DEFAULT_RANDOMIZATION_POLICY.shuffleQuestions),
  shuffleChoices: booleanOrFallback(input?.shuffleChoices, DEFAULT_RANDOMIZATION_POLICY.shuffleChoices),
  shuffleMatching: booleanOrFallback(input?.shuffleMatching, DEFAULT_RANDOMIZATION_POLICY.shuffleMatching),
  shuffleOrdering: booleanOrFallback(input?.shuffleOrdering, DEFAULT_RANDOMIZATION_POLICY.shuffleOrdering),
  shuffleDragDrop: booleanOrFallback(input?.shuffleDragDrop, DEFAULT_RANDOMIZATION_POLICY.shuffleDragDrop),
  randomizePracticeSelection: booleanOrFallback(
    input?.randomizePracticeSelection,
    DEFAULT_RANDOMIZATION_POLICY.randomizePracticeSelection,
  ),
});

export const resolveEffectiveRandomizationPolicy = (
  input?: Partial<Record<keyof RandomizationPolicy, unknown>> | null,
): RandomizationPolicy => {
  const normalized = normalizeRandomizationPolicy(input);
  if (normalized.enabled) return normalized;
  return {
    ...normalized,
    shuffleQuestions: false,
    shuffleChoices: false,
    shuffleMatching: false,
    shuffleOrdering: false,
    shuffleDragDrop: false,
    randomizePracticeSelection: false,
  };
};
