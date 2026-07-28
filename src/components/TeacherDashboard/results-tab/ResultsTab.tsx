import type React from 'react';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import type { ResultsTabProps } from './types';
import { useResultsTabFilters } from './useResultsTabFilters';
import { useResultOverrides } from './useResultOverrides';
import { useQuestionAnalysis } from './useQuestionAnalysis';
import { usePhieuResult } from './usePhieuResult';
import { useResultsTabActions } from './useResultsTabActions';
import { ResultsToolbar } from './ResultsToolbar';
import { ResultsListSection } from './ResultsListSection';
import { QuestionAnalysisSection } from './QuestionAnalysisSection';
import { ResultsEmptyState } from './ResultsEmptyState';
import { ResultsOverlays } from './ResultsOverlays';
import { AsyncState } from '../../common';

const ResultsTab: React.FC<ResultsTabProps> = ({ results, quizzes, onRefresh }) => {
  const { isMobile } = useResponsiveLayout();
  const filters = useResultsTabFilters(results, quizzes, onRefresh);
  const resultOverrides = useResultOverrides(filters.paginatedResults, quizzes);
  const questionAnalysis = useQuestionAnalysis(
    quizzes,
    filters.resultsHook.filteredResults,
    filters.activeQuizId,
    filters.dateRange,
  );
  const phieu = usePhieuResult();
  const actions = useResultsTabActions(filters.filteredResults, filters.statistics);
  const selectedQuiz = quizzes.find((quiz) => quiz.id === filters.activeQuizId);
  const canCreateClassReports = filters.activeQuizId !== 'all'
    && filters.resultsHook.filterClass !== 'All'
    && Boolean(filters.resultsHook.filterClass)
    && filters.filteredResults.length > 0;
  const handleSortChange = (field: 'score' | 'submittedAt') => {
    if (field === filters.resultsHook.sortField) {
      filters.resultsHook.setSortOrder(filters.resultsHook.sortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }
    filters.resultsHook.setSortField(field);
    filters.resultsHook.setSortOrder('desc');
  };

  return (
    <>
      <div className="space-y-6">
        <ResultsToolbar
          dateRange={filters.dateRange}
          setDateRange={filters.setDateRange}
          activeQuizId={filters.activeQuizId}
          setActiveQuizId={filters.setActiveQuizId}
          availableQuizzes={filters.availableQuizzes}
          filterClass={filters.resultsHook.filterClass}
          setFilterClass={filters.resultsHook.setFilterClass}
          availableClasses={filters.resultsHook.availableClasses}
          searchName={filters.searchName}
          setSearchName={filters.setSearchName}
          resetFilters={filters.resetFilters}
          isMobile={isMobile}
          isRefreshing={filters.resultsHook.isRefreshing}
          onRefresh={filters.resultsHook.handleRefresh}
          onOpenPhieuPanel={() => {
            if (canCreateClassReports) phieu.setShowPhieuPanel(true);
          }}
          phieuDisabled={!canCreateClassReports}
          onExportCsv={actions.exportCsv}
          onExportSummary={actions.exportSummary}
          serverActionsDisabled={!filters.resultsHook.isOnline}
        />
        <AsyncState
          loading={filters.resultsHook.isRefreshing}
          error={filters.resultsHook.refreshError}
          hasData={filters.filteredResults.length > 0 && !filters.resultsHook.discardStaleData}
          empty={filters.filteredResults.length === 0}
          onRetry={filters.resultsHook.handleRefresh}
          retryDisabled={!filters.resultsHook.isOnline}
          staleAt={filters.resultsHook.lastUpdatedAt}
          isOffline={!filters.resultsHook.isOnline}
          emptyState={{
            title: 'Chưa có kết quả phù hợp',
            description: 'Chưa có học sinh nộp bài hoặc bộ lọc hiện tại chưa tìm thấy dữ liệu.',
          }}
        >
        <ResultsListSection
          results={filters.paginatedResults}
          quizzes={quizzes}
          resultOverrides={resultOverrides}
          sortField={filters.resultsHook.sortField}
          sortOrder={filters.resultsHook.sortOrder}
          onSortChange={handleSortChange}
          onRowClick={filters.resultsHook.isOnline ? actions.viewDetail : undefined}
          onPhieuClick={filters.resultsHook.isOnline ? phieu.openPhieu : undefined}
          onDeleteClick={filters.resultsHook.isOnline ? actions.deleteResult : undefined}
          isLoading={actions.isNavigatingDetail}
          currentPage={filters.currentPage}
          totalPages={filters.totalPages}
          totalResults={filters.filteredResults.length}
          onPageChange={filters.setCurrentPage}
        />
        <QuestionAnalysisSection
          activeQuizId={filters.activeQuizId}
          analysis={questionAnalysis.analysis}
          cohortSize={questionAnalysis.cohortSize}
          attemptMode={questionAnalysis.analysisAttemptMode}
          onAttemptModeChange={questionAnalysis.setAnalysisAttemptMode}
          isLoading={questionAnalysis.isLoadingAnalysis}
          error={questionAnalysis.analysisError}
        />
        {filters.filteredResults.length === 0 && <ResultsEmptyState />}
        </AsyncState>
      </div>
      <ResultsOverlays
        showPhieuPanel={phieu.showPhieuPanel}
        filteredResults={filters.filteredResults}
        deliveryClassName={filters.resultsHook.filterClass}
        deliveryQuizId={filters.activeQuizId === 'all' ? '' : filters.activeQuizId}
        deliveryQuizTitle={selectedQuiz?.title || 'Bài kiểm tra'}
        onClosePhieuPanel={() => phieu.setShowPhieuPanel(false)}
        phieuResult={phieu.phieuResult}
        quizzes={quizzes}
        phieuCache={phieu.phieuCache}
        onCacheUpdate={phieu.updateCache}
        onClosePhieu={() => phieu.setPhieuResult(null)}
      />
    </>
  );
};

export default ResultsTab;
