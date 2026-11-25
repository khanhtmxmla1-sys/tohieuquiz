import type { Dispatch, SetStateAction } from "react";
import type {
  CompetitionCampaignView,
  CompetitionEligibilityView,
  SchoolExamEventView,
} from "../competitionDashboardService";
import { competitionDashboardService } from "../competitionDashboardService";
import {
  createRequestId,
  splitIds,
  toDateTimeLocal,
  toIsoDateTime,
} from "./dashboardHelpers";
import type { ExamDraft, RoomDraft } from "./dashboardTypes";

export interface SchoolExamActionsOptions {
  isAdmin: boolean;
  selectedCampaign: CompetitionCampaignView | null;
  eligibility: CompetitionEligibilityView | null;
  selectedEvent: SchoolExamEventView | null;
  examDraft: ExamDraft;
  roomDraft: RoomDraft;
  setSchoolExamEvents: Dispatch<SetStateAction<SchoolExamEventView[]>>;
  setRoomDraft: Dispatch<SetStateAction<RoomDraft>>;
  setPendingAction: (value: string | null) => void;
  setActionError: (value: string | null) => void;
  setActionMessage: (value: string | null) => void;
}

export function useSchoolExamActions({
  isAdmin,
  selectedCampaign,
  eligibility,
  selectedEvent,
  examDraft,
  roomDraft,
  setSchoolExamEvents,
  setRoomDraft,
  setPendingAction,
  setActionError,
  setActionMessage,
}: SchoolExamActionsOptions) {
  const createSchoolExamEvent = async () => {
    if (
      !selectedCampaign ||
      !eligibility ||
      !isAdmin ||
      !examDraft.title ||
      !examDraft.examDate
    )
      return;
    setPendingAction("exam-create");
    setActionError(null);
    setActionMessage(null);
    try {
      const event = await competitionDashboardService.createSchoolExamEvent({
        campaignId: selectedCampaign.id,
        eligibilitySnapshotVersion: eligibility.version,
        title: examDraft.title.trim(),
        examDate: toIsoDateTime(examDraft.examDate),
        rankingPolicy: "SCORE_CORRECT_TIME",
        examFormPolicy: examDraft.examFormPolicy,
        ...(examDraft.capacityProfileId.trim()
          ? { capacityProfileId: examDraft.capacityProfileId.trim() }
          : {}),
        requestId: createRequestId("school-exam-create"),
      });
      setSchoolExamEvents([event]);
      setRoomDraft((current) => ({
        ...current,
        scheduledAt: toDateTimeLocal(event.examDate),
      }));
      setActionMessage("Đã tạo kỳ thi cấp trường.");
    } catch {
      setActionError("Không thể tạo kỳ thi cấp trường.");
    } finally {
      setPendingAction(null);
    }
  };

  const createSchoolExamRoom = async () => {
    if (!selectedEvent || !isAdmin) return;
    const durationMinutes = Number(roomDraft.durationMinutes);
    const checkInLeadMinutes = Number(roomDraft.checkInLeadMinutes);
    const closeDrainMinutes = Number(roomDraft.closeDrainMinutes);
    const totalScore = Number(roomDraft.totalScore);
    const gradeLevel = Number(roomDraft.gradeLevel);
    const invigilatorIds = splitIds(roomDraft.invigilatorIds);
    const studentIds = splitIds(roomDraft.studentIds);
    const objectiveIds = splitIds(roomDraft.objectiveIds);
    if (
      !roomDraft.name.trim() ||
      !roomDraft.roomCode.trim() ||
      !roomDraft.scheduledAt ||
      !roomDraft.quizId.trim() ||
      !roomDraft.blueprintId.trim() ||
      invigilatorIds.length === 0 ||
      studentIds.length === 0 ||
      objectiveIds.length === 0 ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes <= 0 ||
      !Number.isFinite(totalScore) ||
      totalScore <= 0 ||
      !Number.isInteger(gradeLevel) ||
      gradeLevel <= 0
    ) {
      setActionError("Cấu hình phòng/ca thi chưa hợp lệ.");
      return;
    }
    setPendingAction("room-create");
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await competitionDashboardService.createSchoolExamRoom({
        eventId: selectedEvent.id,
        name: roomDraft.name.trim(),
        roomCode: roomDraft.roomCode.trim(),
        scheduledAt: toIsoDateTime(roomDraft.scheduledAt),
        durationMinutes,
        checkInLeadMinutes,
        closeDrainMinutes,
        formCode: roomDraft.formCode.trim() || "A",
        quizId: roomDraft.quizId.trim(),
        invigilatorIds,
        studentIds,
        formDefinition: {
          blueprintId: roomDraft.blueprintId.trim(),
          durationMinutes,
          totalScore,
          difficulty: roomDraft.difficulty.trim().toUpperCase(),
          gradeLevel,
          objectiveIds,
        },
        equivalentFormApproved: roomDraft.equivalentFormApproved,
        requestId: createRequestId("school-exam-room-create"),
      });
      setSchoolExamEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? { ...event, rooms: [...event.rooms, result.room] }
            : event,
        ),
      );
      setActionMessage(
        result.warnings.length > 0
          ? `Đã thêm phòng; cảnh báo: ${result.warnings.join(", ")}`
          : "Đã thêm phòng/ca thi.",
      );
    } catch {
      setActionError("Không thể thêm phòng/ca thi.");
    } finally {
      setPendingAction(null);
    }
  };

  const runPreflight = async () => {
    if (!selectedEvent || !isAdmin) return;
    setPendingAction("preflight");
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await competitionDashboardService.runPreflight(
        selectedEvent.id,
        createRequestId("school-exam-preflight"),
      );
      setSchoolExamEvents((current) =>
        current.map((event) =>
          event.id === selectedEvent.id
            ? {
                ...event,
                preflight: result,
                status:
                  result.status === "READY" ? "READY" : "PREFLIGHT_BLOCKED",
              }
            : event,
        ),
      );
      setActionMessage(
        result.status === "READY"
          ? "Preflight đạt capacity."
          : `Preflight bị chặn: ${result.reason || "UNKNOWN"}`,
      );
    } catch {
      setActionError("Không thể chạy preflight.");
    } finally {
      setPendingAction(null);
    }
  };

  const provisionSchoolExam = async () => {
    if (!selectedEvent || !isAdmin) return;
    setPendingAction("provision");
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.provisionSchoolExam(
        selectedEvent.id,
        createRequestId("school-exam-provision"),
      );
      const event = await competitionDashboardService.getSchoolExamEvent(
        selectedEvent.id,
      );
      setSchoolExamEvents((current) =>
        current.map((item) => (item.id === event.id ? event : item)),
      );
      setActionMessage("Đã provision các phòng thi có thể tạo.");
    } catch {
      setActionError("Không thể provision phòng thi.");
    } finally {
      setPendingAction(null);
    }
  };

  return {
    createSchoolExamEvent,
    createSchoolExamRoom,
    runPreflight,
    provisionSchoolExam,
  };
}
