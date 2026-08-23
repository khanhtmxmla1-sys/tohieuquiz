// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createOrReuseQuizSnapshot,
  verifyQuizSnapshotIntegrity,
  type CompetitionQuizSnapshot,
} from '../workers/src/competition/quizSnapshotService';

interface SnapshotRow {
  id: string;
  quiz_id: string;
  canonical_payload_json: string;
  sha256: string;
  created_at: string;
  created_by: string;
}

interface FakeState {
  quiz: Record<string, unknown>;
  questions: Array<Record<string, unknown>>;
  snapshots: SnapshotRow[];
}

function createFakeDb(state: FakeState): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('FROM quizzes WHERE id = ?')) {
                return (String(values[0]) === String(state.quiz.id) ? state.quiz : null) as T | null;
              }
              if (sql.includes('FROM competition_quiz_snapshots')) {
                const row = state.snapshots.find((snapshot) => (
                  snapshot.quiz_id === String(values[0]) && snapshot.sha256 === String(values[1])
                ));
                return (row ?? null) as T | null;
              }
              throw new Error(`Unexpected first SQL: ${sql}`);
            },
            async all<T>() {
              if (sql.includes('FROM questions WHERE quiz_id = ? ORDER BY rowid ASC')) {
                return { results: state.questions.map((question) => ({ ...question })) as T[] };
              }
              throw new Error(`Unexpected all SQL: ${sql}`);
            },
            async run() {
              if (sql.includes('INSERT OR IGNORE INTO competition_quiz_snapshots')) {
                const [id, quizId, canonicalPayloadJson, sha256, createdAt, createdBy] = values.map(String);
                const exists = state.snapshots.some((snapshot) => (
                  snapshot.quiz_id === quizId && snapshot.sha256 === sha256
                ));
                if (!exists) {
                  state.snapshots.push({
                    id,
                    quiz_id: quizId,
                    canonical_payload_json: canonicalPayloadJson,
                    sha256,
                    created_at: createdAt,
                    created_by: createdBy,
                  });
                }
                return { success: true } as D1Result;
              }
              throw new Error(`Unexpected run SQL: ${sql}`);
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

function baseState(): FakeState {
  return {
    quiz: {
      id: 'quiz-1',
      title: 'Đề vòng 1',
      class_level: '4',
      category: 'Tiếng Việt',
      time_limit: 30,
      created_at: '2026-08-01T00:00:00.000Z',
      created_by: 'teacher-1',
      tags: '["competition"]',
      source_type: 'manual',
      parent_quiz_id: null,
      version_number: 1,
      revision: 1,
      updated_at: '2026-08-01T00:00:00.000Z',
      access_code: 'SECRET',
    },
    questions: [
      {
        id: 'q-1',
        quiz_id: 'quiz-1',
        type: 'SINGLE_CHOICE',
        question: 'Câu 1',
        options: '["A","B"]',
        correct_answer: 'A',
        points: 1,
      },
      {
        id: 'q-2',
        quiz_id: 'quiz-1',
        type: 'TRUE_FALSE',
        question: 'Câu 2',
        correct_answer: 'TRUE',
        points: 1,
      },
    ],
    snapshots: [],
  };
}

describe('Competition immutable quiz snapshots', () => {
  it('snapshots quiz metadata plus ordered questions into canonical JSON with SHA-256', async () => {
    const state = baseState();
    const snapshot = await createOrReuseQuizSnapshot(createFakeDb(state), 'quiz-1');

    expect(snapshot.quizId).toBe('quiz-1');
    expect(snapshot.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(state.snapshots).toHaveLength(1);

    const payload = JSON.parse(snapshot.canonicalPayloadJson) as {
      quiz: Record<string, unknown>;
      questions: Array<Record<string, unknown>>;
    };
    expect(payload.quiz).not.toHaveProperty('access_code');
    expect(payload.questions.map((question) => question.id)).toEqual(['q-1', 'q-2']);
    expect(payload.questions[0].correct_answer).toBe('A');
    await expect(verifyQuizSnapshotIntegrity(snapshot)).resolves.toBe(true);
  });

  it('reuses an identical content hash instead of creating duplicate snapshots', async () => {
    const state = baseState();
    const db = createFakeDb(state);

    const first = await createOrReuseQuizSnapshot(db, 'quiz-1');
    const second = await createOrReuseQuizSnapshot(db, 'quiz-1');

    expect(second.id).toBe(first.id);
    expect(second.sha256).toBe(first.sha256);
    expect(state.snapshots).toHaveLength(1);
  });

  it('keeps the locked snapshot unchanged when the source quiz is edited', async () => {
    const state = baseState();
    const db = createFakeDb(state);
    const locked = await createOrReuseQuizSnapshot(db, 'quiz-1');
    const lockedPayload = locked.canonicalPayloadJson;

    state.quiz.title = 'Đề vòng 1 - đã sửa';
    state.quiz.revision = 2;
    state.questions[0].correct_answer = 'B';

    const edited = await createOrReuseQuizSnapshot(db, 'quiz-1');

    expect(edited.id).not.toBe(locked.id);
    expect(edited.sha256).not.toBe(locked.sha256);
    expect(state.snapshots).toHaveLength(2);
    expect(state.snapshots[0].canonical_payload_json).toBe(lockedPayload);
    expect(JSON.parse(state.snapshots[0].canonical_payload_json).questions[0].correct_answer).toBe('A');
  });

  it('detects tampered canonical payloads before a round can trust the snapshot', async () => {
    const state = baseState();
    const snapshot = await createOrReuseQuizSnapshot(createFakeDb(state), 'quiz-1');
    const tampered: CompetitionQuizSnapshot = {
      ...snapshot,
      canonicalPayloadJson: snapshot.canonicalPayloadJson.replace('Câu 1', 'Câu bị sửa'),
    };

    await expect(verifyQuizSnapshotIntegrity(tampered)).resolves.toBe(false);
  });
});
