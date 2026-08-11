import type { InterventionDataReadiness } from '../../../../../shared/intervention.contract';

export type InterventionReadinessReason =
  | 'NO_RESULTS'
  | 'MISSING_METADATA'
  | 'INSUFFICIENT_SAMPLES'
  | 'LOW_CONFIDENCE'
  | 'NO_SUPPORT_SIGNAL';

export interface InterventionReadinessCopy {
  reason: InterventionReadinessReason;
  primary: string;
  guidance: string[];
}

export const getInterventionReadinessCopy = (
  readiness: InterventionDataReadiness,
): InterventionReadinessCopy => {
  if (readiness.resultsInWindow === 0) {
    return {
      reason: 'NO_RESULTS',
      primary: 'Chưa có bài làm trong 28 ngày gần nhất.',
      guidance: ['Cho học sinh hoàn thành thêm bài trong phạm vi đang xem để hệ thống có dữ liệu phân tích.'],
    };
  }

  if (readiness.excludedSignals.missingMetadata > 0
    || readiness.questionsWithSkillMetadata < readiness.questionsInScope) {
    return {
      reason: 'MISSING_METADATA',
      primary: 'Nhiều câu hỏi chưa có thông tin kỹ năng.',
      guidance: [
        'Ưu tiên dùng các câu hỏi đã có thông tin kỹ năng khi thu thập thêm dữ liệu.',
        'Kiểm tra metadata kỹ năng của đề khi chỉnh sửa nội dung câu hỏi.',
      ],
    };
  }

  if (readiness.excludedSignals.insufficientSamples > 0) {
    return {
      reason: 'INSUFFICIENT_SAMPLES',
      primary: 'Học sinh cần thêm lượt trả lời cho cùng kỹ năng.',
      guidance: ['Cho học sinh làm thêm câu có gắn cùng kỹ năng để đạt tối thiểu 3 mẫu.'],
    };
  }

  if (readiness.excludedSignals.lowConfidence > 0) {
    return {
      reason: 'LOW_CONFIDENCE',
      primary: 'Dữ liệu hiện có chưa đủ nhất quán để tạo gợi ý.',
      guidance: ['Thu thập thêm lượt trả lời cùng kỹ năng trước khi đưa ra quyết định hỗ trợ.'],
    };
  }

  return {
    reason: 'NO_SUPPORT_SIGNAL',
    primary: 'Chưa phát hiện nhóm cần hỗ trợ với tiêu chí hiện tại.',
    guidance: ['Tiếp tục theo dõi kết quả mới; hệ thống sẽ cập nhật khi có tín hiệu đủ điều kiện.'],
  };
};
