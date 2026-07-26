import type { ManualQuizSeed } from '../types/manualQuizWorkspace.types';

interface ManualQuizSeedInput {
    quizTitle: string;
    classLevel: string;
    category: string;
    manualTimeLimit: number | '';
    tags: string[];
    requireCode: boolean;
    accessCode: string;
    showOnHome: boolean;
}

export const buildManualQuizSeed = (input: ManualQuizSeedInput): ManualQuizSeed => ({
    title: input.quizTitle.trim() || 'Đề kiểm tra mới',
    classLevel: input.classLevel.trim() || '3',
    category: input.category.trim() || 'toan',
    timeLimit: typeof input.manualTimeLimit === 'number' && input.manualTimeLimit > 0
        ? input.manualTimeLimit
        : 15,
    tags: [...input.tags],
    requireCode: input.requireCode,
    accessCode: input.requireCode && input.accessCode.trim()
        ? input.accessCode.trim().toUpperCase()
        : undefined,
    showOnHome: input.showOnHome,
});
