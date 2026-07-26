import { Users } from 'lucide-react';
import type { Quiz, StudentResult } from '../../../types';
import { Card } from '../../common';
import { ResultsTable } from '../../teacher/ResultsView';
import type { ResultDisplayOverride } from './types';
import { PAGE_SIZE } from './useResultsTabFilters';
import { ResultsPagination } from './ResultsPagination';

interface ResultsListSectionProps {
  results: StudentResult[];
  quizzes: Quiz[];
  resultOverrides: Record<string, ResultDisplayOverride>;
  sortField: 'score' | 'submittedAt';
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: 'score' | 'submittedAt') => void;
  onRowClick: (result: StudentResult) => void;
  onPhieuClick: (result: StudentResult) => void;
  onDeleteClick: (result: StudentResult) => void;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}

export const ResultsListSection = (props: ResultsListSectionProps) => (
  <Card padding="none">
    <div className="p-4 border-b flex items-center justify-between">
      <h3 className="font-bold text-gray-800 flex items-center gap-2">
        <Users className="w-5 h-5 text-orange-500" />
        Danh sách kết quả ({props.totalResults})
      </h3>
    </div>
    <ResultsTable
      results={props.results}
      quizzes={props.quizzes}
      resultOverrides={props.resultOverrides}
      sortField={props.sortField}
      sortOrder={props.sortOrder}
      onSortChange={props.onSortChange}
      onRowClick={props.onRowClick}
      isLoading={props.isLoading}
      onPhieuClick={props.onPhieuClick}
      onDeleteClick={props.onDeleteClick}
    />
    {props.totalResults > PAGE_SIZE && (
      <ResultsPagination
        currentPage={props.currentPage}
        totalPages={props.totalPages}
        totalResults={props.totalResults}
        pageSize={PAGE_SIZE}
        onPageChange={props.onPageChange}
      />
    )}
  </Card>
);
