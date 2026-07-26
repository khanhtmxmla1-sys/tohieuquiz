import React from 'react';
import { useNavigate } from 'react-router';
import { Quiz } from '../../types';
import { Button } from '../common';
import { FileText, Sparkles, Search, Zap, Edit3, Wand2 } from 'lucide-react';
import QuizPreview from './QuizPreview';
import { useCreateQuizLogic } from '../../features/quiz-generator/hooks/useCreateQuizLogic';
import { buildManualQuizSeed } from '../../features/manual-quiz-workspace/domain/manualQuizSeed';
import { isManualQuizWorkspaceEnabled } from '../../config/featureFlags';

// Sub-components
import GeneralInfoSection from '../../features/quiz-generator/components/GeneralInfoSection';
import QuestionSettingsSection from '../../features/quiz-generator/components/QuestionSettingsSection';
import PedagogicalProfileSection from '../../features/quiz-generator/components/PedagogicalProfileSection';
import ContentSourceSection from '../../features/quiz-generator/components/ContentSourceSection';
import OcrPreviewSection from '../../features/quiz-generator/components/OcrPreviewSection';
import AdvancedSettingsSection from '../../features/quiz-generator/components/AdvancedSettingsSection';
import AssignmentSection from '../../features/quiz-generator/components/AssignmentSection';
import GenerationProgressPanel from '../../features/quiz-generator/components/GenerationProgressPanel';
import SuccessModal from '../../features/quiz-generator/components/SuccessModal';

interface CreateTabProps {
    editingQuiz: Quiz | null;
    onSaveQuiz: (quiz: Quiz) => Promise<void>;
    onUpdateQuiz: (quiz: Quiz) => Promise<void>;
    onSuccess: () => void;
}

