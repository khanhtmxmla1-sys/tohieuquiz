import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { normalizeQuestionRow, useQuizStore } from '../../../stores/quizStore';
import { useClassStore } from '../../stores/useClassStore';
import { getQuizEditorRoute, getTeacherRoute } from '../../app/navigationRoutes';
import ManualQuizWorkspaceGuard from './components/ManualQuizWorkspaceGuard';
import DraftRecoveryDialog from './components/DraftRecoveryDialog';
import DraftConflictDialog from './components/DraftConflictDialog';
import QuestionEditorPane, { type QuestionEditorPaneHandle } from './components/QuestionEditorPane';
import QuestionNavigator from './components/QuestionNavigator';
import StudentPreviewPane from './components/StudentPreviewPane';
import WorkspaceHeader from './components/WorkspaceHeader';
import WorkspaceStatusBar from './components/WorkspaceStatusBar';
import PublishValidationDrawer from './components/PublishValidationDrawer';
import PointDistributionDialog from './components/PointDistributionDialog';
import QuestionBankDrawer from './components/QuestionBankDrawer';
import QuizEditorAccessBanner from './components/QuizEditorAccessBanner';
import QuizSettingsDrawer from './components/QuizSettingsDrawer';
import {
    findLatestLocalDraft,
    removeLocalDraft,
} from './draft/manualQuizDraftRepository';
import { useManualQuizAutosave } from './hooks/useManualQuizAutosave';
import { useManualQuizPublish } from './hooks/useManualQuizPublish';
import { useWorkspaceKeyboardShortcuts } from './hooks/useWorkspaceKeyboardShortcuts';
import { useManualQuizWorkspaceStore } from './store/useManualQuizWorkspaceStore';
import { validateManualQuiz } from './validation/manualQuizValidation';
import { reportManualQuizTelemetry } from '../../services/telemetryService';
import { getRemoteManualQuizDraft } from '../../services/manualQuizDraftService';
import { createQuizVersion, getQuizEditorPayload } from './services/quizEditorService';
import { showConfirm } from '../../utils/toast';
import type {
    ManualQuizDraftEnvelope,
    ManualQuizNavigationState,
    ManualQuizSeed,
    ManualQuizQuestion,
    QuizEditorEditability,
} from './types/manualQuizWorkspace.types';

const QuestionImportDrawer = React.lazy(() => import('./components/QuestionImportDrawer'));

const DEFAULT_SEED: ManualQuizSeed = {
    title: 'Đề kiểm tra mới',
    classLevel: '3',
    category: 'toan',
    timeLimit: 15,
    tags: [],
    requireCode: false,
    showOnHome: true,
};

type WorkspaceView = 'overview' | 'edit' | 'preview';

type PendingEditorFocus = {
    questionId: string;
    field?: string;
    originElement: HTMLElement | null;
    activated: boolean;
};

