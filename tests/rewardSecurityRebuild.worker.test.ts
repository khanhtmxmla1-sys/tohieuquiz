// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCurrentWeekKey } from '../workers/src/gameLoop/dateKeys';
import { rebuildCurrentWeekProgress } from '../workers/src/gamification/rewardSecurityMaintenance';

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
const now = new Date('2026-08-11T04:00:00.000Z');
const weekKey = getCurrentWeekKey(now);

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  db = new SqliteD1(sqlite);
  sqlite.exec(`
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      class_id TEXT
    );
    CREATE TABLE quizzes (
      id TEXT PRIMARY KEY,
      category TEXT
    );
    CREATE TABLE results (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      class_id TEXT,
      quiz_id TEXT,
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

    INSERT INTO students(id, username, class_id)
    VALUES ('student-a', 'student-a', 'class-a');
    INSERT INTO quizzes(id, category) VALUES ('quiz-toan', 'toan');
    INSERT INTO results(
      id, student_id, class_id, quiz_id, score, correct_count, total_questions, submitted_at
    ) VALUES
      ('35', 'student-a', 'class-a', 'quiz-toan', 5, 10, 20, '2026-08-10T13:25:24.624Z'),
      ('36', 'student-a', 'class-a', 'quiz-toan', 6.5, 13, 20, '2026-08-10T14:25:06.505Z');

    INSERT INTO student_game_activity_events(
      activity_id, username, event_type, event_date, payload_json, created_at
    ) VALUES
      ('35', 'student-a', 'QUIZ_COMPLETED', '2026-08-10', '{"category":"class"}', '2026-08-10T13:25:27.265Z'),
      ('36', 'student-a', 'QUIZ_COMPLETED', '2026-08-10', '{"category":"toan"}', '2026-08-10T14:25:08.330Z');

    INSERT INTO student_daily_progress(
      username, progress_date, questions_answered, correct_answers, quizzes_completed,
      toan_quizzes_completed, tieng_viet_quizzes_completed,
      mission_questions_claimed, mission_accuracy_claimed, mission_subject_claimed, chest_claimed,
      created_at, updated_at
    ) VALUES (
      'student-a', '2026-08-10', 40, 23, 2, 1, 0, 1, 0, 0, 1,
      '2026-08-10T13:25:27.265Z', '2026-08-10T14:25:08.330Z'
    );

    INSERT INTO student_weekly_progress(
      username, week_key, quest_id, progress, target, claimed, created_at, updated_at
    ) VALUES
      ('student-a', '${weekKey}', 'weekly_20_quizzes', 2, 20, 0, '2026-08-10T12:00:00.000Z', '2026-08-10T14:25:08.330Z'),
      ('student-a', '${weekKey}', 'weekly_top_5', 0, 1, 1, '2026-08-10T12:00:00.000Z', '2026-08-10T12:00:00.000Z'),
      ('student-a', '${weekKey}', 'weekly_100_correct', 23, 100, 0, '2026-08-10T12:00:00.000Z', '2026-08-10T14:25:08.330Z'),
      ('student-a', '${weekKey}', 'weekly_subject_master', 0, 3, 0, '2026-08-10T12:00:00.000Z', '2026-08-10T12:00:00.000Z'),
      ('student-a', '${weekKey}', 'weekly_perfect_streak', 0, 3, 0, '2026-08-10T12:00:00.000Z', '2026-08-10T12:00:00.000Z');
  `);
});

afterEach(() => sqlite.close());

describe('current-week canonical progress rebuild', () => {
  it('recomputes stale daily and weekly progress without deleting idempotency events or claim flags', async () => {
    const first = await rebuildCurrentWeekProgress(db as any, now);
    const second = await rebuildCurrentWeekProgress(db as any, now);

    expect(first).toMatchObject({ weekKey, scanned: 2, rebuiltStudents: 1, rebuiltDays: 1 });
    expect(second).toMatchObject({ weekKey, scanned: 2, rebuiltStudents: 1, rebuiltDays: 1 });

    const daily = sqlite.prepare(`
      SELECT questions_answered, correct_answers, quizzes_completed,
             toan_quizzes_completed, tieng_viet_quizzes_completed,
             mission_questions_claimed, chest_claimed
      FROM student_daily_progress
      WHERE username = 'student-a' AND progress_date = '2026-08-10'
    `).get() as any;
    expect(daily).toMatchObject({
      questions_answered: 40,
      correct_answers: 23,
      quizzes_completed: 2,
      toan_quizzes_completed: 2,
      tieng_viet_quizzes_completed: 0,
      mission_questions_claimed: 1,
      chest_claimed: 1,
    });

    const weeklyRows = sqlite.prepare(`
      SELECT quest_id, progress, claimed
      FROM student_weekly_progress
      WHERE username = 'student-a' AND week_key = ?
      ORDER BY quest_id
    `).all(weekKey) as any[];
    const weekly = Object.fromEntries(weeklyRows.map(row => [row.quest_id, row]));
    expect(weekly.weekly_20_quizzes.progress).toBe(2);
    expect(weekly.weekly_100_correct.progress).toBe(23);
    expect(weekly.weekly_subject_master.progress).toBe(1);
    expect(weekly.weekly_perfect_streak.progress).toBe(0);
    expect(weekly.weekly_top_5.progress).toBe(1);
    expect(weekly.weekly_top_5.claimed).toBe(1);

    const subjects = sqlite.prepare(`
      SELECT subject_key, first_result_id
      FROM student_weekly_subjects
      WHERE username = 'student-a' AND week_key = ?
    `).all(weekKey) as any[];
    expect(subjects).toEqual([{ subject_key: 'toan', first_result_id: '35' }]);

    const state = sqlite.prepare(`
      SELECT current_perfect_streak, max_perfect_streak
      FROM student_weekly_state
      WHERE username = 'student-a' AND week_key = ?
    `).get(weekKey) as any;
    expect(state).toEqual({ current_perfect_streak: 0, max_perfect_streak: 0 });

    const events = sqlite.prepare(`
      SELECT activity_id, payload_json
      FROM student_game_activity_events
      ORDER BY activity_id
    `).all() as any[];
    expect(events).toEqual([
      { activity_id: '35', payload_json: '{"category":"class"}' },
      { activity_id: '36', payload_json: '{"category":"toan"}' },
    ]);
  });
});
