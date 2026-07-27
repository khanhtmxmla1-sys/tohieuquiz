import { describe, expect, it } from 'vitest';
import { resolveReleaseId } from '../src/config/releaseId';

describe('resolveReleaseId', () => {
  it('prefers an explicit Vite release identifier', () => {
    expect(resolveReleaseId({
      explicitRelease: ' release-42 ',
      vercelCommitSha: 'vercel-sha',
      githubSha: 'github-sha',
    })).toBe('release-42');
  });

  it('falls back to the Vercel Git commit SHA', () => {
    expect(resolveReleaseId({ vercelCommitSha: '8b2c617' })).toBe('8b2c617');
  });

  it('uses the GitHub SHA outside Vercel and otherwise reports unknown', () => {
    expect(resolveReleaseId({ githubSha: 'ci-sha' })).toBe('ci-sha');
    expect(resolveReleaseId({})).toBe('unknown');
  });

  it('caps the public release identifier length', () => {
    expect(resolveReleaseId({ explicitRelease: 'x'.repeat(180) })).toHaveLength(100);
  });
});
