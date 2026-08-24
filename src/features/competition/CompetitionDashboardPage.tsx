import React, { useEffect, useMemo, useState } from 'react';
import { SYSTEM_TIME_ZONE } from '../../../shared/time-zone.contract';
import { useAuthStore } from '../../../stores/authStore';
import {
  formatSystemDateTime,
  systemDateTimeLocalToIso,
  toSystemDateTimeLocal,
} from '../../utils/dateTime';
import {
  competitionDashboardService,
  type CompetitionCampaignView,
  type CompetitionEligibilityView,
  type CompetitionProgressItemView,
  type CompetitionRoundView,
  type SchoolExamCertificateBatchView,
  type SchoolExamEventView,
  type SchoolExamExportView,
  type SchoolExamIncidentView,
  type SchoolExamRankingView,
  type SchoolExamReconcileView,
  type SchoolExamRetestView,
  type SchoolExamResultCorrectionView,
} from './competitionDashboardService';

interface CompetitionDashboardPageProps {
  isAdmin: boolean;
  username?: string | null;
}

type CampaignDraft = {
  title: string;
  schoolYear: string;
  timezone: string;
  gradeLevels: string;
  classIds: string;
  requiredPassedRounds: string;
  startsAt: string;
  endsAt: string;
};

type RoundDraft = {
  roundId: string;
  opensAt: string;
  closesAt: string;
  maxAttempts: string;
  passingScore: string;
};

type RoundQuizDraft = {
  gradeLevel: string;
  classId: string;
  quizId: string;
};

const ROUND_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

const splitIds = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

const createRequestId = (prefix: string) => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
};

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return '';
  try {
    return toSystemDateTimeLocal(value);
  } catch {
    return '';
  }
};

