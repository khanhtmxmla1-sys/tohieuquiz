import { StudentCompetitionPortalDtoSchema } from '../../../schemas/competitionPortal.schema';
import type {
  CompetitionPublicState,
  CompetitionRoundPresentationState,
  StudentCompetitionPortalDto,
} from '../../../shared/competition-portal.contract';
import {
  getStudentCompetition,
  listStudentCompetitions,
} from './studentCompetitionService';

export const STUDENT_COMPETITION_PORTAL_NOT_FOUND = 'COMPETITION_STUDENT_PORTAL_NOT_FOUND';
export const STUDENT_COMPETITION_PORTAL_UNAVAILABLE = 'COMPETITION_STUDENT_PORTAL_UNAVAILABLE';

interface StudentPortalPageRow {
  campaign_id: string;
  slug: string;
}

export type StudentCompetitionPortalCompetition = Awaited<ReturnType<typeof getStudentCompetition>>;

export interface StudentCompetitionPortalResolution {
  competition: StudentCompetitionPortalCompetition;
  portal: StudentCompetitionPortalDto;
}

function normalizedSlug(value: string): string {
  const slug = String(value || '').trim();
  if (!slug || slug.includes('/')) throw new Error(STUDENT_COMPETITION_PORTAL_NOT_FOUND);
  return slug;
}

function campaignPublicState(startsAt: string, endsAt: string, now: Date): CompetitionPublicState {
  const timestamp = now.getTime();
  if (timestamp < Date.parse(startsAt)) return 'UPCOMING';
  if (timestamp >= Date.parse(endsAt)) return 'ENDED';
  return 'ONGOING';
}

function roundPresentationState(
  round: StudentCompetitionPortalCompetition['rounds'][number],
): CompetitionRoundPresentationState {
  if (round.isPassed) return 'PASSED';
  if (round.status === 'OPEN') {
    if (round.attemptsUsed >= round.maxAttempts) return 'CLOSED';
    if (round.attemptsUsed > 0) return 'FAILED_RETRY_AVAILABLE';
    return 'OPEN';
  }
  if (round.status === 'CLOSED' || round.status === 'FINALIZED') return 'CLOSED';
  return 'LOCKED';
}

export async function resolveStudentCompetitionBySlug(
  db: D1Database,
  campaignSlugInput: string,
  studentId: string,
  now = new Date(),
): Promise<StudentCompetitionPortalResolution> {
  const campaignSlug = normalizedSlug(campaignSlugInput);

  // Keep ownership semantics canonical: the existing student list is the membership projection.
  const ownedCampaigns = await listStudentCompetitions(db, studentId);
  const page = await db.prepare(`
    SELECT campaign_id, slug
    FROM competition_public_pages
    WHERE slug = ?
    LIMIT 1
  `).bind(campaignSlug).first<StudentPortalPageRow>();

  if (!page || !ownedCampaigns.some((campaign) => campaign.id === page.campaign_id)) {
    throw new Error(STUDENT_COMPETITION_PORTAL_NOT_FOUND);
  }

  let competition: StudentCompetitionPortalCompetition;
  try {
    competition = await getStudentCompetition(db, page.campaign_id, studentId);
  } catch (error) {
    if (error instanceof Error && error.message === 'COMPETITION_STUDENT_NOT_IN_AUDIENCE') {
      throw new Error(STUDENT_COMPETITION_PORTAL_NOT_FOUND);
    }
    throw error;
  }

  const portalCandidate = {
    campaignId: competition.id,
    slug: page.slug,
    title: competition.title,
    schoolYear: competition.schoolYear,
    publicState: campaignPublicState(competition.startsAt, competition.endsAt, now),
    rounds: competition.rounds.map((round) => ({
      roundId: round.id,
      roundNumber: round.roundNumber,
      title: `Vòng ${round.roundNumber}`,
      opensAt: round.opensAt,
      closesAt: round.closesAt,
      state: roundPresentationState(round),
      attemptCount: round.attemptsUsed,
      maxAttempts: round.maxAttempts,
    })),
  };
  const parsed = StudentCompetitionPortalDtoSchema.safeParse(portalCandidate);
  if (!parsed.success) throw new Error('COMPETITION_STUDENT_PORTAL_PROJECTION_INVALID');

  return { competition, portal: parsed.data };
}
