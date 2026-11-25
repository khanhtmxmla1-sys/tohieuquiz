import type { Dispatch, SetStateAction } from "react";
import type {
  CompetitionCampaignView,
  SchoolExamEventView,
  SchoolExamIncidentView,
  SchoolExamRankingView,
  SchoolExamReconcileView,
  SchoolExamResultCorrectionView,
  SchoolExamRetestView,
} from "../competitionDashboardService";
import { competitionDashboardService } from "../competitionDashboardService";
import { createRequestId } from "./dashboardHelpers";
import type { CorrectionDraft, IncidentDraft } from "./dashboardTypes";

export interface PublicationActionsOptions {
  isAdmin: boolean;
  selectedEvent: SchoolExamEventView | null;
  correctionDraft: CorrectionDraft;
  incidentDraft: IncidentDraft;
  retestResolution: Record<
    string,
    "KEEP_ORIGINAL" | "REPLACE_WITH_RETEST" | "INVALIDATE_RESULT"
  >;
  setReconcile: Dispatch<SetStateAction<SchoolExamReconcileView | null>>;
  setSchoolExamEvents: Dispatch<SetStateAction<SchoolExamEventView[]>>;
  setRankings: Dispatch<SetStateAction<SchoolExamRankingView | null>>;
  setResultCorrections: Dispatch<
    SetStateAction<SchoolExamResultCorrectionView[]>
  >;
  setIncidents: Dispatch<SetStateAction<SchoolExamIncidentView[]>>;
  setRetests: Dispatch<SetStateAction<SchoolExamRetestView[]>>;
  setPendingAction: (value: string | null) => void;
  setActionError: (value: string | null) => void;
  setActionMessage: (value: string | null) => void;
}

