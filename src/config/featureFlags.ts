const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);

export const resolveFeatureFlag = (
    value: string | boolean | undefined,
    fallback: boolean,
): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) return true;
    if (FALSE_VALUES.has(normalized)) return false;
    return fallback;
};

/**
 * Defaults enabled to preserve existing authoring access. Production rollout and
 * rollback are controlled explicitly with VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1.
 */
export const isManualQuizWorkspaceEnabled = (): boolean => resolveFeatureFlag(
    import.meta.env.VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1,
    true,
);

/**
 * AI Quiz Generation V2 starts disabled so production can roll out gradually.
 * Set VITE_FEATURE_AI_QUIZ_V2=true for a controlled cohort or full release.
 */
export const isAiQuizV2Enabled = (): boolean => resolveFeatureFlag(
    import.meta.env.VITE_FEATURE_AI_QUIZ_V2,
    false,
);

/**
 * Per-question blueprint V3 rolls out independently and requires V2 to remain enabled.
 */
export const isAiBlueprintV3Enabled = (): boolean => resolveFeatureFlag(
    import.meta.env.VITE_FEATURE_AI_BLUEPRINT_V3,
    false,
);

export const isParentPortalEnabled = (): boolean => resolveFeatureFlag(
    import.meta.env.VITE_FEATURE_PARENT_PORTAL_V1,
    false,
);
