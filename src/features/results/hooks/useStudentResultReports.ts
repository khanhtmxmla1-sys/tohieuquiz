import { useCallback, useEffect, useState } from 'react';
import type {
  StudentResultReportDetail,
  StudentResultReportSummary,
} from '../../../../shared/result-reports.contract';
import {
  normalizeResultReportDeliveryError,
  resultReportDeliveryService,
} from '../services/resultReportDeliveryService';

export const useStudentResultReports = (initialReportId?: string | null) => {
  const [reports, setReports] = useState<StudentResultReportSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(initialReportId || null);
  const [detail, setDetail] = useState<StudentResultReportDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      setReports(await resultReportDeliveryService.listMine());
    } catch (caught) {
      setError(normalizeResultReportDeliveryError(caught).message);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const openReport = useCallback(async (phieuId: string) => {
    setSelectedReportId(phieuId);
    setDetail(null);
    setIsLoadingDetail(true);
    setError(null);
    try {
      setDetail(await resultReportDeliveryService.getMine(phieuId));
    } catch (caught) {
      setError(normalizeResultReportDeliveryError(caught).message);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedReportId(null);
    setDetail(null);
    setError(null);
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (initialReportId) void openReport(initialReportId);
  }, [initialReportId, openReport]);

  return {
    reports,
    selectedReportId,
    detail,
    isLoadingList,
    isLoadingDetail,
    error,
    loadReports,
    openReport,
    closeDetail,
  };
};
