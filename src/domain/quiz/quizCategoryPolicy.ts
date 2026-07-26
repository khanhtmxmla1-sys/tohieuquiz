const ARCHIVED_QUIZ_CATEGORIES = new Set(['ioe']);

const normalizeCategory = (category: unknown): string => String(category ?? '').trim().toLowerCase();

export const isArchivedQuizCategory = (category: unknown): boolean => (
  ARCHIVED_QUIZ_CATEGORIES.has(normalizeCategory(category))
);

export const filterActiveQuizzes = <T extends { category?: unknown }>(quizzes: T[]): T[] => (
  quizzes.filter((quiz) => !isArchivedQuizCategory(quiz.category))
);
