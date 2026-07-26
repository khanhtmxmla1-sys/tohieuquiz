import { Search } from 'lucide-react';
import type { DateRange } from '../../teacher/ResultsView';
import { DateRangeFilter } from '../../teacher/ResultsView';

interface ResultsFilterControlsProps {
  dateRange: DateRange;
  onDateRangeChange: (value: DateRange) => void;
  activeQuizId: string;
  onActiveQuizChange: (value: string) => void;
  availableQuizzes: Array<{ id: string; title: string }>;
  filterClass: string;
  onFilterClassChange: (value: string) => void;
  availableClasses: string[];
  searchName: string;
  onSearchNameChange: (value: string) => void;
}

export const ResultsFilterControls = ({
  dateRange,
  onDateRangeChange,
  activeQuizId,
  onActiveQuizChange,
  availableQuizzes,
  filterClass,
  onFilterClassChange,
  availableClasses,
  searchName,
  onSearchNameChange,
}: ResultsFilterControlsProps) => (
  <>
    <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />
    <select
      value={activeQuizId}
      onChange={event => onActiveQuizChange(event.target.value)}
      className="px-3 md:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm w-full sm:w-auto"
    >
      <option value="all">Tất cả bài kiểm tra</option>
      {availableQuizzes.map(quiz => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
    </select>
    <select
      value={filterClass}
      onChange={event => onFilterClassChange(event.target.value)}
      className="px-3 md:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm w-full sm:w-auto"
    >
      <option value="All">Tất cả lớp</option>
      {availableClasses.map(className => <option key={className} value={className}>{className}</option>)}
    </select>
    <div className="relative w-full sm:flex-1 sm:max-w-xs">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        placeholder="Tìm học sinh..."
        value={searchName}
        onChange={event => onSearchNameChange(event.target.value)}
        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
      />
    </div>
  </>
);
