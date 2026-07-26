import React from 'react';

interface ChoiceIndicatorProps {
  label: string;
  isSelected: boolean;
  colorScheme?: 'orange' | 'indigo';
}

const ChoiceIndicator: React.FC<ChoiceIndicatorProps> = ({ label, isSelected }) => (
  <span
    className={`mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border text-xs font-semibold transition-colors ${
      isSelected
        ? 'border-emerald-500 bg-emerald-500 text-white'
        : 'border-slate-300 bg-white text-slate-500'
    }`}
  >
    {label}
  </span>
);

export default ChoiceIndicator;
