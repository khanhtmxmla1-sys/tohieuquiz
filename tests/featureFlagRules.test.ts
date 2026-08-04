import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagConfig } from '../shared/feature-rollout.contract';
import { resolveFeatureFlag, stableFeatureBucket } from '../workers/src/services/featureFlagService';
import {
  isAiSvgDiagramsEnabled,
  isQuizProgressV2Enabled,
} from '../src/config/featureFlags';

const config = (overrides: Partial<FeatureFlagConfig> = {}): FeatureFlagConfig => ({
  key: 'unified_notifications_v1',
  description: 'Unified notifications',
  enabled: true,
  audience: 'teacher',
  percentage: 5,
  allowUsers: [],
  allowClasses: [],
  startsAt: null,
  endsAt: null,
  owner: 'platform',
  reason: 'pilot',
  stopConditions: {
    max5xxRatePercent: 1,
    maxClientErrorMultiplier: 2,
    maxP95IncreasePercent: 30,
  },
  version: 1,
  updatedBy: 'admin',
  updatedAt: '2026-07-29T00:00:00.000Z',
  ...overrides,
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('frontend AI SVG diagram flag', () => {
  it('defaults disabled and respects explicit environment values', () => {
    vi.stubEnv('VITE_FEATURE_AI_SVG_DIAGRAMS', '');
    expect(isAiSvgDiagramsEnabled()).toBe(false);
    vi.stubEnv('VITE_FEATURE_AI_SVG_DIAGRAMS', 'true');
    expect(isAiSvgDiagramsEnabled()).toBe(true);
    vi.stubEnv('VITE_FEATURE_AI_SVG_DIAGRAMS', 'false');
    expect(isAiSvgDiagramsEnabled()).toBe(false);
  });
});

describe('frontend quiz progress flag', () => {
  it('defaults enabled after production rollout approval', () => {
    vi.stubEnv('VITE_FEATURE_QUIZ_PROGRESS_V2', '');
    expect(isQuizProgressV2Enabled()).toBe(true);
  });

  it('enables and disables from explicit environment values', () => {
    vi.stubEnv('VITE_FEATURE_QUIZ_PROGRESS_V2', 'true');
    expect(isQuizProgressV2Enabled()).toBe(true);
    vi.stubEnv('VITE_FEATURE_QUIZ_PROGRESS_V2', 'false');
    expect(isQuizProgressV2Enabled()).toBe(false);
  });
});

describe('runtime feature rollout rules', () => {
  it('uses a stable user+flag bucket instead of random selection', async () => {
    const first = await stableFeatureBucket('flag-a', 'teacher-a');
    const second = await stableFeatureBucket('flag-a', 'teacher-a');
    const other = await stableFeatureBucket('flag-a', 'teacher-b');
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(100);
    expect(other).not.toBe(first);
  });

  it('allows an explicit user or class before percentage selection', async () => {
    await expect(resolveFeatureFlag(config({ allowUsers: ['teacher-a'], percentage: 0 }), {
      role: 'teacher', username: 'teacher-a',
    })).resolves.toMatchObject({ enabled: true, reason: 'allowlist' });
    await expect(resolveFeatureFlag(config({ allowClasses: ['class-4a'], percentage: 0 }), {
      role: 'student', username: 'student-a', classIds: ['class-4a'],
    })).resolves.toMatchObject({ enabled: true, reason: 'allowlist' });
  });

  it('enforces audience and active time window', async () => {
    await expect(resolveFeatureFlag(config(), { role: 'student', username: 'student-a' }))
      .resolves.toMatchObject({ enabled: false, reason: 'audience' });
    await expect(resolveFeatureFlag(config({ startsAt: '2026-08-01T00:00:00.000Z' }), {
      role: 'teacher', username: 'teacher-a',
    }, new Date('2026-07-29T00:00:00.000Z'))).resolves.toMatchObject({
      enabled: false,
      reason: 'outside_window',
    });
  });

  it('fails closed when the flag is globally disabled', async () => {
    await expect(resolveFeatureFlag(config({ enabled: false, allowUsers: ['teacher-a'] }), {
      role: 'teacher', username: 'teacher-a',
    })).resolves.toMatchObject({ enabled: false, reason: 'disabled' });
  });
});
