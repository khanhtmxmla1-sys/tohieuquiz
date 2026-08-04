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

/**
 * AI-generated SVG diagrams are opt-in and disabled by default in production.
 * Local/test environments can enable VITE_FEATURE_AI_SVG_DIAGRAMS=true.
 */
export const isAiSvgDiagramsEnabled = (): boolean => resolveFeatureFlag(
    import.meta.env.VITE_FEATURE_AI_SVG_DIAGRAMS,
    false,
);

export const isParentPortalEnabled = (): boolean => resolveFeatureFlag(
    import.meta.env.VITE_FEATURE_PARENT_PORTAL_V1,
    false,
);

/**
 * Quiz Progress V2 is enabled by default after the production shadow rollout.
 * Set VITE_FEATURE_QUIZ_PROGRESS_V2=false to roll the UI back to the legacy rule.
 */
export const isQuizProgressV2Enabled = (): boolean => resolveFeatureFlag(
    import.meta.env.VITE_FEATURE_QUIZ_PROGRESS_V2,
    true,
);
