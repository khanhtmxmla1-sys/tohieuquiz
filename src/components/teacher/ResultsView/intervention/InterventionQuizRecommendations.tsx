import React from 'react';
import type { InterventionQuizRecommendation } from '../../../../../shared/intervention.contract';

export interface InterventionQuizRecommendationsProps {
  recommendations: InterventionQuizRecommendation[];
}

const percentage = (value: number): string => `${Math.round(value * 100)}%`;

export const InterventionQuizRecommendations: React.FC<InterventionQuizRecommendationsProps> = ({
  recommendations,
}) => {
  if (recommendations.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Chưa có bài luyện khớp trực tiếp kỹ năng này; bạn vẫn có thể chọn bài khác.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Bài luyện phù hợp được đề xuất</p>
      <div className="mt-2 space-y-2">
        {recommendations.map((recommendation) => (
          <div key={recommendation.quizId} className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{recommendation.title}</span>
            <span className="ml-2 text-xs text-slate-600">
              {recommendation.matchedQuestionCount}/{recommendation.questionCount} câu khớp kỹ năng · {percentage(recommendation.confidence)} mức khớp
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InterventionQuizRecommendations;
