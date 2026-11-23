// @vitest-environment node

import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  normalizePracticeBlankText,
  PracticePresentationError,
  practicePresentationPermutation,
  toPracticeQuestionDto,
} from '../workers/src/services/practicePresentation';
import { handlePracticeRoutes } from '../workers/src/routes/practice';
import { verifyPracticeSession } from '../workers/src/services/practiceSession';
import { mapPracticeSourceRow } from '../workers/src/services/practiceGrading';
import { getInteractiveBlankIds } from '../src/features/quiz-player/components/QuestionRenderer/atoms/InteractiveMathText';
import { PRACTICE_MAX_GRADE_BODY_BYTES } from '../shared/practice-grading.contract';

const context = {
  quizId: 'source-quiz',
  revision: 3,
  scope: JSON.stringify(['practice-student-question-dto-v1', 'practice-1', 'source-quiz', 3]),
  key: 'practice-test-secret',
};

type SqliteStatement = {
  all: (...values: unknown[]) => Record<string, unknown>[];
  get: (...values: unknown[]) => Record<string, unknown> | undefined;
  run: (...values: unknown[]) => unknown;
};

class SqliteD1 {
  constructor(private readonly sqlite: DatabaseSync) {}

  prepare(sql: string) {
    const statement = this.sqlite.prepare(sql) as unknown as SqliteStatement;
    return {
      all: async <T>() => ({ results: statement.all() as T[] }),
      first: async <T>() => statement.get() as T | null,
      run: async () => statement.run(),
      bind: (...values: unknown[]) => ({
        all: async <T>() => ({ results: statement.all(...values) as T[] }),
        first: async <T>() => statement.get(...values) as T | null,
        run: async () => statement.run(...values),
      }),
    };
  }
}

const PRACTICE_SECRET = 'practice-integration-secret';

