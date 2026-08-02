import { useEffect, useMemo, useState } from 'react';
import { testBankService } from '../../services/testBankService';
import type {
  QuestionBankFilters,
  QuestionBankItem,
  QuestionBankPagination,
} from './questionBank.types';

const EMPTY_PAGINATION: QuestionBankPagination = {
  page: 1,
  pageSize: 30,
  totalItems: 0,
  totalPages: 0,
};

export interface UseQuestionBankResult {
  items: QuestionBankItem[];
  pagination: QuestionBankPagination;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  reload: () => void;
}

export const useQuestionBank = (
  filters: QuestionBankFilters,
  enabled = true,
): UseQuestionBankResult => {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [pagination, setPagination] = useState<QuestionBankPagination>(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => globalThis.clearTimeout(timer);
  }, [filters.search]);

  const requestFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch,
  }), [filters, debouncedSearch]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setLoaded(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setLoaded(false);
    setError(null);

    testBankService.listQuestionBank(requestFilters)
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setPagination(response.pagination);
        setLoaded(true);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setItems([]);
        setPagination({ ...EMPTY_PAGINATION, page: requestFilters.page, pageSize: requestFilters.pageSize });
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải ngân hàng câu hỏi.');
        setLoaded(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [enabled, requestFilters, reloadToken]);

  return {
    items,
    pagination,
    loading,
    loaded,
    error,
    reload: () => setReloadToken((current) => current + 1),
  };
};
