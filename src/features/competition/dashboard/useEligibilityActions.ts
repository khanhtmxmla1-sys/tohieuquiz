import type { Dispatch, SetStateAction } from "react";
import type {
  CompetitionCampaignView,
  CompetitionEligibilityView,
  CompetitionSchoolExamAdmissionsView,
} from "../competitionDashboardService";
import { competitionDashboardService } from "../competitionDashboardService";
import { createRequestId } from "./dashboardHelpers";

export interface EligibilityActionsOptions {
  isAdmin: boolean;
  selectedCampaign: CompetitionCampaignView | null;
  eligibility: CompetitionEligibilityView | null;
  setEligibility: Dispatch<SetStateAction<CompetitionEligibilityView | null>>;
  setAdmissions: Dispatch<
    SetStateAction<CompetitionSchoolExamAdmissionsView | null>
  >;
  setCampaigns: Dispatch<SetStateAction<CompetitionCampaignView[]>>;
  setPendingAction: (value: string | null) => void;
  setActionError: (value: string | null) => void;
  setActionMessage: (value: string | null) => void;
}

export function useEligibilityActions({
  isAdmin,
  selectedCampaign,
  eligibility,
  setEligibility,
  setAdmissions,
  setCampaigns,
  setPendingAction,
  setActionError,
  setActionMessage,
}: EligibilityActionsOptions) {
  const finalizeEligibility = async () => {
    if (!selectedCampaign || !isAdmin) return;
    setPendingAction("eligibility-finalize");
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.finalizeEligibility(
        selectedCampaign.id,
        createRequestId("eligibility-finalize"),
      );
      const updated = await competitionDashboardService.getEligibility(
        selectedCampaign.id,
      );
      setEligibility(updated);
      const updatedAdmissions =
        await competitionDashboardService.listSchoolExamAdmissions(
          selectedCampaign.id,
          updated.version,
        );
      setAdmissions(updatedAdmissions);
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === selectedCampaign.id
            ? { ...campaign, status: "ELIGIBILITY_LOCKED" }
            : campaign,
        ),
      );
      setActionMessage("Đã chốt điều kiện dự thi.");
    } catch {
      setActionError("Không thể chốt điều kiện dự thi.");
    } finally {
      setPendingAction(null);
    }
  };

  const approveAdmissions = async (studentIds?: string[]) => {
    if (!selectedCampaign || !eligibility || !isAdmin) return;
    setPendingAction(
      studentIds ? `admission-${studentIds[0]}` : "admission-all",
    );
    setActionError(null);
    setActionMessage(null);
    try {
      const result =
        await competitionDashboardService.approveSchoolExamAdmissions({
          campaignId: selectedCampaign.id,
          eligibilitySnapshotVersion: eligibility.version,
          ...(studentIds ? { studentIds } : { approveAllQualified: true }),
          requestId: createRequestId(
            studentIds ? "school-exam-admission" : "school-exam-admission-all",
          ),
        });
      setAdmissions(
        await competitionDashboardService.listSchoolExamAdmissions(
          selectedCampaign.id,
          eligibility.version,
        ),
      );
      setActionMessage(
        `Đã duyệt ${result.approvedCount} học sinh vào vòng cấp trường.`,
      );
    } catch {
      setActionError("Không thể duyệt học sinh vào vòng cấp trường.");
    } finally {
      setPendingAction(null);
    }
  };

  return { finalizeEligibility, approveAdmissions };
}
