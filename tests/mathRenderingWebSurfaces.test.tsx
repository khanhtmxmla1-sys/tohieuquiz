import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';
import type { WaitingRoomChatMessage } from '../src/types/liveExam.types';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <span data-testid="mathjax">{children}</span>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const callApiMock = vi.hoisted(() => vi.fn());
vi.mock('../src/services/apiAdapter', () => ({ callApi: callApiMock }));

const getTestBankMock = vi.hoisted(() => vi.fn());
vi.mock('../src/services/testBankService', () => ({
  testBankService: {
    getTestBank: getTestBankMock,
    deleteQuestion: vi.fn(),
  },
}));

import ReviewTab from '../src/components/student/ResultScreen/tabs/ReviewTab';
import DrOwlModal from '../src/components/student/ResultScreen/DrOwlModal';
import { DifficultQuestionsCard } from '../src/components/LiveExam/Analytics/DifficultQuestionsCard';
import { TimeAnalysisCard } from '../src/components/LiveExam/Analytics/TimeAnalysisCard';
import { StudentHomeworkCard } from '../src/features/homework/components/StudentHomeworkCard';
import { HomeworkSubmissionModal } from '../src/features/homework/components/HomeworkSubmissionModal';
import DropdownRenderer from '../src/features/quiz-editor/components/QuestionCard/renderers/DropdownRenderer';
import { TestBankModal } from '../src/features/quiz-editor/components/TestBankModal';
import { WaitingRoomChatPanel } from '../src/components/LiveExam/WaitingRoomChatPanel';
import { WaitingRoomChatTeacherCard } from '../src/components/LiveExam/WaitingRoomChatTeacherCard';
import { AIInsightBox } from '../src/features/analytics/components/AIInsightBox';
import ChatBot from '../src/components/ChatBot/ChatBot';
import { useChatStore } from '../src/stores/useChatStore';

const formula = '$\\frac{3}{4} + \\sqrt{16} = 7$';

const formulaQuiz: Quiz = {
  id: 'quiz-math-review',
  title: 'Ôn tập phân số',
  classLevel: '5',
  category: 'toan',
  timeLimit: 20,
  createdAt: '2026-07-21T00:00:00.000Z',
  questions: [{
    id: 'q1',
    type: QuestionType.SHORT_ANSWER,
    question: `Tính ${formula}`,
    correctAnswer: '$\\frac{7}{4}$',
  }],
};

const formulaResult: StudentResult = {
  id: 'result-math-review',
  quizId: formulaQuiz.id,
  quizTitle: formulaQuiz.title,
  studentName: 'An',
  studentClass: '5A',
  score: 0,
  correctCount: 0,
  totalQuestions: 1,
  timeTaken: 1,
  submittedAt: '2026-07-21T00:00:00.000Z',
  answers: {
    q1: {
      selectedAnswer: '$\\frac{3}{2}$',
      isCorrect: false,
      questionSnapshot: formulaQuiz.questions[0],
    },
  },
};

const chatMessage = (overrides: Partial<WaitingRoomChatMessage>): WaitingRoomChatMessage => ({
  id: 'message-1',
  sessionId: 'live-1',
  senderId: 'student-1',
  senderName: 'An',
  senderRole: 'student',
  kind: 'message',
  content: formula,
  createdAt: '2026-07-21T00:00:00.000Z',
  ...overrides,
});

