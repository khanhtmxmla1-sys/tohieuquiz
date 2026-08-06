import React from 'react';
import { QuizCreationActions } from '../quiz-creation';

interface QuizCreationChoicePanelProps {
  manualQuizWorkspaceEnabled: boolean;
  onCreateWithAi: () => void;
  onCreateManually: () => void;
}

const QuizCreationChoicePanel: React.FC<QuizCreationChoicePanelProps> = ({
  manualQuizWorkspaceEnabled,
  onCreateWithAi,
  onCreateManually,
}) => (
  <section aria-labelledby="quiz-creation-choice-heading">
    <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold text-blue-700">Bắt đầu tạo đề</p>
        <h2
          id="quiz-creation-choice-heading"
          className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
        >
          Tạo đề kiểm tra
        </h2>
      </div>
      <p className="max-w-md text-sm leading-6 text-slate-600">
        {manualQuizWorkspaceEnabled
          ? 'Chọn AI để tạo nhanh hoặc tự soạn từng câu theo mục tiêu bài học.'
          : 'Mở công cụ tạo đề hiện tại để bắt đầu xây dựng bài kiểm tra.'}
      </p>
    </div>

    <QuizCreationActions
      layout="cards"
      manualQuizWorkspaceEnabled={manualQuizWorkspaceEnabled}
      onCreateWithAi={onCreateWithAi}
      onCreateManually={onCreateManually}
    />
  </section>
);

export default QuizCreationChoicePanel;
