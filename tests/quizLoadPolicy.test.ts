import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUIZ_LOAD_MAX_AGE_MS,
  isQuizCatalogFresh,
} from '../src/domain/quiz/quizLoadPolicy';

describe('quizLoadPolicy', () => {
  it('reuses a non-empty catalog inside the default window', () => {
    expect(isQuizCatalogFresh({
      hasQuizzes: true,
      loadedAt: 1_000,
      now: 1_000 + DEFAULT_QUIZ_LOAD_MAX_AGE_MS - 1,
    })).toBe(true);
  });

  it('reloads empty, never-loaded and expired catalogs', () => {
    expect(isQuizCatalogFresh({
      hasQuizzes: false,
      loadedAt: 1_000,
      now: 1_001,
    })).toBe(false);
    expect(isQuizCatalogFresh({
      hasQuizzes: true,
      loadedAt: null,
      now: 1_001,
    })).toBe(false);
    expect(isQuizCatalogFresh({
      hasQuizzes: true,
      loadedAt: 1_000,
      now: 1_000 + DEFAULT_QUIZ_LOAD_MAX_AGE_MS,
    })).toBe(false);
  });

  it('honors a caller-specific freshness window', () => {
    expect(isQuizCatalogFresh({
      hasQuizzes: true,
      loadedAt: 1_000,
      now: 1_499,
      maxAgeMs: 500,
    })).toBe(true);
    expect(isQuizCatalogFresh({
      hasQuizzes: true,
      loadedAt: 1_000,
      now: 1_500,
      maxAgeMs: 500,
    })).toBe(false);
  });
});
