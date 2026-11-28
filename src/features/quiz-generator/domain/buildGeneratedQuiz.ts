import type { Quiz, Question } from '../../../types';
import type { QuizGenerationFormSnapshot } from './quizCreation.types';

export interface BuildGeneratedQuizContext {
    editingQuiz: Quiz | null;
    teacherName: string | null;
    aiBlueprintV3Enabled: boolean;
    form: Pick<QuizGenerationFormSnapshot,
        'classLevel' | 'manualTimeLimit' | 'requireCode' | 'accessCode'
        | 'showOnHome' | 'category' | 'tags'>;
}

export function buildGeneratedQuiz(
    result: Record<string, unknown>,
    optionsTitle: string,
    detectedCategory: string | null,
    detectedLesson: string,
    suggestedTags: string[],
    generationKind: 'full' | 'trial',
    context: BuildGeneratedQuizContext,
): Quiz {
    const {
        editingQuiz,
        teacherName,
        aiBlueprintV3Enabled,
        form,
    } = context;

    return {
        id: editingQuiz?.id || `quiz-${Date.now()}`,
        title: (result.title as string) || optionsTitle,
        classLevel: form.classLevel,
        timeLimit: typeof form.manualTimeLimit === 'number'
            ? form.manualTimeLimit
            : (result.timeLimit as number) || 15,
        questions: ((result.questions || []) as Question[]).map(
            (question: Question, index: number) => ({
                ...question,
                id: question.id || `q-${Date.now()}-${index}`,
            }),
        ),
        createdAt: editingQuiz ? editingQuiz.createdAt : new Date().toISOString(),
        createdBy: editingQuiz?.createdBy || teacherName || undefined,
        accessCode: form.requireCode ? form.accessCode.toUpperCase() : undefined,
        requireCode: form.requireCode,
        showOnHome: form.showOnHome,
        category: form.category,
        tags: form.tags,
        detectedCategory: detectedCategory || undefined,
        detectedLesson: detectedLesson || undefined,
        suggestedTags: suggestedTags.length > 0 ? suggestedTags : undefined,
        aiGeneration: {
            promptVersion: typeof result.promptVersion === 'string'
                ? result.promptVersion
                : (aiBlueprintV3Enabled ? 'ai-blueprint-v3' : 'ai-quiz-v2'),
            blueprintVersion: typeof result.blueprintVersion === 'number'
                ? result.blueprintVersion
                : (aiBlueprintV3Enabled ? 3 : undefined),
            generationKind,
        },
    };
}
