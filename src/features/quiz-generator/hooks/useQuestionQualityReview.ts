import { useEffect, useMemo, useState } from 'react';
import type { Quiz } from '../../../types';
import { evaluateAiQuestionQuality } from '../../../../shared/ai-question-quality';

interface UseQuestionQualityReviewOptions {
  quiz: Quiz | null;
  classLevel: string;
}

export const useQuestionQualityReview = ({
  quiz,
  classLevel,
}: UseQuestionQualityReviewOptions) => {
  const [acknowledgedWarningIds, setAcknowledgedWarningIds] = useState<Set<string>>(new Set());
  const summary = useMemo(() => (
    quiz
      ? evaluateAiQuestionQuality({ classLevel, questions: quiz.questions })
      : null
  ), [classLevel, quiz]);
  const warningIds = useMemo(() => (
    summary?.issues
      .filter((issue) => issue.severity === 'warning')
      .map((issue) => issue.id) ?? []
  ), [summary]);
  const warningFingerprint = warningIds.join('|');

  useEffect(() => {
    const currentWarnings = new Set(warningFingerprint ? warningFingerprint.split('|') : []);
    setAcknowledgedWarningIds((previous) => {
      const retained = [...previous].filter((id) => currentWarnings.has(id));
      return retained.length === previous.size ? previous : new Set(retained);
    });
  }, [warningFingerprint]);

  const allWarningsAcknowledged = warningIds.every((id) => acknowledgedWarningIds.has(id));
  const isTrialPreview = quiz?.aiGeneration?.generationKind === 'trial';
  const canSave = !isTrialPreview && (!summary
    || (summary.blockingCount === 0 && allWarningsAcknowledged));
  const saveBlockReason = isTrialPreview
    ? 'Đây là bản tạo thử 3 câu. Hãy tạo đề đầy đủ trước khi lưu.'
    : summary?.blockingCount
      ? `Cần sửa ${summary.blockingCount} lỗi bắt buộc trước khi lưu đề.`
      : summary?.warningCount && !allWarningsAcknowledged
        ? 'Cần xác nhận tất cả cảnh báo chất lượng trước khi lưu đề.'
        : null;

  const toggleWarningAcknowledgement = (issueId: string) => {
    setAcknowledgedWarningIds((previous) => {
      const next = new Set(previous);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  return {
    summary,
    acknowledgedWarningIds,
    allWarningsAcknowledged,
    isTrialPreview,
    canSave,
    saveBlockReason,
    toggleWarningAcknowledgement,
  };
};
