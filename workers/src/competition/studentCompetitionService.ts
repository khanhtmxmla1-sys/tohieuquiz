function normalizedId(value: string, errorCode: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(errorCode);
  return normalized;
}

function roundStatus(row: { status: string; opens_at: string; closes_at: string }): string {
  if (['DRAFT', 'CLOSED', 'FINALIZED'].includes(row.status)) return row.status;
  const now = Date.now();
  if (now < Date.parse(row.opens_at)) return 'SCHEDULED';
  if (now < Date.parse(row.closes_at)) return 'OPEN';
  return 'CLOSED';
}

export async function listStudentCompetitions(db: D1Database, studentIdInput: string) {
  const studentId = normalizedId(studentIdInput, 'COMPETITION_STUDENT_ID_REQUIRED');
  const result = await db.prepare(`
    SELECT campaign.id, campaign.title, campaign.school_year, campaign.timezone,
           campaign.status, campaign.starts_at, campaign.ends_at
    FROM competition_campaigns AS campaign
    INNER JOIN competition_audience_members AS member
      ON member.audience_snapshot_id = campaign.audience_snapshot_id
     AND member.student_id = ?
    ORDER BY campaign.starts_at DESC, campaign.id ASC
  `).bind(studentId).all<{
    id: string; title: string; school_year: string; timezone: string;
    status: string; starts_at: string; ends_at: string;
  }>();
  return (result.results || []).map(row => ({
    id: row.id,
    title: row.title,
    schoolYear: row.school_year,
    timezone: row.timezone,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));
}

export async function getStudentCompetition(
  db: D1Database,
  campaignIdInput: string,
  studentIdInput: string,
) {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const studentId = normalizedId(studentIdInput, 'COMPETITION_STUDENT_ID_REQUIRED');
  const campaign = await db.prepare(`
    SELECT campaign.id, campaign.title, campaign.school_year, campaign.timezone,
           campaign.status, campaign.starts_at, campaign.ends_at
    FROM competition_campaigns AS campaign
    INNER JOIN competition_audience_members AS member
      ON member.audience_snapshot_id = campaign.audience_snapshot_id
     AND member.student_id = ?
    WHERE campaign.id = ?
    LIMIT 1
  `).bind(studentId, campaignId).first<{
    id: string; title: string; school_year: string; timezone: string;
    status: string; starts_at: string; ends_at: string;
  }>();
  if (!campaign) throw new Error('COMPETITION_STUDENT_NOT_IN_AUDIENCE');

  const roundsResult = await db.prepare(`
    SELECT round.id, round.round_number, round.opens_at, round.closes_at,
           round.max_attempts, round.passing_score, round.status,
           progress.attempts_used, progress.best_score, progress.is_passed,
           progress.status AS progress_status
    FROM competition_rounds AS round
    LEFT JOIN competition_round_progress AS progress
      ON progress.round_id = round.id AND progress.student_id = ?
    WHERE round.campaign_id = ?
    ORDER BY round.round_number ASC, round.id ASC
  `).bind(studentId, campaignId).all<{
    id: string; round_number: number; opens_at: string; closes_at: string;
    max_attempts: number; passing_score: number; status: string;
    attempts_used: number | null; best_score: number | null; is_passed: number | null;
    progress_status: string | null;
  }>();

  const eligibility = await db.prepare(`
    SELECT eligibility_snapshot_version, qualified, reason_codes_json, qualified_at
    FROM competition_eligibility
    WHERE campaign_id = ? AND student_id = ?
    ORDER BY eligibility_snapshot_version DESC LIMIT 1
  `).bind(campaignId, studentId).first<{
    eligibility_snapshot_version: number; qualified: number; reason_codes_json: string; qualified_at: string | null;
  }>();

  return {
    id: campaign.id,
    title: campaign.title,
    schoolYear: campaign.school_year,
    timezone: campaign.timezone,
    status: campaign.status,
    startsAt: campaign.starts_at,
    endsAt: campaign.ends_at,
    eligibility: eligibility ? {
      version: Number(eligibility.eligibility_snapshot_version),
      qualified: Number(eligibility.qualified) === 1,
      reasonCodes: JSON.parse(eligibility.reason_codes_json || '[]') as string[],
      qualifiedAt: eligibility.qualified_at,
    } : null,
    rounds: (roundsResult.results || []).map(row => ({
      id: row.id,
      roundNumber: Number(row.round_number),
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      maxAttempts: Number(row.max_attempts),
      passingScore: Number(row.passing_score),
      status: roundStatus(row),
      attemptsUsed: Number(row.attempts_used || 0),
      bestScore: row.best_score === null ? null : Number(row.best_score),
      isPassed: Number(row.is_passed || 0) === 1,
      progressStatus: row.progress_status,
    })),
  };
}

export async function getStudentOfficialCompetitionResult(
  db: D1Database,
  campaignIdInput: string,
  studentIdInput: string,
) {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const studentId = normalizedId(studentIdInput, 'COMPETITION_STUDENT_ID_REQUIRED');
  const row = await db.prepare(`
    SELECT result.event_id, event.title AS event_title, result.student_id,
           result.publication_version, result.ranking_version, result.grade_level,
           result.original_class_id, result.score, result.correct_count,
           result.time_taken, result.rank_event, result.rank_grade, result.rank_class,
           result.published_at
    FROM competition_school_exam_publication_results AS result
    INNER JOIN competition_school_exam_publications AS publication
      ON publication.id = result.publication_id AND publication.status = 'PUBLISHED'
    INNER JOIN competition_school_exam_events AS event
      ON event.id = result.event_id AND event.campaign_id = ? AND event.status = 'PUBLISHED'
    WHERE result.student_id = ?
    ORDER BY result.publication_version DESC, result.published_at DESC
    LIMIT 1
  `).bind(campaignId, studentId).first<{
    event_id: string; event_title: string; student_id: string; publication_version: number;
    ranking_version: number; grade_level: number; original_class_id: string; score: number;
    correct_count: number | null; time_taken: number | null; rank_event: number;
    rank_grade: number; rank_class: number; published_at: string;
  }>();
  if (!row) throw new Error('SCHOOL_EXAM_PUBLICATION_NOT_FOUND');
  return {
    eventId: row.event_id,
    eventTitle: row.event_title,
    studentId: row.student_id,
    publicationVersion: Number(row.publication_version),
    rankingVersion: Number(row.ranking_version),
    gradeLevel: Number(row.grade_level),
    originalClassId: row.original_class_id,
    score: Number(row.score),
    correctCount: row.correct_count === null ? null : Number(row.correct_count),
    timeTaken: row.time_taken === null ? null : Number(row.time_taken),
    rankEvent: Number(row.rank_event),
    rankGrade: Number(row.rank_grade),
    rankClass: Number(row.rank_class),
    publishedAt: row.published_at,
  };
}
