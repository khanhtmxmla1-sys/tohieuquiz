import { QuestionType } from '../../../types';
import type { LearnerPromptMode, PromptProfileOptions } from '../../../services/geminiService';
import type { DifficultyLevels, ExpandedSections } from './quizCreation.types';

export const MAX_OCR_CONTENT_LENGTH = 60000;
export const DEFAULT_TEACHER_DAILY_AI_LIMIT = 5;
export const DEFAULT_PROMPT_PROFILE: PromptProfileOptions = {
    useThongTu27: false,
    learnerMode: 'default',
};

export const createDefaultSelectedTypes = (): Record<string, boolean> => ({
    [QuestionType.MCQ]: true,
    [QuestionType.TRUE_FALSE]: true,
    [QuestionType.SHORT_ANSWER]: true,
    [QuestionType.MATCHING]: true,
});

export const createDefaultDifficultyLevels = (): DifficultyLevels => ({
    level1: 3,
    level2: 5,
    level3: 2,
});

export const createDefaultExpandedSections = (): ExpandedSections => ({
    basic: true,
    questionTypes: true,
    difficulty: true,
    pedagogy: true,
    content: false,
    advanced: false,
    assign: false,
});

export const createDefaultDeadline = (now = new Date()): string => {
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + 7);
    return deadline.toISOString().split('T')[0];
};

export const createRandomAccessCode = (random: () => number = Math.random): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let index = 0; index < 6; index += 1) {
        code += chars.charAt(Math.floor(random() * chars.length));
    }
    return code;
};

export const parseQuizTags = (rawTags: unknown): string[] => {
    const parsedTags: unknown[] = typeof rawTags === 'string'
        ? (() => {
            try {
                const parsed = rawTags ? JSON.parse(rawTags) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        })()
        : Array.isArray(rawTags)
            ? rawTags
            : [];

    return parsedTags
        .map((tag) => String(tag ?? '').replace(/^#/, '').trim())
        .filter(Boolean);
};

export const resolvePromptProfilePreset = (
    totalQuestions: number,
    profile: PromptProfileOptions,
): {
    levels: DifficultyLevels;
    presetLabel: 'thongtu27' | 'gifted' | 'remedial' | null;
} => {
    const safeTotal = Math.max(1, totalQuestions);
    let ratios = { level1: 0.3, level2: 0.5, level3: 0.2 };
    let presetLabel: 'thongtu27' | 'gifted' | 'remedial' | null = null;

    if (profile.useThongTu27 && profile.learnerMode === 'gifted') {
        ratios = { level1: 0.2, level2: 0.3, level3: 0.5 };
        presetLabel = 'gifted';
    } else if (profile.useThongTu27 && profile.learnerMode === 'remedial') {
        ratios = { level1: 0.65, level2: 0.25, level3: 0.1 };
        presetLabel = 'remedial';
    } else if (profile.useThongTu27) {
        ratios = { level1: 0.4, level2: 0.4, level3: 0.2 };
        presetLabel = 'thongtu27';
    }

    let level1 = Math.round(safeTotal * ratios.level1);
    let level2 = Math.round(safeTotal * ratios.level2);
    const level3 = Math.round(safeTotal * ratios.level3);

    const diff = safeTotal - (level1 + level2 + level3);
    if (diff !== 0) level2 += diff;

    if (level2 < 0) {
        level1 = Math.max(0, level1 + level2);
        level2 = 0;
    }

    return {
        levels: { level1, level2, level3 },
        presetLabel,
    };
};

export const getPromptProfileNotice = (
    presetLabel: 'thongtu27' | 'gifted' | 'remedial' | null,
): string | null => {
    if (presetLabel === 'gifted') {
        return 'Đã gợi ý lại độ khó theo định hướng bồi dưỡng học sinh giỏi. Bạn vẫn có thể chỉnh tay.';
    }
    if (presetLabel === 'remedial') {
        return 'Đã gợi ý lại độ khó theo định hướng phụ đạo học sinh cần hỗ trợ. Bạn vẫn có thể chỉnh tay.';
    }
    if (presetLabel === 'thongtu27') {
        return 'Đã gợi ý lại độ khó theo định hướng Thông tư 27. Bạn vẫn có thể chỉnh tay.';
    }
    return null;
};

export const createPromptProfile = (learnerMode: LearnerPromptMode): PromptProfileOptions => ({
    useThongTu27: true,
    learnerMode,
});
