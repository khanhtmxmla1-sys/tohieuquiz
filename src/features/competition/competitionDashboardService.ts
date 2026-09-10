import { callApi } from '../../services/apiAdapter';

export interface CompetitionCampaignView {
  id: string;
  title: string;
  schoolYear: string;
  timezone: string;
  status: string;
  audienceRule?: { gradeLevels: number[]; classIds?: string[] };
  eligibilityPolicy?: { requiredRounds: 6; requiredPassedRounds: number };
  audienceSnapshotId?: string | null;
  startsAt?: string;
  endsAt?: string;
}

export interface CompetitionRoundView {
  id: string;
  campaignId: string;
  roundNumber: number;
  opensAt: string;
  closesAt: string;
  maxAttempts: number;
  passingScore: number;
  status: string;
  finalizedAt?: string | null;
  quizSnapshot?: { status: 'MISSING' | 'LOCKED' | 'INVALID'; mappingCount: number };
  quizMappings?: CompetitionRoundQuizMappingView[];
}

export interface CompetitionRoundQuizMappingView {
  id: string;
  roundId: string;
  gradeLevel: number;
  classId: string | null;
  quizId: string;
  quizSnapshotId: string;
  quizSnapshotHash: string;
  lockedAt?: string;
}

export interface CompetitionEligibilityItemView {
  studentId: string;
  qualified: boolean;
  reasonCodes?: string[];
}

export interface CompetitionEligibilityView {
  campaignId: string;
  version: number;
  items: CompetitionEligibilityItemView[];
}

