import type { FeatureFlagSubject } from '../../../shared/feature-rollout.contract';
import { getFeatureFlag, resolveFeatureFlag } from '../services/featureFlagService';

export const COMPETITION_PORTAL_FLAGS = {
  publicRead: 'competition_public_portal_read_v1',
  studentPortal: 'competition_student_portal_v1',
  legacyRedirect: 'competition_legacy_redirect_v1',
  goldenBoard: 'competition_golden_board_v1',
  publicContentAdmin: 'competition_public_content_admin_v1',
} as const;

export const COMPETITION_PORTAL_FEATURE_DISABLED = 'COMPETITION_PORTAL_FEATURE_DISABLED';

type CompetitionPortalFlag = typeof COMPETITION_PORTAL_FLAGS[keyof typeof COMPETITION_PORTAL_FLAGS];

async function isEnabled(
  db: D1Database,
  key: CompetitionPortalFlag,
  subject: FeatureFlagSubject,
): Promise<boolean> {
  try {
    const config = await getFeatureFlag(db, key);
    if (!config) return false;
    return (await resolveFeatureFlag(config, subject)).enabled;
  } catch {
    return false;
  }
}

export const isCompetitionPublicPortalReadEnabled = (db: D1Database): Promise<boolean> =>
  isEnabled(db, COMPETITION_PORTAL_FLAGS.publicRead, { role: 'public' });

export const isCompetitionGoldenBoardEnabled = (db: D1Database): Promise<boolean> =>
  isEnabled(db, COMPETITION_PORTAL_FLAGS.goldenBoard, { role: 'public' });

export const isCompetitionStudentPortalEnabled = (
  db: D1Database,
  username: string,
): Promise<boolean> => isEnabled(db, COMPETITION_PORTAL_FLAGS.studentPortal, {
  role: 'student',
  username,
});

export const isCompetitionPublicContentAdminEnabled = (
  db: D1Database,
  subject: FeatureFlagSubject,
): Promise<boolean> => isEnabled(db, COMPETITION_PORTAL_FLAGS.publicContentAdmin, subject);

export const isCompetitionLegacyRedirectEnabled = (
  db: D1Database,
  subject: FeatureFlagSubject,
): Promise<boolean> => isEnabled(db, COMPETITION_PORTAL_FLAGS.legacyRedirect, subject);
