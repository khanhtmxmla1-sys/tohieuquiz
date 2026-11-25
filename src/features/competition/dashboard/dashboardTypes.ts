export type CampaignDraft = {
  title: string;
  schoolYear: string;
  timezone: string;
  gradeLevels: string;
  classIds: string;
  requiredPassedRounds: string;
  startsAt: string;
  endsAt: string;
};

export type RoundDraft = {
  roundId: string;
  opensAt: string;
  closesAt: string;
  maxAttempts: string;
  passingScore: string;
};

export type RoundQuizDraft = {
  gradeLevel: string;
  classId: string;
  quizId: string;
};

export type ExamDraft = {
  title: string;
  examDate: string;
  examFormPolicy: "SAME_FORM" | "EQUIVALENT_FORM_SET";
  capacityProfileId: string;
};

export type RoomDraft = {
  name: string;
  roomCode: string;
  scheduledAt: string;
  durationMinutes: string;
  checkInLeadMinutes: string;
  closeDrainMinutes: string;
  formCode: string;
  quizId: string;
  invigilatorIds: string;
  studentIds: string;
  blueprintId: string;
  totalScore: string;
  difficulty: string;
  gradeLevel: string;
  objectiveIds: string;
  equivalentFormApproved: boolean;
};

export type CorrectionDraft = {
  studentId: string;
  score: string;
  correctCount: string;
  timeTaken: string;
  reason: string;
};

export type CertificateDraft = {
  templateId: string;
  winnerStudentIds: string;
  title: string;
  message: string;
  achievementPrefix: string;
};

export type IncidentDraft = {
  roomId: string;
  studentId: string;
  originalResultId: string;
  reasonCode: string;
  reasonText: string;
};

export type AudiencePreview = {
  matchedCount: number;
  countsByGrade?: Record<string, number>;
  countsByClass?: Record<string, number>;
};
