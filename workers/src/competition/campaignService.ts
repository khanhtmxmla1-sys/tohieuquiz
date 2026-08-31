import {
  CompetitionAudienceRuleSchema,
  CreateCompetitionCampaignRequestSchema,
  UpdateCompetitionCampaignRequestSchema,
  type CreateCompetitionCampaignRequest,
  type UpdateCompetitionCampaignRequest,
} from '../../../schemas/competition.schema';
import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';

interface CompetitionCampaignRow {
  id: string;
  title: string;
  school_year: string;
  timezone: string;
  status: string;
  audience_rule_json: string;
  audience_snapshot_id: string | null;
  eligibility_policy_json: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapCampaign(row: CompetitionCampaignRow) {
  return {
    id: row.id,
    title: row.title,
    schoolYear: row.school_year,
    timezone: row.timezone,
    status: row.status,
    audienceRule: parseJson(row.audience_rule_json, { gradeLevels: [] as number[] }),
    audienceSnapshotId: row.audience_snapshot_id,
    eligibilityPolicy: parseJson(row.eligibility_policy_json, {
      requiredRounds: 6,
      requiredPassedRounds: 6,
    }),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCampaignRow(db: D1Database, campaignId: string): Promise<CompetitionCampaignRow | null> {
  return db.prepare(`
    SELECT id, title, school_year, timezone, status, audience_rule_json,
           audience_snapshot_id, eligibility_policy_json, starts_at, ends_at,
           created_by, created_at, updated_at
    FROM competition_campaigns
    WHERE id = ?
    LIMIT 1
  `).bind(campaignId).first<CompetitionCampaignRow>();
}

export async function createCompetitionCampaign(
  db: D1Database,
  input: CreateCompetitionCampaignRequest,
  actorUsername: string,
) {
  const parsed = CreateCompetitionCampaignRequestSchema.parse(input);
  const actor = String(actorUsername || '').trim();
  if (!actor) throw new Error('COMPETITION_ACTOR_REQUIRED');

  const id = generateId('competition-campaign');
  const now = new Date().toISOString();
  const audienceRuleJson = JSON.stringify(parsed.audienceRule);
  const eligibilityPolicyJson = JSON.stringify(parsed.eligibilityPolicy);

  await db.batch([
    db.prepare(`
      INSERT INTO competition_campaigns (
        id, title, school_year, timezone, status, audience_rule_json,
        audience_snapshot_id, eligibility_policy_json, starts_at, ends_at,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'DRAFT', ?, NULL, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      parsed.title,
      parsed.schoolYear,
      parsed.timezone,
      audienceRuleJson,
      eligibilityPolicyJson,
      parsed.startsAt,
      parsed.endsAt,
      actor,
      now,
      now,
    ),
    auditStatement(db, {
      actorUsername: actor,
      action: 'CAMPAIGN_CREATED',
      targetType: 'competition_campaign',
      targetId: id,
      requestId: parsed.requestId,
      after: {
        id,
        title: parsed.title,
        schoolYear: parsed.schoolYear,
        timezone: parsed.timezone,
        status: 'DRAFT',
        audienceRule: parsed.audienceRule,
        eligibilityPolicy: parsed.eligibilityPolicy,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
      },
    }),
  ]);

  const persisted = await getCampaignRow(db, id);
  if (!persisted) throw new Error('COMPETITION_CAMPAIGN_PERSIST_FAILED');
  return mapCampaign(persisted);
}

interface CompetitionAudienceCandidateRow {
  student_id: string;
  class_id: string;
  class_name: string;
  student_archived_at: string | null;
  class_archived_at: string | null;
}

function gradeFromClassName(className: string): number | null {
  const match = String(className || '').match(/1[0-2]|[1-9]/);
  return match ? Number(match[0]) : null;
}

function matchesAudienceRule(
  row: CompetitionAudienceCandidateRow,
  rule: { gradeLevels: number[]; classIds?: string[] },
): { matches: boolean; gradeLevel: number | null } {
  const gradeLevel = gradeFromClassName(row.class_name);
  if (gradeLevel === null || !rule.gradeLevels.includes(gradeLevel)) {
    return { matches: false, gradeLevel };
  }
  if (rule.classIds && rule.classIds.length > 0 && !rule.classIds.includes(row.class_id)) {
    return { matches: false, gradeLevel };
  }
  return { matches: true, gradeLevel };
}

export async function competitionAudienceIntersectsClassScope(
  db: D1Database,
  campaignId: string,
  classIds: string[],
): Promise<boolean> {
  const campaign = await getCampaignRow(db, String(campaignId || '').trim());
  if (!campaign || classIds.length === 0) return false;

  let rawRule: unknown;
  try {
    rawRule = JSON.parse(campaign.audience_rule_json);
  } catch {
    return false;
  }
  const parsedRule = CompetitionAudienceRuleSchema.safeParse(rawRule);
  if (!parsedRule.success) return false;

  const classScope = new Set(classIds);
  const rows = await audienceCandidates(db);
  return rows.some((row) => (
    classScope.has(row.class_id)
    && !String(row.student_archived_at || '').trim()
    && !String(row.class_archived_at || '').trim()
    && matchesAudienceRule(row, parsedRule.data).matches
  ));
}

async function audienceCandidates(db: D1Database): Promise<CompetitionAudienceCandidateRow[]> {
  const result = await db.prepare(`
    SELECT student.id AS student_id,
           student.class_id AS class_id,
           classroom.name AS class_name,
           student.archived_at AS student_archived_at,
           classroom.archived_at AS class_archived_at
    FROM students AS student
    INNER JOIN classes AS classroom ON classroom.id = student.class_id
    ORDER BY student.id ASC
  `).all<CompetitionAudienceCandidateRow>();
  return result.results || [];
}

export async function getCompetitionCampaign(db: D1Database, campaignId: string) {
  const row = await getCampaignRow(db, String(campaignId || '').trim());
  return row ? mapCampaign(row) : null;
}

export async function listCompetitionCampaigns(db: D1Database) {
  const result = await db.prepare(`
    SELECT id, title, school_year, timezone, status, audience_rule_json,
           audience_snapshot_id, eligibility_policy_json, starts_at, ends_at,
           created_by, created_at, updated_at
    FROM competition_campaigns
    ORDER BY created_at DESC, id DESC
    LIMIT 100
  `).all<CompetitionCampaignRow>();
  return (result.results || []).map(mapCampaign);
}

export async function updateCompetitionCampaign(
  db: D1Database,
  campaignId: string,
  input: UpdateCompetitionCampaignRequest,
  actorUsername: string,
) {
  const parsed = UpdateCompetitionCampaignRequestSchema.parse(input);
  const actor = String(actorUsername || '').trim();
  if (!actor) throw new Error('COMPETITION_ACTOR_REQUIRED');

  const before = await getCampaignRow(db, String(campaignId || '').trim());
  if (!before) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');
  if (before.status !== 'DRAFT') throw new Error('COMPETITION_CAMPAIGN_NOT_DRAFT');

  const current = mapCampaign(before);
  const merged = CreateCompetitionCampaignRequestSchema.parse({
    title: parsed.title ?? current.title,
    schoolYear: parsed.schoolYear ?? current.schoolYear,
    timezone: parsed.timezone ?? current.timezone,
    audienceRule: parsed.audienceRule ?? current.audienceRule,
    eligibilityPolicy: parsed.eligibilityPolicy ?? current.eligibilityPolicy,
    startsAt: parsed.startsAt ?? current.startsAt,
    endsAt: parsed.endsAt ?? current.endsAt,
    requestId: parsed.requestId,
  });
  const now = new Date().toISOString();

  await db.batch([
    db.prepare(`
      UPDATE competition_campaigns
      SET title = ?, school_year = ?, timezone = ?, audience_rule_json = ?,
          eligibility_policy_json = ?, starts_at = ?, ends_at = ?, updated_at = ?
      WHERE id = ? AND status = 'DRAFT'
    `).bind(
      merged.title,
      merged.schoolYear,
      merged.timezone,
      JSON.stringify(merged.audienceRule),
      JSON.stringify(merged.eligibilityPolicy),
      merged.startsAt,
      merged.endsAt,
      now,
      before.id,
    ),
    auditStatement(db, {
      actorUsername: actor,
      action: 'CAMPAIGN_UPDATED',
      targetType: 'competition_campaign',
      targetId: before.id,
      requestId: parsed.requestId,
      before: current,
      after: {
        ...current,
        title: merged.title,
        schoolYear: merged.schoolYear,
        timezone: merged.timezone,
        audienceRule: merged.audienceRule,
        eligibilityPolicy: merged.eligibilityPolicy,
        startsAt: merged.startsAt,
        endsAt: merged.endsAt,
        updatedAt: now,
      },
    }),
  ]);

  const updated = await getCampaignRow(db, before.id);
  if (!updated) throw new Error('COMPETITION_CAMPAIGN_PERSIST_FAILED');
  return mapCampaign(updated);
}

export async function previewCompetitionAudience(
  db: D1Database,
  campaignId: string,
) {
  const campaign = await getCampaignRow(db, String(campaignId || '').trim());
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');

  const rule = parseJson<{ gradeLevels: number[]; classIds?: string[] }>(
    campaign.audience_rule_json,
    { gradeLevels: [] },
  );
  const rows = await audienceCandidates(db);
  const countsByGrade: Record<string, number> = {};
  const countsByClass: Record<string, number> = {};
  let matchedCount = 0;
  let excludedArchivedCount = 0;
  let excludedByRuleCount = 0;

  for (const row of rows) {
    const archived = Boolean(
      String(row.student_archived_at || '').trim()
      || String(row.class_archived_at || '').trim(),
    );
    if (archived) {
      excludedArchivedCount += 1;
      continue;
    }

    const match = matchesAudienceRule(row, rule);
    if (!match.matches || match.gradeLevel === null) {
      excludedByRuleCount += 1;
      continue;
    }

    matchedCount += 1;
    const gradeKey = String(match.gradeLevel);
    countsByGrade[gradeKey] = (countsByGrade[gradeKey] || 0) + 1;
    countsByClass[row.class_id] = (countsByClass[row.class_id] || 0) + 1;
  }

  return {
    matchedCount,
    countsByGrade,
    countsByClass,
    excludedArchivedCount,
    excludedByRuleCount,
  };
}

interface CompetitionAudienceSnapshotRow {
  id: string;
  campaign_id: string;
  version: number;
  status: 'BUILDING' | 'LOCKED';
  member_count: number;
  snapshot_hash: string;
  created_at: string;
  locked_at: string | null;
  created_by: string;
}

interface CompetitionAudienceMemberRow {
  student_id: string;
  grade_level_at_snapshot: number;
  class_id_at_snapshot: string;
  student_status_at_snapshot: string;
}

function mapAudienceSnapshot(row: CompetitionAudienceSnapshotRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    version: Number(row.version),
    status: row.status,
    memberCount: Number(row.member_count),
    snapshotHash: row.snapshot_hash,
    createdAt: row.created_at,
    lockedAt: row.locked_at,
    createdBy: row.created_by,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function matchedAudienceMembers(
  db: D1Database,
  campaign: CompetitionCampaignRow,
): Promise<Array<{
  studentId: string;
  gradeLevelAtSnapshot: number;
  classIdAtSnapshot: string;
  studentStatusAtSnapshot: 'ACTIVE';
}>> {
  const rule = parseJson<{ gradeLevels: number[]; classIds?: string[] }>(
    campaign.audience_rule_json,
    { gradeLevels: [] },
  );
  const rows = await audienceCandidates(db);
  const members: Array<{
    studentId: string;
    gradeLevelAtSnapshot: number;
    classIdAtSnapshot: string;
    studentStatusAtSnapshot: 'ACTIVE';
  }> = [];

  for (const row of rows) {
    const archived = Boolean(
      String(row.student_archived_at || '').trim()
      || String(row.class_archived_at || '').trim(),
    );
    if (archived) continue;
    const match = matchesAudienceRule(row, rule);
    if (!match.matches || match.gradeLevel === null) continue;
    members.push({
      studentId: row.student_id,
      gradeLevelAtSnapshot: match.gradeLevel,
      classIdAtSnapshot: row.class_id,
      studentStatusAtSnapshot: 'ACTIVE',
    });
  }

  return members.sort((left, right) => left.studentId.localeCompare(right.studentId));
}

export async function freezeCompetitionAudience(
  db: D1Database,
  campaignId: string,
  actorUsername: string,
  requestId: string,
  expectedMemberCount?: number,
) {
  const normalizedCampaignId = String(campaignId || '').trim();
  const actor = String(actorUsername || '').trim();
  const normalizedRequestId = String(requestId || '').trim();
  if (!actor) throw new Error('COMPETITION_ACTOR_REQUIRED');
  if (!normalizedRequestId) throw new Error('COMPETITION_REQUEST_ID_REQUIRED');

  const campaign = await getCampaignRow(db, normalizedCampaignId);
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');
  if (campaign.status !== 'DRAFT') throw new Error('COMPETITION_CAMPAIGN_NOT_DRAFT');

  const members = await matchedAudienceMembers(db, campaign);
  if (expectedMemberCount !== undefined && members.length !== expectedMemberCount) {
    throw new Error('COMPETITION_AUDIENCE_CHANGED_REVIEW_REQUIRED');
  }
  const versionRow = await db.prepare(`
    SELECT COALESCE(MAX(version), 0) AS max_version
    FROM competition_audience_snapshots
    WHERE campaign_id = ?
  `).bind(normalizedCampaignId).first<{ max_version: number }>();
  const version = Number(versionRow?.max_version || 0) + 1;
  const snapshotId = generateId('competition-audience');
  const createdAt = new Date().toISOString();

  const buildStatements: D1PreparedStatement[] = [
    db.prepare(`
      INSERT INTO competition_audience_snapshots (
        id, campaign_id, version, status, member_count, snapshot_hash,
        created_at, locked_at, created_by
      ) VALUES (?, ?, ?, 'BUILDING', 0, '', ?, NULL, ?)
    `).bind(snapshotId, normalizedCampaignId, version, createdAt, actor),
  ];
  for (const member of members) {
    buildStatements.push(db.prepare(`
      INSERT INTO competition_audience_members (
        audience_snapshot_id, student_id, grade_level_at_snapshot,
        class_id_at_snapshot, student_status_at_snapshot
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      snapshotId,
      member.studentId,
      member.gradeLevelAtSnapshot,
      member.classIdAtSnapshot,
      member.studentStatusAtSnapshot,
    ));
  }
  await db.batch(buildStatements);

  const snapshotHash = await sha256Hex(JSON.stringify(members));
  const lockedAt = new Date().toISOString();
  await db.batch([
    db.prepare(`
      UPDATE competition_audience_snapshots
      SET status = 'LOCKED', member_count = ?, snapshot_hash = ?, locked_at = ?
      WHERE id = ? AND campaign_id = ? AND status = 'BUILDING'
    `).bind(members.length, snapshotHash, lockedAt, snapshotId, normalizedCampaignId),
    db.prepare(`
      UPDATE competition_campaigns
      SET audience_snapshot_id = ?, updated_at = ?
      WHERE id = ?
        AND EXISTS (
          SELECT 1
          FROM competition_audience_snapshots
          WHERE id = ? AND campaign_id = ? AND status = 'LOCKED'
        )
    `).bind(
      snapshotId,
      lockedAt,
      normalizedCampaignId,
      snapshotId,
      normalizedCampaignId,
    ),
    auditStatement(db, {
      actorUsername: actor,
      action: 'AUDIENCE_SNAPSHOTTED',
      targetType: 'competition_audience_snapshot',
      targetId: snapshotId,
      requestId: normalizedRequestId,
      after: {
        campaignId: normalizedCampaignId,
        version,
        status: 'LOCKED',
        memberCount: members.length,
        snapshotHash,
      },
    }),
  ]);

  const snapshot = await db.prepare(`
    SELECT id, campaign_id, version, status, member_count, snapshot_hash,
           created_at, locked_at, created_by
    FROM competition_audience_snapshots
    WHERE id = ?
  `).bind(snapshotId).first<CompetitionAudienceSnapshotRow>();
  if (!snapshot || snapshot.status !== 'LOCKED') {
    throw new Error('COMPETITION_AUDIENCE_SNAPSHOT_LOCK_FAILED');
  }
  return mapAudienceSnapshot(snapshot);
}

function encodeAudienceCursor(studentId: string): string {
  return btoa(`student:${studentId}`);
}

function decodeAudienceCursor(cursor: string): string {
  try {
    const decoded = atob(cursor);
    if (!decoded.startsWith('student:')) throw new Error('invalid');
    const studentId = decoded.slice('student:'.length).trim();
    if (!studentId) throw new Error('invalid');
    return studentId;
  } catch {
    throw new Error('COMPETITION_AUDIENCE_CURSOR_INVALID');
  }
}

export async function listCompetitionAudience(
  db: D1Database,
  campaignId: string,
  options: { cursor?: string; limit?: number; classIds?: string[] } = {},
) {
  const campaign = await getCampaignRow(db, String(campaignId || '').trim());
  if (!campaign) throw new Error('COMPETITION_CAMPAIGN_NOT_FOUND');
  if (!campaign.audience_snapshot_id) throw new Error('COMPETITION_AUDIENCE_NOT_SNAPSHOTTED');

  const limit = Math.min(200, Math.max(1, Math.floor(Number(options.limit) || 50)));
  const afterStudentId = options.cursor ? decodeAudienceCursor(options.cursor) : '';
  const scopedClassIds = (options.classIds || []).map((id) => String(id || '').trim()).filter(Boolean);
  const classScopeSql = scopedClassIds.length > 0
    ? ` AND class_id_at_snapshot IN (${scopedClassIds.map(() => '?').join(', ')})`
    : '';
  const result = await db.prepare(`
    SELECT student_id, grade_level_at_snapshot, class_id_at_snapshot,
           student_status_at_snapshot
    FROM competition_audience_members
    WHERE audience_snapshot_id = ? AND student_id > ?${classScopeSql}
    ORDER BY student_id ASC
    LIMIT ?
  `).bind(
    campaign.audience_snapshot_id,
    afterStudentId,
    ...scopedClassIds,
    limit + 1,
  ).all<CompetitionAudienceMemberRow>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = pageRows.map((row) => ({
    studentId: row.student_id,
    gradeLevelAtSnapshot: Number(row.grade_level_at_snapshot),
    classIdAtSnapshot: row.class_id_at_snapshot,
    studentStatusAtSnapshot: row.student_status_at_snapshot,
  }));
  const last = pageRows.at(-1);

  return {
    snapshotId: campaign.audience_snapshot_id,
    items,
    nextCursor: hasMore && last ? encodeAudienceCursor(last.student_id) : null,
  };
}
