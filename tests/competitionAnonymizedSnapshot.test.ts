import { describe, expect, it } from 'vitest';

import {
  anonymizeProtectedRows,
  assertOutsideRepository,
  collectSensitiveValues,
  findSensitiveLeaks,
  serializeRows,
} from '../workers/scripts/build-competition-anonymized-snapshot.cjs';

describe('Competition representative snapshot anonymization', () => {
  it('preserves relational shape while removing identity, credentials, codes, and answers', () => {
    const source = {
      teachers: [{
        username: 'real-teacher', password: 'secret-hash', full_name: 'Real Teacher',
        role: 'teacher', class: '5A', status: 'active', must_change_password: 0,
        token_version: 2, password_changed_at: null, last_login_at: null,
        disabled_at: null, disabled_by: null, disabled_reason: null,
        created_at: '2026-08-06T12:00:00.000Z', updated_at: '2026-08-06T12:01:00.000Z',
      }],
      classes: [{ id: 'class-real', name: '5A', teacher_username: 'real-teacher', created_at: '2026-08-06T12:00:00.000Z', archived_at: null }],
      students: [{
        id: 'student-real', full_name: 'Real Student', username: 'student-login',
        password_hash: 'student-secret', class_id: 'class-real', parent_phone: '0900000000',
        avatar: 'https://private/avatar', coins: 10, token_version: 1,
        created_at: '2026-08-06T12:00:00.000Z', archived_at: null,
      }],
      quizzes: [{
        id: 'quiz-real', title: 'Private quiz', class_level: '5', category: 'math',
        time_limit: 30, created_at: '2026-08-06T12:00:00.000Z', access_code: 'ABC123',
        require_code: 'TRUE', created_by: 'real-teacher', show_on_home: 'FALSE',
        tags: '["private"]', source_type: 'LEGACY', parent_quiz_id: null,
        version_number: 1, revision: 1, updated_at: null,
      }],
      results: [{
        id: 1, student_id: 'student-real', assignment_id: 'assignment-private',
        class_id: 'class-real', student_name: 'Real Student', class_name: '5A',
        quiz_id: 'quiz-real', quiz_title: 'Private quiz', score: 8,
        correct_count: 8, total_questions: 10, time_taken: 120,
        submitted_at: '2026-08-06T12:00:00.000Z', answers: '{"q1":"secret-answer"}',
        analytics_json: '{"device":"private"}', grading_version: 'v2',
      }],
      live_exam_sessions: [{
        id: 'exam-real', title: 'Private live exam', quiz_id: 'quiz-real',
        teacher_id: 'real-teacher', class_id: 'class-real', duration: 30,
        scheduled_at: null, started_at: null, ends_at: null, closed_at: null,
        paused_at: null, total_paused_seconds: 0, settings: '{"private":true}',
        status: 'CLOSED', access_code: 'LIVE99', chat_enabled: 1,
        archived_at: null, created_at: '2026-08-06T12:00:00.000Z', updated_at: '2026-08-06T12:01:00.000Z',
      }],
      live_exam_participants: [{
        id: 'participant-real', live_exam_id: 'exam-real', student_id: 'student-real',
        username: 'student-login', joined_at: '2026-08-06T12:00:00.000Z', started_at: null,
        submitted_at: null, individual_ends_at: null,
        answers: '{"q1":"secret-answer"}', score: 8, correct_count: 8,
        wrong_count: 2, rank: 1, grading_version: 'v2', tab_switches: 0,
        warnings: '["private warning"]', created_at: '2026-08-06T12:00:00.000Z', updated_at: '2026-08-06T12:01:00.000Z',
      }],
      live_exam_activity: [{
        live_exam_id: 'exam-real', student_id: 'student-real', current_question: 2,
        answered_count: 1, last_activity: '2026-08-06T12:00:00.000Z', is_online: 0,
      }],
      live_exam_answer_snapshots: [{
        live_exam_id: 'exam-real', student_id: 'student-real', attempt_version: 1,
        answers: '{"q1":"secret-answer"}', idempotency_key: 'private-key', updated_at: '2026-08-06T12:00:00.000Z',
      }],
      live_exam_connection_events: [{
        id: 'event-real', live_exam_id: 'exam-real', student_id: 'student-real',
        event_type: 'CONNECTED', attempt_version: 1, created_at: '2026-08-06T12:00:00.000Z',
      }],
    };

    const sensitive = collectSensitiveValues(source);
    const result = anonymizeProtectedRows(source);
    expect(result.classes[0].teacher_username).toBe(result.teachers[0].username);
    expect(result.students[0].class_id).toBe(result.classes[0].id);
    expect(result.live_exam_sessions[0].quiz_id).toBe(result.quizzes[0].id);
    expect(result.live_exam_participants[0].student_id).toBe(result.students[0].id);
    expect(result.live_exam_answer_snapshots[0].live_exam_id).toBe(result.live_exam_sessions[0].id);
    expect(result.results[0].answers).toBeNull();
    expect(result.results[0].score).toBe(0);
    expect(result.results[0].submitted_at).toBe('2026-01-01T00:00:00.000Z');
    expect(result.live_exam_participants[0].answers).toBeNull();
    expect(result.live_exam_participants[0].score).toBe(0);
    expect(result.live_exam_answer_snapshots[0].answers).toBe('{}');
    expect(result.live_exam_connection_events[0].created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(findSensitiveLeaks(result, sensitive)).toEqual([]);
  });

  it('rejects snapshot output inside the repository', () => {
    expect(() => assertOutsideRepository('C:/repo/evidence.sql', 'C:/repo'))
      .toThrow(/outside the repository/i);
    expect(() => assertOutsideRepository('C:/evidence/evidence.sql', 'C:/repo'))
      .not.toThrow();
  });

  it('serializes data without SQL transaction statements rejected by local D1', () => {
    const sql = serializeRows({
      teachers: [{ username: 'teacher-0001', password: 'redacted' }],
    });

    expect(sql).toContain('INSERT INTO "teachers"');
    expect(sql).not.toMatch(/\b(?:BEGIN|COMMIT|SAVEPOINT)\b/i);
  });
});
