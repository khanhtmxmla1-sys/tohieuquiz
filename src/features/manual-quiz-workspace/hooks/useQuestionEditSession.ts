import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnyEditorDraft } from '../../quiz-editor/types/quiz-editor.types';
import { draftToQuestion, questionToDraft } from '../../quiz-editor/utils/questionDraftMapper';
import { normalizeQuestionMath } from '../../../utils/questionMath';
import { saveLocalDraft } from '../draft/manualQuizDraftRepository';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type {
    ManualQuizDraftEnvelope,
    ManualQuizQuestion,
} from '../types/manualQuizWorkspace.types';

export type QuestionEditSessionFlushResult =
    | { ok: true }
    | { ok: false; error: string };

export interface QuestionEditSessionOptions {
    persistLocalNow?: (envelope: ManualQuizDraftEnvelope) => void;
}

export interface QuestionEditSession {
    draft: AnyEditorDraft;
    dirty: boolean;
    error: string | null;
    onDraftChange: (updater: (draft: AnyEditorDraft) => AnyEditorDraft) => void;
    previewQuestion: ManualQuizQuestion;
    flush: () => QuestionEditSessionFlushResult;
}

const LOCAL_PERSISTENCE_ERROR = 'Không thể lưu bản nháp trên trình duyệt. Vui lòng thử lại.';

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) {
        return error.message.includes('trình duyệt')
            ? error.message
            : LOCAL_PERSISTENCE_ERROR;
    }
    return LOCAL_PERSISTENCE_ERROR;
};

const mergeDraftIntoQuestion = (
    draft: AnyEditorDraft,
    currentQuestion: ManualQuizQuestion,
): ManualQuizQuestion => {
    const normalizedQuestion = normalizeQuestionMath(draftToQuestion(draft, currentQuestion));
    return {
        ...currentQuestion,
        ...normalizedQuestion,
        // These fields can be edited outside the question form. Preserve their
        // freshest store values while a local editor draft is being flushed.
        points: currentQuestion.points,
        explanation: currentQuestion.explanation,
        imageAlt: normalizedQuestion.imageAlt ?? currentQuestion.imageAlt,
        showExplanation: currentQuestion.showExplanation,
    } as ManualQuizQuestion;
};

export const useQuestionEditSession = (
    question: ManualQuizQuestion,
    readOnly: boolean,
    options: QuestionEditSessionOptions = {},
): QuestionEditSession => {
    const { persistLocalNow } = options;
    const persistDraftLocally = persistLocalNow ?? saveLocalDraft;
    const [draft, setDraft] = useState<AnyEditorDraft>(() => questionToDraft(question));
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const draftRef = useRef<AnyEditorDraft>(draft);
    const dirtyRef = useRef(false);
    const questionIdRef = useRef(question.id);
    const syncTimerRef = useRef<number | null>(null);

    const clearSyncTimer = useCallback(() => {
        if (syncTimerRef.current !== null) {
            window.clearTimeout(syncTimerRef.current);
            syncTimerRef.current = null;
        }
    }, []);

    const getCurrentQuestion = useCallback((): ManualQuizQuestion | null => {
        const currentEnvelope = useManualQuizWorkspaceStore.getState().envelope;
        return currentEnvelope?.quiz.questions.find((item) => item.id === question.id) ?? null;
    }, [question.id]);

    const commitDraftToStore = useCallback((nextDraft: AnyEditorDraft): void => {
        const currentQuestion = getCurrentQuestion();
        if (!currentQuestion) {
            throw new Error('Không tìm thấy câu hỏi đang chỉnh sửa.');
        }

        const updatedQuestion = mergeDraftIntoQuestion(nextDraft, currentQuestion);
        useManualQuizWorkspaceStore.getState().updateQuestion(
            question.id,
            () => updatedQuestion,
        );
    }, [getCurrentQuestion, question.id]);

    const scheduleStoreSync = useCallback(() => {
        clearSyncTimer();
        syncTimerRef.current = window.setTimeout(() => {
            syncTimerRef.current = null;
            try {
                commitDraftToStore(draftRef.current);
            } catch (syncError) {
                setError(getErrorMessage(syncError));
            }
        }, 200);
    }, [clearSyncTimer, commitDraftToStore]);

    const onDraftChange = useCallback((updater: (current: AnyEditorDraft) => AnyEditorDraft) => {
        if (readOnly) return;
        const nextDraft = updater(draftRef.current);
        draftRef.current = nextDraft;
        dirtyRef.current = true;
        setDraft(nextDraft);
        setDirty(true);
        setError(null);
        scheduleStoreSync();
    }, [readOnly, scheduleStoreSync]);

    const flush = useCallback((): QuestionEditSessionFlushResult => {
        if (readOnly) return { ok: true };
        clearSyncTimer();

        try {
            if (dirtyRef.current) {
                commitDraftToStore(draftRef.current);
            }

            const latestEnvelope = useManualQuizWorkspaceStore.getState().envelope;
            if (!latestEnvelope) {
                throw new Error('Không tìm thấy bản nháp đang chỉnh sửa.');
            }
            // The injected controller is the normal path. The repository
            // fallback keeps the current editor safe before the page-level
            // autosave controller is wired to the focused editor.
            persistDraftLocally(latestEnvelope);
            dirtyRef.current = false;
            setDirty(false);
            setError(null);
            return { ok: true };
        } catch (flushError) {
            const message = getErrorMessage(flushError);
            dirtyRef.current = true;
            setDirty(true);
            setError(message);
            return { ok: false, error: message };
        }
    }, [clearSyncTimer, commitDraftToStore, persistDraftLocally, readOnly]);

    useEffect(() => {
        if (questionIdRef.current === question.id) return;
        questionIdRef.current = question.id;
        clearSyncTimer();
        const nextDraft = questionToDraft(question);
        draftRef.current = nextDraft;
        dirtyRef.current = false;
        setDraft(nextDraft);
        setDirty(false);
        setError(null);
    }, [clearSyncTimer, question]);

    useEffect(() => () => clearSyncTimer(), [clearSyncTimer]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!dirtyRef.current) return;
            event.preventDefault();
            // Required by browsers that only show the native confirmation
            // dialog when returnValue is assigned as well.
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const previewQuestion = useMemo(() => {
        const currentQuestion = getCurrentQuestion() ?? question;
        try {
            return mergeDraftIntoQuestion(draft, currentQuestion);
        } catch {
            return currentQuestion;
        }
    }, [draft, getCurrentQuestion, question]);

    return {
        draft,
        dirty,
        error,
        onDraftChange,
        previewQuestion,
        flush,
    };
};
