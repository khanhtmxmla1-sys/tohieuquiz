import { BarChart } from 'lucide-react';
import { Card } from '../../common';
import { QuestionAnalysisTable } from '../../teacher/ResultsView';
import type { AnalysisAttemptMode, QuestionAnalysis } from '../../../utils/statisticsUtils';

interface QuestionAnalysisSectionProps {
  activeQuizId: string;
  analysis: QuestionAnalysis[];
  cohortSize: number;
  attemptMode: AnalysisAttemptMode;
  onAttemptModeChange: (mode: AnalysisAttemptMode) => void;
  isLoading: boolean;
  error: string;
}

export const QuestionAnalysisSection = (props: QuestionAnalysisSectionProps) => {
  if (props.activeQuizId !== 'all') {
    return (
      <QuestionAnalysisTable
        analysis={props.analysis}
        showTopMissed={5}
        cohortSize={props.cohortSize}
        attemptMode={props.attemptMode}
        onAttemptModeChange={props.onAttemptModeChange}
        isLoading={props.isLoading}
        error={props.error}
      />
    );
  }
  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <BarChart className="mb-3 h-10 w-10 text-purple-500" />
        <h3 className="font-bold text-gray-800">Phân tích câu sai nhiều nhất</h3>
        <p className="mt-1 max-w-xl text-sm text-gray-500">
          Chọn một bài kiểm tra cụ thể ở bộ lọc phía trên để so sánh đúng cùng một bộ câu hỏi.
        </p>
      </div>
    </Card>
  );
};
