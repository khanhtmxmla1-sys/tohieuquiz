import React from 'react';
import { BaseRendererProps } from '../types';
import GeometryContainer from '../../../../../components/common/GeometryRenderer';
import { answerInputClasses } from '../../answer-state/stateStyles';

const GeometryRenderer: React.FC<BaseRendererProps> = ({
  question,
  answers,
  onAnswerChange,
}) => {
  const geometryData = (question as any).geometryData;
  const value = String(answers[question.id] ?? '');
  const inputId = `geometry-result-${question.id}`;

  if (!geometryData) {
    return (
      <div className="rounded-[10px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Không tìm thấy dữ liệu hình học.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-[10px] border border-slate-200 bg-white">
        <GeometryContainer data={geometryData} />
      </div>

      <div className="mt-6 w-full max-w-sm">
        <label htmlFor={inputId} className="sr-only">Kết quả hình học</label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onAnswerChange(question.id, event.target.value)}
          placeholder="Nhập kết quả quan sát được..."
          className={`w-full rounded-[10px] border p-4 text-center text-lg font-semibold outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-100 ${answerInputClasses(Boolean(value.trim()))}`}
        />
      </div>
    </div>
  );
};

export default React.memo(GeometryRenderer);
