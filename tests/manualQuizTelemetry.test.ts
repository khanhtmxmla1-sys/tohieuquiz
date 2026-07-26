import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@vercel/analytics', () => ({ track: analyticsMocks.track }));

import {
    buildManualQuizTelemetryPayload,
    reportManualQuizTelemetry,
} from '../src/services/telemetryService';
import {
    isAiBlueprintV3Enabled,
    isAiQuizV2Enabled,
    isManualQuizWorkspaceEnabled,
    resolveFeatureFlag,
} from '../src/config/featureFlags';

describe('manual quiz telemetry privacy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps only aggregate allow-listed fields and strips question content or answers', () => {
        const payload = buildManualQuizTelemetryPayload({
            mode: 'edit',
            saveTarget: 'remote',
            outcome: 'failure',
            durationMs: 145.8,
            questionCount: 12,
            issueCount: 3,
            online: true,
            errorCode: 'HTTP 503: đề Toán của cô An',
            question: 'Nội dung bí mật',
            answers: ['A', 'B'],
            quizTitle: 'Kiểm tra giữa kỳ',
            teacherUsername: 'teacher-a',
        } as any);

        expect(payload).toEqual({
            mode: 'edit',
            saveTarget: 'remote',
            outcome: 'failure',
            durationMs: 146,
            questionCount: 12,
            issueCount: 3,
            online: true,
            errorCode: 'HTTP_503',
        });
        expect(JSON.stringify(payload)).not.toContain('Nội dung');
        expect(JSON.stringify(payload)).not.toContain('Kiểm tra');
        expect(JSON.stringify(payload)).not.toContain('teacher-a');
    });

    it('tracks a namespaced event with the privacy-safe payload', () => {
        reportManualQuizTelemetry('publish_succeeded', {
            mode: 'new',
            durationMs: 200,
            questionCount: 5,
            outcome: 'success',
            question: 'must be removed',
        } as any);

        expect(analyticsMocks.track).toHaveBeenCalledWith('manual_quiz_publish_succeeded', {
            mode: 'new',
            durationMs: 200,
            questionCount: 5,
            outcome: 'success',
        });
    });
});

describe('AI quiz V2 feature flag', () => {
    it('defaults off and accepts all supported truthy values', () => {
        vi.unstubAllEnvs();
        expect(isAiQuizV2Enabled()).toBe(false);
        for (const value of ['1', 'true', 'yes', 'on', 'enabled']) {
            vi.stubEnv('VITE_FEATURE_AI_QUIZ_V2', value);
            expect(isAiQuizV2Enabled(), value).toBe(true);
        }
        vi.stubEnv('VITE_FEATURE_AI_QUIZ_V2', 'false');
        expect(isAiQuizV2Enabled()).toBe(false);
        vi.unstubAllEnvs();
    });
});

describe('AI blueprint V3 feature flag', () => {
    it('defaults off and accepts all supported truthy values', () => {
        vi.unstubAllEnvs();
        expect(isAiBlueprintV3Enabled()).toBe(false);
        for (const value of ['1', 'true', 'yes', 'on', 'enabled']) {
            vi.stubEnv('VITE_FEATURE_AI_BLUEPRINT_V3', value);
            expect(isAiBlueprintV3Enabled(), value).toBe(true);
        }
        vi.stubEnv('VITE_FEATURE_AI_BLUEPRINT_V3', 'false');
        expect(isAiBlueprintV3Enabled()).toBe(false);
        vi.unstubAllEnvs();
    });
});

describe('manual quiz feature flag', () => {
    it('defaults on for backward compatibility but supports explicit rollback', () => {
        expect(resolveFeatureFlag(undefined, true)).toBe(true);
        expect(resolveFeatureFlag('true', false)).toBe(true);
        expect(resolveFeatureFlag('1', false)).toBe(true);
        expect(resolveFeatureFlag('false', true)).toBe(false);
        expect(resolveFeatureFlag('0', true)).toBe(false);
    });

    it('reads the Vite rollout flag at call time', () => {
        vi.stubEnv('VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1', 'false');
        expect(isManualQuizWorkspaceEnabled()).toBe(false);
        vi.stubEnv('VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1', 'true');
        expect(isManualQuizWorkspaceEnabled()).toBe(true);
        vi.unstubAllEnvs();
    });
});
