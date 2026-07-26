import type { DateRange } from '../../teacher/ResultsView';

interface ActiveResultsFiltersProps {
  dateRange: DateRange;
  searchName: string;
  activeQuizId: string;
  activeQuizTitle?: string;
  onClear: () => void;
}

export const ActiveResultsFilters = ({
  dateRange,
  searchName,
  activeQuizId,
  activeQuizTitle,
  onClear,
}: ActiveResultsFiltersProps) => {
  const hasFilters = dateRange.label !== 'Tất cả' || Boolean(searchName) || activeQuizId !== 'all';
  if (!hasFilters) return null;

  return (
    <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 items-center text-sm">
      <span className="text-gray-500">Đang lọc:</span>
      {dateRange.label !== 'Tất cả' && (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">📅 {dateRange.label}</span>
      )}
      {activeQuizId !== 'all' && (
        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full">📝 {activeQuizTitle}</span>
      )}
      {searchName && (
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">🔍 "{searchName}"</span>
      )}
      <button onClick={onClear} className="text-red-600 hover:text-red-700 ml-2">Xóa bộ lọc</button>
    </div>
  );
};
