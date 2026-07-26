/**
 * Live Exam Analytics Dashboard
 * Main container component that integrates all analytics cards
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, RefreshCw, BarChart3, AlertCircle } from 'lucide-react';
import { useLiveExamAnalytics } from '../../../hooks/useLiveExamAnalytics';
import { ProgressCard } from './ProgressCard';
import { ScoreDistributionCard } from './ScoreDistributionCard';
import { DifficultQuestionsCard } from './DifficultQuestionsCard';
import { TimeAnalysisCard } from './TimeAnalysisCard';

// Loading Skeleton Component
const LoadingSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
    <div className="max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="mb-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64 mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-48"></div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="h-64 bg-white rounded-2xl shadow-xl animate-pulse"></div>
        <div className="h-64 bg-white rounded-2xl shadow-xl animate-pulse"></div>
      </div>
      <div className="h-96 bg-white rounded-2xl shadow-xl animate-pulse mb-6"></div>
      <div className="h-96 bg-white rounded-2xl shadow-xl animate-pulse"></div>
    </div>
  </div>
);

// Error State Component
interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4 flex items-center justify-center">
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
        <AlertCircle size={32} className="text-red-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">
        Không thể tải dữ liệu
      </h2>
      <p className="text-slate-600 mb-6">
        {error || 'Đã xảy ra lỗi khi tải analytics'}
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto"
      >
        <RefreshCw size={18} />
        Thử lại
      </button>
    </div>
  </div>
);

// Empty State Component
const EmptyState: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4 flex items-center justify-center">
    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
        <BarChart3 size={32} className="text-slate-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">
        Chưa có dữ liệu
      </h2>
      <p className="text-slate-600">
        Phiên thi chưa có học sinh nào nộp bài
      </p>
    </div>
  </div>
);

// Analytics Header Component
interface AnalyticsHeaderProps {
  session: {
    id: string;
    title: string;
    status: string;
    totalQuestions: number;
  };
  onRefresh: () => void;
  onBack: () => void;
}

const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({ session, onRefresh, onBack }) => {
  const statusColors = {
    active: 'bg-green-100 text-green-700',
    closed: 'bg-slate-100 text-slate-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };

  const statusLabels = {
    active: '🟢 Đang diễn ra',
    closed: '⚫ Đã kết thúc',
    pending: '🟡 Chờ bắt đầu',
  };

  return (
    <div className="mb-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-xl shadow hover:shadow-md mb-4 transition-shadow"
      >
        <ArrowLeft size={18} />
        Quay lại
      </button>

      {/* Title and Status */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
              <BarChart3 size={28} className="text-blue-700" />
              {session.title}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold ${statusColors[session.status as keyof typeof statusColors]}`}>
                {statusLabels[session.status as keyof typeof statusLabels]}
              </span>
              <span className="text-sm text-slate-600">
                📝 {session.totalQuestions} câu hỏi
              </span>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Làm mới
          </button>
        </div>
      </div>
    </div>
  );
};

interface LiveExamAnalyticsDashboardProps {
  sessionId?: string;
  onBack?: () => void;
}

// Main Dashboard Component
export const LiveExamAnalyticsDashboard: React.FC<LiveExamAnalyticsDashboardProps> = ({
  sessionId: sessionIdProp,
  onBack,
}) => {
  const routeParams = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sessionId = sessionIdProp || routeParams.sessionId || '';
  
  const { analytics, isLoading, error, refetch } = useLiveExamAnalytics({
    sessionId,
    pollingInterval: 10000,
  });

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(-1);
  };

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  // Empty state
  if (!analytics) {
    return <EmptyState />;
  }

  // Success state - render full dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <AnalyticsHeader 
          session={analytics.session} 
          onRefresh={refetch}
          onBack={handleBack}
        />

        {/* Top Row: Progress + Score Distribution */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <ProgressCard progress={analytics.progress} />
          <ScoreDistributionCard scores={analytics.scores} />
        </div>

        {/* Middle Row: Difficult Questions */}
        <DifficultQuestionsCard 
          questions={analytics.topDifficultQuestions}
          sessionId={sessionId}
        />

        {/* Bottom Row: Time Analysis */}
        <TimeAnalysisCard questions={analytics.questions} />
      </div>
    </div>
  );
};

export default LiveExamAnalyticsDashboard;
