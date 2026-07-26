/**
 * Live Exam Analytics Service
 * Calculates progress, score distribution, difficult questions and timing data.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import type { Quiz } from '../../../src/types';
import { calculateStudentScore } from '../../../src/features/quiz-player/utils/quizScoring';
import { mapLiveExamQuestionRow } from './liveExamQuestionMapper';

export interface SessionAnalytics {
  session: {
    id: string;
    title: string;
    status: string;
    totalQuestions: number;
  };
  progress: {
    totalParticipants: number;
    submittedCount: number;
    submittedPercentage: number;
    notSubmittedStudents: Array<{ username: string; joinedAt: string }>;
  };
  scores: {
    distribution: Array<{ range: string; count: number; percentage: number }>;
    average: number;
    median: number;
    min: number;
    max: number;
    standardDeviation: number;
  };
  questions: Array<{
    questionIndex: number;
    questionText: string;
    correctRate: number;
    incorrectRate: number;
    avgTimeSeconds: number | null;
    minTimeSeconds: number | null;
    maxTimeSeconds: number | null;
  }>;
  topDifficultQuestions: Array<{
    questionIndex: number;
    questionText: string;
    correctRate: number;
    incorrectCount: number;
  }>;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function loadQuiz(db: D1Database, quizId: string): Promise<Quiz> {
  const quiz = await db.prepare(`
    SELECT id, title, class_level, time_limit, created_at, created_by
    FROM quizzes
    WHERE id = ?
  `).bind(quizId).first<any>();
  if (!quiz) throw new Error('Quiz not found');

  const rows = await db.prepare(`
    SELECT id, type, question, options, correct_answer, items, text_field, blanks,
           distractors, sentence, words, correct_word_indexes, image, difficulty
    FROM questions
    WHERE quiz_id = ?
    ORDER BY rowid ASC
  `).bind(quizId).all<any>();

  return {
    id: String(quiz.id),
    title: String(quiz.title || ''),
    classLevel: String(quiz.class_level || ''),
    timeLimit: Number(quiz.time_limit || 0),
    createdAt: String(quiz.created_at || ''),
    createdBy: String(quiz.created_by || ''),
    questions: (rows.results || []).map(mapLiveExamQuestionRow),
  };
}

export async function calculateSessionAnalytics(
  db: D1Database,
  sessionId: string,
): Promise<SessionAnalytics> {
  const session = await db.prepare(`
    SELECT id, title, status, quiz_id
    FROM live_exam_sessions
    WHERE id = ? AND archived_at IS NULL
  `).bind(sessionId).first<{ id: string; title: string; status: string; quiz_id: string }>();
  if (!session) throw new Error('Session not found');

  const quiz = await loadQuiz(db, session.quiz_id);
  const progress = await calculateProgress(db, sessionId);
  const scores = await calculateScoreDistribution(db, sessionId);
  const questions = await calculateQuestionAnalytics(db, sessionId, quiz);
  const topDifficultQuestions = questions
    .filter((question) => question.correctRate < 1)
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 3)
    .map((question) => ({
      questionIndex: question.questionIndex,
      questionText: question.questionText,
      correctRate: question.correctRate,
      incorrectCount: Math.round((1 - question.correctRate) * progress.submittedCount),
    }));

  return {
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      totalQuestions: quiz.questions.length,
    },
    progress,
    scores,
    questions,
    topDifficultQuestions,
  };
}

async function calculateProgress(db: D1Database, sessionId: string) {
  const participants = await db.prepare(`
    SELECT username, joined_at, submitted_at
    FROM live_exam_participants
    WHERE live_exam_id = ?
  `).bind(sessionId).all<{ username: string; joined_at: string; submitted_at: string | null }>();

  const rows = participants.results || [];
  const submittedCount = rows.filter((participant) => participant.submitted_at).length;
  return {
    totalParticipants: rows.length,
    submittedCount,
    submittedPercentage: rows.length > 0 ? round((submittedCount / rows.length) * 100) : 0,
    notSubmittedStudents: rows
      .filter((participant) => !participant.submitted_at)
      .map((participant) => ({ username: participant.username, joinedAt: participant.joined_at })),
  };
}

async function calculateScoreDistribution(db: D1Database, sessionId: string) {
  const participants = await db.prepare(`
    SELECT score
    FROM live_exam_participants
    WHERE live_exam_id = ? AND submitted_at IS NOT NULL AND score IS NOT NULL
  `).bind(sessionId).all<{ score: number }>();
  const values = (participants.results || []).map((row) => Number(row.score));
  const ranges = [
    { range: '0-2', min: 0, max: 2, includeMax: false },
    { range: '2-4', min: 2, max: 4, includeMax: false },
    { range: '4-6', min: 4, max: 6, includeMax: false },
    { range: '6-8', min: 6, max: 8, includeMax: false },
    { range: '8-10', min: 8, max: 10, includeMax: true },
  ];
  const distribution = ranges.map((range) => {
    const count = values.filter((score) => score >= range.min && (range.includeMax ? score <= range.max : score < range.max)).length;
    return { range: range.range, count, percentage: values.length > 0 ? round((count / values.length) * 100) : 0 };
  });

  if (values.length === 0) {
    return { distribution, average: 0, median: 0, min: 0, max: 0, standardDeviation: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const average = values.reduce((sum, score) => sum + score, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((sum, score) => sum + ((score - average) ** 2), 0) / values.length;

  return {
    distribution,
    average: round(average),
    median: round(median),
    min: Math.min(...values),
    max: Math.max(...values),
    standardDeviation: round(Math.sqrt(variance)),
  };
}

async function calculateQuestionAnalytics(db: D1Database, sessionId: string, quiz: Quiz) {
  const participants = await db.prepare(`
    SELECT answers
    FROM live_exam_participants
    WHERE live_exam_id = ? AND submitted_at IS NOT NULL AND answers IS NOT NULL
  `).bind(sessionId).all<{ answers: string }>();

  const gradingDetails = (participants.results || []).map((participant) => {
    let answers: Record<string, any> = {};
    try {
      answers = JSON.parse(participant.answers || '{}');
    } catch {
      answers = {};
    }
    return calculateStudentScore(quiz, answers).details;
  });

  const timingRows = await db.prepare(`
    SELECT question_index,
           AVG(time_spent_seconds) AS avg_time,
           MIN(time_spent_seconds) AS min_time,
           MAX(time_spent_seconds) AS max_time
    FROM live_exam_student_timing
    WHERE session_id = ?
    GROUP BY question_index
  `).bind(sessionId).all<{
    question_index: number;
    avg_time: number | null;
    min_time: number | null;
    max_time: number | null;
  }>();
  const timingMap = new Map((timingRows.results || []).map((row) => [Number(row.question_index), row]));

  return quiz.questions.map((question, index) => {
    const attempts = gradingDetails.map((details) => details.find((detail) => detail.questionId === question.id));
    const correctCount = attempts.filter((detail) => detail?.isCorrect).length;
    const totalAttempts = attempts.length;
    const correctRate = totalAttempts > 0 ? correctCount / totalAttempts : 0;
    const timing = timingMap.get(index);
    return {
      questionIndex: index,
      questionText: String((question as any).question || (question as any).mainQuestion || `Câu ${index + 1}`),
      correctRate: round(correctRate, 2),
      incorrectRate: round(1 - correctRate, 2),
      avgTimeSeconds: timing?.avg_time ?? null,
      minTimeSeconds: timing?.min_time ?? null,
      maxTimeSeconds: timing?.max_time ?? null,
    };
  });
}

export async function trackQuestionTiming(
  db: D1Database,
  sessionId: string,
  participantId: string,
  questionIndex: number,
  timeSpentSeconds: number,
): Promise<void> {
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || !Number.isFinite(timeSpentSeconds) || timeSpentSeconds < 0) {
    throw new Error('Invalid timing data');
  }
  await db.prepare(`
    INSERT INTO live_exam_student_timing
    (id, session_id, participant_id, question_index, time_spent_seconds, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(nanoid(), sessionId, participantId, questionIndex, timeSpentSeconds, new Date().toISOString()).run();
}

export async function batchTrackQuestionTiming(
  db: D1Database,
  sessionId: string,
  participantId: string,
  timings: Array<{ questionIndex: number; timeSpentSeconds: number }>,
): Promise<void> {
  if (timings.length === 0) return;
  if (timings.length > 200) throw new Error('Too many timing records');
  for (const timing of timings) {
    if (!Number.isInteger(timing.questionIndex) || timing.questionIndex < 0 || !Number.isFinite(timing.timeSpentSeconds) || timing.timeSpentSeconds < 0) {
      throw new Error('Invalid timing data');
    }
  }

  const createdAt = new Date().toISOString();
  const statements = timings.map((timing) => db.prepare(`
    INSERT INTO live_exam_student_timing
    (id, session_id, participant_id, question_index, time_spent_seconds, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(nanoid(), sessionId, participantId, timing.questionIndex, timing.timeSpentSeconds, createdAt));
  await db.batch(statements);
}
