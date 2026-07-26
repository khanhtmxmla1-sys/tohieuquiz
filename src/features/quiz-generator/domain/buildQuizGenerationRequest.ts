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
