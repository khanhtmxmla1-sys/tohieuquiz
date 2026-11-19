export interface QuizLoadOptions {
  force?: boolean;
  maxAgeMs?: number;
  /** Fetch authoring question rows; learner/public catalogs should omit them. */
  includeQuestions?: boolean;
}

export const DEFAULT_QUIZ_LOAD_MAX_AGE_MS = 30_000;

export const isQuizCatalogFresh = ({
  hasQuizzes,
  loadedAt,
  now,
  maxAgeMs = DEFAULT_QUIZ_LOAD_MAX_AGE_MS,
}: {
  hasQuizzes: boolean;
  loadedAt: number | null;
  now: number;
  maxAgeMs?: number;
}): boolean => (
  hasQuizzes
  && loadedAt !== null
  && now - loadedAt < maxAgeMs
);