const CreateTab: React.FC<CreateTabProps> = ({ editingQuiz, onSaveQuiz, onUpdateQuiz, onSuccess }) => {
    const logic = useCreateQuizLogic({ editingQuiz, onSaveQuiz, onUpdateQuiz, onSuccess });
    const navigate = useNavigate();

    const openManualWorkspace = () => {
        const manualQuizSeed = buildManualQuizSeed({
            quizTitle: logic.quizTitle,
            classLevel: logic.classLevel,
            category: logic.category,
            manualTimeLimit: logic.manualTimeLimit,
            tags: logic.tags,
            requireCode: logic.requireCode,
            accessCode: logic.accessCode,
            showOnHome: logic.showOnHome,
        });
        if (!isManualQuizWorkspaceEnabled()) {
            logic.setGeneratedQuiz({
                id: `manual-legacy-${Date.now()}`,
                title: manualQuizSeed.title,
                topic: manualQuizSeed.category,
                classLevel: manualQuizSeed.classLevel,
                category: manualQuizSeed.category,
                tags: [...manualQuizSeed.tags],
                timeLimit: manualQuizSeed.timeLimit,
                questions: [],
                createdAt: new Date().toISOString(),
                requireCode: manualQuizSeed.requireCode,
                accessCode: manualQuizSeed.accessCode,
                showOnHome: manualQuizSeed.showOnHome,
            });
            return;
        }
        navigate('/teacher/quizzes/manual/new', {
            state: {
                manualQuizSeed,
                workspaceStartedAt: new Date().toISOString(),
            },
        });
    };

    const questionCount = logic.difficultyLevels.level1 + logic.difficultyLevels.level2 + logic.difficultyLevels.level3;
    const aiQuizV2Enabled = logic.aiQuizV2Enabled;
    const generationConfigurationInvalid = aiQuizV2Enabled && !logic.isBlueprintValid;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Form */}
            <div className="space-y-3">
                {/* ====== GRADIENT HEADER ====== */}
                <div className={`rounded-2xl p-5 ${editingQuiz
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500'
                    } text-white shadow-lg`}
                >
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                            {editingQuiz ? <Edit3 className="w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">
                                {editingQuiz ? 'Chỉnh sửa đề thi' : 'Tạo đề kiểm tra mới'}
                            </h2>
                            <p className="text-sm text-white/80">
                                {editingQuiz ? `Đang sửa: ${editingQuiz.title}` : 'AI sẽ giúp bạn tạo đề nhanh chóng'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ====== SECTIONS ====== */}
                <GeneralInfoSection
                    {...logic}
                    isOpen={logic.expandedSections.basic}
                    onToggle={logic.toggleSection}
                    aiSuggestions={{
                        category: logic.aiDetectedCategory,
                        lesson: logic.aiDetectedLesson,
                        tags: logic.aiSuggestedTags
                    }}
                    onApplyAiCategory={logic.handleApplyAiCategory}
                    onApplyAiTitle={logic.handleApplyAiTitleSuggestion}
                    onAddTag={logic.addTagToState}
                    isPdfMode={logic.quizMode === 'pdf'}
                />

                <QuestionSettingsSection
                    selectedTypes={logic.selectedTypes}
                    setSelectedTypes={logic.setSelectedTypes}
                    difficultyLevels={logic.difficultyLevels}
                    setDifficultyLevels={logic.setDifficultyLevels}
                    questionBlueprint={logic.questionBlueprint}
                    questionBlueprintV3={logic.aiBlueprintV3Enabled ? logic.questionBlueprintV3 : null}
                    setQuestionBlueprint={logic.setQuestionBlueprint}
                    showBlueprint={aiQuizV2Enabled}
                    isOpenTypes={logic.expandedSections.questionTypes}
                    isOpenDifficulty={logic.expandedSections.difficulty}
                    onToggle={logic.toggleSection}
                />

                <PedagogicalProfileSection
                    promptProfile={logic.promptProfile}
                    profilePresetNotice={logic.profilePresetNotice}
                    isOpen={logic.expandedSections.pedagogy}
                    onToggle={logic.toggleSection}
                    onToggleThongTu27={logic.handleToggleThongTu27}
                    onSelectLearnerMode={logic.handleSelectLearnerMode}
                />

                <ContentSourceSection
                    content={logic.content}
                    setContent={logic.setContent}
                    uploadedFile={logic.uploadedFile}
                    setUploadedFile={logic.setUploadedFile}
                    fileInputRef={logic.fileInputRef}
                    customPrompt={logic.customPrompt}
                    setCustomPrompt={logic.setCustomPrompt}
                    isOpen={logic.expandedSections.content}
                    onToggle={logic.toggleSection}
                />

                {aiQuizV2Enabled && logic.ocrDocument && (
                    <OcrPreviewSection
                        document={logic.ocrDocument}
                        selectedPageNumbers={logic.selectedOcrPageNumbers}
                        onChange={logic.setSelectedOcrPageNumbers}
                    />
                )}

                <AdvancedSettingsSection
                    requireCode={logic.requireCode}
                    setRequireCode={logic.setRequireCode}
                    accessCode={logic.accessCode}
                    setAccessCode={logic.setAccessCode}
                    generateRandomCode={logic.generateRandomCode}
                    showOnHome={logic.showOnHome}
                    setShowOnHome={logic.setShowOnHome}
                    aiProvider={logic.aiProvider}
                    setAiProvider={logic.setAiProvider}
                    isAdmin={logic.authStore.isAdmin}
                    isOpen={logic.expandedSections.advanced}
                    onToggle={logic.toggleSection}
                />

                <AssignmentSection
                    assignToClass={logic.assignToClass}
                    setAssignToClass={logic.setAssignToClass}
                    selectedClassId={logic.selectedClassId}
                    setSelectedClassId={logic.setSelectedClassId}
                    deadline={logic.deadline}
                    setDeadline={logic.setDeadline}
                    maxAttempts={logic.maxAttempts}
                    setMaxAttempts={logic.setMaxAttempts}
                    classes={logic.classStore.classes}
                    isOpen={logic.expandedSections.assign}
                    onToggle={logic.toggleSection}
                />

                {/* ====== ERROR ====== */}
                {logic.error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                        <span>⚠️</span> {logic.error}
                    </div>
                )}

                {/* ====== GENERATE BUTTONS ====== */}
                <div className="space-y-3 sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4 pb-2">
                    {logic.isTeacherAccount && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
                            Lượt tạo đề AI hôm nay: <span className="font-bold">{logic.aiUsageRemaining}/{logic.dailyAiLimit}</span>
                        </div>
                    )}
                    {aiQuizV2Enabled && logic.generationStep !== 'idle' && (
                        <GenerationProgressPanel
                            step={logic.generationStep}
                            onCancel={logic.cancelGeneration}
                        />
                    )}
                    {(!aiQuizV2Enabled || !logic.isGenerating) && (logic.category === 'trang-nguyen' ? (
                        <div className="space-y-2">
                            <button
                                onClick={() => { logic.setTnSearchMode('search'); logic.handleGenerate('practice'); }}
                                disabled={!logic.topic.trim() || questionCount === 0 || generationConfigurationInvalid || logic.isGenerating || (logic.isTeacherAccount && !logic.hasAiQuota)}
                                className={`w-full py-3.5 px-6 rounded-xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${logic.isGenerating && logic.tnSearchMode === 'search'
                                    ? 'bg-gradient-to-r from-sky-400 to-pink-400 animate-pulse'
                                    : 'bg-gradient-to-r from-blue-600 to-pink-600 hover:from-blue-700 hover:to-pink-700'
                                    }`}
                            >
                                <Search className="w-5 h-5" />
                                {logic.isGenerating && logic.tnSearchMode === 'search'
                                    ? (logic.generationStep === 'reviewing' ? '🤖 Đang duyệt...' : '🔍 Đang tìm đề...')
                                    : `🔍 Tạo đề (Search) - ${questionCount} câu`
                                }
                            </button>
                            <button
                                onClick={() => { logic.setTnSearchMode('quick'); logic.handleGenerate('practice'); }}
                                disabled={!logic.topic.trim() || questionCount === 0 || generationConfigurationInvalid || logic.isGenerating || (logic.isTeacherAccount && !logic.hasAiQuota)}
                                className={`w-full py-3.5 px-6 rounded-xl font-bold text-white text-base flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${logic.isGenerating && logic.tnSearchMode === 'quick'
                                    ? 'bg-gradient-to-r from-blue-400 to-cyan-400 animate-pulse'
                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                                    }`}
                            >
                                <Zap className="w-5 h-5" />
                                {logic.isGenerating && logic.tnSearchMode === 'quick'
                                    ? (logic.generationStep === 'reviewing' ? '🤖 Đang duyệt...' : '⚡ Đang sinh đề...')
                                    : `⚡ Tạo đề nhanh (AI) - ${questionCount} câu`
                                }
                            </button>
                        </div>
                    ) : (
                        <>
                            {logic.uploadedFile && (
                                <Button
                                    onClick={() => logic.handleGenerate('pdf')}
                                    loading={logic.isGenerating && logic.quizMode === 'pdf'}
                                    disabled={
                                        !logic.uploadedFile
                                        || questionCount === 0
                                        || generationConfigurationInvalid
                                        || (aiQuizV2Enabled && logic.ocrDocument && logic.selectedOcrPageNumbers.length === 0)
                                        || (logic.isTeacherAccount && !logic.hasAiQuota)
                                    }
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                    size="lg"
                                    variant="primary"
                                    icon={<FileText className="w-5 h-5" />}
                                >
                                    {aiQuizV2Enabled
                                        ? (logic.ocrDocument
                                            ? `📄 TẠO ĐỀ TỪ ${logic.selectedOcrPageNumbers.length} TRANG ĐÃ CHỌN`
                                            : `📖 ĐỌC VÀ XEM TRƯỚC: ${logic.uploadedFile.name.substring(0, 20)}...`)
                                        : `📄 TẠO ĐỀ TỪ FILE: ${logic.uploadedFile.name.substring(0, 20)}...`}
                                </Button>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => logic.handleGenerate('exam')}
                                    disabled={!logic.topic.trim() || questionCount === 0 || generationConfigurationInvalid || logic.isGenerating || (logic.isTeacherAccount && !logic.hasAiQuota)}
                                    className={`py-3.5 px-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm ${logic.isGenerating && logic.quizMode === 'exam'
                                        ? 'bg-gradient-to-r from-orange-400 to-red-400 animate-pulse'
                                        : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                                        }`}
                                >
                                    <FileText className="w-4 h-4" />
                                    {logic.isGenerating && logic.quizMode === 'exam' ? (logic.generationStep === 'reviewing' ? '🤖 Đang duyệt...' : 'Đang tạo...') : '📝 Ra đề THI'}
                                </button>
                                <button
                                    onClick={() => logic.handleGenerate('practice')}
                                    disabled={!logic.topic.trim() || questionCount === 0 || generationConfigurationInvalid || logic.isGenerating || (logic.isTeacherAccount && !logic.hasAiQuota)}
                                    className={`py-3.5 px-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm ${logic.isGenerating && logic.quizMode === 'practice'
                                        ? 'bg-gradient-to-r from-emerald-400 to-teal-400 animate-pulse'
                                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                                        }`}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    {logic.isGenerating && logic.quizMode === 'practice' ? (logic.generationStep === 'reviewing' ? '🤖 Đang duyệt...' : 'Đang tạo...') : '📚 Ra đề ÔN TẬP'}
                                </button>
                            </div>
                        </>
                    ))}
                </div>
            </div>

            {/* Right Column - Preview */}
            <div>
                <QuizPreview
                    quiz={logic.generatedQuiz}
                    onSave={logic.handleSaveQuiz}
                    isSaving={logic.isSaving}
                    onUpdateQuestions={(questions) => {
                        if (logic.generatedQuiz) {
                            logic.setGeneratedQuiz({ ...logic.generatedQuiz, questions });
                        }
                    }}
                    onStartManual={openManualWorkspace}
                    onRegenerateQuestion={logic.handleRegenerateSingle}
                />
            </div>

            {/* Modals */}
            <SuccessModal
                show={logic.showLinkModal}
                onClose={() => logic.setShowLinkModal(false)}
                quizLink={logic.savedQuizLink}
                isCopied={logic.linkCopied}
                onCopy={logic.handleCopyLink}
            />
        </div>
    );
};

export default CreateTab;
