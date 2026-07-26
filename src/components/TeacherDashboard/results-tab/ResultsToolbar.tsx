import type { DateRange } from '../../teacher/ResultsView';
import { ResultsFilterControls } from './ResultsFilterControls';
import { ResultsActions } from './ResultsActions';
import { ActiveResultsFilters } from './ActiveResultsFilters';

interface ResultsToolbarProps {
  dateRange: DateRange;
  setDateRange: (value: DateRange) => void;
  activeQuizId: string;
  setActiveQuizId: (value: string) => void;
  availableQuizzes: Array<{ id: string; title: string }>;
  filterClass: string;
  setFilterClass: (value: string) => void;
  availableClasses: string[];
  searchName: string;
  setSearchName: (value: string) => void;
  resetFilters: () => void;
  isMobile: boolean;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
  onOpenPhieuPanel: () => void;
  phieuDisabled: boolean;
  onExportCsv: () => void;
  onExportSummary: () => void;
}

export const ResultsToolbar = (props: ResultsToolbarProps) => (
  <div className="bg-white rounded-xl border p-3 md:p-4 shadow-sm">
    <div className="flex flex-wrap items-center gap-3 md:gap-4">
      <ResultsFilterControls
        dateRange={props.dateRange}
        onDateRangeChange={props.setDateRange}
        activeQuizId={props.activeQuizId}
        onActiveQuizChange={props.setActiveQuizId}
        availableQuizzes={props.availableQuizzes}
        filterClass={props.filterClass}
        onFilterClassChange={props.setFilterClass}
        availableClasses={props.availableClasses}
        searchName={props.searchName}
        onSearchNameChange={props.setSearchName}
      />
      <ResultsActions
        isMobile={props.isMobile}
        isRefreshing={props.isRefreshing}
        onRefresh={props.onRefresh}
        onOpenPhieuPanel={props.onOpenPhieuPanel}
        phieuDisabled={props.phieuDisabled}
        onExportCsv={props.onExportCsv}
        onExportSummary={props.onExportSummary}
      />
    </div>
    <ActiveResultsFilters
      dateRange={props.dateRange}
      searchName={props.searchName}
      activeQuizId={props.activeQuizId}
      activeQuizTitle={props.availableQuizzes.find(quiz => quiz.id === props.activeQuizId)?.title}
      onClear={props.resetFilters}
    />
  </div>
);
