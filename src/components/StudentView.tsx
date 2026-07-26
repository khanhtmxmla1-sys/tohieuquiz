import React from 'react';
import { Quiz, StudentResult } from '../types';
import {
  AccessCodeForm,
  StudentInfoForm,
  SubmitConfirmModal,
  ResultScreen,
  QuestionRenderer,
} from './student';
import RewardOverlay from './gamification/RewardOverlay';
import { useQuizPlayer } from '../features/quiz-player/hooks/useQuizPlayer';
import QuizHeader from '../features/quiz-player/components/QuizHeader';
import QuizNavigation from '../features/quiz-player/components/QuizNavigation';
import QuizPagination from '../features/quiz-player/components/QuizPagination';
import { useQuizPageNavigation } from '../features/quiz-player/hooks/useQuizPageNavigation';

interface Props {
  quiz: Quiz;
  onExit: () => void;
  onSaveResult: (result: StudentResult) => void | StudentResult | Promise<void | StudentResult>;
}

const StudentView: React.FC<Props> = ({ quiz, onExit, onSaveResult }) => {
  const {
    step, studentName, setStudentName, studentClass, setStudentClass, studentAvatar,
    enteredCode, setEnteredCode, codeError, answers, timeLeft, result,
    shuffledQuestions, isSubmitting, submitError, showReward, setShowReward,
    showSubmitConfirm, setShowSubmitConfirm,
    rewardData, currentPage, setCurrentPage, totalPages, questionsOnCurrentPage,
    handleStart, handleCodeVerify, handleAnswerChange, handleMatchingClick, handleSubmit, handleRetryReward, isQuestionAnswered,
  } = useQuizPlayer({ quiz, onExit, onSaveResult });

  const QUESTIONS_PER_PAGE = 10;
  const { activeQuestionId, changePage } = useQuizPageNavigation({
    questions: shuffledQuestions,
    currentPage,
    totalPages,
    questionsPerPage: QUESTIONS_PER_PAGE,
    setCurrentPage,
  });

  if (step === 'code') {
    return (
      <AccessCodeForm
        quizTitle={quiz.title}
        enteredCode={enteredCode}
        onCodeChange={setEnteredCode}
        onVerify={handleCodeVerify}
        codeError={codeError}
        onExit={onExit}
      />
    );
  }

  if (step === 'info') {
    return (
      <StudentInfoForm
        quiz={quiz}
        studentName={studentName}
        onNameChange={setStudentName}
        studentClass={studentClass}
        onClassChange={setStudentClass}
        onStart={handleStart}
        onExit={onExit}
      />
    );
  }

  if (step === 'quiz') {
    const answeredCount = shuffledQuestions.filter(isQuestionAnswered).length;
    const unansweredCount = shuffledQuestions.length - answeredCount;

    return (
      <div className="student-quiz-shell flex min-h-screen flex-col bg-[#FFFDF7] font-['Be_Vietnam_Pro'] text-[#172033]">
        <QuizHeader
          title={quiz.title}
          timeLeft={timeLeft}
          totalQuestions={shuffledQuestions.length}
          answeredCount={answeredCount}
          isPractice={quiz.isPractice || false}
          studentName={studentName}
          avatar={studentAvatar}
        />

        <div className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-5 sm:px-5 md:py-7 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <aside className="hidden w-60 shrink-0 lg:block">
              <QuizNavigation
                questions={shuffledQuestions}
                isQuestionAnswered={isQuestionAnswered}
                activeQuestionId={activeQuestionId}
                QUESTIONS_PER_PAGE={QUESTIONS_PER_PAGE}
                onPageChange={changePage}
              />
            </aside>

            <main className="min-w-0 flex-1">
              <div className="space-y-6">
                {questionsOnCurrentPage.map((question, index) => (
                  <div
                    key={question.id}
                    id={`question-${question.id}`}
                    tabIndex={-1}
                    aria-label={`Câu ${(currentPage - 1) * QUESTIONS_PER_PAGE + index + 1}`}
                    className="scroll-mt-28 focus:outline-none"
                  >
                    <QuestionRenderer
                      question={question}
                      quizId={quiz.id}
                      index={(currentPage - 1) * QUESTIONS_PER_PAGE + index}
                      answers={answers}
                      onAnswerChange={handleAnswerChange}
                      onMatchingClick={handleMatchingClick}
                    />
                  </div>
                ))}
              </div>

              <QuizPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={changePage}
                onSubmit={() => setShowSubmitConfirm(true)}
                isSubmitting={isSubmitting}
              />

              {submitError ? (
                <div className="mt-4 rounded-[10px] border border-[#E76F51]/30 bg-[#FFF4F1] p-4 text-center text-sm font-medium text-[#B94D36]">
                  {submitError}
                </div>
              ) : null}
            </main>
          </div>
        </div>

        <SubmitConfirmModal
          isOpen={showSubmitConfirm}
          unansweredCount={unansweredCount}
          onCancel={() => setShowSubmitConfirm(false)}
          onConfirm={() => {
            setShowSubmitConfirm(false);
            handleSubmit();
          }}
        />
      </div>
    );
  }

  if (step === 'result' && result) {
    return (
      <>
        <ResultScreen
          quiz={quiz}
          result={result}
          answers={answers}
          onExit={onExit}
          studentName={studentName}
          studentClass={studentClass}
        />

        {showReward && rewardData ? (
          <RewardOverlay
            data={rewardData}
            onViewResult={() => setShowReward(false)}
            onExit={onExit}
            onRetryReward={handleRetryReward}
          />
        ) : null}
      </>
    );
  }

  return null;
};

export default StudentView;
