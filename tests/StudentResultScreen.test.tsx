import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';
import ResultScreen from '../src/components/student/ResultScreen';
import { plainTextToRichText } from '../shared/question-rich-text.contract';

vi.mock('../src/services/weaknessProfileService', () => ({
  fetchWeaknessProfile: vi.fn().mockResolvedValue({ subjects: [], coveragePercent: 100, unclassifiedQuestionCount: 0 }),
}));

const quiz: Quiz = {
  id: 'quiz-result-screen',
  title: 'Ôn tập Toán',
  classLevel: '5',
  category: 'toan',
  timeLimit: 30,
  createdAt: '2026-07-20T00:00:00.000Z',
  questions: [
    { id: 'q1', type: QuestionType.MCQ, question: 'Câu một', options: ['A', 'B'], correctAnswer: 'A' },
    { id: 'q2', type: QuestionType.MCQ, question: 'Câu hai', options: ['A', 'B'], correctAnswer: 'B' },
    { id: 'q3', type: QuestionType.SHORT_ANSWER, question: 'Câu ba', correctAnswer: '10' },
  ],
};

const result: StudentResult = {
  id: 'result-1',
  quizId: quiz.id,
  quizTitle: quiz.title,
  studentName: 'Nguyễn Văn An',
  studentClass: '5A',
  score: 3.3,
  correctCount: 1,
  totalQuestions: 3,
  timeTaken: 0.5,
  submittedAt: '2026-07-20T12:00:00.000Z',
  answers: {
    q1: { selectedAnswer: 'A', isCorrect: true, questionSnapshot: quiz.questions[0] },
    q2: { selectedAnswer: 'A', isCorrect: false, questionSnapshot: quiz.questions[1] },
    q3: { selectedAnswer: '', isCorrect: false, questionSnapshot: quiz.questions[2] },
  },
};

const renderScreen = (resultOverride: StudentResult = result) => render(
  <ResultScreen
    quiz={quiz}
    result={resultOverride}
    answers={{ q1: 'A', q2: 'A', q3: '' }}
    onExit={vi.fn()}
    studentName="Nguyễn Văn An"
    studentClass="5A"
  />,
);

