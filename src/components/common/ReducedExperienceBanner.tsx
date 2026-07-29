import React from 'react';
import { Gauge } from 'lucide-react';
import { useReducedExperience } from '../../hooks/useReducedExperience';

export const ReducedExperienceBanner: React.FC = () => {
  const { reduceData, reduceMotion, reduceVisuals } = useReducedExperience();
  if (!reduceVisuals) return null;

  const message = reduceData
    ? 'Chế độ tiết kiệm dữ liệu đang bật'
    : reduceMotion
      ? 'Chế độ giảm chuyển động đang bật'
      : 'Chế độ phù hợp thiết bị yếu đang bật';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="reduced-experience-banner"
      className="flex min-h-10 items-center justify-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm font-semibold text-sky-900"
    >
      <Gauge className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

export default ReducedExperienceBanner;
