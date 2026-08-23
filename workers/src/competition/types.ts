export interface CompetitionQuizSnapshot {
  id: string;
  quizId: string;
  canonicalPayloadJson: string;
  sha256: string;
  createdAt: string;
  createdBy: string;
}

export interface CompetitionQuizSnapshotPayload {
  quiz: Record<string, unknown>;
  questions: Array<Record<string, unknown>>;
}
