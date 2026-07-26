export interface QuizLoadOptions {
  force?: boolean;
  maxAgeMs?: number;
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
