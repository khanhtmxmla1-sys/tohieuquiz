// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrReuseQuizSnapshot } from '../workers/src/competition/quizSnapshotService';
import {
  finalizeCompetitionRound,
  listCompetitionRounds,
  rebuildRoundProgress,
  startRoundAttempt,
  submitRoundAttempt,
  updateCompetitionRound,
  upsertCompetitionRoundQuiz,
  voidRoundAttempt,
} from '../workers/src/competition/roundService';
import { createSqliteD1 } from './helpers/sqliteD1';

const migration = readFileSync(
  new URL('../workers/migrations/0069_competition_core.sql', import.meta.url),
  'utf8',
);

let sqlite: DatabaseSync;
let d1: D1Database;

function createBaseSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE teachers (
      username TEXT PRIMARY KEY
    );

    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher_username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      class_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      class_level TEXT,
      category TEXT,
      time_limit INTEGER,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      tags TEXT,
      source_type TEXT,
      parent_quiz_id TEXT,
      version_number INTEGER,
      revision INTEGER,
      updated_at TEXT
    );

    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      type TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT,
      items TEXT,
      text_field TEXT,
      blanks TEXT,
      distractors TEXT,
      sentence TEXT,
      words TEXT,
      correct_word_indexes TEXT,
      image TEXT,
      svg_content TEXT,
      svg_alt TEXT,
      difficulty TEXT,
      answer_schema_version INTEGER
    );

    CREATE TABLE results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      assignment_id TEXT,
      class_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      quiz_id TEXT NOT NULL,
      quiz_title TEXT NOT NULL,
      score REAL NOT NULL,
      correct_count INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      time_taken INTEGER NOT NULL,
      submitted_at TEXT NOT NULL,
      answers TEXT NOT NULL,
      grading_version TEXT
    );

    CREATE TABLE admin_audit_logs (
      id TEXT PRIMARY KEY,
      actor_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL
    );

    INSERT INTO teachers (username) VALUES ('admin'), ('teacher-4'), ('teacher-5');
    INSERT INTO classes (id, name, teacher_username, created_at) VALUES
      ('class-4a', '4A', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-4b', '4B', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-5a', '5A', 'teacher-5', '2026-08-01T00:00:00.000Z');

    INSERT INTO students (id, full_name, username, password_hash, class_id, created_at) VALUES
      ('student-1', 'An', 'student1', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z'),
      ('student-2', 'Binh', 'student2', 'hash', 'class-4b', '2026-08-01T00:00:00.000Z'),
      ('student-3', 'Chi', 'student3', 'hash', 'class-5a', '2026-08-01T00:00:00.000Z');

    INSERT INTO quizzes (
      id, title, class_level, category, time_limit, created_at, created_by,
      tags, source_type, version_number, revision, updated_at
    ) VALUES
      ('quiz-grade', 'Đề khối 4', '4', 'Tiếng Việt', 30, '2026-08-01T00:00:00.000Z', 'admin', '[]', 'manual', 1, 1, '2026-08-01T00:00:00.000Z'),
      ('quiz-class', 'Đề lớp 4A', '4', 'Tiếng Việt', 30, '2026-08-01T00:00:00.000Z', 'admin', '[]', 'manual', 1, 1, '2026-08-01T00:00:00.000Z');

    INSERT INTO questions (id, quiz_id, type, question, options, correct_answer) VALUES
      ('q-grade-1', 'quiz-grade', 'MCQ', 'Câu 1', 'A|B', 'A'),
      ('q-grade-2', 'quiz-grade', 'MCQ', 'Câu 2', 'A|B', 'A'),
      ('q-class-1', 'quiz-class', 'MCQ', 'Câu riêng 4A', 'A|B', 'B');
  `);
}

async function seedCompetition(options: { maxAttempts?: number; passingScore?: number } = {}): Promise<void> {
  sqlite.exec(migration);
  const gradeSnapshot = await createOrReuseQuizSnapshot(d1, 'quiz-grade');
  const classSnapshot = await createOrReuseQuizSnapshot(d1, 'quiz-class');
  const maxAttempts = options.maxAttempts ?? 3;
  const passingScore = options.passingScore ?? 7;

  sqlite.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json,
      audience_snapshot_id, eligibility_policy_json, starts_at, ends_at,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'campaign-1', 'Competition 2026-2027', '2026-2027', 'Asia/Ho_Chi_Minh', 'ACTIVE',
    '{"gradeLevels":[4]}', 'audience-1', '{"requiredRounds":6,"requiredPassedRounds":6}',
    '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
    'admin', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z',
  );
  sqlite.prepare(`
    INSERT INTO competition_audience_snapshots (
      id, campaign_id, version, status, member_count, snapshot_hash, created_at, locked_at, created_by
    ) VALUES (?, ?, 1, 'BUILDING', 0, '', ?, NULL, ?)
  `).run(
    'audience-1', 'campaign-1', '2026-08-20T00:00:00.000Z', 'admin',
  );
  sqlite.prepare(`
    INSERT INTO competition_audience_members (
      audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot, student_status_at_snapshot
    ) VALUES (?, ?, ?, ?, ?)
  `).run('audience-1', 'student-1', 4, 'class-4a', 'ACTIVE');
  sqlite.prepare(`
    INSERT INTO competition_audience_members (
      audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot, student_status_at_snapshot
    ) VALUES (?, ?, ?, ?, ?)
  `).run('audience-1', 'student-2', 4, 'class-4b', 'ACTIVE');
  sqlite.prepare(`
    UPDATE competition_audience_snapshots
    SET status = 'LOCKED', member_count = 2, snapshot_hash = ?, locked_at = ?
    WHERE id = 'audience-1' AND status = 'BUILDING'
  `).run('a'.repeat(64), '2026-08-20T00:00:00.000Z');

  sqlite.prepare(`
    INSERT INTO competition_rounds (
      id, campaign_id, round_number, opens_at, closes_at, max_attempts,
      passing_rule_type, passing_score, status, created_at
    ) VALUES (?, ?, 1, ?, ?, ?, 'MIN_SCORE', ?, 'SCHEDULED', ?)
  `).run(
    'round-1', 'campaign-1',
    '2026-09-10T00:00:00.000Z', '2026-09-11T00:00:00.000Z',
    maxAttempts, passingScore, '2026-08-20T00:00:00.000Z',
  );

  sqlite.prepare(`
    INSERT INTO competition_round_quizzes (
      id, round_id, grade_level, class_id, quiz_id, quiz_snapshot_id, quiz_snapshot_hash, locked_at
    ) VALUES (?, ?, 4, NULL, ?, ?, ?, ?)
  `).run(
    'round-quiz-grade', 'round-1', 'quiz-grade', gradeSnapshot.id, gradeSnapshot.sha256,
    '2026-08-20T00:00:00.000Z',
  );
  sqlite.prepare(`
    INSERT INTO competition_round_quizzes (
      id, round_id, grade_level, class_id, quiz_id, quiz_snapshot_id, quiz_snapshot_hash, locked_at
    ) VALUES (?, ?, 4, 'class-4a', ?, ?, ?, ?)
  `).run(
    'round-quiz-class', 'round-1', 'quiz-class', classSnapshot.id, classSnapshot.sha256,
    '2026-08-20T00:00:00.000Z',
  );
}

function setNow(value: string): void {
  vi.setSystemTime(new Date(value));
}

beforeEach(() => {
  vi.useFakeTimers();
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  d1 = createSqliteD1(sqlite);
});

afterEach(() => {
  vi.useRealTimers();
  sqlite.close();
});

describe('Competition V1 round engine', () => {
  it('enforces opensAt <= serverNow < closesAt at exact boundaries', async () => {
    await seedCompetition();

    setNow('2026-09-09T23:59:59.999Z');
    await expect(startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-1', requestId: 'start-before-0001',
    })).rejects.toThrow('COMPETITION_ROUND_NOT_OPEN');

    setNow('2026-09-10T00:00:00.000Z');
    await expect(startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-1', requestId: 'start-exact-open-0001',
    })).resolves.toMatchObject({ attemptNo: 1, status: 'STARTED' });

    setNow('2026-09-11T00:00:00.000Z');
    await expect(startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'start-exact-close-0001',
    })).rejects.toThrow('COMPETITION_ROUND_NOT_OPEN');
  });

  it('does not reopen an explicitly CLOSED round even when server time is inside the window', async () => {
    await seedCompetition();
    setNow('2026-09-10T12:00:00.000Z');
    sqlite.prepare("UPDATE competition_rounds SET status = 'CLOSED' WHERE id = 'round-1'").run();

    await expect(startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-1', requestId: 'closed-round-start-0001',
    })).rejects.toThrow('COMPETITION_ROUND_NOT_OPEN');
  });

  it('rejects students outside the frozen audience and enforces maxAttempts', async () => {
    await seedCompetition({ maxAttempts: 1 });
    setNow('2026-09-10T12:00:00.000Z');

    await expect(startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-3', requestId: 'outside-audience-0001',
    })).rejects.toThrow('COMPETITION_STUDENT_NOT_IN_AUDIENCE');

    await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'attempt-limit-first-0001',
    });
    await expect(startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'attempt-limit-second-0001',
    })).rejects.toThrow('COMPETITION_MAX_ATTEMPTS_REACHED');
  });

  it('resolves a class-specific RoundQuiz before the grade-level fallback', async () => {
    await seedCompetition();
    setNow('2026-09-10T12:00:00.000Z');

    const classSpecific = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-1', requestId: 'class-override-0001',
    });
    const gradeFallback = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'grade-fallback-0001',
    });

    expect(classSpecific.quizId).toBe('quiz-class');
    expect(gradeFallback.quizId).toBe('quiz-grade');
  });

  it('expires a STARTED attempt instead of scoring at exactly closesAt', async () => {
    await seedCompetition();
    setNow('2026-09-10T12:00:00.000Z');
    const attempt = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'expiry-start-0001',
    });

    setNow('2026-09-11T00:00:00.000Z');
    await expect(submitRoundAttempt(d1, {
      attemptId: attempt.id,
      studentId: 'student-2',
      answers: { 'q-grade-1': 'A', 'q-grade-2': 'A' },
      timeTaken: 30,
      requestId: 'expiry-submit-0001',
    })).rejects.toThrow('COMPETITION_ATTEMPT_EXPIRED');

    expect(sqlite.prepare('SELECT status, result_id FROM competition_round_attempts WHERE id = ?').get(attempt.id))
      .toMatchObject({ status: 'EXPIRED', result_id: null });
    expect((sqlite.prepare('SELECT COUNT(*) AS count FROM results').get() as { count: number }).count).toBe(0);
  });

  it('grades from the immutable snapshot and persists a normal result with assignment_id NULL', async () => {
    await seedCompetition();
    setNow('2026-09-10T12:00:00.000Z');
    const attempt = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-1', requestId: 'immutable-start-0001',
    });

    sqlite.prepare("UPDATE questions SET correct_answer = 'A' WHERE id = 'q-class-1'").run();
    const submitted = await submitRoundAttempt(d1, {
      attemptId: attempt.id,
      studentId: 'student-1',
      answers: { 'q-class-1': 'B' },
      timeTaken: 45,
      requestId: 'immutable-submit-0001',
    });

    expect(submitted).toMatchObject({ score: 10, correctCount: 1, totalQuestions: 1, status: 'SCORED' });
    const row = sqlite.prepare(`
      SELECT assignment_id, student_id, class_id, quiz_id, score, correct_count, total_questions
      FROM results WHERE id = ?
    `).get(submitted.resultId) as Record<string, unknown>;
    expect(row).toMatchObject({
      assignment_id: null,
      student_id: 'student-1',
      class_id: 'class-4a',
      quiz_id: 'quiz-class',
      score: 10,
      correct_count: 1,
      total_questions: 1,
    });
  });

  it('makes attempt start and submit idempotent without creating duplicate attempts/results', async () => {
    await seedCompetition();
    setNow('2026-09-10T12:00:00.000Z');
    const input = {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'same-start-request-0001',
    };
    const firstStart = await startRoundAttempt(d1, input);
    const secondStart = await startRoundAttempt(d1, input);
    expect(secondStart.id).toBe(firstStart.id);

    const submitInput = {
      attemptId: firstStart.id,
      studentId: 'student-2',
      answers: { 'q-grade-1': 'A', 'q-grade-2': 'A' },
      timeTaken: 30,
      requestId: 'same-submit-request-0001',
    };
    const firstSubmit = await submitRoundAttempt(d1, submitInput);
    const secondSubmit = await submitRoundAttempt(d1, submitInput);
    expect(secondSubmit.resultId).toBe(firstSubmit.resultId);
    expect(secondSubmit.progress.version).toBe(firstSubmit.progress.version);

    expect((sqlite.prepare('SELECT COUNT(*) AS count FROM competition_round_attempts').get() as { count: number }).count).toBe(1);
    expect((sqlite.prepare('SELECT COUNT(*) AS count FROM results').get() as { count: number }).count).toBe(1);
  });

  it('rebuilds progress from valid SCORED attempts and keeps the highest score, not the latest', async () => {
    await seedCompetition({ maxAttempts: 3, passingScore: 7 });
    setNow('2026-09-10T12:00:00.000Z');

    const attempt1 = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'best-score-start-0001',
    });
    await submitRoundAttempt(d1, {
      attemptId: attempt1.id, studentId: 'student-2',
      answers: { 'q-grade-1': 'A', 'q-grade-2': 'B' }, timeTaken: 60, requestId: 'best-score-submit-0001',
    });

    const attempt2 = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'best-score-start-0002',
    });
    await submitRoundAttempt(d1, {
      attemptId: attempt2.id, studentId: 'student-2',
      answers: { 'q-grade-1': 'A', 'q-grade-2': 'A' }, timeTaken: 55, requestId: 'best-score-submit-0002',
    });

    const attempt3 = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'best-score-start-0003',
    });
    await submitRoundAttempt(d1, {
      attemptId: attempt3.id, studentId: 'student-2',
      answers: { 'q-grade-1': 'B', 'q-grade-2': 'B' }, timeTaken: 40, requestId: 'best-score-submit-0003',
    });

    const progress = await rebuildRoundProgress(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2',
    });
    expect(progress).toMatchObject({
      attemptsUsed: 3,
      bestAttemptId: attempt2.id,
      bestScore: 10,
      isPassed: true,
    });
  });

  it('allows only Admin to VOID with a reason and rebuilds progress without the voided best attempt', async () => {
    await seedCompetition({ maxAttempts: 2, passingScore: 7 });
    setNow('2026-09-10T12:00:00.000Z');

    const low = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'void-start-low-0001',
    });
    await submitRoundAttempt(d1, {
      attemptId: low.id, studentId: 'student-2',
      answers: { 'q-grade-1': 'A', 'q-grade-2': 'B' }, timeTaken: 70, requestId: 'void-submit-low-0001',
    });
    const high = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'void-start-high-0001',
    });
    await submitRoundAttempt(d1, {
      attemptId: high.id, studentId: 'student-2',
      answers: { 'q-grade-1': 'A', 'q-grade-2': 'A' }, timeTaken: 50, requestId: 'void-submit-high-0001',
    });

    await expect(voidRoundAttempt(d1, {
      attemptId: high.id,
      actorUsername: 'teacher-4',
      actorRole: 'teacher',
      reason: 'Không đủ quyền',
      requestId: 'void-teacher-denied-0001',
    })).rejects.toThrow('COMPETITION_ADMIN_REQUIRED');
    await expect(voidRoundAttempt(d1, {
      attemptId: high.id,
      actorUsername: 'admin',
      actorRole: 'admin',
      reason: '   ',
      requestId: 'void-reason-required-0001',
    })).rejects.toThrow('COMPETITION_VOID_REASON_REQUIRED');

    const progress = await voidRoundAttempt(d1, {
      attemptId: high.id,
      actorUsername: 'admin',
      actorRole: 'admin',
      reason: 'Bài làm bị xác định không hợp lệ',
      requestId: 'void-admin-approved-0001',
    });
    expect(progress).toMatchObject({ bestAttemptId: low.id, bestScore: 5, isPassed: false });
    const retryProgress = await voidRoundAttempt(d1, {
      attemptId: high.id,
      actorUsername: 'admin',
      actorRole: 'admin',
      reason: 'Bài làm bị xác định không hợp lệ',
      requestId: 'void-admin-approved-0001',
    });
    expect(retryProgress.version).toBe(progress.version);
    expect((sqlite.prepare("SELECT COUNT(*) AS count FROM admin_audit_logs WHERE action = 'ROUND_ATTEMPT_VOIDED'").get() as { count: number }).count).toBe(1);
    expect(sqlite.prepare('SELECT status, voided_by, void_reason FROM competition_round_attempts WHERE id = ?').get(high.id))
      .toMatchObject({ status: 'VOID', voided_by: 'admin', void_reason: 'Bài làm bị xác định không hợp lệ' });
  });

  it('configures/list rounds and finalizes only CLOSED rounds with intact quiz snapshots', async () => {
    await seedCompetition();
    setNow('2026-09-09T12:00:00.000Z');

    const configured = await updateCompetitionRound(d1, 'campaign-1', 'round-1', {
      campaignId: 'campaign-1',
      roundId: 'round-1',
      roundNumber: 1,
      opensAt: '2026-09-10T00:00:00.000Z',
      closesAt: '2026-09-11T00:00:00.000Z',
      maxAttempts: 2,
      passingRuleType: 'MIN_SCORE',
      passingScore: 7,
      requestId: 'round-config-update-0001',
    }, 'admin');
    expect(configured).toMatchObject({ id: 'round-1', roundNumber: 1, maxAttempts: 2 });
    expect(await listCompetitionRounds(d1, 'campaign-1')).toHaveLength(1);

    setNow('2026-09-10T00:00:00.000Z');
    await expect(updateCompetitionRound(d1, 'campaign-1', 'round-1', {
      ...{
        campaignId: 'campaign-1',
        roundId: 'round-1',
        roundNumber: 1,
        opensAt: '2026-09-10T00:00:00.000Z',
        closesAt: '2026-09-11T00:00:00.000Z',
        maxAttempts: 3,
        passingRuleType: 'MIN_SCORE' as const,
        passingScore: 8,
        requestId: 'round-config-locked-0001',
      },
    }, 'admin')).rejects.toThrow('COMPETITION_ROUND_CONFIG_LOCKED');

    await expect(finalizeCompetitionRound(
      d1, 'campaign-1', 'round-1', 'admin', 'round-finalize-too-early-0001',
    )).rejects.toThrow('COMPETITION_ROUND_NOT_CLOSED');
    const abandoned = await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'round-finalize-abandoned-0001',
    });

    setNow('2026-09-11T00:00:00.000Z');
    const finalized = await finalizeCompetitionRound(
      d1, 'campaign-1', 'round-1', 'admin', 'round-finalize-ok-0001',
    );
    expect(finalized.status).toBe('FINALIZED');
    expect(finalized.finalizedAt).toEqual(expect.any(String));
    expect(sqlite.prepare('SELECT status FROM competition_round_attempts WHERE id = ?').get(abandoned.id))
      .toMatchObject({ status: 'EXPIRED' });
  });

  it('recovers an OPEN round with no quiz or attempts by rescheduling it before quiz assignment', async () => {
    await seedCompetition();
    sqlite.prepare("DELETE FROM competition_round_quizzes WHERE round_id = 'round-1'").run();
    setNow('2026-09-10T12:00:00.000Z');

    const recovered = await updateCompetitionRound(d1, 'campaign-1', 'round-1', {
      campaignId: 'campaign-1',
      roundId: 'round-1',
      roundNumber: 1,
      opensAt: '2026-09-12T00:00:00.000Z',
      closesAt: '2026-09-13T00:00:00.000Z',
      maxAttempts: 3,
      passingRuleType: 'MIN_SCORE',
      passingScore: 7,
      requestId: 'round-recovery-empty-open-0001',
    }, 'admin');

    expect(recovered).toMatchObject({ id: 'round-1', status: 'SCHEDULED' });
    expect(sqlite.prepare("SELECT status, opens_at FROM competition_rounds WHERE id = 'round-1'").get())
      .toMatchObject({ status: 'SCHEDULED', opens_at: '2026-09-12T00:00:00.000Z' });

    await expect(upsertCompetitionRoundQuiz(d1, 'campaign-1', 'round-1', {
      campaignId: 'campaign-1',
      roundId: 'round-1',
      gradeLevel: 4,
      quizId: 'quiz-grade',
      requestId: 'round-recovery-map-0001',
    }, 'admin')).resolves.toMatchObject({ roundId: 'round-1', quizId: 'quiz-grade' });
  });

  it('keeps an OPEN round locked when its replacement opening time is not in the future', async () => {
    await seedCompetition();
    sqlite.prepare("DELETE FROM competition_round_quizzes WHERE round_id = 'round-1'").run();
    setNow('2026-09-10T12:00:00.000Z');

    await expect(updateCompetitionRound(d1, 'campaign-1', 'round-1', {
      campaignId: 'campaign-1',
      roundId: 'round-1',
      roundNumber: 1,
      opensAt: '2026-09-10T12:00:00.000Z',
      closesAt: '2026-09-13T00:00:00.000Z',
      maxAttempts: 3,
      passingRuleType: 'MIN_SCORE',
      passingScore: 7,
      requestId: 'round-recovery-not-future-0001',
    }, 'admin')).rejects.toThrow('COMPETITION_ROUND_CONFIG_LOCKED');
  });

  it('keeps an OPEN round locked when an attempt exists even after its quiz mapping is missing', async () => {
    await seedCompetition();
    setNow('2026-09-10T12:00:00.000Z');
    await startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-2', requestId: 'round-recovery-attempt-0001',
    });
    sqlite.prepare("DELETE FROM competition_round_quizzes WHERE round_id = 'round-1'").run();

    await expect(updateCompetitionRound(d1, 'campaign-1', 'round-1', {
      campaignId: 'campaign-1',
      roundId: 'round-1',
      roundNumber: 1,
      opensAt: '2026-09-12T00:00:00.000Z',
      closesAt: '2026-09-13T00:00:00.000Z',
      maxAttempts: 3,
      passingRuleType: 'MIN_SCORE',
      passingScore: 7,
      requestId: 'round-recovery-attempt-blocked-0001',
    }, 'admin')).rejects.toThrow('COMPETITION_ROUND_CONFIG_LOCKED');
  });
});
