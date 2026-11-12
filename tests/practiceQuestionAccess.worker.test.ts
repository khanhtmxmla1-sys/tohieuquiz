// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { handlePracticeRoutes } from '../workers/src/routes/practice';
import { PUBLIC_PRACTICE_SOURCE_SCOPE_SQL } from '../workers/src/services/practiceQuestionScope';

type SqliteStatement = {
  all: (...values: unknown[]) => Record<string, unknown>[];
};

class SqliteD1 {
  constructor(private readonly sqlite: DatabaseSync) {}

  prepare(sql: string) {
    const statement = this.sqlite.prepare(sql) as unknown as SqliteStatement;
    const wrapper = {
      all: async <T>() => ({ results: statement.all() as T[] }),
      bind: (...values: unknown[]) => ({
        all: async <T>() => ({ results: statement.all(...values) as T[] }),
      }),
    };
    return wrapper;
  }
}

const createFixture = () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      class_level TEXT NOT NULL DEFAULT '',
      require_code TEXT DEFAULT 'FALSE',
      show_on_home TEXT DEFAULT 'TRUE',
      source_type TEXT NOT NULL DEFAULT 'manual'
    );
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      type TEXT NOT NULL,
      question TEXT DEFAULT '',
      question_rich_text TEXT DEFAULT '',
      options TEXT DEFAULT '',
      correct_answer TEXT DEFAULT '',
      items TEXT DEFAULT '',
      text_field TEXT DEFAULT '',
      blanks TEXT DEFAULT '',
      distractors TEXT DEFAULT '',
      sentence TEXT DEFAULT '',
      words TEXT DEFAULT '',
      correct_word_indexes TEXT DEFAULT '',
      image TEXT DEFAULT '',
      svg_content TEXT DEFAULT '',
      svg_alt TEXT DEFAULT '',
      tags TEXT DEFAULT ''
    );
    CREATE TABLE assignments (id TEXT PRIMARY KEY, quiz_id TEXT);
    CREATE TABLE live_exam_sessions (id TEXT PRIMARY KEY, quiz_id TEXT, status TEXT NOT NULL);
    CREATE TABLE competition_round_quizzes (id TEXT PRIMARY KEY, quiz_id TEXT);
    CREATE TABLE competition_quiz_snapshots (id TEXT PRIMARY KEY, quiz_id TEXT);
    CREATE TABLE competition_school_exam_events (id TEXT PRIMARY KEY, status TEXT NOT NULL);
    CREATE TABLE competition_school_exam_rooms (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, quiz_id TEXT, status TEXT NOT NULL);
    CREATE TABLE system_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL);
    CREATE INDEX idx_questions_quiz_id ON questions(quiz_id);
    CREATE INDEX idx_assignments_quiz_id ON assignments(quiz_id);
    CREATE INDEX idx_competition_quiz_snapshots_quiz_created ON competition_quiz_snapshots(quiz_id);
    INSERT INTO system_settings VALUES ('quiz_randomize_practice_selection', 'false');

    INSERT INTO quizzes VALUES
      ('public-open', 'Public open', '', 'FALSE', 'TRUE', 'manual'),
      ('public-code', 'Code protected', '', 'TRUE', 'TRUE', 'manual'),
      ('hidden', 'Hidden', '', 'FALSE', 'FALSE', 'manual'),
      ('assigned', 'Assigned', '', 'FALSE', 'TRUE', 'manual'),
      ('live', 'Live', '', 'FALSE', 'TRUE', 'manual'),
      ('competition', 'Competition', '', 'FALSE', 'TRUE', 'manual'),
      ('school-room', 'School exam room', '', 'FALSE', 'TRUE', 'manual'),
      ('snapshot-only', 'Competition snapshot', '', 'FALSE', 'TRUE', 'manual'),
      ('padded-code', 'Padded code flag', '', ' TRUE ', 'TRUE', 'manual'),
      ('unknown-code', 'Unknown code flag', '', 'MAYBE', 'TRUE', 'manual');

    INSERT INTO questions (id, quiz_id, type, question, options, correct_answer, tags) VALUES
      ('q-public-toan', 'public-open', 'MCQ', 'public Toan', 'A|B', 'A', '#Toan'),
      ('q-public-vietnamese', 'public-open', 'MCQ', 'public Vietnamese', 'A|B', 'A', '#Tiếng_Việt'),
      ('q-public-prefix', 'public-open', 'MCQ', 'public prefix', 'A|B', 'A', '#ToanExtra'),
      ('q-code', 'public-code', 'MCQ', 'protected code', 'A|B', 'SECRET-CODE', '#Toan'),
      ('q-hidden', 'hidden', 'MCQ', 'protected hidden', 'A|B', 'SECRET-HIDDEN', '#Toan'),
      ('q-assigned', 'assigned', 'MCQ', 'protected assigned', 'A|B', 'SECRET-ASSIGNED', '#Toan'),
      ('q-live', 'live', 'MCQ', 'protected live', 'A|B', 'SECRET-LIVE', '#Toan'),
      ('q-competition', 'competition', 'MCQ', 'protected competition', 'A|B', 'SECRET-COMPETITION', '#Toan'),
      ('q-school', 'school-room', 'MCQ', 'protected school exam', 'A|B', 'SECRET-SCHOOL', '#Toan'),
      ('q-snapshot', 'snapshot-only', 'MCQ', 'protected snapshot', 'A|B', 'SECRET-SNAPSHOT', '#Toan'),
      ('q-padded-code', 'padded-code', 'MCQ', 'protected padded code', 'A|B', 'SECRET-PADDED', '#Toan'),
      ('q-unknown-code', 'unknown-code', 'MCQ', 'protected unknown code', 'A|B', 'SECRET-UNKNOWN', '#Toan');

    INSERT INTO assignments VALUES ('assignment-1', 'assigned');
    INSERT INTO assignments VALUES ('assignment-duplicate', 'assigned');
    INSERT INTO assignments VALUES ('assignment-null', NULL);
    INSERT INTO live_exam_sessions VALUES ('live-1', 'live', 'scheduled');
    INSERT INTO live_exam_sessions VALUES ('live-null', NULL, 'scheduled');
    INSERT INTO competition_round_quizzes VALUES ('round-quiz-1', 'competition');
    INSERT INTO competition_round_quizzes VALUES ('round-quiz-null', NULL);
    INSERT INTO competition_quiz_snapshots VALUES ('snapshot-1', 'snapshot-only');
    INSERT INTO competition_quiz_snapshots VALUES ('snapshot-null', NULL);
    INSERT INTO competition_school_exam_events VALUES ('event-1', 'READY');
    INSERT INTO competition_school_exam_rooms VALUES ('room-1', 'event-1', 'school-room', 'READY');
    INSERT INTO competition_school_exam_rooms VALUES ('room-null', 'event-1', NULL, 'READY');
  `);
  return { sqlite, db: new SqliteD1(sqlite) };
};

const request = (path: string) => new Request(`https://test${path}`);

