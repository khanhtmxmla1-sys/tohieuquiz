import type { ImageLibraryItem, QuestionType } from '../../../types';
import type { SupportedSkillSubject } from '../../../shared/skillTaxonomy';
import type { PromptProfileOptions, QuizGenerationOptions } from '../../../services/geminiService';
import type { DifficultyLevels, QuizMode } from './quizCreation.types';
import {
    buildBalancedTypeAllocations,
    buildQuestionBlueprintSlots,
    validateQuizBlueprint,
    validateQuizBlueprintV3,
    type QuestionTypeAllocation,
    type QuizBlueprint,
    type QuizBlueprintV3,
    type QuizIntent,
    type QuizSourceMode,
} from './quizBlueprint';

interface BuildQuizGenerationOptionsInput {
    title: string;
    topic?: string;
    classLevel?: string;
    questionCount: number;
    questionTypes: QuestionType[];
    typeAllocations?: QuestionTypeAllocation[];
    difficultyLevels: DifficultyLevels;
    promptProfile: PromptProfileOptions;
    imageLibrary: ImageLibraryItem[];
    customPrompt: string;
    quizMode?: QuizMode;
    intent?: QuizIntent;
    sourceMode?: QuizSourceMode;
    isPdfMode?: boolean;
    subject?: SupportedSkillSubject;
    skillCode?: string;
    subskillCode?: string;
    sourceRefs?: string[];
}

interface BuildQuizGenerationOptionsConfig {
    enableBlueprintV3?: boolean;
}

export const buildPdfCustomPrompt = (customPrompt: string): string => `⛔ CHẾ ĐỘ TẠO ĐỀ TỪ PDF (OCR) - BẮT BUỘC TUÂN THỦ:
1. ĐỌC KỸ TOÀN BỘ NỘI DUNG OCR...
${customPrompt.trim() ? `\nYêu cầu thêm từ giáo viên: ${customPrompt.trim()}` : ''}`;

const resolveLegacyMode = (input: BuildQuizGenerationOptionsInput): QuizMode => (
    input.quizMode ?? (input.isPdfMode ? 'pdf' : 'practice')
);

const buildBlueprint = (input: BuildQuizGenerationOptionsInput): QuizBlueprint => {
    const legacyMode = resolveLegacyMode(input);
    const blueprint: QuizBlueprint = {
        intent: input.intent ?? (legacyMode === 'exam' ? 'EXAM' : 'PRACTICE'),
        sourceMode: input.sourceMode ?? (legacyMode === 'pdf' ? 'DOCUMENT' : 'TOPIC'),
        totalQuestions: input.questionCount,
        typeAllocations: input.typeAllocations
            ? input.typeAllocations.map((allocation) => ({ ...allocation }))
            : buildBalancedTypeAllocations(input.questionTypes, input.questionCount),
        difficultyLevels: { ...input.difficultyLevels },
    };
    const errors = validateQuizBlueprint(blueprint);
    if (errors.length > 0) throw new Error(errors.join(' '));
    return blueprint;
};

const pickRepresentativeItems = <T>(items: T[], count: number): T[] => {
    if (count >= items.length) return [...items];
    return Array.from({ length: count }, (_, index) => (
        items[Math.floor((index * items.length) / count)]
    ));
};

const summarizeTrialSlots = (slots: QuizBlueprintV3['slots']) => {
    const typeCounts = new Map<QuestionType, number>();
    const difficultyLevels = { level1: 0, level2: 0, level3: 0 };
    slots.forEach((slot) => {
        typeCounts.set(slot.type, (typeCounts.get(slot.type) ?? 0) + 1);
        difficultyLevels[`level${slot.difficulty}` as keyof typeof difficultyLevels] += 1;
    });
    return {
        typeAllocations: [...typeCounts].map(([type, count]) => ({ type, count })),
        difficultyLevels,
    };
};

