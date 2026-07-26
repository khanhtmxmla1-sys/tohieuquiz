/**
 * Progress Card Component
 * Shows real-time submission progress for live exam
 */

import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface ProgressData {
  totalParticipants: number;
  submittedCount: number;
  submittedPercentage: number;
  notSubmittedStudents: Array<{
    username: string;
    joinedAt: string;
  }>;
}

interface ProgressCardProps {
  progress: ProgressData;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({ progress }) => {
  const { totalParticipants, submittedCount, submittedPercentage, notSubmittedStudents } = progress;
  
  const isComplete = submittedCount === totalParticipants;
  const progressColor = isComplete ? 'bg-green-600' : 'bg-blue-600';

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <TrendingUp size={20} />
        Tiến Độ Nộp Bài
      </h3>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-slate-800">
            {submittedCount}/{totalParticipants}
          </span>
          <span className="text-sm text-slate-600">
            {Math.round(submittedPercentage)}%
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-4">
          <div 
            className={`${progressColor} h-4 rounded-full transition-all duration-500`}
            style={{ width: `${submittedPercentage}%` }}
          />
        </div>
      </div>

      {/* Not Submitted List */}
      {notSubmittedStudents.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">
            Chưa nộp bài ({notSubmittedStudents.length}):
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {notSubmittedStudents.map((student, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                <AlertCircle size={14} className="text-orange-500" />
                <span>{student.username}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isComplete && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 font-semibold flex items-center gap-2">
            <CheckCircle size={16} />
            Tất cả học sinh đã nộp bài!
          </p>
        </div>
      )}
    </div>
  );
};

export default ProgressCard;
