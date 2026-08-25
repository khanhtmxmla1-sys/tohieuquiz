import type {
  PublicGoldenBoardDto,
  PublicGoldenBoardWinnerDto,
} from '../../../shared/competition-portal.contract';

interface GoldenBoardSourceRow {
  source_event_id: string;
  award_rule_version: number;
  school_name: string;
}

interface PublicationRow {
  id: string;
  version: number;
  ranking_version: number;
  published_at: string;
}

interface WinnerRow {
  full_name: string;
  class_name: string;
  grade_level: number;
  award_code: string;
  award_label: string;
}

function goldenBoardCacheIdentity(
  campaignId: string,
  publicationVersion: number,
  awardRuleVersion: number,
): string {
  return `${campaignId}:${publicationVersion}:${awardRuleVersion}`;
}

function unavailable(error: unknown): never {
  if (
    error instanceof Error
    && (
      error.message === 'GOLDEN_BOARD_UNAVAILABLE'
      || error.message === 'GOLDEN_BOARD_PUBLICATION_UNAVAILABLE'
    )
  ) {
    throw error;
  }
  throw new Error('GOLDEN_BOARD_UNAVAILABLE');
}

export async function getPublicGoldenBoard(
  db: D1Database,
  campaignIdInput: string,
): Promise<PublicGoldenBoardDto> {
  const campaignId = String(campaignIdInput ?? '').trim();
  if (!campaignId) throw new Error('GOLDEN_BOARD_UNAVAILABLE');

  try {
    const source = await db.prepare(`
      SELECT
        configs.source_event_id,
        configs.award_rule_version,
        school.setting_value AS school_name
      FROM competition_golden_board_configs AS configs
      JOIN competition_school_exam_events AS events
        ON events.id = configs.source_event_id
        AND events.campaign_id = configs.campaign_id
      JOIN competition_award_rule_versions AS versions
        ON versions.campaign_id = configs.campaign_id
        AND versions.version = configs.award_rule_version
        AND versions.status = 'ACTIVE'
      JOIN system_settings AS school
        ON school.setting_key = 'school_name'
      WHERE configs.campaign_id = ?
        AND configs.enabled = 1
        AND configs.display_mode = 'AWARD_WINNERS'
        AND configs.source_event_id IS NOT NULL
        AND configs.award_rule_version IS NOT NULL
      LIMIT 1
    `).bind(campaignId).first<GoldenBoardSourceRow>();
    if (!source) throw new Error('GOLDEN_BOARD_UNAVAILABLE');

    const publication = await db.prepare(`
      SELECT id, version, ranking_version, published_at
      FROM competition_school_exam_publications
      WHERE event_id = ?
        AND status = 'PUBLISHED'
        AND ranking_version IS NOT NULL
        AND published_at IS NOT NULL
      ORDER BY version DESC
      LIMIT 1
    `).bind(source.source_event_id).first<PublicationRow>();
    if (!publication) throw new Error('GOLDEN_BOARD_PUBLICATION_UNAVAILABLE');

    const winnerRows = await db.prepare(`
      WITH matched_winners AS (
        SELECT
          students.full_name,
          classes.name AS class_name,
          results.grade_level,
          rules.award_code,
          rules.award_label,
          rules.sort_order,
          CASE rules.scope
            WHEN 'EVENT' THEN results.rank_event
            ELSE results.rank_grade
          END AS matched_rank,
          results.student_id,
          results.id AS result_id,
          ROW_NUMBER() OVER (
            PARTITION BY results.id
            ORDER BY
              rules.sort_order ASC,
              rules.award_code COLLATE NOCASE ASC,
              rules.id ASC
          ) AS award_choice
        FROM competition_school_exam_publication_results AS results
        JOIN students
          ON students.id = results.student_id
        JOIN classes
          ON classes.id = results.original_class_id
        JOIN competition_award_rules AS rules
          ON rules.campaign_id = ?
          AND rules.version = ?
          AND (
            (
              rules.scope = 'EVENT'
              AND results.rank_event BETWEEN rules.rank_from AND rules.rank_to
            )
            OR (
              rules.scope = 'GRADE'
              AND rules.grade_level = results.grade_level
              AND results.rank_grade BETWEEN rules.rank_from AND rules.rank_to
            )
          )
        WHERE results.publication_id = ?
          AND results.event_id = ?
          AND results.publication_version = ?
          AND results.ranking_version = ?
      )
      SELECT full_name, class_name, grade_level, award_code, award_label
      FROM matched_winners
      WHERE award_choice = 1
      ORDER BY
        sort_order ASC,
        matched_rank ASC,
        award_code COLLATE NOCASE ASC,
        full_name COLLATE NOCASE ASC,
        student_id ASC,
        result_id ASC
    `).bind(
      campaignId,
      source.award_rule_version,
      publication.id,
      source.source_event_id,
      publication.version,
      publication.ranking_version,
    ).all<WinnerRow>();

    goldenBoardCacheIdentity(
      campaignId,
      publication.version,
      source.award_rule_version,
    );

    const winners: PublicGoldenBoardWinnerDto[] = winnerRows.results.map((row) => ({
      fullName: row.full_name,
      className: row.class_name,
      schoolName: source.school_name,
      gradeLevel: row.grade_level,
      awardCode: row.award_code,
      awardLabel: row.award_label,
    }));

    return {
      winners,
      publicationVersion: publication.version,
      rankingVersion: publication.ranking_version,
      awardRuleVersion: source.award_rule_version,
      publishedAt: publication.published_at,
    };
  } catch (error) {
    unavailable(error);
  }
}
