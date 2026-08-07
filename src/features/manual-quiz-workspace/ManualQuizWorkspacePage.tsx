import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { normalizeQuestionRow, useQuizStore } from '../../../stores/quizStore';
import { useClassStore } from '../../stores/useClassStore';
import { getQuizEditorRoute, getTeacherRoute } from '../../app/navigationRoutes';
import ManualQuizWorkspaceGuard from './components/ManualQuizWorkspaceGuard';
import DraftRecoveryDialog from './components/DraftRecoveryDialog';
import DraftConflictDialog from './components/DraftConflictDialog';
import QuestionEditorPane from './components/QuestionEditorPane';
import QuestionNavigator from './components/QuestionNavigator';
import StudentPreviewPane from './components/StudentPreviewPane';
import WorkspaceHeader from './components/WorkspaceHeader';
import WorkspaceStatusBar from './components/WorkspaceStatusBar';
import PublishValidationDrawer from './components/PublishValidationDrawer';
import PointDistributionDialog from './components/PointDistributionDialog';
import QuestionBankDrawer from './components/QuestionBankDrawer';
import WorkspaceMobileTabs, { type WorkspaceMobilePane } from './components/WorkspaceMobileTabs';
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
    const setNavigatorCollapsed = useManualQuizWorkspaceStore((state) => state.setNavigatorCollapsed);
    const setPreviewCollapsed = useManualQuizWorkspaceStore((state) => state.setPreviewCollapsed);
    const isNavigatorCollapsed = useManualQuizWorkspaceStore((state) => state.isNavigatorCollapsed);
    const isPreviewCollapsed = useManualQuizWorkspaceStore((state) => state.isPreviewCollapsed);
    const [pendingRecovery, setPendingRecovery] = useState<ManualQuizDraftEnvelope | null>(null);
    const [recoveryChecked, setRecoveryChecked] = useState(false);
    const [isValidationOpen, setValidationOpen] = useState(false);
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const [isPointDialogOpen, setPointDialogOpen] = useState(false);
    const [previousPoints, setPreviousPoints] = useState<Record<string, number> | null>(null);
    const [isQuestionBankOpen, setQuestionBankOpen] = useState(false);
    const [isQuestionImportOpen, setQuestionImportOpen] = useState(false);
    const [mobilePane, setMobilePane] = useState<WorkspaceMobilePane>('editor');
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

    const seed = navigationState?.manualQuizSeed ?? DEFAULT_SEED;
    const isReadOnly = editability?.mode === 'READONLY';

    const autosaveController = useManualQuizAutosave(isReadOnly ? null : envelope);
    const handlePublishSuccess = useCallback(() => {
        setValidationOpen(false);
        navigate(getTeacherRoute('manage'));
    }, [navigate]);
    const publishController = useManualQuizPublish({
        envelope,
        onSuccess: handlePublishSuccess,
    });
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
        if (isReadOnly) return;
        const blockingCount = validationIssues.filter((issue) => issue.severity === 'error').length;
        if (envelope && blockingCount > 0) {
            reportManualQuizTelemetry('validation_failed', {
                mode: envelope.quizId ? 'edit' : 'new',
                outcome: 'blocked',
                questionCount: envelope.quiz.questions.length,
                issueCount: blockingCount,
                errorCode: 'VALIDATION_ERROR',
            });
        }
        setValidationOpen(true);
    }, [envelope, isReadOnly, validationIssues]);

    const closeActiveSurface = useCallback(() => {
        if (isSettingsOpen) setSettingsOpen(false);
        else if (isValidationOpen) setValidationOpen(false);
        else if (isPointDialogOpen) setPointDialogOpen(false);
        else if (isQuestionImportOpen) setQuestionImportOpen(false);
        else if (isQuestionBankOpen) setQuestionBankOpen(false);
        else if (!isPreviewCollapsed) setPreviewCollapsed(true);
    }, [
        isPointDialogOpen,
        isPreviewCollapsed,
        isQuestionBankOpen,
        isQuestionImportOpen,
        isSettingsOpen,
        isValidationOpen,
        setPreviewCollapsed,
    ]);

    useWorkspaceKeyboardShortcuts({
        enabled: Boolean(envelope) && !isReadOnly,
        onSaveDraft: autosaveController.saveNow,
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

    const goToQuestionIssue = (questionId: string, field?: string) => {
        selectQuestion(questionId);
        setNavigatorCollapsed(false);
        setValidationOpen(false);
        window.setTimeout(() => {
            const editor = document.querySelector<HTMLElement>('[aria-label="Trình soạn câu hỏi"]');
            const fieldSelector = field === 'points'
                ? '[aria-label="Điểm câu hỏi"]'
                : 'textarea, input:not([type="number"])';
            editor?.querySelector<HTMLElement>(fieldSelector)?.focus();
        }, 0);
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

    const desktopColumnClass = isNavigatorCollapsed
        ? isPreviewCollapsed
            ? 'xl:grid-cols-[minmax(0,1fr)]'
            : 'xl:grid-cols-[minmax(0,1fr)_380px]'
        : isPreviewCollapsed
            ? 'xl:grid-cols-[280px_minmax(0,1fr)]'
            : 'xl:grid-cols-[280px_minmax(0,1fr)_380px]';
    const tabletColumnClass = isNavigatorCollapsed
        ? 'md:grid-cols-[minmax(0,1fr)]'
        : 'md:grid-cols-[280px_minmax(0,1fr)]';

    const changeMobilePane = (pane: WorkspaceMobilePane) => {
        setMobilePane(pane);
        if (pane === 'list') setNavigatorCollapsed(false);
        if (pane === 'preview') useManualQuizWorkspaceStore.getState().setPreviewCollapsed(false);
    };

    const handleCreateVersion = useCallback(async () => {
        if (!quizId || isCreatingVersion) return;
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
    }, [availableQuiz?.title, envelope?.quiz.title, isCreatingVersion, loadQuizzes, navigate, quizId]);

    const requestPublish = useCallback(() => {
        if (isReadOnly) return;
        if (editability?.requiresPublishedWarning) {
            showConfirm({
                message: 'Đề đã được giao cho học sinh. Những thay đổi sẽ áp dụng cho các lượt làm tiếp theo. Bạn có chắc muốn lưu?',
                confirmLabel: 'Lưu thay đổi',
                onConfirm: () => void publishController.publish(),
            });
            return;
        }
        void publishController.publish();
    }, [editability?.requiresPublishedWarning, isReadOnly, publishController]);

    return (
        <ManualQuizWorkspaceGuard>
            <div
                data-testid="manual-quiz-workspace"
                data-mode={quizId ? 'edit' : 'new'}
                data-quiz-id={quizId || undefined}
                className="flex h-[100dvh] min-h-[640px] max-w-full flex-col overflow-x-hidden overflow-y-hidden bg-[#FFFDF7] font-['Be_Vietnam_Pro',sans-serif] text-[#172033]"
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
                    onOpenSettings={() => setSettingsOpen(true)}
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
                <div
                    data-testid="workspace-grid"
                    data-mobile-pane={mobilePane}
                    aria-disabled={isReadOnly || undefined}
                    className={`relative grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden ${tabletColumnClass} ${desktopColumnClass} ${isReadOnly ? 'pointer-events-none select-none opacity-80' : ''}`}
                >
                    {!isNavigatorCollapsed && (
                        <div
                            id="workspace-pane-list"
                            data-testid="workspace-pane-list"
                            data-mobile-visible={mobilePane === 'list'}
                            className={`h-full min-h-0 min-w-0 overflow-hidden ${mobilePane === 'list' ? 'block' : 'hidden'} md:block`}
                        >
                            <QuestionNavigator
                                onOpenQuestionBank={() => setQuestionBankOpen(true)}
                                onOpenImport={() => setQuestionImportOpen(true)}
                                teacherId={username || ''}
                            />
                        </div>
                    )}
                    <div
                        id="workspace-pane-editor"
                        data-testid="workspace-pane-editor"
                        data-mobile-visible={mobilePane === 'editor'}
                        className={`min-h-0 min-w-0 overflow-hidden ${mobilePane === 'editor' ? 'block' : 'hidden'} md:block`}
                    >
                        <QuestionEditorPane />
                    </div>
                    {!isPreviewCollapsed && (
                        <div
                            id="workspace-pane-preview"
                            data-testid="workspace-pane-preview"
                            data-mobile-visible={mobilePane === 'preview'}
                            className={`min-h-0 min-w-0 overflow-hidden ${mobilePane === 'preview' ? 'block' : 'hidden'} md:block`}
                        >
                            <StudentPreviewPane />
                        </div>
                    )}
                </div>
                <WorkspaceStatusBar onOpenValidation={openValidation} readOnly={isReadOnly} />
                <WorkspaceMobileTabs activePane={mobilePane} onChange={changeMobilePane} />
                {envelope && (
                    <PublishValidationDrawer
                        open={isValidationOpen}
                        issues={validationIssues}
                        quiz={envelope.quiz}
                        targetPoints={envelope.targetPoints}
                        onClose={() => setValidationOpen(false)}
                        onGoToQuestion={goToQuestionIssue}
                        onFixPoints={() => setPointDialogOpen(true)}
                        onFixTime={() => {
                            setValidationOpen(false);
                            setSettingsOpen(true);
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
