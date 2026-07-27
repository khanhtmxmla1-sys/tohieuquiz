export interface ReleaseIdSources {
  explicitRelease?: string;
  vercelCommitSha?: string;
  githubSha?: string;
}

const RELEASE_ID_LIMIT = 100;

export const resolveReleaseId = ({
  explicitRelease,
  vercelCommitSha,
  githubSha,
}: ReleaseIdSources): string => {
  const candidate = explicitRelease?.trim()
    || vercelCommitSha?.trim()
    || githubSha?.trim()
    || 'unknown';

  return candidate.slice(0, RELEASE_ID_LIMIT);
};
