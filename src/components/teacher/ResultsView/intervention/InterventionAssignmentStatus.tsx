import React from 'react';
import type { InterventionAssignmentPreview } from '../../../../../shared/intervention.contract';

export interface InterventionAssignmentStatusProps {
  preview: InterventionAssignmentPreview | null;
  previewLoading: boolean;
  previewError: string;
  submitError: string;
  resultMessage: string;
}

export const InterventionAssignmentStatus: React.FC<InterventionAssignmentStatusProps> = ({
  preview,
  previewLoading,
  previewError,
  submitError,
  resultMessage,
}) => (
  <div className="mt-3 min-h-6 text-sm" aria-live="polite">
    {previewLoading && <p className="text-slate-500">Đang kiểm tra bài đang mở...</p>}
    {!previewLoading && preview && (
      <p className="text-slate-700">
        Có thể tạo mới cho {preview.assignableCount}/{preview.memberCount} học sinh · {preview.openAssignmentCount} học sinh đã có bài đang mở
      </p>
    )}
    {previewError && <p className="text-red-600">{previewError}</p>}
    {submitError && <p role="alert" className="text-red-600">{submitError}</p>}
    {resultMessage && <p className="font-medium text-emerald-700">{resultMessage}</p>}
  </div>
);

export default InterventionAssignmentStatus;
