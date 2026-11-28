import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { useQuizStore } from '../../../stores/quizStore';
import { useClassStore } from '../../stores/useClassStore';
import { getTeacherRoute } from '../../app/navigationRoutes';
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
import { useManualQuizAutosave } from './hooks/useManualQuizAutosave';
import { useManualQuizEditorAccess } from './hooks/useManualQuizEditorAccess';
import { useManualQuizPublish } from './hooks/useManualQuizPublish';
import { useManualQuizWorkspaceRecovery } from './hooks/useManualQuizWorkspaceRecovery';
import {
    useManualQuizWorkspaceNavigation,
    type ManualQuizWorkspaceView,
} from './hooks/useManualQuizWorkspaceNavigation';
import { useManualQuizWorkspaceVersionAction } from './hooks/useManualQuizWorkspaceVersionAction';
import { useWorkspaceKeyboardShortcuts } from './hooks/useWorkspaceKeyboardShortcuts';
import { useManualQuizWorkspaceStore } from './store/useManualQuizWorkspaceStore';
import { validateManualQuiz } from './validation/manualQuizValidation';
import { reportManualQuizTelemetry } from '../../services/telemetryService';
import type {
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
    const [isValidationOpen, setValidationOpen] = useState(false);
    const [isSettingsOpen, setSettingsOpen] = useState(false);
    const [isPointDialogOpen, setPointDialogOpen] = useState(false);
    const [previousPoints, setPreviousPoints] = useState<Record<string, number> | null>(null);
    const [isQuestionBankOpen, setQuestionBankOpen] = useState(false);
    const [isQuestionImportOpen, setQuestionImportOpen] = useState(false);
    const [workspaceView, setWorkspaceView] = useState<ManualQuizWorkspaceView>('overview');
    const openedDraftRef = useRef<string | null>(null);
    const requestedDraftId = useMemo(() => new URLSearchParams(location.search).get('draftId'), [location.search]);
    const [editorAccessError, setEditorAccessError] = useState('');
    const questionEditorRef = useRef<QuestionEditorPaneHandle>(null);

    const seed = navigationState?.manualQuizSeed ?? DEFAULT_SEED;
    const { editability, editorAccessStatus } = useManualQuizEditorAccess({
        quizId,
        username,
        onEditorAccessErrorChange: setEditorAccessError,
    });
    const isReadOnly = editability?.mode === 'READONLY';

    const autosaveController = useManualQuizAutosave(isReadOnly ? null : envelope);
    const guardTransition = useCallback((): boolean => {
        const flushResult = questionEditorRef.current?.flush();
        return !flushResult || flushResult.ok;
    }, []);
    const { createVersion: handleCreateVersion, isCreatingVersion } = useManualQuizWorkspaceVersionAction({
        quizId,
        envelopeTitle: envelope?.quiz.title,
        availableQuizTitle: availableQuiz?.title,
        guardTransition,
        navigate,
        loadQuizzes,
        onEditorAccessErrorChange: setEditorAccessError,
    });
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

    const {
        pendingRecovery,
        remoteDraftStatus,
        remoteDraftError,
        continueRecoveredDraft,
        discardRecoveredDraft,
    } = useManualQuizWorkspaceRecovery({
        username,
        quizId,
        availableQuiz,
        seed,
        workspaceStartedAt: navigationState?.workspaceStartedAt,
        requestedDraftId,
        isReadOnly,
        editorAccessStatus,
        envelope,
        hydrateEnvelope,
        initializeFromQuiz,
        initializeFromSeed,
    });

    const {
        previewQuestion,
        focusQuestionEditor,
        handleQuestionEditorReady,
        openQuestionEditor,
        handleQuestionAdded,
        handleBackToOverview,
        handlePreview,
        handleBackFromPreview,
        moveQuestion,
        finishQuestionEdit,
        handleHeaderBack,
        requestPublish,
    } = useManualQuizWorkspaceNavigation({
        envelope,
        workspaceView,
        setWorkspaceView,
        serverResolutionVersion: autosaveController.serverResolutionVersion,
        isReadOnly,
        requiresPublishedWarning: editability?.requiresPublishedWarning,
        guardTransition,
        publishAfterGuard,
        selectQuestion,
        setValidationOpen,
        navigate,
    });

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