const ManualQuizWorkspacePage: React.FC = () => {
    const { quizId } = useParams<{ quizId?: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const navigationState = location.state as ManualQuizNavigationState | null;
    const username = useAuthStore((state) => state.username);
    const isAdmin = useAuthStore((state) => state.isAdmin);
    const classes = useClassStore((state) => state.classes);
    const classesLoading = useClassStore((state) => state.isLoading);
    const classesError = useClassStore((state) => state.error);
    const fetchClasses = useClassStore((state) => state.fetchClasses);
    const availableQuiz = useQuizStore((state) =>
        quizId ? state.quizzes.find((quiz) => quiz.id === quizId) ?? null : null,
    );
    const loadQuizzes = useQuizStore((state) => state.loadQuizzes);
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const initializeFromSeed = useManualQuizWorkspaceStore((state) => state.initializeFromSeed);
    const initializeFromQuiz = useManualQuizWorkspaceStore((state) => state.initializeFromQuiz);
    const hydrateEnvelope = useManualQuizWorkspaceStore((state) => state.hydrateEnvelope);
    const selectQuestion = useManualQuizWorkspaceStore((state) => state.selectQuestion);
    const updateQuiz = useManualQuizWorkspaceStore((state) => state.updateQuiz);
    const setQuestionPoints = useManualQuizWorkspaceStore((state) => state.setQuestionPoints);
    const [pendingRecovery, setPendingRecovery] = useState<ManualQuizDraftEnvelope | null>(null);
    const [recoveryChecked, setRecoveryChecked] = useState(false);
    const [isValidationOpen, setValidationOpen] = useState(false);
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const [isPointDialogOpen, setPointDialogOpen] = useState(false);
    const [previousPoints, setPreviousPoints] = useState<Record<string, number> | null>(null);
    const [isQuestionBankOpen, setQuestionBankOpen] = useState(false);
    const [isQuestionImportOpen, setQuestionImportOpen] = useState(false);
    const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('overview');
    const [previewQuestion, setPreviewQuestion] = useState<ManualQuizQuestion | null>(null);
    const [lastEditedQuestionId, setLastEditedQuestionId] = useState<string | null>(null);
    const openedDraftRef = useRef<string | null>(null);
    const requestedDraftId = useMemo(() => new URLSearchParams(location.search).get('draftId'), [location.search]);
    const [remoteDraftStatus, setRemoteDraftStatus] = useState<'loading' | 'loaded' | 'error'>(
        requestedDraftId ? 'loading' : 'loaded',
    );
    const [remoteDraftError, setRemoteDraftError] = useState('');
    const [editability, setEditability] = useState<QuizEditorEditability | null>(null);
    const [editorAccessStatus, setEditorAccessStatus] = useState<'loading' | 'loaded' | 'error'>(
        quizId ? 'loading' : 'loaded',
    );
    const [editorAccessError, setEditorAccessError] = useState('');
    const [isCreatingVersion, setCreatingVersion] = useState(false);
    const questionEditorRef = useRef<QuestionEditorPaneHandle>(null);
    const pendingEditorFocusRef = useRef<PendingEditorFocus | null>(null);

    const seed = navigationState?.manualQuizSeed ?? DEFAULT_SEED;
    const isReadOnly = editability?.mode === 'READONLY';

    const autosaveController = useManualQuizAutosave(isReadOnly ? null : envelope);
    const guardTransition = useCallback((): boolean => {
        const flushResult = questionEditorRef.current?.flush();
        return !flushResult || flushResult.ok;
    }, []);
    const runGuarded = useCallback((action: () => void): boolean => {
        if (!guardTransition()) return false;
        action();
        return true;
    }, [guardTransition]);
    const saveDraft = useCallback(() => {
        if (!guardTransition()) return;
        autosaveController.saveNow();
    }, [autosaveController.saveNow, guardTransition]);
    const handlePublishSuccess = useCallback(() => {
        setValidationOpen(false);
        navigate(getTeacherRoute('manage'));
    }, [navigate]);
    const publishController = useManualQuizPublish({
        envelope,
        onSuccess: handlePublishSuccess,
    });
    const publishAfterGuard = useCallback(() => {
        // Let the synchronous store update from flush render before the
        // publish hook snapshots the envelope.
        window.setTimeout(() => {
            void publishController.publish();
        }, 0);
    }, [publishController.publish]);
    const validationIssues = useMemo(() => envelope
        ? validateManualQuiz(envelope.quiz, { targetPoints: envelope.targetPoints })
        : [], [envelope]);

    useEffect(() => {
        if (!isSettingsOpen || !username) return;
        void fetchClasses(isAdmin ? undefined : username);
    }, [fetchClasses, isAdmin, isSettingsOpen, username]);

    useEffect(() => {
        if (!quizId || !username) return;
        let active = true;
        setEditorAccessStatus('loading');
        setEditorAccessError('');

        void getQuizEditorPayload(quizId)
            .then((payload) => {
                if (!active) return;
                const editorQuiz = {
                    ...payload.quiz,
                    questions: payload.questions.map(normalizeQuestionRow),
                } as NonNullable<typeof availableQuiz>;
                useQuizStore.setState((state) => ({
                    quizzes: state.quizzes.some((quiz) => quiz.id === editorQuiz.id)
                        ? state.quizzes.map((quiz) => quiz.id === editorQuiz.id ? editorQuiz : quiz)
                        : [...state.quizzes, editorQuiz],
                    selectedQuiz: state.selectedQuiz?.id === editorQuiz.id ? editorQuiz : state.selectedQuiz,
                }));
                setEditability(payload.editability);
                setEditorAccessStatus('loaded');
            })
            .catch((error: unknown) => {
                if (!active) return;
                setEditorAccessError(error instanceof Error ? error.message : 'Không thể tải quyền chỉnh sửa đề.');
                setEditorAccessStatus('error');
            });

        return () => {
            active = false;
        };
    }, [quizId, username]);

    useEffect(() => {
        if (!envelope || openedDraftRef.current === envelope.draftId) return;
        openedDraftRef.current = envelope.draftId;
        reportManualQuizTelemetry('workspace_opened', {
            mode: envelope.quizId ? 'edit' : 'new',
            outcome: 'success',
            questionCount: envelope.quiz.questions.length,
            online: typeof navigator === 'undefined' ? true : navigator.onLine,
        });
    }, [envelope]);

    const openValidation = useCallback(() => {
        if (!guardTransition()) return;
        if (isReadOnly) return;
        const currentEnvelope = useManualQuizWorkspaceStore.getState().envelope;
        const currentIssues = currentEnvelope
            ? validateManualQuiz(currentEnvelope.quiz, { targetPoints: currentEnvelope.targetPoints })
            : [];
        const blockingCount = currentIssues.filter((issue) => issue.severity === 'error').length;
        if (currentEnvelope && blockingCount > 0) {
            reportManualQuizTelemetry('validation_failed', {
                mode: currentEnvelope.quizId ? 'edit' : 'new',
                outcome: 'blocked',
                questionCount: currentEnvelope.quiz.questions.length,
                issueCount: blockingCount,
                errorCode: 'VALIDATION_ERROR',
            });
        }
        setValidationOpen(true);
    }, [guardTransition, isReadOnly]);

    const closeActiveSurface = useCallback(() => {
        if (isSettingsOpen) setSettingsOpen(false);
        else if (isValidationOpen) setValidationOpen(false);
        else if (isPointDialogOpen) setPointDialogOpen(false);
        else if (isQuestionImportOpen) setQuestionImportOpen(false);
        else if (isQuestionBankOpen) setQuestionBankOpen(false);
        else if (workspaceView === 'preview') setWorkspaceView('edit');
    }, [
        isPointDialogOpen,
        isQuestionBankOpen,
        isQuestionImportOpen,
        isSettingsOpen,
        isValidationOpen,
        workspaceView,
    ]);

    useWorkspaceKeyboardShortcuts({
        enabled: Boolean(envelope) && !isReadOnly,
        onSaveDraft: saveDraft,
        onEscape: closeActiveSurface,
    });

    useEffect(() => {
        if (!username || !requestedDraftId || envelope || remoteDraftStatus !== 'loading') return;
        if (quizId && editorAccessStatus !== 'loaded') return;
        if (isReadOnly) {
            setRemoteDraftStatus('loaded');
            return;
        }
        const controller = new AbortController();
        setRemoteDraftError('');

        void getRemoteManualQuizDraft(requestedDraftId, controller.signal)
            .then((record) => {
                if (controller.signal.aborted) return;
                hydrateEnvelope({
                    ...(record.draft as ManualQuizDraftEnvelope),
                    draftId: record.id,
                    quizId: record.quizId,
                    ownerUsername: record.ownerUsername,
                    revision: record.revision,
                    updatedAt: record.updatedAt,
                });
                setRemoteDraftStatus('loaded');
                setRecoveryChecked(true);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setRemoteDraftError(error instanceof Error ? error.message : 'Không thể mở bản nháp đã chọn.');
                setRemoteDraftStatus('error');
            });

        return () => controller.abort();
    }, [editorAccessStatus, envelope, hydrateEnvelope, isReadOnly, quizId, remoteDraftStatus, requestedDraftId, username]);

    useEffect(() => {
        if (!username || envelope || pendingRecovery || recoveryChecked) return;
        if (quizId && editorAccessStatus !== 'loaded') return;
        if (requestedDraftId && remoteDraftStatus !== 'error') return;

        if (!isReadOnly) {
            const latestDraft = findLatestLocalDraft(username, quizId);
            const workspaceStartedAt = navigationState?.workspaceStartedAt;
            const isNewerThanCurrentEntry = latestDraft
                && (!workspaceStartedAt || latestDraft.updatedAt > workspaceStartedAt);

            if (latestDraft && isNewerThanCurrentEntry) {
                setPendingRecovery(latestDraft);
                setRecoveryChecked(true);
                return;
            }
        }

        setRecoveryChecked(true);
        if (availableQuiz) {
            initializeFromQuiz(availableQuiz, username);
        } else {
            initializeFromSeed(seed, username);
        }
    }, [
        availableQuiz,
        editorAccessStatus,
        envelope,
        initializeFromQuiz,
        initializeFromSeed,
        isReadOnly,
        navigationState?.workspaceStartedAt,
        pendingRecovery,
        quizId,
        recoveryChecked,
        remoteDraftStatus,
        requestedDraftId,
        seed,
        username,
    ]);

    const continueRecoveredDraft = () => {
        if (!pendingRecovery) return;
        hydrateEnvelope(pendingRecovery);
        setPendingRecovery(null);
    };

    const discardRecoveredDraft = () => {
        if (!pendingRecovery || !username) return;
        removeLocalDraft(username, pendingRecovery.draftId);
        setPendingRecovery(null);
        if (availableQuiz) {
            initializeFromQuiz(availableQuiz, username);
        } else {
            initializeFromSeed(seed, username);
        }
    };

    const focusQuestionEditor = useCallback((questionId: string, field?: string, skipGuard = false) => {
        if (!skipGuard && !guardTransition()) return;
        const originElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        pendingEditorFocusRef.current = { questionId, field, originElement, activated: false };
        setLastEditedQuestionId(questionId);
        selectQuestion(questionId);
        setWorkspaceView('edit');
        setValidationOpen(false);
    }, [guardTransition, selectQuestion]);

    useEffect(() => {
        const pending = pendingEditorFocusRef.current;
        if (!pending) return;
        if (workspaceView === 'edit' && pending.questionId === envelope?.selectedQuestionId) {
            pending.activated = true;
            const activeElement = document.activeElement;
            const focusWasMoved = activeElement instanceof HTMLElement
                && activeElement !== document.body
                && activeElement !== pending.originElement;
            if (focusWasMoved) {
                pendingEditorFocusRef.current = null;
                return;
            }
            const editor = document.querySelector<HTMLElement>('[aria-label="Trình soạn câu hỏi"]');
            const target = editor?.querySelector<HTMLElement>(pending.field === 'points'
                ? '[aria-label="Điểm câu hỏi"]'
                : '[data-testid="question-rich-editor"]');
            if (target) {
                target.focus();
                pendingEditorFocusRef.current = null;
            }
            return;
        }
        if (pending.activated) pendingEditorFocusRef.current = null;
    }, [envelope?.selectedQuestionId, workspaceView]);

    useEffect(() => () => {
        pendingEditorFocusRef.current = null;
    }, []);

    const handleQuestionEditorReady = useCallback(() => {
        const pending = pendingEditorFocusRef.current;
        if (!pending) return;
        const currentEnvelope = useManualQuizWorkspaceStore.getState().envelope;
        if (workspaceView !== 'edit' || currentEnvelope?.selectedQuestionId !== pending.questionId) {
            if (pending.activated) pendingEditorFocusRef.current = null;
            return;
        }
        pending.activated = true;

        const activeElement = document.activeElement;
        const focusWasMoved = activeElement instanceof HTMLElement
            && activeElement !== document.body
            && activeElement !== pending.originElement;
        if (focusWasMoved) {
            pendingEditorFocusRef.current = null;
            return;
        }

        const editor = document.querySelector<HTMLElement>('[aria-label="Trình soạn câu hỏi"]');
        const target = editor?.querySelector<HTMLElement>(pending.field === 'points'
            ? '[aria-label="Điểm câu hỏi"]'
            : '[data-testid="question-rich-editor"]');
        if (!target) return;
        target.focus();
        pendingEditorFocusRef.current = null;
    }, [workspaceView]);

    const goToQuestionIssue = (questionId: string, field?: string) => {
        focusQuestionEditor(questionId, field);
    };

    const applyPointDistribution = (pointsByQuestionId: Record<string, number>) => {
        if (!envelope) return;
        setPreviousPoints(Object.fromEntries(
            envelope.quiz.questions.map((question) => [question.id, Number(question.points || 0)]),
        ));
        setQuestionPoints(pointsByQuestionId);
        setPointDialogOpen(false);
    };

    const undoPointDistribution = () => {
        if (!previousPoints) return;
        setQuestionPoints(previousPoints);
        setPreviousPoints(null);
    };

    const selectedQuestion = envelope?.quiz.questions.find((question) => question.id === envelope.selectedQuestionId) ?? null;

    useEffect(() => {
        if (autosaveController.serverResolutionVersion === 0) return;
        const acceptedEnvelope = useManualQuizWorkspaceStore.getState().envelope;
        const acceptedQuestion = acceptedEnvelope?.quiz.questions.find(
            (question) => question.id === acceptedEnvelope.selectedQuestionId,
        ) ?? null;
        setPreviewQuestion(acceptedQuestion);
    }, [autosaveController.serverResolutionVersion]);

    const openQuestionEditor = useCallback((questionId: string) => {
        if (isReadOnly) {
            if (!guardTransition()) return;
            setLastEditedQuestionId(questionId);
            selectQuestion(questionId);
            const question = useManualQuizWorkspaceStore.getState().envelope?.quiz.questions.find((item) => item.id === questionId);
            if (question) setPreviewQuestion(question);
            setWorkspaceView('preview');
            return;
        }
        focusQuestionEditor(questionId);
    }, [focusQuestionEditor, guardTransition, isReadOnly, selectQuestion]);

    const handleQuestionAdded = useCallback((questionId: string) => {
        focusQuestionEditor(questionId, undefined, true);
    }, [focusQuestionEditor]);

    const handleBackToOverview = useCallback(() => {
        if (!guardTransition()) return;
        setWorkspaceView('overview');
    }, [guardTransition]);

    const handlePreview = useCallback((question: ManualQuizQuestion) => {
        if (!guardTransition()) return;
        setPreviewQuestion(question);
        setWorkspaceView('preview');
    }, [guardTransition]);

    const handleBackFromPreview = useCallback(() => {
        if (!guardTransition()) return;
        setWorkspaceView(isReadOnly ? 'overview' : 'edit');
    }, [guardTransition, isReadOnly]);

    const moveQuestion = useCallback((offset: -1 | 1) => {
        if (!guardTransition()) return;
        const currentEnvelope = useManualQuizWorkspaceStore.getState().envelope;
        const currentId = currentEnvelope?.selectedQuestionId;
        if (!currentEnvelope || !currentId) return;
        const index = currentEnvelope.quiz.questions.findIndex((question) => question.id === currentId);
        const next = currentEnvelope.quiz.questions[index + offset];
        if (!next) return;
        focusQuestionEditor(next.id, undefined, true);
    }, [focusQuestionEditor, guardTransition]);

    const finishQuestionEdit = useCallback(() => {
        if (!guardTransition()) return;
        setWorkspaceView('overview');
    }, [guardTransition]);

    const handleHeaderBack = useCallback(() => {
        if (workspaceView === 'preview' || workspaceView === 'edit') {
            handleBackToOverview();
            return;
        }
        if (!guardTransition()) return;
        navigate(-1);
    }, [guardTransition, handleBackToOverview, navigate, workspaceView]);

    useEffect(() => {
        if (workspaceView !== 'overview' || !lastEditedQuestionId) return;
        const timer = window.setTimeout(() => {
            const row = document.querySelector<HTMLElement>(`[data-question-id="${lastEditedQuestionId}"]`);
            if (row && typeof row.scrollIntoView === 'function') {
                row.scrollIntoView({ block: 'nearest' });
            }
            const semanticAction = row?.querySelector<HTMLElement>('button[aria-label^="Sửa câu"], button[aria-label^="Xem câu"]')
                ?? row?.querySelector<HTMLElement>('button[aria-label^="Chọn câu"]');
            semanticAction?.focus();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [lastEditedQuestionId, workspaceView]);

    const handleCreateVersion = useCallback(async () => {
        if (!quizId || isCreatingVersion) return;
        if (!guardTransition()) return;
        setCreatingVersion(true);
        setEditorAccessError('');
        try {
            const version = await createQuizVersion(
                quizId,
                `${envelope?.quiz.title || availableQuiz?.title || 'Đề kiểm tra'} - Bản chỉnh sửa`,
            );
            useManualQuizWorkspaceStore.getState().reset();
            navigate(getQuizEditorRoute(version.id), { replace: true });
            void loadQuizzes({ force: true }).catch(() => undefined);
        } catch (error: unknown) {
            setEditorAccessError(error instanceof Error ? error.message : 'Không thể tạo phiên bản mới.');
        } finally {
            setCreatingVersion(false);
        }
    }, [availableQuiz?.title, envelope?.quiz.title, guardTransition, isCreatingVersion, loadQuizzes, navigate, quizId]);

    const requestPublish = useCallback(() => {
        if (isReadOnly) return;
        if (!guardTransition()) return;
        if (editability?.requiresPublishedWarning) {
            showConfirm({
                message: 'Đề đã được giao cho học sinh. Những thay đổi sẽ áp dụng cho các lượt làm tiếp theo. Bạn có chắc muốn lưu?',
                confirmLabel: 'Lưu thay đổi',
                onConfirm: () => {
                    if (!guardTransition()) return;
                    publishAfterGuard();
                },
            });
            return;
        }
        publishAfterGuard();
    }, [editability?.requiresPublishedWarning, guardTransition, isReadOnly, publishAfterGuard]);

    const isOverviewView = workspaceView === 'overview';

    return (
        <ManualQuizWorkspaceGuard>
            <div
                data-testid="manual-quiz-workspace"
                data-mode={quizId ? 'edit' : 'new'}
                data-quiz-id={quizId || undefined}
                className="flex min-h-[100dvh] max-w-full flex-col overflow-x-clip overflow-y-visible bg-[#FFFDF7] font-['Be_Vietnam_Pro',sans-serif] text-[#172033] lg:h-[100dvh] lg:min-h-[640px] lg:overflow-x-hidden lg:overflow-y-hidden"
            >
                <h1 className="sr-only">{quizId ? 'Chỉnh sửa đề' : 'Tạo đề mới'} trong Trình soạn đề</h1>
                {(remoteDraftStatus === 'loading' || editorAccessStatus === 'loading') && (
                    <div role="status" className="absolute inset-0 z-50 grid place-items-center bg-white/90 px-4 text-center font-semibold text-slate-700">
                        {remoteDraftStatus === 'loading' ? 'Đang mở bản nháp đã chọn…' : 'Đang kiểm tra quyền chỉnh sửa đề…'}
                    </div>
                )}
                {remoteDraftError && (
                    <div role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                        Không thể mở bản nháp đã chọn: {remoteDraftError}. Hệ thống đã chuyển sang bản nháp cục bộ hoặc đề mới an toàn.
                    </div>
                )}
                {editorAccessStatus === 'error' && (
                    <div role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 lg:px-6">
                        Không thể mở Trình soạn đề: {editorAccessError}
                    </div>
                )}
                <WorkspaceHeader
                    onOpenValidation={openValidation}
                    onOpenSettings={() => { runGuarded(() => setSettingsOpen(true)); }}
                    onTogglePreview={() => {
                        if (!selectedQuestion) return;
                        const latestQuestion = questionEditorRef.current?.getPreviewQuestion() ?? selectedQuestion;
                        handlePreview(latestQuestion);
                    }}
                    onGoBack={handleHeaderBack}
                    canPreview={Boolean(selectedQuestion)}
                    readOnly={isReadOnly}
                />
                {editability && (
                    <QuizEditorAccessBanner
                        editability={editability}
                        onCreateVersion={() => void handleCreateVersion()}
                        isCreatingVersion={isCreatingVersion}
                        error={editorAccessError}
                    />
                )}
                <div className={`relative min-w-0 ${isOverviewView ? 'flex-none overflow-visible' : 'min-h-0 flex-1 overflow-hidden'} lg:min-h-0 lg:flex-1 lg:overflow-hidden`}>
                    <div
                        data-testid="workspace-view-overview"
                        aria-hidden={workspaceView !== 'overview'}
                        hidden={workspaceView !== 'overview'}
                        className={`min-h-0 min-w-0 ${workspaceView === 'overview' ? 'static flex' : 'hidden'} lg:absolute lg:inset-0`}
                    >
                        <QuestionNavigator
                            variant="overview"
                            onOpenQuestionBank={() => setQuestionBankOpen(true)}
                            onOpenImport={() => setQuestionImportOpen(true)}
                            onBeforeAction={guardTransition}
                            onEditQuestion={openQuestionEditor}
                            onQuestionAdded={handleQuestionAdded}
                            issues={validationIssues}
                            readOnly={isReadOnly}
                            teacherId={username || ''}
                        />
                    </div>
                    <div
                        data-testid="workspace-view-edit"
                        aria-hidden={workspaceView !== 'edit'}
                        hidden={workspaceView !== 'edit'}
                        className={`absolute inset-0 min-h-0 min-w-0 ${workspaceView === 'edit' ? 'flex' : 'hidden'}`}
                    >
                        <QuestionEditorPane
                            ref={questionEditorRef}
                            readOnly={isReadOnly}
                            persistLocalNow={autosaveController.persistLocalNow}
                            editorResetToken={autosaveController.serverResolutionVersion}
                            onEditorReady={handleQuestionEditorReady}
                            onBeforeAction={guardTransition}
                            currentQuestionIndex={selectedQuestion ? envelope?.quiz.questions.findIndex((question) => question.id === selectedQuestion.id) ?? 0 : 0}
                            totalQuestions={envelope?.quiz.questions.length ?? 0}
                            onBack={handleBackToOverview}
                            onPrevious={() => moveQuestion(-1)}
                            onNext={() => moveQuestion(1)}
                            onPreview={handlePreview}
                            onDone={finishQuestionEdit}
                            keyboardShortcutsEnabled={workspaceView === 'edit'}
                        />
                    </div>
                    <div
                        data-testid="workspace-view-preview"
                        aria-hidden={workspaceView !== 'preview'}
                        hidden={workspaceView !== 'preview'}
                        className={`absolute inset-0 min-h-0 min-w-0 ${workspaceView === 'preview' ? 'flex' : 'hidden'}`}
                    >
                        <StudentPreviewPane
                            question={previewQuestion ?? selectedQuestion}
                            questionIndex={selectedQuestion ? envelope?.quiz.questions.findIndex((item) => item.id === selectedQuestion.id) ?? 0 : 0}
                            onBack={handleBackFromPreview}
                            readOnly={isReadOnly}
                        />
                    </div>
                </div>
                <WorkspaceStatusBar onOpenValidation={openValidation} readOnly={isReadOnly} />
                {envelope && (
                    <PublishValidationDrawer
                        open={isValidationOpen}
                        issues={validationIssues}
                        quiz={envelope.quiz}
                        targetPoints={envelope.targetPoints}
                        onClose={() => setValidationOpen(false)}
                        onGoToQuestion={goToQuestionIssue}
                        onFixPoints={() => { runGuarded(() => setPointDialogOpen(true)); }}
                        onFixTime={() => {
                            runGuarded(() => {
                                setValidationOpen(false);
                                setSettingsOpen(true);
                            });
                        }}
                        onPublish={requestPublish}
                        isPublishing={publishController.isPublishing}
                        publishError={publishController.error}
                        cleanupWarning={publishController.cleanupWarning}
                        canUndoPoints={previousPoints !== null}
                        onUndoPoints={undoPointDistribution}
                    />
                )}
                {envelope && (
                    <QuizSettingsDrawer
                        open={isSettingsOpen}
                        classLevel={envelope.quiz.classLevel}
                        classOptions={classes}
                        classesLoading={classesLoading}
                        classesError={classesError}
                        timeLimit={envelope.quiz.timeLimit}
                        readOnly={isReadOnly}
                        onClose={() => setSettingsOpen(false)}
                        onApply={({ classLevel, timeLimit }) => {
                            if (isReadOnly) return;
                            updateQuiz({ classLevel, timeLimit });
                            setSettingsOpen(false);
                        }}
                    />
                )}
                {username && (
                    <QuestionBankDrawer
                        open={isQuestionBankOpen}
                        teacherId={username}
                        onClose={() => setQuestionBankOpen(false)}
                    />
                )}
                {isQuestionImportOpen && (
                    <React.Suspense fallback={<div role="status" className="fixed inset-0 z-50 grid place-items-center bg-white/80">Đang mở trình nhập…</div>}>
                        <QuestionImportDrawer open onClose={() => setQuestionImportOpen(false)} />
                    </React.Suspense>
                )}
                {envelope && isPointDialogOpen && (
                    <PointDistributionDialog
                        questions={envelope.quiz.questions}
                        targetPoints={envelope.targetPoints}
                        onClose={() => setPointDialogOpen(false)}
                        onApply={applyPointDistribution}
                    />
                )}
                {autosaveController.conflict && envelope && (
                    <DraftConflictDialog
                        localDraft={envelope}
                        serverRecord={autosaveController.conflict}
                        isResolving={autosaveController.isResolvingConflict}
                        onUseLocal={autosaveController.resolveWithLocal}
                        onUseServer={autosaveController.resolveWithServer}
                    />
                )}
                {pendingRecovery && (
                    <DraftRecoveryDialog
                        draft={pendingRecovery}
                        onContinue={continueRecoveredDraft}
                        onDiscard={discardRecoveredDraft}
                    />
                )}
            </div>
        </ManualQuizWorkspaceGuard>
    );
};

export default ManualQuizWorkspacePage;
