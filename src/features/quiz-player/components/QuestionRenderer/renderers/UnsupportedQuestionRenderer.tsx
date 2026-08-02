import React from 'react';
import type { BaseRendererProps } from '../types';

const UnsupportedQuestionRenderer: React.FC<BaseRendererProps> = ({ question }) => (
  <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
    Dạng câu hỏi này chưa được hỗ trợ để làm và chấm tự động: <strong>{String(question.type || 'UNKNOWN')}</strong>.
  </div>
);

export default React.memo(UnsupportedQuestionRenderer);
