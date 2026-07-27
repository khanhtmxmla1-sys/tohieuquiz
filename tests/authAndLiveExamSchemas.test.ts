import { describe, expect, it } from 'vitest';
import {
  AuthSessionSchema,
  validateAccessCode,
  validateLoginCredentials,
  validateStudentInfo,
  validateTeacher,
} from '../schemas/auth.schema';
import {
  AntiCheatWarningSchema,
  CreateLiveExamRequestSchema,
  JoinLiveExamRequestSchema,
  LiveExamActivitySchema,
  LiveExamParticipantSchema,
  LiveExamSessionSchema,
  SubmitAnswersRequestSchema,
  TeacherControlRequestSchema,
  UpdateActivityRequestSchema,
  WaitingRoomChatMessageSchema,
  WaitingRoomChatSettingsSchema,
} from '../schemas/liveExam.schema';
import { LiveExamStatus, TeacherAction } from '../src/types/liveExam.types';

const now = '2026-07-27T08:00:00.000Z';

describe('authentication schemas', () => {
  it('accepts valid login, teacher, and persisted session data', () => {
    expect(validateLoginCredentials({ username: 'teacher_01', password: 'safe-pass' }).success).toBe(true);
    expect(validateTeacher({ username: 'teacher_01', password: 'safe-pass', fullName: 'Cô An' }).success).toBe(true);
    expect(AuthSessionSchema.safeParse({ isLoggedIn: true, teacherName: 'Cô An', isAdmin: false }).success).toBe(true);
  });

  it('rejects malformed credentials and teacher records', () => {
    expect(validateLoginCredentials({ username: 'bad name', password: '123' }).success).toBe(false);
    expect(validateTeacher({ username: 'ab', password: '123', fullName: '' }).success).toBe(false);
  });

  it('validates Vietnamese student information and access codes', () => {
    expect(validateStudentInfo({ studentName: 'Nguyễn Văn An', studentClass: '3A1' }).success).toBe(true);
    expect(validateStudentInfo({ studentName: 'An 123', studentClass: '6A1' }).success).toBe(false);
    expect(validateAccessCode('ABC123').success).toBe(true);
    expect(validateAccessCode('abc-12').success).toBe(false);
  });
});

describe('live exam request schemas', () => {
  it('applies safe defaults when creating an exam', () => {
    const result = CreateLiveExamRequestSchema.parse({
      title: 'Kiểm tra Toán',
      quizId: 'quiz-1',
      classId: 'class-3a',
      duration: 30,
      settings: {},
    });

    expect(result.settings).toEqual({
      randomizeAnswers: true,
      showLeaderboard: true,
      allowLateJoin: false,
    });
  });

  it('validates join, submission, activity, and teacher-control requests', () => {
    expect(JoinLiveExamRequestSchema.safeParse({
      accessCode: 'ABC123',
      studentId: 'student-1',
      username: 'An',
    }).success).toBe(true);
    expect(JoinLiveExamRequestSchema.safeParse({
      accessCode: 'abc123',
      studentId: '',
      username: 'A',
    }).success).toBe(false);

    expect(SubmitAnswersRequestSchema.safeParse({
      liveExamId: 'exam-1',
      studentId: 'student-1',
      answers: { q1: 'A', q2: ['B', 'C'] },
    }).success).toBe(true);
    expect(UpdateActivityRequestSchema.safeParse({
      liveExamId: 'exam-1',
      studentId: 'student-1',
      currentQuestion: 2,
      answeredCount: 1,
    }).success).toBe(true);
    expect(TeacherControlRequestSchema.safeParse({
      action: TeacherAction.START_EXAM,
      liveExamId: 'exam-1',
      teacherId: 'teacher-1',
    }).success).toBe(true);
  });

  it('normalizes waiting-room chat and validates anti-cheat warnings', () => {
    expect(WaitingRoomChatMessageSchema.parse({ content: '  Em đã sẵn sàng  ' }).content).toBe('Em đã sẵn sàng');
    expect(WaitingRoomChatMessageSchema.safeParse({ content: '' }).success).toBe(false);
    expect(WaitingRoomChatSettingsSchema.safeParse({ enabled: true }).success).toBe(true);
    expect(AntiCheatWarningSchema.safeParse({
      type: 'tab_switch',
      timestamp: now,
      details: 'Student left the tab',
    }).success).toBe(true);
  });
});

describe('live exam persistence schemas', () => {
  it('accepts complete session, participant, and activity records', () => {
    const settings = {
      randomizeAnswers: true,
      showLeaderboard: true,
      allowLateJoin: false,
      passingScore: 50,
    };

    expect(LiveExamSessionSchema.safeParse({
      id: 'exam-1',
      title: 'Kiểm tra Toán',
      quizId: 'quiz-1',
      teacherId: 'teacher-1',
      classId: 'class-3a',
      duration: 30,
      scheduledAt: now,
      settings,
      status: LiveExamStatus.SCHEDULED,
      accessCode: 'ABC123',
      createdAt: now,
      updatedAt: now,
    }).success).toBe(true);

    expect(LiveExamParticipantSchema.safeParse({
      id: 'participant-1',
      liveExamId: 'exam-1',
      studentId: 'student-1',
      username: 'An',
      joinedAt: now,
      answers: { q1: 'A' },
      score: 80,
      correctCount: 8,
      wrongCount: 2,
      rank: 1,
      warnings: [{ type: 'fullscreen_exit', timestamp: now }],
      createdAt: now,
      updatedAt: now,
    }).success).toBe(true);

    expect(LiveExamActivitySchema.safeParse({
      liveExamId: 'exam-1',
      studentId: 'student-1',
      currentQuestion: 3,
      answeredCount: 2,
      lastActivity: now,
      isOnline: true,
    }).success).toBe(true);
  });
});
