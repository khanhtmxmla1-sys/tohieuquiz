import React from 'react';
import type { ResultReportWizardStep } from '../../hooks/useResultReportDelivery';

const steps = [
  { id: 'scope', label: 'Chọn phạm vi' },
  { id: 'review', label: 'Kiểm tra phiếu' },
  { id: 'delivery', label: 'Chọn cách gửi' },
] as const;

export const ResultReportStepper: React.FC<{ step: ResultReportWizardStep }> = ({ step }) => {
  const activeIndex = step === 'summary' ? 3 : steps.findIndex((item) => item.id === step);
  return (
    <ol aria-label="Tiến trình tạo phiếu" className="grid grid-cols-3 gap-2 border-b border-slate-200 px-4 py-4 sm:px-6">
      {steps.map((item, index) => {
        const active = index === activeIndex;
        const complete = index < activeIndex;
        return (
          <li key={item.id} className="min-w-0">
            <div className={`h-1 rounded-full ${active || complete ? 'bg-sky-500' : 'bg-slate-200'}`} />
            <div className="mt-2 flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${active || complete ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-500'}`}>
                {index + 1}
              </span>
              <span className={`truncate text-xs font-medium sm:text-sm ${active ? 'text-sky-800' : 'text-slate-600'}`}>
                {item.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
