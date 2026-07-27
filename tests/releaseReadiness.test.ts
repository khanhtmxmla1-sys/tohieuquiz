import { describe, expect, it } from 'vitest';
import {
  findDestructiveSql,
  validateReleaseFlags,
  validateBundleEntries,
  runReleaseReadiness,
} from '../scripts/release-readiness.mjs';

describe('release readiness checks', () => {
  it('flags destructive migration statements but permits additive schema changes', () => {
    expect(findDestructiveSql('ALTER TABLE results ADD COLUMN assignment_id TEXT;')).toEqual([]);
    expect(findDestructiveSql('DROP TABLE results; DELETE FROM students; ALTER TABLE quizzes DROP COLUMN owner;'))
      .toEqual(['DROP TABLE', 'DELETE WITHOUT WHERE', 'DROP COLUMN']);
  });

  it('requires known flags and boolean rollout values', () => {
    expect(validateReleaseFlags({
      VITE_FEATURE_GIFT_SHOP_V2: 'false',
      VITE_FEATURE_AI_QUIZ_V2: 'false',
      VITE_FEATURE_AI_BLUEPRINT_V3: 'false',
      VITE_FEATURE_PARENT_PORTAL_V1: 'false',
      VITE_GIFT_SHOP_MODE: 'api',
    })).toEqual([]);
    expect(validateReleaseFlags({
      VITE_FEATURE_GIFT_SHOP_V2: 'maybe',
      VITE_FEATURE_UNKNOWN: 'true',
    })).toEqual(expect.arrayContaining([
      expect.stringContaining('VITE_FEATURE_GIFT_SHOP_V2'),
      expect.stringContaining('VITE_FEATURE_UNKNOWN'),
    ]));
  });

  it('accepts inline and split base-ref arguments through the executable entry point', () => {
    const originalLog = console.log;
    console.log = () => undefined;
    try {
      expect(runReleaseReadiness([
        '--base=HEAD',
        '--dist',
        'tests/fixtures/missing-release-dist',
      ], {
        VITE_FEATURE_GIFT_SHOP_V2: 'false',
        VITE_FEATURE_AI_QUIZ_V2: 'false',
        VITE_FEATURE_AI_BLUEPRINT_V3: 'false',
        VITE_FEATURE_PARENT_PORTAL_V1: 'false',
        VITE_GIFT_SHOP_MODE: 'api',
      })).toBe(1);
    } finally {
      console.log = originalLog;
    }
  });

  it('rejects JavaScript chunks above the release limit', () => {
    expect(validateBundleEntries([
      { name: 'index.js', size: 200_000 },
      { name: 'docx.js', size: 520_000 },
    ], 550_000)).toEqual([]);
    expect(validateBundleEntries([{ name: 'oversized.js', size: 700_000 }], 550_000))
      .toEqual(['oversized.js is 700000 bytes (limit 550000)']);
  });
});
