import React from 'react';
import { Quiz, StudentResult } from '../types';
import {
  AccessCodeForm,
  StudentInfoForm,
  QuizStartNotice,
  SubmitConfirmModal,
  ResultScreen,
  QuestionRenderer,
} from './student';
import RewardOverlay from './gamification/RewardOverlay';
import { useQuizPlayer } from '../features/quiz-player/hooks/useQuizPlayer';
import QuizHeader from '../features/quiz-player/components/QuizHeader';
import QuizNavigation from '../features/quiz-player/components/QuizNavigation';
import QuizPagination from '../features/quiz-player/components/QuizPagination';
import QuizSubmitButton from '../features/quiz-player/components/QuizSubmitButton';
import MobileQuizNavigator from '../features/quiz-player/components/MobileQuizNavigator';
import { useQuizPageNavigation } from '../features/quiz-player/hooks/useQuizPageNavigation';
import { useRandomizationPolicy } from '../features/randomization/useRandomizationPolicy';

interface Props {
  quiz: Quiz;
  onExit: () => void;
  onSaveResult: (result: StudentResult) => void | StudentResult | Promise<void | StudentResult>;
}

const StudentView: React.FC<Props> = ({ quiz, onExit, onSaveResult }) => {
  const randomizationPolicy = useRandomizationPolicy();
  const {
    step, studentName, setStudentName, studentClass, setStudentClass, studentAvatar,
    enteredCode, setEnteredCode, codeError, isVerifyingCode, answers, timeLeft, result,
    shuffledQuestions, isStarting, startError, isSubmitting, submitError, showReward, setShowReward,
    showSubmitConfirm, setShowSubmitConfirm,
    rewardData, currentPage, setCurrentPage, totalPages, questionsOnCurrentPage, quizProgress,
    handleStart, handleCodeVerify, handleAnswerChange, handleMatchingClick, handleSubmit, handleRetryReward,
  } = useQuizPlayer({ quiz, onExit, onSaveResult, randomizationPolicy });

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
        isVerifying={isVerifyingCode}
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

  if (step === 'notice') {
    return (
      <QuizStartNotice
        quiz={quiz}
        studentName={studentName}
        studentClass={studentClass}
        isStarting={isStarting}
        startError={startError}
        onStart={handleStart}
        onExit={onExit}
      />
    );
  }

  if (step === 'quiz') {
    return (
      <div className="student-quiz-shell flex min-h-screen flex-col bg-[#FFFDF7] font-['Be_Vietnam_Pro'] text-[#172033] lg:h-dvh lg:min-h-0 lg:overflow-hidden">
        <QuizHeader
          title={quiz.title}
          timeLeft={timeLeft}
          totalQuestions={shuffledQuestions.length}
          completedCount={quizProgress.completeCount}
          partialCount={quizProgress.partialCount}
          isPractice={quiz.isPractice || false}
          studentName={studentName}
          avatar={studentAvatar}
          showAvatar
        />

        <MobileQuizNavigator
          questions={shuffledQuestions}
          progressByQuestionId={quizProgress.byQuestionId}
          activeQuestionId={activeQuestionId}
          questionsPerPage={QUESTIONS_PER_PAGE}
          onPageChange={changePage}
        />

        <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 py-5 sm:px-5 md:py-7 lg:min-h-0 lg:overflow-hidden lg:px-8">
          <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch">
            <aside
              aria-label="Điều hướng bài làm"
              className="hidden w-60 shrink-0 lg:flex lg:min-h-0 lg:flex-col"
            >
              <QuizNavigation
                questions={shuffledQuestions}
                progressByQuestionId={quizProgress.byQuestionId}
                activeQuestionId={activeQuestionId}
                QUESTIONS_PER_PAGE={QUESTIONS_PER_PAGE}
                onPageChange={changePage}
                contained
              />

              <div className="mt-4 shrink-0">
                <QuizSubmitButton
                  onSubmit={() => setShowSubmitConfirm(true)}
                  isSubmitting={isSubmitting}
                  className="w-full"
                />

                {submitError ? (
                  <div className="mt-3 rounded-[10px] border border-[#E76F51]/30 bg-[#FFF4F1] p-3 text-center text-xs font-medium text-[#B94D36]">
                    {submitError}
                  </div>
                ) : null}
              </div>
            </aside>

            <main
              aria-label="Nội dung câu hỏi"
              className="min-w-0 flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
            >
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
                      randomizationPolicy={randomizationPolicy}
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
                hideSubmitOnDesktop
              />

              {submitError ? (
                <div className="mt-4 rounded-[10px] border border-[#E76F51]/30 bg-[#FFF4F1] p-4 text-center text-sm font-medium text-[#B94D36] lg:hidden">
                  {submitError}
                </div>
              ) : null}
            </main>
          </div>
        </div>

        <SubmitConfirmModal
          isOpen={showSubmitConfirm}
          emptyCount={quizProgress.emptyCount}
          partialCount={quizProgress.partialCount}
          onCancel={() => setShowSubmitConfirm(false)}
          onConfirm={() => {
            setShowSubmitConfirm(false);
            void handleSubmit();
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
