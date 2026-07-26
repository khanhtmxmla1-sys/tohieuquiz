import { useState } from 'react';
import type { StudentResult } from '../../../types';
import { showError } from '../../../utils/toast';
import { resultPhieuLinkService } from '../../../features/results/services/resultPhieuLinkService';
import type { PhieuCache, PhieuCacheEntry } from './types';

const EMPTY_CACHE: PhieuCacheEntry = { savedPhieu: null, publishedLink: null };

export const usePhieuResult = () => {
  const [showPhieuPanel, setShowPhieuPanel] = useState(false);
  const [phieuResult, setPhieuResult] = useState<StudentResult | null>(null);
  const [phieuCache, setPhieuCache] = useState<PhieuCache>({});

  const openPhieu = async (result: StudentResult) => {
    const resultId = String(result.id || '').trim();
    if (!resultId) {
      showError('Kết quả không có mã định danh hợp lệ.');
      return;
    }
    setPhieuResult(result);
    if (phieuCache[resultId] !== undefined) return;
    try {
      const fetched = await resultPhieuLinkService.getByResult(resultId);
      setPhieuCache(previous => ({
        ...previous,
        [resultId]: fetched
          ? { savedPhieu: fetched.phieu, publishedLink: fetched.link }
          : EMPTY_CACHE,
      }));
    } catch (error) {
      setPhieuCache(previous => ({ ...previous, [resultId]: EMPTY_CACHE }));
      showError(error instanceof Error ? error.message : 'Không thể tải phiếu kết quả.');
    }
  };

  const updateCache = (resultId: string, patch: Partial<PhieuCacheEntry>) => {
    setPhieuCache(previous => ({
      ...previous,
      [resultId]: { ...(previous[resultId] ?? EMPTY_CACHE), ...patch },
    }));
  };

  return {
    showPhieuPanel,
    setShowPhieuPanel,
    phieuResult,
    setPhieuResult,
    phieuCache,
    openPhieu,
    updateCache,
  };
};
