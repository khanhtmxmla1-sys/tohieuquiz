import type { Dispatch, SetStateAction } from "react";
import type {
  CompetitionCampaignView,
  CompetitionRoundView,
} from "../competitionDashboardService";
import { competitionDashboardService } from "../competitionDashboardService";
import { createRequestId, toIsoDateTime } from "./dashboardHelpers";
import type { RoundDraft, RoundQuizDraft } from "./dashboardTypes";

export interface RoundActionsOptions {
  isAdmin: boolean;
  selectedCampaign: CompetitionCampaignView | null;
  rounds: CompetitionRoundView[];
  roundDrafts: Record<number, RoundDraft>;
  roundQuizDrafts: Record<number, RoundQuizDraft>;
  setRoundDrafts: Dispatch<SetStateAction<Record<number, RoundDraft>>>;
  setRoundQuizDrafts: Dispatch<SetStateAction<Record<number, RoundQuizDraft>>>;
  setRounds: Dispatch<SetStateAction<CompetitionRoundView[]>>;
  setPendingAction: (value: string | null) => void;
  setActionError: (value: string | null) => void;
  setActionMessage: (value: string | null) => void;
}

export function useRoundActions({
  isAdmin,
  selectedCampaign,
  rounds,
  roundDrafts,
  roundQuizDrafts,
  setRoundDrafts,
  setRoundQuizDrafts,
  setRounds,
  setPendingAction,
  setActionError,
  setActionMessage,
}: RoundActionsOptions) {
  const updateRoundDraft = (
    roundNumber: number,
    patch: Partial<RoundDraft>,
  ) => {
    setRoundDrafts((current) => ({
      ...current,
      [roundNumber]: { ...current[roundNumber], ...patch },
    }));
  };

  const updateRoundQuizDraft = (
    roundNumber: number,
    patch: Partial<RoundQuizDraft>,
  ) => {
    setRoundQuizDrafts((current) => ({
      ...current,
      [roundNumber]: { ...current[roundNumber], ...patch },
    }));
  };

  const saveRound = async (roundNumber: number) => {
    if (!selectedCampaign || !isAdmin) return;
    const draft = roundDrafts[roundNumber];
    if (!draft) return;
    const round = rounds.find((item) => item.roundNumber === roundNumber);
    const maxAttempts = Number(draft.maxAttempts);
    const passingScore = Number(draft.passingScore);
    if (
      !draft.opensAt ||
      !draft.closesAt ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts <= 0 ||
      !Number.isFinite(passingScore)
    ) {
      setActionError(`Cấu hình vòng ${roundNumber} chưa hợp lệ.`);
      return;
    }
    let opensAt: string;
    let closesAt: string;
    try {
      opensAt = toIsoDateTime(draft.opensAt);
      closesAt = toIsoDateTime(draft.closesAt);
    } catch {
      setActionError(`Cấu hình vòng ${roundNumber} chưa hợp lệ.`);
      return;
    }
    const hasQuizMapping =
      Number(
        round?.quizSnapshot?.mappingCount || round?.quizMappings?.length || 0,
      ) > 0;
    if (!hasQuizMapping && new Date(opensAt).getTime() <= Date.now()) {
      setActionError(
        `Vòng ${roundNumber} chưa có quiz. Hãy đặt thời gian mở trong tương lai trước khi lưu.`,
      );
      return;
    }
    setPendingAction(`round-save-${roundNumber}`);
    setActionError(null);
    setActionMessage(null);
    try {
      const updated = await competitionDashboardService.updateRound({
        campaignId: selectedCampaign.id,
        roundId: draft.roundId,
        roundNumber,
        opensAt,
        closesAt,
        maxAttempts,
        passingRuleType: "MIN_SCORE",
        passingScore,
        requestId: createRequestId(`round-${roundNumber}-save`),
      });
      setRounds((current) =>
        [
          ...current.filter((item) => item.roundNumber !== roundNumber),
          updated,
        ].sort((left, right) => left.roundNumber - right.roundNumber),
      );
      setActionMessage(`Đã lưu vòng ${roundNumber}.`);
    } catch {
      setActionError(`Không thể lưu vòng ${roundNumber}.`);
    } finally {
      setPendingAction(null);
    }
  };

  const finalizeRound = async (roundNumber: number) => {
    if (!selectedCampaign || !isAdmin) return;
    const round = rounds.find((item) => item.roundNumber === roundNumber);
    if (!round) return;
    setPendingAction(`round-finalize-${roundNumber}`);
    setActionError(null);
    setActionMessage(null);
    try {
      const updated = await competitionDashboardService.finalizeRound(
        selectedCampaign.id,
        round.id,
        createRequestId(`round-${roundNumber}-finalize`),
      );
      setRounds((current) =>
        current.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        ),
      );
      setActionMessage(`Đã chốt vòng ${roundNumber}.`);
    } catch {
      setActionError(`Không thể chốt vòng ${roundNumber}.`);
    } finally {
      setPendingAction(null);
    }
  };

  const saveRoundQuiz = async (roundNumber: number) => {
    if (!selectedCampaign || !isAdmin) return;
    const round = rounds.find((item) => item.roundNumber === roundNumber);
    const draft = roundQuizDrafts[roundNumber];
    const gradeLevel = Number(draft?.gradeLevel);
    if (
      !round ||
      !draft?.quizId.trim() ||
      !Number.isInteger(gradeLevel) ||
      gradeLevel < 1 ||
      gradeLevel > 12
    ) {
      setActionError(`Cấu hình quiz vòng ${roundNumber} chưa hợp lệ.`);
      return;
    }
    const hasQuizMapping =
      Number(
        round.quizSnapshot?.mappingCount || round.quizMappings?.length || 0,
      ) > 0;
    if (round.status === "OPEN" && !hasQuizMapping) {
      setActionError(
        `Vòng ${roundNumber} đang mở nhưng chưa có quiz. Hãy đặt thời gian mở trong tương lai và lưu vòng trước khi gán quiz.`,
      );
      return;
    }
    setPendingAction(`round-quiz-${roundNumber}`);
    setActionError(null);
    setActionMessage(null);
    try {
      const mapping = await competitionDashboardService.upsertRoundQuiz({
        campaignId: selectedCampaign.id,
        roundId: round.id,
        gradeLevel,
        ...(draft.classId.trim() ? { classId: draft.classId.trim() } : {}),
        quizId: draft.quizId.trim(),
        requestId: createRequestId(`round-${roundNumber}-quiz`),
      });
      setRounds((current) =>
        current.map((item) => {
          if (item.id !== round.id) return item;
          const mappings = [
            ...(item.quizMappings || []).filter(
              (existing) =>
                !(
                  existing.gradeLevel === mapping.gradeLevel &&
                  existing.classId === mapping.classId
                ),
            ),
            mapping,
          ];
          return {
            ...item,
            quizMappings: mappings,
            quizSnapshot: {
              status: "LOCKED" as const,
              mappingCount: mappings.length,
            },
          };
        }),
      );
      setActionMessage(`Đã gán quiz cho vòng ${roundNumber}.`);
    } catch {
      setActionError(`Không thể gán quiz cho vòng ${roundNumber}.`);
    } finally {
      setPendingAction(null);
    }
  };

  return {
    updateRoundDraft,
    updateRoundQuizDraft,
    saveRound,
    finalizeRound,
    saveRoundQuiz,
  };
}
