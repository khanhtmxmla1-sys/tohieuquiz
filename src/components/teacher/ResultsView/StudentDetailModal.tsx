import React, { useRef, useMemo, useState } from 'react';
import { StudentResult, Question } from '../../../types';
import { calculateStudentCompetency } from '../../../utils/competencyMapping';
import { useTeacherDashboardUIStore } from '../../../stores/useTeacherDashboardUIStore';
import { useAuthStore } from '../../../../stores/authStore';
import {
    buildDisplayQuestions,
    getQuestionResultCounts,
} from './student-detail/models/questionModel';
import {
    getFocusSkills,
    shouldShowCoverageWarning,
} from './student-detail/models/weaknessModel';
import { useAiInsight } from './student-detail/hooks/useAiInsight';
import { useQuestionReviewState } from './student-detail/hooks/useQuestionReviewState';
import { useResultImageExport } from './student-detail/hooks/useResultImageExport';
import { useSmartAssignmentPreview } from './student-detail/hooks/useSmartAssignmentPreview';
import { useWeaknessProfile } from './student-detail/hooks/useWeaknessProfile';
import { ReviewPanel } from './student-detail/components/ReviewPanel';
import { StudentDetailHeader } from './student-detail/components/StudentDetailHeader';
import { AnalyticsPanel } from './student-detail/components/AnalyticsPanel';
interface StudentDetailModalProps {
    result: StudentResult;
    questions: Question[];
    onClose: () => void;
    embedded?: boolean;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
    result,
    questions,
    onClose,
    embedded = false,
}) => {
    const authStore = useAuthStore();
    const openAssignmentComposerWithDraft = useTeacherDashboardUIStore((state) => state.openAssignmentComposerWithDraft);
    const reportRef = useRef<HTMLDivElement>(null);
    const questionsMap = useMemo(() => {
        const map: Record<string, Question> = {};
        questions.forEach(q => { map[q.id] = q; });
        return map;
    }, [questions]);

    const displayQuestions = useMemo(
        () => buildDisplayQuestions(result, questions),
        [result, questions]
    );

    const hasAnyData = displayQuestions.some(
        (question) => question.question || question.mainQuestion || question.text
            || question.options || question.items
    );
    const [activeTab, setActiveTab] = useState<'review' | 'analytics'>('review');
    const competencyData = useMemo(
        () => calculateStudentCompetency(result, questionsMap),
        [result, questionsMap]
    );
    const { weaknessProfile, isWeaknessLoading, weaknessError } =
        useWeaknessProfile(result.id, activeTab === 'analytics');
    const focusSkills = useMemo(() => getFocusSkills(weaknessProfile), [weaknessProfile]);
    const showCoverageWarning = shouldShowCoverageWarning(weaknessProfile);
    const {
        smartPreview, smartPreviewError, smartPreviewErrorDetails, isSmartPreviewLoading,
        selectedPreviewQuizId, setSelectedPreviewQuizId,
        smartDeadline, setSmartDeadline, smartMaxAttempts, setSmartMaxAttempts,
        handleLoadSmartPreview, handleUseSmartPreviewInAssignmentTab,
    } = useSmartAssignmentPreview(
        result, authStore.username, openAssignmentComposerWithDraft
    );
    const { aiInsight, isAnalyzing, analysisError, handleAnalyze } =
        useAiInsight(result, competencyData);
    const handleExportImage = useResultImageExport(reportRef, result);
    const {
        filterMode, setFilterMode, selectedQuestionIndex, setSelectedQuestionIndex,
        filteredQuestions, selectedQuestion,
    } = useQuestionReviewState(displayQuestions);
    const { correctCount, wrongCount } = getQuestionResultCounts(displayQuestions);
    return (
        <div className={embedded ? 'min-h-screen bg-slate-50' : 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4'}>
            <div className={embedded ? 'bg-white w-full min-h-screen overflow-hidden flex flex-col' : 'bg-white w-full h-dvh md:h-auto md:max-h-[92vh] md:max-w-[96vw] rounded-none md:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300'}>
                
                <StudentDetailHeader
                    result={result}
                    activeTab={activeTab}
                    hasAiInsight={Boolean(aiInsight)}
                    onTabChange={setActiveTab}
                    onExportImage={handleExportImage}
                    onClose={onClose}
                />
                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
                    {activeTab === 'review' ? (
                        <ReviewPanel
                            hasAnyData={hasAnyData}
                            displayQuestions={displayQuestions}
                            filteredQuestions={filteredQuestions}
                            correctCount={correctCount}
                            wrongCount={wrongCount}
                            filterMode={filterMode}
                            selectedQuestionIndex={selectedQuestionIndex}
                            selectedQuestion={selectedQuestion}
                            setFilterMode={setFilterMode}
                            setSelectedQuestionIndex={setSelectedQuestionIndex}
                        />
                    ) : (
                        <AnalyticsPanel
                            reportRef={reportRef}
                            studentName={result.studentName}
                            studentClass={result.studentClass}
                            competencyData={competencyData}
                            weaknessProfile={weaknessProfile}
                            focusSkills={focusSkills}
                            isWeaknessLoading={isWeaknessLoading}
                            weaknessError={weaknessError}
                            showCoverageWarning={showCoverageWarning}
                            smartPreview={smartPreview}
                            smartPreviewError={smartPreviewError}
                            smartPreviewErrorDetails={smartPreviewErrorDetails}
                            isSmartPreviewLoading={isSmartPreviewLoading}
                            selectedPreviewQuizId={selectedPreviewQuizId}
                            smartDeadline={smartDeadline}
                            smartMaxAttempts={smartMaxAttempts}
                            aiInsight={aiInsight}
                            isAnalyzing={isAnalyzing}
                            analysisError={analysisError}
                            onLoadSmartPreview={handleLoadSmartPreview}
                            onPreviewQuizChange={setSelectedPreviewQuizId}
                            onDeadlineChange={setSmartDeadline}
                            onMaxAttemptsChange={setSmartMaxAttempts}
                            onUseSmartPreview={handleUseSmartPreviewInAssignmentTab}
                            onAnalyze={handleAnalyze}
                        />
                    )}
                </div>

            </div>

            <style>{`
                @media print { .pdf-only { display: flex !important; } }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default StudentDetailModal;

