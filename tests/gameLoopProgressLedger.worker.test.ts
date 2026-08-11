// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCurrentDateKey, getCurrentWeekKey, getWeekUtcRange } from '../workers/src/gameLoop/dateKeys';
import { recordQuizActivity } from '../workers/src/gameLoop/activityService';
import { normalizeGameLoopCategory } from '../workers/src/gameLoop/normalization';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly db: DatabaseSync) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.prepare(this.sql).get(...this.bindings as any[]) as T; }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...this.bindings as any[]) as T[] }; }
  async run() { return this.db.prepare(this.sql).run(...this.bindings as any[]); }
  runSync() { return this.db.prepare(this.sql).run(...this.bindings as any[]); }
}
class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) { return new Statement(sql, this.sqlite); }
  async batch(statements: Statement[]) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.runSync());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

let sqlite: DatabaseSync;
let db: SqliteD1;
const username = 'student-a';
const studentId = 'student-a';
const classId = 'class-a';
const dateKey = getCurrentDateKey();
const weekKey = getCurrentWeekKey();
const { startIso } = getWeekUtcRange(weekKey);
const withinWeek = new Date(new Date(startIso).getTime() + 60_000).toISOString();

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      class_id TEXT
    );
    CREATE TABLE results (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      class_id TEXT,
      score REAL NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL DEFAULT 0,
      submitted_at TEXT NOT NULL
    );
    CREATE TABLE student_game_activity_events (
      activity_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE student_daily_progress (
      username TEXT NOT NULL,
      progress_date TEXT NOT NULL,
      questions_answered INTEGER NOT NULL DEFAULT 0,
      correct_answers INTEGER NOT NULL DEFAULT 0,
      quizzes_completed INTEGER NOT NULL DEFAULT 0,
      toan_quizzes_completed INTEGER NOT NULL DEFAULT 0,
      tieng_viet_quizzes_completed INTEGER NOT NULL DEFAULT 0,
      mission_questions_claimed INTEGER NOT NULL DEFAULT 0,
      mission_accuracy_claimed INTEGER NOT NULL DEFAULT 0,
      mission_subject_claimed INTEGER NOT NULL DEFAULT 0,
      chest_claimed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(username, progress_date)
    );
    CREATE TABLE student_weekly_progress (
      username TEXT NOT NULL,
      week_key TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      target INTEGER NOT NULL,
      claimed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(username, week_key, quest_id)
    );
    CREATE TABLE student_weekly_subjects (
      username TEXT NOT NULL,
      week_key TEXT NOT NULL,
      subject_key TEXT NOT NULL,
      first_result_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(username, week_key, subject_key)
    );
    CREATE TABLE student_weekly_state (
      username TEXT NOT NULL,
      week_key TEXT NOT NULL,
      current_perfect_streak INTEGER NOT NULL DEFAULT 0,
      max_perfect_streak INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(username, week_key)
    );
    INSERT INTO students(id, username, class_id) VALUES
      ('student-a', 'student-a', 'class-a'),
      ('student-b', 'student-b', 'class-a'),
      ('student-c', 'student-c', 'class-a'),
      ('student-d', 'student-d', 'class-a'),
      ('student-e', 'student-e', 'class-a'),
      ('student-f', 'student-f', 'class-a'),
      ('student-z', 'student-z', 'class-z');

    INSERT INTO results(id, student_id, class_id, score, correct_count, total_questions, submitted_at) VALUES
      ('result-1', 'student-a', 'class-a', 10, 10, 10, '${withinWeek}'),
      ('result-2', 'student-a', 'class-a', 10, 10, 10, '${withinWeek}'),
      ('result-3', 'student-a', 'class-a', 10, 10, 10, '${withinWeek}'),
      ('result-4', 'student-a', 'class-a', 5, 5, 10, '${withinWeek}'),
      ('b-1', 'student-b', 'class-a', 30, 30, 30, '${withinWeek}'),
      ('c-1', 'student-c', 'class-a', 29, 29, 30, '${withinWeek}'),
      ('d-1', 'student-d', 'class-a', 28, 28, 30, '${withinWeek}'),
      ('e-1', 'student-e', 'class-a', 27, 27, 30, '${withinWeek}'),
      ('f-1', 'student-f', 'class-a', 1, 1, 30, '${withinWeek}'),
      ('z-1', 'student-z', 'class-z', 999, 999, 999, '${withinWeek}');
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

const record = (activityId: string, category: string, correctCount: number, totalQuestions = 10) =>
  recordQuizActivity(db as any, username, {
    activityId,
    quizId: `quiz-${activityId}`,
    studentId,
    classId,
    category,
    correctCount,
    totalQuestions,
  });

describe('server-derived game-loop progress', () => {
  it('normalizes the three supported subjects', () => {
    expect(normalizeGameLoopCategory('Toán')).toBe('toan');
    expect(normalizeGameLoopCategory('Tiếng Việt')).toBe('tieng-viet');
    expect(normalizeGameLoopCategory('Tiếng Anh')).toBe('tieng-anh');
  });

  it('creates daily and weekly progress on the first saved result without opening dashboard', async () => {
    await record('result-1', 'toan', 10);

    expect(sqlite.prepare(`SELECT questions_answered, correct_answers, quizzes_completed, toan_quizzes_completed
      FROM student_daily_progress WHERE username=? AND progress_date=?`).get(username, dateKey))
      .toEqual({ questions_answered: 10, correct_answers: 10, quizzes_completed: 1, toan_quizzes_completed: 1 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_weekly_progress WHERE username=? AND week_key=?`).get(username, weekKey))
      .toEqual({ count: 5 });
    expect(sqlite.prepare(`SELECT progress FROM student_weekly_progress
      WHERE username=? AND week_key=? AND quest_id='weekly_20_quizzes'`).get(username, weekKey))
      .toEqual({ progress: 1 });
  });

  it('counts distinct subjects and preserves a three-result perfect max streak after a miss', async () => {
    await record('result-1', 'toan', 10);
    await record('result-2', 'toan', 10);
    await record('result-3', 'tieng-anh', 10);
    await record('result-4', 'tieng-viet', 5);

    expect(sqlite.prepare(`SELECT progress FROM student_weekly_progress
      WHERE username=? AND week_key=? AND quest_id='weekly_subject_master'`).get(username, weekKey))
      .toEqual({ progress: 3 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_weekly_subjects WHERE username=? AND week_key=?`).get(username, weekKey))
      .toEqual({ count: 3 });
    expect(sqlite.prepare(`SELECT current_perfect_streak, max_perfect_streak FROM student_weekly_state
      WHERE username=? AND week_key=?`).get(username, weekKey))
      .toEqual({ current_perfect_streak: 0, max_perfect_streak: 3 });
    expect(sqlite.prepare(`SELECT progress FROM student_weekly_progress
      WHERE username=? AND week_key=? AND quest_id='weekly_perfect_streak'`).get(username, weekKey))
      .toEqual({ progress: 3 });
  });

  it('uses additive upserts so concurrent different results do not lose progress', async () => {
    await Promise.all([
      record('result-1', 'toan', 10),
      record('result-4', 'tieng-viet', 5),
    ]);

    expect(sqlite.prepare(`SELECT questions_answered, correct_answers, quizzes_completed
      FROM student_daily_progress WHERE username=? AND progress_date=?`).get(username, dateKey))
      .toEqual({ questions_answered: 20, correct_answers: 15, quizzes_completed: 2 });
    expect(sqlite.prepare(`SELECT progress FROM student_weekly_progress
      WHERE username=? AND week_key=? AND quest_id='weekly_100_correct'`).get(username, weekKey))
      .toEqual({ progress: 15 });
  });

  it('is idempotent for concurrent replay of the same result activity', async () => {
    const outcomes = await Promise.all([
      record('result-1', 'toan', 10),
      record('result-1', 'toan', 10),
    ]);
    expect(outcomes.sort()).toEqual([false, true]);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_game_activity_events WHERE activity_id='result-1'`).get())
      .toEqual({ count: 1 });
    expect(sqlite.prepare(`SELECT questions_answered FROM student_daily_progress WHERE username=? AND progress_date=?`).get(username, dateKey))
      .toEqual({ questions_answered: 10 });
  });

  it('computes top five only inside the canonical class and current week', async () => {
    await record('result-1', 'toan', 10);
    expect(sqlite.prepare(`SELECT progress FROM student_weekly_progress
      WHERE username=? AND week_key=? AND quest_id='weekly_top_5'`).get(username, weekKey))
      .toEqual({ progress: 1 });
  });

  it('refreshes stale top-five progress for other students in the same class', async () => {
    sqlite.prepare(`INSERT INTO student_weekly_progress
      (username, week_key, quest_id, progress, target, claimed, created_at, updated_at)
      VALUES (?, ?, 'weekly_top_5', 1, 1, 0, ?, ?)`)
      .run('student-f', weekKey, withinWeek, withinWeek);

    await record('result-1', 'toan', 10);

    expect(sqlite.prepare(`SELECT progress FROM student_weekly_progress
      WHERE username='student-f' AND week_key=? AND quest_id='weekly_top_5'`).get(weekKey))
      .toEqual({ progress: 0 });
  });
});
