import type { Dispatch, SetStateAction } from "react";
import type { CompetitionCampaignView } from "../competitionDashboardService";
import { competitionDashboardService } from "../competitionDashboardService";
import { createRequestId, splitIds, toIsoDateTime } from "./dashboardHelpers";
import type { AudiencePreview, CampaignDraft } from "./dashboardTypes";

export interface CampaignActionsOptions {
  isAdmin: boolean;
  selectedCampaign: CompetitionCampaignView | null;
  campaignDraft: CampaignDraft;
  audiencePreview: AudiencePreview | null;
  setCampaigns: Dispatch<SetStateAction<CompetitionCampaignView[]>>;
  setSelectedCampaignId: (value: string) => void;
  setAudiencePreview: Dispatch<SetStateAction<AudiencePreview | null>>;
  setAudienceFreezeConfirmOpen: (value: boolean) => void;
  setPendingAction: (value: string | null) => void;
  setActionError: (value: string | null) => void;
  setActionMessage: (value: string | null) => void;
}

export function useCampaignActions({
  isAdmin,
  selectedCampaign,
  campaignDraft,
  audiencePreview,
  setCampaigns,
  setSelectedCampaignId,
  setAudiencePreview,
  setAudienceFreezeConfirmOpen,
  setPendingAction,
  setActionError,
  setActionMessage,
}: CampaignActionsOptions) {
  const persistCampaign = async () => {
    if (!isAdmin) return;
    const gradeLevels = splitIds(campaignDraft.gradeLevels).map(Number);
    const classIds = splitIds(campaignDraft.classIds);
    const requiredPassedRounds = Number(campaignDraft.requiredPassedRounds);
    if (
      campaignDraft.title.trim().length < 3 ||
      !/^\d{4}-\d{4}$/.test(campaignDraft.schoolYear.trim()) ||
      !campaignDraft.timezone.trim() ||
      gradeLevels.length === 0 ||
      gradeLevels.some(
        (value) => !Number.isInteger(value) || value < 1 || value > 12,
      ) ||
      !Number.isInteger(requiredPassedRounds) ||
      requiredPassedRounds < 1 ||
      requiredPassedRounds > 6 ||
      !campaignDraft.startsAt ||
      !campaignDraft.endsAt
    ) {
      setActionError("Cấu hình chiến dịch chưa hợp lệ.");
      return;
    }
    setPendingAction("campaign-save");
    setActionError(null);
    setActionMessage(null);
    const payload = {
      title: campaignDraft.title.trim(),
      schoolYear: campaignDraft.schoolYear.trim(),
      timezone: campaignDraft.timezone.trim(),
      audienceRule: {
        gradeLevels,
        ...(classIds.length > 0 ? { classIds } : {}),
      },
      eligibilityPolicy: { requiredRounds: 6 as const, requiredPassedRounds },
      startsAt: toIsoDateTime(campaignDraft.startsAt),
      endsAt: toIsoDateTime(campaignDraft.endsAt),
      requestId: createRequestId(
        selectedCampaign?.status === "DRAFT"
          ? "campaign-update"
          : "campaign-create",
      ),
    };
    try {
      if (selectedCampaign?.status === "DRAFT") {
        const updated = await competitionDashboardService.updateCampaign(
          selectedCampaign.id,
          payload,
        );
        setCampaigns((current) =>
          current.map((campaign) =>
            campaign.id === updated.id ? updated : campaign,
          ),
        );
        setAudiencePreview(null);
        setAudienceFreezeConfirmOpen(false);
        setActionMessage("Đã lưu chiến dịch DRAFT.");
      } else {
        const created =
          await competitionDashboardService.createCampaign(payload);
        setCampaigns((current) => [
          created,
          ...current.filter((campaign) => campaign.id !== created.id),
        ]);
        setSelectedCampaignId(created.id);
        setActionMessage("Đã tạo chiến dịch.");
      }
    } catch {
      setActionError(
        selectedCampaign?.status === "DRAFT"
          ? "Không thể lưu chiến dịch."
          : "Không thể tạo chiến dịch.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  const previewAudience = async () => {
    if (!selectedCampaign || !isAdmin) return;
    setPendingAction("audience-preview");
    setActionError(null);
    setActionMessage(null);
    try {
      const preview = await competitionDashboardService.previewAudience(
        selectedCampaign.id,
      );
      setAudiencePreview(preview);
      setActionMessage("Đã tải bản xem trước đối tượng.");
    } catch {
      setActionError("Không thể xem trước đối tượng.");
    } finally {
      setPendingAction(null);
    }
  };

  const freezeAudience = async () => {
    if (
      !selectedCampaign ||
      !isAdmin ||
      selectedCampaign.status !== "DRAFT" ||
      !audiencePreview ||
      audiencePreview.matchedCount <= 0
    )
      return;
    const replacingSnapshot = Boolean(selectedCampaign.audienceSnapshotId);
    const expectedMemberCount = audiencePreview.matchedCount;
    setPendingAction("audience-freeze");
    setActionError(null);
    setActionMessage(null);
    try {
      const response = (await competitionDashboardService.freezeAudience(
        selectedCampaign.id,
        createRequestId("audience-freeze"),
        expectedMemberCount,
      )) as any;
      const snapshotId = response?.snapshot?.id || "LOCKED";
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === selectedCampaign.id
            ? { ...campaign, audienceSnapshotId: snapshotId }
            : campaign,
        ),
      );
      setAudienceFreezeConfirmOpen(false);
      setAudiencePreview(null);
      setActionMessage(
        replacingSnapshot
          ? `Đã tạo AudienceSnapshot mới với ${expectedMemberCount} học sinh.`
          : `Đã đóng băng AudienceSnapshot với ${expectedMemberCount} học sinh.`,
      );
    } catch (error) {
      setAudienceFreezeConfirmOpen(false);
      if (
        error instanceof Error &&
        error.message.includes("COMPETITION_AUDIENCE_CHANGED_REVIEW_REQUIRED")
      ) {
        setAudiencePreview(null);
        setActionError(
          "Danh sách học sinh đã thay đổi. Hãy xem trước đối tượng lại trước khi tạo snapshot.",
        );
      } else {
        setActionError("Không thể đóng băng đối tượng.");
      }
    } finally {
      setPendingAction(null);
    }
  };

  return { persistCampaign, previewAudience, freezeAudience };
}
