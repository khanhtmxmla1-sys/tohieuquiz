import { describe, expect, it } from 'vitest';
import { mapResultRow } from '../stores/quizStore';

describe('quizStore result mapping', () => {
  it('preserves canonical ids, grading metadata, zero metrics and decimals after refresh', () => {
    const mapped = mapResultRow({
      id: 'result-1',
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'assignment-1',
      gradingVersion: '2.0.0',
      'Student Name': 'An',
      Class: '4A',
      'Quiz ID': 'quiz-1',
      Score: 0,
      correctCount: 0,
      'Total Questions': 0,
      submittedAt: '2026-08-01T00:00:00.000Z',
      timeTaken: 0,
      answers: '{}',
    });

    expect(mapped).toMatchObject({
      id: 'result-1',
      studentId: 'student-1',
      classId: 'class-1',
      assignmentId: 'assignment-1',
      gradingVersion: '2.0.0',
      score: 0,
      correctCount: 0,
      totalQuestions: 0,
      timeTaken: 0,
      answers: {},
    });

    expect(mapResultRow({
      id: 'result-decimal',
      studentName: 'Binh',
      className: '4A',
      quizId: 'quiz-1',
      score: '7,5',
      correctCount: 3,
      totalQuestions: 4,
      submittedAt: '2026-08-01T00:00:00.000Z',
      timeTaken: 1,
    }).score).toBe(7.5);
  });
});
