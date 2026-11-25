import React, { useEffect, useState } from "react";
import { SYSTEM_TIME_ZONE } from "../../../shared/time-zone.contract";
import { useAuthStore } from "../../../stores/authStore";
import type {
  SchoolExamCertificateBatchView,
  SchoolExamExportView,
} from "./competitionDashboardService";
import CompetitionPublicContentPanel from "./public-content/CompetitionPublicContentPanel";
import {
  createRequestId,
  formatDateTime,
  ROUND_NUMBERS,
  splitIds,
  toDateTimeLocal,
  toIsoDateTime,
} from "./dashboard/dashboardHelpers";
import type {
  AudiencePreview,
  CampaignDraft,
  CertificateDraft,
  CorrectionDraft,
  ExamDraft,
  IncidentDraft,
  RoundDraft,
  RoundQuizDraft,
  RoomDraft,
} from "./dashboard/dashboardTypes";
import { AudienceFreezeDialog } from "./dashboard/AudienceFreezeDialog";
import { CampaignAudienceSection } from "./dashboard/CampaignAudienceSection";
import { CertificatesExportsSection } from "./dashboard/CertificatesExportsSection";
import { EligibilitySection } from "./dashboard/EligibilitySection";
import { PublicationSection } from "./dashboard/PublicationSection";
import { ReconciliationSection } from "./dashboard/ReconciliationSection";
import { RoundsSection } from "./dashboard/RoundsSection";
import { SchoolExamSection } from "./dashboard/SchoolExamSection";
import { useCompetitionDashboardData } from "./dashboard/useCompetitionDashboardData";
import { useCampaignActions } from "./dashboard/useCampaignActions";
import { useRoundActions } from "./dashboard/useRoundActions";
import { useSchoolExamActions } from "./dashboard/useSchoolExamActions";
import { useEligibilityActions } from "./dashboard/useEligibilityActions";
import { usePublicationActions } from "./dashboard/usePublicationActions";
import { useDownstreamActions } from "./dashboard/useDownstreamActions";

interface CompetitionDashboardPageProps {
  isAdmin: boolean;
  username?: string | null;
}

