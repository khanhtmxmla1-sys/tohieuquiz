import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { useQuizStore } from '../../../stores/quizStore';
import { useTeacherDashboardUIStore } from '../../stores/useTeacherDashboardUIStore';
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
import type {
    ManualQuizDraftEnvelope,
    ManualQuizNavigationState,
    ManualQuizSeed,
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
    const availableQuiz = useQuizStore((state) =>
        quizId ? state.quizzes.find((quiz) => quiz.id === quizId) ?? null : null,
    );
    const setView = useQuizStore((state) => state.setView);
    const setActiveTab = useTeacherDashboardUIStore((state) => state.setActiveTab);
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
    const [isPointDialogOpen, setPointDialogOpen] = useState(false);
    const [previousPoints, setPreviousPoints] = useState<Record<string, number> | null>(null);
    const [isQuestionBankOpen, setQuestionBankOpen] = useState(false);
    const [isQuestionImportOpen, setQuestionImportOpen] = useState(false);
    const [mobilePane, setMobilePane] = useState<WorkspaceMobilePane>('editor');
    const openedDraftRef = useRef<string | null>(null);

    const seed = navigationState?.manualQuizSeed ?? DEFAULT_SEED;

    const autosaveController = useManualQuizAutosave(envelope);
    const handlePublishSuccess = useCallback(() => {
        setActiveTab('manage');
        setView('teacher_dash');
        setValidationOpen(false);
        navigate('/');
    }, [navigate, setActiveTab, setView]);
    const publishController = useManualQuizPublish({
        envelope,
        onSuccess: handlePublishSuccess,
    });
    const validationIssues = useMemo(() => envelope
        ? validateManualQuiz(envelope.quiz, { targetPoints: envelope.targetPoints })
        : [], [envelope]);

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
    }, [envelope, validationIssues]);

    const closeActiveSurface = useCallback(() => {
        if (isValidationOpen) setValidationOpen(false);
        else if (isPointDialogOpen) setPointDialogOpen(false);
        else if (isQuestionImportOpen) setQuestionImportOpen(false);
        else if (isQuestionBankOpen) setQuestionBankOpen(false);
        else if (!isPreviewCollapsed) setPreviewCollapsed(true);
    }, [
        isPointDialogOpen,
        isPreviewCollapsed,
        isQuestionBankOpen,
        isQuestionImportOpen,
        isValidationOpen,
        setPreviewCollapsed,
    ]);

    useWorkspaceKeyboardShortcuts({
        enabled: Boolean(envelope),
        onSaveDraft: autosaveController.saveNow,
        onEscape: closeActiveSurface,
    });

    useEffect(() => {
        if (!username || envelope || pendingRecovery || recoveryChecked) return;

        const latestDraft = findLatestLocalDraft(username, quizId);
        const workspaceStartedAt = navigationState?.workspaceStartedAt;
        const isNewerThanCurrentEntry = latestDraft
            && (!workspaceStartedAt || latestDraft.updatedAt > workspaceStartedAt);

        if (latestDraft && isNewerThanCurrentEntry) {
            setPendingRecovery(latestDraft);
            setRecoveryChecked(true);
            return;
        }

        setRecoveryChecked(true);
        if (availableQuiz) {
            initializeFromQuiz(availableQuiz, username);
        } else {
            initializeFromSeed(seed, username);
        }
    }, [
        availableQuiz,
        envelope,
        initializeFromQuiz,
        initializeFromSeed,
        navigationState?.workspaceStartedAt,
        pendingRecovery,
        quizId,
        recoveryChecked,
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

    return (
        <ManualQuizWorkspaceGuard>
            <div
                data-testid="manual-quiz-workspace"
                data-mode={quizId ? 'edit' : 'new'}
                data-quiz-id={quizId || undefined}
                className="flex h-[100dvh] min-h-[640px] max-w-full flex-col overflow-x-hidden overflow-y-hidden bg-[#FFFDF7] font-['Be_Vietnam_Pro',sans-serif] text-[#172033]"
            >
                <h1 className="sr-only">Phòng soạn đề thủ công</h1>
                <WorkspaceHeader onOpenValidation={openValidation} />
                <div
                    data-testid="workspace-grid"
                    data-mobile-pane={mobilePane}
                    className={`relative grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden ${tabletColumnClass} ${desktopColumnClass}`}
                >
                    {!isNavigatorCollapsed && (
                        <div
                            id="workspace-pane-list"
                            data-testid="workspace-pane-list"
                            data-mobile-visible={mobilePane === 'list'}
                            className={`min-h-0 min-w-0 overflow-hidden ${mobilePane === 'list' ? 'block' : 'hidden'} md:block`}
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
                <WorkspaceStatusBar onOpenValidation={openValidation} />
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
                        onFixTime={() => updateQuiz({ timeLimit: 30 })}
                        onPublish={() => void publishController.publish()}
                        isPublishing={publishController.isPublishing}
                        publishError={publishController.error}
                        cleanupWarning={publishController.cleanupWarning}
                        canUndoPoints={previousPoints !== null}
                        onUndoPoints={undoPointDistribution}
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
