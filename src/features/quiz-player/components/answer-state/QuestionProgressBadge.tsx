import React from 'react';
import type { QuestionProgressResult } from '../../../../domain/quiz-progress';

interface QuestionProgressBadgeProps {
  progress: QuestionProgressResult;
}

const QuestionProgressBadge: React.FC<QuestionProgressBadgeProps> = ({ progress }) => {
  if (progress.state === 'empty') return null;
  if (progress.state === 'complete') {
    return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">✓ Đã hoàn thành</span>;
  }
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
      Đang làm · {progress.completedParts}/{progress.requiredParts}
    </span>
  );
};

export default React.memo(QuestionProgressBadge);