describe('math rendering on secondary web surfaces', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    callApiMock.mockReset();
    getTestBankMock.mockReset();
    useChatStore.setState({ isOpen: false, messages: [], isLoading: false, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('typesets questions, student answers, and correct answers in the result review', () => {
    render(
      <ReviewTab
        quiz={formulaQuiz}
        result={formulaResult}
        answers={{ q1: '$\\frac{3}{2}$' }}
      />,
    );

    expect(screen.getAllByTestId('mathjax')).toHaveLength(3);
    expect(screen.getByText(/\\frac\{3\}\{2\}/)).toBeInTheDocument();
    expect(screen.getByText(/\\frac\{7\}\{4\}/)).toBeInTheDocument();
  });

  it('keeps the full formula intact in difficult-question and timing analytics', () => {
    const longFormula = `So sánh $${'x+'.repeat(70)}\\frac{1}{2}=100$ PHẦN_CUỐI`;
    const { rerender } = render(
      <DifficultQuestionsCard
        sessionId="live-1"
        questions={[{ questionIndex: 0, questionText: longFormula, correctRate: 0.2, incorrectCount: 8 }]}
      />,
    );

    expect(screen.getByText(/PHẦN_CUỐI/)).toBeInTheDocument();
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThan(0);

    rerender(
      <TimeAnalysisCard
        questions={[{ questionIndex: 0, questionText: longFormula, avgTimeSeconds: 120, correctRate: 0.2 }]}
      />,
    );
    expect(screen.getByText(/PHẦN_CUỐI/)).toBeInTheDocument();
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThan(0);
  });

  it('typesets homework descriptions and dropdown correct answers', () => {
    const { rerender } = render(
      <StudentHomeworkCard
        assignment={{
          id: 'hw-1', title: 'Bài phân số', description: formula, subject: 'Toán',
          deadline: '2099-07-21T00:00:00.000Z', class_id: '5a', teacher_id: 'teacher-1',
          file_url: '', ai_content: '', created_at: '2026-07-21T00:00:00.000Z',
        }}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThan(0);

    rerender(
      <DropdownRenderer
        question={{
          id: 'dropdown-1', type: QuestionType.DROPDOWN, question: 'Điền đáp án',
          text: 'Giá trị là [1].', blanks: [{ id: '1', correctAnswer: '$\\frac{1}{2}$', options: ['$\\frac{1}{2}$'] }],
        } as any}
      />,
    );
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThan(0);
  });

  it('typesets graded homework descriptions and teacher feedback', () => {
    render(
      <HomeworkSubmissionModal
        assignment={{
          id: 'hw-math-modal', title: 'Bài toán', description: `Đề bài ${formula}`,
          subject: 'Toán', deadline: '2099-07-21T00:00:00.000Z', class_id: '5a',
          teacher_id: 'teacher-1', file_url: '', ai_content: '', created_at: '2026-07-21T00:00:00.000Z',
        } as any}
        submission={{
          id: 'submission-1', assignment_id: 'hw-math-modal', student_id: 'student-1',
          student_name: 'An', file_urls: ['https://example.com/bai-lam.png'], status: 'GRADED',
          score: 8, teacher_feedback: `Em sửa lại ${formula}`,
          submitted_at: '2026-07-21T00:00:00.000Z',
        } as any}
        studentId="student-1"
        studentName="An"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThanOrEqual(2);
  });

  it('typesets saved test-bank questions', async () => {
    getTestBankMock.mockResolvedValue([{
      id: 'bank-1', teacher_id: 'teacher-1', created_at: '2026-07-21T00:00:00.000Z',
      question_data: formulaQuiz.questions[0],
    }]);

    render(<TestBankModal isOpen onClose={vi.fn()} onAddQuestion={vi.fn()} teacherId="teacher-1" />);

    await waitFor(() => expect(getTestBankMock).toHaveBeenCalled());
    expect(await screen.findByText(/\\frac\{3\}\{4\}/)).toBeInTheDocument();
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThan(0);
  });

  it('typesets diagnosis, explanations, practice questions, and options from Dr Owl', async () => {
    callApiMock.mockResolvedValue({
      status: 'success',
      data: {
        diagnosis: `Em cần ôn ${formula}`,
        explanation: `1. Ta có ${formula}`,
        wrongQuestionIds: ['q1'],
        practiceQuestions: [{
          id: 'practice-1', question: `Tính ${formula}`,
          options: ['$\\frac{7}{4}$', '$\\frac{3}{2}$'], correctAnswer: '$\\frac{7}{4}$',
        }],
      },
    });

    render(
      <DrOwlModal
        isOpen onClose={vi.fn()} quizId="quiz-1" wrongQuestionIds={['q1']}
      />,
    );

    await screen.findByText(/Em cần ôn/);
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Uống thuốc ngay/i }));
    await waitFor(() => {
      expect(screen.getAllByTestId('mathjax').length).toBeGreaterThanOrEqual(3);
    });
  });

  it('typesets student and teacher waiting-room chat messages', () => {
    const messages = [chatMessage({})];
    const { rerender } = render(
      <WaitingRoomChatPanel
        messages={messages}
        chatEnabled
        currentUsername="Bình"
        onSendMessage={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThan(0);

    rerender(
      <WaitingRoomChatTeacherCard
        messages={messages}
        chatEnabled
        onSendAnnouncement={vi.fn(async () => undefined)}
        onToggleChat={vi.fn(async () => undefined)}
        onHideMessage={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThan(0);
  });

  it('does not type partial LaTeX while animating an AI insight', () => {
    vi.useFakeTimers();
    render(<AIInsightBox insight={`Nhận xét: ${formula}`} isLoading={false} onAnalyze={vi.fn()} />);

    expect(screen.getByText(/\\frac\{3\}\{4\}/)).toBeInTheDocument();
    expect(screen.getAllByTestId('mathjax').length).toBeGreaterThan(0);
  });

  it('typesets formulas in chatbot messages', () => {
    act(() => {
      useChatStore.setState({
        isOpen: true,
        isLoading: false,
        error: null,
        messages: [
          { role: 'user', content: `Hỏi ${formula}` },
          {
            role: 'assistant',
            content: `Trả lời: ${formula}`,
            sources: [{
              title: 'Tài liệu Toán', sourcePath: 'docs/toan.md', snippet: `Nguồn có ${formula}`,
            }],
          },
        ],
      });
    });

    render(<ChatBot />);
    expect(screen.getAllByTestId('mathjax')).toHaveLength(3);
  });
});
