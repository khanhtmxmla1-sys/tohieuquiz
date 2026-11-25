import type { Dispatch, SetStateAction } from "react";
import type {
  SchoolExamCertificateBatchView,
  SchoolExamEventView,
  SchoolExamExportView,
  SchoolExamRankingView,
} from "../competitionDashboardService";
import { competitionDashboardService } from "../competitionDashboardService";
import { createRequestId, splitIds } from "./dashboardHelpers";
import type { CertificateDraft } from "./dashboardTypes";

export interface DownstreamActionsOptions {
  isAdmin: boolean;
  teacherClassId: string | null;
  selectedEvent: SchoolExamEventView | null;
  rankings: SchoolExamRankingView | null;
  certificateDraft: CertificateDraft;
  exportJob: SchoolExamExportView | null;
  setCertificateBatch: Dispatch<
    SetStateAction<SchoolExamCertificateBatchView | null>
  >;
  setExportJob: Dispatch<SetStateAction<SchoolExamExportView | null>>;
  setPendingAction: (value: string | null) => void;
  setActionError: (value: string | null) => void;
  setActionMessage: (value: string | null) => void;
}

export function useDownstreamActions({
  isAdmin,
  teacherClassId,
  selectedEvent,
  rankings,
  certificateDraft,
  exportJob,
  setCertificateBatch,
  setExportJob,
  setPendingAction,
  setActionError,
  setActionMessage,
}: DownstreamActionsOptions) {
  const createCertificates = async () => {
    if (
      !selectedEvent ||
      selectedEvent.status !== "PUBLISHED" ||
      !isAdmin ||
      !rankings
    )
      return;
    const winnerStudentIds = splitIds(certificateDraft.winnerStudentIds);
    if (
      !certificateDraft.templateId.trim() ||
      !certificateDraft.title.trim() ||
      winnerStudentIds.length === 0
    ) {
      setActionError("Cấu hình chứng nhận chưa hợp lệ.");
      return;
    }
    setPendingAction("certificates");
    setActionError(null);
    setActionMessage(null);
    try {
      const batch = await competitionDashboardService.createCertificates({
        eventId: selectedEvent.id,
        publicationVersion: rankings.publicationVersion,
        rankingVersion: rankings.rankingVersion,
        winnerStudentIds,
        templateId: certificateDraft.templateId.trim(),
        title: certificateDraft.title.trim(),
        ...(certificateDraft.message.trim()
          ? { message: certificateDraft.message.trim() }
          : {}),
        ...(certificateDraft.achievementPrefix.trim()
          ? { achievementPrefix: certificateDraft.achievementPrefix.trim() }
          : {}),
        requestId: createRequestId("school-exam-certificates"),
      });
      setCertificateBatch(batch);
      setActionMessage(
        `Đã tạo ${batch.batchCount} batch chứng nhận cho ${batch.winnerCount} học sinh.`,
      );
    } catch {
      setActionError("Không thể tạo chứng nhận Competition.");
    } finally {
      setPendingAction(null);
    }
  };

  const createExport = async () => {
    if (!selectedEvent || selectedEvent.status !== "PUBLISHED") return;
    const scope = isAdmin ? ("SCHOOL" as const) : ("CLASS" as const);
    if (!isAdmin && !teacherClassId) return;
    setPendingAction("export");
    setActionError(null);
    setActionMessage(null);
    try {
      const job = await competitionDashboardService.createExport(
        selectedEvent.id,
        {
          scope,
          ...(!isAdmin && teacherClassId ? { classId: teacherClassId } : {}),
          requestId: createRequestId("school-exam-export"),
        },
      );
      setExportJob(job);
      setActionMessage(`Đã xếp hàng XLSX: ${job.status}.`);
    } catch {
      setActionError("Không thể tạo XLSX.");
    } finally {
      setPendingAction(null);
    }
  };

  const refreshExport = async () => {
    if (!selectedEvent || !exportJob) return;
    setPendingAction("export-refresh");
    try {
      setExportJob(
        await competitionDashboardService.getExport(
          selectedEvent.id,
          exportJob.id,
        ),
      );
    } catch {
      setActionError("Không thể làm mới trạng thái XLSX.");
    } finally {
      setPendingAction(null);
    }
  };

  return { createCertificates, createExport, refreshExport };
}
