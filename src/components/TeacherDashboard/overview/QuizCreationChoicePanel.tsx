import React from 'react';
import { Card } from '../../common';
import { QuizCreationActions } from '../quiz-creation';

interface QuizCreationChoicePanelProps {
  onCreateWithAi: () => void;
  onCreateManually: () => void;
}

const QuizCreationChoicePanel: React.FC<QuizCreationChoicePanelProps> = ({
  onCreateWithAi,
  onCreateManually,
}) => (
  <Card
    as="section"
    padding="sm"
    aria-labelledby="quiz-creation-choice-heading"
    className="rounded-[14px] shadow-none sm:p-1"
  >
    <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-medium text-sky-700">Bắt đầu tạo đề</p>
        <h2
          id="quiz-creation-choice-heading"
          className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl"
        >
          Tạo đề kiểm tra
        </h2>
      </div>
      <p className="max-w-md text-sm leading-5 text-slate-600">
        Chọn AI để tạo nhanh hoặc mở trình soạn toàn màn hình để tự kiểm soát từng câu hỏi.
      </p>
    </div>

    <QuizCreationActions
      layout="cards"
      onCreateWithAi={onCreateWithAi}
      onCreateManually={onCreateManually}
    />
  </Card>
);

export default QuizCreationChoicePanel;
