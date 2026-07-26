import { useCallback, useEffect, useMemo, useState } from 'react';
import type { QuizOption, ResultRecord, StudentOption } from './types';
import { filterBatchStudents, mergeStudentsWithResults } from './certificateBatchHelpers';

export const useBatchStudentSelection = (
  students: StudentOption[],
  results: ResultRecord[],
  quizId: string,
  quizzes: QuizOption[],
) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  useEffect(() => {
    setSelectedIds(new Set(students.map(student => student.id)));
  }, [students]);
  const studentRows = useMemo(
    () => mergeStudentsWithResults(students, results, quizId, quizzes),
    [students, results, quizId, quizzes],
  );
  const filtered = useMemo(
    () => filterBatchStudents(studentRows, search),
    [studentRows, search],
  );
  const toggleAll = useCallback(() => {
    const ids = filtered.map(student => student.id);
    setSelectedIds(previous => {
      const allSelected = ids.every(id => previous.has(id));
      const next = new Set(previous);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }, [filtered]);
  const toggleOne = useCallback((id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return {
    selectedIds,
    setSelectedIds,
    search,
    setSearch,
    studentRows,
    filtered,
    toggleAll,
    toggleOne,
  };
};