export interface CompetitionSchoolExamAdmissionItemView {
  studentId: string;
  fullName: string;
  username: string;
  classId: string;
  className: string | null;
  gradeLevel: number;
  qualifiedAt: string | null;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface CompetitionSchoolExamAdmissionsView {
  campaignId: string;
  version: number;
  items: CompetitionSchoolExamAdmissionItemView[];
  approvedCount: number;
}

export interface CompetitionProgressItemView {
  campaignId: string;
  roundId: string;
  roundNumber: number;
  studentId: string;
  classId: string;
  attemptsUsed: number;
  bestAttemptId?: string | null;
  bestScore: number | null;
  isPassed: boolean;
  passedAt?: string | null;
  status: string;
  version?: number;
  updatedAt?: string;
}

export interface SchoolExamRoomView {
  id: string;
  name: string;
  roomCode?: string;
  scheduledAt?: string;
  formCode: string;
  memberCount: number;
  provisionStatus: string;
  status?: string;
}

export interface SchoolExamPreflightView {
  status?: string;
  reason?: string | null;
  plannedConcurrency?: number;
  certifiedConcurrentStudents?: number | null;
  capacityProfileId?: string | null;
}

export interface SchoolExamEventView {
  id: string;
  campaignId: string;
  title: string;
  status: string;
  examDate: string;
  eligibilitySnapshotVersion?: number;
  rankingPolicy?: string;
  examFormPolicy?: 'SAME_FORM' | 'EQUIVALENT_FORM_SET';
  capacityProfileId?: string | null;
  preflight?: SchoolExamPreflightView | null;
  preflightAt?: string | null;
  rooms: SchoolExamRoomView[];
}

export interface CompetitionAudiencePreviewView {
  matchedCount: number;
  countsByGrade?: Record<string, number>;
  countsByClass?: Record<string, number>;
}

export interface SchoolExamReconcileIssueView {
  id: string;
  issueType: string;
  blocking: boolean;
  roomId?: string | null;
  studentId?: string | null;
}

export interface SchoolExamReconcileView {
  id: string;
  version: number;
  status: string;
  blockingIssues: number;
  canonicalResults: number;
  allRoomsClosed: boolean;
  eventStatus: string;
  issues: SchoolExamReconcileIssueView[];
}

export interface SchoolExamRankingItemView {
  studentId: string;
  originalClassId: string;
  gradeLevel: number;
  score: number;
  correctCount: number | null;
  timeTaken: number | null;
  rank: number;
}

export interface SchoolExamRankingView {
  eventId: string;
  publicationVersion: number;
  rankingVersion: number;
  scope: 'EVENT' | 'GRADE' | 'CLASS';
  items: SchoolExamRankingItemView[];
}

export interface SchoolExamIncidentView {
  id: string;
  eventId: string;
  roomId: string | null;
  studentId: string | null;
  reasonCode: string;
  severity?: string;
  reportedBy?: string;
  occurredAt?: string;
}

export interface SchoolExamRetestView {
  id: string;
  eventId: string;
  studentId: string;
  originalResultId?: string | null;
  incidentId?: string | null;
  reasonCode?: string | null;
  reasonText?: string | null;
  status: string;
  resolution?: string | null;
  expiresAt?: string | null;
  liveExamSessionId?: string | null;
}

export interface SchoolExamPublicationView {
  id: string;
  eventId: string;
  publicationVersion: number;
  rankingVersion: number;
  status: string;
  publishedAt?: string | null;
}

export interface SchoolExamResultCorrectionView {
  id: string;
  eventId: string;
  studentId: string;
  sourcePublicationVersion: number;
  before: { score: number; correctCount: number | null; timeTaken: number | null };
  after: { score: number; correctCount: number | null; timeTaken: number | null };
  reason: string;
  status: 'PENDING' | 'APPLIED';
  appliedPublicationVersion?: number | null;
  createdAt: string;
}

export interface SchoolExamExportView {
  id: string;
  eventId: string;
  publicationVersion: number;
  scope: 'SCHOOL' | 'CLASS';
  classId?: string | null;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';
  errorCode?: string | null;
  completedAt?: string | null;
}

export interface SchoolExamCertificateBatchView {
  id: string;
  eventId: string;
  publicationVersion: number;
  rankingVersion: number;
  status: string;
  winnerCount: number;
  batchCount: number;
}

export const competitionDashboardService = {
  async listCampaigns(): Promise<CompetitionCampaignView[]> {
    const response = await callApi<{ items?: CompetitionCampaignView[] }>('list_competitions');
    return response.items || [];
  },

  async createCampaign(payload: {
    title: string;
    schoolYear: string;
    timezone: string;
    audienceRule: { gradeLevels: number[]; classIds?: string[] };
    eligibilityPolicy: { requiredRounds: 6; requiredPassedRounds: number };
    startsAt: string;
    endsAt: string;
    requestId: string;
  }): Promise<CompetitionCampaignView> {
    const response = await callApi<{ campaign: CompetitionCampaignView }>('create_competition', payload);
    return response.campaign;
  },

  async updateCampaign(campaignId: string, payload: {
    title?: string;
    schoolYear?: string;
    timezone?: string;
    audienceRule?: { gradeLevels: number[]; classIds?: string[] };
    eligibilityPolicy?: { requiredRounds: 6; requiredPassedRounds: number };
    startsAt?: string;
    endsAt?: string;
    requestId: string;
  }): Promise<CompetitionCampaignView> {
    const response = await callApi<{ campaign: CompetitionCampaignView }>('update_competition', { campaignId, ...payload });
    return response.campaign;
  },

  async listRounds(campaignId: string): Promise<CompetitionRoundView[]> {
    const response = await callApi<{ items?: CompetitionRoundView[] }>('get_competition_rounds', { campaignId });
    return response.items || [];
  },

  async updateRound(payload: {
    campaignId: string;
    roundId: string;
    roundNumber: number;
    opensAt: string;
    closesAt: string;
    maxAttempts: number;
    passingRuleType: 'MIN_SCORE';
    passingScore: number;
    requestId: string;
  }): Promise<CompetitionRoundView> {
    const response = await callApi<{ round: CompetitionRoundView }>('update_competition_round', payload);
    return response.round;
  },

  async upsertRoundQuiz(payload: {
    campaignId: string;
    roundId: string;
    gradeLevel: number;
    classId?: string;
    quizId: string;
    requestId: string;
  }): Promise<CompetitionRoundQuizMappingView> {
    const response = await callApi<{ mapping: CompetitionRoundQuizMappingView }>(
      'upsert_competition_round_quiz',
      payload,
    );
    return response.mapping;
  },

  async finalizeRound(campaignId: string, roundId: string, requestId: string): Promise<CompetitionRoundView> {
    const response = await callApi<{ round: CompetitionRoundView }>('finalize_competition_round', {
      campaignId,
      roundId,
      requestId,
    });
    return response.round;
  },

  async getEligibility(campaignId: string): Promise<CompetitionEligibilityView> {
    return callApi<CompetitionEligibilityView>('get_competition_eligibility', { campaignId });
  },

  async listProgress(campaignId: string): Promise<CompetitionProgressItemView[]> {
    const response = await callApi<{ items?: CompetitionProgressItemView[] }>('get_competition_progress', { campaignId });
    return response.items || [];
  },

  async listSchoolExamEvents(campaignId: string): Promise<SchoolExamEventView[]> {
    const response = await callApi<{ items?: SchoolExamEventView[] }>('list_school_exam_events', { campaignId });
    return response.items || [];
  },

  async getSchoolExamEvent(eventId: string): Promise<SchoolExamEventView> {
    const response = await callApi<{ event: SchoolExamEventView }>('get_school_exam_event', { eventId });
    return response.event;
  },

  async previewAudience(campaignId: string): Promise<CompetitionAudiencePreviewView> {
    const response = await callApi<{ preview: CompetitionAudiencePreviewView }>('preview_competition_audience', { campaignId });
    return response.preview;
  },

  async freezeAudience(campaignId: string, requestId: string, expectedMemberCount: number): Promise<{ snapshot: { id: string; memberCount?: number; status?: string } }> {
    return callApi('freeze_competition_audience', { campaignId, requestId, expectedMemberCount });
  },

  async finalizeEligibility(campaignId: string, requestId: string) {
    return callApi('finalize_competition_eligibility', { campaignId, requestId });
  },

  async listSchoolExamAdmissions(campaignId: string, version?: number): Promise<CompetitionSchoolExamAdmissionsView> {
    const response = await callApi<Partial<CompetitionSchoolExamAdmissionsView>>(
      'list_competition_school_exam_admissions',
      { campaignId, version },
    );
    const items = response.items || [];
    return {
      campaignId: response.campaignId || campaignId,
      version: response.version || version || 0,
      items,
      approvedCount: response.approvedCount ?? items.filter((item) => item.approved).length,
    };
  },

  async approveSchoolExamAdmissions(payload: {
    campaignId: string;
    eligibilitySnapshotVersion: number;
    studentIds?: string[];
    approveAllQualified?: boolean;
    requestId: string;
  }): Promise<{ approvedCount: number; alreadyApprovedCount: number }> {
    return callApi('approve_competition_school_exam_admissions', payload);
  },

  schoolExamAdmissionsExportUrl(campaignId: string, version: number): string {
    return `/api/competitions/${encodeURIComponent(campaignId)}/school-exam-admissions/export?version=${encodeURIComponent(String(version))}`;
  },

  async createSchoolExamEvent(payload: {
    campaignId: string;
    eligibilitySnapshotVersion: number;
    title: string;
    examDate: string;
    rankingPolicy: 'SCORE_CORRECT_TIME';
    examFormPolicy: 'SAME_FORM' | 'EQUIVALENT_FORM_SET';
    capacityProfileId?: string;
    requestId: string;
  }): Promise<SchoolExamEventView> {
    const response = await callApi<{ event: SchoolExamEventView }>('create_school_exam_event', payload);
    return { ...response.event, rooms: response.event.rooms || [] };
  },

  async createSchoolExamRoom(payload: {
    eventId: string;
    name: string;
    roomCode: string;
    scheduledAt: string;
    durationMinutes: number;
    checkInLeadMinutes: number;
    closeDrainMinutes: number;
    formCode: string;
    quizId: string;
    invigilatorIds: string[];
    studentIds: string[];
    formDefinition: {
      blueprintId: string;
      durationMinutes: number;
      totalScore: number;
      difficulty: string;
      gradeLevel: number;
      objectiveIds: string[];
    };
    equivalentFormApproved?: boolean;
    requestId: string;
  }): Promise<{ room: SchoolExamRoomView; warnings: string[] }> {
    return callApi('create_school_exam_room', payload);
  },

  async runPreflight(eventId: string, requestId: string): Promise<SchoolExamPreflightView> {
    const response = await callApi<{ preflight: SchoolExamPreflightView }>('run_school_exam_preflight', { eventId, requestId });
    return response.preflight;
  },

  async provisionSchoolExam(eventId: string, requestId: string) {
    return callApi('provision_school_exam', { eventId, requestId });
  },

  async getReconcile(eventId: string): Promise<SchoolExamReconcileView> {
    const response = await callApi<{ reconcile: SchoolExamReconcileView }>('get_school_exam_reconcile', { eventId });
    return response.reconcile;
  },

  async listIncidents(eventId: string): Promise<SchoolExamIncidentView[]> {
    const response = await callApi<{ items?: SchoolExamIncidentView[] }>('list_school_exam_incidents', { eventId });
    return response.items || [];
  },

  async reportIncident(payload: {
    eventId: string;
    roomId: string;
    studentId: string;
    originalResultId: string;
    reasonCode: 'NETWORK_FAILURE' | 'DEVICE_FAILURE' | 'SERVER_INCIDENT' | 'EXAM_INTERRUPTED' | 'ADMINISTRATIVE_ERROR';
    reasonText?: string;
    requestId: string;
  }) {
    return callApi('report_school_exam_incident', payload);
  },

  async listRetests(eventId: string): Promise<SchoolExamRetestView[]> {
    const response = await callApi<{ items?: SchoolExamRetestView[] }>('list_school_exam_retests', { eventId });
    return response.items || [];
  },

  async grantRetest(eventId: string, retestId: string, payload: {
    expiresAt: string;
    resolution: 'KEEP_ORIGINAL' | 'REPLACE_WITH_RETEST' | 'INVALIDATE_RESULT';
    requestId: string;
  }): Promise<SchoolExamRetestView> {
    const response = await callApi<{ retest: SchoolExamRetestView }>('grant_school_exam_retest', { eventId, retestId, ...payload });
    return response.retest;
  },

  async startReconcile(eventId: string, requestId: string): Promise<SchoolExamReconcileView> {
    const response = await callApi<{ reconcile: SchoolExamReconcileView }>('start_school_exam_reconcile', { eventId, requestId });
    return response.reconcile;
  },

  async publish(eventId: string, requestId: string): Promise<SchoolExamPublicationView> {
    const response = await callApi<{ publication: SchoolExamPublicationView }>('publish_school_exam_results', { eventId, requestId });
    return response.publication;
  },

  async listResultCorrections(eventId: string): Promise<SchoolExamResultCorrectionView[]> {
    const response = await callApi<{ items?: SchoolExamResultCorrectionView[] }>('list_school_exam_result_corrections', { eventId });
    return response.items || [];
  },

  async createResultCorrection(payload: {
    eventId: string;
    studentId: string;
    score: number;
    correctCount: number | null;
    timeTaken: number | null;
    reason: string;
    requestId: string;
  }): Promise<SchoolExamResultCorrectionView> {
    const response = await callApi<{ correction: SchoolExamResultCorrectionView }>('create_school_exam_result_correction', payload);
    return response.correction;
  },

  async republishCorrectedResults(eventId: string, requestId: string): Promise<SchoolExamPublicationView> {
    const response = await callApi<{ publication: SchoolExamPublicationView }>('republish_corrected_school_exam_results', { eventId, requestId });
    return response.publication;
  },

  async getRankings(eventId: string, payload: { scope: 'EVENT' | 'GRADE' | 'CLASS'; gradeLevel?: number; classId?: string }): Promise<SchoolExamRankingView> {
    const response = await callApi<{ rankings: SchoolExamRankingView }>('get_school_exam_rankings', { eventId, ...payload });
    return response.rankings;
  },

  async createExport(eventId: string, payload: { scope: 'SCHOOL' | 'CLASS'; classId?: string; requestId: string }): Promise<SchoolExamExportView> {
    const response = await callApi<{ export: SchoolExamExportView }>('create_school_exam_export', { eventId, ...payload });
    return response.export;
  },

  async getExport(eventId: string, exportId: string): Promise<SchoolExamExportView> {
    const response = await callApi<{ export: SchoolExamExportView }>('get_school_exam_export', { eventId, exportId });
    return response.export;
  },

  async createCertificates(payload: {
    eventId: string;
    publicationVersion: number;
    rankingVersion: number;
    winnerStudentIds: string[];
    templateId: string;
    title: string;
    message?: string;
    achievementPrefix?: string;
    dateLine?: string;
    requestId: string;
  }): Promise<SchoolExamCertificateBatchView> {
    const response = await callApi<{ certificateBatch: SchoolExamCertificateBatchView }>('create_competition_certificate_batch', payload);
    return response.certificateBatch;
  },
};