const createIntegrationFixture = () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      class_level TEXT NOT NULL DEFAULT '',
      require_code TEXT NOT NULL DEFAULT 'FALSE',
      show_on_home TEXT NOT NULL DEFAULT 'TRUE',
      source_type TEXT NOT NULL DEFAULT 'manual',
      revision INTEGER NOT NULL DEFAULT 1
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
      image_alt TEXT DEFAULT '',
      svg_content TEXT DEFAULT '',
      svg_alt TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      difficulty TEXT DEFAULT '',
      answer_schema_version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE assignments (id TEXT PRIMARY KEY, quiz_id TEXT);
    CREATE TABLE live_exam_sessions (id TEXT PRIMARY KEY, quiz_id TEXT, status TEXT NOT NULL DEFAULT '');
    CREATE TABLE competition_round_quizzes (id TEXT PRIMARY KEY, quiz_id TEXT);
    CREATE TABLE competition_quiz_snapshots (id TEXT PRIMARY KEY, quiz_id TEXT);
    CREATE TABLE competition_school_exam_events (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT '');
    CREATE TABLE competition_school_exam_rooms (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, quiz_id TEXT, status TEXT NOT NULL DEFAULT '');
    CREATE TABLE system_settings (setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL);
    CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT INTO quizzes (id, title, revision) VALUES ('practice-quiz', 'Practice', 1);
    INSERT INTO system_settings VALUES ('quiz_randomize_practice_selection', 'false');
  `);

  const questionRows: Array<[string, string, string, string, string, string, string, string, string, string, string]> = [
    ['q-mcq', 'MCQ', 'Chọn', 'A|B', 'A', '', '', '', '', '', ''],
    ['q-image', 'IMAGE_QUESTION', 'Hình', '|B', 'B', '', '', '', '["img-a",""]', '', ''],
    ['q-multi', 'MULTIPLE_SELECT', 'Chọn nhiều', 'A|B', '["A","B"]', '', '', '', '', '', ''],
    ['q-short', 'SHORT_ANSWER', 'Bao nhiêu?', '', '42', '', '', '', '', '', ''],
    ['q-true-false', 'TRUE_FALSE', 'Đúng sai', '', '', '[{"statement":"Một","isCorrect":true},{"statement":"Hai","isCorrect":false}]', '', '', '', '', ''],
    ['q-matching', 'MATCHING', 'Nối', '', '', '[{"left":"A","right":"1"},{"left":"B","right":"2"}]', '', '', '', '', ''],
    ['q-drag', 'DRAG_DROP', 'Kéo [x]', '', '', '', 'Chọn [x]', '[{"correctAnswer":"A","options":["A","B"]}]', '["B"]', '', ''],
    ['q-dropdown', 'DROPDOWN', 'Chọn [x]', '', '', '', 'Chọn [x]', '[{"id":"answer","correctAnswer":"A","options":["A","B"]}]', '', '', ''],
    ['q-ordering', 'ORDERING', 'Sắp xếp', '', '[0,1]', '["First","Second"]', '', '', '', '', ''],
    ['q-category', 'CATEGORIZATION', 'Phân loại', '', '', '[{"id":"item-a","content":"A","categoryId":"cat-a"}]', '', '', '[{"id":"cat-a","name":"Cat"}]', '', ''],
    ['q-underline', 'UNDERLINE', 'Gạch chân', '', '[0]', '', '', '', '', '', '["a","b"]'],
    ['q-word', 'WORD_SCRAMBLE', 'Ghép từ', '', 'CAT', '["C","A","T"]', '', '', '', '', ''],
    ['q-riddle', 'RIDDLE', 'Đố', '', '42', '["Clue"]', 'Answer', '', '', '', ''],
    ['q-error', 'ERROR_CORRECTION', 'Sửa lỗi', '', 'correct', '', 'The wrogn word', '', 'wrogn', '', ''],
  ];
  const insert = sqlite.prepare(`
    INSERT INTO questions (id, quiz_id, type, question, options, correct_answer, items, text_field, blanks, distractors, correct_word_indexes, words, tags)
    VALUES (?, 'practice-quiz', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '#All')
  `);
  for (const [id, type, question, options, correct, items, textField, blanks, distractors, correctIndexes, words] of questionRows) {
    insert.run(id, type, question, options, correct, items, textField, blanks, distractors, correctIndexes, words);
  }

  return { sqlite, db: new SqliteD1(sqlite) };
};

let integrationFixture: ReturnType<typeof createIntegrationFixture> | undefined;

afterEach(() => {
  integrationFixture?.sqlite.close();
  integrationFixture = undefined;
});

const json = async (response: Response): Promise<any> => response.json();

const loadIntegratedPractice = async () => {
  if (!integrationFixture) integrationFixture = createIntegrationFixture();
  const response = await handlePracticeRoutes(
    new Request('https://test/api/practice?topic=All&limit=50&delivery=server-v1'),
    { DB: integrationFixture.db, JWT_SECRET: PRACTICE_SECRET } as any,
    '/api/practice',
    'GET',
  );
  return { response, payload: await json(response), db: integrationFixture.db, sqlite: integrationFixture.sqlite };
};

const buildCanonicalAnswers = (questions: any[]): Record<string, unknown> => {
  const answers: Record<string, unknown> = {};
  for (const question of questions) {
    switch (question.type) {
      case 'MCQ':
        answers[question.id] = { optionId: question.options[0] };
        break;
      case 'IMAGE_QUESTION':
        answers[question.id] = { optionId: question.options.find((option: string) => option !== '') };
        break;
      case 'MULTIPLE_SELECT':
        answers[question.id] = { optionIds: question.options };
        break;
      case 'SHORT_ANSWER':
        answers[question.id] = { value: '42' };
        break;
      case 'TRUE_FALSE':
        answers[question.id] = { values: { [question.items[0].id]: true, [question.items[1].id]: false } };
        break;
      case 'MATCHING': {
        const pairs: Record<string, string> = {};
        for (const left of question.leftItems) {
          const expectedRight = left.content === 'A' ? '1' : '2';
          pairs[left.id] = question.rightItems.find((right: any) => right.content === expectedRight).id;
        }
        answers[question.id] = { pairs };
        break;
      }
      case 'DRAG_DROP':
      case 'DROPDOWN':
        answers[question.id] = { values: { [question.blanks[0].id]: 'A' } };
        break;
      case 'ORDERING': {
        const authored = ['First', 'Second'];
        answers[question.id] = {
          ranks: Object.fromEntries(question.items.map((item: string, index: number) => [
            `item-${index}`,
            authored.indexOf(item) + 1,
          ])),
        };
        break;
      }
      case 'CATEGORIZATION':
        answers[question.id] = { categoriesByItemId: { [question.items[0].id]: question.categories[0].id } };
        break;
      case 'UNDERLINE':
        answers[question.id] = { indexes: [0] };
        break;
      case 'WORD_SCRAMBLE': {
        const used = new Set<number>();
        answers[question.id] = {
          letterIndexes: ['C', 'A', 'T'].map((letter) => {
            const index = question.letters.findIndex((value: string, candidate: number) => value === letter && !used.has(candidate));
            used.add(index);
            return index;
          }),
        };
        break;
      }
      case 'RIDDLE':
        answers[question.id] = { value: '42' };
        break;
      case 'ERROR_CORRECTION':
        answers[question.id] = { wrongWord: 'wrogn', correctWord: 'correct' };
        break;
      default:
        throw new Error(`Unhandled practice type ${question.type}`);
    }
  }
  return answers;
};

describe('practice presentation boundary', () => {
  it('neutralizes answer-bearing blank markers without changing TeX optional brackets', () => {
    expect(normalizePracticeBlankText('Bầu trời [x]. $\\sqrt[3]{8}$\n[blue]', 2))
      .toBe('Bầu trời [1]. $\\sqrt[3]{8}$\n[2]');
  });

  it('rewrites underscore markers into renderer-visible neutral placeholders', () => {
    expect(normalizePracticeBlankText('A ___ B [x] C _____', 3))
      .toBe('A [1] B [2] C [3]');
    expect(normalizePracticeBlankText('Literal \\___', 0)).toBe('Literal \\___');
  });

  it('does not let escaped display-math delimiters swallow an inner answer marker', async () => {
    const displayText = String.raw`\[x [answer]\]`;
    expect(normalizePracticeBlankText(displayText, 1)).toBe('$$x [1]$$');
    const dto = await toPracticeQuestionDto({
      id: 'rich-display-blank',
      type: 'DRAG_DROP',
      question: displayText,
      text: displayText,
      blanks: [{ correctAnswer: 'answer', options: ['answer'] }],
      questionRichText: {
        schemaVersion: 1,
        doc: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [
            { type: 'text', text: displayText.slice(0, 5) },
            { type: 'text', text: displayText.slice(5) },
          ] }],
        },
      },
    }, context);
    expect(dto.question).toBe('$$x [1]$$');
    expect(getInteractiveBlankIds(String(dto.question))).toEqual(['1']);
    expect(dto.questionRichText).toBeUndefined();
  });

  it('keeps the legacy underline sentence-token fallback in practice only', async () => {
    const mapped = mapPracticeSourceRow({
      id: 'underline-legacy',
      quiz_id: 'quiz-1',
      type: 'UNDERLINE',
      question: 'Choose a word',
      sentence: 'alpha beta gamma',
      words: '',
      correct_answer: '[1]',
      correct_word_indexes: '',
    });
    const dto = await toPracticeQuestionDto(mapped, context);
    expect(dto.words).toEqual(['alpha', 'beta', 'gamma']);
    expect(JSON.stringify(dto)).not.toMatch(/correct(?:_?answer|WordIndexes?)/i);
  });

  it('fails closed when the blank marker count does not match the authored contract', () => {
    expect(() => normalizePracticeBlankText('Bầu trời [x].', 2))
      .toThrowError(new PracticePresentationError(
        'PRACTICE_BLANK_MARKERS_INVALID',
        'Practice question blank markers do not match its blank contract.',
      ));
  });

  it('preserves sparse image option slots', async () => {
    const dto = await toPracticeQuestionDto({
      id: 'image-1',
      type: 'IMAGE_QUESTION',
      question: 'Chọn hình',
      options: ['A', 'B', 'C'],
      optionImages: ['img-a', '', 'img-c'],
      correctAnswer: 'A',
    }, context);
    expect(dto.optionImages).toEqual(['img-a', '', 'img-c']);
    expect(JSON.stringify(dto)).not.toMatch(/correctAnswer|correct_answer/);
  });

  it('preserves sparse image text slots and permutes dropdown choices per session', async () => {
    const image = await toPracticeQuestionDto({
      id: 'image-sparse',
      type: 'IMAGE_QUESTION',
      question: 'Chọn hình',
      options: ['', 'Mô tả hình'],
      optionImages: ['image-a', ''],
      correctAnswer: 'Mô tả hình',
    }, context);
    expect(image.options).toEqual(['', 'Mô tả hình']);
    expect(image.optionImages).toEqual(['image-a', '']);

    const dropdownQuestion = {
      id: 'dropdown-order',
      type: 'DROPDOWN',
      question: 'Chọn [x]',
      text: 'Chọn [x]',
      blanks: [{ id: 'answer', correctAnswer: 'A', options: ['A', 'B', 'C'] }],
    };
    const firstOptions = new Set<string>();
    for (let sessionIndex = 0; sessionIndex < 8; sessionIndex += 1) {
      const dropdown = await toPracticeQuestionDto(dropdownQuestion, {
        ...context,
        scope: `${context.scope}:${sessionIndex}`,
      });
      firstOptions.add(String(dropdown.blanks?.[0].options?.[0]));
      expect(dropdown.blanks?.[0].options).toHaveLength(3);
    }
    expect(firstOptions.size).toBeGreaterThan(1);
    const dropdown = await toPracticeQuestionDto(dropdownQuestion, context);
    expect(dropdown.blanks?.[0].id).toMatch(/^sq1_/);
  });

  it('canonicalizes hyphenated practice type aliases before mapping', () => {
    const mapped = mapPracticeSourceRow({
      id: 'drag-alias',
      quiz_id: 'quiz-1',
      type: 'drag-drop',
      question: 'Chọn [x]',
      text_field: 'Chọn [x]',
      blanks: '[{"correctAnswer":"A"}]',
      distractors: '["B"]',
      correct_answer: '',
    });
    expect(mapped.type).toBe('DRAG_DROP');
  });

  it('removes authored order leaks while keeping a deterministic session permutation', async () => {
    const question = {
      id: 'ordering-1',
      type: 'ORDERING',
      question: 'Sắp xếp',
      items: ['Một', 'Hai', 'Ba'],
      correctOrder: [0, 1, 2],
    };
    const dto = await toPracticeQuestionDto(question, context);
    const permutation = await practicePresentationPermutation(question, context, 'ordering');
    expect(dto.items).toEqual(permutation.map((index) => question.items[index]));
    expect(dto.items).not.toEqual(question.items);
  });

  it('removes natural word-scramble order leaks', async () => {
    const question = {
      id: 'scramble-1',
      type: 'WORD_SCRAMBLE',
      question: 'Ghép từ',
      letters: ['C', 'A', 'T'],
      correctWord: 'CAT',
    };
    const dto = await toPracticeQuestionDto(question, context);
    const permutation = await practicePresentationPermutation(question, context, 'word-scramble');
    expect(dto.letters).toEqual(permutation.map((index) => question.letters[index]));
    expect(dto.letters).not.toEqual(question.letters);
  });
});

describe('authoritative practice grading integration', () => {
  const grade = async (payload: any, db: SqliteD1, answers: Record<string, unknown>) => {
    const request = new Request('https://test/api/practice/grade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionToken: payload.practiceSession.token,
        answers,
        questionOrder: payload.questions.map((question: any) => question.id),
      }),
    });
    return handlePracticeRoutes(request, { DB: db, JWT_SECRET: PRACTICE_SECRET } as any, '/api/practice/grade', 'POST');
  };

  it('loads safe DTOs and grades all 14 published question types from a real SQLite pool', async () => {
    const loaded = await loadIntegratedPractice();
    expect(loaded.response.status).toBe(200);
    expect(loaded.payload.questions).toHaveLength(14);
    expect(JSON.stringify(loaded.payload.questions)).not.toMatch(
      /correct(?:_?answer|Answers?)|correctOrder|correctWordIndexes|isCorrect|categoryId|rawToken/i,
    );
    expect(loaded.payload.practiceSession.version).toBe('server-v1');
    const claims = await verifyPracticeSession(loaded.payload.practiceSession.token, { jwtSecret: PRACTICE_SECRET });
    expect(claims?.selected).toHaveLength(14);
    expect(claims).not.toHaveProperty('answers');

    const response = await grade(loaded.payload, loaded.db, buildCanonicalAnswers(loaded.payload.questions));
    const result = await json(response);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(result.status).toBe('success');
    expect(result.correctCount).toBe(14);
    expect(result.questionCount).toBe(14);
    expect(result.reviewDetails).toHaveLength(14);
    expect(new Set(result.reviewDetails.map((detail: any) => detail.questionId)).size).toBe(14);
    expect(loaded.sqlite.prepare('SELECT COUNT(*) AS count FROM rate_limits').get().count).toBe(1);
  });

  it('rejects tampered answer IDs and oversized grade bodies before grading', async () => {
    const loaded = await loadIntegratedPractice();
    const answers = buildCanonicalAnswers(loaded.payload.questions);
    answers['not-selected'] = 'forged';
    const forged = await grade(loaded.payload, loaded.db, answers);
    expect(forged.status).toBe(400);
    expect(await json(forged)).toMatchObject({ code: 'PRACTICE_ANSWER_QUESTION_INVALID' });

    const oversized = new Request('https://test/api/practice/grade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionToken: loaded.payload.practiceSession.token,
        answers: { padding: 'x'.repeat(PRACTICE_MAX_GRADE_BODY_BYTES) },
      }),
    });
    const oversizedResponse = await handlePracticeRoutes(
      oversized,
      { DB: loaded.db, JWT_SECRET: PRACTICE_SECRET } as any,
      '/api/practice/grade',
      'POST',
    );
    expect(oversizedResponse.status).toBe(400);
    expect(await json(oversizedResponse)).toMatchObject({ code: 'PRACTICE_REQUEST_INVALID' });
  });

  it('rejects canonical structured IDs when practice issued opaque IDs are required', async () => {
    const loaded = await loadIntegratedPractice();
    const invalidStructuredAnswers = [
      { 'q-matching': { pairs: { 'left-0': 'right-0' } } },
      { 'q-drag': { values: { 'blank-0': 'A' } } },
      { 'q-dropdown': { values: { answer: 'A' } } },
    ];
    for (const answers of invalidStructuredAnswers) {
      const response = await grade(loaded.payload, loaded.db, answers);
      expect(response.status).toBe(400);
      expect(await json(response)).toMatchObject({ code: 'PRACTICE_STRUCTURED_ID_INVALID' });
    }
  });

  it('rebases legacy ordering arrays through the issued presentation permutation', async () => {
    const loaded = await loadIntegratedPractice();
    const ordering = loaded.payload.questions.find((question: any) => question.id === 'q-ordering');
    const authoredOrderAsPresentedIndexes = ['First', 'Second'].map((text) => ordering.items.indexOf(text));
    const response = await grade(loaded.payload, loaded.db, {
      'q-ordering': { ranks: authoredOrderAsPresentedIndexes },
    });
    const result = await json(response);
    expect(response.status).toBe(200);
    expect(result.validationDetails.find((detail: any) => detail.questionId === 'q-ordering')).toMatchObject({
      status: 'correct',
      isCorrect: true,
    });
  });

  it('returns complete skipped envelopes for an untouched practice submission', async () => {
    const loaded = await loadIntegratedPractice();
    const answers = {
      'q-matching': { type: 'MATCHING', selectedLeft: 'in-progress' },
      'q-drag': { type: 'DRAG_DROP', values: { [loaded.payload.questions.find((question: any) => question.id === 'q-drag').blanks[0].id]: '' } },
      'q-ordering': { type: 'ORDERING', ranks: {} },
      'q-word': { type: 'WORD_SCRAMBLE', letterIndexes: [] },
    };
    const response = await grade(loaded.payload, loaded.db, answers);
    const result = await json(response);
    expect(response.status).toBe(200);
    expect(result.status).toBe('success');
    expect(result.correctCount).toBe(0);
    expect(result.reviewDetails).toHaveLength(14);
    expect(result.reviewDetails.every((detail: any) => detail.status === 'skipped')).toBe(true);
    expect(Object.keys(result.answers)).toHaveLength(14);
    expect(Object.values(result.answers).every((entry: any) => entry.selectedAnswer === null)).toBe(true);
  });

  it('invalidates a session when the selected pool becomes protected or content changes', async () => {
    const loaded = await loadIntegratedPractice();
    const answers = buildCanonicalAnswers(loaded.payload.questions);
    loaded.sqlite.prepare("UPDATE quizzes SET require_code = 'TRUE' WHERE id = 'practice-quiz'").run();
    const protectedResponse = await grade(loaded.payload, loaded.db, answers);
    expect(protectedResponse.status).toBe(409);
    expect(await json(protectedResponse)).toMatchObject({ code: 'PRACTICE_SESSION_STALE' });

    integrationFixture?.sqlite.close();
    integrationFixture = createIntegrationFixture();
    const refreshed = await loadIntegratedPractice();
    refreshed.sqlite.prepare("UPDATE quizzes SET revision = 2 WHERE id = 'practice-quiz'").run();
    const revisionResponse = await grade(refreshed.payload, refreshed.db, buildCanonicalAnswers(refreshed.payload.questions));
    expect(revisionResponse.status).toBe(409);
    expect(await json(revisionResponse)).toMatchObject({ code: 'PRACTICE_SESSION_STALE' });

    integrationFixture?.sqlite.close();
    integrationFixture = createIntegrationFixture();
    const contentChanged = await loadIntegratedPractice();
    contentChanged.sqlite.prepare("UPDATE questions SET question = 'changed' WHERE id = 'q-mcq'").run();
    const changedResponse = await grade(contentChanged.payload, contentChanged.db, buildCanonicalAnswers(contentChanged.payload.questions));
    expect(changedResponse.status).toBe(409);
    expect(await json(changedResponse)).toMatchObject({ code: 'PRACTICE_SESSION_STALE' });
  });

  it('invalidates issued sessions when any protected workflow attaches to the source quiz', async () => {
    const protectedWorkflowSetups: Array<[string, (sqlite: DatabaseSync) => void]> = [
      ['assignment', (sqlite) => sqlite.prepare("INSERT INTO assignments VALUES ('assignment-issued', 'practice-quiz')").run()],
      ['live exam', (sqlite) => sqlite.prepare("INSERT INTO live_exam_sessions VALUES ('live-issued', 'practice-quiz', 'scheduled')").run()],
      ['competition round', (sqlite) => sqlite.prepare("INSERT INTO competition_round_quizzes VALUES ('round-issued', 'practice-quiz')").run()],
      ['competition snapshot', (sqlite) => sqlite.prepare("INSERT INTO competition_quiz_snapshots VALUES ('snapshot-issued', 'practice-quiz')").run()],
      ['school exam room', (sqlite) => {
        sqlite.prepare("INSERT INTO competition_school_exam_events VALUES ('event-issued', 'READY')").run();
        sqlite.prepare("INSERT INTO competition_school_exam_rooms VALUES ('room-issued', 'event-issued', 'practice-quiz', 'READY')").run();
      }],
    ];

    for (const [_label, attachProtectedWorkflow] of protectedWorkflowSetups) {
      integrationFixture = createIntegrationFixture();
      const loaded = await loadIntegratedPractice();
      attachProtectedWorkflow(loaded.sqlite);
      const response = await grade(loaded.payload, loaded.db, {});
      expect(response.status).toBe(409);
      expect(await json(response)).toMatchObject({ code: 'PRACTICE_SESSION_STALE' });
      integrationFixture.sqlite.close();
      integrationFixture = undefined;
    }
  });

  it('returns a session conflict for a tampered or expired practice token', async () => {
    const loaded = await loadIntegratedPractice();
    const tampered = `${loaded.payload.practiceSession.token.slice(0, -1)}${loaded.payload.practiceSession.token.endsWith('a') ? 'b' : 'a'}`;
    const request = new Request('https://test/api/practice/grade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionToken: tampered, answers: {} }),
    });
    const response = await handlePracticeRoutes(request, { DB: loaded.db, JWT_SECRET: PRACTICE_SECRET } as any, '/api/practice/grade', 'POST');
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: 'PRACTICE_SESSION_INVALID' });
  });
});