describe('student result screen', () => {
  it('can open directly on the full answer review', () => {
    render(
      <ResultScreen
        quiz={quiz}
        result={result}
        answers={{ q1: 'A', q2: 'A', q3: '' }}
        initialTab="review"
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Xem lại bài' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Xem lại bài' })).toBeVisible();
    expect(screen.getByText('Câu một')).toBeInTheDocument();
    expect(screen.getByText('Câu hai')).toBeInTheDocument();
    expect(screen.getByText('Câu ba')).toBeInTheDocument();
  });

  it('renders rich prompt in review while keeping server review details authoritative', () => {
    const questionRichText = plainTextToRichText('Rich historical prompt');
    questionRichText.doc.content[0].content = [{
      type: 'text', text: 'Rich historical prompt', marks: [{ type: 'bold' }],
    }];
    const richQuiz: Quiz = {
      ...quiz,
      questions: [{
        id: 'rich-review', type: QuestionType.MCQ, question: 'Plain fallback prompt',
        questionRichText, options: ['A', 'B'], correctAnswer: 'A',
      }],
    };
    const richResult: StudentResult = {
      ...result,
      quizId: richQuiz.id,
      score: 0,
      correctCount: 0,
      totalQuestions: 1,
      answers: {
        'rich-review': {
          selectedAnswer: 'B', isCorrect: false, questionSnapshot: richQuiz.questions[0],
        },
      },
      reviewDetails: [{
        questionId: 'rich-review', type: 'MCQ', status: 'wrong', isCorrect: false,
        studentAnswer: { kind: 'text', lines: [{ value: 'SERVER-STUDENT' }] },
        correctAnswer: { kind: 'text', lines: [{ value: 'SERVER-CORRECT' }] },
      }],
    } as any;

    render(
      <ResultScreen
        quiz={richQuiz}
        result={richResult}
        answers={{ 'rich-review': 'B' }}
        initialTab="review"
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByTestId('question-rich-text-renderer')).toBeInTheDocument();
    expect(screen.getByText('Rich historical prompt').closest('strong')).not.toBeNull();
    expect(screen.queryByText('Plain fallback prompt')).not.toBeInTheDocument();
    expect(screen.getByText('SERVER-STUDENT')).toBeInTheDocument();
    expect(screen.getByText('SERVER-CORRECT')).toBeInTheDocument();
  });

  it('presents a compact factual result summary and three useful areas', () => {
    renderScreen();

    expect(screen.getByRole('tab', { name: 'Kết quả' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Xem lại bài' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kế hoạch ôn tập' })).toBeInTheDocument();
    expect(screen.getByText('3.3/10')).toBeInTheDocument();
    expect(screen.getByText('1 đúng · 1 sai · 1 chưa làm')).toBeInTheDocument();
    expect(screen.getByText('30 giây')).toBeInTheDocument();
    expect(screen.getByText('Em còn 1 câu chưa làm.')).toBeInTheDocument();
    expect(screen.queryByText('Tóm tắt bài làm')).not.toBeInTheDocument();
    expect(screen.queryByText('Cần cố gắng thêm!')).not.toBeInTheDocument();
  });

  it('filters review items by incorrect and skipped outcomes', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: 'Xem lại bài' }));

    const review = screen.getByRole('tabpanel', { name: 'Xem lại bài' });
    expect(within(review).getByText('Câu một')).toBeInTheDocument();
    expect(within(review).getByText('Câu hai')).toBeInTheDocument();
    expect(within(review).getByText('Câu ba')).toBeInTheDocument();

    fireEvent.click(within(review).getByRole('button', { name: 'Câu sai 1' }));
    expect(within(review).queryByText('Câu một')).not.toBeInTheDocument();
    expect(within(review).getByText('Câu hai')).toBeInTheDocument();
    expect(within(review).queryByText('Câu ba')).not.toBeInTheDocument();

    fireEvent.click(within(review).getByRole('button', { name: 'Chưa làm 1' }));
    expect(within(review).queryByText('Câu hai')).not.toBeInTheDocument();
    expect(within(review).getByText('Câu ba')).toBeInTheDocument();
  });

  it('does not render technical metadata for a skipped legacy answer', () => {
    const skippedQuiz: Quiz = {
      ...quiz,
      questions: [{
        id: 'drag-1',
        type: QuestionType.DRAG_DROP,
        question: 'Kéo các số vào đúng chỗ trống.',
        text: '[blank-0]',
        blanks: [{ id: 'blank-0', correctAnswer: '24' }],
        distractors: ['24', '6'],
      } as any],
    };
    const skippedResult: StudentResult = {
      ...result,
      quizId: skippedQuiz.id,
      score: 0,
      correctCount: 0,
      totalQuestions: 1,
      answers: {
        'drag-1': {
          selectedAnswer: {
            isCorrect: false,
            status: 'skipped',
            gradingVersion: '2.0.0',
            questionSnapshot: { id: 'drag-1', type: 'DRAG_DROP' },
          },
          isCorrect: false,
          status: 'skipped',
        },
      },
      validationDetails: [{ questionId: 'drag-1', isCorrect: false, status: 'skipped' }],
    };

    render(
      <ResultScreen
        quiz={skippedQuiz}
        result={skippedResult}
        answers={{}}
        initialTab="review"
        onExit={vi.fn()}
      />,
    );

    expect(screen.getByText('Chưa trả lời')).toBeInTheDocument();
    expect(screen.getByText('Chưa làm')).toBeInTheDocument();
    expect(screen.queryByText(/gradingVersion/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/questionSnapshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\[object Object\]/i)).not.toBeInTheDocument();
  });

  it('explains voided questions and keeps them out of wrong-answer counts', () => {
    const voidedResult: StudentResult = {
      ...result,
      score: 10,
      correctCount: 2,
      questionCount: 3,
      totalQuestions: 2,
      voidedCount: 1,
      answers: {
        q1: { selectedAnswer: 'A', isCorrect: true, status: 'correct', questionSnapshot: quiz.questions[0] },
        q2: { selectedAnswer: 'B', isCorrect: true, status: 'correct', questionSnapshot: quiz.questions[1] },
        q3: { selectedAnswer: '10', isCorrect: false, status: 'voided', questionSnapshot: quiz.questions[2] },
      },
      validationDetails: [
        { questionId: 'q1', isCorrect: true, status: 'correct' },
        { questionId: 'q2', isCorrect: true, status: 'correct' },
        { questionId: 'q3', isCorrect: false, status: 'voided', issueCode: 'MISSING_CORRECT_ANSWER' },
      ],
    };

    renderScreen(voidedResult);

    expect(screen.getByText('2 đúng · 0 sai · 0 chưa làm')).toBeInTheDocument();
    expect(screen.getByText('Điểm được tính trên 2 câu hợp lệ. 1 câu không được tính do lỗi dữ liệu.')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Kế hoạch ôn tập' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Xem lại bài' }));
    expect(screen.getByText('Không tính điểm')).toBeInTheDocument();
    expect(screen.getAllByText('Câu hỏi không được tính điểm do lỗi dữ liệu').length).toBeGreaterThan(0);
  });

  it('does not show a study-plan tab when there are no answered incorrect questions', () => {
    const perfectResult: StudentResult = {
      ...result,
      score: 10,
      correctCount: 3,
      answers: {
        q1: { selectedAnswer: 'A', isCorrect: true, questionSnapshot: quiz.questions[0] },
        q2: { selectedAnswer: 'B', isCorrect: true, questionSnapshot: quiz.questions[1] },
        q3: { selectedAnswer: '10', isCorrect: true, questionSnapshot: quiz.questions[2] },
      },
    };

    renderScreen(perfectResult);
    expect(screen.queryByRole('tab', { name: 'Kế hoạch ôn tập' })).not.toBeInTheDocument();
    expect(screen.getByText('Em đã hoàn thành tất cả câu hỏi.')).toBeInTheDocument();
  });
});