const CompetitionDashboardPage: React.FC<CompetitionDashboardPageProps> = ({
  isAdmin,
}) => {
  const teacherClasses = useAuthStore((state) => state.teacherClasses);
  const [audiencePreview, setAudiencePreview] =
    useState<AudiencePreview | null>(null);
  const [audienceFreezeConfirmOpen, setAudienceFreezeConfirmOpen] =
    useState(false);
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>({
    title: "",
    schoolYear: "",
    timezone: SYSTEM_TIME_ZONE,
    gradeLevels: "",
    classIds: "",
    requiredPassedRounds: "6",
    startsAt: "",
    endsAt: "",
  });
  const [roundDrafts, setRoundDrafts] = useState<Record<number, RoundDraft>>(
    {},
  );
  const [roundQuizDrafts, setRoundQuizDrafts] = useState<
    Record<number, RoundQuizDraft>
  >({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [examDraft, setExamDraft] = useState<ExamDraft>({
    title: "",
    examDate: "",
    examFormPolicy: "SAME_FORM" as "SAME_FORM" | "EQUIVALENT_FORM_SET",
    capacityProfileId: "",
  });
  const [roomDraft, setRoomDraft] = useState<RoomDraft>({
    name: "",
    roomCode: "",
    scheduledAt: "",
    durationMinutes: "45",
    checkInLeadMinutes: "15",
    closeDrainMinutes: "10",
    formCode: "A",
    quizId: "",
    invigilatorIds: "",
    studentIds: "",
    blueprintId: "",
    totalScore: "10",
    difficulty: "MEDIUM",
    gradeLevel: "4",
    objectiveIds: "",
    equivalentFormApproved: false,
  });
  const [correctionDraft, setCorrectionDraft] = useState<CorrectionDraft>({
    studentId: "",
    score: "",
    correctCount: "",
    timeTaken: "",
    reason: "",
  });
  const [exportJob, setExportJob] = useState<SchoolExamExportView | null>(null);
  const [certificateDraft, setCertificateDraft] = useState<CertificateDraft>({
    templateId: "",
    winnerStudentIds: "",
    title: "",
    message: "",
    achievementPrefix: "",
  });
  const [certificateBatch, setCertificateBatch] =
    useState<SchoolExamCertificateBatchView | null>(null);
  const [incidentDraft, setIncidentDraft] = useState<IncidentDraft>({
    roomId: "",
    studentId: "",
    originalResultId: "",
    reasonCode: "NETWORK_FAILURE",
    reasonText: "",
  });
  const [retestResolution, setRetestResolution] = useState<
    Record<
      string,
      "KEEP_ORIGINAL" | "REPLACE_WITH_RETEST" | "INVALIDATE_RESULT"
    >
  >({});

  const teacherClassId = teacherClasses[0]?.id || null;
  const {
    campaigns,
    setCampaigns,
    selectedCampaignId,
    setSelectedCampaignId,
    rounds,
    setRounds,
    roundsLoadedCampaignId,
    eligibility,
    setEligibility,
    admissions,
    setAdmissions,
    progress,
    schoolExamEvents,
    setSchoolExamEvents,
    loadingCampaigns,
    loadingDetails,
    loadError,
    selectedCampaign,
    selectedEvent,
    selectedEventId,
    selectedEventStatus,
    reconcile,
    setReconcile,
    incidents,
    setIncidents,
    retests,
    setRetests,
    rankings,
    setRankings,
    resultCorrections,
    setResultCorrections,
  } = useCompetitionDashboardData({ isAdmin, teacherClassId });

  const { persistCampaign, previewAudience, freezeAudience } =
    useCampaignActions({
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
    });

  const {
    updateRoundDraft,
    updateRoundQuizDraft,
    saveRound,
    finalizeRound,
    saveRoundQuiz,
  } = useRoundActions({
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
  });

  const {
    createSchoolExamEvent,
    createSchoolExamRoom,
    runPreflight,
    provisionSchoolExam,
  } = useSchoolExamActions({
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
  });

  const { finalizeEligibility, approveAdmissions } = useEligibilityActions({
    isAdmin,
    selectedCampaign,
    eligibility,
    setEligibility,
    setAdmissions,
    setCampaigns,
    setPendingAction,
    setActionError,
    setActionMessage,
  });

  const {
    startReconcile,
    publishResults,
    createResultCorrection,
    republishCorrectedResults,
    reportIncident,
    grantRetest,
  } = usePublicationActions({
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
  });

  const { createCertificates, createExport, refreshExport } =
    useDownstreamActions({
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
    });

  useEffect(() => {
    const drafts: Record<number, RoundDraft> = {};
    for (const roundNumber of ROUND_NUMBERS) {
      const round = rounds.find((item) => item.roundNumber === roundNumber);
      drafts[roundNumber] = {
        roundId: round?.id || `${selectedCampaignId}-round-${roundNumber}`,
        opensAt: toDateTimeLocal(round?.opensAt),
        closesAt: toDateTimeLocal(round?.closesAt),
        maxAttempts: String(round?.maxAttempts ?? 1),
        passingScore: String(round?.passingScore ?? 0),
      };
    }
    setRoundDrafts(drafts);
  }, [rounds, selectedCampaignId]);

  useEffect(() => {
    const drafts: Record<number, RoundQuizDraft> = {};
    for (const roundNumber of ROUND_NUMBERS) {
      const round = rounds.find((item) => item.roundNumber === roundNumber);
      const mapping = round?.quizMappings?.[0];
      drafts[roundNumber] = {
        gradeLevel: String(
          mapping?.gradeLevel ||
            selectedCampaign?.audienceRule?.gradeLevels?.[0] ||
            1,
        ),
        classId: mapping?.classId || "",
        quizId: mapping?.quizId || "",
      };
    }
    setRoundQuizDrafts(drafts);
  }, [rounds, selectedCampaign]);

  useEffect(() => {
    if (!selectedCampaign || selectedCampaign.status !== "DRAFT") return;
    setCampaignDraft({
      title: selectedCampaign.title,
      schoolYear: selectedCampaign.schoolYear,
      timezone: selectedCampaign.timezone || SYSTEM_TIME_ZONE,
      gradeLevels: (selectedCampaign.audienceRule?.gradeLevels || []).join(
        ", ",
      ),
      classIds: (selectedCampaign.audienceRule?.classIds || []).join(", "),
      requiredPassedRounds: String(
        selectedCampaign.eligibilityPolicy?.requiredPassedRounds ?? 6,
      ),
      startsAt: toDateTimeLocal(selectedCampaign.startsAt),
      endsAt: toDateTimeLocal(selectedCampaign.endsAt),
    });
  }, [selectedCampaign]);

  const qualifiedCount =
    eligibility?.items.filter((item) => item.qualified).length || 0;
  const preflight = selectedEvent?.preflight || null;

  return (
    <section
      className="mx-auto w-full max-w-[1440px] space-y-6"
      aria-labelledby="competition-dashboard-title"
    >
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Competition V1
            </p>
            <h1
              id="competition-dashboard-title"
              className="mt-1 text-2xl font-bold text-slate-950"
            >
              Cuộc thi
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Theo dõi chiến dịch, sáu vòng thi và kỳ thi cấp trường trên cùng
              một luồng.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {isAdmin ? "Quản trị" : "Chỉ đọc theo phạm vi lớp"}
          </span>
        </div>
      </header>

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {loadError}
        </div>
      )}
      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {actionError}
        </div>
      )}
      {actionMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {actionMessage}
        </div>
      )}

      <CompetitionPublicContentPanel
        campaignId={selectedCampaign?.id ?? ""}
        isAdmin={isAdmin}
        schoolExamEvents={schoolExamEvents}
        campaign={selectedCampaign}
        rounds={rounds}
        roundsLoadedCampaignId={roundsLoadedCampaignId}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <CampaignAudienceSection
          isAdmin={isAdmin}
          campaigns={campaigns}
          selectedCampaignId={selectedCampaignId}
          selectedCampaign={selectedCampaign}
          loadingCampaigns={loadingCampaigns}
          loadingDetails={loadingDetails}
          pendingAction={pendingAction}
          campaignDraft={campaignDraft}
          audiencePreview={audiencePreview}
          setSelectedCampaignId={setSelectedCampaignId}
          setAudiencePreview={setAudiencePreview}
          setAudienceFreezeConfirmOpen={setAudienceFreezeConfirmOpen}
          setCampaignDraft={setCampaignDraft}
          persistCampaign={persistCampaign}
          previewAudience={previewAudience}
        />

        <RoundsSection
          isAdmin={isAdmin}
          rounds={rounds}
          roundDrafts={roundDrafts}
          roundQuizDrafts={roundQuizDrafts}
          loadingDetails={loadingDetails}
          pendingAction={pendingAction}
          selectedCampaign={selectedCampaign}
          updateRoundDraft={updateRoundDraft}
          updateRoundQuizDraft={updateRoundQuizDraft}
          saveRound={saveRound}
          finalizeRound={finalizeRound}
          saveRoundQuiz={saveRoundQuiz}
        />

        <EligibilitySection
          isAdmin={isAdmin}
          selectedCampaignId={selectedCampaignId}
          selectedCampaign={selectedCampaign}
          eligibility={eligibility}
          admissions={admissions}
          progress={progress}
          qualifiedCount={qualifiedCount}
          loadingDetails={loadingDetails}
          pendingAction={pendingAction}
          approveAdmissions={approveAdmissions}
          finalizeEligibility={finalizeEligibility}
        />

        <SchoolExamSection
          isAdmin={isAdmin}
          selectedEvent={selectedEvent}
          eligibility={eligibility}
          preflight={preflight}
          examDraft={examDraft}
          roomDraft={roomDraft}
          pendingAction={pendingAction}
          setExamDraft={setExamDraft}
          setRoomDraft={setRoomDraft}
          createSchoolExamEvent={createSchoolExamEvent}
          createSchoolExamRoom={createSchoolExamRoom}
          runPreflight={runPreflight}
          provisionSchoolExam={provisionSchoolExam}
        />

        <ReconciliationSection
          isAdmin={isAdmin}
          selectedEvent={selectedEvent}
          reconcile={reconcile}
          incidents={incidents}
          retests={retests}
          incidentDraft={incidentDraft}
          retestResolution={retestResolution}
          pendingAction={pendingAction}
          setIncidentDraft={setIncidentDraft}
          setRetestResolution={setRetestResolution}
          grantRetest={grantRetest}
          reportIncident={reportIncident}
          startReconcile={startReconcile}
        />

        <PublicationSection
          isAdmin={isAdmin}
          selectedEvent={selectedEvent}
          rankings={rankings}
          resultCorrections={resultCorrections}
          correctionDraft={correctionDraft}
          pendingAction={pendingAction}
          setCorrectionDraft={setCorrectionDraft}
          publishResults={publishResults}
          createResultCorrection={createResultCorrection}
          republishCorrectedResults={republishCorrectedResults}
        />

        <CertificatesExportsSection
          isAdmin={isAdmin}
          teacherClassId={teacherClassId}
          selectedEvent={selectedEvent}
          rankings={rankings}
          certificateDraft={certificateDraft}
          certificateBatch={certificateBatch}
          exportJob={exportJob}
          pendingAction={pendingAction}
          setCertificateDraft={setCertificateDraft}
          createCertificates={createCertificates}
          createExport={createExport}
          refreshExport={refreshExport}
        />
      </div>
      {audienceFreezeConfirmOpen && selectedCampaign && audiencePreview && (
        <AudienceFreezeDialog
          selectedCampaign={selectedCampaign}
          audiencePreview={audiencePreview}
          pendingAction={pendingAction}
          onClose={() => setAudienceFreezeConfirmOpen(false)}
          onConfirm={freezeAudience}
        />
      )}
    </section>
  );
};

export default CompetitionDashboardPage;
