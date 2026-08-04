import React from 'react';
import { BookOpen, Check, Shapes, Sparkles } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import QuestionBlueprintSection from './QuestionBlueprintSection';
import { QuestionTypeSelector, DifficultyLevelSelector } from '../../../components/teacher/QuizCreator';
import type { DifficultyLevels } from '../domain/quizCreation.types';
import type { QuizBlueprint, QuizBlueprintV3 } from '../domain/quizBlueprint';

interface QuestionSettingsSectionProps {
    selectedTypes: Record<string, boolean>;
    setSelectedTypes: (value: Record<string, boolean>) => void;
    difficultyLevels: DifficultyLevels;
    setDifficultyLevels: (value: DifficultyLevels) => void;
    questionBlueprint: QuizBlueprint;
    questionBlueprintV3?: QuizBlueprintV3 | null;
    setQuestionBlueprint: (value: QuizBlueprint) => void;
    showBlueprint?: boolean;
    showSvgDiagramOption?: boolean;
    autoGenerateSvg?: boolean;
    setAutoGenerateSvg?: (value: boolean) => void;
    isOpenTypes: boolean;
    isOpenDifficulty: boolean;
    onToggle: (id: string) => void;
}

const QuestionSettingsSection: React.FC<QuestionSettingsSectionProps> = ({
    selectedTypes,
    setSelectedTypes,
    difficultyLevels,
    setDifficultyLevels,
    questionBlueprint,
    questionBlueprintV3,
    setQuestionBlueprint,
    showBlueprint = true,
    showSvgDiagramOption = false,
    autoGenerateSvg = false,
    setAutoGenerateSvg,
    isOpenTypes,
    isOpenDifficulty,
    onToggle,
}) => {
    const questionCount = difficultyLevels.level1 + difficultyLevels.level2 + difficultyLevels.level3;
    const selectedTypesCount = Object.values(selectedTypes).filter(Boolean).length;

    return (
        <>
            <CollapsibleSection
                id="questionTypes"
                icon={<BookOpen className="h-4 w-4" />}
                title={showBlueprint ? 'Dạng câu hỏi & ma trận' : 'Dạng câu hỏi'}
                badge={`${selectedTypesCount} dạng · ${questionCount} câu`}
                isOpen={isOpenTypes}
                onToggle={onToggle}
            >
                <div className="space-y-4">
                    <QuestionTypeSelector
                        selectedTypes={selectedTypes}
                        onChange={setSelectedTypes}
                    />
                    {showSvgDiagramOption && setAutoGenerateSvg ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
                            <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                Hình ảnh và minh họa
                            </p>
                            <input
                                id="auto-generate-svg-diagrams"
                                type="checkbox"
                                checked={autoGenerateSvg}
                                onChange={(event) => setAutoGenerateSvg(event.target.checked)}
                                aria-label="Tự động thêm hình vẽ minh họa"
                                aria-describedby="auto-generate-svg-description auto-generate-svg-note"
                                className="peer sr-only"
                            />
                            <label
                                htmlFor="auto-generate-svg-diagrams"
                                className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors focus-within:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2 ${
                                    autoGenerateSvg
                                        ? 'border-blue-300 bg-blue-50'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <span
                                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                                        autoGenerateSvg
                                            ? 'border-blue-300 bg-blue-100 text-blue-700'
                                            : 'border-slate-200 bg-slate-100 text-slate-500'
                                    }`}
                                    aria-hidden="true"
                                >
                                    {autoGenerateSvg ? <Check className="h-5 w-5" /> : <Shapes className="h-5 w-5" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold text-slate-800">
                                        Tự động thêm hình vẽ minh họa
                                    </span>
                                    <span id="auto-generate-svg-description" className="mt-1 block text-xs leading-5 text-slate-600">
                                        AI sẽ tạo hình học, sơ đồ, trục số hoặc đồ thị cho những câu hỏi cần minh họa.
                                    </span>
                                    <span id="auto-generate-svg-note" className="mt-1 block text-xs font-medium text-amber-700">
                                        Có thể làm thời gian tạo đề lâu hơn một chút.
                                    </span>
                                </span>
                                <span className="mt-2 text-xs font-bold text-slate-500" aria-hidden="true">
                                    {autoGenerateSvg ? 'Đã bật' : 'Đang tắt'}
                                </span>
                            </label>
                        </div>
                    ) : null}
                    {showBlueprint && (
                        <QuestionBlueprintSection
                            blueprint={questionBlueprint}
                            blueprintV3={questionBlueprintV3}
                            onChange={setQuestionBlueprint}
                        />
                    )}
                </div>
            </CollapsibleSection>

            <CollapsibleSection
                id="difficulty"
                icon={<Sparkles className="h-4 w-4" />}
                title="Độ khó & Số lượng"
                badge={`${questionCount} câu`}
                isOpen={isOpenDifficulty}
                onToggle={onToggle}
            >
                <DifficultyLevelSelector
                    levels={difficultyLevels}
                    onChange={setDifficultyLevels}
                />
            </CollapsibleSection>
        </>
    );
};

export default QuestionSettingsSection;
