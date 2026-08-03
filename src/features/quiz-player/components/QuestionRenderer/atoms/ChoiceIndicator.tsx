import React from 'react';
import {
  selectedIndicatorClass,
  unselectedIndicatorClass,
} from '../../answer-state/stateStyles';

interface ChoiceIndicatorProps {
  label: string;
  isSelected: boolean;
  colorScheme?: 'orange' | 'indigo';
}

const ChoiceIndicator: React.FC<ChoiceIndicatorProps> = ({ label, isSelected }) => (
  <span
    className={`mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border text-xs font-semibold transition-colors ${
      isSelected ? selectedIndicatorClass : unselectedIndicatorClass
    }`}
  >
    {label}
  </span>
);

export default ChoiceIndicator;
