import type { Question } from '../../types';
import { callApi } from '../../services/apiAdapter';

export interface StudentCompetitionSummary {
  id: string;
  title: string;
  schoolYear?: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
}

export interface StudentCompetitionRound {
  id: string;
  roundNumber: number;
  opensAt?: string;
  closesAt?: string;
  maxAttempts: number;
  passingScore: number;
  status: string;
  attemptsUsed: number;
  bestScore: number | null;
  isPassed?: boolean;
  progressStatus?: string | null;
}

export interface StudentCompetitionDetail extends StudentCompetitionSummary {
  eligibility: { version: number; qualified: boolean; reasonCodes: string[]; qualifiedAt?: string | null } | null;
  rounds: StudentCompetitionRound[];
}

export interface StudentCompetitionAttempt {
  id: string;
  campaignId: string;
  roundId: string;
  startedAt: string;
}

export interface StudentCompetitionQuiz {
  id: string;
  title: string;
  timeLimit: number;
  questions: Question[];
}

export interface StudentCompetitionOfficialResult {
  eventId: string;
  eventTitle: string;
  studentId: string;
  publicationVersion: number;
  rankingVersion: number;
  score: number;
  correctCount: number | null;
  timeTaken: number | null;
  rankEvent: number;
  rankGrade: number;
  rankClass: number;
  publishedAt: string;
}

export const studentCompetitionService = {
  async list(): Promise<StudentCompetitionSummary[]> {
    const response = await callApi<{ items?: StudentCompetitionSummary[] }>('list_student_competitions');
    return response.items || [];
  },

  async get(campaignId: string): Promise<StudentCompetitionDetail> {
    const response = await callApi<{ competition: StudentCompetitionDetail }>('get_student_competition', { campaignId });
    return response.competition;
  },

  async start(campaignId: string, roundId: string, requestId: string) {
    return callApi<{ attempt: StudentCompetitionAttempt; quiz: StudentCompetitionQuiz }>(
      'start_student_competition_round_attempt',
      { campaignId, roundId, requestId },
    );
  },

  async submit(payload: {
    campaignId: string;
    roundId: string;
    attemptId: string;
    answers: Record<string, unknown>;
    timeTaken: number;
    idempotencyKey: string;
  }) {
    return callApi<{ result: { score: number; correctCount: number; totalQuestions: number; progress: { attemptsUsed: number; bestScore: number | null; isPassed: boolean } } }>(
      'submit_student_competition_round_attempt',
      payload,
    );
  },

  async officialResult(campaignId: string): Promise<StudentCompetitionOfficialResult> {
    const response = await callApi<{ result: StudentCompetitionOfficialResult }>(
      'get_student_competition_official_result',
      { campaignId },
    );
    return response.result;
  },
};