const readJson = async (response: Response) => response.json() as Promise<any>;

const runPractice = (db: SqliteD1, query: string) => handlePracticeRoutes(
  request(`/api/practice${query}`),
  { DB: db } as any,
  '/api/practice',
  'GET',
);

const runTopics = (db: SqliteD1) => handlePracticeRoutes(
  request('/api/practice/topics'),
  { DB: db } as any,
  '/api/practice/topics',
  'GET',
);

let fixture: ReturnType<typeof createFixture> | undefined;

afterEach(() => {
  fixture?.sqlite.close();
  fixture = undefined;
});

describe('public practice question access', () => {
  it('only returns questions from the explicitly public, unprotected practice pool', async () => {
    fixture = createFixture();
    const response = await runPractice(fixture.db, '?topic=Toan&limit=50');
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.questions.map((question: any) => question.id)).toEqual(['q-public-toan']);
    expect(JSON.stringify(payload)).not.toContain('SECRET-');
  });

  it('matches one exact tag instead of a substring and decodes the URL once', async () => {
    fixture = createFixture();
    const response = await runPractice(fixture.db, '?topic=%23Toan&limit=50');
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.questions.map((question: any) => question.id)).toEqual(['q-public-toan']);

    const doubleEncoded = await runPractice(fixture.db, '?topic=%2523Toan&limit=50');
    expect(doubleEncoded.status).toBe(400);
  });

  it.each(['0', '-1', '51', '1.5', 'abc', ''])('rejects an invalid limit: %s', async (limit) => {
    fixture = createFixture();
    const response = await runPractice(fixture.db, `?topic=Toan&limit=${limit}`);
    expect(response.status).toBe(400);
  });

  it('keeps Unicode topic names and the default limit', async () => {
    fixture = createFixture();
    const response = await runPractice(fixture.db, '?topic=Ti%E1%BA%BFng_Vi%E1%BB%87t');
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.questions.map((question: any) => question.id)).toEqual(['q-public-vietnamese']);
  });

  it('only lists topics from the same public practice pool', async () => {
    fixture = createFixture();
    const response = await runTopics(fixture.db);
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.topics).toEqual([
      { name: '#Tiếng_Việt', count: 1 },
      { name: '#Toan', count: 1 },
      { name: '#ToanExtra', count: 1 },
    ]);
  });

  it('does not advertise stored tags that the selection endpoint cannot query', async () => {
    fixture = createFixture();
    fixture.sqlite.exec(`
      INSERT INTO questions (id, quiz_id, type, question, options, correct_answer, tags) VALUES
        ('q-percent-tag', 'public-open', 'MCQ', 'invalid percent tag', 'A|B', 'A', '#Ti_le%'),
        ('q-star-tag', 'public-open', 'MCQ', 'invalid star tag', 'A|B', 'A', '#Toan*'),
        ('q-long-tag', 'public-open', 'MCQ', 'invalid long tag', 'A|B', 'A', '#${'x'.repeat(129)}'),
        ('q-trailing-nbsp-tag', 'public-open', 'MCQ', 'non canonical trailing whitespace', 'A|B', 'A', '#Trailing\u00a0'),
        ('q-leading-nbsp-tag', 'public-open', 'MCQ', 'non canonical leading whitespace', 'A|B', 'A', '\u00a0#Leading');
    `);

    const topicsResponse = await runTopics(fixture.db);
    const topicsPayload = await readJson(topicsResponse);
    const topics = topicsPayload.topics as Array<{ name: string; count: number }>;

    const topicNames = topics.map((topic) => topic.name);
    for (const invalidTopic of [
      '#Ti_le%',
      '#Toan*',
      `#${'x'.repeat(129)}`,
      '#Trailing',
      '#Leading',
    ]) {
      expect(topicNames).not.toContain(invalidTopic);
    }
    expect(topics.find((topic) => topic.name === '#Toan')?.count).toBe(1);

    for (const topic of topics) {
      const selection = await runPractice(
        fixture.db,
        `?topic=${encodeURIComponent(topic.name)}&limit=50`,
      );
      const selectionPayload = await readJson(selection);
      expect(selection.status).toBe(200);
      expect(selectionPayload.questions).toHaveLength(topic.count);
    }

    const trailingNbspSelection = await runPractice(
      fixture.db,
      `?topic=${encodeURIComponent('#Trailing')}&limit=50`,
    );
    const leadingNbspSelection = await runPractice(
      fixture.db,
      `?topic=${encodeURIComponent('#Leading')}&limit=50`,
    );
    const invalidPercentSelection = await runPractice(
      fixture.db,
      `?topic=${encodeURIComponent('#Ti_le%')}&limit=50`,
    );
    const invalidStarSelection = await runPractice(
      fixture.db,
      `?topic=${encodeURIComponent('#Toan*')}&limit=50`,
    );
    const invalidLongSelection = await runPractice(
      fixture.db,
      `?topic=${encodeURIComponent(`#${'x'.repeat(129)}`)}&limit=50`,
    );

    expect((await readJson(trailingNbspSelection)).questions).toHaveLength(0);
    expect((await readJson(leadingNbspSelection)).questions).toHaveLength(0);
    expect(invalidPercentSelection.status).toBe(400);
    expect(invalidStarSelection.status).toBe(400);
    expect(invalidLongSelection.status).toBe(400);
  });

  it('materializes protected quiz ids instead of running correlated scans per question', () => {
    fixture = createFixture();
    const plan = fixture.sqlite.prepare(`
      EXPLAIN QUERY PLAN
      SELECT q.id
      ${PUBLIC_PRACTICE_SOURCE_SCOPE_SQL}
        AND INSTR(
          ',' || REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(q.tags, ''), ' ', ','), char(9), ','), char(10), ','), char(13), ',') || ',',
          ',' || ? || ','
        ) > 0
      ORDER BY q.rowid ASC
      LIMIT ?
    `).all('#Toan', 50) as Array<{ detail: string }>;
    const details = plan.map((row) => row.detail);

    expect(details.some((detail) => detail.includes('CORRELATED SCALAR SUBQUERY'))).toBe(false);
    expect(details.some((detail) => detail.includes('LIST SUBQUERY'))).toBe(true);
  });
});
