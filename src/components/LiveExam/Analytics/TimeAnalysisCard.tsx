/**
 * Time Analysis Card Component
 * Shows average time spent on each question with performance indicators
 */

import React from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import MathSpan from '../../common/MathSpan';

interface QuestionTimeData {
  questionIndex: number;
  questionText: string;
  avgTimeSeconds: number | null;
  correctRate: number;
}

interface TimeAnalysisCardProps {
  questions: QuestionTimeData[];
}

// Format seconds to MM:SS
const formatTime = (seconds: number | null): string => {
  if (seconds === null || seconds === 0) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Get time status with color
const getTimeStatus = (avgTime: number | null, expectedTime: number = 120) => {
  if (!avgTime) {
    return { 
      label: 'N/A', 
      color: 'text-slate-400',
      bgColor: 'bg-slate-50'
    };
  }
  
  if (avgTime > expectedTime * 2) {
    return { 
      label: '⚠️ Rất chậm', 
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    };
  }
  
  if (avgTime > expectedTime * 1.5) {
    return { 
      label: '⚠️ Chậm', 
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    };
  }
  
  return { 
    label: '✓ Bình thường', 
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  };
};

export const TimeAnalysisCard: React.FC<TimeAnalysisCardProps> = ({ questions }) => {
  // Calculate average expected time (2 minutes per question)
  const expectedTimePerQuestion = 120; // seconds

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Clock size={20} />
        Phân Tích Thời Gian
      </h3>

      {questions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-slate-500 text-sm">
            Chưa có dữ liệu thời gian
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-2 font-semibold text-slate-700 w-16">
                  Câu
                </th>
                <th className="text-left py-3 px-2 font-semibold text-slate-700">
                  Nội dung
                </th>
                <th className="text-center py-3 px-2 font-semibold text-slate-700 w-24">
                  Thời gian TB
                </th>
                <th className="text-center py-3 px-2 font-semibold text-slate-700 w-32">
                  Trạng thái
                </th>
                <th className="text-center py-3 px-2 font-semibold text-slate-700 w-24">
                  Tỷ lệ đúng
                </th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question, index) => {
                const status = getTimeStatus(question.avgTimeSeconds, expectedTimePerQuestion);
                
                return (
                  <tr 
                    key={question.questionIndex}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    {/* Question Number */}
                    <td className="py-3 px-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-blue-800 font-semibold flex items-center justify-center text-xs">
                        {question.questionIndex + 1}
                      </div>
                    </td>

                    {/* Question Text */}
                    <td className="py-3 px-2 text-slate-700">
                      <MathSpan content={question.questionText} className="line-clamp-2" />
                    </td>

                    {/* Average Time */}
                    <td className="py-3 px-2 text-center">
                      <span className="font-mono font-semibold text-slate-800">
                        {formatTime(question.avgTimeSeconds)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-2 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold ${status.bgColor} ${status.color}`}>
                        {status.label}
                      </span>
                    </td>

                    {/* Correct Rate */}
                    <td className="py-3 px-2 text-center">
                      <span className={`font-semibold ${
                        question.correctRate >= 0.8 ? 'text-green-600' :
                        question.correctRate >= 0.5 ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {Math.round(question.correctRate * 100)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-green-100" />
            <span>✓ Bình thường: {'<'} 3 phút</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-orange-100" />
            <span>⚠️ Chậm: 3-4 phút</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-100" />
            <span>⚠️ Rất chậm: {'>'} 4 phút</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {questions.length > 0 && (
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-blue-700" />
            <span className="text-sm font-semibold text-blue-950">Tổng quan</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-slate-600">Tổng câu hỏi:</span>
              <span className="ml-2 font-semibold text-slate-800">{questions.length}</span>
            </div>
            <div>
              <span className="text-slate-600">TB thời gian:</span>
              <span className="ml-2 font-semibold text-slate-800">
                {formatTime(
                  questions.reduce((sum, q) => sum + (q.avgTimeSeconds || 0), 0) / questions.length
                )}
              </span>
            </div>
            <div>
              <span className="text-slate-600">TB tỷ lệ đúng:</span>
              <span className="ml-2 font-semibold text-slate-800">
                {Math.round(
                  (questions.reduce((sum, q) => sum + q.correctRate, 0) / questions.length) * 100
                )}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeAnalysisCard;
