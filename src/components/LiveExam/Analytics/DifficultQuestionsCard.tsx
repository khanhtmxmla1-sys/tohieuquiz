/**
 * Difficult Questions Card Component
 * Shows top 3 most difficult questions with ranking
 */

import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import MathSpan from '../../common/MathSpan';

interface DifficultQuestion {
  questionIndex: number;
  questionText: string;
  correctRate: number;
  incorrectCount: number;
}

interface DifficultQuestionsCardProps {
  questions: DifficultQuestion[];
  sessionId: string;
}

// Rank badge component
const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  const colors = {
    1: 'bg-gradient-to-br from-red-500 to-red-600 text-white',
    2: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white',
    3: 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white',
  };

  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-lg ${colors[rank as keyof typeof colors]}`}>
      #{rank}
    </div>
  );
};

export const DifficultQuestionsCard: React.FC<DifficultQuestionsCardProps> = ({ 
  questions, 
  sessionId 
}) => {
  // Take top 3 most difficult (lowest correct rate)
  const topDifficult = questions.slice(0, 3);

  // Check if all questions are easy (>80% correct)
  const allQuestionsEasy = questions.length > 0 && questions.every(q => q.correctRate > 0.8);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <AlertTriangle size={20} className="text-orange-600" />
        Câu Hỏi Khó Nhất
      </h3>

      {allQuestionsEasy ? (
        // All students did well
        <div className="py-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
            <TrendingDown size={32} className="text-green-600 transform rotate-180" />
          </div>
          <p className="text-lg font-semibold text-green-700 mb-1">
            🎉 Tất cả học sinh làm tốt!
          </p>
          <p className="text-sm text-slate-600">
            Không có câu hỏi nào dưới 80% tỷ lệ đúng
          </p>
        </div>
      ) : topDifficult.length === 0 ? (
        // No data yet
        <div className="py-8 text-center">
          <p className="text-slate-500 text-sm">
            Chưa có dữ liệu câu hỏi khó
          </p>
        </div>
      ) : (
        // Show top difficult questions
        <div className="space-y-4">
          {topDifficult.map((question, index) => (
            <div 
              key={question.questionIndex}
              className="flex gap-4 p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow"
            >
              {/* Rank Badge */}
              <div className="flex-shrink-0">
                <RankBadge rank={index + 1} />
              </div>

              {/* Question Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-semibold text-slate-800 text-sm">
                    Câu {question.questionIndex + 1}
                  </h4>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">
                      {Math.round((1 - question.correctRate) * 100)}% sai
                    </span>
                  </div>
                </div>

                <MathSpan
                  content={question.questionText}
                  as="p"
                  className="mb-3 line-clamp-2 text-sm text-slate-600"
                />

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>
                    ✓ {Math.round(question.correctRate * 100)}% đúng
                  </span>
                  <span>
                    ✗ {Math.round((1 - question.correctRate) * 100)}% sai
                  </span>
                  <span>
                    👥 {question.incorrectCount} lượt sai
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Action Button (Placeholder for future feature) */}
          <div className="pt-2">
            <button
              disabled
              className="w-full px-4 py-3 bg-slate-100 text-slate-400 rounded-xl font-semibold text-sm cursor-not-allowed flex items-center justify-center gap-2"
              title="Tính năng đang phát triển"
            >
              <TrendingDown size={16} />
              Tạo bài tập bổ trợ (Sắp ra mắt)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DifficultQuestionsCard;