export function usePublicationActions({
  isAdmin,
  selectedEvent,
  correctionDraft,
  incidentDraft,
  retestResolution,
  setReconcile,
  setSchoolExamEvents,
  setRankings,
  setResultCorrections,
  setIncidents,
  setRetests,
  setPendingAction,
  setActionError,
  setActionMessage,
}: PublicationActionsOptions) {
  const startReconcile = async () => {
    if (!selectedEvent || !isAdmin) return;
    setPendingAction("reconcile");
    setActionError(null);
    setActionMessage(null);
    try {
      const value = await competitionDashboardService.startReconcile(
        selectedEvent.id,
        createRequestId("school-exam-reconcile"),
      );
      setReconcile(value);
      setSchoolExamEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? { ...event, status: value.eventStatus }
            : event,
        ),
      );
      setActionMessage(
        value.blockingIssues === 0
          ? "Đối soát sạch; sẵn sàng công bố."
          : `Đối soát còn ${value.blockingIssues} blocker.`,
      );
    } catch {
      setActionError("Không thể chạy đối soát.");
    } finally {
      setPendingAction(null);
    }
  };

  const publishResults = async () => {
    if (
      !selectedEvent ||
      !isAdmin ||
      selectedEvent.status !== "READY_TO_PUBLISH"
    )
      return;
    setPendingAction("publish");
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.publish(
        selectedEvent.id,
        createRequestId("school-exam-publish"),
      );
      setSchoolExamEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? { ...event, status: "PUBLISHED" }
            : event,
        ),
      );
      setRankings(
        await competitionDashboardService.getRankings(selectedEvent.id, {
          scope: "EVENT",
        }),
      );
      setActionMessage("Đã công bố kết quả chính thức.");
    } catch {
      setActionError("Không thể công bố kết quả.");
    } finally {
      setPendingAction(null);
    }
  };

  const createResultCorrection = async () => {
    if (!selectedEvent || !isAdmin || selectedEvent.status !== "PUBLISHED")
      return;
    const score = Number(correctionDraft.score);
    const correctCount = Number(correctionDraft.correctCount);
    const timeTaken = Number(correctionDraft.timeTaken);
    if (
      !correctionDraft.studentId.trim() ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      !Number.isInteger(correctCount) ||
      correctCount < 0 ||
      !Number.isInteger(timeTaken) ||
      timeTaken < 0 ||
      correctionDraft.reason.trim().length < 3
    ) {
      setActionError("Thông tin điều chỉnh kết quả chưa hợp lệ.");
      return;
    }
    setPendingAction("result-correction");
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.createResultCorrection({
        eventId: selectedEvent.id,
        studentId: correctionDraft.studentId.trim(),
        score,
        correctCount,
        timeTaken,
        reason: correctionDraft.reason.trim(),
        requestId: createRequestId("school-exam-result-correction"),
      });
      setResultCorrections(
        await competitionDashboardService.listResultCorrections(
          selectedEvent.id,
        ),
      );
      setActionMessage(
        "Đã ghi nhận điều chỉnh; phiên bản công bố hiện tại vẫn giữ nguyên.",
      );
    } catch {
      setActionError("Không thể ghi nhận điều chỉnh kết quả.");
    } finally {
      setPendingAction(null);
    }
  };

  const republishCorrectedResults = async () => {
    if (!selectedEvent || !isAdmin || selectedEvent.status !== "PUBLISHED")
      return;
    setPendingAction("result-correction-publish");
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.republishCorrectedResults(
        selectedEvent.id,
        createRequestId("school-exam-correction-publish"),
      );
      const [rankingValue, correctionItems] = await Promise.all([
        competitionDashboardService.getRankings(selectedEvent.id, {
          scope: "EVENT",
        }),
        competitionDashboardService.listResultCorrections(selectedEvent.id),
      ]);
      setRankings(rankingValue);
      setResultCorrections(correctionItems);
      setActionMessage(
        `Đã công bố phiên bản ${rankingValue.publicationVersion} sau điều chỉnh.`,
      );
    } catch {
      setActionError("Không thể công bố phiên bản điều chỉnh.");
    } finally {
      setPendingAction(null);
    }
  };

  const reportIncident = async () => {
    if (
      !selectedEvent ||
      !incidentDraft.roomId ||
      !incidentDraft.studentId ||
      !incidentDraft.originalResultId
    )
      return;
    setPendingAction("incident-report");
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.reportIncident({
        eventId: selectedEvent.id,
        roomId: incidentDraft.roomId,
        studentId: incidentDraft.studentId.trim(),
        originalResultId: incidentDraft.originalResultId.trim(),
        reasonCode: incidentDraft.reasonCode as any,
        ...(incidentDraft.reasonText.trim()
          ? { reasonText: incidentDraft.reasonText.trim() }
          : {}),
        requestId: createRequestId("school-exam-incident"),
      });
      const [incidentItems, retestItems] = await Promise.all([
        competitionDashboardService.listIncidents(selectedEvent.id),
        competitionDashboardService.listRetests(selectedEvent.id),
      ]);
      setIncidents(incidentItems);
      setRetests(retestItems);
      setSchoolExamEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? { ...event, status: "WITHHELD" }
            : event,
        ),
      );
      setActionMessage("Đã báo cáo sự cố; kết quả được giữ WITHHELD.");
    } catch {
      setActionError("Không thể báo cáo sự cố.");
    } finally {
      setPendingAction(null);
    }
  };

  const grantRetest = async (retest: SchoolExamRetestView) => {
    if (!selectedEvent || !isAdmin || retest.status !== "REQUESTED") return;
    setPendingAction(`retest-${retest.id}`);
    setActionError(null);
    setActionMessage(null);
    try {
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const updated = await competitionDashboardService.grantRetest(
        selectedEvent.id,
        retest.id,
        {
          expiresAt,
          resolution: retestResolution[retest.id] || "REPLACE_WITH_RETEST",
          requestId: createRequestId("school-exam-retest-grant"),
        },
      );
      setRetests((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setActionMessage("Đã cấp thi lại.");
    } catch {
      setActionError("Không thể cấp thi lại.");
    } finally {
      setPendingAction(null);
    }
  };

  return {
    startReconcile,
    publishResults,
    createResultCorrection,
    republishCorrectedResults,
    reportIncident,
    grantRetest,
  };
}