const toIsoDateTime = (value: string) => {
  if (!value) throw new Error('INVALID_DATE_TIME');
  try {
    return systemDateTimeLocalToIso(value);
  } catch {
    throw new Error('INVALID_DATE_TIME');
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  return formatSystemDateTime(value, value);
};

const CompetitionDashboardPage: React.FC<CompetitionDashboardPageProps> = ({ isAdmin }) => {
  const teacherClasses = useAuthStore(state => state.teacherClasses);
  const [campaigns, setCampaigns] = useState<CompetitionCampaignView[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [rounds, setRounds] = useState<CompetitionRoundView[]>([]);
  const [eligibility, setEligibility] = useState<CompetitionEligibilityView | null>(null);
  const [progress, setProgress] = useState<CompetitionProgressItemView[]>([]);
  const [schoolExamEvents, setSchoolExamEvents] = useState<SchoolExamEventView[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audiencePreview, setAudiencePreview] = useState<{ matchedCount: number; countsByGrade?: Record<string, number>; countsByClass?: Record<string, number> } | null>(null);
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>({
    title: '', schoolYear: '', timezone: SYSTEM_TIME_ZONE, gradeLevels: '', classIds: '',
    requiredPassedRounds: '6', startsAt: '', endsAt: '',
  });
  const [roundDrafts, setRoundDrafts] = useState<Record<number, RoundDraft>>({});
  const [roundQuizDrafts, setRoundQuizDrafts] = useState<Record<number, RoundQuizDraft>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [examDraft, setExamDraft] = useState({
    title: '', examDate: '', examFormPolicy: 'SAME_FORM' as 'SAME_FORM' | 'EQUIVALENT_FORM_SET', capacityProfileId: '',
  });
  const [roomDraft, setRoomDraft] = useState({
    name: '', roomCode: '', scheduledAt: '', durationMinutes: '45', checkInLeadMinutes: '15', closeDrainMinutes: '10',
    formCode: 'A', quizId: '', invigilatorIds: '', studentIds: '', blueprintId: '', totalScore: '10', difficulty: 'MEDIUM',
    gradeLevel: '4', objectiveIds: '', equivalentFormApproved: false,
  });
  const [reconcile, setReconcile] = useState<SchoolExamReconcileView | null>(null);
  const [incidents, setIncidents] = useState<SchoolExamIncidentView[]>([]);
  const [retests, setRetests] = useState<SchoolExamRetestView[]>([]);
  const [rankings, setRankings] = useState<SchoolExamRankingView | null>(null);
  const [resultCorrections, setResultCorrections] = useState<SchoolExamResultCorrectionView[]>([]);
  const [correctionDraft, setCorrectionDraft] = useState({
    studentId: '', score: '', correctCount: '', timeTaken: '', reason: '',
  });
  const [exportJob, setExportJob] = useState<SchoolExamExportView | null>(null);
  const [certificateDraft, setCertificateDraft] = useState({ templateId: '', winnerStudentIds: '', title: '', message: '', achievementPrefix: '' });
  const [certificateBatch, setCertificateBatch] = useState<SchoolExamCertificateBatchView | null>(null);
  const [incidentDraft, setIncidentDraft] = useState({ roomId: '', studentId: '', originalResultId: '', reasonCode: 'NETWORK_FAILURE', reasonText: '' });
  const [retestResolution, setRetestResolution] = useState<Record<string, 'KEEP_ORIGINAL' | 'REPLACE_WITH_RETEST' | 'INVALIDATE_RESULT'>>({});

  useEffect(() => {
    let cancelled = false;
    setLoadingCampaigns(true);
    setLoadError(null);
    void competitionDashboardService.listCampaigns()
      .then((items) => {
        if (cancelled) return;
        setCampaigns(items);
        setSelectedCampaignId(current => current || items[0]?.id || '');
      })
      .catch(() => {
        if (!cancelled) setLoadError('Không tải được danh sách cuộc thi.');
      })
      .finally(() => {
        if (!cancelled) setLoadingCampaigns(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) {
      setRounds([]);
      setEligibility(null);
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
      isAdmin ? Promise.resolve([] as CompetitionProgressItemView[]) : competitionDashboardService.listProgress(selectedCampaignId),
    ]).then(([roundResult, eligibilityResult, examResult, progressResult]) => {
      if (cancelled) return;
      setRounds(roundResult.status === 'fulfilled' ? roundResult.value : []);
      setEligibility(eligibilityResult.status === 'fulfilled' ? eligibilityResult.value : null);
      setSchoolExamEvents(examResult.status === 'fulfilled' ? examResult.value : []);
      setProgress(progressResult.status === 'fulfilled' ? progressResult.value : []);
      if (roundResult.status === 'rejected' && examResult.status === 'rejected') {
        setLoadError('Không tải được dữ liệu vận hành cuộc thi.');
      }
    }).finally(() => {
      if (!cancelled) setLoadingDetails(false);
    });
    return () => { cancelled = true; };
  }, [isAdmin, selectedCampaignId]);

  useEffect(() => {
    const drafts: Record<number, RoundDraft> = {};
    for (const roundNumber of ROUND_NUMBERS) {
      const round = rounds.find(item => item.roundNumber === roundNumber);
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

  const selectedCampaign = useMemo(
    () => campaigns.find(item => item.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId],
  );

  useEffect(() => {
    const drafts: Record<number, RoundQuizDraft> = {};
    for (const roundNumber of ROUND_NUMBERS) {
      const round = rounds.find(item => item.roundNumber === roundNumber);
      const mapping = round?.quizMappings?.[0];
      drafts[roundNumber] = {
        gradeLevel: String(mapping?.gradeLevel || selectedCampaign?.audienceRule?.gradeLevels?.[0] || 1),
        classId: mapping?.classId || '',
        quizId: mapping?.quizId || '',
      };
    }
    setRoundQuizDrafts(drafts);
  }, [rounds, selectedCampaign]);

  useEffect(() => {
    if (!selectedCampaign || selectedCampaign.status !== 'DRAFT') return;
    setCampaignDraft({
      title: selectedCampaign.title,
      schoolYear: selectedCampaign.schoolYear,
      timezone: selectedCampaign.timezone || SYSTEM_TIME_ZONE,
      gradeLevels: (selectedCampaign.audienceRule?.gradeLevels || []).join(', '),
      classIds: (selectedCampaign.audienceRule?.classIds || []).join(', '),
      requiredPassedRounds: String(selectedCampaign.eligibilityPolicy?.requiredPassedRounds ?? 6),
      startsAt: toDateTimeLocal(selectedCampaign.startsAt),
      endsAt: toDateTimeLocal(selectedCampaign.endsAt),
    });
  }, [selectedCampaign]);

  const selectedEvent = schoolExamEvents[0] || null;
  const qualifiedCount = eligibility?.items.filter(item => item.qualified).length || 0;
  const teacherClassId = teacherClasses[0]?.id || null;
  const preflight = selectedEvent?.preflight || null;
  const selectedEventId = selectedEvent?.id || '';
  const selectedEventStatus = selectedEvent?.status || '';

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
      setReconcile(reconcileResult.status === 'fulfilled' ? reconcileResult.value : null);
      setIncidents(incidentResult.status === 'fulfilled' ? incidentResult.value : []);
      setRetests(retestResult.status === 'fulfilled' ? retestResult.value : []);
    });
    if (selectedEventStatus === 'PUBLISHED' && (isAdmin || teacherClassId)) {
      const rankingPayload = isAdmin
        ? { scope: 'EVENT' as const }
        : { scope: 'CLASS' as const, classId: teacherClassId || undefined };
      void competitionDashboardService.getRankings(selectedEventId, rankingPayload)
        .then(value => { if (!cancelled) setRankings(value); })
        .catch(() => { if (!cancelled) setRankings(null); });
      if (isAdmin) {
        void competitionDashboardService.listResultCorrections(selectedEventId)
          .then(value => { if (!cancelled) setResultCorrections(value); })
          .catch(() => { if (!cancelled) setResultCorrections([]); });
      } else {
        setResultCorrections([]);
      }
    } else {
      setRankings(null);
      setResultCorrections([]);
    }
    return () => { cancelled = true; };
  }, [isAdmin, selectedEventId, selectedEventStatus, teacherClassId]);

  const persistCampaign = async () => {
    if (!isAdmin) return;
    const gradeLevels = splitIds(campaignDraft.gradeLevels).map(Number);
    const classIds = splitIds(campaignDraft.classIds);
    const requiredPassedRounds = Number(campaignDraft.requiredPassedRounds);
    if (
      campaignDraft.title.trim().length < 3
      || !/^\d{4}-\d{4}$/.test(campaignDraft.schoolYear.trim())
      || !campaignDraft.timezone.trim()
      || gradeLevels.length === 0
      || gradeLevels.some(value => !Number.isInteger(value) || value < 1 || value > 12)
      || !Number.isInteger(requiredPassedRounds) || requiredPassedRounds < 1 || requiredPassedRounds > 6
      || !campaignDraft.startsAt || !campaignDraft.endsAt
    ) {
      setActionError('Cấu hình chiến dịch chưa hợp lệ.');
      return;
    }
    setPendingAction('campaign-save');
    setActionError(null);
    setActionMessage(null);
    const payload = {
      title: campaignDraft.title.trim(),
      schoolYear: campaignDraft.schoolYear.trim(),
      timezone: campaignDraft.timezone.trim(),
      audienceRule: { gradeLevels, ...(classIds.length > 0 ? { classIds } : {}) },
      eligibilityPolicy: { requiredRounds: 6 as const, requiredPassedRounds },
      startsAt: toIsoDateTime(campaignDraft.startsAt),
      endsAt: toIsoDateTime(campaignDraft.endsAt),
      requestId: createRequestId(selectedCampaign?.status === 'DRAFT' ? 'campaign-update' : 'campaign-create'),
    };
    try {
      if (selectedCampaign?.status === 'DRAFT') {
        const updated = await competitionDashboardService.updateCampaign(selectedCampaign.id, payload);
        setCampaigns(current => current.map(campaign => campaign.id === updated.id ? updated : campaign));
        setActionMessage('Đã lưu chiến dịch DRAFT.');
      } else {
        const created = await competitionDashboardService.createCampaign(payload);
        setCampaigns(current => [created, ...current.filter(campaign => campaign.id !== created.id)]);
        setSelectedCampaignId(created.id);
        setActionMessage('Đã tạo chiến dịch.');
      }
    } catch {
      setActionError(selectedCampaign?.status === 'DRAFT' ? 'Không thể lưu chiến dịch.' : 'Không thể tạo chiến dịch.');
    } finally {
      setPendingAction(null);
    }
  };

  const updateRoundDraft = (roundNumber: number, patch: Partial<RoundDraft>) => {
    setRoundDrafts(current => ({
      ...current,
      [roundNumber]: { ...current[roundNumber], ...patch },
    }));
  };

  const updateRoundQuizDraft = (roundNumber: number, patch: Partial<RoundQuizDraft>) => {
    setRoundQuizDrafts(current => ({
      ...current,
      [roundNumber]: { ...current[roundNumber], ...patch },
    }));
  };

  const previewAudience = async () => {
    if (!selectedCampaign || !isAdmin) return;
    setPendingAction('audience-preview');
    setActionError(null);
    setActionMessage(null);
    try {
      const preview = await competitionDashboardService.previewAudience(selectedCampaign.id);
      setAudiencePreview(preview);
      setActionMessage('Đã tải bản xem trước đối tượng.');
    } catch {
      setActionError('Không thể xem trước đối tượng.');
    } finally {
      setPendingAction(null);
    }
  };

  const freezeAudience = async () => {
    if (!selectedCampaign || !isAdmin || selectedCampaign.audienceSnapshotId) return;
    setPendingAction('audience-freeze');
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await competitionDashboardService.freezeAudience(
        selectedCampaign.id,
        createRequestId('audience-freeze'),
      ) as any;
      const snapshotId = response?.snapshot?.id || 'LOCKED';
      setCampaigns(current => current.map(campaign => (
        campaign.id === selectedCampaign.id ? { ...campaign, audienceSnapshotId: snapshotId } : campaign
      )));
      setActionMessage('Đã đóng băng AudienceSnapshot.');
    } catch {
      setActionError('Không thể đóng băng đối tượng.');
    } finally {
      setPendingAction(null);
    }
  };

  const saveRound = async (roundNumber: number) => {
    if (!selectedCampaign || !isAdmin) return;
    const draft = roundDrafts[roundNumber];
    if (!draft) return;
    const round = rounds.find(item => item.roundNumber === roundNumber);
    const maxAttempts = Number(draft.maxAttempts);
    const passingScore = Number(draft.passingScore);
    if (!draft.opensAt || !draft.closesAt || !Number.isInteger(maxAttempts) || maxAttempts <= 0 || !Number.isFinite(passingScore)) {
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
    const hasQuizMapping = Number(round?.quizSnapshot?.mappingCount || round?.quizMappings?.length || 0) > 0;
    if (!hasQuizMapping && new Date(opensAt).getTime() <= Date.now()) {
      setActionError(`Vòng ${roundNumber} chưa có quiz. Hãy đặt thời gian mở trong tương lai trước khi lưu.`);
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
        passingRuleType: 'MIN_SCORE',
        passingScore,
        requestId: createRequestId(`round-${roundNumber}-save`),
      });
      setRounds(current => [...current.filter(item => item.roundNumber !== roundNumber), updated]
        .sort((left, right) => left.roundNumber - right.roundNumber));
      setActionMessage(`Đã lưu vòng ${roundNumber}.`);
    } catch {
      setActionError(`Không thể lưu vòng ${roundNumber}.`);
    } finally {
      setPendingAction(null);
    }
  };

  const finalizeRound = async (roundNumber: number) => {
    if (!selectedCampaign || !isAdmin) return;
    const round = rounds.find(item => item.roundNumber === roundNumber);
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
      setRounds(current => current.map(item => item.id === updated.id ? { ...item, ...updated } : item));
      setActionMessage(`Đã chốt vòng ${roundNumber}.`);
    } catch {
      setActionError(`Không thể chốt vòng ${roundNumber}.`);
    } finally {
      setPendingAction(null);
    }
  };

  const saveRoundQuiz = async (roundNumber: number) => {
    if (!selectedCampaign || !isAdmin) return;
    const round = rounds.find(item => item.roundNumber === roundNumber);
    const draft = roundQuizDrafts[roundNumber];
    const gradeLevel = Number(draft?.gradeLevel);
    if (!round || !draft?.quizId.trim() || !Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12) {
      setActionError(`Cấu hình quiz vòng ${roundNumber} chưa hợp lệ.`);
      return;
    }
    const hasQuizMapping = Number(round.quizSnapshot?.mappingCount || round.quizMappings?.length || 0) > 0;
    if (round.status === 'OPEN' && !hasQuizMapping) {
      setActionError(`Vòng ${roundNumber} đang mở nhưng chưa có quiz. Hãy đặt thời gian mở trong tương lai và lưu vòng trước khi gán quiz.`);
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
      setRounds(current => current.map(item => {
        if (item.id !== round.id) return item;
        const mappings = [
          ...(item.quizMappings || []).filter(existing => !(
            existing.gradeLevel === mapping.gradeLevel && existing.classId === mapping.classId
          )),
          mapping,
        ];
        return {
          ...item,
          quizMappings: mappings,
          quizSnapshot: { status: 'LOCKED' as const, mappingCount: mappings.length },
        };
      }));
      setActionMessage(`Đã gán quiz cho vòng ${roundNumber}.`);
    } catch {
      setActionError(`Không thể gán quiz cho vòng ${roundNumber}.`);
    } finally {
      setPendingAction(null);
    }
  };

  const finalizeEligibility = async () => {
    if (!selectedCampaign || !isAdmin) return;
    setPendingAction('eligibility-finalize');
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.finalizeEligibility(selectedCampaign.id, createRequestId('eligibility-finalize'));
      const updated = await competitionDashboardService.getEligibility(selectedCampaign.id);
      setEligibility(updated);
      setCampaigns(current => current.map(campaign => campaign.id === selectedCampaign.id
        ? { ...campaign, status: 'ELIGIBILITY_LOCKED' }
        : campaign));
      setActionMessage('Đã chốt điều kiện dự thi.');
    } catch {
      setActionError('Không thể chốt điều kiện dự thi.');
    } finally {
      setPendingAction(null);
    }
  };

  const createSchoolExamEvent = async () => {
    if (!selectedCampaign || !eligibility || !isAdmin || !examDraft.title || !examDraft.examDate) return;
    setPendingAction('exam-create');
    setActionError(null);
    setActionMessage(null);
    try {
      const event = await competitionDashboardService.createSchoolExamEvent({
        campaignId: selectedCampaign.id,
        eligibilitySnapshotVersion: eligibility.version,
        title: examDraft.title.trim(),
        examDate: toIsoDateTime(examDraft.examDate),
        rankingPolicy: 'SCORE_CORRECT_TIME',
        examFormPolicy: examDraft.examFormPolicy,
        ...(examDraft.capacityProfileId.trim() ? { capacityProfileId: examDraft.capacityProfileId.trim() } : {}),
        requestId: createRequestId('school-exam-create'),
      });
      setSchoolExamEvents([event]);
      setRoomDraft(current => ({ ...current, scheduledAt: toDateTimeLocal(event.examDate) }));
      setActionMessage('Đã tạo kỳ thi cấp trường.');
    } catch {
      setActionError('Không thể tạo kỳ thi cấp trường.');
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
      !roomDraft.name.trim() || !roomDraft.roomCode.trim() || !roomDraft.scheduledAt || !roomDraft.quizId.trim()
      || !roomDraft.blueprintId.trim() || invigilatorIds.length === 0 || studentIds.length === 0 || objectiveIds.length === 0
      || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(totalScore) || totalScore <= 0
      || !Number.isInteger(gradeLevel) || gradeLevel <= 0
    ) {
      setActionError('Cấu hình phòng/ca thi chưa hợp lệ.');
      return;
    }
    setPendingAction('room-create');
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
        formCode: roomDraft.formCode.trim() || 'A',
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
        requestId: createRequestId('school-exam-room-create'),
      });
      setSchoolExamEvents(current => current.map(event => event.id === selectedEvent.id
        ? { ...event, rooms: [...event.rooms, result.room] }
        : event));
      setActionMessage(result.warnings.length > 0 ? `Đã thêm phòng; cảnh báo: ${result.warnings.join(', ')}` : 'Đã thêm phòng/ca thi.');
    } catch {
      setActionError('Không thể thêm phòng/ca thi.');
    } finally {
      setPendingAction(null);
    }
  };

  const runPreflight = async () => {
    if (!selectedEvent || !isAdmin) return;
    setPendingAction('preflight');
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await competitionDashboardService.runPreflight(selectedEvent.id, createRequestId('school-exam-preflight'));
      setSchoolExamEvents(current => current.map(event => event.id === selectedEvent.id
        ? { ...event, preflight: result, status: result.status === 'READY' ? 'READY' : 'PREFLIGHT_BLOCKED' }
        : event));
      setActionMessage(result.status === 'READY' ? 'Preflight đạt capacity.' : `Preflight bị chặn: ${result.reason || 'UNKNOWN'}`);
    } catch {
      setActionError('Không thể chạy preflight.');
    } finally {
      setPendingAction(null);
    }
  };

  const provisionSchoolExam = async () => {
    if (!selectedEvent || !isAdmin) return;
    setPendingAction('provision');
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.provisionSchoolExam(selectedEvent.id, createRequestId('school-exam-provision'));
      const event = await competitionDashboardService.getSchoolExamEvent(selectedEvent.id);
      setSchoolExamEvents(current => current.map(item => item.id === event.id ? event : item));
      setActionMessage('Đã provision các phòng thi có thể tạo.');
    } catch {
      setActionError('Không thể provision phòng thi.');
    } finally {
      setPendingAction(null);
    }
  };

  const startReconcile = async () => {
    if (!selectedEvent || !isAdmin) return;
    setPendingAction('reconcile');
    setActionError(null);
    setActionMessage(null);
    try {
      const value = await competitionDashboardService.startReconcile(selectedEvent.id, createRequestId('school-exam-reconcile'));
      setReconcile(value);
      setSchoolExamEvents(current => current.map(event => event.id === selectedEvent.id
        ? { ...event, status: value.eventStatus }
        : event));
      setActionMessage(value.blockingIssues === 0 ? 'Đối soát sạch; sẵn sàng công bố.' : `Đối soát còn ${value.blockingIssues} blocker.`);
    } catch {
      setActionError('Không thể chạy đối soát.');
    } finally {
      setPendingAction(null);
    }
  };

  const publishResults = async () => {
    if (!selectedEvent || !isAdmin || selectedEvent.status !== 'READY_TO_PUBLISH') return;
    setPendingAction('publish');
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.publish(selectedEvent.id, createRequestId('school-exam-publish'));
      setSchoolExamEvents(current => current.map(event => event.id === selectedEvent.id ? { ...event, status: 'PUBLISHED' } : event));
      const value = await competitionDashboardService.getRankings(selectedEvent.id, { scope: 'EVENT' });
      setRankings(value);
      setActionMessage('Đã công bố kết quả chính thức.');
    } catch {
      setActionError('Không thể công bố kết quả.');
    } finally {
      setPendingAction(null);
    }
  };

  const createResultCorrection = async () => {
    if (!selectedEvent || !isAdmin || selectedEvent.status !== 'PUBLISHED') return;
    const score = Number(correctionDraft.score);
    const correctCount = Number(correctionDraft.correctCount);
    const timeTaken = Number(correctionDraft.timeTaken);
    if (
      !correctionDraft.studentId.trim()
      || !Number.isFinite(score) || score < 0 || score > 100
      || !Number.isInteger(correctCount) || correctCount < 0
      || !Number.isInteger(timeTaken) || timeTaken < 0
      || correctionDraft.reason.trim().length < 3
    ) {
      setActionError('Thông tin điều chỉnh kết quả chưa hợp lệ.');
      return;
    }
    setPendingAction('result-correction');
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
        requestId: createRequestId('school-exam-result-correction'),
      });
      setResultCorrections(await competitionDashboardService.listResultCorrections(selectedEvent.id));
      setActionMessage('Đã ghi nhận điều chỉnh; phiên bản công bố hiện tại vẫn giữ nguyên.');
    } catch {
      setActionError('Không thể ghi nhận điều chỉnh kết quả.');
    } finally {
      setPendingAction(null);
    }
  };

  const republishCorrectedResults = async () => {
    if (!selectedEvent || !isAdmin || selectedEvent.status !== 'PUBLISHED') return;
    setPendingAction('result-correction-publish');
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.republishCorrectedResults(
        selectedEvent.id,
        createRequestId('school-exam-correction-publish'),
      );
      const [rankingValue, correctionItems] = await Promise.all([
        competitionDashboardService.getRankings(selectedEvent.id, { scope: 'EVENT' }),
        competitionDashboardService.listResultCorrections(selectedEvent.id),
      ]);
      setRankings(rankingValue);
      setResultCorrections(correctionItems);
      setActionMessage(`Đã công bố phiên bản ${rankingValue.publicationVersion} sau điều chỉnh.`);
    } catch {
      setActionError('Không thể công bố phiên bản điều chỉnh.');
    } finally {
      setPendingAction(null);
    }
  };

  const reportIncident = async () => {
    if (!selectedEvent || !incidentDraft.roomId || !incidentDraft.studentId || !incidentDraft.originalResultId) return;
    setPendingAction('incident-report');
    setActionError(null);
    setActionMessage(null);
    try {
      await competitionDashboardService.reportIncident({
        eventId: selectedEvent.id,
        roomId: incidentDraft.roomId,
        studentId: incidentDraft.studentId.trim(),
        originalResultId: incidentDraft.originalResultId.trim(),
        reasonCode: incidentDraft.reasonCode as any,
        ...(incidentDraft.reasonText.trim() ? { reasonText: incidentDraft.reasonText.trim() } : {}),
        requestId: createRequestId('school-exam-incident'),
      });
      const [incidentItems, retestItems] = await Promise.all([
        competitionDashboardService.listIncidents(selectedEvent.id),
        competitionDashboardService.listRetests(selectedEvent.id),
      ]);
      setIncidents(incidentItems);
      setRetests(retestItems);
      setSchoolExamEvents(current => current.map(event => event.id === selectedEvent.id ? { ...event, status: 'WITHHELD' } : event));
      setActionMessage('Đã báo cáo sự cố; kết quả được giữ WITHHELD.');
    } catch {
      setActionError('Không thể báo cáo sự cố.');
    } finally {
      setPendingAction(null);
    }
  };

  const grantRetest = async (retest: SchoolExamRetestView) => {
    if (!selectedEvent || !isAdmin || retest.status !== 'REQUESTED') return;
    setPendingAction(`retest-${retest.id}`);
    setActionError(null);
    setActionMessage(null);
    try {
      const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString();
      const updated = await competitionDashboardService.grantRetest(selectedEvent.id, retest.id, {
        expiresAt,
        resolution: retestResolution[retest.id] || 'REPLACE_WITH_RETEST',
        requestId: createRequestId('school-exam-retest-grant'),
      });
      setRetests(current => current.map(item => item.id === updated.id ? updated : item));
      setActionMessage('Đã cấp thi lại.');
    } catch {
      setActionError('Không thể cấp thi lại.');
    } finally {
      setPendingAction(null);
    }
  };

  const createCertificates = async () => {
    if (!selectedEvent || selectedEvent.status !== 'PUBLISHED' || !isAdmin || !rankings) return;
    const winnerStudentIds = splitIds(certificateDraft.winnerStudentIds);
    if (!certificateDraft.templateId.trim() || !certificateDraft.title.trim() || winnerStudentIds.length === 0) {
      setActionError('Cấu hình chứng nhận chưa hợp lệ.');
      return;
    }
    setPendingAction('certificates');
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
        ...(certificateDraft.message.trim() ? { message: certificateDraft.message.trim() } : {}),
        ...(certificateDraft.achievementPrefix.trim() ? { achievementPrefix: certificateDraft.achievementPrefix.trim() } : {}),
        requestId: createRequestId('school-exam-certificates'),
      });
      setCertificateBatch(batch);
      setActionMessage(`Đã tạo ${batch.batchCount} batch chứng nhận cho ${batch.winnerCount} học sinh.`);
    } catch {
      setActionError('Không thể tạo chứng nhận Competition.');
    } finally {
      setPendingAction(null);
    }
  };

  const createExport = async () => {
    if (!selectedEvent || selectedEvent.status !== 'PUBLISHED') return;
    const scope = isAdmin ? 'SCHOOL' as const : 'CLASS' as const;
    if (!isAdmin && !teacherClassId) return;
    setPendingAction('export');
    setActionError(null);
    setActionMessage(null);
    try {
      const job = await competitionDashboardService.createExport(selectedEvent.id, {
        scope,
        ...(!isAdmin && teacherClassId ? { classId: teacherClassId } : {}),
        requestId: createRequestId('school-exam-export'),
      });
      setExportJob(job);
      setActionMessage(`Đã xếp hàng XLSX: ${job.status}.`);
    } catch {
      setActionError('Không thể tạo XLSX.');
    } finally {
      setPendingAction(null);
    }
  };

  const refreshExport = async () => {
    if (!selectedEvent || !exportJob) return;
    setPendingAction('export-refresh');
    try {
      setExportJob(await competitionDashboardService.getExport(selectedEvent.id, exportJob.id));
    } catch {
      setActionError('Không thể làm mới trạng thái XLSX.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1440px] space-y-6" aria-labelledby="competition-dashboard-title">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Competition V1</p>
            <h1 id="competition-dashboard-title" className="mt-1 text-2xl font-bold text-slate-950">Cuộc thi</h1>
            <p className="mt-2 text-sm text-slate-600">Theo dõi chiến dịch, sáu vòng thi và kỳ thi cấp trường trên cùng một luồng.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {isAdmin ? 'Quản trị' : 'Chỉ đọc theo phạm vi lớp'}
          </span>
        </div>
      </header>

      {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>}
      {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{actionError}</div>}
      {actionMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{actionMessage}</div>}

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Chiến dịch & đối tượng</h2>
          <p className="mt-2 text-sm text-slate-600">Chọn chiến dịch, xem phạm vi học sinh và khóa AudienceSnapshot trước khi thi.</p>
          <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="competition-campaign-select">Chiến dịch</label>
          <select
            id="competition-campaign-select"
            value={selectedCampaignId}
            onChange={event => setSelectedCampaignId(event.target.value)}
            disabled={loadingCampaigns || campaigns.length === 0}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {campaigns.length === 0 && <option value="">{loadingCampaigns ? 'Đang tải…' : 'Chưa có chiến dịch'}</option>}
            {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
          </select>
          {isAdmin && (!selectedCampaign || selectedCampaign.status === 'DRAFT') && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-slate-900">{selectedCampaign?.status === 'DRAFT' ? 'Chỉnh chiến dịch DRAFT' : 'Tạo chiến dịch mới'}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Tên chiến dịch<input aria-label="Tên chiến dịch" value={campaignDraft.title} onChange={event => setCampaignDraft(current => ({ ...current, title: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Năm học<input aria-label="Năm học" value={campaignDraft.schoolYear} onChange={event => setCampaignDraft(current => ({ ...current, schoolYear: event.target.value }))} placeholder="2026-2027" className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Múi giờ<input aria-label="Múi giờ" value={campaignDraft.timezone} onChange={event => setCampaignDraft(current => ({ ...current, timezone: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Khối tham gia<input aria-label="Khối tham gia" value={campaignDraft.gradeLevels} onChange={event => setCampaignDraft(current => ({ ...current, gradeLevels: event.target.value }))} placeholder="4, 5" className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Lớp tham gia<input aria-label="Lớp tham gia" value={campaignDraft.classIds} onChange={event => setCampaignDraft(current => ({ ...current, classIds: event.target.value }))} placeholder="class-4a, class-4b" className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Số vòng cần đạt<input aria-label="Số vòng cần đạt" type="number" min="1" max="6" value={campaignDraft.requiredPassedRounds} onChange={event => setCampaignDraft(current => ({ ...current, requiredPassedRounds: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Bắt đầu chiến dịch<input aria-label="Bắt đầu chiến dịch" type="datetime-local" value={campaignDraft.startsAt} onChange={event => setCampaignDraft(current => ({ ...current, startsAt: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Kết thúc chiến dịch<input aria-label="Kết thúc chiến dịch" type="datetime-local" value={campaignDraft.endsAt} onChange={event => setCampaignDraft(current => ({ ...current, endsAt: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
              </div>
              <button type="button" onClick={persistCampaign} disabled={pendingAction !== null} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">{selectedCampaign?.status === 'DRAFT' ? 'Lưu chiến dịch' : 'Tạo chiến dịch'}</button>
            </div>
          )}
          {selectedCampaign && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <strong className="text-slate-950">{selectedCampaign.title}</strong>
              <div className="mt-1">Năm học {selectedCampaign.schoolYear} · Trạng thái {selectedCampaign.status}</div>
              <div className="mt-1">Audience: {selectedCampaign.audienceSnapshotId ? 'Đã đóng băng' : 'Chưa đóng băng'}</div>
            </div>
          )}
          {audiencePreview && (
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              <strong>{audiencePreview.matchedCount} học sinh phù hợp</strong>
              {audiencePreview.countsByGrade && (
                <div className="mt-1 text-xs">Theo khối: {Object.entries(audiencePreview.countsByGrade).map(([grade, count]) => `Khối ${grade}: ${count}`).join(' · ')}</div>
              )}
            </div>
          )}
          {isAdmin && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Thao tác quản trị đối tượng">
              <button type="button" onClick={previewAudience} disabled={!selectedCampaign || loadingDetails || pendingAction !== null} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Xem trước đối tượng</button>
              <button type="button" onClick={freezeAudience} disabled={!selectedCampaign || Boolean(selectedCampaign.audienceSnapshotId) || loadingDetails || pendingAction !== null} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Đóng băng đối tượng</button>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">6 vòng thi</h2>
          <p className="mt-2 text-sm text-slate-600">Thời gian, số lượt tối đa và điểm đạt lấy từ cấu hình server-authoritative.</p>
          <div className="mt-4 space-y-3">
            {loadingDetails && rounds.length === 0 && <p className="text-sm text-slate-500">Đang tải vòng thi…</p>}
            {ROUND_NUMBERS.map(roundNumber => {
              const round = rounds.find(item => item.roundNumber === roundNumber);
              const draft = roundDrafts[roundNumber];
              return (
                <div key={roundNumber} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900">Vòng {roundNumber}</h3>
                    <span className="text-xs font-semibold text-slate-500">{round?.status || 'CHƯA CẤU HÌNH'}</span>
                  </div>
                  {isAdmin ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">Mở vòng {roundNumber}
                        <input aria-label={`Mở vòng ${roundNumber}`} type="datetime-local" value={draft?.opensAt || ''} onChange={event => updateRoundDraft(roundNumber, { opensAt: event.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Đóng vòng {roundNumber}
                        <input aria-label={`Đóng vòng ${roundNumber}`} type="datetime-local" value={draft?.closesAt || ''} onChange={event => updateRoundDraft(roundNumber, { closesAt: event.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Số lượt tối đa vòng {roundNumber}
                        <input aria-label={`Số lượt tối đa vòng ${roundNumber}`} type="number" min="1" value={draft?.maxAttempts || '1'} onChange={event => updateRoundDraft(roundNumber, { maxAttempts: event.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900" />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">Điểm đạt vòng {roundNumber}
                        <input aria-label={`Điểm đạt vòng ${roundNumber}`} type="number" min="0" max="100" step="0.1" value={draft?.passingScore || '0'} onChange={event => updateRoundDraft(roundNumber, { passingScore: event.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-900" />
                      </label>
                      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">Quiz snapshot: {round?.quizSnapshot?.status || (round ? 'MISSING' : 'chưa khóa')} {round?.quizSnapshot ? `(${round.quizSnapshot.mappingCount})` : ''}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => saveRound(roundNumber)} disabled={!selectedCampaign || pendingAction !== null || round?.status === 'FINALIZED'} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">Lưu vòng {roundNumber}</button>
                          {round?.status === 'CLOSED' && (
                            <button type="button" onClick={() => finalizeRound(roundNumber)} disabled={pendingAction !== null} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 disabled:opacity-50">Chốt vòng {roundNumber}</button>
                          )}
                        </div>
                      </div>
                      {round && (
                        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <label className="text-xs font-semibold text-slate-600">Khối quiz vòng {roundNumber}
                              <input aria-label={`Khối quiz vòng ${roundNumber}`} type="number" min="1" max="12" value={roundQuizDrafts[roundNumber]?.gradeLevel || '1'} onChange={event => updateRoundQuizDraft(roundNumber, { gradeLevel: event.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 font-normal" />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">Lớp ghi đè vòng {roundNumber}
                              <input aria-label={`Lớp ghi đè vòng ${roundNumber}`} value={roundQuizDrafts[roundNumber]?.classId || ''} onChange={event => updateRoundQuizDraft(roundNumber, { classId: event.target.value })} placeholder="Để trống = mặc định khối" className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 font-normal" />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">Quiz ID vòng {roundNumber}
                              <input aria-label={`Quiz ID vòng ${roundNumber}`} value={roundQuizDrafts[roundNumber]?.quizId || ''} onChange={event => updateRoundQuizDraft(roundNumber, { quizId: event.target.value })} className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 font-normal" />
                            </label>
                          </div>
                          <button type="button" onClick={() => saveRoundQuiz(roundNumber)} disabled={pendingAction !== null || round.status === 'FINALIZED'} className="mt-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">Gán quiz vòng {roundNumber}</button>
                        </div>
                      )}
                      {round?.quizMappings && round.quizMappings.length > 0 && (
                        <div className="sm:col-span-2 space-y-1 text-xs text-slate-600">
                          {round.quizMappings.map(mapping => (
                            <div key={mapping.id || `${mapping.gradeLevel}-${mapping.classId || 'default'}`}>
                              Khối {mapping.gradeLevel} · {mapping.classId || 'mặc định'} · {mapping.quizId}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-1 text-slate-600 sm:grid-cols-2">
                      <span>Mở: {formatDateTime(round?.opensAt)}</span><span>Đóng: {formatDateTime(round?.closesAt)}</span>
                      <span>Tối đa: {round?.maxAttempts ?? '—'} lượt</span><span>Điểm đạt: {round?.passingScore ?? '—'}</span>
                      {round?.quizMappings?.map(mapping => (
                        <span key={mapping.id || `${mapping.gradeLevel}-${mapping.classId || 'default'}`} className="sm:col-span-2">
                          Khối {mapping.gradeLevel} · {mapping.classId || 'mặc định'} · {mapping.quizId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Điều kiện dự thi</h2>
          <p className="mt-2 text-sm text-slate-600">
            {eligibility ? `${qualifiedCount} / ${eligibility.items.length} học sinh đạt` : 'Chưa có snapshot điều kiện dự thi.'}
          </p>
          {eligibility && <p className="mt-1 text-xs text-slate-500">Snapshot version {eligibility.version}</p>}
          {!isAdmin && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-slate-900">Tiến độ lớp</h3>
              {progress.length === 0 ? <p className="mt-2 text-xs text-slate-500">Chưa có lượt thi được ghi nhận.</p> : (
                <div className="mt-2 space-y-2">
                  {progress.map(item => (
                    <div key={`${item.roundId}-${item.studentId}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900">{item.studentId} · Vòng {item.roundNumber}</div>
                      <div className="mt-1">{item.attemptsUsed} lượt · Điểm tốt nhất {item.bestScore ?? '—'} · {item.isPassed ? 'Đã đạt' : 'Chưa đạt'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {isAdmin && <button type="button" onClick={finalizeEligibility} disabled={!selectedCampaign || loadingDetails || pendingAction !== null} className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Chốt điều kiện dự thi</button>}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Thi cấp trường</h2>
          <p className="mt-2 text-sm text-slate-600">Ca thi, phòng, form, tải đỉnh dự kiến và capacity đã chứng nhận.</p>
          {selectedEvent ? (
            <div className="mt-3 space-y-3 text-sm">
              <div><strong>{selectedEvent.title}</strong> · {selectedEvent.status} · {formatDateTime(selectedEvent.examDate)}</div>
              {preflight && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="font-semibold">Peak / Capacity: </span>
                  <span>{preflight.plannedConcurrency ?? '—'} / {preflight.certifiedConcurrentStudents ?? '—'}</span>
                  {preflight.reason && <span className="ml-2 text-amber-700">{preflight.reason}</span>}
                </div>
              )}
              <div className="space-y-2">
                {selectedEvent.rooms.map(room => (
                  <div key={room.id} className="rounded-lg border border-slate-200 p-3">
                    <strong>{room.name}</strong> · Form {room.formCode} · {room.memberCount} học sinh · {room.provisionStatus}
                  </div>
                ))}
              </div>
              {isAdmin && ['DRAFT', 'PREFLIGHT_BLOCKED'].includes(selectedEvent.status) && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-bold text-slate-900">Thêm phòng / ca thi</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold">Tên phòng/ca<input aria-label="Tên phòng/ca" value={roomDraft.name} onChange={event => setRoomDraft(current => ({ ...current, name: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Mã phòng<input aria-label="Mã phòng" value={roomDraft.roomCode} onChange={event => setRoomDraft(current => ({ ...current, roomCode: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Lịch thi phòng<input aria-label="Lịch thi phòng" type="datetime-local" value={roomDraft.scheduledAt} onChange={event => setRoomDraft(current => ({ ...current, scheduledAt: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Thời lượng (phút)<input aria-label="Thời lượng phòng" type="number" value={roomDraft.durationMinutes} onChange={event => setRoomDraft(current => ({ ...current, durationMinutes: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Mã form<input aria-label="Mã form" value={roomDraft.formCode} onChange={event => setRoomDraft(current => ({ ...current, formCode: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Quiz ID<input aria-label="Quiz ID" value={roomDraft.quizId} onChange={event => setRoomDraft(current => ({ ...current, quizId: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Giám thị<input aria-label="Giám thị" value={roomDraft.invigilatorIds} onChange={event => setRoomDraft(current => ({ ...current, invigilatorIds: event.target.value }))} placeholder="teacher-a, teacher-b" className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Học sinh<input aria-label="Học sinh" value={roomDraft.studentIds} onChange={event => setRoomDraft(current => ({ ...current, studentIds: event.target.value }))} placeholder="student-1, student-2" className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Blueprint ID<input aria-label="Blueprint ID" value={roomDraft.blueprintId} onChange={event => setRoomDraft(current => ({ ...current, blueprintId: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Tổng điểm<input aria-label="Tổng điểm" type="number" value={roomDraft.totalScore} onChange={event => setRoomDraft(current => ({ ...current, totalScore: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Độ khó<input aria-label="Độ khó" value={roomDraft.difficulty} onChange={event => setRoomDraft(current => ({ ...current, difficulty: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold">Khối<input aria-label="Khối" type="number" value={roomDraft.gradeLevel} onChange={event => setRoomDraft(current => ({ ...current, gradeLevel: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    <label className="text-xs font-semibold sm:col-span-2">Mục tiêu<input aria-label="Mục tiêu" value={roomDraft.objectiveIds} onChange={event => setRoomDraft(current => ({ ...current, objectiveIds: event.target.value }))} placeholder="obj-1, obj-2" className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                    {selectedEvent.examFormPolicy === 'EQUIVALENT_FORM_SET' && <label className="sm:col-span-2 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={roomDraft.equivalentFormApproved} onChange={event => setRoomDraft(current => ({ ...current, equivalentFormApproved: event.target.checked }))} />Đã duyệt form tương đương</label>}
                  </div>
                  <button type="button" onClick={createSchoolExamRoom} disabled={pendingAction !== null} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Thêm phòng/ca thi</button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-slate-500">Chưa có kỳ thi cấp trường.</p>
              {isAdmin && eligibility && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold">Tên kỳ thi cấp trường<input aria-label="Tên kỳ thi cấp trường" value={examDraft.title} onChange={event => setExamDraft(current => ({ ...current, title: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                  <label className="text-xs font-semibold">Ngày thi cấp trường<input aria-label="Ngày thi cấp trường" type="datetime-local" value={examDraft.examDate} onChange={event => setExamDraft(current => ({ ...current, examDate: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                  <label className="text-xs font-semibold">Chính sách form<select aria-label="Chính sách form" value={examDraft.examFormPolicy} onChange={event => setExamDraft(current => ({ ...current, examFormPolicy: event.target.value as 'SAME_FORM' | 'EQUIVALENT_FORM_SET' }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal"><option value="SAME_FORM">Cùng form</option><option value="EQUIVALENT_FORM_SET">Bộ form tương đương</option></select></label>
                  <label className="text-xs font-semibold">Capacity profile<input aria-label="Capacity profile" value={examDraft.capacityProfileId} onChange={event => setExamDraft(current => ({ ...current, capacityProfileId: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                  <button type="button" onClick={createSchoolExamEvent} disabled={!examDraft.title || !examDraft.examDate || pendingAction !== null} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 sm:col-span-2">Tạo kỳ thi cấp trường</button>
                </div>
              )}
            </div>
          )}
          {isAdmin && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={runPreflight} disabled={!selectedEvent || selectedEvent.rooms.length === 0 || pendingAction !== null} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Chạy preflight</button>
              <button type="button" onClick={provisionSchoolExam} disabled={!selectedEvent || selectedEvent.status !== 'READY' || pendingAction !== null} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Provision phòng thi</button>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Đối soát</h2>
          <p className="mt-2 text-sm text-slate-600">Blocker, warning, incident và retest được tách riêng; Live Exam đóng chưa có nghĩa là đã công bố.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-red-100 bg-red-50 p-3"><h3 className="font-bold text-red-900">Blockers ({reconcile?.issues.filter(issue => issue.blocking).length || 0})</h3>{reconcile?.issues.filter(issue => issue.blocking).map(issue => <div key={issue.id} className="mt-1 text-xs text-red-800">{issue.issueType}</div>)}</div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3"><h3 className="font-bold text-amber-900">Warnings ({reconcile?.issues.filter(issue => !issue.blocking).length || 0})</h3>{reconcile?.issues.filter(issue => !issue.blocking).map(issue => <div key={issue.id} className="mt-1 text-xs text-amber-800">{issue.issueType}</div>)}</div>
            <div className="rounded-lg border border-slate-200 p-3"><h3 className="font-bold text-slate-900">Sự cố ({incidents.length})</h3>{incidents.map(incident => <div key={incident.id} className="mt-1 text-xs text-slate-600">{incident.reasonCode} · {incident.studentId || '—'}</div>)}</div>
            <div className="rounded-lg border border-slate-200 p-3"><h3 className="font-bold text-slate-900">Thi lại ({retests.length})</h3>{retests.map(retest => <div key={retest.id} className="mt-2 text-xs text-slate-600"><div>{retest.studentId} · {retest.reasonCode || '—'} · {retest.status}</div>{isAdmin && retest.status === 'REQUESTED' && <div className="mt-2 flex flex-wrap gap-2"><select aria-label={`Cách xử lý thi lại ${retest.studentId}`} value={retestResolution[retest.id] || 'REPLACE_WITH_RETEST'} onChange={event => setRetestResolution(current => ({ ...current, [retest.id]: event.target.value as any }))} className="rounded border px-2 py-1"><option value="KEEP_ORIGINAL">Giữ kết quả gốc</option><option value="REPLACE_WITH_RETEST">Thay bằng thi lại</option><option value="INVALIDATE_RESULT">Hủy kết quả</option></select><button type="button" onClick={() => grantRetest(retest)} disabled={pendingAction !== null} className="rounded border px-2 py-1 font-semibold">Cấp thi lại {retest.studentId}</button></div>}</div>)}</div>
          </div>
          {!isAdmin && selectedEvent && selectedEvent.rooms.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-slate-900">Báo cáo sự cố phòng được phân công</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Phòng sự cố<select aria-label="Phòng sự cố" value={incidentDraft.roomId} onChange={event => setIncidentDraft(current => ({ ...current, roomId: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"><option value="">Chọn phòng</option>{selectedEvent.rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
                <label className="text-xs font-semibold">Học sinh sự cố<input aria-label="Học sinh sự cố" value={incidentDraft.studentId} onChange={event => setIncidentDraft(current => ({ ...current, studentId: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Kết quả gốc<input aria-label="Kết quả gốc" value={incidentDraft.originalResultId} onChange={event => setIncidentDraft(current => ({ ...current, originalResultId: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Lý do sự cố<select aria-label="Lý do sự cố" value={incidentDraft.reasonCode} onChange={event => setIncidentDraft(current => ({ ...current, reasonCode: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 font-normal"><option value="NETWORK_FAILURE">Mất mạng</option><option value="DEVICE_FAILURE">Lỗi thiết bị</option><option value="SERVER_INCIDENT">Lỗi máy chủ</option><option value="EXAM_INTERRUPTED">Bài thi gián đoạn</option><option value="ADMINISTRATIVE_ERROR">Lỗi hành chính</option></select></label>
              </div>
              <button type="button" onClick={reportIncident} disabled={pendingAction !== null} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Báo cáo sự cố</button>
            </div>
          )}
          {isAdmin && <button type="button" onClick={startReconcile} disabled={!selectedEvent || pendingAction !== null} className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Bắt đầu đối soát</button>}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Công bố & xếp hạng</h2>
          <p className="mt-2 text-sm text-slate-600">Chỉ kết quả canonical đã publish mới được dùng cho xếp hạng chính thức.</p>
          {selectedEvent && <p className="mt-2 text-sm font-semibold text-slate-700">Event: {selectedEvent.status}</p>}
          {isAdmin && selectedEvent?.status === 'READY_TO_PUBLISH' && (
            <button type="button" onClick={publishResults} disabled={pendingAction !== null} className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Công bố kết quả</button>
          )}
          {rankings && (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-slate-500">Publication v{rankings.publicationVersion} · Ranking v{rankings.rankingVersion} · {rankings.scope}</div>
              {rankings.items.map(item => <div key={item.studentId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm"><span><strong>{item.studentId}</strong> · {item.score} điểm</span><span className="font-bold text-blue-700">Hạng {item.rank}</span></div>)}
            </div>
          )}
          {isAdmin && selectedEvent?.status === 'PUBLISHED' && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-bold text-amber-950">Điều chỉnh kết quả đã công bố</h3>
              <p className="mt-1 text-xs text-amber-800">Bản công bố hiện tại không thay đổi cho đến khi tạo phiên bản mới.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Học sinh cần điều chỉnh<input aria-label="Học sinh cần điều chỉnh" value={correctionDraft.studentId} onChange={event => setCorrectionDraft(current => ({ ...current, studentId: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Điểm điều chỉnh<input aria-label="Điểm điều chỉnh" type="number" min="0" max="100" value={correctionDraft.score} onChange={event => setCorrectionDraft(current => ({ ...current, score: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Số câu đúng điều chỉnh<input aria-label="Số câu đúng điều chỉnh" type="number" min="0" value={correctionDraft.correctCount} onChange={event => setCorrectionDraft(current => ({ ...current, correctCount: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Thời gian điều chỉnh<input aria-label="Thời gian điều chỉnh" type="number" min="0" value={correctionDraft.timeTaken} onChange={event => setCorrectionDraft(current => ({ ...current, timeTaken: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold sm:col-span-2">Lý do điều chỉnh<textarea aria-label="Lý do điều chỉnh" value={correctionDraft.reason} onChange={event => setCorrectionDraft(current => ({ ...current, reason: event.target.value }))} className="mt-1 block w-full rounded border px-2 py-1.5 font-normal" /></label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={createResultCorrection} disabled={pendingAction !== null} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">Ghi nhận điều chỉnh</button>
                {resultCorrections.filter(item => item.status === 'PENDING').length > 0 && (
                  <button type="button" onClick={republishCorrectedResults} disabled={pendingAction !== null} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">Công bố phiên bản điều chỉnh</button>
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-amber-900">{resultCorrections.filter(item => item.status === 'PENDING').length} điều chỉnh đang chờ công bố</p>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Chứng nhận & XLSX</h2>
          <p className="mt-2 text-sm text-slate-600">Downstream jobs chạy sau publication và không làm rollback kết quả đã công bố.</p>
          {isAdmin && selectedEvent?.status === 'PUBLISHED' && rankings && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-slate-900">Chứng nhận theo ranking đã công bố</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Mẫu chứng nhận Competition<input aria-label="Mẫu chứng nhận Competition" value={certificateDraft.templateId} onChange={event => setCertificateDraft(current => ({ ...current, templateId: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Học sinh nhận chứng nhận<input aria-label="Học sinh nhận chứng nhận" value={certificateDraft.winnerStudentIds} onChange={event => setCertificateDraft(current => ({ ...current, winnerStudentIds: event.target.value }))} placeholder="student-1, student-2" className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold sm:col-span-2">Tiêu đề chứng nhận Competition<input aria-label="Tiêu đề chứng nhận Competition" value={certificateDraft.title} onChange={event => setCertificateDraft(current => ({ ...current, title: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Lời nhắn<input aria-label="Lời nhắn chứng nhận Competition" value={certificateDraft.message} onChange={event => setCertificateDraft(current => ({ ...current, message: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
                <label className="text-xs font-semibold">Tiền tố thành tích<input aria-label="Tiền tố thành tích Competition" value={certificateDraft.achievementPrefix} onChange={event => setCertificateDraft(current => ({ ...current, achievementPrefix: event.target.value }))} className="mt-1 block w-full rounded-md border px-2 py-1.5 font-normal" /></label>
              </div>
              <button type="button" onClick={createCertificates} disabled={pendingAction !== null} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Tạo chứng nhận người đạt giải</button>
              {certificateBatch && <p className="mt-2 text-sm text-slate-600">Certificate batch {certificateBatch.id}: {certificateBatch.status} · {certificateBatch.winnerCount} người</p>}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {isAdmin ? (
              <button type="button" onClick={createExport} disabled={selectedEvent?.status !== 'PUBLISHED' || pendingAction !== null} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Xuất XLSX toàn trường</button>
            ) : (
              <button type="button" onClick={createExport} disabled={selectedEvent?.status !== 'PUBLISHED' || !teacherClassId || pendingAction !== null} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Xuất XLSX theo lớp</button>
            )}
            <a href="/teacher/certificates" className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700">Mở cấp chứng nhận</a>
            {exportJob && <button type="button" onClick={refreshExport} disabled={pendingAction !== null} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Làm mới XLSX</button>}
            {exportJob?.status === 'READY' && selectedEvent && (
              <a
                href={`/api/school-exams/${encodeURIComponent(selectedEvent.id)}/exports/${encodeURIComponent(exportJob.id)}/download`}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
              >Tải XLSX</a>
            )}
          </div>
          {exportJob && <p className="mt-2 text-sm text-slate-600">Export {exportJob.id}: {exportJob.status}{exportJob.errorCode ? ` · ${exportJob.errorCode}` : ''}</p>}
        </article>
      </div>
    </section>
  );
};

export default CompetitionDashboardPage;