export const buildTrialQuizGenerationOptions = (
    options: QuizGenerationOptions,
    requestedCount = 3,
): QuizGenerationOptions => {
    const fullCount = options.blueprintV3?.totalQuestions
        ?? options.blueprint?.totalQuestions
        ?? options.questionCount;
    const trialCount = Math.max(1, Math.min(requestedCount, fullCount));
    if (trialCount >= fullCount) return options;

    if (options.blueprintV3) {
        const slots = pickRepresentativeItems(options.blueprintV3.slots, trialCount)
            .map((slot, index) => ({
                ...slot,
                slotId: `slot-${index + 1}` as const,
                ordinal: index + 1,
            }));
        const summary = summarizeTrialSlots(slots);
        return {
            ...options,
            questionCount: trialCount,
            questionTypes: summary.typeAllocations.map(({ type }) => type),
            difficultyLevels: summary.difficultyLevels,
            blueprint: options.blueprint ? {
                ...options.blueprint,
                totalQuestions: trialCount,
                typeAllocations: summary.typeAllocations,
                difficultyLevels: summary.difficultyLevels,
            } : undefined,
            blueprintV3: {
                ...options.blueprintV3,
                totalQuestions: trialCount,
                slots,
            },
        };
    }

    if (options.blueprint) {
        const expandedTypes = options.blueprint.typeAllocations.flatMap(({ type, count }) => (
            Array.from({ length: count }, () => type)
        ));
        const selectedTypes = pickRepresentativeItems(expandedTypes, trialCount);
        const typeCounts = new Map<QuestionType, number>();
        selectedTypes.forEach((type) => typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1));
        const difficultySequence = [
            ...Array.from({ length: options.blueprint.difficultyLevels.level1 }, () => 1 as const),
            ...Array.from({ length: options.blueprint.difficultyLevels.level2 }, () => 2 as const),
            ...Array.from({ length: options.blueprint.difficultyLevels.level3 }, () => 3 as const),
        ];
        const selectedDifficulties = pickRepresentativeItems(difficultySequence, trialCount);
        const difficultyLevels = {
            level1: selectedDifficulties.filter((level) => level === 1).length,
            level2: selectedDifficulties.filter((level) => level === 2).length,
            level3: selectedDifficulties.filter((level) => level === 3).length,
        };
        const typeAllocations = [...typeCounts].map(([type, count]) => ({ type, count }));
        return {
            ...options,
            questionCount: trialCount,
            questionTypes: typeAllocations.map(({ type }) => type),
            difficultyLevels,
            blueprint: {
                ...options.blueprint,
                totalQuestions: trialCount,
                typeAllocations,
                difficultyLevels,
            },
        };
    }

    return {
        ...options,
        questionCount: trialCount,
    };
};

export const buildQuizGenerationOptions = (
    input: BuildQuizGenerationOptionsInput,
    config: BuildQuizGenerationOptionsConfig = {},
): QuizGenerationOptions => {
    const blueprint = buildBlueprint(input);
    const questionTypes = blueprint.typeAllocations
        .filter(({ count }) => count > 0)
        .map(({ type }) => type);

    let blueprintV3: QuizBlueprintV3 | undefined;
    if (config.enableBlueprintV3) {
        const topic = input.topic?.trim() || input.title.trim();
        const classLevel = input.classLevel?.trim() || '';
        if (!classLevel) {
            throw new Error('Cần có lớp học để tạo Blueprint V3.');
        }
        blueprintV3 = {
            version: 3,
            intent: blueprint.intent,
            sourceMode: blueprint.sourceMode,
            topic,
            classLevel,
            totalQuestions: blueprint.totalQuestions,
            slots: buildQuestionBlueprintSlots({
                totalQuestions: blueprint.totalQuestions,
                typeAllocations: blueprint.typeAllocations,
                difficultyLevels: blueprint.difficultyLevels,
                objective: input.skillCode?.trim() || topic,
                subject: input.subject,
                skillCode: input.skillCode,
                subskillCode: input.subskillCode,
                sourceRefs: input.sourceRefs,
            }),
        };
        const errors = validateQuizBlueprintV3(blueprintV3);
        if (errors.length > 0) throw new Error(errors.join(' '));
    }

    return {
        title: input.title,
        blueprint,
        blueprintV3,
        promptVersion: blueprintV3 ? 'ai-blueprint-v3' : undefined,
        questionCount: blueprint.totalQuestions,
        questionTypes,
        difficultyLevels: { ...blueprint.difficultyLevels },
        promptProfile: { ...input.promptProfile },
        imageLibrary: input.imageLibrary.map((image) => ({
            id: image.id,
            name: image.name,
            data: image.data,
        })),
        customPrompt: blueprint.sourceMode === 'DOCUMENT'
            ? buildPdfCustomPrompt(input.customPrompt)
            : input.customPrompt.trim() || undefined,
        isPdfMode: blueprint.sourceMode === 'DOCUMENT',
    };
};
