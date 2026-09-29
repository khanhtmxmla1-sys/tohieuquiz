import { describe, expect, it } from 'vitest';
import { plainTextToRichText } from '../shared/question-rich-text.contract';
import {
  buildAssignmentReviewQuiz,
  buildAssignedQuizzes,
  buildSelectedAssignmentAnswers,
  buildPracticeCatalog,
  getAttendanceBadgeText,
  getRewardSummary,
} from '../src/features/student-dashboard/model';

describe('student dashboard assignment model', () => {
  it('keeps ready work before completed work and sorts ready work by deadline', () => {
    const assignments = [
      { id: 'completed-assignment', quizId: 'completed', quizTitle: 'Đã hoàn thành', attemptCount: 1, maxAttempts: 1, deadline: '2026-07-20T00:00:00.000Z', createdAt: '2026-07-18T00:00:00.000Z' },
      { id: 'later-assignment', quizId: 'later', quizTitle: 'Nộp sau', attemptCount: 0, maxAttempts: 1, deadline: '2026-07-22T00:00:00.000Z', createdAt: '2026-07-18T00:00:00.000Z' },
      { id: 'earlier-assignment', quizId: 'earlier', quizTitle: 'Nộp trước', attemptCount: 0, maxAttempts: 1, deadline: '2026-07-19T00:00:00.000Z', createdAt: '2026-07-18T00:00:00.000Z' },
    ] as any;

    const result = buildAssignedQuizzes(assignments, []);

    expect(result.map((quiz) => quiz.id)).toEqual(['earlier', 'later', 'completed']);
    expect(result[0]._assignmentData?.id).toBe('earlier-assignment');
  });

  it('rebuilds the submitted question order from stored snapshots', () => {
    const quiz = {
      id: 'quiz-1',
      title: 'Quiz',
      questions: [
        { id: 'q1', question: 'Current question 1' },
        { id: 'q2', question: 'Current question 2' },
      ],
    } as any;
    const answers = {
      _questionOrder: ['q2', 'q1'],
      q1: {
        selectedAnswer: 'A',
        isCorrect: true,
        questionSnapshot: { id: 'q1', question: 'Submitted question 1' },
      },
      q2: {
        selectedAnswer: 'B',
        isCorrect: false,
        questionSnapshot: { id: 'q2', question: 'Submitted question 2' },
      },
    };

    const reviewQuiz = buildAssignmentReviewQuiz(quiz, answers);

    expect(reviewQuiz.questions.map((question) => question.id)).toEqual(['q2', 'q1']);
    expect((reviewQuiz.questions[0] as any).question).toBe('Submitted question 2');
    expect(buildSelectedAssignmentAnswers(answers)).toEqual({ q1: 'A', q2: 'B' });
  });

  it('keeps assignment review snapshot-first for rich and legacy historical questions', () => {
    const currentRich = plainTextToRichText('Rich hiện tại');
    const historicalRich = plainTextToRichText('Rich lúc nộp');
    const quiz = {
      id: 'quiz-history', title: 'Quiz',
      questions: [
        { id: 'rich', question: 'Current rich', questionRichText: currentRich },
        { id: 'legacy', question: 'Current legacy', questionRichText: currentRich },
        { id: 'current-only', question: 'Current only', questionRichText: currentRich },
      ],
    } as any;
    const answers = {
      rich: { selectedAnswer: 'A', questionSnapshot: { id: 'rich', question: 'Historical rich', questionRichText: historicalRich } },
      legacy: { selectedAnswer: 'B', questionSnapshot: { id: 'legacy', question: 'Historical plain' } },
      'current-only': { selectedAnswer: 'C' },
    } as any;

    const reviewQuiz = buildAssignmentReviewQuiz(quiz, answers);
    const byId = new Map(reviewQuiz.questions.map((question: any) => [question.id, question]));
    expect((byId.get('rich') as any).questionRichText).toEqual(historicalRich);
    expect((byId.get('legacy') as any).questionRichText).toBeUndefined();
    expect((byId.get('legacy') as any).question).toBe('Historical plain');
    expect((byId.get('current-only') as any).questionRichText).toEqual(currentRich);
  });
});

describe('student dashboard practice model', () => {
  it('groups canonical topic data by subject and keeps the configured order', () => {
    const catalog = buildPracticeCatalog([
      { name: '#phep_nhan', count: 30 },
      { name: '#phan_so', count: 20 },
      { name: '#english', count: 15 },
    ]);

    expect(catalog.subjects.map((subject) => subject.id)).toEqual([
      'toan',
      'tieng-viet',
      'tu-nhien-xa-hoi',
      'tieng-anh',
      'tin-hoc',
    ]);
    expect(catalog.subjects.find((subject) => subject.id === 'toan')).toMatchObject({
      topicCount: 2,
      questionCount: 50,
      status: 'available',
    });
    expect(catalog.subjects.find((subject) => subject.id === 'tieng-anh')).toMatchObject({
      topicCount: 1,
      questionCount: 15,
      status: 'available',
    });
    expect(catalog.comingSoonSubjects.map((subject) => subject.id)).toContain('tieng-viet');
  });
});

describe('student dashboard attendance model', () => {
  it('renders the fixed two-question reward preview from server-provided values', () => {
    expect(getAttendanceBadgeText(false, true, {
      attendanceDayNumber: 4,
      nextRewardCoins: 5,
      nextRewardExp: 10,
    })).toBe('Điểm danh hôm nay · 2 câu · +5 Xu +10 EXP');
  });

  it('uses compact labels when attendance is already claimed or unavailable', () => {
    expect(getAttendanceBadgeText(true, true, null)).toBe('Đã điểm danh hôm nay');
    expect(getAttendanceBadgeText(false, false, null)).toBe('Điểm danh đang tắt');
  });
});

describe('student dashboard reward model', () => {
  it('maps each reward type to student-facing copy', () => {
    expect(getRewardSummary({ type: 'COINS', coins: 25 } as any)?.description).toContain('+25 Xu');
    expect(getRewardSummary({ type: 'COLLECTIBLE' } as any)?.title).toBe('Vật phẩm sưu tầm');
    expect(getRewardSummary({ type: 'HINT_TOKEN', amount: 2 } as any)?.description).toContain('2 vé gợi ý');
    expect(getRewardSummary({ type: 'STREAK_SHIELD', amount: 1 } as any)?.title).toBe('Khiên giữ chuỗi');
  });
});
