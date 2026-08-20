import type { D1Database } from '@cloudflare/workers-types';
import type { Quiz } from '../../../../src/types';
import type { LiveExamSession } from '../../../../src/types/liveExam.types';
import { mapLiveExamQuestionRow } from '../liveExamQuestionMapper';
import { LiveExamServiceError } from './errors';

const QUIZ_CACHE_TTL_MS = 5 * 60_000;
const MAX_QUIZ_CACHE_ENTRIES = 100;

interface QuizCacheEntry {
  expiresAt: number;
  promise: Promise<Quiz>;
}

const quizCacheByDb = new WeakMap<object, Map<string, QuizCacheEntry>>();
const inFlightQuizLoads = new Map<string, Promise<Quiz>>();

const getQuizCache = (db: D1Database): Map<string, QuizCacheEntry> => {
  const dbKey = db as unknown as object;
  const existing = quizCacheByDb.get(dbKey);
  if (existing) return existing;
  const created = new Map<string, QuizCacheEntry>();
  quizCacheByDb.set(dbKey, created);
  return created;
};

const pruneQuizCache = (cache: Map<string, QuizCacheEntry>, timestamp: number) => {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= timestamp) cache.delete(key);
  }
  while (cache.size >= MAX_QUIZ_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
};

const loadLiveExamQuizFromDb = async (
  db: D1Database,
  session: LiveExamSession,
): Promise<Quiz> => {
  const quizRow = await db
    .prepare('SELECT id, title, class_level, time_limit, created_at, created_by FROM quizzes WHERE id = ?')
    .bind(session.quizId)
    .first<any>();
  if (!quizRow) throw new LiveExamServiceError('Quiz not found', 404);

  const questionRows = await db.prepare(`
    SELECT id, type, question, question_rich_text, options, correct_answer, items, text_field, blanks,
           distractors, sentence, words, correct_word_indexes, image, svg_content, svg_alt, difficulty
    FROM questions
    WHERE quiz_id = ?
    ORDER BY rowid ASC
  `).bind(session.quizId).all<any>();

  return {
    id: String(quizRow.id),
    title: String(quizRow.title || session.title),
    classLevel: String(quizRow.class_level || ''),
    timeLimit: Number(quizRow.time_limit || session.duration),
    createdAt: String(quizRow.created_at || session.createdAt),
    createdBy: String(quizRow.created_by || ''),
    questions: (questionRows.results || []).map(mapLiveExamQuestionRow),
  };
};

export async function loadLiveExamQuiz(
  db: D1Database,
  session: LiveExamSession,
): Promise<Quiz> {
  const cache = getQuizCache(db);
  const timestamp = Date.now();
  const cacheKey = `${session.id}:${session.quizId}`;
  const existing = cache.get(cacheKey);
  if (existing && existing.expiresAt > timestamp) return existing.promise;
  if (existing) cache.delete(cacheKey);

  const inFlight = inFlightQuizLoads.get(cacheKey);
  if (inFlight) return inFlight;

  pruneQuizCache(cache, timestamp);
  const promise = loadLiveExamQuizFromDb(db, session);
  inFlightQuizLoads.set(cacheKey, promise);
  const entry: QuizCacheEntry = {
    expiresAt: timestamp + QUIZ_CACHE_TTL_MS,
    promise,
  };
  cache.set(cacheKey, entry);

  try {
    return await promise;
  } catch (error) {
    if (cache.get(cacheKey) === entry) cache.delete(cacheKey);
    throw error;
  } finally {
    if (inFlightQuizLoads.get(cacheKey) === promise) inFlightQuizLoads.delete(cacheKey);
  }
}
