import { useEffect, useMemo, useState } from "react";
import {
  competitionDashboardService,
  type CompetitionCampaignView,
  type CompetitionEligibilityView,
  type CompetitionProgressItemView,
  type CompetitionRoundView,
  type CompetitionSchoolExamAdmissionsView,
  type SchoolExamEventView,
  type SchoolExamIncidentView,
  type SchoolExamRankingView,
  type SchoolExamReconcileView,
  type SchoolExamRetestView,
  type SchoolExamResultCorrectionView,
} from "../competitionDashboardService";

export interface CompetitionDashboardDataOptions {
  isAdmin: boolean;
  teacherClassId: string | null;
}

export function useCompetitionDashboardData({
  isAdmin,
  teacherClassId,
}: CompetitionDashboardDataOptions) {
  const [campaigns, setCampaigns] = useState<CompetitionCampaignView[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [rounds, setRounds] = useState<CompetitionRoundView[]>([]);
  const [roundsLoadedCampaignId, setRoundsLoadedCampaignId] = useState<
    string | null
  >(null);
  const [eligibility, setEligibility] =
    useState<CompetitionEligibilityView | null>(null);
  const [admissions, setAdmissions] =
    useState<CompetitionSchoolExamAdmissionsView | null>(null);
  const [progress, setProgress] = useState<CompetitionProgressItemView[]>([]);
  const [schoolExamEvents, setSchoolExamEvents] = useState<
    SchoolExamEventView[]
  >([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reconcile, setReconcile] = useState<SchoolExamReconcileView | null>(
    null,
  );
  const [incidents, setIncidents] = useState<SchoolExamIncidentView[]>([]);
  const [retests, setRetests] = useState<SchoolExamRetestView[]>([]);
  const [rankings, setRankings] = useState<SchoolExamRankingView | null>(null);
  const [resultCorrections, setResultCorrections] = useState<
    SchoolExamResultCorrectionView[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCampaigns(true);
    setLoadError(null);
    void competitionDashboardService
      .listCampaigns()
      .then((items) => {
        if (cancelled) return;
        setCampaigns(items);
        setSelectedCampaignId((current) => current || items[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) setLoadError("Không tải được danh sách cuộc thi.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCampaigns(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRoundsLoadedCampaignId(null);
    if (!selectedCampaignId) {
      setRounds([]);
      setEligibility(null);
      setAdmissions(null);
      setProgress([]);
      setSchoolExamEvents([]);
      return;
    }
    let cancelled = false;
    setLoadingDetails(true);
    void Promise.allSettled([
      competitionDashboardService.listRounds(selectedCampaignId),
      competitionDashboardService.getEligibility(selectedCampaignId),
      competitionDashboardService.listSchoolExamEvents(selectedCampaignId),
      isAdmin
        ? Promise.resolve([] as CompetitionProgressItemView[])
        : competitionDashboardService.listProgress(selectedCampaignId),
      isAdmin
        ? competitionDashboardService.listSchoolExamAdmissions(
            selectedCampaignId,
          )
        : Promise.resolve(null),
    ])
      .then(
        ([
          roundResult,
          eligibilityResult,
          examResult,
          progressResult,
          admissionResult,
        ]) => {
          if (cancelled) return;
          setRounds(
            roundResult.status === "fulfilled" ? roundResult.value : [],
          );
          if (roundResult.status === "fulfilled")
            setRoundsLoadedCampaignId(selectedCampaignId);
          setEligibility(
            eligibilityResult.status === "fulfilled"
              ? eligibilityResult.value
              : null,
          );
          setSchoolExamEvents(
            examResult.status === "fulfilled" ? examResult.value : [],
          );
          setProgress(
            progressResult.status === "fulfilled" ? progressResult.value : [],
          );
          setAdmissions(
            admissionResult.status === "fulfilled"
              ? admissionResult.value
              : null,
          );
          if (
            roundResult.status === "rejected" &&
            examResult.status === "rejected"
          ) {
            setLoadError("Không tải được dữ liệu vận hành cuộc thi.");
          }
        },
      )
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, selectedCampaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((item) => item.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId],
  );
  const selectedEvent = schoolExamEvents[0] || null;
  const selectedEventId = selectedEvent?.id || "";
  const selectedEventStatus = selectedEvent?.status || "";

  useEffect(() => {
    if (!selectedEventId) {
      setReconcile(null);
      setIncidents([]);
      setRetests([]);
      setRankings(null);
      setResultCorrections([]);
      return;
    }
    let cancelled = false;
    void Promise.allSettled([
      competitionDashboardService.getReconcile(selectedEventId),
      competitionDashboardService.listIncidents(selectedEventId),
      competitionDashboardService.listRetests(selectedEventId),
    ]).then(([reconcileResult, incidentResult, retestResult]) => {
      if (cancelled) return;
      setReconcile(
        reconcileResult.status === "fulfilled" ? reconcileResult.value : null,
      );
      setIncidents(
        incidentResult.status === "fulfilled" ? incidentResult.value : [],
      );
      setRetests(retestResult.status === "fulfilled" ? retestResult.value : []);
    });
    if (selectedEventStatus === "PUBLISHED" && (isAdmin || teacherClassId)) {
      const rankingPayload = isAdmin
        ? { scope: "EVENT" as const }
        : { scope: "CLASS" as const, classId: teacherClassId || undefined };
      void competitionDashboardService
        .getRankings(selectedEventId, rankingPayload)
        .then((value) => {
          if (!cancelled) setRankings(value);
        })
        .catch(() => {
          if (!cancelled) setRankings(null);
        });
      if (isAdmin) {
        void competitionDashboardService
          .listResultCorrections(selectedEventId)
          .then((value) => {
            if (!cancelled) setResultCorrections(value);
          })
          .catch(() => {
            if (!cancelled) setResultCorrections([]);
          });
      } else {
        setResultCorrections([]);
      }
    } else {
      setRankings(null);
      setResultCorrections([]);
    }
    return () => {
      cancelled = true;
    };
  }, [isAdmin, selectedEventId, selectedEventStatus, teacherClassId]);

  return {
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
  };
}
